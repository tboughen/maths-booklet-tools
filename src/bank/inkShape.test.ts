import { describe, expect, it } from "vitest";
import { highlighterLine, penOutline, strokeSpeeds, type Point } from "./inkShape";

const numbers = (d: string) => (d.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
/** The outline's points as [x, y] pairs, skipping the arc radii and flags. */
function outlinePoints(d: string): Point[] {
  const out: Point[] = [];
  for (const command of d.match(/[MLA][^MLAZ]*/g) ?? []) {
    const n = numbers(command);
    out.push(command[0] === "A" ? [n[5], n[6]] : [n[0], n[1]]);
  }
  // The closing cap returns to the first point; leave that repeat off so left and right edges pair up.
  return out.slice(0, -1);
}
const wave = (count: number, step: number): Point[] => Array.from({ length: count }, (_, i) => [10 + i * step, 50 + 12 * Math.sin(i / 8)]);

describe("ink shaping", () => {
  it("draws nothing for no points and a round dot for a tap", () => {
    expect(penOutline([], 3, 1)).toBe("");
    const tap = penOutline([[20, 30]], 4, 1);
    expect(tap).toMatch(/^M.*a.*a.*Z$/);
    expect(numbers(tap).slice(0, 2)).toEqual([20 - 4 * 1.18 / 2, 30]);
  });

  it("keeps both ends where the pen put them", () => {
    const points = wave(60, 1.5);
    const outline = outlinePoints(penOutline(points, 3.5, 1));
    const half = outline.length / 2;
    const mid = (a: Point, b: Point): Point => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    // The first left point and last right point straddle the start; the middle pair straddles the end.
    const start = mid(outline[0], outline[outline.length - 1]);
    const end = mid(outline[half - 1], outline[half]);
    expect(start[0]).toBeCloseTo(points[0][0], 1);
    expect(start[1]).toBeCloseTo(points[0][1], 1);
    expect(end[0]).toBeCloseTo(points[points.length - 1][0], 1);
    expect(end[1]).toBeCloseTo(points[points.length - 1][1], 1);
  });

  it("is thicker when slow than when fast, and tapers at the ends", () => {
    const width = (points: Point[], size: number) => {
      const outline = outlinePoints(penOutline(points, size, 1));
      const half = outline.length / 2, i = Math.floor(half / 2);
      const left = outline[i], right = outline[outline.length - 1 - i];
      return Math.hypot(left[0] - right[0], left[1] - right[1]);
    };
    const line = (step: number): Point[] => Array.from({ length: Math.round(200 / step) + 1 }, (_, i) => [i * step, 0]);
    const slow = width(line(0.5), 4), fast = width(line(20), 4);
    expect(slow).toBeGreaterThan(4 * 1.12);
    expect(slow).toBeLessThanOrEqual(4 * 1.18 + 0.01);
    expect(fast).toBeCloseTo(4 * 0.72, 1);
    const outline = outlinePoints(penOutline(line(0.5), 4, 1));
    const ends = Math.hypot(outline[0][0] - outline[outline.length - 1][0], outline[0][1] - outline[outline.length - 1][1]);
    expect(ends).toBeCloseTo(slow * 0.55, 1);
  });

  it("smooths jitter", () => {
    const jittery: Point[] = wave(80, 1).map(([x, y], i) => [x, y + (i % 2 ? 0.6 : -0.6)]);
    const roughness = (pts: Point[]) => pts.slice(2).reduce((sum, p, i) => sum + Math.abs(p[1] - 2 * pts[i + 1][1] + pts[i][1]), 0) / pts.length;
    const centre = numbers(highlighterLine(jittery));
    const smoothed: Point[] = [];
    for (let i = 0; i < centre.length; i += 2) smoothed.push([centre[i], centre[i + 1]]);
    expect(roughness(smoothed)).toBeLessThan(roughness(jittery) / 4);
  });

  it("keeps the points of ticks, crosses and arrowheads sharp", () => {
    const tip = Math.max(...outlinePoints(penOutline([[0, 0], [5, 0], [10, 0], [5, 0], [0, 0]], 3.5, 1)).map(p => p[0]));
    expect(tip).toBeGreaterThanOrEqual(10);
    const vee: Point[] = [];
    for (let i = 0; i <= 20; i++) vee.push([i, i < 10 ? i * 2 : 40 - i * 2]);
    const bottom = Math.max(...outlinePoints(penOutline(vee, 3.5, 1)).map(p => p[1]));
    expect(bottom).toBeGreaterThan(20);
  });

  it("gives the same width for the same hand speed at any zoom", () => {
    const line = (step: number): Point[] => Array.from({ length: Math.round(200 / step) + 1 }, (_, i) => [i * step, 0]);
    // 10 screen px per sample: at zoom 2 that's 5 view units.
    const widthAt = (d: string) => { const o = outlinePoints(d), i = Math.floor(o.length / 4); return Math.hypot(o[i][0] - o[o.length - 1 - i][0], o[i][1] - o[o.length - 1 - i][1]); };
    expect(widthAt(penOutline(line(10), 4, 1))).toBeCloseTo(widthAt(penOutline(line(5), 4, 2)), 2);
  });

  it("draws a highlighter tap or two-point mark", () => {
    expect(highlighterLine([[3, 4]])).toMatch(/^M3 4L/);
    expect(highlighterLine([[0, 0], [10, 0]])).toBe("M0 0L10 0");
  });

  it("averages speed so the width changes gradually", () => {
    const speeds = strokeSpeeds([[0, 0], [1, 0], [2, 0], [12, 0], [13, 0], [14, 0]]);
    expect(speeds[3]).toBeLessThan(10);
    expect(speeds[0]).toBeGreaterThan(1);
    expect(strokeSpeeds([[5, 5]])).toEqual([0]);
  });

  it("stays quick on long strokes", () => {
    const long = wave(2000, 1);
    const started = performance.now();
    penOutline(long, 3.5, 1);
    expect(performance.now() - started).toBeLessThan(250);
  });
});
