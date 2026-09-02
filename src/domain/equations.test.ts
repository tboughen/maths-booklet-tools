import { describe, expect, it } from "vitest";
import {
  equationFromPoints,
  formatEquation,
  formatNumber,
  parseNumericInput,
  pointsForEquation,
} from "./equations";

describe("line equations", () => {
  it("derives slope and vertical equations from two points", () => {
    expect(equationFromPoints({ x: -1, y: -1 }, { x: 1, y: 3 })).toEqual({ kind: "slope", slope: 2, intercept: 1 });
    expect(equationFromPoints({ x: -2, y: 0 }, { x: -2, y: 4 })).toEqual({ kind: "vertical", x: -2 });
    expect(equationFromPoints({ x: 1, y: 1 }, { x: 1, y: 1 })).toBeNull();
  });

  it("formats exam-style equations and useful fractions", () => {
    expect(formatEquation({ kind: "slope", slope: 1, intercept: 0 })).toBe("y = x");
    expect(formatEquation({ kind: "slope", slope: -0.5, intercept: 2 })).toBe("y = −1/2x + 2");
    expect(formatEquation({ kind: "vertical", x: -2 })).toBe("x = −2");
    expect(formatNumber(1.25)).toBe("5/4");
  });

  it("accepts decimals, integers and fractions but rejects invalid input", () => {
    expect(parseNumericInput(" -3 ")).toBe(-3);
    expect(parseNumericInput("1 / 2")).toBe(0.5);
    expect(parseNumericInput("−2.5")).toBe(-2.5);
    expect(parseNumericInput("1/0")).toBeNull();
    expect(parseNumericInput("x")).toBeNull();
  });

  it("creates visible anchors for equation-defined lines", () => {
    const bounds = { xMin: -5, xMax: 5, yMin: -5, yMax: 5 };
    expect(pointsForEquation({ kind: "slope", slope: 2, intercept: 1 }, bounds)).toEqual([
      { x: -3, y: -5 },
      { x: 2, y: 5 },
    ]);
    expect(pointsForEquation({ kind: "vertical", x: -2 }, bounds)).toEqual([
      { x: -2, y: -5 },
      { x: -2, y: 5 },
    ]);
  });
});
