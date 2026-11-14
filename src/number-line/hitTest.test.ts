import { describe, expect, it } from "vitest";
import { nearestTick } from "./hitTest";

const ticks = [0, 30, 60].map((x, i) => ({ v: String(i), x }));

describe("nearestTick (U43)", () => {
  it("picks the nearest tick within 22 px of the tap", () => {
    expect(nearestTick(ticks, 20)).toBe("1");
    expect(nearestTick(ticks, 14)).toBe("0");
    expect(nearestTick(ticks, 82)).toBe("2");
  });
  it("gives a tap exactly midway to the lower tick", () => {
    expect(nearestTick(ticks, 15)).toBe("0");
  });
  it("ignores taps beyond every tick", () => {
    expect(nearestTick(ticks, 83)).toBeNull();
    expect(nearestTick([], 0)).toBeNull();
  });
});
