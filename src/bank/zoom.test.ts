import { describe, expect, it } from "vitest";
import { anchoredScroll, clampZoom, MAX_ZOOM, MIN_ZOOM, stepZoom, swipeDirection, toggleDetailZoom, wheelFactor } from "./zoom";

describe("question viewer zoom", () => {
  it("steps through presets, including from a gesture-made level", () => {
    expect(stepZoom(1, 1)).toBe(1.25);
    expect(stepZoom(1, -1)).toBe(0.75);
    expect(stepZoom(1.37, 1)).toBe(1.5);
    expect(stepZoom(1.37, -1)).toBe(1.25);
    expect(stepZoom(MAX_ZOOM, 1)).toBe(MAX_ZOOM);
    expect(stepZoom(MIN_ZOOM, -1)).toBe(MIN_ZOOM);
  });
  it("clamps gesture zoom and ignores invalid values", () => {
    expect(clampZoom(9)).toBe(MAX_ZOOM);
    expect(clampZoom(0.1)).toBe(MIN_ZOOM);
    expect(clampZoom(Number.NaN)).toBe(1);
  });
  it("turns one mouse-wheel notch into a gentle step and a trackpad pinch into a small one", () => {
    expect(wheelFactor(-100)).toBeCloseTo(Math.exp(0.2));
    expect(wheelFactor(100)).toBeCloseTo(Math.exp(-0.2));
    expect(wheelFactor(-3, 1)).toBeCloseTo(Math.exp(0.2));
    expect(wheelFactor(-4)).toBeCloseTo(Math.exp(0.04));
  });
  it("keeps the point under the pointer fixed", () => {
    // Content starts 16 px in; the pointer is at (200, 100) over content point (184 + 50, 84 + 20) at scale 1.
    const next = anchoredScroll({ left: 50, top: 20 }, { x: 200, y: 100 }, { scale: 1, offset: { x: 16, y: 16 } }, { scale: 2, offset: { x: 16, y: 16 } });
    expect(next).toEqual({ left: (234 * 2) + 16 - 200, top: (104 * 2) + 16 - 100 });
  });
  it("lets the content follow the fingers during a pinch", () => {
    const still = anchoredScroll({ left: 100, top: 100 }, { x: 300, y: 300 }, { scale: 2, offset: { x: 0, y: 0 } }, { scale: 2, offset: { x: 0, y: 0 } }, { x: 340, y: 280 });
    expect(still).toEqual({ left: 60, top: 120 });
  });
  it("double-tap zooms in to detail, then back to fit", () => {
    expect(toggleDetailZoom(1)).toBe(2);
    expect(toggleDetailZoom(0.5)).toBe(2);
    expect(toggleDetailZoom(2)).toBe(1);
    expect(toggleDetailZoom(3)).toBe(1);
  });
  it("only swipes to another question on a long sideways swipe with nothing to pan sideways", () => {
    expect(swipeDirection(-120, 10, false)).toBe(1);
    expect(swipeDirection(120, 10, false)).toBe(-1);
    expect(swipeDirection(-120, 10, true)).toBe(0);
    expect(swipeDirection(-60, 0, false)).toBe(0);
    expect(swipeDirection(-120, 80, false)).toBe(0);
  });
});
