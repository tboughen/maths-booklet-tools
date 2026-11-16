/**
 * Geometry figures: named points, circles, chords, tangents and straight lines, with side lengths,
 * angle marks, equal-side ticks and parallel arrows, drawn the way Edexcel draws them. One family
 * covers circle theorems, similar and congruent shapes, and geometric proofs.
 *
 * The document is a list of points, each placed freely (mm, y up), on a circle (by direction from
 * its centre), along a line through two points, where two lines meet, along the tangent at a point
 * on a circle, where the tangents at two points meet, or at the foot of a perpendicular. Segments,
 * angles and grey fills refer to points by ID, so moving a point carries everything with it.
 *
 * Labels use the house five states: value (a given length or size), symbol (a letter), blank, answer
 * line and hidden. A saved answer prints only on the answers copy, in the house answer colour, in
 * place of the label. Nothing is calculated or filled in, and the drawing never has to match the
 * numbers: "Diagram NOT accurately drawn" stays honest.
 */
import { z } from "zod";
import { aboutShape } from "../../envelope-core/src/about";
import { defineEnvelope } from "../../envelope-core/src/index";
import { ANSWER_COLOUR } from "../../envelope-core/src/answer-state";
import { boldLines, LINE_WEIGHTS, MIN_TEXT_PT } from "../../envelope-core/src/house-style";
import { degrees, textHeight, textSvg, textWidth } from "../../area-core/src/index";

/** The drawing rules version this core writes and reads: the one source for schemas, guides and the connector (M19). */
export const RENDERER_VERSION = "figures-1" as const;

export { ANSWER_COLOUR, degrees };
export const STATES = ["value", "symbol", "blank", "answer-line", "hidden"] as const;
export type LabelState = (typeof STATES)[number];
export const MARKS = ["none", "arc", "double", "triple", "right"] as const;
export type Mark = (typeof MARKS)[number];
export const STYLES = ["solid", "dashed", "dotted"] as const;
export type LineStyle = (typeof STYLES)[number];
export const SIDES = ["auto", "left", "right"] as const;
export const SHOWS = ["none", "dot", "cross"] as const;
export const PLACES = ["free", "on", "along", "meet", "tangent", "tangents", "foot"] as const;
export type PlaceType = (typeof PLACES)[number];
export const MAX_LABEL = 24;
export const LIMITS = { points: 40, circles: 4, segments: 60, angles: 40, fills: 8, captions: 8 } as const;
/** Every point and circle centre stays within this many mm of the origin. */
export const REACH = 150;

const plain = (max: number) =>
  z
    .string()
    .max(max)
    .refine((s) => ![...s].some((c) => c.charCodeAt(0) < 32 || c === "<" || c === ">" || c === "&"), "Use ordinary text without markup.");
const id = z.string().regex(/^[a-z][a-z0-9]{0,7}$/);
const coord = z.number().finite().min(-REACH).max(REACH);

export const labelSchema = z
  .object({
    state: z.enum(STATES),
    /** What pupils see: a length for a side ("9 cm", "2x + 1"), a size for an angle ("62", "3x + 10"), a letter for symbol. */
    text: plain(MAX_LABEL),
    /** The saved answer, printed only on the answers copy. Empty means none. */
    answer: plain(MAX_LABEL),
  })
  .strict();
export const placeSchema = z.discriminatedUnion("type", [
  /** Anywhere, in mm with y up. */
  z.object({ type: z.literal("free"), x: coord, y: coord }).strict(),
  /** On a circle, deg anticlockwise from the right of its centre. */
  z.object({ type: z.literal("on"), circle: id, deg: z.number().finite().min(0).max(360) }).strict(),
  /** On the line through a and b: t = 0 at a, 1 at b, 0.5 halfway; below 0 or above 1 is beyond the ends. */
  z.object({ type: z.literal("along"), a: id, b: id, t: z.number().finite().min(-3).max(4) }).strict(),
  /** Where the line through a and b meets the line through c and d. */
  z.object({ type: z.literal("meet"), a: id, b: id, c: id, d: id }).strict(),
  /** mm along the tangent at a point on a circle: positive anticlockwise round the circle, negative clockwise. */
  z.object({ type: z.literal("tangent"), at: id, mm: z.number().finite().min(-200).max(200) }).strict(),
  /** Where the tangents at two points on the same circle meet. */
  z.object({ type: z.literal("tangents"), a: id, b: id }).strict(),
  /** The foot of the perpendicular from a point to the line through a and b. */
  z.object({ type: z.literal("foot"), from: id, a: id, b: id }).strict(),
]);
export const pointSchema = z
  .object({
    id,
    place: placeSchema,
    /** The letter printed beside the point (A, B, O ...). Empty prints nothing. */
    name: plain(3),
    /** A dot (a circle's centre, a marked point) or a cross (a plotted point). */
    show: z.enum(SHOWS),
  })
  .strict();
export const circleSchema = z.object({ id, centre: id, r: z.number().finite().min(5).max(90), style: z.enum(STYLES) }).strict();
export const segmentSchema = z
  .object({
    id,
    a: id,
    b: id,
    style: z.enum(STYLES),
    /** Extra line drawn beyond a and beyond b, in mm (a tangent or straight line running past its points). */
    extend: z.array(z.number().finite().min(0).max(80)).length(2),
    /** Equal-side ticks (0 to 3). */
    ticks: z.number().int().min(0).max(3),
    /** Parallel-side arrowheads (0 to 3), pointing from a towards b. */
    arrows: z.number().int().min(0).max(3),
    label: labelSchema,
    /** Which side the label goes, looking from a to b; auto puts it outside the shape. */
    side: z.enum(SIDES),
  })
  .strict();
export const angleSchema = z
  .object({
    id,
    /** The vertex, and the two points the arms run to: the angle sweeps anticlockwise from the from-arm to the to-arm. */
    at: id,
    from: id,
    to: id,
    label: labelSchema,
    mark: z.enum(MARKS),
    shade: z.boolean(),
  })
  .strict();
export const fillSchema = z.object({ id, points: z.array(id).min(3).max(12) }).strict();
export const captionSchema = z.object({ id, x: coord, y: coord, text: plain(32), bold: z.boolean() }).strict();
export const documentSchema = z
  .object({
    points: z.array(pointSchema).min(1).max(LIMITS.points),
    circles: z.array(circleSchema).max(LIMITS.circles),
    segments: z.array(segmentSchema).max(LIMITS.segments),
    angles: z.array(angleSchema).max(LIMITS.angles),
    /** Grey regions, each a polygon through points, drawn under every line. */
    fills: z.array(fillSchema).max(LIMITS.fills),
    /** Free text such as "Triangle A" or a bold shape letter. */
    captions: z.array(captionSchema).max(LIMITS.captions),
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
  .object({ kind: z.literal("figures"), schemaVersion: z.literal(1), rendererVersion: z.literal(RENDERER_VERSION), document: documentSchema, ...aboutShape })
  .strict();
export type Envelope = z.infer<typeof envelopeSchema>;
export type FigureDocument = Envelope["document"];
export type Point = z.infer<typeof pointSchema>;
export type Place = z.infer<typeof placeSchema>;
export type Circle = z.infer<typeof circleSchema>;
export type Segment = z.infer<typeof segmentSchema>;
export type Angle = z.infer<typeof angleSchema>;
export type Label = z.infer<typeof labelSchema>;
export type View = "pupil" | "answer";
export type P = { x: number; y: number };

export const label = (text = "", state: LabelState = text ? "value" : "blank", answer = ""): Label => ({ state, text, answer });
export const point = (pid: string, place: Place, name = "", show: Point["show"] = "none"): Point => ({ id: pid, place, name, show });
export const free = (x: number, y: number): Place => ({ type: "free", x, y });
export const on = (circle: string, deg: number): Place => ({ type: "on", circle, deg });
export const segment = (sid: string, a: string, b: string, l: Label = label(), more: Partial<Omit<Segment, "id" | "a" | "b" | "label">> = {}): Segment => ({
  id: sid,
  a,
  b,
  style: "solid",
  extend: [0, 0],
  ticks: 0,
  arrows: 0,
  label: l,
  side: "auto",
  ...more,
});
export const angle = (aid: string, at: string, from: string, to: string, l: Label = label(), mark: Mark = "arc", shade = false): Angle => ({ id: aid, at, from, to, label: l, mark, shade });

/* ---------- Geometry ---------- */

const rad = (deg: number) => (deg * Math.PI) / 180;
const dir = (deg: number): P => ({ x: Math.cos(rad(deg)), y: Math.sin(rad(deg)) });
const add = (a: P, b: P): P => ({ x: a.x + b.x, y: a.y + b.y });
const sub = (a: P, b: P): P => ({ x: a.x - b.x, y: a.y - b.y });
const mul = (a: P, s: number): P => ({ x: a.x * s, y: a.y * s });
const dot = (a: P, b: P) => a.x * b.x + a.y * b.y;
const cross = (a: P, b: P) => a.x * b.y - a.y * b.x;
const len = (a: P) => Math.hypot(a.x, a.y);
const unit = (a: P): P => {
  const l = len(a);
  return l < 1e-12 ? { x: 1, y: 0 } : mul(a, 1 / l);
};
const perp = (a: P): P => ({ x: -a.y, y: a.x });
export const heading = (a: P) => {
  const d = (Math.atan2(a.y, a.x) * 180) / Math.PI;
  return d < 0 ? d + 360 : d;
};
const norm = (deg: number) => ((deg % 360) + 360) % 360;
const ccw = (from: number, to: number) => {
  const s = norm(to - from);
  return s === 0 ? 360 : s;
};
function lineMeet(a: P, b: P, c: P, d: P): P | null {
  const r = sub(b, a),
    s = sub(d, c),
    den = cross(r, s);
  if (Math.abs(den) < 1e-9 * Math.max(1, len(r) * len(s))) return null;
  return add(a, mul(r, cross(sub(c, a), s) / den));
}

export type Resolved = { points: Map<string, P>; circles: Map<string, { c: P; r: number; style: LineStyle }> };

/**
 * Every point's position (mm, y up). Throws a teacher-readable error for a missing reference, a loop
 * of points placed on each other, lines that never meet, or a tangent at a point not on a circle.
 */
export function resolve(d: FigureDocument): Resolved {
  const byId = new Map(d.points.map((p) => [p.id, p]));
  const circleDefs = new Map(d.circles.map((c) => [c.id, c]));
  const points = new Map<string, P>();
  const circles: Resolved["circles"] = new Map();
  const busy = new Set<string>();
  const need = (pid: string, by: string): P => {
    const got = points.get(pid);
    if (got) return got;
    const p = byId.get(pid);
    if (!p) throw Error(`${by} refers to point ${pid}, which is not in the figure.`);
    if (busy.has(pid)) throw Error(`Point ${pid} is placed using itself (through ${[...busy].join(", ")}). Place one of them freely.`);
    busy.add(pid);
    const at = place(p);
    busy.delete(pid);
    if (Math.abs(at.x) > REACH * 2 || Math.abs(at.y) > REACH * 2) throw Error(`Point ${pid} lands ${Math.round(len(at))} mm from the middle of the figure. Move the points it depends on.`);
    points.set(pid, at);
    return at;
  };
  const circle = (cid: string, by: string) => {
    const got = circles.get(cid);
    if (got) return got;
    const c = circleDefs.get(cid);
    if (!c) throw Error(`${by} refers to circle ${cid}, which is not in the figure.`);
    const out = { c: need(c.centre, `Circle ${cid}`), r: c.r, style: c.style };
    circles.set(cid, out);
    return out;
  };
  /** The circle a point lies on, for tangents. */
  const circleOf = (pid: string, by: string) => {
    const p = byId.get(pid);
    if (!p) throw Error(`${by} refers to point ${pid}, which is not in the figure.`);
    if (p.place.type !== "on") throw Error(`${by} needs point ${pid} to be on a circle (place type "on").`);
    return { ...circle(p.place.circle, by), at: need(pid, by) };
  };
  const place = (p: Point): P => {
    const s = p.place,
      by = `Point ${p.id}`;
    if (s.type === "free") return { x: s.x, y: s.y };
    if (s.type === "on") {
      const c = circle(s.circle, by);
      return add(c.c, mul(dir(s.deg), c.r));
    }
    if (s.type === "along") {
      const a = need(s.a, by),
        b = need(s.b, by);
      if (len(sub(b, a)) < 1e-6) throw Error(`${by} is placed along ${s.a}${s.b}, but those two points are in the same place.`);
      return add(a, mul(sub(b, a), s.t));
    }
    if (s.type === "meet") {
      const m = lineMeet(need(s.a, by), need(s.b, by), need(s.c, by), need(s.d, by));
      if (!m) throw Error(`${by} is where ${s.a}${s.b} meets ${s.c}${s.d}, but those lines are parallel (or a line has no length).`);
      return m;
    }
    if (s.type === "tangent") {
      const c = circleOf(s.at, by);
      return add(c.at, mul(perp(unit(sub(c.at, c.c))), s.mm));
    }
    if (s.type === "tangents") {
      const a = circleOf(s.a, by),
        b = circleOf(s.b, by);
      const pa = byId.get(s.a)!.place as Extract<Place, { type: "on" }>,
        pb = byId.get(s.b)!.place as Extract<Place, { type: "on" }>;
      if (s.a === s.b || len(sub(a.at, b.at)) < 1e-6) throw Error(`${by} is where the tangents at ${s.a} and ${s.b} meet, but those are the same point, so there is only one tangent.`);
      if (pa.circle !== pb.circle) throw Error(`${by} is where the tangents at ${s.a} and ${s.b} meet, but those points are on different circles.`);
      const m = lineMeet(a.at, add(a.at, perp(sub(a.at, a.c))), b.at, add(b.at, perp(sub(b.at, b.c))));
      if (!m) throw Error(`${by}: the tangents at ${s.a} and ${s.b} are parallel (the points are opposite ends of a diameter), so they never meet.`);
      return m;
    }
    const f = need(s.from, by),
      a = need(s.a, by),
      b = need(s.b, by),
      u = sub(b, a);
    if (len(u) < 1e-6) throw Error(`${by} is the foot of a perpendicular to ${s.a}${s.b}, but those two points are in the same place.`);
    return add(a, mul(u, dot(sub(f, a), u) / dot(u, u)));
  };
  for (const p of d.points) need(p.id, `Point ${p.id}`);
  for (const c of d.circles) circle(c.id, `Circle ${c.id}`);
  return { points, circles };
}

/** A drawn straight piece in figure mm, with its marks. */
/** A drawn line: a and b include any extension; mid is the middle of the side between its two points, where marks go. */
export type Piece = { a: P; b: P; mid: P; style: LineStyle; ticks: number; arrows: number; id?: string };
/** An angle the figure marks: at vertex, from direction start, sweeping anticlockwise. */
export type Slot = { id: string; vertex: P; start: number; sweep: number; name: string };
export type Geometry = Resolved & { pieces: Piece[]; slots: Slot[]; obstacles: [P, P][] };

const CIRCLE_STEPS = 96;
function circleChords(c: P, r: number): [P, P][] {
  const out: [P, P][] = [];
  for (let i = 0; i < CIRCLE_STEPS; i++) out.push([add(c, mul(dir((360 * i) / CIRCLE_STEPS), r)), add(c, mul(dir((360 * (i + 1)) / CIRCLE_STEPS), r))]);
  return out;
}
const nameOf = (d: FigureDocument, pid: string) => d.points.find((p) => p.id === pid)?.name || pid;

export function geometry(d: FigureDocument): Geometry {
  const r = resolve(d);
  const at = (pid: string) => r.points.get(pid)!;
  const pieces: Piece[] = d.segments.map((s) => {
    const a = at(s.a),
      b = at(s.b),
      u = unit(sub(b, a));
    return { a: add(a, mul(u, -s.extend[0])), b: add(b, mul(u, s.extend[1])), mid: mul(add(a, b), 0.5), style: s.style, ticks: s.ticks, arrows: s.arrows, id: s.id };
  });
  const slots: Slot[] = d.angles.map((g) => {
    const v = at(g.at),
      start = heading(sub(at(g.from), v)),
      end = heading(sub(at(g.to), v));
    return { id: g.id, vertex: v, start, sweep: ccw(start, end), name: `angle ${nameOf(d, g.from)}${nameOf(d, g.at)}${nameOf(d, g.to)}` };
  });
  const obstacles: [P, P][] = pieces.map((p) => [p.a, p.b]);
  for (const c of r.circles.values()) obstacles.push(...circleChords(c.c, c.r));
  return { ...r, pieces, slots, obstacles };
}

/** The points (and, for an on place, the circle) a place is built on, read field by field. */
export function placeRefs(place: Place): { points: string[]; circle?: string } {
  switch (place.type) {
    case "free":
      return { points: [] };
    case "on":
      return { points: [], circle: place.circle };
    case "along":
    case "tangents":
      return { points: [place.a, place.b] };
    case "meet":
      return { points: [place.a, place.b, place.c, place.d] };
    case "tangent":
      return { points: [place.at] };
    case "foot":
      return { points: [place.from, place.a, place.b] };
  }
}
export type Dependents = { points: string[]; circles: string[]; segments: string[]; angles: string[]; fills: string[] };
/**
 * Everything built on a point or circle. direct: only objects that use it themselves; otherwise
 * also everything built on those, all the way down. The object itself is not listed.
 */
export function dependents(d: FigureDocument, kind: "point" | "circle", rid: string, direct = false): Dependents {
  const points = new Set<string>(kind === "point" ? [rid] : []),
    circles = new Set<string>(kind === "circle" ? [rid] : []);
  const builtOn = (place: Place, pts: Set<string>, cs: Set<string>) => {
    const r = placeRefs(place);
    return r.points.some((x) => pts.has(x)) || (r.circle !== undefined && cs.has(r.circle));
  };
  if (direct) {
    const pts = new Set(points),
      cs = new Set(circles);
    for (const c of d.circles) if (pts.has(c.centre)) circles.add(c.id);
    for (const p of d.points) if (builtOn(p.place, pts, cs)) points.add(p.id);
  } else
    for (let grew = true; grew; ) {
      grew = false;
      for (const c of d.circles)
        if (!circles.has(c.id) && points.has(c.centre)) {
          circles.add(c.id);
          grew = true;
        }
      for (const p of d.points)
        if (!points.has(p.id) && builtOn(p.place, points, circles)) {
          points.add(p.id);
          grew = true;
        }
    }
  // A direct check counts only what uses the object itself; a full one, everything removed with it.
  const used = (x: string) => (direct ? kind === "point" && x === rid : points.has(x));
  const out = {
    points: [...points].filter((x) => !(kind === "point" && x === rid)),
    circles: [...circles].filter((x) => !(kind === "circle" && x === rid)),
    segments: d.segments.filter((s) => used(s.a) || used(s.b)).map((s) => s.id),
    angles: d.angles.filter((a) => [a.at, a.from, a.to].some(used)).map((a) => a.id),
    fills: d.fills.filter((f) => f.points.some(used)).map((f) => f.id),
  };
  return out;
}

/* ---------- Validation ---------- */

const ID_KEYS = new Set(["id", "a", "b", "c", "d", "at", "from", "to", "centre", "circle", "points"]);
function noteError(path: (string | number)[], message: string): string {
  const where = path.join(".");
  // The last named key says which field is wrong; a number after it is a list position.
  const key = [...path].reverse().find((k): k is string => typeof k === "string") ?? "";
  if (key === "name") return "Use point names of at most 3 characters, such as A or B1.";
  if (key === "text" && path.includes("captions")) return `Use captions of at most 32 characters without markup (${where}).`;
  if (key === "text" || key === "answer") return `Use labels of at most ${MAX_LABEL} characters without markup (${where}).`;
  if (ID_KEYS.has(key) && (key !== "points" || typeof path[path.length - 1] === "number")) return `${where}: IDs are short lower-case names such as a, b2 or o (letters and digits, starting with a letter).`;
  if (key === "x" || key === "y") return `${where}: keep points within ${REACH} mm of the middle of the figure.`;
  if (key === "r") return `${where}: give a circle a radius from 5 to 90 mm.`;
  if (path[1] === "points" && path.length === 2) return `Use 1 to ${LIMITS.points} points.`;
  return `${where}: ${message}`;
}

export function validate(input: unknown): Envelope {
  const parsed = envelopeSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue?.path ?? [];
    throw Error(path.length > 1 ? noteError(path as (string | number)[], issue.message) : path.length ? `${path.join(".")}: ${issue.message}` : "This is not a supported geometry figure file (version 1 is supported).");
  }
  const e = parsed.data,
    d = e.document;
  const unique = (list: { id: string }[], what: string) => {
    const seen = new Set<string>();
    for (const x of list) {
      if (seen.has(x.id)) throw Error(`There are two ${what} called ${x.id}. Give each its own ID.`);
      seen.add(x.id);
    }
    return seen;
  };
  const pts = unique(d.points, "points");
  unique(d.circles, "circles");
  unique(d.segments, "segments");
  unique(d.angles, "angles");
  unique(d.fills, "fills");
  unique(d.captions, "captions");
  for (const c of d.circles) if (!pts.has(c.centre)) throw Error(`Circle ${c.id} has centre ${c.centre}, which is not a point in the figure.`);
  const g = resolve(d);
  const ref = (pid: string, by: string) => {
    if (!pts.has(pid)) throw Error(`${by} refers to point ${pid}, which is not in the figure.`);
    return g.points.get(pid)!;
  };
  const tidy = (l: Label, by: string, what: "length" | "size") => {
    l.text = l.text.trim().replace(/\s+/g, " ");
    l.answer = l.answer.trim().replace(/\s+/g, " ");
    if (l.state === "value" && l.answer) throw Error(`${by} is a given ${what}, so it cannot hold a saved answer. Clear the answer or change the label.`);
    if ((l.state === "value" || l.state === "symbol") && !l.text) throw Error(`${by} is ${l.state === "value" ? `a given ${what}` : "a letter"} but has no text. Type it, or make the label blank.`);
  };
  for (const s of d.segments) {
    const a = ref(s.a, `Segment ${s.id}`),
      b = ref(s.b, `Segment ${s.id}`);
    if (len(sub(b, a)) < 0.5) throw Error(`Segment ${s.id} joins ${s.a} and ${s.b}, which are in the same place.`);
    tidy(s.label, `The label on ${s.id}`, "length");
  }
  for (const a of d.angles) {
    const v = ref(a.at, `Angle ${a.id}`),
      p = ref(a.from, `Angle ${a.id}`),
      q = ref(a.to, `Angle ${a.id}`);
    if (len(sub(p, v)) < 0.5 || len(sub(q, v)) < 0.5) throw Error(`Angle ${a.id} has an arm with no length: its points are in the same place as its vertex ${a.at}.`);
    const sweep = ccw(heading(sub(p, v)), heading(sub(q, v)));
    if (sweep < 1 || sweep > 359) throw Error(`Angle ${a.id}'s arms point the same way, so there is no angle to mark.`);
    tidy(a.label, `Angle ${a.id}`, "size");
  }
  for (const f of d.fills) for (const pid of f.points) ref(pid, `Fill ${f.id}`);
  for (const p of d.points) p.name = p.name.trim();
  for (const c of d.captions) c.text = c.text.trim();
  d.captions = d.captions.filter((c) => c.text);
  return e;
}
const envelope = defineEnvelope<Envelope>({ kind: "figures", validate, canonical: "sorted" });
export const canonical = envelope.canonical;
export const hash = envelope.contentHash;
export function parseFile(text: string) {
  if (text.length > 60_000) throw Error("This editable file is too large.");
  return validate(JSON.parse(text));
}

const labels = (d: FigureDocument) => [...d.segments.map((s) => s.label), ...d.angles.map((a) => a.label)];
export const hasHidden = (e: Envelope) => labels(e.document).some((l) => l.state !== "value" && l.answer);

/* ---------- Building ---------- */

export function blank(): Envelope {
  return {
    kind: "figures",
    schemaVersion: 1,
    rendererVersion: RENDERER_VERSION,
    document: { points: [point("o", free(0, 0), "O", "dot")], circles: [], segments: [], angles: [], fills: [], captions: [], notToScale: true },
  };
}
/** A circle with a tangent, a chord and an angle in the alternate segment: a starting point for circle theorems. */
export function create(): Envelope {
  const e = blank(),
    d = e.document;
  d.circles = [{ id: "c", centre: "o", r: 25, style: "solid" }];
  d.points.push(point("a", on("c", 155), "A"), point("b", on("c", 270), "B"), point("c1", on("c", 30), "C"), point("s", { type: "tangent", at: "b", mm: -32 }, "S"), point("t", { type: "tangent", at: "b", mm: 32 }, "T"));
  d.segments = [segment("st", "s", "t"), segment("ab", "a", "b"), segment("bc", "b", "c1"), segment("ac", "a", "c1")];
  d.angles = [angle("cbt", "b", "t", "c1", label("62")), angle("bac", "a", "b", "c1", label("x", "symbol"))];
  return validate(e);
}

/* ---------- Text ---------- */

const n = (v: number) => String(Math.round(v * 1000) / 1000);
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const FAMILY = "STIX Two Text,STIX Two Math,serif";
const LINE_TEXT = "______";
/** What a label prints on one copy, and whether it is in the answer colour. Empty text prints nothing. Angle sizes take a degree sign. */
export function printed(l: Label, view: View, isAngle = false): { text: string; answer: boolean } {
  const fmt = (t: string) => (isAngle ? degrees(t) : t);
  if (view === "answer" && l.state !== "value" && l.answer) return { text: fmt(l.answer), answer: true };
  if (l.state === "value") return { text: fmt(l.text), answer: false };
  if (l.state === "symbol") return { text: fmt(l.text), answer: false };
  if (l.state === "answer-line") return { text: isAngle ? LINE_TEXT + "°" : LINE_TEXT, answer: false };
  return { text: "", answer: false };
}

/* ---------- Layout ---------- */

const MARGIN = 2;
const FRACTIONS = [0.5, 0.42, 0.58, 0.34, 0.66, 0.26, 0.74, 0.18, 0.82, 0.12, 0.88];
const ALONG = [0.5, 0.42, 0.58, 0.34, 0.66, 0.26, 0.74, 0.2, 0.8];
const ARC = 5;
const CAPTION = "Diagram NOT accurately drawn";
type Rect = { x: number; y: number; w: number; h: number };
export type PlacedText = { id: string; text: { pupil: string; answer: string }; centre: P; box: Rect; clear: boolean };
export type PlacedAngle = PlacedText & { slot: Slot; radius: number };
export type Layout = {
  width: number;
  height: number;
  font: number;
  /** Maps a figure point (mm, y up) to the artwork (mm, y down). */
  map: (p: P) => P;
  /** Maps an artwork point back to the figure (mm, y up). */
  unmap: (p: P) => P;
  geometry: Geometry;
  angles: PlacedAngle[];
  sides: PlacedText[];
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
const boxAt = (c: P, w: number, h: number): Rect => ({ x: c.x - w / 2, y: c.y - h / 2, w, h });
/** Arc radius for a marked angle: small angles get a wider arc so the mark can be seen. */
export const arcRadius = (sweep: number) => (sweep < 25 ? ARC + 4 : sweep < 45 ? ARC + 2 : ARC);
/** Distance from a box's centre to its edge in direction u. */
const reachOf = (u: P, w: number, h: number) => Math.abs(u.x) * w * 0.5 + Math.abs(u.y) * h * 0.5;

/** Directions (degrees) of everything drawn out of a point: segment arms, lines through it, and a circle's curve. */
function directionsAt(d: FigureDocument, g: Geometry, pid: string): number[] {
  const at = g.points.get(pid)!;
  const out: number[] = [];
  for (const s of d.segments) {
    const piece = g.pieces.find((p) => p.id === s.id)!;
    for (const end of [piece.a, piece.b]) {
      const v = sub(end, at);
      if (len(v) < 0.3) continue;
      // The point is on this piece if it lies within it.
      const along = dot(sub(at, piece.a), unit(sub(piece.b, piece.a))),
        off = Math.abs(cross(unit(sub(piece.b, piece.a)), sub(at, piece.a)));
      if (off < 0.3 && along > -0.3 && along < len(sub(piece.b, piece.a)) + 0.3) out.push(heading(v));
    }
  }
  for (const c of g.circles.values()) {
    const v = sub(at, c.c);
    if (Math.abs(len(v) - c.r) < 0.3) {
      const t = heading(perp(v));
      out.push(t, norm(t + 180), heading(mul(v, -1)));
    }
  }
  for (const a of d.angles)
    if (a.at === pid) {
      const slot = g.slots.find((s) => s.id === a.id)!;
      out.push(norm(slot.start + slot.sweep / 2));
    }
  return out;
}
/** The direction with most room round a point: the middle of the widest gap between its lines. */
function roomiest(dirs: number[], fallback = 90): number {
  if (!dirs.length) return fallback;
  const s = [...new Set(dirs.map((x) => Math.round(norm(x) * 1000) / 1000))].sort((a, b) => a - b);
  if (s.length === 1) return norm(s[0] + 180);
  let best = 0,
    at = fallback;
  for (let i = 0; i < s.length; i++) {
    const a = s[i],
      b = i + 1 < s.length ? s[i + 1] : s[0] + 360;
    if (b - a > best + 1e-6) {
      best = b - a;
      at = norm(a + (b - a) / 2);
    }
  }
  return at;
}

/** The middle of the points joined to a segment, so a side's label can go outside its shape. */
function shapeCentre(d: FigureDocument, g: Geometry, s: Segment): P {
  // Points joined to either end through other segments (one step), weighted equally.
  const near = new Set<string>([s.a, s.b]);
  for (const t of d.segments) {
    if (t.id === s.id) continue;
    if (near.has(t.a) || near.has(t.b)) {
      near.add(t.a);
      near.add(t.b);
    }
  }
  for (const c of d.circles) {
    const cc = g.circles.get(c.id)!;
    for (const pid of [s.a, s.b]) if (Math.abs(len(sub(g.points.get(pid)!, cc.c)) - cc.r) < 0.3) near.add(c.centre);
  }
  const list = [...near].map((p) => g.points.get(p)!);
  return mul(list.reduce(add, { x: 0, y: 0 }), 1 / list.length);
}

/**
 * Places every label once, sized for the wider of its pupil and answers text, so both copies share
 * one layout. Angle labels sit just beyond their arc, side labels beside their side and point names
 * in the widest gap between the lines at the point, all clear of lines and of each other.
 */
export function layout(e: Envelope): Layout {
  const d = e.document,
    font = ((d.fontPt ?? 11) * 25.4) / 72;
  const g = geometry(d);
  const slots = new Map(g.slots.map((s) => [s.id, s]));
  const issues: string[] = [];
  const placed: Rect[] = [];
  const clearOf = (box: Rect, pad = 0.5) => !g.obstacles.some(([a, b]) => hitsSegment(grow(box, pad), a, b)) && !placed.some((p) => overlaps(p, box));
  // Dots and crosses are obstacles for text too.
  for (const p of d.points) if (p.show !== "none") placed.push(boxAt(g.points.get(p.id)!, 1.6, 1.6));

  const angles: PlacedAngle[] = [];
  for (const a of d.angles) {
    const slot = slots.get(a.id)!;
    const radius = arcRadius(slot.sweep) + (a.mark === "double" ? 1 : a.mark === "triple" ? 2 : 0);
    const text = { pupil: printed(a.label, "pupil", true).text, answer: printed(a.label, "answer", true).text };
    const w = Math.max(text.pupil ? textWidth(text.pupil, font) : 0, text.answer ? textWidth(text.answer, font) : 0);
    if (!w) {
      angles.push({ id: a.id, text, slot, radius, centre: slot.vertex, box: boxAt(slot.vertex, 0, 0), clear: true });
      continue;
    }
    const h = Math.max(textHeight(text.pupil, font), textHeight(text.answer, font));
    let chosen: Rect | null = null;
    // Nearest clear place inside the angle: first clear of everything close to the arc, then
    // allowing it to sit across a circle's curve (straight lines and labels stay clear), then
    // further out.
    const passes: [number, (b: Rect) => boolean][] = [
      [20, (b) => clearOf(b)],
      [20, (b) => !g.pieces.some((pc) => hitsSegment(grow(b, 0.5), pc.a, pc.b)) && !placed.some((q) => overlaps(q, b))],
      [40, (b) => clearOf(b)],
    ];
    // In each pass the clear place whose middle is nearest the vertex wins (on the bisector on a tie).
    for (const [reach, ok] of passes) {
      let best = Infinity;
      for (let dist = radius + 0.8; dist < radius + reach; dist += 0.4)
        for (const t of FRACTIONS) {
          const u = dir(slot.start + slot.sweep * t);
          const at = dist + reachOf(u, w, h);
          if (at >= best - 1e-9) continue;
          const box = boxAt(add(slot.vertex, mul(u, at)), w, h);
          if (ok(box)) {
            chosen = box;
            best = at;
          }
        }
      if (chosen) break;
    }
    const clear = chosen !== null;
    if (!chosen) {
      const u = dir(slot.start + slot.sweep / 2);
      chosen = boxAt(add(slot.vertex, mul(u, radius + 2 + reachOf(u, w, h))), w, h);
      issues.push(`The label for ${slot.name} (${a.id}) has no clear space. Make the figure larger or the label shorter.`);
    }
    placed.push(chosen);
    angles.push({ id: a.id, text, slot, radius, centre: { x: chosen.x + w / 2, y: chosen.y + h / 2 }, box: chosen, clear });
  }

  const sides: PlacedText[] = [];
  for (const s of d.segments) {
    const text = { pupil: printed(s.label, "pupil").text, answer: printed(s.label, "answer").text };
    const w = Math.max(text.pupil ? textWidth(text.pupil, font) : 0, text.answer ? textWidth(text.answer, font) : 0);
    if (!w) continue;
    const h = Math.max(textHeight(text.pupil, font), textHeight(text.answer, font));
    const a = g.points.get(s.a)!,
      b = g.points.get(s.b)!,
      u = unit(sub(b, a)),
      left = perp(u);
    const centre = shapeCentre(d, g, s);
    const outside = dot(sub(centre, a), left) > 0 ? -1 : 1;
    const order = s.side === "left" ? [1] : s.side === "right" ? [-1] : [outside, -outside];
    let chosen: Rect | null = null;
    search: for (const sign of order)
      for (let dist = 1.2; dist < 14; dist += 0.4)
        for (const t of ALONG) {
          const nrm = mul(left, sign);
          const box = boxAt(add(add(a, mul(sub(b, a), t)), mul(nrm, dist + reachOf(nrm, w, h))), w, h);
          if (clearOf(box, 0.4)) {
            chosen = box;
            break search;
          }
        }
    const clear = chosen !== null;
    if (!chosen) {
      const nrm = mul(left, order[0]);
      chosen = boxAt(add(mul(add(a, b), 0.5), mul(nrm, 1.5 + reachOf(nrm, w, h))), w, h);
      issues.push(`The label on ${nameOf(d, s.a)}${nameOf(d, s.b)} (${s.id}) has no clear space. Make the figure larger or the label shorter.`);
    }
    placed.push(chosen);
    sides.push({ id: s.id, text, centre: { x: chosen.x + w / 2, y: chosen.y + h / 2 }, box: chosen, clear });
  }

  const names: Layout["names"] = [];
  for (const p of d.points) {
    if (!p.name) continue;
    const at = g.points.get(p.id)!;
    const w = textWidth(p.name, font),
      h = font * 1.05;
    const best = roomiest(directionsAt(d, g, p.id));
    let centre: P | null = null;
    search: for (let dist = 0.9; dist < 12; dist += 0.3)
      for (const off of [0, -12, 12, -24, 24, -36, 36, -50, 50]) {
        const u = dir(best + off);
        const c = add(at, mul(u, dist + reachOf(u, w, h)));
        if (clearOf(boxAt(c, w, h), 0.3)) {
          centre = c;
          break search;
        }
      }
    if (!centre) {
      const u = dir(best);
      centre = add(at, mul(u, 1.5 + reachOf(u, w, h)));
      issues.push(`Point ${p.name} (${p.id}) has no clear space for its name. Make the figure larger.`);
    }
    placed.push(boxAt(centre, w, h));
    names.push({ id: p.id, text: p.name, centre });
  }

  // Bounds in y-up mm.
  const xs: number[] = [],
    ys: number[] = [];
  const take = (p: P) => {
    xs.push(p.x);
    ys.push(p.y);
  };
  for (const pc of g.pieces) {
    take(pc.a);
    take(pc.b);
  }
  for (const c of g.circles.values()) {
    take(add(c.c, { x: c.r, y: c.r }));
    take(sub(c.c, { x: c.r, y: c.r }));
  }
  for (const p of g.points.values()) take(p);
  for (const l of angles) {
    const reach = l.radius + (d.angles.find((a) => a.id === l.id)!.shade ? 1.5 : 0.3);
    for (let i = 0; i <= 16; i++) take(add(l.slot.vertex, mul(dir(l.slot.start + (l.slot.sweep * i) / 16), reach)));
  }
  for (const r of placed) {
    take({ x: r.x, y: r.y });
    take({ x: r.x + r.w, y: r.y + r.h });
  }
  const capFont = font;
  for (const c of d.captions) {
    const w = textWidth(c.text, capFont);
    take({ x: c.x - w / 2, y: c.y - capFont * 0.55 });
    take({ x: c.x + w / 2, y: c.y + capFont * 0.55 });
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
  const unmap = (p: P): P => ({ x: p.x + minX, y: maxY - p.y });
  const width = Math.ceil((maxX - minX) * 10) / 10;
  height = Math.ceil(height * 10) / 10;
  if (width > 270) issues.push(`The figure is ${n(width / 10)} cm wide. Make it smaller.`);
  if (height > 270) issues.push(`The figure is ${n(height / 10)} cm tall. Make it smaller.`);
  return { width, height, font, map, unmap, geometry: g, angles, sides, names, caption, issues, notes: teacherNotes(d, g) };
}

/** Teacher-only notes (never printed): a right-angle mark on an angle drawn far from 90°, and repeated point names. */
export function teacherNotes(d: FigureDocument, g: Geometry = geometry(d)): string[] {
  const notes: string[] = [];
  for (const a of d.angles) {
    const s = g.slots.find((x) => x.id === a.id)!;
    if (a.mark === "right" && Math.abs(s.sweep - 90) > 10) notes.push(`Angle ${a.id} (${s.name}) has a right-angle mark but is drawn at ${Math.round(s.sweep)}°.`);
  }
  const seen = new Map<string, string>();
  for (const p of d.points) {
    if (!p.name) continue;
    const before = seen.get(p.name);
    if (before) notes.push(`Points ${before} and ${p.id} are both named ${p.name}.`);
    else seen.set(p.name, p.id);
  }
  return notes;
}
export const exportIssue = (e: Envelope) => layout(e).issues.join(" ") || null;
export const warnings = (e: Envelope) => {
  const g = layout(e);
  return [...g.issues, ...g.notes];
};

/* ---------- SVG ---------- */

const MAIN = 0.26; // 0.75 pt, as Edexcel's geometry diagrams
const THIN = 0.2;
const dash = (style: LineStyle) => (style === "dashed" ? ' stroke-dasharray="1.6 1.1"' : style === "dotted" ? ' stroke-dasharray="0.15 0.7" stroke-linecap="round"' : "");
function arcPath(c: P, r: number, start: number, sweep: number, map: Layout["map"]) {
  const a = map(add(c, mul(dir(start), r))),
    b = map(add(c, mul(dir(start + sweep), r)));
  // SVG y runs down, so an anticlockwise sweep in the figure is sweep-flag 0.
  return `M${n(a.x)} ${n(a.y)}A${n(r)} ${n(r)} 0 ${sweep > 180 ? 1 : 0} 0 ${n(b.x)} ${n(b.y)}`;
}
function rightMark(s: Slot, map: Layout["map"]) {
  const k = 2.6,
    u = mul(dir(s.start), k),
    v = mul(dir(s.start + s.sweep), k);
  const p1 = map(add(s.vertex, u)),
    p2 = map(add(add(s.vertex, u), v)),
    p3 = map(add(s.vertex, v));
  return `M${n(p1.x)} ${n(p1.y)}L${n(p2.x)} ${n(p2.y)}L${n(p3.x)} ${n(p3.y)}`;
}
function chevrons(s: Piece, count: number, map: Layout["map"]) {
  // Open arrowheads pointing along the line at the middle of the side, as on exam papers.
  const u = unit(sub(s.b, s.a)),
    nrm = perp(u),
    mid = s.mid,
    out: string[] = [];
  for (let i = 0; i < count; i++) {
    const tip = add(mid, mul(u, (i - (count - 1) / 2) * 1.6 + 0.9));
    const back = add(tip, mul(u, -1.8));
    const p = map(add(back, mul(nrm, 1.0))),
      t = map(tip),
      q = map(add(back, mul(nrm, -1.0)));
    out.push(`M${n(p.x)} ${n(p.y)}L${n(t.x)} ${n(t.y)}L${n(q.x)} ${n(q.y)}`);
  }
  return out.join("");
}
function tickMarks(s: Piece, count: number, map: Layout["map"]) {
  const u = unit(sub(s.b, s.a)),
    nrm = perp(u),
    mid = s.mid,
    out: string[] = [];
  for (let i = 0; i < count; i++) {
    const c = add(mid, mul(u, (i - (count - 1) / 2) * 0.9));
    const p = map(add(c, mul(nrm, 1.3))),
      q = map(add(c, mul(nrm, -1.3)));
    out.push(`M${n(p.x)} ${n(p.y)}L${n(q.x)} ${n(q.y)}`);
  }
  return out.join("");
}

/** The artwork at its printed size in mm. The answers copy adds saved answers in the answer colour. */
export function renderSvg(e: Envelope, view: View = "pupil"): string {
  const d = validate(structuredClone(e)).document;
  const g = layout({ ...e, document: d });
  const map = g.map,
    geo = g.geometry;
  const out: string[] = [`<rect width="${n(g.width)}" height="${n(g.height)}" fill="white"/>`];
  const pt = (p: P) => {
    const m = map(p);
    return `${n(m.x)} ${n(m.y)}`;
  };
  // Grey fills and angle shading first, under every line.
  for (const f of d.fills) out.push(`<path d="M${f.points.map((pid) => pt(geo.points.get(pid)!)).join("L")}Z" fill="#c8c8c8" stroke="none"/>`);
  for (const l of g.angles) {
    if (!d.angles.find((a) => a.id === l.id)!.shade) continue;
    const arc = arcPath(l.slot.vertex, l.radius + 1.5, l.slot.start, l.slot.sweep, map);
    out.push(`<path d="M${pt(l.slot.vertex)}L${arc.slice(1)}Z" fill="#d9d9d9" stroke="none"/>`);
  }
  for (const c of geo.circles.values()) {
    const m = map(c.c);
    out.push(`<circle cx="${n(m.x)}" cy="${n(m.y)}" r="${n(c.r)}" fill="none" stroke="black" stroke-width="${MAIN}"${dash(c.style)}/>`);
  }
  for (const style of STYLES) {
    const list = geo.pieces.filter((p) => p.style === style);
    if (list.length) out.push(`<path d="${list.map((p) => `M${pt(p.a)}L${pt(p.b)}`).join("")}" fill="none" stroke="black" stroke-width="${MAIN}" stroke-linecap="round"${dash(style)}/>`);
  }
  const marks: string[] = [];
  for (const p of geo.pieces) {
    if (p.arrows) marks.push(chevrons(p, p.arrows, map));
    if (p.ticks) marks.push(tickMarks(p, p.ticks, map));
  }
  for (const l of g.angles) {
    const a = d.angles.find((x) => x.id === l.id)!;
    if (a.mark === "none") continue;
    if (a.mark === "right") marks.push(rightMark(l.slot, map));
    else {
      const count = a.mark === "double" ? 2 : a.mark === "triple" ? 3 : 1;
      const base = arcRadius(l.slot.sweep);
      for (let i = 0; i < count; i++) marks.push(arcPath(l.slot.vertex, base + i * 0.9, l.slot.start, l.slot.sweep, map));
    }
  }
  if (marks.length) out.push(`<path d="${marks.join("")}" fill="none" stroke="black" stroke-width="${THIN}" stroke-linejoin="round"/>`);
  for (const p of d.points) {
    const m = map(geo.points.get(p.id)!);
    if (p.show === "dot") out.push(`<circle cx="${n(m.x)}" cy="${n(m.y)}" r="0.5" fill="black"/>`);
    if (p.show === "cross") out.push(`<path d="M${n(m.x - 0.9)} ${n(m.y - 0.9)}L${n(m.x + 0.9)} ${n(m.y + 0.9)}M${n(m.x - 0.9)} ${n(m.y + 0.9)}L${n(m.x + 0.9)} ${n(m.y - 0.9)}" stroke="black" stroke-width="${THIN}"/>`);
  }
  const texts: string[] = [];
  for (const l of [...g.angles, ...g.sides]) {
    const isAngle = "slot" in l;
    const lab = isAngle ? d.angles.find((a) => a.id === l.id)!.label : d.segments.find((s) => s.id === l.id)!.label;
    const p = printed(lab, view, isAngle);
    if (!p.text) continue;
    const c = map(l.centre);
    texts.push(textSvg(p.text, c.x, c.y, g.font, p.answer ? ANSWER_COLOUR : "black"));
  }
  for (const nm of g.names) {
    const c = map(nm.centre);
    // Point names are italic capitals, as on exam papers.
    texts.push(`<text x="${n(c.x)}" y="${n(c.y + g.font * 0.34)}" text-anchor="middle" font-family="${FAMILY}" font-size="${n(g.font)}" font-style="italic" fill="black">${esc(nm.text)}</text>`);
  }
  for (const c of d.captions) {
    const m = map({ x: c.x, y: c.y });
    texts.push(`<text x="${n(m.x)}" y="${n(m.y + g.font * 0.34)}" text-anchor="middle" font-family="${FAMILY}" font-size="${n(g.font)}"${c.bold ? ' font-weight="bold"' : ""} fill="black">${esc(c.text)}</text>`);
  }
  if (g.caption)
    texts.push(`<text x="${n(g.caption.x)}" y="${n(g.caption.y)}" text-anchor="middle" font-family="${FAMILY}" font-size="${n((MIN_TEXT_PT * 25.4) / 72)}" fill="black">${CAPTION}</text>`);
  out.push(...texts);
  const body = boldLines(out.join(""), d.lines);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${n(g.width)}mm" height="${n(g.height)}mm" viewBox="0 0 ${n(g.width)} ${n(g.height)}" role="img" aria-label="${esc(altText(e))}">${body}</svg>`;
}

/** Plain description of the pupil copy; it never names a saved answer. */
export function altText(e: Envelope): string {
  const d = e.document;
  const named = d.points.filter((p) => p.name).map((p) => p.name);
  const parts = [`Geometry figure${d.circles.length ? ` with ${d.circles.length === 1 ? "a circle" : `${d.circles.length} circles`}` : ""}`];
  if (named.length) parts.push(`points ${named.join(", ")}`);
  const sides = d.segments.filter((s) => s.label.state === "value").map((s) => `${nameOf(d, s.a)}${nameOf(d, s.b)} ${s.label.text}`);
  if (sides.length) parts.push(`lengths ${sides.join(", ")}`);
  const given = d.angles.filter((a) => a.label.state === "value").map((a) => `angle ${nameOf(d, a.from)}${nameOf(d, a.at)}${nameOf(d, a.to)} ${degrees(a.label.text)}`);
  if (given.length) parts.push(given.join(", "));
  const letters = [...d.angles, ...d.segments].filter((x) => x.label.state === "symbol").map((x) => x.label.text);
  if (letters.length) parts.push(`marked ${letters.join(", ")}`);
  return parts.join("; ") + (d.notToScale ? ". Not accurately drawn." : ".");
}

/* ---------- Links ---------- */

export const MAX_LINK_LENGTH = 16_000;
export const LINK_PREFIX = "#figures=";
export const linkHash = (e: Envelope): string => LINK_PREFIX + envelope.encodeLink(e);
/** The website editor link, or null when the figure is too large for a link. */
export function editorLink(e: Envelope, base: string): string | null {
  const url = new URL(base);
  url.pathname = url.pathname.replace(/(\/tools(\/[^/]*)?)?\/?$/, "/") + "tools/figures";
  url.search = "";
  url.hash = linkHash(e);
  return url.href.length <= MAX_LINK_LENGTH ? url.href : null;
}
export function decodeLinkHash(hashText: string): Envelope {
  if (!/^#figures=[A-Za-z0-9_-]+$/.test(hashText) || hashText.length > MAX_LINK_LENGTH) throw Error("This is not a supported geometry figure link. Open an editable file instead.");
  try {
    return envelope.decodeLink(hashText.slice(LINK_PREFIX.length), MAX_LINK_LENGTH);
  } catch {
    throw Error("This geometry figure link could not be read. Open an editable file instead.");
  }
}

/* ---------- Dragging (editor only) ---------- */

/** The points a teacher can drag: free points anywhere, points on a circle round it, points along a line or tangent along it. */
export function dragHandles(d: FigureDocument): { id: string; name: string }[] {
  return d.points.filter((p) => ["free", "on", "along", "tangent"].includes(p.place.type)).map((p) => ({ id: p.id, name: `point ${p.name || p.id}` }));
}
/**
 * The figure with one point dragged towards p (figure mm, y up), or null when the move is refused.
 * Free points snap to 1 mm (0.5 with fine), directions round a circle to 5° (1° with fine), and
 * positions along a line or tangent to 0.05 of its length or 1 mm.
 */
export function dragTo(e: Envelope, pid: string, p: P, fine = false): Envelope | null {
  const next = structuredClone(e),
    d = next.document,
    pnt = d.points.find((x) => x.id === pid);
  if (!pnt) return null;
  const g = resolve(d),
    s = pnt.place;
  const snap = (v: number, step: number) => Math.round(v / step) * step;
  if (s.type === "free") pnt.place = { type: "free", x: Math.max(-REACH, Math.min(REACH, snap(p.x, fine ? 0.5 : 1))), y: Math.max(-REACH, Math.min(REACH, snap(p.y, fine ? 0.5 : 1))) };
  else if (s.type === "on") {
    const c = g.circles.get(s.circle)!;
    pnt.place = { ...s, deg: norm(snap(heading(sub(p, c.c)), fine ? 1 : 5)) };
  } else if (s.type === "along") {
    const a = g.points.get(s.a)!,
      b = g.points.get(s.b)!,
      u = sub(b, a);
    pnt.place = { ...s, t: Math.max(-3, Math.min(4, snap(dot(sub(p, a), u) / dot(u, u), fine ? 0.01 : 0.05))) };
  } else if (s.type === "tangent") {
    const at = g.points.get(s.at)!,
      host = d.points.find((x) => x.id === s.at)!.place as Extract<Place, { type: "on" }>,
      c = g.circles.get(host.circle)!;
    pnt.place = { ...s, mm: Math.max(-200, Math.min(200, snap(dot(sub(p, at), perp(unit(sub(at, c.c)))), fine ? 0.5 : 1))) };
  } else return null;
  try {
    return validate(next);
  } catch {
    return null;
  }
}

/** Where the editor puts each label's select button (artwork mm): on the text if there is one, else in the angle or at the side's middle. */
export function hitAnchors(e: Envelope, g: Layout = layout(e)): { id: string; kind: "angle" | "segment" | "point"; name: string; at: P }[] {
  const d = e.document,
    out: { id: string; kind: "angle" | "segment" | "point"; name: string; at: P }[] = [];
  for (const l of g.angles) out.push({ id: l.id, kind: "angle", name: l.slot.name, at: g.map(l.box.w ? l.centre : add(l.slot.vertex, mul(dir(l.slot.start + l.slot.sweep / 2), l.radius + 2.5))) });
  for (const s of d.segments) {
    const placed = g.sides.find((x) => x.id === s.id);
    const a = g.geometry.points.get(s.a)!,
      b = g.geometry.points.get(s.b)!;
    out.push({ id: s.id, kind: "segment", name: `side ${nameOf(d, s.a)}${nameOf(d, s.b)}`, at: g.map(placed ? placed.centre : mul(add(a, b), 0.5)) });
  }
  for (const p of d.points) out.push({ id: p.id, kind: "point", name: `point ${p.name || p.id}`, at: g.map(g.geometry.points.get(p.id)!) });
  return out;
}
