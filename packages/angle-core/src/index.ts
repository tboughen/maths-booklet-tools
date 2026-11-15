/**
 * Angle diagrams (improvement list G-1, G-2, G-3): angles on a straight line, angles round a point,
 * crossing lines (vertically opposite angles), parallel lines cut by one or two transversals (with
 * optional Z, F and C shapes), polygons with interior and exterior angles, and regular polygons meeting
 * at a corner.
 *
 * The document is a figure (one of five kinds, set by a few numbers) plus the angles a teacher marks
 * on it. Every angle the figure makes has a stable slot ID (s1, s2 ... between rays; p1-ur ... at the
 * parallel-line crossings; i1, e1 ... at polygon vertices). An angle that is not listed is not marked.
 *
 * Labels use the triangle tool's five states: value (a given size, such as 62 or 2x + 10, printed
 * with a degree sign), symbol (a letter such as x, printed as typed), blank (an arc and nothing
 * else), answer-line and hidden (nothing printed). A saved answer prints only on the answers copy,
 * in the house answer colour, in place of the label. Nothing is calculated or filled in.
 *
 * The drawing is never forced to match the numbers: "Diagram NOT accurately drawn" stays honest,
 * and given sizes that cannot all be right raise a teacher-only note.
 */
import { z } from "zod";
import { aboutShape } from "../../envelope-core/src/about";
import { defineEnvelope } from "../../envelope-core/src/index";
import { ANSWER_COLOUR } from "../../envelope-core/src/answer-state";
import { boldLines, LINE_WEIGHTS, MIN_TEXT_PT } from "../../envelope-core/src/house-style";
import { glyphAdvance } from "../../ratio-table-core/src/font-metrics";

/** The drawing rules version this core writes and reads: the one source for schemas, guides and the connector (M19). */
export const RENDERER_VERSION = "angles-1" as const;

export { ANSWER_COLOUR };
export const FIGURES = ["straight-line", "point", "crossing", "parallel", "polygon", "polygons"] as const;
export type FigureKind = (typeof FIGURES)[number];
export const FIGURE_NAMES: Record<FigureKind, string> = {
  "straight-line": "Straight line",
  point: "Round a point",
  crossing: "Crossing lines",
  parallel: "Parallel lines",
  polygon: "Polygon",
  polygons: "Polygons meeting",
};
export const MARKS = ["none", "arc", "double", "triple", "right"] as const;
export type Mark = (typeof MARKS)[number];
export const STATES = ["value", "symbol", "blank", "answer-line", "hidden"] as const;
export type LabelState = (typeof STATES)[number];
export const MIN_SIDES = 3;
export const MAX_SIDES = 10;
export const MAX_LABEL = 24;

const plain = (max: number) =>
  z
    .string()
    .max(max)
    .refine((s) => ![...s].some((c) => c.charCodeAt(0) < 32 || c === "<" || c === ">" || c === "&"), "Use ordinary text without markup.");
const slotId = z.string().regex(/^[a-z][a-z0-9-]{0,11}$/);
const direction = z.number().finite().min(0).max(360);
const point = z.object({ x: z.number().finite().min(-200).max(200), y: z.number().finite().min(-200).max(200) }).strict();

export const labelSchema = z
  .object({
    state: z.enum(STATES),
    /** What pupils see: a size for value ("62", "2x + 10"), a letter for symbol ("x"). */
    text: plain(MAX_LABEL),
    /** The saved answer, printed only on the answers copy. Empty means none. */
    answer: plain(MAX_LABEL),
  })
  .strict();
export const angleSchema = z
  .object({ id: slotId, label: labelSchema, mark: z.enum(MARKS), shade: z.boolean() })
  .strict();
export const nameSchema = z.object({ id: slotId, text: plain(3) }).strict();
export const figureSchema = z.discriminatedUnion("type", [
  /** Rays from a point on a straight line, above it: directions between 0 and 180 degrees. */
  z.object({ type: z.literal("straight-line"), rays: z.array(direction).min(1).max(5) }).strict(),
  /** Rays round a point, anticlockwise from the right. */
  z.object({ type: z.literal("point"), rays: z.array(direction).min(2).max(8) }).strict(),
  /** Two or three straight lines through one point, by direction (0 to 180). */
  z.object({ type: z.literal("crossing"), lines: z.array(direction).min(2).max(3) }).strict(),
  /**
   * Two or three parallel lines (with arrow marks) cut by a transversal at crossDeg. A second
   * transversal, at its own angle, crosses the top line offsetMm to the right of the first (negative
   * to the left); the two may meet between the lines, outside them, or not in the drawing at all.
   */
  z
    .object({
      type: z.literal("parallel"),
      count: z.union([z.literal(2), z.literal(3)]),
      gapMm: z.number().finite().min(12).max(50),
      crossDeg: z.number().finite().min(20).max(160),
      arrows: z.number().int().min(0).max(3),
      second: z.object({ crossDeg: z.number().finite().min(20).max(160), offsetMm: z.number().finite().min(-80).max(80) }).strict().optional(),
    })
    .strict(),
  /**
   * A convex polygon. Regular polygons are drawn from the number of sides; an irregular one keeps
   * its own corners (in mm, anticlockwise). exterior lists the corners (1 to n) whose incoming side
   * is extended to show an exterior angle; diagonals draws dashed lines from corner 1.
   */
  z
    .object({
      type: z.literal("polygon"),
      sides: z.number().int().min(MIN_SIDES).max(MAX_SIDES),
      corners: z.array(point).min(MIN_SIDES).max(MAX_SIDES).nullable(),
      exterior: z.array(z.number().int().min(1).max(MAX_SIDES)).max(MAX_SIDES),
      diagonals: z.boolean(),
      /** Equal-side ticks (0 to 3) on each side, side 1 running from corner 1 to corner 2. */
      ticks: z.array(z.number().int().min(0).max(3)).min(MIN_SIDES).max(MAX_SIDES),
    })
    .strict(),
  /**
   * Two or three regular polygons round one shared corner, each sharing a side with the next,
   * anticlockwise; any space left at the corner is the gap angle. ticks marks every side alike.
   */
  z
    .object({
      type: z.literal("polygons"),
      sides: z.array(z.number().int().min(MIN_SIDES).max(MAX_SIDES)).min(2).max(3),
      ticks: z.number().int().min(0).max(3),
    })
    .strict(),
]);
/** A Z, F or C shape drawn over parallel lines, picked by the pair of angles it shows. */
export const letterSchema = z.object({ a: slotId, b: slotId }).strict();
export const documentSchema = z
  .object({
    figure: figureSchema,
    angles: z.array(angleSchema).max(40),
    /** Letters printed beside points (A, B, C ...), by point ID. */
    names: z.array(nameSchema).max(30),
    /** Z, F and C shapes over parallel lines (at most 3). Left out when there are none. */
    letters: z
      .array(letterSchema)
      .max(3)
      .transform((v) => (v.length ? v : undefined))
      .optional(),
    /** Turns the whole figure anticlockwise, in degrees. */
    turnDeg: z.number().finite().min(0).max(359),
    /** Overall size: the straight line's length, the rays' reach doubled, the parallel lines' length or the polygon's width. */
    sizeMm: z.number().finite().min(30).max(140),
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
  .object({ kind: z.literal("angles"), schemaVersion: z.literal(1), rendererVersion: z.literal(RENDERER_VERSION), document: documentSchema, ...aboutShape })
  .strict();
export type Envelope = z.infer<typeof envelopeSchema>;
export type AngleDocument = Envelope["document"];
export type Figure = AngleDocument["figure"];
export type Angle = z.infer<typeof angleSchema>;
export type Label = z.infer<typeof labelSchema>;
export type View = "pupil" | "answer";
export type P = { x: number; y: number };

export const label = (text = "", state: LabelState = text ? "value" : "blank", answer = ""): Label => ({ state, text, answer });
export const angle = (id: string, l: Label = label(), mark: Mark = "arc", shade = false): Angle => ({ id, label: l, mark, shade });

/* ---------- Geometry ---------- */

const rad = (deg: number) => (deg * Math.PI) / 180;
const dir = (deg: number): P => ({ x: Math.cos(rad(deg)), y: Math.sin(rad(deg)) });
const add = (a: P, b: P): P => ({ x: a.x + b.x, y: a.y + b.y });
const sub = (a: P, b: P): P => ({ x: a.x - b.x, y: a.y - b.y });
const mul = (a: P, s: number): P => ({ x: a.x * s, y: a.y * s });
const len = (a: P) => Math.hypot(a.x, a.y);
const heading = (a: P) => {
  const d = (Math.atan2(a.y, a.x) * 180) / Math.PI;
  return d < 0 ? d + 360 : d;
};
const norm = (deg: number) => ((deg % 360) + 360) % 360;
const ccw = (from: number, to: number) => {
  const s = norm(to - from);
  return s === 0 ? 360 : s;
};

export type Segment = { a: P; b: P; dashed?: boolean; arrows?: number; ticks?: number; arrowAt?: number };
export type ParallelFigure = Extract<Figure, { type: "parallel" }>;
/** An angle the figure makes: at vertex, from direction start, sweeping anticlockwise. */
export type Slot = { id: string; vertex: P; start: number; sweep: number; name: string };
/** highlights: the Z, F and C shapes, as straight pieces drawn thick and grey under the lines. */
export type Geometry = { segments: Segment[]; points: Record<string, { at: P; out: P }>; slots: Slot[]; highlights: [P, P][] };

/** Directions for a straight line, a point or crossing lines, sorted, with their slots between. */
function rayGeometry(rays: number[], reach: number, line: boolean): Geometry {
  const o = { x: 0, y: 0 };
  const sorted = [...rays].sort((a, b) => a - b);
  const segments: Segment[] = [];
  const points: Geometry["points"] = { o: { at: o, out: dir(line ? 270 : 0) } };
  if (line) {
    segments.push({ a: mul(dir(180), reach), b: mul(dir(0), reach) });
    points.left = { at: mul(dir(180), reach), out: dir(180) };
    points.right = { at: mul(dir(0), reach), out: dir(0) };
  }
  sorted.forEach((r, i) => {
    segments.push({ a: o, b: mul(dir(r), reach) });
    points[`r${i + 1}`] = { at: mul(dir(r), reach), out: dir(r) };
  });
  const bounds = line ? [0, ...sorted, 180] : sorted;
  const count = line ? bounds.length - 1 : bounds.length;
  const slots: Slot[] = [];
  for (let i = 0; i < count; i++) {
    const start = bounds[i],
      end = line ? bounds[i + 1] : bounds[(i + 1) % bounds.length];
    slots.push({ id: `s${i + 1}`, vertex: o, start, sweep: line ? end - start : ccw(start, end), name: `angle ${i + 1}` });
  }
  // Round a point, the vertex's name goes in the widest angle.
  if (!line) {
    const wide = slots.reduce((best, s) => (s.sweep > best.sweep ? s : best));
    points.o.out = dir(wide.start + wide.sweep / 2);
  }
  return { segments, points, slots, highlights: [] };
}

export const POSITIONS = ["ur", "ul", "ll", "lr"] as const;
const POSITION_NAMES: Record<(typeof POSITIONS)[number], string> = { ur: "above right", ul: "above left", ll: "below left", lr: "below right" };

/** Corners of a polygon figure in mm, anticlockwise, before the figure is turned. */
export function polygonCorners(f: Extract<Figure, { type: "polygon" }>, sizeMm: number): P[] {
  if (f.corners) return f.corners;
  const n = f.sides,
    r = sizeMm / 2;
  // The bottom side is horizontal, as polygons are usually printed.
  return Array.from({ length: n }, (_, k) => mul(dir(-90 - 180 / n + (k * 360) / n), r));
}
/** A pleasant irregular convex starting shape for n corners, at about the regular size. */
export function irregularCorners(n: number, sizeMm: number): P[] {
  const wobble = [0.18, -0.12, 0.1, -0.16, 0.14, -0.08, 0.12, -0.14, 0.08, -0.1];
  const r = sizeMm / 2;
  return Array.from({ length: n }, (_, k) => {
    const a = -90 - 180 / n + (k * 360) / n + wobble[k] * (180 / n);
    const scale = 1 + wobble[(k + 3) % wobble.length] * 0.6;
    return { x: Math.round(Math.cos(rad(a)) * r * scale * 10) / 10, y: Math.round(Math.sin(rad(a)) * r * scale * 10) / 10 };
  });
}

/** The figure's lines, points and angle slots in mm (y up), before it is turned. */
function rawGeometry(d: AngleDocument): Geometry {
  const f = d.figure,
    size = d.sizeMm;
  if (f.type === "straight-line") return rayGeometry(f.rays, size / 2, true);
  if (f.type === "point") return rayGeometry(f.rays, size / 2, false);
  if (f.type === "crossing") {
    const g = rayGeometry([...f.lines, ...f.lines.map((l) => l + 180)].map(norm), size / 2, false);
    // Draw each line once, end to end, so it reads as a straight line.
    g.segments = f.lines.map((l) => ({ a: mul(dir(l + 180), size / 2), b: mul(dir(l), size / 2) }));
    return g;
  }
  if (f.type === "parallel") return parallelGeometry(f, size, d.letters ?? []);
  if (f.type === "polygons") return polygonsGeometry(f, size);
  const c = polygonCorners(f, size),
    n = c.length;
  const segments: Segment[] = [],
    points: Geometry["points"] = {},
    slots: Slot[] = [];
  const centre = mul(c.reduce(add, { x: 0, y: 0 }), 1 / n);
  for (let k = 0; k < n; k++) {
    const v = c[k],
      next = c[(k + 1) % n],
      prev = c[(k + n - 1) % n];
    segments.push({ a: v, b: next, ticks: f.ticks[k] ?? 0 });
    points[`v${k + 1}`] = { at: v, out: unitOf(sub(v, centre)) };
    slots.push({ id: `i${k + 1}`, vertex: v, start: heading(sub(next, v)), sweep: ccw(heading(sub(next, v)), heading(sub(prev, v))), name: `interior angle ${k + 1}` });
    if (f.exterior.includes(k + 1)) {
      const out = unitOf(sub(v, prev)),
        reach = Math.max(12, size * 0.3);
      const end = add(v, mul(out, reach));
      segments.push({ a: v, b: end });
      points[`e${k + 1}`] = { at: end, out };
      slots.push({ id: `e${k + 1}`, vertex: v, start: heading(out), sweep: ccw(heading(out), heading(sub(next, v))), name: `exterior angle ${k + 1}` });
    }
  }
  if (f.diagonals) for (let k = 2; k < n - 1; k++) segments.push({ a: c[0], b: c[k], dashed: true });
  return { segments, points, slots, highlights: [] };
}

const cot = (deg: number) => Math.cos(rad(deg)) / Math.sin(rad(deg));
/** The parallel lines' heights, top line first. */
const lineYs = (f: ParallelFigure) => Array.from({ length: f.count }, (_, k) => ((f.count - 1) / 2 - k) * f.gapMm);
/** Meetings further than this beyond the outer lines are not drawn: the transversals are left apart. */
const MEET_REACH = 40;
/** Where the second transversal crosses each line, and where it meets the first (null when it does not in the drawing). */
export function secondTransversal(f: ParallelFigure): { crossDeg: number; xs: number[]; meet: P | null } | null {
  if (!f.second) return null;
  const ys = lineYs(f),
    c1 = cot(f.crossDeg),
    c2 = cot(f.second.crossDeg),
    top = ys[0];
  const xs = ys.map((y) => top * c1 + f.second!.offsetMm + (y - top) * c2);
  let meet: P | null = null;
  if (Math.abs(c1 - c2) > 1e-6) {
    const ym = top + f.second.offsetMm / (c1 - c2);
    if (ym <= top + MEET_REACH && ym >= ys[ys.length - 1] - MEET_REACH) meet = { x: ym * c1, y: ym };
  }
  return { crossDeg: f.second.crossDeg, xs, meet };
}

const POSITION_FIRST = POSITIONS;
function parallelGeometry(f: ParallelFigure, size: number, letters: { a: string; b: string }[]): Geometry {
  const segments: Segment[] = [],
    points: Geometry["points"] = {},
    slots: Slot[] = [];
  // Lines run left to right; line 1 is the top one. Each transversal crosses each line once; the
  // first one's crossings sit on a line through the origin.
  const ys = lineYs(f);
  const xs = ys.map((y) => y * cot(f.crossDeg));
  const two = secondTransversal(f);
  const allX = [...xs, ...(two?.xs ?? []), ...(two?.meet ? [two.meet.x] : [])];
  // The parallel lines always run on past every crossing, however steep the transversals.
  const half = Math.max(size / 2, Math.max(...allX.map(Math.abs)) + 15);
  // Arrow marks sit at the same place on every line, on the side with more room from the crossings.
  const room = half - Math.max(...allX),
    roomLeft = half + Math.min(...allX);
  const arrowX = room >= roomLeft ? (Math.max(...allX) + half) / 2 : (Math.min(...allX) - half) / 2;
  const crossing = (point: string, prefix: string, k: number, x: number, deg: number, which: string) => {
    const at = { x, y: ys[k] };
    points[point] = { at, out: dir(90 + deg / 2) };
    const rays = [0, deg, 180, 180 + deg];
    POSITION_FIRST.forEach((pos, i) =>
      slots.push({ id: `${prefix}${k + 1}-${pos}`, vertex: at, start: rays[i], sweep: ccw(rays[i], rays[(i + 1) % 4]), name: `line ${k + 1}, ${which}${POSITION_NAMES[pos]}` }),
    );
  };
  ys.forEach((y, k) => {
    segments.push({ a: { x: -half, y }, b: { x: half, y }, arrows: f.arrows, arrowAt: (arrowX + half) / (2 * half) });
    points[`l${k + 1}a`] = { at: { x: -half, y }, out: dir(180) };
    points[`l${k + 1}b`] = { at: { x: half, y }, out: dir(0) };
    crossing(`x${k + 1}`, "p", k, xs[k], f.crossDeg, two ? "first transversal, " : "");
    if (two) crossing(`y${k + 1}`, "q", k, two.xs[k], two.crossDeg, "second transversal, ");
  });
  // Each transversal runs on past its outer crossings (and past the meeting) far enough for angles to be marked.
  const ext = Math.max(14, f.gapMm * 0.6);
  const run = (txs: number[], deg: number, a: string, b: string) => {
    const u = dir(deg);
    const along = ys.map((y, k) => ({ x: txs[k], y }));
    if (two?.meet) along.push(two.meet);
    const proj = along.map((p) => p.x * u.x + p.y * u.y);
    const hi = along[proj.indexOf(Math.max(...proj))],
      lo = along[proj.indexOf(Math.min(...proj))];
    const top = add(hi, mul(u, ext)),
      bottom = add(lo, mul(u, -ext));
    segments.push({ a: bottom, b: top });
    points[a] = { at: bottom, out: mul(u, -1) };
    points[b] = { at: top, out: u };
  };
  run(xs, f.crossDeg, "ta", "tb");
  if (two) {
    run(two.xs, two.crossDeg, "ua", "ub");
    if (two.meet) {
      const dirs = [f.crossDeg, two.crossDeg, f.crossDeg + 180, two.crossDeg + 180].map(norm).sort((a, b) => a - b);
      dirs.forEach((start, i) => slots.push({ id: `m${i + 1}`, vertex: two.meet!, start, sweep: ccw(start, dirs[(i + 1) % 4]), name: `where the transversals meet, angle ${i + 1}` }));
      const wide = slots.slice(-4).reduce((best, x) => (x.sweep > best.sweep ? x : best));
      points.m = { at: two.meet, out: dir(wide.start + wide.sweep / 2) };
    }
  }
  // Z, F and C shapes: each angle's two arms, joined along the transversal.
  const highlights: Geometry["highlights"] = [];
  const bySlot = new Map(slots.map((x) => [x.id, x]));
  for (const pair of letters) {
    const shape = letterOf(pair.a, pair.b),
      sa = bySlot.get(pair.a),
      sb = bySlot.get(pair.b);
    if (!shape || !sa || !sb) continue;
    const [upper, lower] = sa.vertex.y > sb.vertex.y ? [pair.a, pair.b] : [pair.b, pair.a];
    const u = dir(pair.a.startsWith("q") && two ? two.crossDeg : f.crossDeg);
    const arm = (id: string) => {
      const x = bySlot.get(id)!,
        right = id.endsWith("r"),
        h = { x: right ? 1 : -1, y: 0 };
      const reach = Math.min(Math.max(10, Math.min(18, f.gapMm * 0.6)), (right ? half - x.vertex.x : x.vertex.x + half) - 3);
      highlights.push([x.vertex, add(x.vertex, mul(h, reach))]);
      return x;
    };
    const A = arm(upper),
      B = arm(lower);
    const along = [A.vertex, B.vertex];
    const reach = Math.min(Math.max(10, Math.min(18, f.gapMm * 0.6)), ext - 2);
    // The upper angle's transversal arm points up, away from the lower crossing, only above its line.
    if (/-u[lr]$/.test(upper)) along.push(add(A.vertex, mul(u, reach)));
    if (/-l[lr]$/.test(lower)) along.push(add(B.vertex, mul(u, -reach)));
    const proj = along.map((p) => p.x * u.x + p.y * u.y);
    highlights.push([along[proj.indexOf(Math.min(...proj))], along[proj.indexOf(Math.max(...proj))]]);
  }
  return { segments, points, slots, highlights };
}

/** Interior angle of a regular polygon with n sides. */
const interiorOf = (n: number) => 180 - 360 / n;
/** The space left round the shared corner of a polygons-meeting figure, in degrees (0 when they fit exactly). */
export function gapOf(f: Extract<Figure, { type: "polygons" }>) {
  const g = 360 - f.sides.reduce((a, n) => a + interiorOf(n), 0);
  return Math.abs(g) < 0.5 ? 0 : g;
}
function polygonsGeometry(f: Extract<Figure, { type: "polygons" }>, size: number): Geometry {
  const s = size * 0.32,
    o = { x: 0, y: 0 };
  const segments: Segment[] = [],
    points: Geometry["points"] = { o: { at: o, out: dir(270) } },
    slots: Slot[] = [];
  const gap = gapOf(f);
  let theta = 0;
  f.sides.forEach((sides, k) => {
    const turn = 360 / sides;
    const vs: P[] = [o];
    for (let j = 1; j < sides; j++) vs.push(add(vs[j - 1], mul(dir(theta + (j - 1) * turn), s)));
    const centre = mul(vs.reduce(add, { x: 0, y: 0 }), 1 / sides);
    // A polygon's last side is the next polygon's first side (and, with no gap, the first polygon's): drawn once.
    const shared = k < f.sides.length - 1 || gap === 0;
    for (let j = 0; j < sides; j++) {
      if (j === sides - 1 && shared) continue;
      segments.push({ a: vs[j], b: vs[(j + 1) % sides], ticks: f.ticks });
    }
    slots.push({ id: `a${k + 1}`, vertex: o, start: norm(theta), sweep: interiorOf(sides), name: `shape ${k + 1} at the shared corner` });
    for (let j = 1; j < sides; j++) {
      const v = vs[j],
        next = vs[(j + 1) % sides],
        prev = vs[j - 1];
      if (!(j === sides - 1 && shared)) points[`p${k + 1}v${j + 1}`] = { at: v, out: unitOf(sub(v, centre)) };
      const start = heading(sub(next, v));
      slots.push({ id: `p${k + 1}-i${j + 1}`, vertex: v, start, sweep: ccw(start, heading(sub(prev, v))), name: `shape ${k + 1}, corner ${j + 1}` });
    }
    theta += interiorOf(sides);
  });
  if (gap > 0) {
    slots.push({ id: "g", vertex: o, start: norm(theta), sweep: gap, name: "the gap at the shared corner" });
    points.o.out = dir(theta + gap / 2);
  }
  return { segments, points, slots, highlights: [] };
}

/**
 * The shape a pair of angles at two crossings of the same transversal makes: Z for alternate, F for
 * corresponding, C for co-interior angles. Null for any other pair (same line, vertically opposite or
 * outside pairs).
 */
export function letterOf(a: string, b: string): { letter: "Z" | "F" | "C"; name: string } | null {
  const x = /^([pq])(\d)-(ur|ul|ll|lr)$/.exec(a),
    y = /^([pq])(\d)-(ur|ul|ll|lr)$/.exec(b);
  if (!x || !y || x[1] !== y[1] || x[2] === y[2]) return null;
  const [up, low] = Number(x[2]) < Number(y[2]) ? [x[3], y[3]] : [y[3], x[3]];
  if (up === low) return { letter: "F", name: "corresponding" };
  if (up[0] === "l" && low[0] === "u") return up[1] === low[1] ? { letter: "C", name: "co-interior" } : { letter: "Z", name: "alternate" };
  return null;
}
function unitOf(a: P): P {
  const l = len(a);
  return l ? mul(a, 1 / l) : { x: 1, y: 0 };
}

/** The figure in mm (y up), turned by turnDeg. */
export function geometry(d: AngleDocument): Geometry {
  const g = rawGeometry(d),
    turn = d.turnDeg;
  if (!turn) return g;
  const c = Math.cos(rad(turn)),
    s = Math.sin(rad(turn));
  const r = (p: P): P => ({ x: p.x * c - p.y * s, y: p.x * s + p.y * c });
  return {
    segments: g.segments.map((x) => ({ ...x, a: r(x.a), b: r(x.b) })),
    points: Object.fromEntries(Object.entries(g.points).map(([k, v]) => [k, { at: r(v.at), out: r(v.out) }])),
    slots: g.slots.map((x) => ({ ...x, vertex: r(x.vertex), start: norm(x.start + turn) })),
    highlights: g.highlights.map(([a, b]) => [r(a), r(b)] as [P, P]),
  };
}
/** Every angle slot of the figure, in order, with a teacher-facing name. */
export const slotsOf = (d: AngleDocument) => rawGeometry(d).slots.map(({ id, name, sweep }) => ({ id, name, sweep }));
export const pointIdsOf = (d: AngleDocument) => Object.keys(rawGeometry(d).points);

/* ---------- Validation ---------- */

function convex(c: P[]) {
  const n = c.length;
  let area = 0;
  for (let k = 0; k < n; k++) {
    const a = c[k],
      b = c[(k + 1) % n],
      e = c[(k + 2) % n];
    const cross = (b.x - a.x) * (e.y - b.y) - (b.y - a.y) * (e.x - b.x);
    if (cross <= 1e-9) return false;
    area += a.x * b.y - b.x * a.y;
  }
  return area > 0;
}

const f0 = (input: unknown) => (input as { document?: { figure?: { type?: unknown } } } | null)?.document?.figure?.type;
export function validate(input: unknown): Envelope {
  const parsed = envelopeSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue?.path ?? [];
    if (path.includes("rays")) throw Error("Use 1 to 5 rays above a straight line (0 to 180 degrees) or 2 to 8 rays round a point (0 to 360 degrees).");
    if (path.includes("lines") && path.includes("figure")) throw Error("Use 2 or 3 crossing lines, each a direction from 0 to 180 degrees.");
    if (path.includes("text") || path.includes("answer")) throw Error(`Use labels of at most ${MAX_LABEL} characters without markup.`);
    if (path.includes("corners") && path.length > 4) throw Error("Keep every corner within 200 mm of the centre.");
    if (path.includes("second")) throw Error("Give the second transversal an angle from 20 to 160° and an offset from -80 to 80 mm along the top line.");
    if (path.includes("letters")) throw Error("Use at most 3 Z, F or C shapes, each a pair of angles.");
    if (f0(input) === "polygons" && (path.includes("sides") || path.includes("ticks"))) throw Error(`Use 2 or 3 regular polygons, each with ${MIN_SIDES} to ${MAX_SIDES} sides, and 0 to 3 ticks.`);
    if (path.includes("sides") || path.includes("corners") || path.includes("ticks")) throw Error(`Use a polygon of ${MIN_SIDES} to ${MAX_SIDES} sides.`);
    if (path.includes("turnDeg")) throw Error("Turn the figure by 0 to 359 degrees.");
    if (path.includes("sizeMm")) throw Error("Choose a size from 30 to 140 mm.");
    throw Error(path.length ? `${path.join(".")}: ${issue.message}` : "This is not a supported angle diagram file (version 1 is supported).");
  }
  const e = parsed.data,
    d = e.document,
    f = d.figure;
  if (f.type === "straight-line" || f.type === "point" || f.type === "crossing") {
    const list = f.type === "crossing" ? f.lines : f.rays;
    if (f.type === "straight-line" && list.some((r) => r < 5 || r > 175)) throw Error("Rays above a straight line need directions from 5 to 175 degrees.");
    if (f.type === "crossing" && list.some((r) => r >= 180)) throw Error("Give each crossing line a direction from 0 to 179 degrees.");
    const all = f.type === "crossing" ? [...list, ...list.map((l) => l + 180)] : f.type === "straight-line" ? [0, ...list, 180] : list;
    const sorted = [...all].map(norm).sort((a, b) => a - b);
    for (let i = 0; i < sorted.length; i++) {
      const gap = i + 1 < sorted.length ? sorted[i + 1] - sorted[i] : f.type === "straight-line" ? 999 : sorted[0] + 360 - sorted[i];
      if (gap < 5) throw Error("Keep rays and lines at least 5 degrees apart so every angle can be seen.");
    }
  }
  if (f.type === "polygon") {
    if (f.ticks.length !== f.sides) throw Error(`Give tick marks for each of the ${f.sides} sides.`);
    if (f.corners && f.corners.length !== f.sides) throw Error(`An irregular polygon with ${f.sides} sides needs ${f.sides} corners.`);
    if (f.corners && !convex(f.corners)) throw Error("Give the corners of a convex polygon, anticlockwise.");
    if (f.exterior.some((k) => k > f.sides)) throw Error(`Exterior angles go at corners 1 to ${f.sides}.`);
    if (new Set(f.exterior).size !== f.exterior.length) throw Error("List each exterior-angle corner once.");
  }
  if (f.type === "polygons") {
    const total = f.sides.reduce((a, k) => a + interiorOf(k), 0);
    if (total > 360.5) throw Error(`These polygons overlap at the shared corner: their angles there add to ${Math.round(total * 10) / 10}°, more than 360°. Use fewer sides or fewer polygons.`);
    const gap = gapOf(f);
    if (gap > 0 && gap < 5) throw Error("The gap at the shared corner is too narrow to see. Change the polygons.");
  }
  if (f.type === "parallel" && f.second) {
    const two = secondTransversal(f)!,
      ys = lineYs(f),
      c1 = cot(f.crossDeg);
    ys.forEach((y, k) => {
      if (Math.abs(two.xs[k] - y * c1) < 6) throw Error(`The two transversals cross line ${k + 1} too close together. Move the second one along the top line or change its angle.`);
    });
    if (two.meet) {
      const k = ys.findIndex((y) => Math.abs(y - two.meet!.y) < 4);
      if (k >= 0) throw Error(`The transversals meet too close to line ${k + 1}. Move the second one so they meet clear of the lines.`);
    }
  }
  const slots = new Set(slotsOf(d).map((s) => s.id));
  const seen = new Set<string>();
  for (const a of d.angles) {
    if (!slots.has(a.id)) throw Error(`This figure has no angle ${a.id}. Its angles are ${[...slots].join(", ")}.`);
    if (seen.has(a.id)) throw Error(`Angle ${a.id} is listed twice.`);
    seen.add(a.id);
    const l = a.label;
    l.text = l.text.trim().replace(/\s+/g, " ");
    l.answer = l.answer.trim().replace(/\s+/g, " ");
    if (l.state === "value" && l.answer) throw Error(`Angle ${a.id} is a given size, so it cannot hold a saved answer. Clear the answer or change the label.`);
    if ((l.state === "value" || l.state === "symbol") && !l.text) throw Error(`Angle ${a.id} is ${l.state === "value" ? "a given size" : "a letter"} but has no text. Type it, or make the label blank.`);
  }
  if (d.letters) {
    if (f.type !== "parallel") throw Error("Z, F and C shapes go on parallel lines.");
    const pairs = new Set<string>();
    for (const l of d.letters) {
      for (const id of [l.a, l.b]) if (!slots.has(id)) throw Error(`This figure has no angle ${id} for a Z, F or C shape.`);
      if (!letterOf(l.a, l.b)) throw Error(`Angles ${l.a} and ${l.b} are not an alternate, corresponding or co-interior pair, so no Z, F or C shape fits them.`);
      const key = [l.a, l.b].sort().join(" ");
      if (pairs.has(key)) throw Error(`The shape for angles ${l.a} and ${l.b} is listed twice.`);
      pairs.add(key);
    }
  }
  const points = new Set(pointIdsOf(d));
  const named = new Set<string>();
  for (const nm of d.names) {
    if (!points.has(nm.id)) throw Error(`This figure has no point ${nm.id}. Its points are ${[...points].join(", ")}.`);
    if (named.has(nm.id)) throw Error(`Point ${nm.id} is named twice.`);
    named.add(nm.id);
    nm.text = nm.text.trim();
  }
  d.names = d.names.filter((nm) => nm.text);
  return e;
}
const envelope = defineEnvelope<Envelope>({ kind: "angles", validate, canonical: "sorted" });
export const canonical = envelope.canonical;
export const hash = envelope.contentHash;
export function parseFile(text: string) {
  if (text.length > 30_000) throw Error("This editable file is too large.");
  return validate(JSON.parse(text));
}

export const hasHidden = (e: Envelope) => e.document.angles.some((a) => a.label.state !== "value" && a.label.answer);

/** Keeps only the angles and names the figure still has, after a change of figure. */
export function prune(e: Envelope): Envelope {
  const n = structuredClone(e),
    slots = new Set(slotsOf(n.document).map((s) => s.id)),
    points = new Set(pointIdsOf(n.document));
  n.document.angles = n.document.angles.filter((a) => slots.has(a.id));
  n.document.names = n.document.names.filter((nm) => points.has(nm.id));
  const letters = n.document.figure.type === "parallel" ? (n.document.letters ?? []).filter((l) => slots.has(l.a) && slots.has(l.b) && letterOf(l.a, l.b)) : [];
  n.document.letters = letters.length ? letters : undefined;
  return n;
}

/* ---------- Building ---------- */

export function blank(figure: Figure = { type: "straight-line", rays: [62] }): Envelope {
  return { kind: "angles", schemaVersion: 1, rendererVersion: RENDERER_VERSION, document: { figure, angles: [], names: [], turnDeg: 0, sizeMm: 70, notToScale: true } };
}
/** A starting figure for each kind, with one given angle and one for pupils to find. */
export function starter(kind: FigureKind = "straight-line"): Envelope {
  const e = blank();
  const d = e.document;
  if (kind === "straight-line") {
    d.figure = { type: "straight-line", rays: [62] };
    d.angles = [angle("s1", label("62")), angle("s2", label("x", "symbol"))];
  } else if (kind === "point") {
    d.figure = { type: "point", rays: [20, 140, 250] };
    d.sizeMm = 60;
    d.angles = [angle("s1", label("120")), angle("s2", label("110")), angle("s3", label("x", "symbol"))];
  } else if (kind === "crossing") {
    d.figure = { type: "crossing", lines: [15, 70] };
    d.angles = [angle("s1", label("55")), angle("s3", label("x", "symbol"))];
  } else if (kind === "parallel") {
    d.figure = { type: "parallel", count: 2, gapMm: 24, crossDeg: 60, arrows: 1 };
    d.angles = [angle("p1-ur", label("60")), angle("p2-ul", label("x", "symbol"))];
  } else if (kind === "polygon") {
    d.figure = { type: "polygon", sides: 6, corners: null, exterior: [], diagonals: false, ticks: [1, 1, 1, 1, 1, 1] };
    d.sizeMm = 50;
    d.angles = [angle("i2", label("x", "symbol"))];
  } else {
    d.figure = { type: "polygons", sides: [5, 6], ticks: 1 };
    d.sizeMm = 60;
    d.angles = [angle("g", label("x", "symbol"))];
  }
  return validate(e);
}
export const create = () => starter("straight-line");

/* ---------- Text ---------- */

const EXTRA_ADVANCE: Record<string, number> = { "(": 0.333, ")": 0.333, "+": 0.564, "=": 0.564, "°": 0.4, "_": 0.5 };
const advance = (c: string, italic: boolean) => EXTRA_ADVANCE[c] ?? glyphAdvance(c, italic);
/** Maths text: letters italic, a true minus sign. */
function runs(t: string): { text: string; italic: boolean }[] {
  const out: { text: string; italic: boolean }[] = [];
  const typed = t.replace(/(^|[\s(=+])-/g, "$1−").replace(/ - /g, " − ");
  for (const c of typed) {
    const italic = /[A-Za-z]/.test(c);
    const last = out[out.length - 1];
    if (last && last.italic === italic) last.text += c;
    else out.push({ text: c, italic });
  }
  return out;
}
export const textWidth = (t: string, font: number) => runs(t).reduce((s, r) => s + [...r.text].reduce((w, c) => w + advance(c, r.italic), 0), 0) * font;
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const n = (v: number) => String(Math.round(v * 1000) / 1000);
function textSvg(t: string, x: number, y: number, font: number, fill = "black") {
  const body = runs(t)
    .map((r) => (r.italic ? `<tspan font-style="italic">${esc(r.text)}</tspan>` : esc(r.text)))
    .join("");
  return `<text x="${n(x)}" y="${n(y)}" text-anchor="middle" font-family="STIX Two Text,STIX Two Math,serif" font-size="${n(font)}" fill="${fill}">${body}</text>`;
}
/** A size as printed: 62 → 62°, 2x + 10 → (2x + 10)°, 3x → 3x°. Text that already has ° is kept. */
export function degrees(t: string) {
  const s = t.trim();
  if (!s || s.includes("°")) return s;
  return /\S\s*[+\-−]\s*\S/.test(s) ? `(${s})°` : `${s}°`;
}
const LINE_TEXT = "______°";
/** What a label prints on one copy, and the colour. Empty text prints nothing. */
export function printed(l: Label, view: View): { text: string; answer: boolean } {
  if (view === "answer" && l.state !== "value" && l.answer) return { text: degrees(l.answer), answer: true };
  if (l.state === "value") return { text: degrees(l.text), answer: false };
  if (l.state === "symbol") return { text: l.text, answer: false };
  if (l.state === "answer-line") return { text: LINE_TEXT, answer: false };
  return { text: "", answer: false };
}

/* ---------- Teacher notes: sizes that cannot all be right ---------- */

/** A plain number of degrees, or null for algebra, letters and blanks. */
function known(a: Angle | undefined): number | null {
  if (!a) return null;
  const t = a.label.state === "value" ? a.label.text : a.label.answer;
  const m = t.replace(/°/g, "").trim();
  return /^\d+(\.\d+)?$/.test(m) ? Number(m) : null;
}
export function sizeNotes(d: AngleDocument): string[] {
  const notes: string[] = [];
  const by = new Map(d.angles.map((a) => [a.id, a]));
  const slots = slotsOf(d);
  const sum = (ids: string[], total: number, what: string) => {
    const v = ids.map((id) => known(by.get(id)));
    if (v.every((x) => x !== null)) {
      const s = (v as number[]).reduce((a, b) => a + b, 0);
      if (Math.abs(s - total) > 1e-9) notes.push(`${what} add to ${s}°, not ${total}°.`);
    }
  };
  const equal = (a: string, b: string, what: string) => {
    const x = known(by.get(a)),
      y = known(by.get(b));
    if (x !== null && y !== null && x !== y) notes.push(`${what} are ${x}° and ${y}°, but they should be equal.`);
  };
  const f = d.figure;
  if (f.type === "straight-line") sum(slots.map((s) => s.id), 180, "The angles on the straight line");
  if (f.type === "point") sum(slots.map((s) => s.id), 360, "The angles round the point");
  if (f.type === "crossing") {
    sum(slots.map((s) => s.id), 360, "The angles round the crossing");
    const k = slots.length / 2;
    for (let i = 0; i < k; i++) equal(slots[i].id, slots[i + k].id, `Vertically opposite angles ${slots[i].id} and ${slots[i + k].id}`);
  }
  if (f.type === "parallel") {
    for (const [t, which] of f.second ? ([["p", " the first transversal"], ["q", " the second transversal"]] as const) : ([["p", " the transversal"]] as const)) {
      for (let k = 1; k <= f.count; k++) {
        sum([`${t}${k}-ur`, `${t}${k}-ul`], 180, `The angles on line ${k} above${which}`);
        equal(`${t}${k}-ur`, `${t}${k}-ll`, `Vertically opposite angles on line ${k}`);
        equal(`${t}${k}-ul`, `${t}${k}-lr`, `Vertically opposite angles on line ${k}`);
      }
      for (let k = 1; k < f.count; k++)
        for (const pos of POSITIONS) equal(`${t}${k}-${pos}`, `${t}${k + 1}-${pos}`, `Corresponding angles ${t}${k}-${pos} and ${t}${k + 1}-${pos}`);
    }
    if (slots.some((s) => s.id === "m1")) {
      sum(["m1", "m2", "m3", "m4"], 360, "The angles where the transversals meet");
      equal("m1", "m3", "Vertically opposite angles m1 and m3");
      equal("m2", "m4", "Vertically opposite angles m2 and m4");
    }
    for (const t of triangles(d)) sum(t.ids, 180, `The angles of the triangle between line ${t.line} and the transversals`);
  }
  if (f.type === "polygons") {
    sum([...f.sides.map((_, k) => `a${k + 1}`), ...(gapOf(f) > 0 ? ["g"] : [])], 360, "The angles at the shared corner");
    f.sides.forEach((sides, k) => sum([`a${k + 1}`, ...Array.from({ length: sides - 1 }, (_, j) => `p${k + 1}-i${j + 2}`)], (sides - 2) * 180, `The interior angles of shape ${k + 1} (${sides} sides)`));
  }
  if (f.type === "polygon") {
    const sides = f.corners?.length ?? f.sides;
    sum(Array.from({ length: sides }, (_, k) => `i${k + 1}`), (sides - 2) * 180, `The interior angles of this ${sides}-sided polygon`);
    for (const k of f.exterior) sum([`i${k}`, `e${k}`], 180, `The interior and exterior angles at corner ${k}`);
  }
  return [...new Set(notes)];
}

/**
 * The triangles two transversals make with the nearest parallel line on each side of where they
 * meet: for each, the line number and the three angle slots inside it.
 */
export function triangles(d: AngleDocument): { line: number; ids: string[] }[] {
  const f = d.figure;
  if (f.type !== "parallel") return [];
  const two = secondTransversal(f);
  if (!two?.meet) return [];
  const g = rawGeometry(d),
    ys = lineYs(f),
    m = two.meet;
  const above = ys.map((y, k) => ({ y, k })).filter((x) => x.y > m.y).pop(),
    below = ys.map((y, k) => ({ y, k })).find((x) => x.y < m.y);
  const inside = (p: P, t: P[]) => {
    const side = (a: P, b: P) => (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
    const s = [side(t[0], t[1]), side(t[1], t[2]), side(t[2], t[0])];
    return s.every((v) => v > 0) || s.every((v) => v < 0);
  };
  const out: { line: number; ids: string[] }[] = [];
  for (const line of [above, below]) {
    if (!line) continue;
    const t = [g.points[`x${line.k + 1}`].at, g.points[`y${line.k + 1}`].at, m];
    const pick = (prefix: string, at: P) =>
      g.slots.find((s) => s.id.startsWith(prefix) && len(sub(s.vertex, at)) < 1e-6 && inside(add(at, mul(dir(s.start + s.sweep / 2), 0.5)), t))?.id;
    const ids = [pick(`p${line.k + 1}-`, t[0]), pick(`q${line.k + 1}-`, t[1]), pick("m", m)];
    if (ids.every(Boolean)) out.push({ line: line.k + 1, ids: ids as string[] });
  }
  return out;
}

/* ---------- Layout ---------- */

const MARGIN = 2;
const FRACTIONS = [0.5, 0.42, 0.58, 0.34, 0.66, 0.26, 0.74, 0.18, 0.82, 0.12, 0.88];
const ARC = 6;
const CAPTION = "Diagram NOT accurately drawn";
type Rect = { x: number; y: number; w: number; h: number };
export type Placed = { id: string; slot: Slot; radius: number; box: Rect; centre: P; clear: boolean };
export type Layout = {
  width: number;
  height: number;
  font: number;
  /** Maps a figure point (mm, y up) to the artwork (mm, y down). */
  map: (p: P) => P;
  /** Maps an artwork point back to the figure (mm, y up, turned). */
  unmap: (p: P) => P;
  geometry: Geometry;
  labels: Placed[];
  names: { id: string; text: string; centre: P }[];
  caption: P | null;
  issues: string[];
  notes: string[];
};

function hitsSegment(r: Rect, a: P, b: P) {
  // Liang–Barsky clip of the segment against the rectangle.
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

/** Arc radius for a marked angle: small angles get a wider arc so the mark can be seen. */
const arcRadius = (sweep: number) => (sweep < 25 ? ARC + 4 : sweep < 45 ? ARC + 2 : ARC);

/**
 * Places every label once, sized for the wider of its pupil and answers text, so both copies share
 * one layout. Labels sit on the angle's bisector, just clear of its lines and of each other.
 */
export function layout(e: Envelope): Layout {
  const d = e.document,
    font = ((d.fontPt ?? 11) * 25.4) / 72;
  const g = geometry(d);
  const slots = new Map(g.slots.map((s) => [s.id, s]));
  const byId = new Map(d.angles.map((a) => [a.id, a]));
  const issues: string[] = [];
  const lines = g.segments;
  const placedBoxes: Rect[] = [];
  const labels: Placed[] = [];
  // Work in y-up mm; boxes are axis-aligned in the same frame.
  for (const a of d.angles) {
    const slot = slots.get(a.id)!;
    const radius = arcRadius(slot.sweep) + (a.mark === "double" ? 1 : a.mark === "triple" ? 2 : 0);
    const texts = [printed(a.label, "pupil").text, printed(a.label, "answer").text];
    const w = Math.max(...texts.map((t) => (t ? textWidth(t, font) : 0)));
    if (!w) {
      labels.push({ id: a.id, slot, radius, box: { x: slot.vertex.x, y: slot.vertex.y, w: 0, h: 0 }, centre: slot.vertex, clear: true });
      continue;
    }
    const h = font * 1.05;
    const b = dir(slot.start + slot.sweep / 2);
    let chosen: { box: Rect; centre: P } | null = null;
    // Nearest clear place to the vertex, on the bisector if it can be, otherwise off it but still
    // inside the angle (a diagonal or another line can cut through the middle of an angle).
    search: for (let dist = radius + 1.2; dist < radius + 40; dist += 0.4)
      for (const t of FRACTIONS) {
        const u = dir(slot.start + slot.sweep * t);
        const c = add(slot.vertex, mul(u, dist + Math.abs(u.x) * w * 0.5 + Math.abs(u.y) * h * 0.5));
        const box = { x: c.x - w / 2, y: c.y - h / 2, w, h };
        const padded = grow(box, 0.5);
        if (lines.some((s) => hitsSegment(padded, s.a, s.b))) continue;
        // Z, F and C shapes are 1.8 mm wide: labels keep clear of the grey too.
        if (g.highlights.some(([p, q]) => hitsSegment(grow(box, 1.2), p, q))) continue;
        if (placedBoxes.some((p) => overlaps(p, box))) continue;
        chosen = { box, centre: c };
        break search;
      }
    const clear = chosen !== null;
    if (!chosen) {
      const c = add(slot.vertex, mul(b, radius + 2 + Math.max(w, h) / 2));
      chosen = { box: { x: c.x - w / 2, y: c.y - h / 2, w, h }, centre: c };
      issues.push(`The label for ${slot.name} (${a.id}) has no clear space. Make that angle wider, the diagram larger or the label shorter.`);
    }
    placedBoxes.push(chosen.box);
    labels.push({ id: a.id, slot, radius, box: chosen.box, centre: chosen.centre, clear });
  }
  const names: Layout["names"] = [];
  for (const nm of d.names) {
    const p = g.points[nm.id];
    const w = textWidth(nm.text, font),
      h = font * 1.05;
    let centre = add(p.at, mul(p.out, 1.5 + Math.max(w, h) / 2));
    for (let dist = 1.5; dist < 12; dist += 0.4) {
      const c = add(p.at, mul(p.out, dist + Math.abs(p.out.x) * w * 0.5 + Math.abs(p.out.y) * h * 0.5));
      const box = { x: c.x - w / 2, y: c.y - h / 2, w, h };
      if (lines.some((s) => hitsSegment(grow(box, 0.3), s.a, s.b)) || placedBoxes.some((q) => overlaps(q, box))) continue;
      centre = c;
      break;
    }
    const box = { x: centre.x - w / 2, y: centre.y - h / 2, w, h };
    placedBoxes.push(box);
    names.push({ id: nm.id, text: nm.text, centre });
  }
  // Bounds in y-up mm.
  const xs: number[] = [],
    ys: number[] = [];
  for (const s of lines) {
    xs.push(s.a.x, s.b.x);
    ys.push(s.a.y, s.b.y);
  }
  for (const l of labels) {
    // The arc (or shading, 2 mm wider) as drawn, sampled along its sweep.
    const reach = l.radius + (byId.get(l.id)!.shade ? 2 : 0.3);
    for (let i = 0; i <= 16; i++) {
      const q = add(l.slot.vertex, mul(dir(l.slot.start + (l.slot.sweep * i) / 16), reach));
      xs.push(q.x);
      ys.push(q.y);
    }
    if (l.box.w) {
      xs.push(l.box.x, l.box.x + l.box.w);
      ys.push(l.box.y, l.box.y + l.box.h);
    }
  }
  for (const nm of names) {
    const w = textWidth(nm.text, font);
    xs.push(nm.centre.x - w / 2, nm.centre.x + w / 2);
    ys.push(nm.centre.y - font * 0.55, nm.centre.y + font * 0.55);
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
      const grow = (w + 2 * MARGIN - (maxX - minX)) / 2;
      minX -= grow;
      maxX += grow;
    }
    caption = { x: maxX - minX - MARGIN - w / 2, y: height + captionFont * 0.9 };
    height += captionFont * 1.4;
  }
  const map = (p: P): P => ({ x: p.x - minX, y: maxY - p.y });
  const unmap = (p: P): P => ({ x: p.x + minX, y: maxY - p.y });
  const width = Math.ceil((maxX - minX) * 10) / 10;
  height = Math.ceil(height * 10) / 10;
  if (width > 270) issues.push(`The diagram is ${n(width / 10)} cm wide. Make it smaller.`);
  if (height > 270) issues.push(`The diagram is ${n(height / 10)} cm tall. Make it smaller.`);
  const notes = sizeNotes(d);
  for (const a of d.angles)
    if (a.mark === "right" && Math.abs(slots.get(a.id)!.sweep - 90) > 10) notes.push(`Angle ${a.id} has a right-angle mark but is drawn at ${Math.round(slots.get(a.id)!.sweep)}°.`);
  return { width, height, font, map, unmap, geometry: g, labels, names, caption, issues, notes };
}
export const exportIssue = (e: Envelope) => layout(e).issues.join(" ") || null;
export const warnings = (e: Envelope) => {
  const g = layout(e);
  return [...g.issues, ...g.notes];
};

/* ---------- SVG ---------- */

function arcPath(c: P, r: number, start: number, sweep: number, map: Layout["map"]) {
  const a = map(add(c, mul(dir(start), r))),
    b = map(add(c, mul(dir(start + sweep), r)));
  // SVG y runs down, so an anticlockwise sweep in the figure is sweep-flag 0.
  return `M${n(a.x)} ${n(a.y)}A${n(r)} ${n(r)} 0 ${sweep > 180 ? 1 : 0} 0 ${n(b.x)} ${n(b.y)}`;
}
function rightMark(s: Slot, map: Layout["map"]) {
  const k = 4,
    u = mul(dir(s.start), k),
    v = mul(dir(s.start + s.sweep), k);
  const p1 = map(add(s.vertex, u)),
    p2 = map(add(add(s.vertex, u), v)),
    p3 = map(add(s.vertex, v));
  return `M${n(p1.x)} ${n(p1.y)}L${n(p2.x)} ${n(p2.y)}L${n(p3.x)} ${n(p3.y)}`;
}
function chevrons(s: Segment, count: number, map: Layout["map"]) {
  // Arrowheads pointing along the line at its middle, 2.2 mm apart, as on exam papers.
  const u = unitOf(sub(s.b, s.a)),
    nrm = { x: -u.y, y: u.x },
    mid = add(s.a, mul(sub(s.b, s.a), s.arrowAt ?? 0.5)),
    out: string[] = [];
  for (let i = 0; i < count; i++) {
    const tip = add(mid, mul(u, (i - (count - 1) / 2) * 2.2 + 1.2));
    const back = add(tip, mul(u, -2.2));
    const p = map(add(back, mul(nrm, 1.4))),
      t = map(tip),
      q = map(add(back, mul(nrm, -1.4)));
    out.push(`M${n(p.x)} ${n(p.y)}L${n(t.x)} ${n(t.y)}L${n(q.x)} ${n(q.y)}`);
  }
  return out.join("");
}
function tickMarks(s: Segment, count: number, map: Layout["map"]) {
  const u = unitOf(sub(s.b, s.a)),
    nrm = { x: -u.y, y: u.x },
    mid = mul(add(s.a, s.b), 0.5),
    out: string[] = [];
  for (let i = 0; i < count; i++) {
    const c = add(mid, mul(u, (i - (count - 1) / 2) * 1.2));
    const p = map(add(c, mul(nrm, 1.6))),
      q = map(add(c, mul(nrm, -1.6)));
    out.push(`M${n(p.x)} ${n(p.y)}L${n(q.x)} ${n(q.y)}`);
  }
  return out.join("");
}

/** The artwork at its printed size in mm. The answers copy adds saved answers in the answer colour. */
export function renderSvg(e: Envelope, view: View = "pupil"): string {
  const d = validate(structuredClone(e)).document;
  const g = layout({ ...e, document: d });
  const map = g.map;
  const out: string[] = [`<rect width="${n(g.width)}" height="${n(g.height)}" fill="white"/>`];
  const by = new Map(d.angles.map((a) => [a.id, a]));
  // Shading first, under every line.
  for (const l of g.labels) {
    const a = by.get(l.id)!;
    if (!a.shade) continue;
    const v = map(l.slot.vertex),
      r = l.radius + 2;
    const arc = arcPath(l.slot.vertex, r, l.slot.start, l.slot.sweep, map);
    out.push(`<path d="M${n(v.x)} ${n(v.y)}L${arc.slice(1)}Z" fill="#d9d9d9" stroke="none"/>`);
  }
  // Z, F and C shapes: thick and grey, under the black lines, so they read in black and white.
  if (g.geometry.highlights.length)
    out.push(
      `<path d="${g.geometry.highlights.map(([a, b]) => `M${n(map(a).x)} ${n(map(a).y)}L${n(map(b).x)} ${n(map(b).y)}`).join("")}" fill="none" stroke="#bdbdbd" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`,
    );
  const solid = g.geometry.segments.filter((s) => !s.dashed),
    dashed = g.geometry.segments.filter((s) => s.dashed);
  const seg = (s: Segment) => {
    const a = map(s.a),
      b = map(s.b);
    return `M${n(a.x)} ${n(a.y)}L${n(b.x)} ${n(b.y)}`;
  };
  out.push(`<path d="${solid.map(seg).join("")}" fill="none" stroke="black" stroke-width="0.4" stroke-linecap="round"/>`);
  if (dashed.length) out.push(`<path d="${dashed.map(seg).join("")}" fill="none" stroke="black" stroke-width="0.3" stroke-dasharray="1.6 1.2"/>`);
  const marks: string[] = [];
  for (const s of g.geometry.segments) {
    if (s.arrows) marks.push(chevrons(s, s.arrows, map));
    if (s.ticks) marks.push(tickMarks(s, s.ticks, map));
  }
  for (const l of g.labels) {
    const a = by.get(l.id)!;
    if (a.mark === "none") continue;
    if (a.mark === "right") marks.push(rightMark(l.slot, map));
    else {
      const count = a.mark === "double" ? 2 : a.mark === "triple" ? 3 : 1;
      const base = arcRadius(l.slot.sweep);
      for (let i = 0; i < count; i++) marks.push(arcPath(l.slot.vertex, base + i, l.slot.start, l.slot.sweep, map));
    }
  }
  if (marks.length) out.push(`<path d="${marks.join("")}" fill="none" stroke="black" stroke-width="0.3" stroke-linejoin="round"/>`);
  const texts: string[] = [];
  for (const l of g.labels) {
    const a = by.get(l.id)!;
    const p = printed(a.label, view);
    if (!p.text) continue;
    const c = map(l.centre);
    texts.push(textSvg(p.text, c.x, c.y + g.font * 0.34, g.font, p.answer ? ANSWER_COLOUR : "black"));
  }
  for (const nm of g.names) {
    const c = map(nm.centre);
    // Point names are upright capitals, as on exam papers.
    texts.push(`<text x="${n(c.x)}" y="${n(c.y + g.font * 0.34)}" text-anchor="middle" font-family="STIX Two Text,STIX Two Math,serif" font-size="${n(g.font)}" fill="black">${esc(nm.text)}</text>`);
  }
  if (g.caption)
    texts.push(`<text x="${n(g.caption.x)}" y="${n(g.caption.y)}" text-anchor="middle" font-family="STIX Two Text,STIX Two Math,serif" font-size="${n((MIN_TEXT_PT * 25.4) / 72)}" fill="black">${CAPTION}</text>`);
  out.push(...texts);
  const body = boldLines(out.join(""), d.lines);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${n(g.width)}mm" height="${n(g.height)}mm" viewBox="0 0 ${n(g.width)} ${n(g.height)}" role="img" aria-label="${esc(altText(e))}">${body}</svg>`;
}

/** Plain description of the pupil copy; it never names a saved answer. */
export function altText(e: Envelope): string {
  const d = e.document,
    f = d.figure;
  const what =
    f.type === "straight-line"
      ? `${f.rays.length} ${f.rays.length === 1 ? "ray" : "rays"} from a point on a straight line`
      : f.type === "point"
        ? `${f.rays.length} rays round a point`
        : f.type === "crossing"
          ? `${f.lines.length} straight lines crossing at a point`
          : f.type === "parallel"
            ? `${f.count} parallel lines cut by ${f.second ? "two transversals" : "a transversal"}`
            : f.type === "polygons"
              ? `${f.sides.length} regular polygons (${f.sides.join(", ")} sides) meeting at a corner`
              : `${f.corners ? "an irregular" : "a regular"} polygon with ${f.corners?.length ?? f.sides} sides`;
  const given = d.angles.filter((a) => a.label.state === "value").map((a) => degrees(a.label.text));
  const letters = d.angles.filter((a) => a.label.state === "symbol").map((a) => a.label.text);
  const parts = [`Angle diagram: ${what}`];
  if (given.length) parts.push(`given ${given.join(", ")}`);
  if (letters.length) parts.push(`angles marked ${letters.join(", ")}`);
  for (const l of d.letters ?? []) {
    const shape = letterOf(l.a, l.b);
    if (shape) parts.push(`a ${shape.letter} shape shows ${shape.name} angles`);
  }
  return parts.join("; ") + (d.notToScale ? ". Not accurately drawn." : ".");
}

/* ---------- Links ---------- */

export const MAX_LINK_LENGTH = 16_000;
export const LINK_PREFIX = "#angles=";
export const linkHash = (e: Envelope): string => LINK_PREFIX + envelope.encodeLink(e);
/** The website editor link, or null when the diagram is too large for a link. */
export function editorLink(e: Envelope, base: string): string | null {
  const url = new URL(base);
  url.pathname = url.pathname.replace(/(\/tools(\/[^/]*)?)?\/?$/, "/") + "tools/angles";
  url.search = "";
  url.hash = linkHash(e);
  return url.href.length <= MAX_LINK_LENGTH ? url.href : null;
}
export function decodeLinkHash(hashText: string): Envelope {
  if (!/^#angles=[A-Za-z0-9_-]+$/.test(hashText) || hashText.length > MAX_LINK_LENGTH) throw Error("This is not a supported angle diagram link. Open an editable file instead.");
  try {
    return envelope.decodeLink(hashText.slice(LINK_PREFIX.length), MAX_LINK_LENGTH);
  } catch {
    throw Error("This angle diagram link could not be read. Open an editable file instead.");
  }
}

/* ---------- Editor helpers ---------- */

/** Where the editor puts each angle's select button: on the label if it has one, else in the angle (artwork mm). */
export function hitAnchors(e: Envelope): { id: string; name: string; at: P }[] {
  const g = layout(e),
    placed = new Map(g.labels.map((l) => [l.id, l]));
  return g.geometry.slots.map((s) => {
    const l = placed.get(s.id);
    const at = l && l.box.w ? l.centre : add(s.vertex, mul(dir(s.start + s.sweep / 2), arcRadius(s.sweep) + 3));
    return { id: s.id, name: s.name, at: g.map(at) };
  });
}

/**
 * After rays are added, removed or moved, keeps each label on the angle that starts at the same ray,
 * and each point name on the ray end in the same direction, so nothing jumps to another angle or ray.
 * An angle whose starting ray was removed loses its label. Only for straight lines, points and
 * crossing lines; other figures keep their IDs by meaning.
 */
export function remapRays(before: AngleDocument, after: AngleDocument): Pick<AngleDocument, "angles" | "names"> {
  const t = after.figure.type;
  if (before.figure.type !== t || (t !== "straight-line" && t !== "point" && t !== "crossing")) return { angles: after.angles, names: after.names };
  const same = (a: number, b: number) => Math.abs(norm(a - b + 180) - 180) < 1e-6;
  const was = rawGeometry(before),
    now = rawGeometry(after);
  const old = new Map(was.slots.map((s) => [s.id, s.start]));
  const angles: Angle[] = [];
  for (const a of before.angles) {
    const start = old.get(a.id);
    const match = now.slots.find((s) => start !== undefined && same(s.start, start));
    if (match && !angles.some((x) => x.id === match.id)) angles.push({ ...structuredClone(a), id: match.id });
  }
  const names: AngleDocument["names"] = [];
  for (const nm of before.names) {
    let id: string | undefined = nm.id;
    if (/^r\d+$/.test(nm.id)) {
      const p = was.points[nm.id];
      id = p ? Object.keys(now.points).find((k) => /^r\d+$/.test(k) && same(heading(now.points[k].at), heading(p.at))) : undefined;
    } else if (!now.points[nm.id]) id = undefined;
    if (id && !names.some((x) => x.id === id)) names.push({ id, text: nm.text });
  }
  return { angles, names };
}

/* ---------- Dragging (editor only) ---------- */

/** The figure's points before it is turned, for the editor's drag handles. */
export const rawPoints = (d: AngleDocument) => rawGeometry(d).points;
/** An artwork point (mm) in the figure's own frame, before the turn. */
export function figurePoint(g: Layout, turnDeg: number, art: P): P {
  const t = g.unmap(art),
    c = Math.cos(rad(-turnDeg)),
    s = Math.sin(rad(-turnDeg));
  return { x: t.x * c - t.y * s, y: t.x * s + t.y * c };
}
/** The handles a figure can be dragged by: ray and line ends, transversal ends and polygon corners. */
export function dragHandles(d: AngleDocument): { id: string; name: string; pivot: P | null }[] {
  const f = d.figure,
    pts = rawGeometry(d).points,
    o = { x: 0, y: 0 };
  if (f.type === "straight-line" || f.type === "point") return f.rays.map((_, i) => ({ id: `r${i + 1}`, name: `ray ${i + 1}`, pivot: o }));
  if (f.type === "crossing") {
    // One handle per line, at its end pointing between 0 and 180 degrees.
    const sorted = [...f.lines].sort((a, b) => a - b);
    return Object.keys(pts)
      .filter((k) => /^r\d+$/.test(k) && heading(pts[k].at) < 180 - 1e-6)
      .map((id) => ({ id, name: `line ${sorted.findIndex((l) => Math.abs(l - heading(pts[id].at)) < 1e-6) + 1}`, pivot: o }));
  }
  if (f.type === "parallel") {
    const out = [{ id: "tb", name: "the transversal", pivot: o as P | null }];
    if (f.second) out.push({ id: "ub", name: "the second transversal", pivot: pts.y1.at }, { id: "y1", name: "the second transversal along the top line", pivot: null });
    return out;
  }
  if (f.type === "polygon") return polygonCorners(f, d.sizeMm).map((_, k) => ({ id: `v${k + 1}`, name: `corner ${k + 1}`, pivot: null }));
  return [];
}
/**
 * The diagram with one handle dragged to p (the figure's own frame, before the turn), or null when the
 * move is refused. Directions snap to 5 degrees (1 with fine); a ray stays between its neighbours, so
 * every label stays with its angle; a polygon corner keeps the polygon convex.
 */
export function dragTo(e: Envelope, id: string, p: P, fine = false): Envelope | null {
  const n = structuredClone(e),
    d = n.document,
    f = d.figure;
  const step = fine ? 1 : 5;
  const snap = (v: number) => Math.round(v / step) * step;
  /** v (or the same direction a period round) kept between the neighbouring rays, so labels stay with their angles. */
  const between = (list: number[], i: number, v: number, range: [number, number], wrap: number, period: number) => {
    const lo = Math.max(range[0], i > 0 ? list[i - 1] + 5 : wrap ? list[list.length - 1] - wrap + 5 : range[0]);
    const hi = Math.min(range[1], i < list.length - 1 ? list[i + 1] - 5 : wrap ? list[0] + wrap - 5 : range[1]);
    if (lo > hi) return null;
    const away = (x: number) => (x < lo ? lo - x : x > hi ? x - hi : 0);
    const best = [v - period, v, v + period].reduce((a, b) => (away(b) < away(a) ? b : a));
    return Math.min(hi, Math.max(lo, best));
  };
  if ((f.type === "straight-line" || f.type === "point") && /^r\d+$/.test(id)) {
    const list = [...f.rays].sort((a, b) => a - b),
      i = Number(id.slice(1)) - 1;
    if (!(i < list.length)) return null;
    let v = snap(heading(p));
    if (f.type === "straight-line" && p.y < 0) v = p.x > 0 ? 5 : 175;
    // Rays are saved in order from 0°, so a ray round a point stops at 0° rather than wrapping past it (as the typed boxes do).
    const out = between(list, i, v, f.type === "straight-line" ? [5, 175] : [0, 359], f.type === "point" ? 360 : 0, f.type === "point" ? 360 : 0);
    if (out === null) return null;
    list[i] = out;
    f.rays = list;
  } else if (f.type === "crossing" && /^r\d+$/.test(id)) {
    const list = [...f.lines].sort((a, b) => a - b),
      at = heading(rawGeometry(d).points[id]?.at ?? { x: 1, y: 0 });
    const i = list.findIndex((l) => Math.abs(l - at) < 1e-6);
    if (i < 0) return null;
    const out = between(list, i, snap(heading(p) % 180), [0, 179], 180, 180);
    if (out === null) return null;
    list[i] = out;
    f.lines = list;
  } else if (f.type === "parallel" && (id === "tb" || id === "ub")) {
    const pivot = id === "tb" ? { x: 0, y: 0 } : rawGeometry(d).points.y1.at;
    const a = snap(heading(sub(p, pivot)) % 180),
      now = id === "tb" ? f.crossDeg : (f.second?.crossDeg ?? 90);
    // Past the limits a transversal stops at the one it is nearer, rather than jumping across.
    const v = a >= 20 && a <= 160 ? a : now < 90 ? 20 : 160;
    if (id === "tb") f.crossDeg = v;
    else if (f.second) f.second = { ...f.second, crossDeg: v };
  } else if (f.type === "parallel" && id === "y1" && f.second) {
    const top = lineYs(f)[0];
    f.second = { ...f.second, offsetMm: Math.min(80, Math.max(-80, Math.round(p.x - top * cot(f.crossDeg)))) };
  } else if (f.type === "polygon" && /^v\d+$/.test(id)) {
    const k = Number(id.slice(1)) - 1,
      corners = polygonCorners(f, d.sizeMm).map((c) => ({ x: Math.round(c.x * 10) / 10, y: Math.round(c.y * 10) / 10 }));
    if (!(k < corners.length)) return null;
    const half = fine ? 0.5 : 1;
    corners[k] = { x: Math.round(p.x / half) * half, y: Math.round(p.y / half) * half };
    // A dragged regular polygon becomes irregular, so its sides are no longer marked equal.
    if (!f.corners) f.ticks = f.ticks.map(() => 0);
    f.corners = corners;
  } else return null;
  try {
    return validate(n);
  } catch {
    return null;
  }
}
