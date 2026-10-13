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
      "x^3",
      "x²".repeat(100),
    ])
      expect(() => parseEquation(input)).toThrow();
  });
});
