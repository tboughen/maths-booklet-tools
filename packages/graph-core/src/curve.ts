import type { Bounds, Coordinate, CurveObject, ReadingObject } from "./types";

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
