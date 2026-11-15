import { describe, expect, it } from "vitest";
import { isRoughlyStraight, recogniseShape, snapLevel, type Point } from "./inkSnap";

// A repeatable wobble, like a hand on a whiteboard.
function wobbly(points: Point[], amount = 1.5, seed = 3): Point[] {
  let s = seed;
  const r = () => ((s = (s * 9301 + 49297) % 233280) / 233280 - 0.5) * 2 * amount;
  return points.map(([x, y]) => [x + r(), y + r()]);
}
/** Points along the polygon's edges, `step` apart, stopping a little short of where it began. */
function traced(corners: Point[], step = 3, gap = 6): Point[] {
  const out: Point[] = [];
  for (let i = 0; i < corners.length; i++) {
    const a = corners[i], b = corners[(i + 1) % corners.length], l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    for (let d = 0; d < l; d += step) out.push([a[0] + (b[0] - a[0]) * d / l, a[1] + (b[1] - a[1]) * d / l]);
  }
  return out.slice(0, out.length - Math.round(gap / step));
}
function ellipse(cx: number, cy: number, a: number, b: number, tilt = 0, sweep = 0.95): Point[] {
  const out: Point[] = [];
  for (let t = 0; t < 2 * Math.PI * sweep; t += 0.06) {
    const x = a * Math.cos(t), y = b * Math.sin(t);
    out.push([cx + x * Math.cos(tilt) - y * Math.sin(tilt), cy + x * Math.sin(tilt) + y * Math.cos(tilt)]);
  }
  return out;
}
const name = (points: Point[]) => recogniseShape(wobbly(points), 1)?.name;
const angleAt = (pts: Point[], i: number) => {
  const n = pts.length - 1, p = pts[i], a = pts[(i + n - 1) % n], b = pts[(i + 1) % n];
  const u = [a[0] - p[0], a[1] - p[1]], v = [b[0] - p[0], b[1] - p[1]];
  return Math.acos((u[0] * v[0] + u[1] * v[1]) / Math.hypot(u[0], u[1]) / Math.hypot(v[0], v[1])) * 180 / Math.PI;
};

describe("level snap", () => {
  it("makes lines within 5° of level or upright exact, and leaves other angles alone", () => {
    expect(snapLevel([0, 0], [100, 6])).toEqual([100, 0]);
    expect(snapLevel([0, 0], [-100, -8])).toEqual([-100, 0]);
    expect(snapLevel([0, 0], [7, 100])).toEqual([0, 100]);
    expect(snapLevel([0, 0], [100, 10])).toEqual([100, 10]);
    expect(snapLevel([0, 0], [100, 100])).toEqual([100, 100]);
  });
});

describe("roughly straight", () => {
  it("accepts a wobbly line and rejects curves, ticks and short marks", () => {
    const line = wobbly(Array.from({ length: 40 }, (_, i) => [i * 5, i * 2] as Point), 2);
    expect(isRoughlyStraight(line, 1)).toBe(true);
    expect(isRoughlyStraight(ellipse(0, 0, 60, 60, 0, 0.4), 1)).toBe(false);
    expect(isRoughlyStraight([[0, 0], [20, 30], [60, -20]], 1)).toBe(false);
    expect(isRoughlyStraight([[0, 0], [20, 0]], 1)).toBe(false);
    // Thresholds are screen pixels: the same 20-unit line counts when zoomed in to 2x.
    expect(isRoughlyStraight([[0, 0], [20, 0]], 2)).toBe(true);
  });
});

describe("shape snapping", () => {
  it("recognises circles and ellipses, levelling a nearly level ellipse", () => {
    expect(name(ellipse(200, 200, 80, 76))).toBe("circle");
    expect(name(ellipse(200, 200, 120, 60))).toBe("ellipse");
    const tilted = recogniseShape(wobbly(ellipse(200, 200, 120, 60, 0.07)), 1)!;
    expect(tilted.name).toBe("ellipse");
    const ys = tilted.points.map(p => p[1]);
    expect(Math.abs(tilted.points[0][1] - 200)).toBeLessThan(2);
    expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(120, -1);
  });

  it("recognises triangles, squaring a nearly right angle and evening a nearly equilateral one", () => {
    expect(name(traced([[100, 300], [300, 300], [150, 120]]))).toBe("triangle");
    const right = recogniseShape(wobbly(traced([[100, 300], [300, 304], [104, 140]])), 1)!;
    expect(right.name).toBe("right-angled triangle");
    expect(Math.min(...[0, 1, 2].map(i => Math.abs(angleAt(right.points, i) - 90)))).toBeLessThan(0.01);
    const equilateral = recogniseShape(wobbly(traced([[100, 300], [300, 300], [204, 130]])), 1)!;
    expect(equilateral.name).toBe("equilateral triangle");
    for (const i of [0, 1, 2]) expect(angleAt(equilateral.points, i)).toBeCloseTo(60, 3);
  });

  it("recognises squares, rectangles, parallelograms, trapeziums and kites", () => {
    expect(name(traced([[100, 100], [300, 100], [300, 296], [100, 300]]))).toBe("square");
    const rect = recogniseShape(wobbly(traced([[100, 100], [400, 108], [396, 250], [98, 244]])), 1)!;
    expect(rect.name).toBe("rectangle");
    // Within 5° of level, so its sides come out exactly level and upright.
    expect(rect.points[0][1]).toBeCloseTo(rect.points[1][1], 6);
    expect(name(traced([[100, 300], [350, 300], [420, 150], [170, 150]]))).toBe("parallelogram");
    const trap = recogniseShape(wobbly(traced([[100, 300], [420, 300], [330, 150], [180, 154]])), 1)!;
    expect(trap.name).toBe("trapezium");
    // Its parallel sides were within 5° of level, so both come out exactly level.
    const ys = trap.points.slice(0, 4).map(p => p[1]).sort((a, b) => a - b);
    expect(ys[0]).toBeCloseTo(ys[1], 6);
    expect(ys[2]).toBeCloseTo(ys[3], 6);
    expect(name(traced([[200, 100], [300, 200], [200, 400], [100, 200]]))).toBe("quadrilateral");
  });

  it("recognises pentagons and hexagons", () => {
    const regular = (n: number) => Array.from({ length: n }, (_, k) => [250 + 120 * Math.cos(-Math.PI / 2 + k * 2 * Math.PI / n), 250 + 120 * Math.sin(-Math.PI / 2 + k * 2 * Math.PI / n)] as Point);
    expect(name(traced(regular(5)))).toBe("pentagon");
    expect(name(traced(regular(6)))).toBe("hexagon");
  });

  it("cuts a stroke that runs on past its start, and puts corners where the sides meet", () => {
    const corners: Point[] = [[100, 300], [420, 300], [330, 150], [180, 150]];
    const overrun = [...traced(corners, 3, 0), ...traced(corners, 3, 0).slice(0, 15)];
    for (let seed = 1; seed <= 12; seed++) {
      const shape = recogniseShape(wobbly(overrun, 1.5, seed), 1)!;
      expect(shape.name).toBe("trapezium");
      for (const c of corners) expect(Math.min(...shape.points.map(p => Math.hypot(p[0] - c[0], p[1] - c[1])))).toBeLessThan(8);
    }
    const tri = [...traced([[100, 300], [300, 300], [150, 120]], 3, 0), ...traced([[100, 300], [300, 300], [150, 120]], 3, 0).slice(0, 15)];
    for (let seed = 1; seed <= 12; seed++) expect(recogniseShape(wobbly(tri, 1.5, seed), 1)?.name).toBe("triangle");
  });

  it("doesn't close a V, a narrow U or most of a circle", () => {
    const vee: Point[] = [...Array.from({ length: 34 }, (_, i) => [200 - i * 0.9, 100 + i * 3] as Point), ...Array.from({ length: 34 }, (_, i) => [170 + i * 0.9, 200 - i * 3] as Point)];
    expect(recogniseShape(wobbly(vee), 1)).toBeUndefined();
    const u: Point[] = [...Array.from({ length: 50 }, (_, i) => [100 + i * 3, 100] as Point), ...Array.from({ length: 13 }, (_, i) => [250, 100 + i * 3] as Point), ...Array.from({ length: 50 }, (_, i) => [250 - i * 3, 140] as Point)];
    expect(recogniseShape(wobbly(u), 1)).toBeUndefined();
    expect(recogniseShape(wobbly(ellipse(200, 200, 80, 80, 0, 0.85)), 1)).toBeUndefined();
  });

  it("leaves open strokes, scribbles, letters and tiny loops as drawn", () => {
    expect(recogniseShape(wobbly(ellipse(200, 200, 80, 80, 0, 0.6)), 1)).toBeUndefined();
    expect(recogniseShape(wobbly(ellipse(50, 50, 6, 6)), 1)).toBeUndefined();
    const scribble: Point[] = Array.from({ length: 80 }, (_, i) => [200 + 80 * Math.sin(i * 0.9) * Math.cos(i * 0.31), 200 + 80 * Math.sin(i * 0.47)]);
    expect(recogniseShape(scribble, 1)).toBeUndefined();
    // An "8" crosses itself: not one shape.
    const eight: Point[] = [];
    for (let t = 0; t < 2 * Math.PI * 0.97; t += 0.05) eight.push([200 + 60 * Math.sin(t), 200 + 90 * Math.sin(t) * Math.cos(t)]);
    expect(recogniseShape(wobbly(eight), 1)).toBeUndefined();
  });
});
