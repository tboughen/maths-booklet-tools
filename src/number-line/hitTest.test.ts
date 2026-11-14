import { describe, expect, it } from "vitest";
import { nearestTick } from "./hitTest";

const ticks = [0, 30, 60].map((x, i) => ({ v: String(i), x }));

describe("nearestTick (U43)", () => {
  it("picks the nearest tick within 22 px of the tap", () => {
    expect(nearestTick(ticks, 20, 0)).toBe("1");
    expect(nearestTick(ticks, 14, 10)).toBe("0");
    expect(nearestTick(ticks, 82, -22)).toBe("2");
  });
  it("ignores taps off the axis band or beyond every tick", () => {
    expect(nearestTick(ticks, 30, 23)).toBeNull();
    expect(nearestTick(ticks, 83, 0)).toBeNull();
    expect(nearestTick([], 0, 0)).toBeNull();
  });
});
