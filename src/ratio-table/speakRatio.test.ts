import { describe, expect, it } from "vitest";
import { createRatioTable, emptyRatioTable } from "../../packages/ratio-table-core/src/interchange";
import { speakRatio } from "./speakRatio";

const n = (value: string) => ({ kind: "number" as const, value });
const table = (extra: object) => createRatioTable({
  schemaVersion: 2,
  rows: [{ id: "a", cells: [n("3"), n("2/5")] }, { id: "b", cells: [n("6"), { kind: "answer-line" }] }, { id: "c", cells: [n("0"), { kind: "empty" }] }],
  transitions: [{ from: "a", to: "b", operation: "multiply", factor: "2" }, { from: "b", to: "c", operation: "divide", factor: "3/4" }],
  ...extra,
});

describe("speakRatio", () => {
  it("numbers rows from 1, says blank and names each heading arrow in words", () => {
    const text = speakRatio(emptyRatioTable());
    expect(text).not.toMatch(/row-\d|→|↑|empty/);
    expect(text).toContain("Ratio table with headings x (arrow right) and y (arrow up). Row 1: blank, blank. Row 2: blank, blank. Scaling annotations hidden.");
    const plain = speakRatio(table({ headings: [{ text: "cost", italic: false, direction: "none" }, { text: "kg", italic: false, direction: "up" }] }));
    expect(plain).toContain("headings cost and kg (arrow up).");
  });
  it("keeps zero, blank and answer line distinct and reads fractions as over", () => {
    expect(speakRatio(table({}))).toContain("Row 1: 3, 2 over 5. Row 2: 6, answer line. Row 3: 0, blank.");
  });
  it("speaks the scaling operations only when operation labels are printed", () => {
    const shown = speakRatio(table({ mode: "annotated", showArrows: true, showOperations: true }));
    expect(shown).toContain("Scaling arrows shown; operation labels shown. Row 1 to row 2: multiply by 2. Row 2 to row 3: divide by 3 over 4.");
    const arrowsOnly = speakRatio(table({ mode: "annotated", showArrows: true, showOperations: false }));
    expect(arrowsOnly).toContain("Scaling arrows shown; operation labels hidden.");
    expect(arrowsOnly).not.toMatch(/multiply|divide/);
    const simple = speakRatio(table({ mode: "simple", showArrows: true, showOperations: true }));
    expect(simple).toContain("Scaling annotations hidden.");
    expect(simple).not.toMatch(/multiply|divide/);
  });
});
