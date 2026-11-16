import type { Coordinate } from "./types";

/** Where a vector's arrowhead sits: at the end of the segment, or centred on its middle. */
export type ArrowPosition = "end" | "middle";

/**
 * The three corners of a filled arrowhead pointing from `from` towards `to`, with its tip at
 * `tip`. Length and half-width are in the same units as the coordinates (SVG units).
 */
export function arrowheadCorners(from: Coordinate, to: Coordinate, tip: Coordinate, length: number, halfWidth: number): Coordinate[] {
  const dx = to.x - from.x, dy = to.y - from.y, d = Math.hypot(dx, dy) || 1;
  const ux = dx / d, uy = dy / d;
  const bx = tip.x - ux * length, by = tip.y - uy * length;
  return [tip, { x: bx - uy * halfWidth, y: by + ux * halfWidth }, { x: bx + uy * halfWidth, y: by - ux * halfWidth }];
}

/** The tip of a vector's arrowhead: the end point, or half a head beyond the middle. */
export function arrowTip(start: Coordinate, end: Coordinate, position: ArrowPosition, length: number): Coordinate {
  if (position === "end") return end;
  const dx = end.x - start.x, dy = end.y - start.y, d = Math.hypot(dx, dy) || 1;
  return { x: (start.x + end.x) / 2 + (dx / d) * (length / 2), y: (start.y + end.y) / 2 + (dy / d) * (length / 2) };
}

/** SVG path data for the arrowhead of a vector from start to end, in SVG units. */
export function arrowheadPath(start: Coordinate, end: Coordinate, position: ArrowPosition, length: number, halfWidth: number): string {
  const tip = arrowTip(start, end, position, length);
  const [a, b, c] = arrowheadCorners(start, end, tip, length, halfWidth);
  const f = (v: number) => String(Number(v.toFixed(2)));
  return `M ${f(a.x)} ${f(a.y)} L ${f(b.x)} ${f(b.y)} L ${f(c.x)} ${f(c.y)} Z`;
}
