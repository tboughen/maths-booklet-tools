import { describe, expect, it } from "vitest";
import * as s from "./index";
import { examples } from "./examples";
import { create, revise } from "./interchange";

describe("sample space diagrams (P-3)", () => {
  it("starts as two dice with every cell blank", () => {
    const e = s.create();
    expect(e.document.rows.map((r) => r.heading)).toEqual(["1", "2", "3", "4", "5", "6"]);
    expect(s.allCells(e.document).every((c) => c.text === "" && c.show === "show")).toBe(true);
    expect(s.warnings(e)).toEqual([]);
  });
  it("keeps blanks, zero, hidden answers and circles distinct", () => {
    let e = s.create(["H", "T"], ["1", "2"]);
    e = s.setCell(e, "r1", "c1", { text: "0" });
    e = s.setCell(e, "r1", "c2", { text: "H2", show: "hidden", ring: true });
    expect(s.cellAt(e.document, "r1", "c1")).toEqual({ text: "0", show: "show" });
    expect(s.cellAt(e.document, "r1", "c2")).toEqual({ text: "H2", show: "hidden", ring: true });
    expect(s.cellAt(e.document, "r2", "c1")).toEqual({ text: "", show: "show" });
    expect(() => s.setCell(e, "r2", "c1", { show: "hidden" })).toThrow(/blank cell/);
    // Clearing a cell makes it a plain blank again.
    expect(s.cellAt(s.setCell(e, "r1", "c2", { text: "" }).document, "r1", "c2").show).toBe("show");
    expect(s.cellAt(s.setCell(e, "r1", "c2", { ring: false }).document, "r1", "c2").ring).toBeUndefined();
  });
  it("fills only when asked, only blank cells, exactly", () => {
    let e = s.create(["1/2", "1"], ["1/4", "2"]);
    e = s.setCell(e, "r1", "c1", { text: "9" });
    const sum = s.fillCells(e, "sum", true);
    expect(sum.filled).toBe(3);
    expect(sum.envelope.document.corner).toBe("+");
    expect(sum.envelope.document.rows.map((r) => r.cells.map((c) => c.text))).toEqual([["9", "2 1/2"], ["1 1/4", "3"]]);
    expect(sum.envelope.document.rows[1].cells[0].show).toBe("hidden");
    expect(s.fillCells(s.create(["1.5"], ["0.25"]), "product").envelope.document.rows[0].cells[0].text).toBe("0.375");
    expect(s.fillCells(s.create(["2"], ["5"]), "difference").envelope.document.rows[0].cells[0].text).toBe("3");
    expect(s.fillCells(s.create(["H"], ["6"]), "pair").envelope.document.rows[0].cells[0].text).toBe("(H, 6)");
    expect(() => s.fillCells(s.create(["H"], ["6"]), "sum")).toThrow(/must be a number/);
  });
  it("warns when a cell disagrees with the corner sign, unless it is a deliberate error", () => {
    const e = examples[0].make(true);
    expect(s.warnings(e)).toEqual([]);
    const wrong = s.setCell(e, "r2", "c3", { text: "6" });
    expect(s.warnings(wrong)).toEqual(["The cell for 2 and 3 holds 6; the sum is 5."]);
    expect(s.warnings({ ...wrong, document: { ...wrong.document, intentionalError: true } })).toEqual([]);
  });
  it("prints hidden answers only on the answers copy, in the answer colour, with stacked fractions", () => {
    const e = examples[1].make(false);
    expect(s.renderSvg(e)).not.toContain(">24<");
    expect(s.renderSvg(s.forView(e, "answer", true))).toContain(`fill="${s.ANSWER_COLOUR}">24<`);
    expect(s.renderSvg(examples[1].make(true))).not.toContain(s.ANSWER_COLOUR);
    const fractions = s.renderSvg(s.fillCells(s.create(["1/2"], ["1/3"]), "sum").envelope);
    expect(fractions).not.toMatch(/>[^<]*\/[^<]*</);
    expect(fractions).toContain(">5<");
  });
  it("circles chosen outcomes in black and white and keeps them inside their cell", () => {
    const e = examples[3].make(true),
      svg = s.renderSvg(e);
    expect(svg.match(/<ellipse/g)).toHaveLength(8);
    expect(svg).toContain('fill="none" stroke="black"');
    expect(s.exportIssue(e)).toBeNull();
  });
  it("prints titles and blocks a table wider than the page", () => {
    const e = examples[0].make(false),
      svg = s.renderSvg(e);
    expect(svg).toContain(">Dice B<");
    expect(svg).toMatch(/rotate\(-90[^"]*"[^>]*>Dice A</);
    const wide = s.validate({ ...s.create(undefined, Array.from({ length: 10 }, (_, i) => String(i))), document: { ...s.create().document, columns: Array.from({ length: 10 }, (_, i) => ({ id: `c${i + 1}`, heading: String(i) })), rows: [{ id: "r1", heading: "1", cells: Array.from({ length: 10 }, () => s.cell()) }], cellMm: 30 } });
    expect(s.exportIssue(wide)).toMatch(/over the 180 mm/);
  });
  it("reads back every example and link exactly", () => {
    for (const x of examples)
      for (const worked of [false, true]) {
        const e = x.make(worked);
        expect(s.canonical(s.parseFile(s.canonical(e)))).toBe(s.canonical(e));
        expect(s.canonical(s.decodeLinkHash(s.linkHash(e)))).toBe(s.canonical(e));
      }
    expect(() => s.parseFile('{"kind":"sample-space","schemaVersion":2}')).toThrow(/version 1/);
  });
  it("connector: creates from a spec, fills as hidden answers by default and revises with the hash", async () => {
    const e = create({ spec: { rows: ["H", "T"], columns: ["1", "2", "3"], rowTitle: "Coin", cells: [["H1", { text: "H2", ring: true }]], fill: { operation: "pair" } } });
    expect(e.document.rows[0].cells.map((c) => c.text)).toEqual(["H1", "H2", "(H, 3)"]);
    expect(e.document.rows[0].cells[1].ring).toBe(true);
    expect(e.document.rows[1].cells[0]).toEqual({ text: "(T, 1)", show: "hidden" });
    const next = await revise({
      envelope: e,
      baseHash: await s.hash(e),
      operations: [
        { op: "set_cell", rowId: "r2", columnId: "c1", show: "show", ring: true },
        { op: "add_column", heading: "4" },
        { op: "set_settings", settings: { lines: "bold", cellMm: 20 } },
      ],
    });
    expect(next.document.rows[1].cells[0]).toEqual({ text: "(T, 1)", show: "show", ring: true });
    expect(next.document.columns).toHaveLength(4);
    expect(next.document.lines).toBe("bold");
    await expect(revise({ envelope: e, baseHash: "0".repeat(64), operations: [] })).rejects.toThrow(/stale_hash/);
    expect(() => create({ spec: { example: "dice-sum", rows: ["1"] } })).toThrow(/Examples/);
  });
});
