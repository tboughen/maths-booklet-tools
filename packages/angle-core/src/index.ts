/**
 * Angle diagrams (improvement list G-1, G-2, G-3): angles on a straight line, angles round a point,
 * crossing lines (vertically opposite angles), parallel lines cut by a transversal, and polygons with
 * interior and exterior angles.
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
export const FIGURES = ["straight-line", "point", "crossing", "parallel", "polygon"] as const;
export type FigureKind = (typeof FIGURES)[number];
export const FIGURE_NAMES: Record<FigureKind, string> = {
  "straight-line": "Straight line",
  point: "Round a point",
  crossing: "Crossing lines",
  parallel: "Parallel lines",
  polygon: "Polygon",
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
  /** Two or three parallel lines (with arrow marks) cut by one transversal at crossDeg. */
  z
    .object({
      type: z.literal("parallel"),
      count: z.union([z.literal(2), z.literal(3)]),
      gapMm: z.number().finite().min(12).max(50),
      crossDeg: z.number().finite().min(20).max(160),
      arrows: z.number().int().min(0).max(3),
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
]);
export const documentSchema = z
  .object({
    figure: figureSchema,
    angles: z.array(angleSchema).max(40),
    /** Letters printed beside points (A, B, C ...), by point ID. */
    names: z.array(nameSchema).max(30),
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
/** An angle the figure makes: at vertex, from direction start, sweeping anticlockwise. */
export type Slot = { id: string; vertex: P; start: number; sweep: number; name: string };
export type Geometry = { segments: Segment[]; points: Record<string, { at: P; out: P }>; slots: Slot[] };

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
  return { segments, points, slots };
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
  if (f.type === "parallel") {
    const t = dir(f.crossDeg);
    const segments: Segment[] = [],
      points: Geometry["points"] = {},
      slots: Slot[] = [];
    // Lines run left to right; line 1 is the top one. The transversal crosses each line once.
    const ys = Array.from({ length: f.count }, (_, k) => ((f.count - 1) / 2 - k) * f.gapMm);
    // Crossings sit on a line through the origin in the transversal's direction.
    const xs = ys.map((y) => (y * t.x) / t.y);
    // The parallel lines always run on past every crossing, however steep the transversal.
    const half = Math.max(size / 2, Math.max(...xs.map(Math.abs)) + 15);
    // Arrow marks sit at the same place on every line, on the side with more room from the crossings.
    const room = half - Math.max(...xs),
      roomLeft = half + Math.min(...xs);
    const arrowX = room >= roomLeft ? (Math.max(...xs) + half) / 2 : (Math.min(...xs) - half) / 2;
    ys.forEach((y, k) => {
      segments.push({ a: { x: -half, y }, b: { x: half, y }, arrows: f.arrows, arrowAt: (arrowX + half) / (2 * half) });
      points[`l${k + 1}a`] = { at: { x: -half, y }, out: dir(180) };
      points[`l${k + 1}b`] = { at: { x: half, y }, out: dir(0) };
      const at = { x: xs[k], y };
      points[`x${k + 1}`] = { at, out: dir(90 + f.crossDeg / 2) };
      const rays = [0, f.crossDeg, 180, 180 + f.crossDeg];
      POSITIONS.forEach((pos, i) =>
        slots.push({ id: `p${k + 1}-${pos}`, vertex: at, start: rays[i], sweep: ccw(rays[i], rays[(i + 1) % 4]), name: `line ${k + 1}, ${POSITION_NAMES[pos]}` }),
      );
    });
    // The transversal runs on past the outer lines far enough for their angles to be marked.
    const ext = Math.max(14, f.gapMm * 0.6);
    const top = add({ x: xs[0], y: ys[0] }, mul(t, ext)),
      bottom = add({ x: xs[xs.length - 1], y: ys[ys.length - 1] }, mul(t, -ext));
    segments.push({ a: bottom, b: top });
    points.ta = { at: bottom, out: mul(t, -1) };
    points.tb = { at: top, out: t };
    return { segments, points, slots };
  }
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
  return { segments, points, slots };
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

export function validate(input: unknown): Envelope {
  const parsed = envelopeSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue?.path ?? [];
    if (path.includes("rays")) throw Error("Use 1 to 5 rays above a straight line (0 to 180 degrees) or 2 to 8 rays round a point (0 to 360 degrees).");
    if (path.includes("lines") && path.includes("figure")) throw Error("Use 2 or 3 crossing lines, each a direction from 0 to 180 degrees.");
    if (path.includes("text") || path.includes("answer")) throw Error(`Use labels of at most ${MAX_LABEL} characters without markup.`);
    if (path.includes("corners") && path.length > 4) throw Error("Keep every corner within 200 mm of the centre.");
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
  } else {
    d.figure = { type: "polygon", sides: 6, corners: null, exterior: [], diagonals: false, ticks: [1, 1, 1, 1, 1, 1] };
    d.sizeMm = 50;
    d.angles = [angle("i2", label("x", "symbol"))];
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
    for (let k = 1; k <= f.count; k++) {
      sum([`p${k}-ur`, `p${k}-ul`], 180, `The angles on line ${k} above the transversal`);
      equal(`p${k}-ur`, `p${k}-ll`, `Vertically opposite angles on line ${k}`);
      equal(`p${k}-ul`, `p${k}-lr`, `Vertically opposite angles on line ${k}`);
    }
    for (let k = 1; k < f.count; k++)
      for (const pos of POSITIONS) equal(`p${k}-${pos}`, `p${k + 1}-${pos}`, `Corresponding angles p${k}-${pos} and p${k + 1}-${pos}`);
  }
  if (f.type === "polygon") {
    const sides = f.corners?.length ?? f.sides;
    sum(Array.from({ length: sides }, (_, k) => `i${k + 1}`), (sides - 2) * 180, `The interior angles of this ${sides}-sided polygon`);
    for (const k of f.exterior) sum([`i${k}`, `e${k}`], 180, `The interior and exterior angles at corner ${k}`);
  }
  return [...new Set(notes)];
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
  const width = Math.ceil((maxX - minX) * 10) / 10;
  height = Math.ceil(height * 10) / 10;
  if (width > 270) issues.push(`The diagram is ${n(width / 10)} cm wide. Make it smaller.`);
  if (height > 270) issues.push(`The diagram is ${n(height / 10)} cm tall. Make it smaller.`);
  const notes = sizeNotes(d);
  for (const a of d.angles)
    if (a.mark === "right" && Math.abs(slots.get(a.id)!.sweep - 90) > 10) notes.push(`Angle ${a.id} has a right-angle mark but is drawn at ${Math.round(slots.get(a.id)!.sweep)}°.`);
  return { width, height, font, map, geometry: g, labels, names, caption, issues, notes };
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
            ? `${f.count} parallel lines cut by a transversal`
            : `${f.corners ? "an irregular" : "a regular"} polygon with ${f.corners?.length ?? f.sides} sides`;
  const given = d.angles.filter((a) => a.label.state === "value").map((a) => degrees(a.label.text));
  const letters = d.angles.filter((a) => a.label.state === "symbol").map((a) => a.label.text);
  const parts = [`Angle diagram: ${what}`];
  if (given.length) parts.push(`given ${given.join(", ")}`);
  if (letters.length) parts.push(`angles marked ${letters.join(", ")}`);
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
  if (before.figure.type !== t || t === "parallel" || t === "polygon") return { angles: after.angles, names: after.names };
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
