/**
 * Folding a net made of rectangles (a cube or a cuboid) into a box, to check it and to say which
 * faces end up opposite and which corners meet. Nothing here changes a diagram: the editor and the
 * connector show the results as teacher notes, and "mark the opposite face" is an explicit action.
 *
 * Each face carries a frame: where its grid x and y directions point in 3D (U, V) and the side the
 * neighbours fold towards (W). Crossing an edge folds the neighbour through a right angle towards W,
 * so its outward normal is −W. Every shared edge must land in the same place from both faces (a 2 × 2
 * block of squares fails this), and every face must cover one whole side of the box.
 */
import type { Pt } from "./presets";

type V3 = [number, number, number];
const EPS = 1e-6;
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
const neg = (a: V3): V3 => [-a[0], -a[1], -a[2]];
const same = (a: number, b: number) => Math.abs(a - b) < EPS;
const same3 = (a: V3, b: V3) => same(a[0], b[0]) && same(a[1], b[1]) && same(a[2], b[2]);
const key3 = (a: V3) => a.map((v) => Math.round(v * 1000) / 1000 + 0).join(",");

type Frame = { P: V3; U: V3; V: V3; W: V3 };
const place = (f: Frame, p: Pt): V3 => add(add(f.P, mul(f.U, p[0])), mul(f.V, p[1]));

type Rect = { x0: number; y0: number; x1: number; y1: number };
/** The face as an axis-aligned rectangle, or null if it is any other shape. */
export function asRect(points: readonly Pt[]): Rect | null {
  if (points.length !== 4) return null;
  const xs = [...new Set(points.map((p) => Math.round(p[0] * 1000)))],
    ys = [...new Set(points.map((p) => Math.round(p[1] * 1000)))];
  if (xs.length !== 2 || ys.length !== 2) return null;
  const r = { x0: Math.min(...xs) / 1000, x1: Math.max(...xs) / 1000, y0: Math.min(...ys) / 1000, y1: Math.max(...ys) / 1000 };
  // Four distinct corners of that rectangle, in either turning order.
  const corners = new Set(points.map((p) => `${Math.round(p[0] * 1000)},${Math.round(p[1] * 1000)}`));
  if (corners.size !== 4) return null;
  for (let i = 0; i < 4; i++) {
    const a = points[i],
      b = points[(i + 1) % 4];
    if (!same(a[0], b[0]) && !same(a[1], b[1])) return null;
  }
  return r;
}

type Side = "right" | "left" | "down" | "up";
type Join = { other: number; side: Side; q: Pt };
/** How face a touches face b: a whole shared edge, part of one, or not at all. */
function touch(a: Rect, b: Rect): { side: Side; q: Pt } | "part" | null {
  const overlap = (p0: number, p1: number, q0: number, q1: number) => Math.min(p1, q1) - Math.max(p0, q0);
  const vertical = (x: number, side: Side) => {
    const o = overlap(a.y0, a.y1, b.y0, b.y1);
    if (o <= EPS) return null;
    return same(a.y0, b.y0) && same(a.y1, b.y1) ? { side, q: [x, a.y0] as Pt } : "part";
  };
  const horizontal = (y: number, side: Side) => {
    const o = overlap(a.x0, a.x1, b.x0, b.x1);
    if (o <= EPS) return null;
    return same(a.x0, b.x0) && same(a.x1, b.x1) ? { side, q: [a.x0, y] as Pt } : "part";
  };
  if (same(a.x1, b.x0)) return vertical(a.x1, "right");
  if (same(a.x0, b.x1)) return vertical(a.x0, "left");
  if (same(a.y1, b.y0)) return horizontal(a.y1, "down");
  if (same(a.y0, b.y1)) return horizontal(a.y0, "up");
  return null;
}
function fold(f: Frame, side: Side, q: Pt): Frame {
  let U = f.U,
    V = f.V,
    W = f.W;
  if (side === "right") [U, W] = [f.W, neg(f.U)];
  else if (side === "left") [U, W] = [neg(f.W), f.U];
  else if (side === "down") [V, W] = [f.W, neg(f.V)];
  else [V, W] = [neg(f.W), f.V];
  const at = place(f, q);
  return { P: add(add(at, mul(U, -q[0])), mul(V, -q[1])), U, V, W };
}

export type FoldResult =
  | { ok: false; reason: string; faces?: [number, number] }
  | {
      ok: true;
      /** "cube" when every side of the box is the same length. */
      solid: "cube" | "cuboid";
      size: V3;
      /** opposite[i] is the face that ends up opposite face i. */
      opposite: number[];
      /** Where a point of the flat net ends up, or null for a point on no face. */
      where: (p: Pt) => string | null;
    };

/**
 * Folds faces given as polygons. Returns null when a face is not a rectangle (prisms, pyramids):
 * those nets are drawn but not checked.
 */
export function foldBox(faces: readonly (readonly Pt[])[]): FoldResult | null {
  const rects = faces.map(asRect);
  if (!rects.length || rects.some((r) => !r)) return null;
  const R = rects as Rect[];
  if (R.length !== 6) return { ok: false, reason: `it has ${R.length} face${R.length === 1 ? "" : "s"}, not 6` };
  const joins: Join[][] = R.map(() => []);
  for (let i = 0; i < R.length; i++)
    for (let j = i + 1; j < R.length; j++) {
      const a = R[i],
        b = R[j];
      const inside = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0) > EPS && Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0) > EPS;
      if (inside) return { ok: false, reason: "two faces lie on top of each other on the flat net", faces: [i, j] };
      const t = touch(a, b);
      if (t === "part") return { ok: false, reason: "two faces meet along only part of an edge", faces: [i, j] };
      if (t) {
        joins[i].push({ other: j, side: t.side, q: t.q });
        const back: Side = t.side === "right" ? "left" : t.side === "left" ? "right" : t.side === "down" ? "up" : "down";
        joins[j].push({ other: i, side: back, q: t.q });
      }
    }
  const frames: (Frame | null)[] = R.map(() => null);
  frames[0] = { P: [0, 0, 0], U: [1, 0, 0], V: [0, 1, 0], W: [0, 0, 1] };
  const queue = [0];
  while (queue.length) {
    const i = queue.shift()!;
    for (const j of joins[i])
      if (!frames[j.other]) {
        frames[j.other] = fold(frames[i]!, j.side, j.q);
        queue.push(j.other);
      }
  }
  if (frames.some((f) => !f)) return { ok: false, reason: "the faces are not all joined edge to edge" };
  const F = frames as Frame[];
  // Every fold line must land in one place from both of its faces.
  for (let i = 0; i < R.length; i++)
    for (const j of joins[i]) {
      const r = R[i],
        ends: Pt[] = j.side === "right" || j.side === "left" ? [j.q, [j.q[0], r.y1]] : [j.q, [r.x1, j.q[1]]];
      if (!ends.every((p) => same3(place(F[i], p), place(F[j.other], p))))
        return { ok: false, reason: "the faces go all the way round a corner, so they cannot fold", faces: [i, j.other] };
    }
  const normals = F.map((f) => neg(f.W));
  for (let i = 0; i < 6; i++)
    for (let j = i + 1; j < 6; j++)
      if (same3(normals[i], normals[j])) return { ok: false, reason: "two faces would land on the same side", faces: [i, j] };
  const corners = R.map((r, i) =>
    (
      [
        [r.x0, r.y0],
        [r.x1, r.y0],
        [r.x1, r.y1],
        [r.x0, r.y1],
      ] as Pt[]
    ).map((p) => place(F[i], p)),
  );
  const all = corners.flat();
  const lo = [0, 1, 2].map((k) => Math.min(...all.map((p) => p[k]))),
    hi = [0, 1, 2].map((k) => Math.max(...all.map((p) => p[k])));
  for (let i = 0; i < 6; i++) {
    const n = normals[i],
      axis = n.findIndex((v) => !same(v, 0)),
      plane = n[axis] > 0 ? hi[axis] : lo[axis];
    const others = [0, 1, 2].filter((k) => k !== axis);
    const covers =
      corners[i].every((p) => same(p[axis], plane)) &&
      others.every((k) => same(Math.min(...corners[i].map((p) => p[k])), lo[k]) && same(Math.max(...corners[i].map((p) => p[k])), hi[k]));
    if (!covers) return { ok: false, reason: "the edges that join are not the same length" };
  }
  const size: V3 = [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]];
  const opposite = normals.map((n) => normals.findIndex((m) => same3(m, neg(n))));
  const where = (p: Pt) => {
    const i = R.findIndex((r) => p[0] >= r.x0 - EPS && p[0] <= r.x1 + EPS && p[1] >= r.y0 - EPS && p[1] <= r.y1 + EPS);
    return i < 0 ? null : key3(place(F[i], p));
  };
  return { ok: true, solid: same(size[0], size[1]) && same(size[1], size[2]) ? "cube" : "cuboid", size, opposite, where };
}
