import type { Shape, ShapeType } from "../../packages/elevation-core/src";

export const SHAPE_NAMES: Record<ShapeType, string> = { prism: "Prism", pyramid: "Pyramid", cylinder: "Cylinder", cone: "Cone", sphere: "Sphere", hemisphere: "Hemisphere" };
/** Where each kind of shape starts when it is added: one that fits in the space from 0. */
export function defaultShape(type: ShapeType, base = 0): Shape {
  const at = (x: number, y: number) => ({ x, y, z: base });
  switch (type) {
    case "prism":
      return { type, at: at(0, 0), section: [[0, 0], [4, 0], [2, 3]], axis: "y", length: 5 };
    case "pyramid":
      return { type, at: at(0, 0), base: [[0, 0], [4, 0], [4, 4], [0, 4]], apex: { x: 2, y: 2, z: 3 } };
    case "cylinder":
      return { type, at: at(2, 2), r: 2, h: 5, axis: "z" };
    case "cone":
      return { type, at: at(2, 2), r: 2, h: 4, axis: "z" };
    case "sphere":
      return { type, at: { x: 2, y: 2, z: base + 2 }, r: 2 };
    case "hemisphere":
      return { type, at: at(2, 2), r: 2, flat: "down" };
  }
}
/**
 * The numbers in a typed list such as "(0, 0) (4, 0) (-.5, 3)", or null when it holds anything else.
 * Accepts a typographic minus and a leading point; any other character is refused rather than dropped.
 */
function numbers(text: string): number[] | null {
  const t = text.replace(/\u2212/g, "-");
  if (/[^\d\s.,;()-]/.test(t)) return null;
  const parts = t.split(/[\s,;()]+/).filter(Boolean);
  const v = parts.map((x) => (/^-?(\d+\.?\d*|\.\d+)$/.test(x) ? Number(x) : NaN));
  return v.some((x) => !Number.isFinite(x)) ? null : v;
}
/** "(0, 0) (6, 0) (5, 3)" for a list of corners. */
export const cornersText = (pts: number[][]) => pts.map(([a, b]) => `(${a}, ${b})`).join(" ");
export const pointText = (p: { x: number; y: number; z: number }) => `(${p.x}, ${p.y}, ${p.z})`;
export function parseCorners(text: string): number[][] | string {
  const v = numbers(text);
  if (!v || v.length % 2 || v.length < 6) return "Type 3 to 12 corners as pairs of numbers separated by commas, such as (0, 0) (4, 0) (2, 3).";
  return Array.from({ length: v.length / 2 }, (_, i) => [v[2 * i], v[2 * i + 1]]);
}
export function parsePoint(text: string): { x: number; y: number; z: number } | string {
  const v = numbers(text);
  if (!v || v.length !== 3) return "Type a corner as three numbers (across, back, up), such as (0, 0, 3).";
  return { x: v[0], y: v[1], z: v[2] };
}

