import { cleanNumber, pointInBounds } from "./diagram";
import { formatNumber } from "./equations";
import type { Bounds, Coordinate, StraightObject } from "./types";

/** The three corners of a line's gradient triangle: start and end on the line, and the right
 * angle below or above the end (U76). Null for a vertical line, which has no gradient. */
export function gradientTriangleCorners(object: StraightObject): { start: Coordinate; corner: Coordinate; end: Coordinate } | null {
  const t = object.gradientTriangle;
  if (!t) return null;
  const dx = object.end.x - object.start.x;
  if (Math.abs(dx) < 1e-12) return null;
  const slope = (object.end.y - object.start.y) / dx;
  const yAt = (x: number) => cleanNumber(object.start.y + slope * (x - object.start.x));
  const x2 = cleanNumber(t.x + t.run);
  return { start: { x: t.x, y: yAt(t.x) }, corner: { x: x2, y: yAt(t.x) }, end: { x: x2, y: yAt(x2) } };
}

/** The run and rise printed beside the triangle's legs: "4" and "−2", with minus signs. */
export function gradientTriangleValues(object: StraightObject): { run: string; rise: string } | null {
  const c = gradientTriangleCorners(object);
  if (!c) return null;
  const sign = (v: number) => formatNumber(v).replace("-", "−");
  return { run: sign(cleanNumber(c.corner.x - c.start.x)), rise: sign(cleanNumber(c.end.y - c.corner.y)) };
}

/** Why a line's gradient triangle cannot be drawn, or null when it can. */
export function gradientTriangleProblem(object: StraightObject, bounds: Bounds): string | null {
  const t = object.gradientTriangle;
  if (!t) return null;
  if (Math.abs(t.run) < 1e-12) return "a gradient triangle needs a run that is not zero.";
  const c = gradientTriangleCorners(object);
  if (!c) return "a vertical line has no gradient triangle.";
  if (Math.abs(c.end.y - c.corner.y) < 1e-12) return "a horizontal line has no rise, so it has no gradient triangle.";
  if (object.display === "segment") {
    const [lo, hi] = [Math.min(object.start.x, object.end.x), Math.max(object.start.x, object.end.x)];
    if (Math.min(c.start.x, c.end.x) < lo - 1e-9 || Math.max(c.start.x, c.end.x) > hi + 1e-9)
      return "the gradient triangle runs past the ends of the segment.";
  }
  if (![c.start, c.corner, c.end].every((p) => pointInBounds(p, bounds)))
    return "the gradient triangle runs off the grid. Start it elsewhere or shorten the run.";
  const v = gradientTriangleValues(object)!;
  if (t.labels && [v.run, v.rise].some((s) => s.replace(/^−/, "").length > 6))
    return `the rise ${v.rise} is too long to print. Choose a run that gives a whole number or short decimal rise.`;
  return null;
}
