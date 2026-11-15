/**
 * Area and perimeter diagrams (improvement list G-8 and G-9): compound shapes (rectilinear L, T and
 * U shapes, trapeziums, triangles, rectangles with semicircles added or cut out, frames and shapes
 * with holes) and circles, semicircles, quarter circles and sectors.
 *
 * The document is one outline (a polygon whose sides may be semicircles, or a part of a circle), an
 * optional hole, and the labels a teacher prints on it. Every place a label can go has a stable slot
 * ID: e1, e2 ... on the polygon's sides, h1 ... on dashed heights, r, d, angle and arc on a circle,
 * hw, hh and hr on the hole, and area inside. A slot that is not listed prints nothing.
 *
 * Labels use the house label states: value (a given length, printed as typed, such as 8 cm),
 * symbol (a letter such as x), blank (nothing printed: a missing side), answer-line and hidden. A
 * saved answer prints only on the answers copy, in the house answer colour, in place of the label.
 * Answers stay as typed, so "25π cm²" stays exact. Nothing is ever calculated or filled in.
 *
 * The drawing never has to match the numbers ("Diagram NOT accurately drawn"); lengths that cannot
 * all be right raise a teacher-only note, never a correction.
 */
import { z } from "zod";
import { aboutShape } from "../../envelope-core/src/about";
import { defineEnvelope } from "../../envelope-core/src/index";
import { ANSWER_COLOUR } from "../../envelope-core/src/answer-state";
import { boldLines, LINE_WEIGHTS, MIN_TEXT_PT } from "../../envelope-core/src/house-style";
import { glyphAdvance } from "../../ratio-table-core/src/font-metrics";

export { ANSWER_COLOUR };
export const STATES = ["value", "symbol", "blank", "answer-line", "hidden"] as const;
export type LabelState = (typeof STATES)[number];
export const ARCS = ["none", "out", "in"] as const;
export type ArcKind = (typeof ARCS)[number];
export const PARTS = ["full", "semicircle", "quarter", "sector"] as const;
export type CirclePart = (typeof PARTS)[number];
export const PART_NAMES: Record<CirclePart, string> = { full: "Circle", semicircle: "Semicircle", quarter: "Quarter circle", sector: "Sector" };
export const SHADES = ["none", "shape", "hole"] as const;
export const MIN_CORNERS = 3;
export const MAX_CORNERS = 12;
export const MAX_LABEL = 24;
export const GRID_MM = 10;

const plain = (max: number) =>
  z
    .string()
    .max(max)
    .refine((s) => ![...s].some((c) => c.charCodeAt(0) < 32 || c === "<" || c === ">" || c === "&"), "Use ordinary text without markup.");
const slotId = z.string().regex(/^[a-z][a-z0-9]{0,7}$/);
const coord = z.number().finite().min(-150).max(150);
const point = z.object({ x: coord, y: coord }).strict();

export const labelSchema = z
  .object({
    id: slotId,
    state: z.enum(STATES),
    /** What pupils see: a length for value ("8 cm", "2x + 1"), a letter for symbol ("x"). */
    text: plain(MAX_LABEL),
    /** The saved answer, printed only on the answers copy. Empty means none. */
    answer: plain(MAX_LABEL),
  })
  .strict();
export const nameSchema = z.object({ id: slotId, text: plain(3) }).strict();
export const shapeSchema = z.discriminatedUnion("type", [
  /**
   * A polygon in mm (y up), corners anticlockwise. Side k runs from corner k to corner k + 1; its arc
   * is none (a straight side), out (a semicircle on the side, outside the shape) or in (a semicircle
   * cut out of the shape). heights are dashed perpendiculars from a corner to the line of a side.
   */
  z
    .object({
      type: z.literal("polygon"),
      corners: z.array(point).min(MIN_CORNERS).max(MAX_CORNERS),
      arcs: z.array(z.enum(ARCS)).min(MIN_CORNERS).max(MAX_CORNERS),
      heights: z.array(z.object({ corner: z.number().int().min(1).max(MAX_CORNERS), side: z.number().int().min(1).max(MAX_CORNERS) }).strict()).max(4),
      /** Corners (1 to n) with a right-angle mark. */
      rightAngles: z.array(z.number().int().min(1).max(MAX_CORNERS)).max(MAX_CORNERS),
    })
    .strict(),
  /** A circle or part of one, centre at the origin. A sector turns anticlockwise from the right. */
  z
    .object({
      type: z.literal("circle"),
      part: z.enum(PARTS),
      radiusMm: z.number().finite().min(10).max(80),
      /** The sector's angle; a quarter circle is always 90 and a semicircle 180. */
      angleDeg: z.number().finite().min(5).max(355),
      /** On a whole circle: a radius, a diameter or neither drawn. */
      line: z.enum(["radius", "diameter", "none"]),
      /** A dot at the centre. */
      centre: z.boolean(),
    })
    .strict(),
]);
export const holeSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("rectangle"), x: coord, y: coord, w: z.number().finite().min(4).max(250), h: z.number().finite().min(4).max(250) }).strict(),
  z.object({ type: z.literal("circle"), x: coord, y: coord, r: z.number().finite().min(2).max(100) }).strict(),
]);
export const documentSchema = z
  .object({
    shape: shapeSchema,
    /** A hole or inner shape: a frame, a pond in a lawn, a circle cut from a square. */
    hole: holeSchema.nullable(),
    /** Grey shading: none, the shape (less any hole) or the hole only. */
    shaded: z.enum(SHADES),
    labels: z.array(labelSchema).max(40),
    /** Letters printed beside corners and points (A, B, C ...), by point ID. */
    names: z.array(nameSchema).max(20),
    /** Light 1 cm squares behind the shape, at true size, for counting squares. */
    grid: z.boolean(),
    notToScale: z.boolean(),
    /** Label text size in points (U111), 10-14. Left out means 11 pt; 11 is never saved. */
    fontPt: z
      .number()
      .int()
      .min(MIN_TEXT_PT)
      .max(14)
      .transform((v) => (v === 11 ? undefined : v))
      .optional(),
    /** Bold lines (U111). Normal lines are the default and are never saved. */
    lines: z
      .enum(LINE_WEIGHTS)
      .transform((v) => (v === "bold" ? v : undefined))
      .optional(),
  })
  .strict();
export const envelopeSchema = z
  .object({ kind: z.literal("area"), schemaVersion: z.literal(1), rendererVersion: z.literal("area-1"), document: documentSchema, ...aboutShape })
  .strict();
export type Envelope = z.infer<typeof envelopeSchema>;
export type AreaDocument = Envelope["document"];
export type Shape = AreaDocument["shape"];
export type Polygon = Extract<Shape, { type: "polygon" }>;
export type Circle = Extract<Shape, { type: "circle" }>;
export type Hole = NonNullable<AreaDocument["hole"]>;
export type Label = z.infer<typeof labelSchema>;
export type View = "pupil" | "answer";
export type P = { x: number; y: number };

export const label = (id: string, text = "", state: LabelState = text ? "value" : "blank", answer = ""): Label => ({ id, state, text, answer });

/* ---------- Geometry ---------- */

const rad = (deg: number) => (deg * Math.PI) / 180;
const dir = (deg: number): P => ({ x: Math.cos(rad(deg)), y: Math.sin(rad(deg)) });
const add = (a: P, b: P): P => ({ x: a.x + b.x, y: a.y + b.y });
const sub = (a: P, b: P): P => ({ x: a.x - b.x, y: a.y - b.y });
const mul = (a: P, s: number): P => ({ x: a.x * s, y: a.y * s });
const len = (a: P) => Math.hypot(a.x, a.y);
const dot = (a: P, b: P) => a.x * b.x + a.y * b.y;
const unit = (a: P): P => {
  const l = len(a);
  return l ? mul(a, 1 / l) : { x: 1, y: 0 };
};
/** The outward normal of a side running a to b round an anticlockwise outline. */
const outward = (a: P, b: P): P => {
  const u = unit(sub(b, a));
  return { x: u.y, y: -u.x };
};

/** One drawn piece of the outline: a straight side or a semicircle on a side. */
export type Edge = { id: string; a: P; b: P; arc: ArcKind };
/** A slot is a place a label can go, with where it sits and which way it moves to find space. */
export type Slot = { id: string; name: string; at: P; away: P[]; inside?: boolean; from?: number };
export type Geometry = {
  /** Strokes as segments (arcs sampled), for drawing checks and label placement. */
  strokes: { a: P; b: P }[];
  edges: Edge[];
  dashed: { a: P; b: P }[];
  /** Right-angle marks: corner, and the two directions along its sides. */
  squares: { at: P; u: P; v: P }[];
  /** An angle arc at a sector's centre. */
  angleArc: { start: number; sweep: number } | null;
  points: Record<string, { at: P; out: P }>;
  slots: Slot[];
  /** The outline as sampled points (for shading, bounds and inside tests). */
  outline: P[];
  holeOutline: P[] | null;
  centreDot: P | null;
};

const ARC_STEPS = 32;
/** Points along a semicircle on a to b, bulging out (to the right of travel) or in. */
function semicircle(a: P, b: P, arc: ArcKind): P[] {
  const c = mul(add(a, b), 0.5),
    r = len(sub(b, a)) / 2,
    start = Math.atan2(a.y - c.y, a.x - c.x);
  // Turning anticlockwise from a goes round the right of a→b: outside an anticlockwise outline.
  const sign = arc === "out" ? 1 : -1;
  return Array.from({ length: ARC_STEPS + 1 }, (_, i) => {
    const t = start + (sign * Math.PI * i) / ARC_STEPS;
    return { x: c.x + r * Math.cos(t), y: c.y + r * Math.sin(t) };
  });
}
function arcPoints(c: P, r: number, startDeg: number, sweepDeg: number): P[] {
  const steps = Math.max(8, Math.ceil(sweepDeg / 6));
  return Array.from({ length: steps + 1 }, (_, i) => add(c, mul(dir(startDeg + (sweepDeg * i) / steps), r)));
}
const polyline = (pts: P[]) => pts.slice(1).map((b, i) => ({ a: pts[i], b }));

/** Where the dashed height from a corner meets the line of a side. */
export function heightFoot(corners: P[], corner: number, side: number): P {
  const v = corners[corner - 1],
    a = corners[side - 1],
    b = corners[side % corners.length];
  const u = unit(sub(b, a));
  return add(a, mul(u, dot(sub(v, a), u)));
}

/** A circle's parts: its outline and centre angles, with a sector's start always 0 (to the right). */
function circleSweep(c: Circle) {
  return c.part === "full" ? 360 : c.part === "semicircle" ? 180 : c.part === "quarter" ? 90 : c.angleDeg;
}

function holeGeometry(h: Hole): P[] {
  if (h.type === "circle") return arcPoints({ x: h.x, y: h.y }, h.r, 0, 360);
  return [
    { x: h.x, y: h.y },
    { x: h.x + h.w, y: h.y },
    { x: h.x + h.w, y: h.y + h.h },
    { x: h.x, y: h.y + h.h },
    { x: h.x, y: h.y },
  ];
}

/** The figure in mm, y up. */
export function geometry(d: AreaDocument): Geometry {
  const s = d.shape;
  const strokes: Geometry["strokes"] = [],
    edges: Edge[] = [],
    dashed: Geometry["dashed"] = [],
    squares: Geometry["squares"] = [],
    points: Geometry["points"] = {},
    slots: Slot[] = [];
  let outline: P[] = [],
    angleArc: Geometry["angleArc"] = null,
    centreDot: P | null = null;
  if (s.type === "polygon") {
    const c = s.corners,
      n = c.length;
    const centre = mul(c.reduce(add, { x: 0, y: 0 }), 1 / n);
    for (let k = 0; k < n; k++) {
      const a = c[k],
        b = c[(k + 1) % n],
        arc = s.arcs[k] ?? "none",
        out = outward(a, b);
      edges.push({ id: `e${k + 1}`, a, b, arc });
      const pts = arc === "none" ? [a, b] : semicircle(a, b, arc);
      strokes.push(...polyline(pts));
      outline.push(...pts.slice(0, -1));
      const mid = mul(add(a, b), 0.5),
        r = len(sub(b, a)) / 2;
      // A straight side's label sits outside it; an added semicircle's beyond its top; a cut-out's in the space it leaves.
      if (arc === "none") slots.push({ id: `e${k + 1}`, name: `side ${k + 1}`, at: mid, away: [out] });
      else if (arc === "out") slots.push({ id: `e${k + 1}`, name: `semicircle on side ${k + 1}`, at: add(mid, mul(out, r)), away: [out] });
      else slots.push({ id: `e${k + 1}`, name: `semicircle cut from side ${k + 1}`, at: mid, away: [mul(out, -1)], inside: true });
      points[`v${k + 1}`] = { at: a, out: unit(sub(a, centre)) };
    }
    s.heights.forEach((h, i) => {
      const v = c[h.corner - 1],
        foot = heightFoot(c, h.corner, h.side);
      dashed.push({ a: v, b: foot });
      const a = c[h.side - 1],
        b = c[h.side % n];
      // A foot beyond the side gets a dashed extension of the side, as on exam papers.
      const u = unit(sub(b, a)),
        t = dot(sub(foot, a), u),
        sideLen = len(sub(b, a));
      if (t < -0.01) dashed.push({ a: foot, b: a });
      if (t > sideLen + 0.01) dashed.push({ a: b, b: foot });
      const up = unit(sub(v, foot));
      if (len(sub(v, foot)) > 0.5) squares.push({ at: foot, u: t > sideLen / 2 ? mul(u, -1) : u, v: up });
      const mid = mul(add(v, foot), 0.5),
        side = { x: -up.y, y: up.x };
      slots.push({ id: `h${i + 1}`, name: `height ${i + 1}`, at: mid, away: [side, mul(side, -1)], inside: true });
    });
    for (const k of s.rightAngles) {
      const v = c[k - 1];
      squares.push({ at: v, u: unit(sub(c[k % n], v)), v: unit(sub(c[(k + n - 2) % n], v)) });
    }
  } else {
    const r = s.radiusMm,
      o = { x: 0, y: 0 },
      sweep = circleSweep(s);
    centreDot = s.centre ? o : null;
    points.o = { at: o, out: s.part === "full" ? dir(225) : dir(sweep / 2 + 180) };
    if (s.part === "full") {
      const ring = arcPoints(o, r, 0, 360);
      strokes.push(...polyline(ring));
      outline = ring.slice(0, -1);
      slots.push({ id: "arc", name: "the circumference", at: add(o, mul(dir(45), r)), away: [dir(45)] });
      if (s.line === "radius") {
        strokes.push({ a: o, b: { x: r, y: 0 } });
        slots.push({ id: "r", name: "the radius", at: { x: r / 2, y: 0 }, away: [dir(90)], inside: true });
        points.a = { at: { x: r, y: 0 }, out: dir(0) };
      }
      if (s.line === "diameter") {
        strokes.push({ a: { x: -r, y: 0 }, b: { x: r, y: 0 } });
        slots.push({ id: "d", name: "the diameter", at: o, away: [dir(90)], inside: true });
        points.a = { at: { x: -r, y: 0 }, out: dir(180) };
        points.b = { at: { x: r, y: 0 }, out: dir(0) };
      }
    } else {
      const arc = arcPoints(o, r, 0, sweep);
      // Outline: centre (or the diameter) and the arc.
      if (s.part === "semicircle") {
        strokes.push(...polyline(arc), { a: { x: -r, y: 0 }, b: { x: r, y: 0 } });
        outline = arc;
        slots.push({ id: "d", name: "the diameter", at: o, away: [dir(270)] });
        points.a = { at: { x: r, y: 0 }, out: dir(0) };
        points.b = { at: { x: -r, y: 0 }, out: dir(180) };
      } else {
        const end = mul(dir(sweep), r);
        strokes.push(...polyline(arc), { a: o, b: { x: r, y: 0 } }, { a: o, b: end });
        outline = [o, ...arc];
        slots.push({ id: "r", name: "the first radius", at: { x: r / 2, y: 0 }, away: [dir(270)] });
        slots.push({ id: "r2", name: "the second radius", at: mul(dir(sweep), r / 2), away: [dir(sweep + 90)] });
        slots.push({ id: "angle", name: "the angle at the centre", at: o, away: [dir(sweep / 2)], inside: true, from: (s.part === "sector" && sweep < 30 ? 9 : 6) + 1 });
        if (s.part === "quarter") squares.push({ at: o, u: dir(0), v: dir(90) });
        else angleArc = { start: 0, sweep };
        points.a = { at: { x: r, y: 0 }, out: dir(0) };
        points.b = { at: end, out: dir(sweep) };
      }
      slots.push({ id: "arc", name: "the arc", at: mul(dir(sweep / 2), r), away: [dir(sweep / 2)] });
    }
  }
  let holeOutline: P[] | null = null;
  const h = d.hole;
  if (h) {
    holeOutline = holeGeometry(h);
    strokes.push(...polyline(holeOutline));
    holeOutline = holeOutline.slice(0, -1);
    if (h.type === "rectangle") {
      slots.push({ id: "hw", name: "the hole's width", at: { x: h.x + h.w / 2, y: h.y + h.h }, away: [dir(270)], inside: true });
      slots.push({ id: "hh", name: "the hole's height", at: { x: h.x + h.w, y: h.y + h.h / 2 }, away: [dir(180)], inside: true });
    } else {
      const has = d.labels.some((l) => l.id === "hr");
      if (has) strokes.push({ a: { x: h.x, y: h.y }, b: { x: h.x + h.r, y: h.y } });
      slots.push({ id: "hr", name: "the hole's radius", at: { x: h.x + h.r / 2, y: h.y }, away: [dir(90)], inside: true });
    }
  }
  slots.push({ id: "area", name: "inside the shape", at: interiorPoint(outline, holeOutline), away: [], inside: true });
  return { strokes, edges, dashed, squares, angleArc, points, slots, outline, holeOutline, centreDot };
}

function shoelace(pts: P[]) {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i],
      q = pts[(i + 1) % pts.length];
    a += p.x * q.y - q.x * p.y;
  }
  return a / 2;
}
export function inside(pts: P[], p: P) {
  let c = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i],
      b = pts[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) c = !c;
  }
  return c;
}
/** A point well inside the shape (and outside any hole), for the area label. */
function interiorPoint(outline: P[], hole: P[] | null): P {
  const xs = outline.map((p) => p.x),
    ys = outline.map((p) => p.y);
  const minX = Math.min(...xs),
    maxX = Math.max(...xs),
    minY = Math.min(...ys),
    maxY = Math.max(...ys);
  let best: P = { x: (minX + maxX) / 2, y: (minY + maxY) / 2 },
    bestScore = -Infinity;
  const steps = 24;
  for (let i = 1; i < steps; i++)
    for (let j = 1; j < steps; j++) {
      const p = { x: minX + ((maxX - minX) * i) / steps, y: minY + ((maxY - minY) * j) / steps };
      if (!inside(outline, p) || (hole && inside(hole, p))) continue;
      let clear = Infinity;
      for (const ring of hole ? [outline, hole] : [outline])
        for (let k = 0; k < ring.length; k++) clear = Math.min(clear, segmentDistance(p, ring[k], ring[(k + 1) % ring.length]));
      // Prefer the roomiest place, then the middle; with a hole, the band beside it.
      const score = clear - 0.02 * len(sub(p, { x: (minX + maxX) / 2, y: (minY + maxY) / 2 }));
      if (score > bestScore) {
        bestScore = score;
        best = p;
      }
    }
  return best;
}
function segmentDistance(p: P, a: P, b: P) {
  const ab = sub(b, a),
    l2 = dot(ab, ab);
  const t = l2 ? Math.max(0, Math.min(1, dot(sub(p, a), ab) / l2)) : 0;
  return len(sub(p, add(a, mul(ab, t))));
}
function segmentsCross(a: P, b: P, c: P, d: P) {
  const o = (p: P, q: P, r: P) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  const d1 = o(c, d, a),
    d2 = o(c, d, b),
    d3 = o(a, b, c),
    d4 = o(a, b, d);
  return ((d1 > 1e-9 && d2 < -1e-9) || (d1 < -1e-9 && d2 > 1e-9)) && ((d3 > 1e-9 && d4 < -1e-9) || (d3 < -1e-9 && d4 > 1e-9));
}


/* ---------- Validation ---------- */

export function validate(input: unknown): Envelope {
  const parsed = envelopeSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue?.path ?? [];
    if (path.includes("corners") && path.length > 4) throw Error("Keep every corner within 150 mm of the centre.");
    if (path.includes("corners") || path.includes("arcs")) throw Error(`Use a polygon of ${MIN_CORNERS} to ${MAX_CORNERS} corners.`);
    if (path.includes("text") || path.includes("answer")) throw Error(`Use labels of at most ${MAX_LABEL} characters without markup.`);
    if (path.includes("radiusMm")) throw Error("Choose a radius from 10 to 80 mm.");
    if (path.includes("angleDeg")) throw Error("Give a sector an angle from 5 to 355 degrees.");
    if (path.includes("hole")) throw Error("Give the hole a size of at least 4 mm (a radius of at least 2 mm), within 150 mm of the centre.");
    throw Error(path.length ? `${path.join(".")}: ${issue.message}` : "This is not a supported area and perimeter file (version 1 is supported).");
  }
  const e = parsed.data,
    d = e.document,
    s = d.shape;
  if (s.type === "polygon") {
    const c = s.corners,
      n = c.length;
    if (s.arcs.length !== n) throw Error(`Give an arc setting (none, out or in) for each of the ${n} sides.`);
    for (let k = 0; k < n; k++) if (len(sub(c[(k + 1) % n], c[k])) < 3) throw Error(`Side ${k + 1} is shorter than 3 mm. Move corner ${k + 1} or ${((k + 1) % n) + 1}.`);
    for (let i = 0; i < n; i++)
      for (let j = i + 1; j < n; j++) if (segmentsCross(c[i], c[(i + 1) % n], c[j], c[(j + 1) % n])) throw Error(`Sides ${i + 1} and ${j + 1} cross. Give the corners in order round the shape.`);
    if (shoelace(c) <= 0) throw Error("Give the corners in order anticlockwise round the shape.");
    for (const h of s.heights) {
      if (h.corner > n || h.side > n) throw Error(`This shape has ${n} corners and sides.`);
      if (h.side === h.corner || h.side % n === h.corner - 1) throw Error(`A height from corner ${h.corner} goes to a side that touches it; choose a side across the shape.`);
      if (s.arcs[h.side - 1] !== "none") throw Error(`Side ${h.side} is a semicircle, so a height cannot meet it.`);
    }
    if (s.rightAngles.some((k) => k > n)) throw Error(`Right-angle marks go at corners 1 to ${n}.`);
    if (new Set(s.rightAngles).size !== s.rightAngles.length) throw Error("List each right-angle corner once.");
  }
  if (s.type === "circle" && s.part !== "full" && s.line !== "none") throw Error("Only a whole circle draws a radius or diameter line; set line to none.");
  const g = geometry(d);
  // Semicircle sides must not cross other sides either: check the outline as drawn.
  if (s.type === "polygon" && s.arcs.some((a) => a !== "none")) {
    const o = g.outline,
      m = o.length;
    for (let i = 0; i < m; i++)
      for (let j = i + 2; j < m; j++) {
        if (i === 0 && j === m - 1) continue;
        if (segmentsCross(o[i], o[(i + 1) % m], o[j], o[(j + 1) % m])) throw Error("A semicircle side crosses another side. Make the shape larger or the semicircle's side shorter.");
      }
  }
  if (d.hole) {
    const ring = g.holeOutline!;
    if (ring.some((p) => !inside(g.outline, p))) throw Error("Keep the hole inside the shape.");
    for (let i = 0; i < ring.length; i++)
      for (let k = 0; k < g.outline.length; k++)
        if (segmentsCross(ring[i], ring[(i + 1) % ring.length], g.outline[k], g.outline[(k + 1) % g.outline.length])) throw Error("Keep the hole inside the shape.");
  } else if (d.shaded === "hole") throw Error("There is no hole to shade.");
  const slots = new Set(g.slots.map((x) => x.id));
  const seen = new Set<string>();
  for (const l of d.labels) {
    if (!slots.has(l.id)) throw Error(`This shape has no label place ${l.id}. Its places are ${[...slots].join(", ")}.`);
    if (seen.has(l.id)) throw Error(`Label ${l.id} is listed twice.`);
    seen.add(l.id);
    l.text = l.text.trim().replace(/\s+/g, " ");
    l.answer = l.answer.trim().replace(/\s+/g, " ");
    if (l.state === "value" && l.answer) throw Error(`Label ${l.id} is given, so it cannot hold a saved answer. Clear the answer or change the label.`);
    if ((l.state === "value" || l.state === "symbol") && !l.text) throw Error(`Label ${l.id} is ${l.state === "value" ? "given" : "a letter"} but has no text. Type it, or make the label blank.`);
  }
  const points = new Set(Object.keys(g.points));
  const named = new Set<string>();
  for (const nm of d.names) {
    if (!points.has(nm.id)) throw Error(`This shape has no point ${nm.id}. Its points are ${[...points].join(", ")}.`);
    if (named.has(nm.id)) throw Error(`Point ${nm.id} is named twice.`);
    named.add(nm.id);
    nm.text = nm.text.trim();
  }
  d.names = d.names.filter((nm) => nm.text);
  return e;
}
const envelope = defineEnvelope<Envelope>({ kind: "area", validate, canonical: "sorted" });
export const canonical = envelope.canonical;
export const hash = envelope.contentHash;
export function parseFile(text: string) {
  if (text.length > 30_000) throw Error("This editable file is too large.");
  return validate(JSON.parse(text));
}

export const hasHidden = (e: Envelope) => e.document.labels.some((l) => l.state !== "value" && l.answer);

/** Keeps only the labels and names the shape still has, after a change of shape. */
export function prune(e: Envelope): Envelope {
  const n = structuredClone(e),
    g = geometry(n.document),
    slots = new Set(g.slots.map((s) => s.id)),
    points = new Set(Object.keys(g.points));
  n.document.labels = n.document.labels.filter((l) => slots.has(l.id));
  n.document.names = n.document.names.filter((nm) => points.has(nm.id));
  return n;
}

/* ---------- Building ---------- */

export const PRESETS = ["rectangle", "l-shape", "t-shape", "u-shape", "triangle", "parallelogram", "trapezium", "house", "rectangle-semicircle", "rectangle-cut", "frame", "circle", "semicircle", "quarter", "sector"] as const;
export type Preset = (typeof PRESETS)[number];
export const PRESET_NAMES: Record<Preset, string> = {
  rectangle: "Rectangle",
  "l-shape": "L shape",
  "t-shape": "T shape",
  "u-shape": "U shape",
  triangle: "Triangle with a height",
  parallelogram: "Parallelogram",
  trapezium: "Trapezium",
  house: "Rectangle and triangle",
  "rectangle-semicircle": "Rectangle and semicircle",
  "rectangle-cut": "Rectangle with a semicircle cut out",
  frame: "Frame (rectangle with a hole)",
  circle: "Circle",
  semicircle: "Semicircle",
  quarter: "Quarter circle",
  sector: "Sector",
};
const pts = (...xy: number[]): P[] => Array.from({ length: xy.length / 2 }, (_, i) => ({ x: xy[2 * i], y: xy[2 * i + 1] }));
const poly = (corners: P[], extra: Partial<Polygon> = {}): Polygon => ({ type: "polygon", corners, arcs: corners.map(() => "none"), heights: [], rightAngles: [], ...extra });
const circle = (part: CirclePart, extra: Partial<Circle> = {}): Circle => ({ type: "circle", part, radiusMm: 30, angleDeg: part === "sector" ? 110 : 90, line: part === "full" ? "radius" : "none", centre: part === "full", ...extra });

/** The shape (and hole) a preset starts from, without labels. */
export function presetShape(p: Preset): { shape: Shape; hole: Hole | null } {
  switch (p) {
    case "rectangle":
      return { shape: poly(pts(0, 0, 60, 0, 60, 35, 0, 35)), hole: null };
    case "l-shape":
      return { shape: poly(pts(0, 0, 60, 0, 60, 25, 25, 25, 25, 50, 0, 50)), hole: null };
    case "t-shape":
      return { shape: poly(pts(22, 0, 44, 0, 44, 30, 66, 30, 66, 50, 0, 50, 0, 30, 22, 30)), hole: null };
    case "u-shape":
      return { shape: poly(pts(0, 0, 66, 0, 66, 45, 46, 45, 46, 18, 20, 18, 20, 45, 0, 45)), hole: null };
    case "triangle":
      return { shape: poly(pts(0, 0, 64, 0, 22, 40), { heights: [{ corner: 3, side: 1 }] }), hole: null };
    case "parallelogram":
      return { shape: poly(pts(0, 0, 55, 0, 72, 32, 17, 32), { heights: [{ corner: 4, side: 1 }] }), hole: null };
    case "trapezium":
      return { shape: poly(pts(0, 0, 70, 0, 52, 34, 14, 34), { heights: [{ corner: 4, side: 1 }] }), hole: null };
    case "house":
      return { shape: poly(pts(0, 0, 50, 0, 50, 32, 25, 54, 0, 32)), hole: null };
    case "rectangle-semicircle":
      return { shape: poly(pts(0, 0, 50, 0, 50, 34, 0, 34), { arcs: ["none", "out", "none", "none"] }), hole: null };
    case "rectangle-cut":
      return { shape: poly(pts(0, 0, 66, 0, 66, 40, 49, 40, 17, 40, 0, 40), { arcs: ["none", "none", "none", "in", "none", "none"] }), hole: null };
    case "frame":
      return { shape: poly(pts(0, 0, 70, 0, 70, 46, 0, 46)), hole: { type: "rectangle", x: 12, y: 10, w: 46, h: 26 } };
    case "circle":
      return { shape: circle("full"), hole: null };
    case "semicircle":
      return { shape: circle("semicircle", { radiusMm: 32 }), hole: null };
    case "quarter":
      return { shape: circle("quarter", { radiusMm: 40 }), hole: null };
    case "sector":
      return { shape: circle("sector", { radiusMm: 38 }), hole: null };
  }
}
export function blank(p: Preset = "rectangle"): Envelope {
  const { shape, hole } = presetShape(p);
  return { kind: "area", schemaVersion: 1, rendererVersion: "area-1", document: { shape, hole, shaded: hole ? "shape" : "none", labels: [], names: [], grid: false, notToScale: true } };
}
/** A starting diagram for each preset, with typical labels. */
export function starter(p: Preset = "l-shape"): Envelope {
  const e = blank(p),
    d = e.document;
  const v = (id: string, text: string) => label(id, text, "value");
  const labels: Record<Preset, Label[]> = {
    rectangle: [v("e1", "12 cm"), v("e2", "7 cm")],
    "l-shape": [v("e1", "12 cm"), v("e2", "5 cm"), v("e3", "7 cm"), v("e6", "10 cm")],
    "t-shape": [v("e1", "4 cm"), v("e2", "6 cm"), v("e5", "13 cm"), v("e4", "4 cm")],
    "u-shape": [v("e1", "14 cm"), v("e2", "9 cm"), v("e5", "5 cm"), v("e8", "9 cm")],
    triangle: [v("e1", "16 cm"), v("h1", "10 cm")],
    parallelogram: [v("e1", "11 cm"), v("h1", "6 cm")],
    trapezium: [v("e1", "14 cm"), v("e3", "8 cm"), v("h1", "7 cm")],
    house: [v("e1", "10 cm"), v("e2", "6 cm")],
    "rectangle-semicircle": [v("e1", "10 cm"), v("e4", "7 cm")],
    "rectangle-cut": [v("e1", "16 cm"), v("e2", "10 cm"), v("e4", "8 cm")],
    frame: [v("e1", "20 cm"), v("e2", "13 cm"), v("hw", "14 cm"), v("hh", "7 cm")],
    circle: [v("r", "6 cm")],
    semicircle: [v("d", "12 cm")],
    quarter: [v("r", "8 cm")],
    sector: [v("r", "9 cm"), v("angle", "110°")],
  };
  d.labels = labels[p];
  return validate(e);
}
export const create = () => starter("l-shape");

/* ---------- Text ---------- */

const EXTRA_ADVANCE: Record<string, number> = { "(": 0.333, ")": 0.333, "+": 0.564, "=": 0.564, "°": 0.4, _: 0.5, "²": 0.33, "³": 0.33, π: 0.55, ".": 0.25, "·": 0.25 };
const advance = (c: string, italic: boolean) => EXTRA_ADVANCE[c] ?? glyphAdvance(c, italic);
/** A run of printed text: a fraction prints stacked, numerator over denominator. */
type Run = { text: string; italic: boolean } | { top: string; bottom: string };
const UNIT_LETTERS = new Set(["m", "g", "l"]);
/** Maths text: single letters italic (not units after a number), a true minus sign, ^2 as ², a/b stacked. */
export function runs(t: string): Run[] {
  const typed = t
    .replace(/\^2/g, "²")
    .replace(/\^3/g, "³")
    .replace(/(^|[\s(=+])-/g, "$1−")
    .replace(/ - /g, " − ")
    .replace(/(?<![A-Za-z])pi(?![A-Za-z])/g, "π");
  const out: Run[] = [];
  const push = (text: string, italic: boolean) => {
    const last = out[out.length - 1];
    if (last && "text" in last && last.italic === italic) last.text += text;
    else out.push({ text, italic });
  };
  const re = /(\d+)\/(\d+)|[A-Za-z]+|[^A-Za-z\d]+|\d+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(typed))) {
    if (m[1] !== undefined) out.push({ top: m[1], bottom: m[2] });
    else if (/^[A-Za-z]+$/.test(m[0])) {
      const before = typed.slice(0, m.index).trimEnd();
      const unitAfterNumber = UNIT_LETTERS.has(m[0]) && /[\d²]$/.test(before);
      push(m[0], m[0].length === 1 && !unitAfterNumber);
    } else push(m[0], false);
  }
  return out;
}
const runWidth = (r: Run, font: number): number =>
  "text" in r ? [...r.text].reduce((w, c) => w + advance(c, r.italic), 0) * font : Math.max(runWidth({ text: r.top, italic: false }, font), runWidth({ text: r.bottom, italic: false }, font)) + 0.8;
export const textWidth = (t: string, font: number) => runs(t).reduce((s, r) => s + runWidth(r, font), 0);
/** Text height: a stacked fraction needs room for two lines. */
export const textHeight = (t: string, font: number) => (runs(t).some((r) => "top" in r) ? font * 2.3 : font * 1.05);
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const n = (v: number) => String(Math.round(v * 1000) / 1000);
const FAMILY = "STIX Two Text,STIX Two Math,serif";
/** Centred maths text at (x, cy), where cy is the vertical middle of the text. */
function textSvg(t: string, x: number, cy: number, font: number, fill = "black") {
  const parts = runs(t),
    total = parts.reduce((s, r) => s + runWidth(r, font), 0);
  let left = x - total / 2;
  const out: string[] = [];
  const base = cy + font * 0.34;
  for (const r of parts) {
    const w = runWidth(r, font);
    if ("text" in r) {
      out.push(`<text x="${n(left)}" y="${n(base)}" font-family="${FAMILY}" font-size="${n(font)}"${r.italic ? ' font-style="italic"' : ""} fill="${fill}">${esc(r.text)}</text>`);
    } else {
      const mid = left + w / 2;
      out.push(
        `<text x="${n(mid)}" y="${n(cy - font * 0.28)}" text-anchor="middle" font-family="${FAMILY}" font-size="${n(font)}" fill="${fill}">${esc(r.top)}</text>`,
        `<path d="M${n(left + 0.2)} ${n(cy)}H${n(left + w - 0.2)}" stroke="${fill}" stroke-width="0.25"/>`,
        `<text x="${n(mid)}" y="${n(cy + font * 0.98)}" text-anchor="middle" font-family="${FAMILY}" font-size="${n(font)}" fill="${fill}">${esc(r.bottom)}</text>`,
      );
    }
    left += w;
  }
  return out.join("");
}
const LINE_TEXT = "______";
/** A centre angle prints with a degree sign: 110 → 110°, 2x → 2x°. */
export function degrees(t: string) {
  const s = t.trim();
  if (!s || s.includes("°")) return s;
  return /\S\s*[+\-−]\s*\S/.test(s) ? `(${s})°` : `${s}°`;
}
/** What a label prints on one copy, and whether it is in the answer colour. Empty text prints nothing. */
export function printed(l: Label, view: View): { text: string; answer: boolean } {
  const fmt = (t: string) => (l.id === "angle" ? degrees(t) : t);
  if (view === "answer" && l.state !== "value" && l.answer) return { text: fmt(l.answer), answer: true };
  if (l.state === "value") return { text: fmt(l.text), answer: false };
  if (l.state === "symbol") return { text: fmt(l.text), answer: false };
  if (l.state === "answer-line") return { text: LINE_TEXT, answer: false };
  return { text: "", answer: false };
}

/* ---------- Teacher notes: lengths that cannot all be right ---------- */

/** A plain number at the start of a label ("12 cm" → 12), or null for algebra, letters and blanks. */
function known(l: Label | undefined): number | null {
  if (!l) return null;
  const t = l.state === "value" ? l.text : l.answer;
  const m = /^(\d+(?:\.\d+)?)\s*(?:mm|cm|m|km|°)?$/.exec(t.trim());
  return m ? Number(m[1]) : null;
}
const close = (a: number, b: number) => Math.abs(a - b) < 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
export function lengthNotes(d: AreaDocument): string[] {
  const notes: string[] = [];
  const by = new Map(d.labels.map((l) => [l.id, l]));
  const s = d.shape;
  if (s.type === "polygon") {
    const c = s.corners,
      k = c.length;
    const sides = c.map((a, i) => sub(c[(i + 1) % k], a));
    const rectilinear = s.arcs.every((a) => a === "none") && sides.every((v) => Math.abs(v.x) < 1e-6 || Math.abs(v.y) < 1e-6);
    if (rectilinear)
      for (const axis of ["x", "y"] as const) {
        // Going round the shape, the sides one way must add up to the sides the other way.
        let total = 0;
        const unknown: number[] = [];
        sides.forEach((v, i) => {
          if (Math.abs(v[axis]) < 1e-6) return;
          const sign = Math.sign(v[axis]),
            value = known(by.get(`e${i + 1}`));
          if (value === null) unknown.push(sign);
          else total += sign * value;
        });
        const what = axis === "x" ? "across" : "up and down";
        if (!unknown.length && !close(total, 0)) notes.push(`The sides going ${what} do not match: one way they add to ${Math.abs(total)} more than the other.`);
        if (unknown.length && unknown.every((sg) => sg === unknown[0]) && unknown[0] * -total <= 1e-9)
          notes.push(`The sides going ${what} cannot fit: the missing ${unknown.length > 1 ? "sides" : "side"} would have to be ${close(total, 0) ? "zero" : "negative"}.`);
      }
  } else {
    const r = known(by.get("r")),
      r2 = known(by.get("r2"));
    if (r !== null && r2 !== null && !close(r, r2)) notes.push(`The two radii are ${r} and ${r2}, but they should be equal.`);
    const a = known(by.get("angle"));
    if (s.part === "quarter" && a !== null && a !== 90) notes.push(`A quarter circle's angle is 90°, not ${a}°.`);
  }
  return notes;
}

/* ---------- Layout ---------- */

const MARGIN = 2;
const CAPTION = "Diagram NOT accurately drawn";
type Rect = { x: number; y: number; w: number; h: number };
export type Placed = { id: string; box: Rect; centre: P; clear: boolean };
export type Layout = {
  width: number;
  height: number;
  font: number;
  /** Maps a figure point (mm, y up) to the artwork (mm, y down). */
  map: (p: P) => P;
  geometry: Geometry;
  labels: Placed[];
  names: { id: string; text: string; centre: P }[];
  caption: P | null;
  grid: { minX: number; maxX: number; minY: number; maxY: number } | null;
  issues: string[];
  notes: string[];
};

function hitsSegment(r: Rect, a: P, b: P) {
  const dx = b.x - a.x,
    dy = b.y - a.y;
  let t0 = 0,
    t1 = 1;
  for (const [p, q] of [
    [-dx, a.x - r.x],
    [dx, r.x + r.w - a.x],
    [-dy, a.y - r.y],
    [dy, r.y + r.h - a.y],
  ]) {
    if (Math.abs(p) < 1e-12) {
      if (q < 0) return false;
    } else {
      const t = q / p;
      if (p < 0) t0 = Math.max(t0, t);
      else t1 = Math.min(t1, t);
      if (t0 > t1) return false;
    }
  }
  return true;
}
const overlaps = (a: Rect, b: Rect, gap = 0.6) => a.x + a.w + gap > b.x && b.x + b.w + gap > a.x && a.y + a.h + gap > b.y && b.y + b.h + gap > a.y;
const grow = (r: Rect, by: number): Rect => ({ x: r.x - by, y: r.y - by, w: r.w + 2 * by, h: r.h + 2 * by });
const boxAt = (c: P, w: number, h: number): Rect => ({ x: c.x - w / 2, y: c.y - h / 2, w, h });
const cornersOf = (r: Rect): P[] => [
  { x: r.x, y: r.y },
  { x: r.x + r.w, y: r.y },
  { x: r.x + r.w, y: r.y + r.h },
  { x: r.x, y: r.y + r.h },
];

/**
 * Places every label once, sized for the wider of its pupil and answers text, so both copies share
 * one layout. A label sits just clear of its side, line or arc, moving away from the shape until it
 * touches no line and no other label; the area label looks for the roomiest clear place inside.
 */
export function layout(e: Envelope): Layout {
  const d = e.document,
    font = ((d.fontPt ?? 11) * 25.4) / 72;
  const g = geometry(d);
  const slots = new Map(g.slots.map((s) => [s.id, s]));
  const issues: string[] = [];
  const lines = [...g.strokes, ...g.dashed];
  const placedBoxes: Rect[] = [];
  const labels: Placed[] = [];
  // The centre dot is kept clear like a label.
  if (g.centreDot) placedBoxes.push(boxAt(g.centreDot, 1.4, 1.4));
  const clearOf = (box: Rect) => !lines.some((s) => hitsSegment(grow(box, 0.5), s.a, s.b)) && !placedBoxes.some((p) => overlaps(p, box));
  // The area label first: it needs the most room. Then sides and lines in order.
  const order = [...d.labels].sort((a, b) => (a.id === "area" ? -1 : b.id === "area" ? 1 : 0));
  for (const l of order) {
    const slot = slots.get(l.id)!;
    const texts = [printed(l, "pupil").text, printed(l, "answer").text];
    const w = Math.max(...texts.map((t) => (t ? textWidth(t, font) : 0)));
    if (!w) {
      labels.push({ id: l.id, box: { x: slot.at.x, y: slot.at.y, w: 0, h: 0 }, centre: slot.at, clear: true });
      continue;
    }
    const h = Math.max(...texts.map((t) => (t ? textHeight(t, font) : 0)));
    let chosen: P | null = null;
    const fits = (c: P) => {
      const box = boxAt(c, w, h);
      if (!clearOf(box)) return false;
      // The area label stays inside the shape and out of the hole; the hole's labels stay inside the hole.
      if (l.id === "area") return cornersOf(box).every((p) => inside(g.outline, p) && !(g.holeOutline && inside(g.holeOutline, p)));
      if ((l.id === "hw" || l.id === "hh" || l.id === "hr") && g.holeOutline) return cornersOf(box).every((p) => inside(g.holeOutline!, p));
      return true;
    };
    if (!slot.away.length) {
      // Spiral out from the roomiest point.
      search: for (let r = 0; r < 30; r += 0.5)
        for (let k = 0; k < Math.max(1, Math.round(r * 2)); k++) {
          const c = add(slot.at, mul(dir((360 * k) / Math.max(1, Math.round(r * 2)) + 90), r));
          if (fits(c)) {
            chosen = c;
            break search;
          }
        }
    } else
      search: for (let dist = slot.from ?? 1.2; dist < 30 + (slot.from ?? 0); dist += 0.4)
        for (const u of slot.away)
          for (const slide of [0, 2, -2, 4, -4, 7, -7]) {
            // Slide along the side as well as away from it, so a crowded label still finds room nearby.
            const along = { x: -u.y, y: u.x };
            const c = add(add(slot.at, mul(u, dist + Math.abs(u.x) * w * 0.5 + Math.abs(u.y) * h * 0.5)), mul(along, slide));
            if (fits(c)) {
              chosen = c;
              break search;
            }
          }
    const clear = chosen !== null;
    if (!chosen) {
      const u = slot.away[0] ?? { x: 0, y: 1 };
      chosen = add(slot.at, mul(u, 2 + Math.max(w, h) / 2));
      issues.push(`The label on ${slot.name} (${l.id}) has no clear space. Make the shape larger or the label shorter.`);
    }
    const box = boxAt(chosen, w, h);
    placedBoxes.push(box);
    labels.push({ id: l.id, box, centre: chosen, clear });
  }
  const names: Layout["names"] = [];
  for (const nm of d.names) {
    const p = g.points[nm.id];
    const w = textWidth(nm.text, font),
      h = font * 1.05;
    let centre = add(p.at, mul(p.out, 1.5 + Math.max(w, h) / 2));
    for (let dist = 1.2; dist < 12; dist += 0.4) {
      const c = add(p.at, mul(p.out, dist + Math.abs(p.out.x) * w * 0.5 + Math.abs(p.out.y) * h * 0.5));
      const box = boxAt(c, w, h);
      if (lines.some((s) => hitsSegment(grow(box, 0.3), s.a, s.b)) || placedBoxes.some((q) => overlaps(q, box))) continue;
      centre = c;
      break;
    }
    placedBoxes.push(boxAt(centre, w, h));
    names.push({ id: nm.id, text: nm.text, centre });
  }
  // Bounds in y-up mm.
  const xs: number[] = [],
    ys: number[] = [];
  for (const s of lines) {
    xs.push(s.a.x, s.b.x);
    ys.push(s.a.y, s.b.y);
  }
  for (const b of placedBoxes)
    if (b.w) {
      xs.push(b.x, b.x + b.w);
      ys.push(b.y, b.y + b.h);
    }
  let grid: Layout["grid"] = null;
  if (d.grid) {
    // Whole 1 cm squares round the shape, with a square to spare, lined up with the shape's corners.
    const gx0 = Math.floor(Math.min(...xs) / GRID_MM) * GRID_MM - GRID_MM,
      gx1 = Math.ceil(Math.max(...xs) / GRID_MM) * GRID_MM + GRID_MM,
      gy0 = Math.floor(Math.min(...ys) / GRID_MM) * GRID_MM - GRID_MM,
      gy1 = Math.ceil(Math.max(...ys) / GRID_MM) * GRID_MM + GRID_MM;
    grid = { minX: gx0, maxX: gx1, minY: gy0, maxY: gy1 };
    xs.push(gx0, gx1);
    ys.push(gy0, gy1);
  }
  let minX = Math.min(...xs) - MARGIN,
    maxX = Math.max(...xs) + MARGIN;
  const minY = Math.min(...ys) - MARGIN,
    maxY = Math.max(...ys) + MARGIN;
  let height = maxY - minY;
  let caption: P | null = null;
  const captionFont = (MIN_TEXT_PT * 25.4) / 72;
  if (d.notToScale) {
    const w = textWidth(CAPTION, captionFont);
    if (maxX - minX < w + 2 * MARGIN) {
      const more = (w + 2 * MARGIN - (maxX - minX)) / 2;
      minX -= more;
      maxX += more;
    }
    caption = { x: maxX - minX - MARGIN - w / 2, y: height + captionFont * 0.9 };
    height += captionFont * 1.4;
  }
  const map = (p: P): P => ({ x: p.x - minX, y: maxY - p.y });
  const width = Math.ceil((maxX - minX) * 10) / 10;
  height = Math.ceil(height * 10) / 10;
  if (width > 270) issues.push(`The diagram is ${n(width / 10)} cm wide. Make it smaller.`);
  if (height > 270) issues.push(`The diagram is ${n(height / 10)} cm tall. Make it smaller.`);
  const notes = lengthNotes(d);
  if (d.grid && d.shape.type === "polygon" && d.shape.corners.some((c) => Math.abs(c.x / 5 - Math.round(c.x / 5)) > 1e-6 || Math.abs(c.y / 5 - Math.round(c.y / 5)) > 1e-6))
    notes.push("Some corners are not on the grid's half-centimetres, so squares cannot be counted exactly.");
  return { width, height, font, map, geometry: g, labels, names, caption, grid, issues, notes };
}
export const exportIssue = (e: Envelope) => layout(e).issues.join(" ") || null;
export const warnings = (e: Envelope) => {
  const g = layout(e);
  return [...g.issues, ...g.notes];
};

/* ---------- SVG ---------- */

const pathOf = (pts: P[], map: Layout["map"], close = true) =>
  pts.map((p, i) => {
    const q = map(p);
    return `${i ? "L" : "M"}${n(q.x)} ${n(q.y)}`;
  }).join("") + (close ? "Z" : "");

/** The artwork at its printed size in mm. The answers copy adds saved answers in the answer colour. */
export function renderSvg(e: Envelope, view: View = "pupil"): string {
  const d = validate(structuredClone(e)).document;
  const g = layout({ ...e, document: d });
  const map = g.map,
    geo = g.geometry;
  const out: string[] = [`<rect width="${n(g.width)}" height="${n(g.height)}" fill="white"/>`];
  if (g.grid) {
    const gl: string[] = [];
    for (let x = g.grid.minX; x <= g.grid.maxX + 1e-6; x += GRID_MM) {
      const a = map({ x, y: g.grid.minY }),
        b = map({ x, y: g.grid.maxY });
      gl.push(`M${n(a.x)} ${n(a.y)}V${n(b.y)}`);
    }
    for (let y = g.grid.minY; y <= g.grid.maxY + 1e-6; y += GRID_MM) {
      const a = map({ x: g.grid.minX, y }),
        b = map({ x: g.grid.maxX, y });
      gl.push(`M${n(a.x)} ${n(a.y)}H${n(b.x)}`);
    }
    out.push(`<path d="${gl.join("")}" fill="none" stroke="#a6a6a6" stroke-width="0.2"/>`);
  }
  // Shading first, under every line: grey prints in black and white.
  if (d.shaded === "shape") out.push(`<path d="${pathOf(geo.outline, map)}${geo.holeOutline ? pathOf(geo.holeOutline, map) : ""}" fill="#d9d9d9" fill-rule="evenodd" stroke="none"/>`);
  if (d.shaded === "hole" && geo.holeOutline) out.push(`<path d="${pathOf(geo.holeOutline, map)}" fill="#d9d9d9" stroke="none"/>`);
  const strokes = [pathOf(geo.outline, map), ...(geo.holeOutline ? [pathOf(geo.holeOutline, map)] : [])];
  // Lines that are not part of either outline: a circle's radius or diameter, a sector's radii and a hole's radius.
  const extra = geo.strokes.filter((s) => !onRing(s, geo.outline) && !(geo.holeOutline && onRing(s, geo.holeOutline)));
  out.push(`<path d="${strokes.join("")}${extra.map((s) => pathOf([s.a, s.b], map, false)).join("")}" fill="none" stroke="black" stroke-width="0.4" stroke-linejoin="round" stroke-linecap="round"/>`);
  if (geo.dashed.length) out.push(`<path d="${geo.dashed.map((s) => pathOf([s.a, s.b], map, false)).join("")}" fill="none" stroke="black" stroke-width="0.3" stroke-dasharray="1.6 1.2"/>`);
  const marks: string[] = [];
  for (const q of geo.squares) {
    const k = 3;
    marks.push(pathOf([add(q.at, mul(q.u, k)), add(add(q.at, mul(q.u, k)), mul(q.v, k)), add(q.at, mul(q.v, k))], map, false));
  }
  if (geo.angleArc) {
    const r = geo.angleArc.sweep < 30 ? 9 : 6;
    marks.push(pathOf(arcPoints({ x: 0, y: 0 }, r, geo.angleArc.start, geo.angleArc.sweep), map, false));
  }
  if (marks.length) out.push(`<path d="${marks.join("")}" fill="none" stroke="black" stroke-width="0.3" stroke-linejoin="round"/>`);
  if (geo.centreDot) {
    const c = map(geo.centreDot);
    out.push(`<circle cx="${n(c.x)}" cy="${n(c.y)}" r="0.7" fill="black"/>`);
  }
  const by = new Map(d.labels.map((l) => [l.id, l]));
  for (const l of g.labels) {
    const p = printed(by.get(l.id)!, view);
    if (!p.text) continue;
    const c = map(l.centre);
    out.push(textSvg(p.text, c.x, c.y, g.font, p.answer ? ANSWER_COLOUR : "black"));
  }
  for (const nm of g.names) {
    const c = map(nm.centre);
    // Point names are upright capitals, as on exam papers.
    out.push(`<text x="${n(c.x)}" y="${n(c.y + g.font * 0.34)}" text-anchor="middle" font-family="${FAMILY}" font-size="${n(g.font)}" fill="black">${esc(nm.text)}</text>`);
  }
  if (g.caption) out.push(`<text x="${n(g.caption.x)}" y="${n(g.caption.y)}" text-anchor="middle" font-family="${FAMILY}" font-size="${n((MIN_TEXT_PT * 25.4) / 72)}" fill="black">${CAPTION}</text>`);
  const body = boldLines(out.join(""), d.lines);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${n(g.width)}mm" height="${n(g.height)}mm" viewBox="0 0 ${n(g.width)} ${n(g.height)}" role="img" aria-label="${esc(altText(e))}">${body}</svg>`;
}
function onRing(s: { a: P; b: P }, ring: P[]) {
  const same = (p: P, q: P) => Math.abs(p.x - q.x) < 1e-9 && Math.abs(p.y - q.y) < 1e-9;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length];
    if ((same(a, s.a) && same(b, s.b)) || (same(a, s.b) && same(b, s.a))) return true;
  }
  return false;
}

/** Plain description of the pupil copy; it never names a saved answer. */
export function altText(e: Envelope): string {
  const d = e.document,
    s = d.shape;
  let what: string;
  if (s.type === "circle") what = s.part === "sector" ? `a sector of a circle` : s.part === "full" ? "a circle" : `a ${PART_NAMES[s.part].toLowerCase()}`;
  else {
    const out = s.arcs.filter((a) => a === "out").length,
      cut = s.arcs.filter((a) => a === "in").length;
    what = `a shape with ${s.corners.length} corners`;
    if (out) what += ` and ${out === 1 ? "a semicircle" : `${out} semicircles`} on its sides`;
    if (cut) what += `${out ? "," : ""} ${cut === 1 ? "a semicircle" : `${cut} semicircles`} cut out`;
  }
  if (d.hole) what += d.hole.type === "circle" ? " with a circle inside" : " with a rectangle inside";
  const given = d.labels.filter((l) => l.state === "value").map((l) => printed(l, "pupil").text);
  const letters = d.labels.filter((l) => l.state === "symbol").map((l) => l.text);
  const parts = [`Area and perimeter diagram: ${what}`];
  if (d.shaded !== "none") parts.push(d.shaded === "hole" ? "the inner shape shaded" : "shaded");
  if (given.length) parts.push(`given ${given.join(", ")}`);
  if (letters.length) parts.push(`marked ${letters.join(", ")}`);
  if (d.grid) parts.push("on a centimetre grid");
  return parts.join("; ") + (d.notToScale ? ". Not accurately drawn." : ".");
}

/* ---------- Links ---------- */

export const MAX_LINK_LENGTH = 16_000;
export const LINK_PREFIX = "#area=";
export const linkHash = (e: Envelope): string => LINK_PREFIX + envelope.encodeLink(e);
/** The website editor link, or null when the diagram is too large for a link. */
export function editorLink(e: Envelope, base: string): string | null {
  const url = new URL(base);
  url.pathname = url.pathname.replace(/(\/tools(\/[^/]*)?)?\/?$/, "/") + "tools/area";
  url.search = "";
  url.hash = linkHash(e);
  return url.href.length <= MAX_LINK_LENGTH ? url.href : null;
}
export function decodeLinkHash(hashText: string): Envelope {
  if (!/^#area=[A-Za-z0-9_-]+$/.test(hashText) || hashText.length > MAX_LINK_LENGTH) throw Error("This is not a supported area and perimeter link. Open an editable file instead.");
  try {
    return envelope.decodeLink(hashText.slice(LINK_PREFIX.length), MAX_LINK_LENGTH);
  } catch {
    throw Error("This area and perimeter link could not be read. Open an editable file instead.");
  }
}

/* ---------- Editor helpers ---------- */

/** Where the editor puts each label place's select button: on the label if it has one, else at the place (artwork mm). */
export function hitAnchors(e: Envelope, g: Layout = layout(e)): { id: string; name: string; at: P }[] {
  const
    placed = new Map(g.labels.map((l) => [l.id, l]));
  return g.geometry.slots.map((s) => {
    const l = placed.get(s.id);
    const at = l && l.box.w ? l.centre : s.away[0] && !s.inside ? add(s.at, mul(s.away[0], 3)) : s.at;
    return { id: s.id, name: s.name, at: g.map(at) };
  });
}

/** Stretches a polygon (and its hole) across and up, about its bottom-left corner, keeping labels. */
export function stretch(d: AreaDocument, kx: number, ky: number): AreaDocument {
  const n = structuredClone(d);
  if (n.shape.type !== "polygon") return n;
  const r = (v: number) => Math.round(v * 10) / 10;
  const x0 = Math.min(...n.shape.corners.map((c) => c.x)),
    y0 = Math.min(...n.shape.corners.map((c) => c.y));
  const at = (x: number, y: number) => ({ x: r(x0 + (x - x0) * kx), y: r(y0 + (y - y0) * ky) });
  n.shape.corners = n.shape.corners.map((c) => at(c.x, c.y));
  if (n.hole?.type === "rectangle") n.hole = { ...n.hole, ...at(n.hole.x, n.hole.y), w: r(n.hole.w * kx), h: r(n.hole.h * ky) };
  if (n.hole?.type === "circle") n.hole = { ...n.hole, ...at(n.hole.x, n.hole.y), r: r(n.hole.r * Math.min(kx, ky)) };
  return n;
}
/** A hole that fits: centred on the roomiest place inside the shape, well clear of its sides. */
export function holeFor(d: AreaDocument, type: Hole["type"]): Hole {
  const g = geometry({ ...d, hole: null, shaded: d.shaded === "hole" ? "none" : d.shaded, labels: [] });
  const c = interiorPoint(g.outline, null);
  let clear = Infinity;
  for (let k = 0; k < g.outline.length; k++) clear = Math.min(clear, segmentDistance(c, g.outline[k], g.outline[(k + 1) % g.outline.length]));
  const r = (v: number) => Math.round(v * 10) / 10;
  if (type === "circle") return { type, x: r(c.x), y: r(c.y), r: r(Math.max(2, clear * 0.6)) };
  const half = Math.max(2, clear * 0.55);
  return { type, x: r(c.x - half), y: r(c.y - half), w: r(2 * half), h: r(2 * half) };
}
/** The polygon's width and height in mm. */
export function extent(s: Polygon) {
  const xs = s.corners.map((c) => c.x),
    ys = s.corners.map((c) => c.y);
  return { width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) };
}
