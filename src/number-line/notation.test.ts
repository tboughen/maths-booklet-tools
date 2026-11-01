import { describe, expect, it } from "vitest";
import { create, validate } from "../../packages/number-line-core/src";
import { fitAxis, parseNotation, notationSummary } from "./notation";

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

describe("fitAxis (explicit Widen the line to fit)", () => {
  const axis = {
    ...create().document.axis,
    minimum: "-5",
    maximum: "5",
    step: "1",
  };
  it("widens by whole steps just far enough, on each side that needs it", () => {
    expect(fitAxis(axis, parseNotation("-7 < x <= 6"))).toMatchObject({
      minimum: "-7",
      maximum: "6",
      step: "1",
    });
    expect(fitAxis(axis, parseNotation("x = 13/2"))).toMatchObject({
      minimum: "-5",
      maximum: "7",
    });
  });
  it("leaves a ray one step of room in its direction", () => {
    expect(fitAxis(axis, parseNotation("x >= 8"))).toMatchObject({
      minimum: "-5",
      maximum: "9",
    });
    expect(fitAxis(axis, parseNotation("x < -6"))).toMatchObject({
      minimum: "-7",
      maximum: "5",
    });
  });
  it("keeps the step, variable and other axis settings, and works with fractional steps", () => {
    const halves = { ...axis, minimum: "0", maximum: "2", step: "1/2" };
    const wider = fitAxis(halves, parseNotation("1 <= x < 3"))!;
    expect(wider).toEqual({ ...halves, maximum: "3" });
  });
  it("offers nothing when the drawing already fits or would need more than 100 steps", () => {
    expect(fitAxis(axis, parseNotation("-3 < x <= 1"))).toBeNull();
    expect(fitAxis(axis, parseNotation("x = 500"))).toBeNull();
  });
});
