import type { Coordinate } from "./types";

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
