import { describe, expect, it } from "vitest";
import { parseEquation } from "./equation";
describe("expanded quadratic editing", () => {
  it("keeps exact fractions, decimals and displayed minus/squared characters", () => {
    expect(parseEquation("y = 1/2x² − .25x + 3/2")).toEqual({
      a: "1/2",
      b: "-1/4",
      c: "3/2",
    });
    expect(parseEquation("-x^2+x-x+0")).toEqual({ a: "-1", b: "0", c: "0" });
  });
  it("rejects malformed, unbounded, executable and non-quadratic input", () => {
    for (const input of [
      "",
      "x²x",
      "x²+",
      "x²+1/0",
      "x²-x²",
      "(x+1)^2",
      "alert(1)",
      "x^3+2/x",
      "1^x",
      "0^x",
      "2^x+x",
      "x²".repeat(100),
    ])
      expect(() => parseEquation(input)).toThrow();
  });
  it("reads cubic, reciprocal and exponential equations and round-trips the printed form (U84)", () => {
    expect(parseEquation("y = x³ − 4x")).toEqual({ a: "0", b: "-4", c: "0", cubic: "1" });
    expect(parseEquation("y=x^3")).toEqual({ a: "0", b: "0", c: "0", cubic: "1" });
    expect(parseEquation("y = 3/x + 1")).toEqual({ a: "0", b: "0", c: "1", reciprocal: "3" });
    expect(parseEquation("y = -6/x")).toEqual({ a: "0", b: "0", c: "0", reciprocal: "-6" });
    expect(parseEquation("y = 2^x")).toEqual({ a: "0", b: "0", c: "0", exponential: { coefficient: "1", base: "2" } });
    expect(parseEquation("y = 3 × 2ˣ − 1")).toEqual({ a: "0", b: "0", c: "-1", exponential: { coefficient: "3", base: "2" } });
    expect(parseEquation("y = (1/2)ˣ")).toEqual({ a: "0", b: "0", c: "0", exponential: { coefficient: "1", base: "1/2" } });
  });
});
