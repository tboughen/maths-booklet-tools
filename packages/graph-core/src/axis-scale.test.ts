// @vitest-environment node
import { describe, expect, it } from "vitest";
import { axisNumberText, axisNumbersTouch, axisTickValues } from "./axis-scale";
import { axisTicks } from "./axes";
import { labels } from "../../value-graph-core/src/svg";
import { DEFAULT_DOCUMENT } from "./diagram";

describe("shared axis numbering (U58)", () => {
  it("lists multiples of the step from the anchor, inside the range", () => {
    expect(axisTickValues(-3, 3, 1)).toEqual([-3, -2, -1, 0, 1, 2, 3]);
    expect(axisTickValues(-1, 1.6, 0.5)).toEqual([-1, -0.5, 0, 0.5, 1, 1.5]);
    expect(axisTickValues(0.1, 0.7, 0.1)).toEqual([0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7]);
    expect(axisTickValues(720, 900, 60, 720)).toEqual([720, 780, 840, 900]);
    expect(axisTickValues(1, 9, 4, 2)).toEqual([2, 6]);
  });
  it("prints decimals with a true minus sign", () => {
    expect(axisNumberText(-3)).toBe("−3");
    expect(axisNumberText(0.1 + 0.2)).toBe("0.3");
    expect(axisNumberText(-0.25)).toBe("−0.25");
    expect(axisNumberText(1500)).toBe("1500");
  });
  it("finds neighbouring numbers that come closer than the clearance", () => {
    expect(axisNumbersTouch([{ at: 0, width: 4 }, { at: 5, width: 4 }], 1)).toBe(false);
    expect(axisNumbersTouch([{ at: 0, width: 4 }, { at: 4.9, width: 4 }], 1)).toBe(true);
    expect(axisNumbersTouch([{ at: 0, width: 4 }], 1)).toBe(false);
  });
  it("is what both the Graph tool and the value graph number with", () => {
    const d = structuredClone(DEFAULT_DOCUMENT);
    d.axes.x = { ...d.axes.x, negativeSquares: 4, positiveSquares: 6, unitsPerSquare: 0.5 };
    expect(axisTicks(d, "x").map((t) => [t.index, t.label])).toEqual([[0, "−2"], [2, "−1"], [6, "1"], [8, "2"], [10, "3"]]);
    d.axes.x = { ...d.axes.x, unitsPerSquare: 2, labelEvery: 2 };
    expect(axisTicks(d, "x").map((t) => [t.index, t.label])).toEqual([[0, "−8"], [2, "−4"], [6, "4"], [8, "8"], [10, "12"]]);
    expect(labels(-2, 3, 1)).toEqual([-2, -1, 1, 2, 3]);
  });
});
