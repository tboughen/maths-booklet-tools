import { describe, expect, it } from "vitest";
import { formatFunction } from "../../packages/graph-core/src/function";
import { parseFunctionText } from "./functionText";

describe("typed equation curves", () => {
  it("reads every family and round-trips the printed form", () => {
    for (const text of ["y = x² − 3x", "y = x³ − 2x² + 5", "y = 6/x − 1", "y = 3 × 2ˣ", "y = 2cos (x + 30) − 1", "y = sin x", "y = −tan (2x − 45)"])
      expect(formatFunction(parseFunctionText(text))).toBe(text);
    expect(parseFunctionText("y = tan 2x")).toEqual({ family: "trig", fn: "tan", amplitude: 1, multiplier: 2, shift: 0, c: 0 });
    expect(parseFunctionText("sin(x)+1")).toMatchObject({ fn: "sin", c: 1 });
    expect(parseFunctionText("y = 0.5/x")).toEqual({ family: "reciprocal", k: 0.5, c: 0 });
    for (const text of ["y = −0.5/x − 2", "y = 1/3x² − 1/2x"]) expect(formatFunction(parseFunctionText(text))).toBe(text);
  });
  it("explains what it cannot read", () => {
    expect(() => parseFunctionText("y = sin")).toThrow(/trig graph/);
    expect(() => parseFunctionText("y = 0sin x")).toThrow(/nonzero/);
    expect(() => parseFunctionText("y = 2x + 1")).toThrow();
  });
});
