import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { catalogueCoverage } from "./coverage";
import { emptyRoute, verifyCatalogue } from "./model";
import { draftReducer, emptyDraft, type PaperDraft } from "./paper-builder";
import { loadPaperDraft, PAPER_STORAGE_KEY, parsePaperDraft, savePaperDraft } from "./paper-storage";
import { TopicPaperBuilder } from "./TopicPaperBuilder";

const memory = () => {
  const items = new Map<string, string>();
  return { items, getItem: (k: string) => items.get(k) ?? null, setItem: (k: string, v: string) => void items.set(k, v), removeItem: (k: string) => void items.delete(k) };
};
const draft: PaperDraft = { codes: ["U538", "U793"], manual: { "1MA1_JUN_2018_3H_Q3": "1MA1_JUN_2018_3H_Q3" }, excluded: ["x"], order: ["b", "a"], version: "v7", manuallyOrdered: true };

describe("paper draft saved on this device", () => {
  it("round-trips every part of the draft, including manual order and exclusions", () => {
    const store = memory();
    savePaperDraft(draft, store);
    expect(JSON.parse(store.items.get(PAPER_STORAGE_KEY)!)).toMatchObject({ schema: 1 });
    expect(loadPaperDraft(store)).toEqual(draft);
  });

  it("clearing the paper removes the saved copy", () => {
    const store = memory();
    savePaperDraft(draft, store);
    savePaperDraft(draftReducer(draft, { type: "clear" }), store);
    expect(store.items.has(PAPER_STORAGE_KEY)).toBe(false);
    expect(loadPaperDraft(store)).toEqual(emptyDraft());
  });

  it("starts empty when the saved value is missing, corrupt or another shape", () => {
    expect(loadPaperDraft(memory())).toEqual(emptyDraft());
    const store = memory();
    store.setItem(PAPER_STORAGE_KEY, "{not json");
    expect(loadPaperDraft(store)).toEqual(emptyDraft());
    expect(parsePaperDraft({ ...draft, schema: 2 })).toBeNull();
    expect(parsePaperDraft({ ...draft, schema: 1, codes: [1] })).toBeNull();
    expect(parsePaperDraft({ ...draft, schema: 1, manual: ["a"] })).toBeNull();
    expect(parsePaperDraft({ ...draft, schema: 1, manual: { a: 2 } })).toBeNull();
  });

  it("keeps working when storage is blocked", () => {
    const blocked = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("full"); }, removeItem: () => { throw new Error("blocked"); } };
    expect(loadPaperDraft(blocked)).toEqual(emptyDraft());
    expect(() => savePaperDraft(draft, blocked)).not.toThrow();
  });
});

describe("topic table defaults to codes with questions", () => {
  const bank = verifyCatalogue(JSON.parse(readFileSync("public/bank/catalogue.json", "utf8")));
  const coverage = catalogueCoverage(bank, emptyRoute);
  const filters = { tier: emptyRoute.tier, calculator: emptyRoute.calculator, collection: emptyRoute.collection };
  const covered = bank.topics.filter(t => coverage.codes.get(t.code)?.size).length;
  const uncovered = bank.topics.length - covered;
  const uncoveredCode = bank.topics.find(t => !coverage.codes.get(t.code)?.size)!.code;
  const table = (d: PaperDraft) => render(<TopicPaperBuilder catalogue={bank} coverage={coverage} overall={coverage} filters={filters} draft={d} entries={[]} onCode={() => {}} onFilters={() => {}} onBrowse={() => {}} />);

  it("lists only codes with questions until All codes is chosen", async () => {
    expect(uncovered).toBeGreaterThan(0);
    table(emptyDraft());
    const body = () => screen.getAllByRole("rowgroup")[1];
    expect(within(body()).getAllByRole("row")).toHaveLength(covered);
    const show = screen.getByRole("combobox", { name: "Show" });
    expect(show).toHaveValue("covered");
    expect(within(show).getByRole("option", { name: `All codes, including ${uncovered} without questions` })).toBeInTheDocument();
    await userEvent.selectOptions(show, "all");
    expect(within(body()).getAllByRole("row")).toHaveLength(bank.topics.length);
  });

  it("keeps a ticked code visible even when it has no questions", () => {
    table({ ...emptyDraft(), codes: [uncoveredCode] });
    expect(screen.getByRole("checkbox", { name: `Include questions for ${uncoveredCode}` })).toBeChecked();
  });

  it("says when a search matches codes that have no questions", async () => {
    table(emptyDraft());
    await userEvent.type(screen.getByRole("searchbox", { name: "Search codes or topics" }), uncoveredCode);
    expect(screen.getByText("No codes with questions match this search.")).toBeInTheDocument();
    expect(screen.getByText(/1 matching code has no questions under these filters/)).toBeInTheDocument();
  });
});
