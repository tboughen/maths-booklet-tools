import { describe, expect, it } from "vitest";
import * as t from "./index";
import { examples } from "./examples";
import { create, revise } from "./interchange";

describe("two-way tables (U97)", () => {
  it("keeps blanks, zero and hidden answers distinct and exact", () => {
    let e = t.create(["Walk", "Bus"], ["Year 7", "Year 8"]);
    e = t.setCell(e, "r1", "c1", "0");
    e = t.setCell(e, "r1", "c2", "2½", "hidden");
    expect(t.cellAt(e.document, "r1", "c1")).toEqual({ text: "0", show: "show" });
    expect(t.cellAt(e.document, "r1", "c2")).toEqual({ text: "2 1/2", show: "hidden" });
    expect(t.cellAt(e.document, "r2", "c1")).toEqual({ text: "", show: "show" });
    expect(() => t.setCell(e, "r1", "c1", "two")).toThrow(/integer|fraction/);
  });
  it("prints hidden answers only on the answers copy, in the answer colour", () => {
    const e = examples[0].make(false);
    const pupil = t.renderSvg(e),
      answers = t.renderSvg(t.forView(e, "answer", true));
    expect(pupil).not.toContain(">18<");
    expect(answers).toContain(`fill="${t.ANSWER_COLOUR}">18<`);
    expect(t.renderSvg(examples[0].make(true))).not.toContain(t.ANSWER_COLOUR);
  });
  it("warns only when complete parts disagree with a total, unless it is a deliberate error", () => {
    const e = examples[0].make(true);
    expect(t.warnings(e)).toEqual([]);
    const wrong = t.setCell(e, "r1", "c1", "19");
    expect(t.warnings(wrong).join(" ")).toMatch(/row Year 7 add to 53, not 52/);
    expect(t.warnings({ ...wrong, document: { ...wrong.document, intentionalError: true } })).toEqual([]);
    expect(t.warnings(examples[0].make(false))).toEqual([]);
  });
  it("completes only blank totals, exactly, including the grand total", () => {
    let e = t.create(["A", "B"], ["X", "Y"]);
    for (const [r, c, v] of [["r1", "c1", "1.5"], ["r1", "c2", "2.25"], ["r2", "c1", "3"], ["r2", "c2", "4"]] as const) e = t.setCell(e, r, c, v);
    const { envelope, filled } = t.completeTotals(e);
    expect(filled).toBe(5);
    expect(envelope.document.rows[0].cells[2].text).toBe("3.75");
    expect(envelope.document.totalRow![2].text).toBe("10.75");
    const fractions = t.completeTotals(t.setCell(t.setCell(t.create(["A", "B"], ["X"], true), "r1", "c1", "1/3"), "r1", "c2", "1/6")).envelope;
    expect(fractions.document.rows[0].cells[2].text).toBe("1/2");
    expect(t.renderSvg(fractions)).toContain("<line"); // stacked fraction bar
  });
  it("adds and removes structure and totals", () => {
    let e = t.create(["A"], ["X"], false);
    e = t.addColumn(t.addRow(e, "Y"), "B");
    expect(e.document.rows.map((r) => r.cells.length)).toEqual([2, 2]);
    e = t.setTotals(e, { row: true, column: true });
    expect(e.document.totalRow).toHaveLength(3);
    e = t.removeColumn(e, "c1");
    expect(e.document.rows[0].cells).toHaveLength(2);
    expect(() => t.removeRow(t.removeRow(e, "r1"), "r2")).toThrow(/at least one row/);
  });
  it("round-trips through files and links, and refuses oversize tables", () => {
    const e = examples[2].make(false);
    expect(t.parseFile(JSON.stringify(e))).toEqual(e);
    const link = t.editorLink(e, "https://mathsdock.co.uk/")!;
    expect(t.decodeLinkHash(new URL(link).hash)).toEqual(e);
    const wide = t.create(["Very long heading one", "Very long heading two", "Very long heading 3", "Long heading four", "Long heading five"], ["X"]);
    expect(t.exportIssue({ ...wide, document: { ...wide.document, cellMm: 36 } })).toMatch(/print width/);
  });
  it("creates and revises through the connector, keeping pupil blanks", async () => {
    const e = create({
      spec: {
        columns: ["Tea", "Coffee"],
        rows: [{ heading: "Men", cells: ["12", { text: "8", hidden: true }, ""] }, { heading: "Women", cells: ["15", "10", ""] }],
        totalRow: ["", "", "45"],
      },
    });
    expect(t.cellAt(e.document, "r1", "c2")).toEqual({ text: "8", show: "hidden" });
    expect(t.cellAt(e.document, "r1", "total").text).toBe("");
    const revised = await revise({ envelope: e, baseHash: await t.hash(e), operations: [{ op: "complete_totals", hidden: true }] });
    expect(t.cellAt(revised.document, "r1", "total")).toEqual({ text: "20", show: "hidden" });
    expect(t.cellAt(revised.document, "total", "c1")).toEqual({ text: "27", show: "hidden" });
    await expect(revise({ envelope: e, baseHash: "0".repeat(64), operations: [] })).rejects.toThrow(/base_hash/);
  });
});
