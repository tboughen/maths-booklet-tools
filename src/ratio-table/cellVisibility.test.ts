import { describe, expect, it } from "vitest";
import { cellVisibility, withCellVisibility } from "./cellVisibility";

describe("ratio cell visibility", () => {
  it("reads every cell state as one of the three", () => {
    expect(cellVisibility({ kind: "number", value: "4" })).toBe("show");
    expect(cellVisibility({ kind: "hidden", value: "4" })).toBe("hidden");
    expect(cellVisibility({ kind: "hidden", value: "4", line: true })).toBe("hidden");
    expect(cellVisibility({ kind: "answer-line" })).toBe("hidden");
    expect(cellVisibility({ kind: "empty" })).toBe("omit");
    expect(cellVisibility({ kind: "empty", value: "4" })).toBe("omit");
  });
  it("keeps the value through every change, and never invents one", () => {
    expect(withCellVisibility({ kind: "number", value: "4" }, "hidden")).toEqual({ kind: "hidden", value: "4" });
    expect(withCellVisibility({ kind: "number", value: "4" }, "omit")).toEqual({ kind: "empty", value: "4" });
    expect(withCellVisibility({ kind: "empty", value: "4" }, "show")).toEqual({ kind: "number", value: "4" });
    expect(withCellVisibility({ kind: "hidden", value: "4", line: true }, "show")).toEqual({ kind: "number", value: "4" });
    expect(withCellVisibility({ kind: "empty" }, "hidden")).toBe("Type the answer first, then make it a pupil space.");
    expect(withCellVisibility({ kind: "answer-line" }, "show")).toBe("Type the value first, then show it.");
    expect(withCellVisibility({ kind: "answer-line" }, "omit")).toEqual({ kind: "empty" });
  });
});
