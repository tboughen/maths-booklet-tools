import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { addedNote, servedParts } from "./cuts";
import { verifyCatalogue, type BankQuestion } from "./model";

const view = {id: "v-1", label: "v", page: 1, width: 500, height: 100, preview: "bank/assets/x/v.png", description: "", sourcePages: [2]};
const cut = (id: string, kind: "part" | "stem", parts: string[], context: string[] = [], requiresAnswerTo: string[] = []) =>
  ({id, kind, label: kind === "stem" ? "Stem" : `(${id})`, parts, pdf: `bank/assets/x/${id}.pdf`, views: [view], context, requiresAnswerTo});
const question = {
  id: "Q7", marks: 6,
  parts: [{label: "7a", marks: 1, codes: ["U1"]}, {label: "7b", marks: 2, codes: ["U2"]}, {label: "7c", marks: 3, codes: ["U3"]}],
  cuts: [cut("stem", "stem", []), cut("a", "part", ["7a"], ["stem"]), cut("b", "part", ["7b"], ["stem", "a"], ["a"]), cut("c", "part", ["7c"], ["stem"])],
} as unknown as BankQuestion;

describe("serving parts on their own", () => {
  it("serves a part with its stem", () => {
    const served = servedParts(question, ["7c"])!;
    expect(served.cuts.map(c => [c.cut.id, c.role, c.added])).toEqual([["stem", "context", false], ["c", "part", false]]);
    expect(served).toMatchObject({parts: ["7c"], marks: 3, label: "(c)", title: "Part (c)"});
    expect(addedNote(served)).toBe("");
  });
  it("never serves a part without the earlier part whose answer it needs", () => {
    const served = servedParts(question, ["7b"])!;
    expect(served.cuts.map(c => [c.cut.id, c.added])).toEqual([["stem", false], ["a", true], ["b", false]]);
    expect(served).toMatchObject({parts: ["7a", "7b"], marks: 3, label: "(a) and (b)", title: "Parts (a) and (b)"});
    expect(addedNote(served)).toBe("Comes with (a).");
  });
  it("serves the whole question when the parts would make it up, or it has no cuts", () => {
    expect(servedParts(question, ["7b", "7c"])).toBeUndefined();
    expect(servedParts(question, ["7d"])).toBeUndefined();
    expect(servedParts({...question, cuts: undefined}, ["7a"])).toBeUndefined();
  });
  it("finds every needs-answer part in the real catalogue", () => {
    const bank = verifyCatalogue(JSON.parse(readFileSync("public/bank/catalogue.json", "utf8")));
    let needing = 0;
    for (const q of bank.questions) for (const c of q.cuts ?? []) {
      if (c.kind !== "part" || !c.requiresAnswerTo.length) continue;
      needing++;
      const served = servedParts(q, c.parts);
      const ids = served ? served.cuts.map(s => s.cut.id) : (q.cuts ?? []).map(s => s.id);
      for (const id of c.requiresAnswerTo) expect(ids, `${q.id} ${c.id}`).toContain(id);
    }
    expect(needing).toBe(133);
  });
});
