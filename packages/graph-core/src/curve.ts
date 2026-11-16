import type { Bounds, CircleObject, Coordinate, CurveObject, ReadingObject } from "./types";

/**
 * A smooth curve through every given point, as exam papers print hand-drawn-looking curves:
 * uniform Catmull-Rom, turned into cubic Béziers so SVG, PDF and Word all draw
 * the same shape. Shared by the Graph tool and the worked-solution engine. Coordinates may be in
 * any units (graph units or SVG units); the end points use their neighbour as the missing one.
 */
export interface BezierSegment {
  c1: Coordinate;
  c2: Coordinate;
  end: Coordinate;
}

export function smoothCurveSegments(points: Coordinate[]): BezierSegment[] {
  const out: BezierSegment[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i], p1 = points[i], p2 = points[i + 1], p3 = points[i + 2] ?? points[i + 1];
    out.push({
      c1: { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 },
      c2: { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 },
      end: { x: p2.x, y: p2.y },
    });
  }
  return out;
}

/** SVG path data for the smooth curve through the points, already in SVG units. */
export function smoothCurvePath(points: Coordinate[], digits = 2): string {
  if (!points.length) return "";
  const f = (v: number) => String(Number(v.toFixed(digits)));
  const start = `M ${f(points[0].x)} ${f(points[0].y)}`;
  if (points.length === 1) return start;
  return `${start} ${smoothCurveSegments(points).map((s) => `C ${f(s.c1.x)} ${f(s.c1.y)} ${f(s.c2.x)} ${f(s.c2.y)} ${f(s.end.x)} ${f(s.end.y)}`).join(" ")}`;
}

/** Why a curve's points cannot be drawn, or null when they can. */
export function curveProblem(points: Coordinate[]): string | null {
  for (let i = 0; i + 1 < points.length; i++)
    if (Math.hypot(points[i + 1].x - points[i].x, points[i + 1].y - points[i].y) < 1e-10)
      return `point ${i + 1} repeats the next point (${points[i].x}, ${points[i].y}).`;
  return null;
}

const inside = (p: Coordinate, b: Bounds) => p.x >= b.xMin - 1e-9 && p.x <= b.xMax + 1e-9 && p.y >= b.yMin - 1e-9 && p.y <= b.yMax + 1e-9;

/** True when any part of the curve's box meets the grid; the plot clip trims the rest. */
export function curveVisible(object: CurveObject, b: Bounds): boolean {
  const xs = object.points.map((p) => p.x), ys = object.points.map((p) => p.y);
  return Math.max(...xs) >= b.xMin && Math.min(...xs) <= b.xMax && Math.max(...ys) >= b.yMin && Math.min(...ys) <= b.yMax;
}

/** A reading is drawn only when its point is on the grid. */
export function readingVisible(object: ReadingObject, b: Bounds): boolean {
  return inside(object.at, b);
}

/** Where the axes cross, in graph units: each axis's origin (0 unless set). */
export function axesCrossing(axes: { x: { origin?: number }; y: { origin?: number } }): Coordinate {
  return { x: axes.x.origin ?? 0, y: axes.y.origin ?? 0 };
}

/**
 * The legs of a reading, in graph units, each ending on an axis. Each leg says whether its end
 * carries an arrowhead. read "y": from the x-axis up to the point (no head), then across to the
 * y-axis (head). read "x": from the y-axis across (no head), then down to the x-axis (head).
 * read "both": from the point to each axis, a head on each.
 */
export function readingLegs(object: ReadingObject, crossing: Coordinate): { start: Coordinate; end: Coordinate; head: boolean }[] {
  const p = object.at;
  const onX = { x: p.x, y: crossing.y }, onY = { x: crossing.x, y: p.y };
  const legs =
    object.read === "y"
      ? [{ start: onX, end: p, head: false }, { start: p, end: onY, head: true }]
      : object.read === "x"
        ? [{ start: onY, end: p, head: false }, { start: p, end: onX, head: true }]
        : [{ start: p, end: onX, head: true }, { start: p, end: onY, head: true }];
  return legs.filter((l) => Math.hypot(l.end.x - l.start.x, l.end.y - l.start.y) > 1e-9);
}

/**
 * The height and gradient of a graph through points at x, in graph units, or null where the
 * graph does not reach x. Straight pieces give the piece's own gradient (at a corner, the piece
 * on the right); a smooth curve is solved on the Bézier piece that spans x. Where a curve passes
 * the same x more than once, the first piece in point order is used.
 */
export function curveValueAt(points: Coordinate[], smooth: boolean, x: number): { y: number; slope: number } | null {
  const eps = 1e-9;
  for (let i = 0; i + 1 < points.length; i++) {
    const a = points[i], b = points[i + 1];
    const lo = Math.min(a.x, b.x), hi = Math.max(a.x, b.x);
    if (x < lo - eps || x > hi + eps || hi - lo < eps) continue;
    // At a corner, prefer the next piece when it also reaches x and runs forward.
    if (!smooth) {
      const next = points[i + 2];
      if (Math.abs(x - b.x) < eps && next && next.x > b.x + eps) continue;
      const slope = (b.y - a.y) / (b.x - a.x);
      return { y: a.y + slope * (x - a.x), slope };
    }
    const s = smoothCurveSegments(points)[i];
    const bez = (p0: number, p1: number, p2: number, p3: number, t: number) =>
      (1 - t) ** 3 * p0 + 3 * (1 - t) ** 2 * t * p1 + 3 * (1 - t) * t * t * p2 + t ** 3 * p3;
    const dbez = (p0: number, p1: number, p2: number, p3: number, t: number) =>
      3 * (1 - t) ** 2 * (p1 - p0) + 6 * (1 - t) * t * (p2 - p1) + 3 * t * t * (p3 - p2);
    const fx = (t: number) => bez(a.x, s.c1.x, s.c2.x, b.x, t);
    // Bisection on t: x runs from a.x to b.x along the piece.
    let t0 = 0, t1 = 1;
    const rising = b.x > a.x;
    for (let k = 0; k < 60; k++) {
      const m = (t0 + t1) / 2;
      if ((fx(m) < x) === rising) t0 = m;
      else t1 = m;
    }
    const t = (t0 + t1) / 2;
    const dx = dbez(a.x, s.c1.x, s.c2.x, b.x, t), dy = dbez(a.y, s.c1.y, s.c2.y, b.y, t);
    return { y: bez(a.y, s.c1.y, s.c2.y, b.y, t), slope: Math.abs(dx) < 1e-12 ? NaN : dy / dx };
  }
  return null;
}

/** A tangent to the graph at x: a segment through the touching point, run units each side. */
export function tangentSegment(points: Coordinate[], smooth: boolean, x: number, run: number): { start: Coordinate; end: Coordinate; touch: Coordinate; slope: number } | null {
  const v = curveValueAt(points, smooth, x);
  if (!v || !Number.isFinite(v.slope)) return null;
  const at = (dx: number) => ({ x: x + dx, y: v.y + v.slope * dx });
  return { start: at(-run), end: at(run), touch: { x, y: v.y }, slope: v.slope };
}

/**
 * Equal-width strips under the graph from `from` to `to`, as trapeziums down to y = base (the
 * x-axis), the way an area estimate is drawn: corners (x0, base), (x1, base), (x1, y1), (x0, y0).
 * Returns null when the graph does not reach every strip edge.
 */
export function trapeziumStrips(points: Coordinate[], smooth: boolean, from: number, to: number, count: number, base = 0): Coordinate[][] | null {
  if (!(count >= 1) || !(to > from)) return null;
  const xs = Array.from({ length: count + 1 }, (_, i) => from + ((to - from) * i) / count);
  const ys = xs.map((x) => curveValueAt(points, smooth, x)?.y);
  if (ys.some((y) => y === undefined)) return null;
  // A strip whose ends sit either side of the x-axis would be a bow-tie, and one lying on the axis
  // has no area: neither is how an area estimate is drawn, so refuse them with the reason.
  for (let i = 0; i < count; i++) {
    const a = ys[i]! - base, b = ys[i + 1]! - base;
    if (a * b < -1e-12) throw Error(`the graph crosses the x-axis between x = ${+xs[i].toFixed(6)} and x = ${+xs[i + 1].toFixed(6)}; choose strip edges where it crosses, or strips on one side.`);
    if (Math.abs(a) < 1e-9 && Math.abs(b) < 1e-9) throw Error(`the graph lies on the x-axis from x = ${+xs[i].toFixed(6)} to x = ${+xs[i + 1].toFixed(6)}, so that strip has no area.`);
  }
  return xs.slice(0, -1).map((x0, i) => {
    const x1 = xs[i + 1], y0 = ys[i]!, y1 = ys[i + 1]!;
    const corners = [{ x: x0, y: base }, { x: x1, y: base }, { x: x1, y: y1 }, { x: x0, y: y0 }];
    // A strip that starts or ends on the axis is a triangle.
    return corners.filter((p, k) => {
      const q = corners[(k + 1) % corners.length];
      return Math.hypot(p.x - q.x, p.y - q.y) > 1e-9;
    });
  });
}

/** True when any part of the circle's box meets the grid (radius in x units, y scaled to match). */
export function circleVisible(object: CircleObject, b: Bounds): boolean {
  const r = object.radius;
  return object.centre.x + r >= b.xMin && object.centre.x - r <= b.xMax && object.centre.y + r >= b.yMin && object.centre.y - r <= b.yMax;
}
