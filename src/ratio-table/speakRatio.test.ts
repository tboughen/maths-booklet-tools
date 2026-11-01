import { describe, expect, it } from "vitest";
import { createRatioTable, emptyRatioTable } from "../../packages/ratio-table-core/src/interchange";
import { speakRatio } from "./speakRatio";

describe("speakRatio", () => {
  it("numbers rows from 1, says blank and names arrows in words", () => {
    const text = speakRatio(emptyRatioTable());
    expect(text).not.toMatch(/row-\d|→|↑|empty/);
    expect(text).toMatch(/Row 1: blank, blank\. Row 2: blank, blank\./);
  });
  it("reads values and answer lines as they are shown", () => {
    const e = createRatioTable({ schemaVersion: 2, rows: [{ cells: [{ kind: "number", value: "3" }, { kind: "number", value: "2/5" }] }, { cells: [{ kind: "number", value: "6" }, { kind: "answer-line" }] }] });
    expect(speakRatio(e)).toContain("Row 1: 3, 2/5. Row 2: 6, answer line.");
  });
});
