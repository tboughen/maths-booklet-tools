import type { Bounds, Coordinate, PolygonObject } from "./types";

export const POLYGON_MIN_VERTICES = 3;
export const POLYGON_MAX_VERTICES = 12;

/** Twice the signed area of a closed shape (positive when the corners run anticlockwise). */
function doubleArea(vertices: Coordinate[]): number {
  let sum = 0;
  vertices.forEach((p, i) => {
    const q = vertices[(i + 1) % vertices.length];
    sum += p.x * q.y - q.x * p.y;
  });
  return sum;
}

/** Why a shape cannot be drawn, or null when it can: repeated corners or no area. */
export function polygonProblem(vertices: Coordinate[]): string | null {
  for (let i = 0; i < vertices.length; i++) {
    const p = vertices[i], q = vertices[(i + 1) % vertices.length];
    if (Math.hypot(p.x - q.x, p.y - q.y) < 1e-10)
      return `corner ${i + 1} repeats the next corner (${p.x}, ${p.y}).`;
  }
  if (Math.abs(doubleArea(vertices)) < 1e-10) return "its corners lie on one straight line, so it has no area.";
  return null;
}

/** The centre of the shape's area, where its name prints. */
export function polygonCentroid(vertices: Coordinate[]): Coordinate {
  const a = doubleArea(vertices);
  if (Math.abs(a) < 1e-12)
    return {
      x: vertices.reduce((s, p) => s + p.x, 0) / vertices.length,
      y: vertices.reduce((s, p) => s + p.y, 0) / vertices.length,
    };
  let cx = 0, cy = 0;
  vertices.forEach((p, i) => {
    const q = vertices[(i + 1) % vertices.length], cross = p.x * q.y - q.x * p.y;
    cx += (p.x + q.x) * cross;
    cy += (p.y + q.y) * cross;
  });
  return { x: cx / (3 * a), y: cy / (3 * a) };
}

const inside = (p: Coordinate, b: Bounds) =>
  p.x >= b.xMin - 1e-9 && p.x <= b.xMax + 1e-9 && p.y >= b.yMin - 1e-9 && p.y <= b.yMax + 1e-9;

/** True when every corner is on the grid, so nothing is clipped. */
export function polygonInBounds(object: PolygonObject, bounds: Bounds): boolean {
  return object.vertices.every((p) => inside(p, bounds));
}

/** True when any corner is on the grid, so part of the shape prints. */
export function polygonVisible(object: PolygonObject, bounds: Bounds): boolean {
  return object.vertices.some((p) => inside(p, bounds));
}

export function formatVertices(vertices: Coordinate[]): string {
  return vertices.map((p) => `(${p.x}, ${p.y})`).join(" ");
}
