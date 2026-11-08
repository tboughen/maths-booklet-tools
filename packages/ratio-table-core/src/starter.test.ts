// @vitest-environment node
import { describe, expect, it } from "vitest";
import { emptyRatioTable, starterRatioTable } from "./interchange";

describe("starter ratio table (U18)", () => {
  it("gives 3 -> 12 and leaves an answer line for 5", () => {
    expect(starterRatioTable().document.rows.map((r) => r.cells)).toEqual([
      [
        { kind: "number", value: "3" },
        { kind: "number", value: "12" },
      ],
      [{ kind: "number", value: "5" }, { kind: "answer-line" }],
    ]);
  });
  it("keeps the blank table for recovery", () => {
    const blank = emptyRatioTable().document.rows.flatMap((r) => r.cells);
    expect(blank.every((c) => c.kind === "empty")).toBe(true);
  });
});
