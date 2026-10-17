import { describe, expect, it } from "vitest";
import { create, validate } from "../../packages/number-line-core/src";
import { parseNotation, notationSummary } from "./notation";

describe("number-line notation", () => {
  it.each([
    ["<", "<", false, false],
    ["<=", "<", true, false],
    ["<", "<=", false, true],
    ["<=", "<=", true, true],
  ] as const)(
    "preserves inclusivity for %s %s in either direction",
    (left, right, li, ui) => {
      const forward = parseNotation(`-3 ${left} x ${right} 1`);
      const reverse = parseNotation(
        `1 ${right.replace("<", ">")} x ${left.replace("<", ">")} -3`,
      );
      expect(forward).toEqual({
        kind: "interval",
        id: "set",
        lower: "-3",
        upper: "1",
        lowerIncluded: li,
        upperIncluded: ui,
      });
      expect(reverse).toEqual(forward);
      expect(
        validate({
          ...create(),
          document: { ...create().document, solution: forward },
        }).document.solution,
      ).toEqual(forward);
    },
  );
  it.each([
    ["x < 3", "left", false],
    ["3 > x", "left", false],
    ["x >= -2", "right", true],
    ["-2 ≤ x", "right", true],
  ] as const)(
    "maps %s without solving or changing variable",
    (text, direction, included) =>
      expect(parseNotation(text)).toMatchObject({
        kind: "ray",
        direction,
        included,
      }),
  );
  it("canonicalises exact fractional and Unicode values", () =>
    expect(parseNotation("−1/2 < t ≤ 0.25", "t")).toMatchObject({
      lower: "-1/2",
      upper: "0.25",
      lowerIncluded: false,
      upperIncluded: true,
    }));
  it("accepts a single zero point and a blank printed variable", () =>
    expect(parseNotation("x = 0", "")).toMatchObject({
      kind: "points",
      points: [{ id: "point-1", value: "0", included: true }],
    }));
  it.each([
    "",
    "x != 2",
    "x<2 or x>3",
    "2x+1<5",
    "y<2",
    "1<x>2",
    "2<x<1",
    "2<=x<=2",
    "x=1/0",
    "x=2 garbage",
    "[1,2]",
    "x=pi",
    "x=3;alert(1)",
  ])("rejects full unsupported input %s", (text) =>
    expect(() => parseNotation(text)).toThrow(),
  );
  it("bounds input before matching", () =>
    expect(() => parseNotation(" ".repeat(161))).toThrow("160"));
  it("summarises the actual model, including custom drawings", () => {
    expect(notationSummary(parseNotation("-3 < x <= 1"))).toBe("-3 < x ≤ 1");
    expect(
      notationSummary({
        kind: "ray",
        id: "s",
        value: "1",
        included: false,
        direction: "right",
        intentional: true,
        stop: "3",
      }),
    ).toBe("Custom drawing");
    expect(notationSummary(null)).toBe("Blank number line");
  });
});
