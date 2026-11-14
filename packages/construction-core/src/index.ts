import { z } from "zod";
import { glyphAdvance } from "../../ratio-table-core/src/font-metrics";

/**
 * Constructions, loci, scale drawings and bearings (Hanley GM8), drawn at true size on plain or
 * centimetre-squared paper so pupils can construct on the printed sheet with a ruler, compasses
 * and a protractor.
 *
 * Coordinates are centimetres with y upwards and the origin at the bottom-left of the drawing
 * area (the frame). One centimetre in the document is one printed centimetre: preview zoom and
 * worksheet placement never change it.
 *
 * Every point and object has a role. "given" is printed on both copies. "answer" is a saved answer:
 * it is left out of the pupil copy and printed on the answer copy. A label also has its own
 * visibility, so a segment can be given while its length is a hidden answer. An empty shown label
 * prints nothing. Nothing is constructed, measured or shaded except by the explicit helpers below.
 */
export const MAX_POINTS = 40;
export const MAX_OBJECTS = 120;
export const MAX_RULES = 6;
export const WIDTH = { minimum: 2, maximum: 26 } as const;
export const HEIGHT = { minimum: 2, maximum: 30 } as const;

const plain = (max: number) =>
  z
    .string()
    .max(max)
    .refine((s) => ![...s].some((c) => c.charCodeAt(0) < 32 || c === "<" || c === ">"), "Use ordinary text without markup.");
const show = z.enum(["show", "hidden"]);
export const labelSchema = z.object({ text: plain(40), show }).strict();
const role = z.enum(["given", "answer"]);
const id = z.string().regex(/^[A-Za-z][A-Za-z0-9_'-]{0,15}$/, "Use IDs such as A, B2 or pb1-arc1.");
const cm = (min: number, max: number) => z.number().finite().min(min).max(max);
const coord = cm(-5, 35);
const group = id.optional();
const compass = z.enum(["auto", "n", "ne", "e", "se", "s", "sw", "w", "nw"]);

export const pointSchema = z
  .object({
    id,
    x: coord,
    y: coord,
    /** Printed beside the point in italics, as on exam papers. */
    label: labelSchema,
    labelAt: compass,
    mark: z.enum(["cross", "dot", "none"]),
    role,
    group,
  })
  .strict();

const base = { id, role, group };
export const segmentSchema = z
  .object({
    ...base,
    type: z.literal("segment"),
    from: id,
    to: id,
    /** Centimetres drawn beyond each end: [beyond from, beyond to]. Use it for lines and rays. */
    extend: z.tuple([cm(0, 30), cm(0, 30)]),
    dash: z.boolean(),
    /** Printed beside the middle of the segment, for example "7 cm" or "40 m". */
    label: labelSchema,
  })
  .strict();
export const arcSchema = z
  .object({
    ...base,
    type: z.literal("arc"),
    center: id,
    radius: cm(0.1, 30),
    /** Degrees anticlockwise from east (the positive x direction). */
    start: z.number().finite().min(-720).max(720),
    /** Degrees turned from start: positive anticlockwise, negative clockwise; 360 draws a circle. */
    sweep: z.number().finite().min(-360).max(360).refine((v) => Math.abs(v) >= 0.5, "An arc needs a sweep of at least 0.5 degrees."),
    dash: z.boolean(),
  })
  .strict();
export const angleSchema = z
  .object({
    ...base,
    type: z.literal("angle"),
    at: id,
    from: id,
    to: id,
    /** "arc" marks the angle with an arc; "right" draws the small square. */
    style: z.enum(["arc", "right"]),
    reflex: z.boolean(),
    label: labelSchema,
  })
  .strict();
export const northSchema = z
  .object({ ...base, type: z.literal("north"), at: id, length: cm(0.8, 12) })
  .strict();
export const bearingSchema = z
  .object({
    ...base,
    type: z.literal("bearing"),
    from: id,
    to: id,
    /** Also draw a north line at `from` (leave false when a separate north object is there). */
    northLine: z.boolean(),
    /** For example "065°". The bearing is only measured by the explicit measure helper. */
    label: labelSchema,
  })
  .strict();
export const polygonSchema = z
  .object({ ...base, type: z.literal("polygon"), points: z.array(id).min(3).max(12), dash: z.boolean() })
  .strict();
export const textSchema = z
  .object({ ...base, type: z.literal("text"), x: coord, y: coord, label: labelSchema, italic: z.boolean() })
  .strict();
/** One condition a shaded point satisfies; a region shades the points that satisfy all of them. */
export const ruleSchema = z.discriminatedUnion("kind", [
  /** Within (or beyond) a distance of a point or a segment. */
  z.object({ kind: z.literal("distance"), from: id, distance: cm(0.05, 40), side: z.enum(["within", "beyond"]) }).strict(),
  /** Closer to one point (or segment) than to another: one side of a perpendicular or angle bisector. */
  z.object({ kind: z.literal("closer"), to: id, than: id }).strict(),
  /** Inside (or outside) a polygon object. */
  z.object({ kind: z.literal("inside"), shape: id, side: z.enum(["within", "beyond"]) }).strict(),
]);
export const regionSchema = z
  .object({
    ...base,
    type: z.literal("region"),
    rules: z.array(ruleSchema).min(1).max(MAX_RULES),
    /** Diagonal hatching, or hatching both ways. Shading is never solid, so it prints in black and white. */
    pattern: z.enum(["hatch", "cross"]),
  })
  .strict();
export const objectSchema = z.discriminatedUnion("type", [
  segmentSchema,
  arcSchema,
  angleSchema,
  northSchema,
  bearingSchema,
  polygonSchema,
  textSchema,
  regionSchema,
]);
export const documentSchema = z
  .object({
    /** The drawing area in centimetres; it is always printed at this size, with room to construct. */
    width: cm(WIDTH.minimum, WIDTH.maximum),
    height: cm(HEIGHT.minimum, HEIGHT.maximum),
    grid: z.enum(["none", "cm"]),
    border: z.boolean(),
    /** Printed in a box under the drawing, for example "Scale: 1 cm represents 4 km". */
    caption: labelSchema,
    points: z.array(pointSchema).max(MAX_POINTS),
    objects: z.array(objectSchema).max(MAX_OBJECTS),
  })
  .strict();
export const envelopeSchema = z
  .object({
    tool: z.literal("construction"),
    schemaVersion: z.literal(1),
    rendererVersion: z.literal("construction-1"),
    document: documentSchema,
  })
  .strict();

export type Envelope = z.infer<typeof envelopeSchema>;
export type ConstructionDocument = Envelope["document"];
export type Point = z.infer<typeof pointSchema>;
export type Obj = z.infer<typeof objectSchema>;
export type Rule = z.infer<typeof ruleSchema>;
export type Label = z.infer<typeof labelSchema>;
export type Role = Point["role"];
export type View = "pupil" | "answer";
type Of<T extends Obj["type"]> = Extract<Obj, { type: T }>;

export const label = (text = "", visibility: Label["show"] = "show"): Label => ({ text, show: visibility });

/* ---------- Validation ---------- */

const refsOf = (o: Obj): string[] => {
  switch (o.type) {
    case "segment":
      return [o.from, o.to];
    case "arc":
      return [o.center];
    case "angle":
      return [o.at, o.from, o.to];
    case "north":
      return [o.at];
    case "bearing":
      return [o.from, o.to];
    case "polygon":
      return o.points;
    case "text":
      return [];
    case "region":
      return o.rules.flatMap((r) => (r.kind === "distance" ? [r.from] : r.kind === "closer" ? [r.to, r.than] : [r.shape]));
  }
};
/** Point and object IDs that this object depends on. */
export const references = refsOf;

export function validate(input: unknown): Envelope {
  const parsed = envelopeSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue?.path ?? [];
    const where = path.join(".");
    if (path.includes("width")) throw Error(`Choose a drawing width from ${WIDTH.minimum} to ${WIDTH.maximum} cm.`);
    if (path.includes("height")) throw Error(`Choose a drawing height from ${HEIGHT.minimum} to ${HEIGHT.maximum} cm.`);
    if (path[1] === "points" && path.length === 2) throw Error(`Use at most ${MAX_POINTS} points.`);
    if (path[1] === "objects" && path.length === 2) throw Error(`Use at most ${MAX_OBJECTS} objects.`);
    if (path.includes("text")) throw Error("Use labels of at most 40 characters, without markup.");
    throw Error(where ? `${where}: ${issue.message}` : "This is not a supported construction file (version 1 is supported).");
  }
  const e = parsed.data,
    d = e.document;
  const points = new Set<string>(),
    objects = new Map<string, Obj>();
  for (const p of d.points) {
    if (points.has(p.id)) throw Error(`Point ${p.id} appears twice.`);
    points.add(p.id);
  }
  for (const o of d.objects) {
    if (points.has(o.id) || objects.has(o.id)) throw Error(`The ID ${o.id} is used twice.`);
    objects.set(o.id, o);
  }
  const point = (ref: string, what: string) => {
    if (!points.has(ref)) throw Error(`${what} names point ${ref}, which is not in the drawing.`);
  };
  for (const o of d.objects) {
    const what = `${o.type} ${o.id}`;
    if (o.type === "region") {
      for (const r of o.rules) {
        const refs = r.kind === "distance" ? [r.from] : r.kind === "closer" ? [r.to, r.than] : [r.shape];
        for (const ref of refs) {
          const target = objects.get(ref);
          if (r.kind === "inside") {
            if (target?.type !== "polygon") throw Error(`${what} needs a polygon for "inside"; ${ref} is not one.`);
          } else if (!points.has(ref) && target?.type !== "segment")
            throw Error(`${what} measures from ${ref}; use a point or a segment.`);
        }
        if (r.kind === "closer") {
          const kinds = [r.to, r.than].map((x) => (points.has(x) ? "point" : "segment"));
          if (r.to === r.than) throw Error(`${what}: "closer" needs two different points or segments.`);
          if (kinds[0] !== kinds[1]) throw Error(`${what}: "closer" compares two points or two segments.`);
        }
      }
      continue;
    }
    for (const ref of refsOf(o)) point(ref, what);
    if (o.type === "segment" && o.from === o.to) throw Error(`${what} needs two different points.`);
    if (o.type === "bearing" && o.from === o.to) throw Error(`${what} needs two different points.`);
    if (o.type === "angle" && (o.at === o.from || o.at === o.to || o.from === o.to))
      throw Error(`${what} needs a vertex and two other points.`);
  }
  const byId = new Map(d.points.map((p) => [p.id, p]));
  for (const o of d.objects) {
    if (o.type === "segment" || o.type === "bearing") {
      const a = byId.get(o.from)!,
        b = byId.get(o.to)!;
      if (Math.hypot(a.x - b.x, a.y - b.y) < 0.01) throw Error(`${o.type} ${o.id} joins two points in the same place.`);
    }
    if (o.type === "angle") {
      const v = byId.get(o.at)!;
      for (const p of [byId.get(o.from)!, byId.get(o.to)!])
        if (Math.hypot(p.x - v.x, p.y - v.y) < 0.01) throw Error(`angle ${o.id} has a ray of zero length.`);
    }
  }
  return e;
}
export const canonical = (e: Envelope) => JSON.stringify(validate(e));
export function parseFile(text: string) {
  if (text.length > 120_000) throw Error("This editable file is too large.");
  return validate(JSON.parse(text));
}

/** The answer copy prints every answer object and hidden label; the pupil copy leaves them out. */
export function forView(e: Envelope, view: View): Envelope {
  if (view === "pupil") return e;
  const n = structuredClone(e),
    d = n.document;
  for (const p of d.points) {
    p.role = "given";
    p.label.show = "show";
  }
  for (const o of d.objects) {
    o.role = "given";
    if ("label" in o) o.label.show = "show";
  }
  d.caption.show = "show";
  return n;
}
export const hasHidden = (e: Envelope) => {
  const d = e.document;
  return (
    d.points.some((p) => p.role === "answer" || (p.label.show === "hidden" && p.label.text.trim())) ||
    d.objects.some((o) => o.role === "answer" || ("label" in o && o.label.show === "hidden" && o.label.text.trim())) ||
    (d.caption.show === "hidden" && !!d.caption.text.trim())
  );
};

/* ---------- Geometry ---------- */

export type Vec = { x: number; y: number };
const sub = (a: Vec, b: Vec): Vec => ({ x: a.x - b.x, y: a.y - b.y });
const add = (a: Vec, b: Vec): Vec => ({ x: a.x + b.x, y: a.y + b.y });
const mul = (a: Vec, k: number): Vec => ({ x: a.x * k, y: a.y * k });
const len = (a: Vec) => Math.hypot(a.x, a.y);
const dist = (a: Vec, b: Vec) => len(sub(a, b));
const unit = (a: Vec) => mul(a, 1 / len(a));
const dot = (a: Vec, b: Vec) => a.x * b.x + a.y * b.y;
const rad = (deg: number) => (deg * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;
const dir = (deg: number): Vec => ({ x: Math.cos(rad(deg)), y: Math.sin(rad(deg)) });
/** Direction of b from a in degrees anticlockwise from east. */
export const angleOf = (a: Vec, b: Vec) => deg(Math.atan2(b.y - a.y, b.x - a.x));
const norm360 = (v: number) => ((v % 360) + 360) % 360;
const round = (v: number, places = 3) => Math.round(v * 10 ** places) / 10 ** places;

export function distanceToSegment(p: Vec, a: Vec, b: Vec): number {
  const ab = sub(b, a),
    l2 = dot(ab, ab);
  const t = l2 ? Math.max(0, Math.min(1, dot(sub(p, a), ab) / l2)) : 0;
  return dist(p, add(a, mul(ab, t)));
}
export function insidePolygon(p: Vec, poly: Vec[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i],
      b = poly[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}
/** The two intersections of circles (c1, r1) and (c2, r2), or null. */
export function circleIntersections(c1: Vec, r1: number, c2: Vec, r2: number): [Vec, Vec] | null {
  const d = dist(c1, c2);
  if (d < 1e-9 || d > r1 + r2 + 1e-9 || d < Math.abs(r1 - r2) - 1e-9) return null;
  const a = (r1 * r1 - r2 * r2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, r1 * r1 - a * a));
  const u = unit(sub(c2, c1)),
    m = add(c1, mul(u, a));
  return [add(m, { x: -u.y * h, y: u.x * h }), add(m, { x: u.y * h, y: -u.x * h })];
}
/** The bearing of b from a: degrees clockwise from north, 0 to 360. */
export const bearingOf = (a: Vec, b: Vec) => norm360(deg(Math.atan2(b.x - a.x, b.y - a.y)));
export const formatBearing = (b: number) => `${String(Math.round(b) % 360).padStart(3, "0")}°`;

/* ---------- Lookups ---------- */

export const pointById = (d: ConstructionDocument, ref: string) => d.points.find((p) => p.id === ref);
export const objectById = (d: ConstructionDocument, ref: string) => d.objects.find((o) => o.id === ref);
function requirePoint(d: ConstructionDocument, ref: string): Point {
  const p = pointById(d, ref);
  if (!p) throw Error(`Point ${ref} is not in the drawing.`);
  return p;
}
function requireSegment(d: ConstructionDocument, ref: string): Of<"segment"> {
  const o = objectById(d, ref);
  if (o?.type !== "segment") throw Error(`Segment ${ref} is not in the drawing.`);
  return o;
}
const usedIds = (d: ConstructionDocument) => new Set([...d.points.map((p) => p.id), ...d.objects.map((o) => o.id)]);
/** A new ID with this prefix: prefix1, prefix2, ... */
export function freshId(d: ConstructionDocument, prefix: string): string {
  const used = usedIds(d);
  for (let k = 1; ; k++) if (!used.has(`${prefix}${k}`)) return `${prefix}${k}`;
}

/* ---------- Building blocks ---------- */

export function newPoint(pid: string, x: number, y: number, text = pid, extra: Partial<Point> = {}): Point {
  return { id: pid, x: round(x), y: round(y), label: label(text), labelAt: "auto", mark: "cross", role: "given", ...extra };
}
export function segment(sid: string, from: string, to: string, extra: Partial<Of<"segment">> = {}): Of<"segment"> {
  return { id: sid, type: "segment", from, to, extend: [0, 0], dash: false, label: label(), role: "given", ...extra };
}
export function arc(aid: string, center: string, radius: number, start: number, sweep: number, extra: Partial<Of<"arc">> = {}): Of<"arc"> {
  return { id: aid, type: "arc", center, radius: round(radius), start: round(start, 2), sweep: round(sweep, 2), dash: false, role: "given", ...extra };
}

export function blank(width = 12, height = 8): Envelope {
  return {
    tool: "construction",
    schemaVersion: 1,
    rendererVersion: "construction-1",
    document: { width, height, grid: "none", border: false, caption: label(), points: [], objects: [] },
  };
}
/** The starting drawing: AB = 7 cm with its perpendicular bisector saved as the hidden answer. */
export function create(): Envelope {
  const e = blank(12, 9);
  e.document.points.push(newPoint("A", 2.5, 4.5), newPoint("B", 9.5, 4.5));
  e.document.objects.push(segment("AB", "A", "B"));
  return perpendicularBisector(e, { a: "A", b: "B" });
}

/* ---------- Explicit construction helpers (never automatic) ---------- */

export type HelperOptions = { role?: Role; group?: string };
const ARC_MM = 14; // printed length of each short compass arc
const arcHalf = (radiusCm: number) => deg(ARC_MM / 2 / (radiusCm * 10));

type Draft = { e: Envelope; d: ConstructionDocument; group: string; role: Role };
function draft(e: Envelope, prefix: string, o: HelperOptions): Draft {
  const n = structuredClone(e);
  const groups = new Set([...n.document.points, ...n.document.objects].map((x) => x.group).filter(Boolean));
  let g = o.group;
  for (let k = 1; !g; k++) if (!groups.has(`${prefix}${k}`) && !usedIds(n.document).has(`${prefix}${k}`)) g = `${prefix}${k}`;
  if (usedIds(n.document).has(g) || n.document.objects.some((x) => x.group === g) || n.document.points.some((x) => x.group === g))
    throw Error(`The group ${g} is already in the drawing.`);
  return { e: n, d: n.document, group: g, role: o.role ?? "answer" };
}
const hiddenPoint = (dr: Draft, name: string, at: Vec) => {
  const p = newPoint(`${dr.group}-${name}`, at.x, at.y, "", { mark: "none", role: dr.role, group: dr.group });
  dr.d.points.push(p);
  return p.id;
};
const addArc = (dr: Draft, name: string, center: string, radius: number, start: number, sweep: number) =>
  dr.d.objects.push(arc(`${dr.group}-${name}`, center, radius, start, sweep, { role: dr.role, group: dr.group }));
/** A short compass arc from `center` crossing the point `at`. */
const crossingArc = (dr: Draft, name: string, center: Point | Vec & { id: string }, radius: number, at: Vec) => {
  const h = arcHalf(radius);
  addArc(dr, name, center.id, radius, angleOf(center, at) - h, 2 * h);
};
const finish = (dr: Draft) => {
  if (dr.d.points.length > MAX_POINTS || dr.d.objects.length > MAX_OBJECTS)
    throw Error(`This construction would pass ${MAX_POINTS} points or ${MAX_OBJECTS} objects. Remove something first.`);
  return validate(dr.e);
};

/** Ruler-and-compasses perpendicular bisector of AB: four arcs and the bisector line. */
/** Extra length (cm) that takes a line from `from` through `through` on to meet segment `reach`'s line, if that is ahead. */
function reachExtend(d: ConstructionDocument, from: Vec, through: Vec, reach: string | undefined): number | undefined {
  if (!reach) return undefined;
  const s = requireSegment(d, reach);
  const a = requirePoint(d, s.from),
    b = requirePoint(d, s.to);
  const u = sub(through, from),
    v = sub(b, a);
  const den = u.x * v.y - u.y * v.x;
  if (Math.abs(den) < 1e-9) throw Error(`The line never meets ${reach}; it is parallel.`);
  const t = ((a.x - from.x) * v.y - (a.y - from.y) * v.x) / den;
  if (t <= 1) throw Error(`The line already reaches ${reach} before its arcs; leave out reach.`);
  return round((t - 1) * len(u), 3);
}

/** `extend` is how far (cm) the bisector runs past each pair of crossing arcs (default 0.8); `reach` runs it on to meet a segment's line. */
export function perpendicularBisector(e: Envelope, o: HelperOptions & { a: string; b: string; radius?: number; extend?: number; reach?: string }): Envelope {
  const dr = draft(e, "pb", o);
  const A = requirePoint(dr.d, o.a),
    B = requirePoint(dr.d, o.b);
  const ab = dist(A, B);
  if (ab < 1) throw Error("The two points must be at least 1 cm apart.");
  // Default radius: about 0.7 AB, shortened (never below half AB plus 0.4 cm) so the crossings stay in the drawing.
  const inFrame = (v: Vec) => v.x >= 0 && v.y >= 0 && v.x <= dr.d.width && v.y <= dr.d.height;
  let r = o.radius ?? round(Math.min(Math.max(ab * 0.7, ab / 2 + 0.8), ab / 2 + 6), 1);
  if (o.radius === undefined)
    while (r > ab / 2 + 0.45 && !circleIntersections(A, r, B, r)!.every(inFrame)) r = round(Math.max(ab / 2 + 0.4, r - 0.1), 2);
  if (r <= ab / 2 + 0.2) throw Error(`Use a compass radius of more than half of AB (${round(ab / 2, 2)} cm).`);
  const [p, q] = circleIntersections(A, r, B, r)!;
  for (const [i, X] of [p, q].entries()) {
    crossingArc(dr, `arc${2 * i + 1}`, A, r, X);
    crossingArc(dr, `arc${2 * i + 2}`, B, r, X);
  }
  const P = hiddenPoint(dr, "p", p),
    Q = hiddenPoint(dr, "q", q);
  const ext = o.extend ?? 0.8;
  let ends: [number, number] = [ext, ext];
  if (o.reach) {
    // Run on through whichever crossing faces the segment.
    const tryReach = (from: Vec, through: Vec) => {
      try {
        return reachExtend(dr.d, from, through, o.reach);
      } catch {
        return undefined;
      }
    };
    const pastQ = tryReach(p, q),
      pastP = tryReach(q, p);
    if (pastQ === undefined && pastP === undefined) reachExtend(dr.d, p, q, o.reach); // throws the reason
    ends = [pastP ?? ext, pastQ ?? ext];
  }
  dr.d.objects.push(segment(`${dr.group}-line`, P, Q, { extend: ends, role: dr.role, group: dr.group }));
  return finish(dr);
}

/** Ruler-and-compasses bisector of angle PVQ: an arc across both arms, two crossing arcs and the bisector. */
/** `extend` is how far (cm) the bisector runs past its crossing arcs (default: to the shorter arm's length). */
export function angleBisector(e: Envelope, o: HelperOptions & { at: string; from: string; to: string; radius?: number; extend?: number; reach?: string }): Envelope {
  const dr = draft(e, "ab", o);
  const V = requirePoint(dr.d, o.at),
    P = requirePoint(dr.d, o.from),
    Q = requirePoint(dr.d, o.to);
  const a1 = angleOf(V, P),
    a2 = angleOf(V, Q);
  let sweep = norm360(a2 - a1);
  if (sweep > 180) sweep -= 360;
  if (Math.abs(sweep) < 5 || Math.abs(sweep) > 175) throw Error("The angle must be between 5° and 175°.");
  const arm = Math.min(dist(V, P), dist(V, Q));
  const r = o.radius ?? round(Math.max(1.5, Math.min(4, arm * 0.5)), 1);
  const X = add(V, mul(dir(a1), r)),
    Y = add(V, mul(dir(a2), r));
  const pad = Math.sign(sweep) * 8;
  addArc(dr, "arc1", V.id, r, a1 - pad, sweep + 2 * pad);
  const xy = dist(X, Y);
  const r2 = round(Math.max(xy * 0.75, r * 0.8, xy / 2 + 0.5), 1);
  const both = circleIntersections(X, r2, Y, r2)!;
  const Z = dist(both[0], V) > dist(both[1], V) ? both[0] : both[1];
  const Xp = hiddenPoint(dr, "x", X),
    Yp = hiddenPoint(dr, "y", Y);
  crossingArc(dr, "arc2", { ...X, id: Xp }, r2, Z);
  crossingArc(dr, "arc3", { ...Y, id: Yp }, r2, Z);
  const Zp = hiddenPoint(dr, "z", Z);
  dr.d.objects.push(segment(`${dr.group}-line`, V.id, Zp, { extend: [0, reachExtend(dr.d, V, Z, o.reach) ?? o.extend ?? Math.max(1, arm - dist(V, Z) + 0.5)], role: dr.role, group: dr.group }));
  return finish(dr);
}

/** Perpendicular from point P to the line through A and B (P not on the line). */
export function perpendicularFromPoint(e: Envelope, o: HelperOptions & { point: string; a: string; b: string; radius?: number }): Envelope {
  const dr = draft(e, "pf", o);
  const P = requirePoint(dr.d, o.point),
    A = requirePoint(dr.d, o.a),
    B = requirePoint(dr.d, o.b);
  const u = unit(sub(B, A));
  const foot = add(A, mul(u, dot(sub(P, A), u)));
  const h = dist(P, foot);
  if (h < 0.5) throw Error("The point must be at least 0.5 cm from the line. For a point on the line use perpendicular-at-point.");
  const r = o.radius ?? round(Math.max(h * 1.4, h + 1), 1);
  if (r <= h + 0.1) throw Error(`Use a compass radius of more than the distance to the line (${round(h, 2)} cm).`);
  const half = Math.sqrt(r * r - h * h);
  const X = add(foot, mul(u, -half)),
    Y = add(foot, mul(u, half));
  const ax = angleOf(P, X);
  let sweep = norm360(angleOf(P, Y) - ax);
  if (sweep > 180) sweep -= 360;
  const pad = Math.sign(sweep) * 6;
  addArc(dr, "arc1", P.id, r, ax - pad, sweep + 2 * pad);
  const Pp = add(foot, sub(foot, P)); // the second crossing of the arcs from X and Y
  const Xp = hiddenPoint(dr, "x", X),
    Yp = hiddenPoint(dr, "y", Y);
  crossingArc(dr, "arc2", { ...X, id: Xp }, r, Pp);
  crossingArc(dr, "arc3", { ...Y, id: Yp }, r, Pp);
  const Zp = hiddenPoint(dr, "z", Pp);
  dr.d.objects.push(segment(`${dr.group}-line`, P.id, Zp, { extend: [0, 0.6], role: dr.role, group: dr.group }));
  return finish(dr);
}

/** Perpendicular to the line AB at the point P on it, on the left of A→B (side "left") or the right. */
export function perpendicularAtPoint(
  e: Envelope,
  o: HelperOptions & { point: string; a: string; b: string; radius?: number; side?: "left" | "right" },
): Envelope {
  const dr = draft(e, "pa", o);
  const P = requirePoint(dr.d, o.point),
    A = requirePoint(dr.d, o.a),
    B = requirePoint(dr.d, o.b);
  const u = unit(sub(B, A));
  const off = Math.abs(dot(sub(P, A), { x: -u.y, y: u.x }));
  if (off > 0.05) throw Error(`Point ${P.id} is ${round(off, 2)} cm from the line; use perpendicular-from-point.`);
  const r = o.radius ?? 2;
  const X = add(P, mul(u, -r)),
    Y = add(P, mul(u, r));
  const Xp = hiddenPoint(dr, "x", X),
    Yp = hiddenPoint(dr, "y", Y);
  crossingArc(dr, "arc1", P, r, X);
  crossingArc(dr, "arc2", P, r, Y);
  const r2 = round(r * 1.5, 1);
  const n = o.side === "right" ? { x: u.y, y: -u.x } : { x: -u.y, y: u.x };
  const Z = add(P, mul(n, Math.sqrt(r2 * r2 - r * r)));
  crossingArc(dr, "arc3", { ...X, id: Xp }, r2, Z);
  crossingArc(dr, "arc4", { ...Y, id: Yp }, r2, Z);
  const Zp = hiddenPoint(dr, "z", Z);
  dr.d.objects.push(segment(`${dr.group}-line`, P.id, Zp, { extend: [0, 1], role: dr.role, group: dr.group }));
  return finish(dr);
}

/** The locus of points a fixed distance from a point: a circle. */
export function locusFromPoint(e: Envelope, o: HelperOptions & { point: string; distance: number; dash?: boolean }): Envelope {
  const dr = draft(e, "lp", o);
  const P = requirePoint(dr.d, o.point);
  addArc(dr, "circle", P.id, o.distance, 90, 360);
  if (o.dash) (dr.d.objects[dr.d.objects.length - 1] as Of<"arc">).dash = true;
  return finish(dr);
}

/** The locus of points a fixed distance from the segment AB: two parallel lines and two semicircles. */
export function locusFromSegment(e: Envelope, o: HelperOptions & { a: string; b: string; distance: number; dash?: boolean }): Envelope {
  const dr = draft(e, "ls", o);
  const A = requirePoint(dr.d, o.a),
    B = requirePoint(dr.d, o.b);
  if (dist(A, B) < 0.1) throw Error("The segment needs two different points.");
  const k = o.distance,
    u = unit(sub(B, A)),
    n = { x: -u.y, y: u.x };
  const ids = [
    hiddenPoint(dr, "a1", add(A, mul(n, k))),
    hiddenPoint(dr, "b1", add(B, mul(n, k))),
    hiddenPoint(dr, "a2", add(A, mul(n, -k))),
    hiddenPoint(dr, "b2", add(B, mul(n, -k))),
  ];
  const dash = !!o.dash;
  dr.d.objects.push(
    segment(`${dr.group}-side1`, ids[0], ids[1], { role: dr.role, group: dr.group, dash }),
    segment(`${dr.group}-side2`, ids[2], ids[3], { role: dr.role, group: dr.group, dash }),
  );
  const na = deg(Math.atan2(n.y, n.x));
  // At A the semicircle turns from +n through -u to -n (anticlockwise); at B from -n through +u to +n.
  addArc(dr, "end1", A.id, k, na, 180);
  addArc(dr, "end2", B.id, k, na + 180, 180);
  if (dash) for (const ob of dr.d.objects) if (ob.group === dr.group && ob.type === "arc") ob.dash = true;
  return finish(dr);
}

/** Adds a point at a bearing and distance (in drawing centimetres) from another point. */
export function pointByBearing(
  e: Envelope,
  o: { id: string; from: string; bearing: number; distance: number; label?: string; role?: Role; mark?: Point["mark"] },
): Envelope {
  const n = structuredClone(e),
    d = n.document;
  const F = requirePoint(d, o.from);
  if (usedIds(d).has(o.id)) throw Error(`The ID ${o.id} is already used.`);
  const b = rad(o.bearing);
  d.points.push(newPoint(o.id, F.x + o.distance * Math.sin(b), F.y + o.distance * Math.cos(b), o.label ?? o.id, { role: o.role ?? "given", mark: o.mark ?? "cross" }));
  return validate(n);
}

/** Writes the measured length of a segment (in a scale's units) into its label. */
export function measureSegment(e: Envelope, sid: string, scale: { cm: number; per: number; unit: string } = { cm: 1, per: 1, unit: "cm" }): Envelope {
  const n = structuredClone(e),
    d = n.document,
    s = requireSegment(d, sid);
  const l = dist(requirePoint(d, s.from), requirePoint(d, s.to));
  const v = round((l / scale.cm) * scale.per, 2);
  s.label.text = `${Number.isInteger(v) ? v : v.toFixed(v * 10 === Math.round(v * 10) ? 1 : 2)} ${scale.unit}`.trim();
  return validate(n);
}
/** Writes the measured bearing into a bearing object's label, as a three-figure bearing. */
export function measureBearing(e: Envelope, bid: string): Envelope {
  const n = structuredClone(e),
    d = n.document;
  const b = objectById(d, bid);
  if (b?.type !== "bearing") throw Error(`Bearing ${bid} is not in the drawing.`);
  b.label.text = formatBearing(bearingOf(requirePoint(d, b.from), requirePoint(d, b.to)));
  return validate(n);
}
/** Writes the measured size of an angle into its label, to the nearest degree. */
export function measureAngle(e: Envelope, aid: string): Envelope {
  const n = structuredClone(e),
    d = n.document;
  const a = objectById(d, aid);
  if (a?.type !== "angle") throw Error(`Angle ${aid} is not in the drawing.`);
  a.label.text = `${Math.round(angleSpan(d, a).size)}°`;
  return validate(n);
}

/** Removes points and objects, and everything that depends on them. */
export function remove(e: Envelope, ids: string[]): Envelope {
  const n = structuredClone(e),
    d = n.document;
  const gone = new Set(ids);
  let changed = true;
  while (changed) {
    changed = false;
    for (const o of d.objects)
      if (!gone.has(o.id) && refsOf(o).some((r) => gone.has(r))) {
        gone.add(o.id);
        changed = true;
      }
  }
  d.points = d.points.filter((p) => !gone.has(p.id));
  d.objects = d.objects.filter((o) => !gone.has(o.id));
  return validate(n);
}
export function removeGroup(e: Envelope, g: string): Envelope {
  const d = e.document;
  const ids = [...d.points.filter((p) => p.group === g).map((p) => p.id), ...d.objects.filter((o) => o.group === g).map((o) => o.id)];
  if (!ids.length) throw Error(`There is no group ${g} in the drawing.`);
  return remove(e, ids);
}
/** Sets the role of points, objects or whole groups. */
export function setRole(e: Envelope, ids: string[], r: Role): Envelope {
  const n = structuredClone(e),
    d = n.document,
    want = new Set(ids);
  let hit = 0;
  for (const x of [...d.points, ...d.objects])
    if (want.has(x.id) || (x.group && want.has(x.group))) {
      x.role = r;
      hit++;
    }
  if (!hit) throw Error(`None of ${ids.join(", ")} is in the drawing.`);
  return validate(n);
}

/* ---------- Layout ---------- */

export const FONT = (11 * 25.4) / 72; // 11 pt in millimetres
const MARGIN = 1.5;
const STROKE = 0.3;
const THIN = 0.25;
export const textWidth = (t: string, italic = false, font = FONT) => [...t].reduce((s, c) => s + glyphAdvance(c, italic), 0) * font;
const typeset = (t: string) => t.trim().replace(/^-/, "−").replace(/(\s)-(\s)/g, "$1−$2");

type Box = { x1: number; y1: number; x2: number; y2: number };
export type Placed = { text: string; x: number; y: number; italic: boolean; hidden: boolean; width: number };
type Path = { d: string; width: number; dash: boolean; fill?: boolean };

const COMPASS: Record<Exclude<Point["labelAt"], "auto">, number> = { e: 0, ne: 45, n: 90, nw: 135, w: 180, sw: 225, s: 270, se: 315 };

function angleSpan(d: ConstructionDocument, a: Of<"angle">) {
  const V = pointById(d, a.at)!,
    a1 = angleOf(V, pointById(d, a.from)!),
    a2 = angleOf(V, pointById(d, a.to)!);
  let start = a1,
    sweep = norm360(a2 - a1);
  if (sweep > 180 !== a.reflex) {
    start = a2;
    sweep = 360 - sweep;
  }
  return { V, start, sweep, size: sweep };
}

/** Everything placed in millimetres on the page (y downwards), with teacher-facing issues and notes. */
export function layout(e: Envelope) {
  const d = e.document,
    issues: string[] = [],
    notes: string[] = [];
  const Wmm = d.width * 10,
    Hmm = d.height * 10;
  // Page coordinates before the final shift: x right, y down, frame from (0,0) to (Wmm,Hmm).
  const P = (v: Vec) => ({ x: v.x * 10, y: Hmm - v.y * 10 });
  const byId = new Map(d.points.map((p) => [p.id, p]));
  const visible = (r: Role) => r === "given";
  const paths: Path[] = [];
  const texts: Placed[] = [];
  const boxes: Box[] = [{ x1: 0, y1: 0, x2: Wmm, y2: Hmm }];
  const textBoxes: Box[] = [];
  const f = (v: number) => String(Math.round(v * 1000) / 1000);
  const extendBox = (x: number, y: number, pad = 0) => boxes.push({ x1: x - pad, y1: y - pad, x2: x + pad, y2: y + pad });

  const line = (a: Vec, b: Vec, w = STROKE, dash = false) => {
    paths.push({ d: `M${f(a.x)} ${f(a.y)}L${f(b.x)} ${f(b.y)}`, width: w, dash });
    extendBox(a.x, a.y, w);
    extendBox(b.x, b.y, w);
  };
  const arcPath = (c: Vec, rmm: number, start: number, sweep: number, w = THIN, dash = false) => {
    if (Math.abs(sweep) >= 359.99) {
      paths.push({ d: `M${f(c.x + rmm)} ${f(c.y)}A${f(rmm)} ${f(rmm)} 0 1 0 ${f(c.x - rmm)} ${f(c.y)}A${f(rmm)} ${f(rmm)} 0 1 0 ${f(c.x + rmm)} ${f(c.y)}Z`, width: w, dash });
      extendBox(c.x, c.y, rmm + w);
      return;
    }
    const at = (t: number) => ({ x: c.x + rmm * Math.cos(rad(t)), y: c.y - rmm * Math.sin(rad(t)) });
    const s = at(start),
      t = at(start + sweep);
    // Page y runs downwards, so an anticlockwise turn has SVG sweep-flag 0.
    paths.push({ d: `M${f(s.x)} ${f(s.y)}A${f(rmm)} ${f(rmm)} 0 ${Math.abs(sweep) > 180 ? 1 : 0} ${sweep > 0 ? 0 : 1} ${f(t.x)} ${f(t.y)}`, width: w, dash });
    for (let k = 0; k <= 16; k++) {
      const q = at(start + (sweep * k) / 16);
      extendBox(q.x, q.y, w);
    }
  };
  /** Places a label centred at (x, y) on the page. */
  const placeText = (text: string, x: number, y: number, italic: boolean, hidden: boolean) => {
    const t = typeset(text);
    if (!t || hidden) return;
    const w = textWidth(t, italic);
    texts.push({ text: t, x, y, italic, hidden, width: w });
    const b = { x1: x - w / 2, y1: y - FONT * 0.42, x2: x + w / 2, y2: y + FONT * 0.42 };
    boxes.push(b);
    textBoxes.push(b);
  };
  /** Moves a label of width w out along a direction until its box clears a point by `gap`. */
  const offsetFor = (w: number, ang: number, gap: number) => {
    const u = dir(ang);
    const reach = (w / 2) * Math.abs(u.x) + FONT * 0.42 * Math.abs(u.y) + gap;
    return { dx: u.x * reach, dy: -u.y * reach };
  };

  // 1. Regions (drawn first, under everything).
  const objects = d.objects.filter((o) => visible(o.role));
  for (const o of objects) if (o.type === "region") hatch(d, o, Wmm, Hmm, paths);

  // 2. Lines, arcs and shapes.
  const incident = new Map<string, number[]>();
  const touch = (pid: string, toward: Vec) => {
    const p = byId.get(pid)!;
    if (dist(p, toward) < 1e-6) return;
    incident.set(pid, [...(incident.get(pid) ?? []), angleOf(p, toward)]);
  };
  const centroid = d.points.length
    ? { x: d.points.reduce((s, p) => s + p.x, 0) / d.points.length, y: d.points.reduce((s, p) => s + p.y, 0) / d.points.length }
    : { x: d.width / 2, y: d.height / 2 };
  for (const o of objects) {
    switch (o.type) {
      case "segment": {
        const a = byId.get(o.from)!,
          b = byId.get(o.to)!,
          u = unit(sub(b, a));
        const s = sub(a, mul(u, o.extend[0])),
          t = add(b, mul(u, o.extend[1]));
        line(P(s), P(t), STROKE, o.dash);
        touch(o.from, b);
        touch(o.to, a);
        if (o.extend[0] > 0) touch(o.from, s);
        if (o.extend[1] > 0) touch(o.to, t);
        if (o.label.text.trim() && o.label.show === "show") {
          const m = mul(add(a, b), 0.5);
          let nrm = { x: -u.y, y: u.x };
          if (dot(nrm, sub(m, centroid)) < 0 || (Math.abs(dot(nrm, sub(m, centroid))) < 1e-6 && nrm.y < 0)) nrm = mul(nrm, -1);
          const w = textWidth(typeset(o.label.text));
          const off = offsetFor(w, deg(Math.atan2(nrm.y, nrm.x)), 1.2);
          const pm = P(m);
          placeText(o.label.text, pm.x + off.dx, pm.y + off.dy + FONT * 0.34, false, false);
        }
        break;
      }
      case "arc": {
        const c = byId.get(o.center)!;
        arcPath(P(c), o.radius * 10, o.start, o.sweep, THIN, o.dash);
        break;
      }
      case "polygon": {
        const pts = o.points.map((x) => byId.get(x)!);
        pts.forEach((p, i) => {
          const q = pts[(i + 1) % pts.length];
          line(P(p), P(q), STROKE, o.dash);
          touch(p.id, q);
          touch(q.id, p);
        });
        break;
      }
      case "angle": {
        const { V, start, sweep } = angleSpan(d, o);
        const c = P(V);
        if (o.style === "right") {
          const s = 3,
            u1 = dir(start),
            u2 = dir(start + sweep);
          const p1 = { x: c.x + u1.x * s, y: c.y - u1.y * s },
            p2 = { x: c.x + (u1.x + u2.x) * s, y: c.y - (u1.y + u2.y) * s },
            p3 = { x: c.x + u2.x * s, y: c.y - u2.y * s };
          paths.push({ d: `M${f(p1.x)} ${f(p1.y)}L${f(p2.x)} ${f(p2.y)}L${f(p3.x)} ${f(p3.y)}`, width: THIN, dash: false });
        } else {
          const r = Math.min(14, Math.max(5, 3 / Math.sin(rad(Math.min(sweep, 120) / 2))));
          arcPath(c, r, start, sweep, THIN);
          if (o.label.text.trim() && o.label.show === "show") {
            const mid = start + sweep / 2,
              w = textWidth(typeset(o.label.text));
            const off = offsetFor(w, mid, r + 0.8);
            placeText(o.label.text, c.x + off.dx, c.y + off.dy + FONT * 0.34, false, false);
          }
        }
        break;
      }
      case "north":
        north(P(byId.get(o.at)!), o.length * 10);
        touch(o.at, add(byId.get(o.at)!, { x: 0, y: 1 }));
        break;
      case "bearing": {
        const a = byId.get(o.from)!,
          b = byId.get(o.to)!;
        const bearing = bearingOf(a, b);
        const r = Math.min(12, Math.max(6, 4 / Math.sin(rad(Math.min(Math.max(bearing, 30), 120) / 2))));
        if (o.northLine) {
          north(P(a), Math.max(15, r * 2));
          touch(o.from, add(a, { x: 0, y: 1 }));
        }
        const c = P(a);
        // The arc stops short so a small arrowhead's flat base sits on its end and the tip touches the
        // line to the other point, showing the clockwise turn.
        const head = 2.4,
          endAng = 90 - bearing,
          stop = Math.min(bearing / 2, deg(head / r));
        arcPath(c, r, 90, -(bearing - stop), THIN);
        const at = (t: number) => ({ x: c.x + r * Math.cos(rad(t)), y: c.y - r * Math.sin(rad(t)) });
        const tip = at(endAng),
          base = at(endAng + stop);
        arrowhead(tip, unit(sub(tip, base)), dist(tip, base) / 1.6);
        if (o.label.text.trim() && o.label.show === "show") {
          const mid = 90 - bearing / 2,
            w = textWidth(typeset(o.label.text));
          const off = offsetFor(w, mid, r + 0.9);
          placeText(o.label.text, c.x + off.dx, c.y + off.dy + FONT * 0.34, false, false);
        }
        break;
      }
      case "text": {
        const p = P(o);
        if (o.label.show === "show") placeText(o.label.text, p.x, p.y + FONT * 0.34, o.italic, false);
        break;
      }
      case "region":
        break;
    }
  }
  function arrowhead(tip: Vec, u: Vec, size: number) {
    const back = sub(tip, mul(u, size * 1.6)),
      side = { x: -u.y * size * 0.55, y: u.x * size * 0.55 };
    const p1 = add(back, side),
      p2 = sub(back, side);
    paths.push({ d: `M${f(tip.x)} ${f(tip.y)}L${f(p1.x)} ${f(p1.y)}L${f(p2.x)} ${f(p2.y)}Z`, width: 0.1, dash: false, fill: true });
  }
  function north(c: Vec, lmm: number) {
    const top = { x: c.x, y: c.y - lmm };
    // The line runs a little way into the arrowhead, not to its tip.
    line(c, { x: top.x, y: top.y + 1.8 * 1.6 - 0.6 }, STROKE);
    arrowhead(top, { x: 0, y: -1 }, 1.8);
    placeText("N", top.x, top.y - 2.2, false, false);
  }

  // 3. Points and their labels.
  const marks: { x: number; y: number; mark: Point["mark"] }[] = [];
  for (const p of d.points) {
    if (!visible(p.role)) continue;
    const c = P(p);
    if (p.mark !== "none") {
      marks.push({ ...c, mark: p.mark });
      extendBox(c.x, c.y, 1.2);
    }
    if (!p.label.text.trim() || p.label.show === "hidden") continue;
    let ang: number;
    if (p.labelAt !== "auto") ang = COMPASS[p.labelAt];
    else {
      const used = incident.get(p.id) ?? [];
      const choices = [135, 45, 90, 225, 315, 180, 0, 270];
      ang = choices.reduce(
        (best, a) => {
          const gap = Math.min(180, ...used.map((u) => Math.abs(((a - u + 540) % 360) - 180)));
          return gap > best.gap + 1e-6 ? { a, gap } : best;
        },
        { a: choices[0], gap: -1 },
      ).a;
    }
    const w = textWidth(typeset(p.label.text), true);
    const off = offsetFor(w, ang, p.mark === "cross" ? 2.1 : p.mark === "dot" ? 1.6 : 1.2);
    placeText(p.label.text, c.x + off.dx, c.y + off.dy + FONT * 0.34, true, false);
    texts[texts.length - 1].italic = true;
  }

  // 4. Issues and notes.
  for (const p of d.points) {
    if (p.x < -1e-6 || p.y < -1e-6 || p.x > d.width + 1e-6 || p.y > d.height + 1e-6)
      issues.push(
        p.group
          ? `The ${p.group} construction reaches (${round(p.x, 2)}, ${round(p.y, 2)}), outside the ${d.width} × ${d.height} cm drawing. Enlarge the drawing, move its points or use a smaller radius.`
          : `Point ${p.id} (${round(p.x, 2)}, ${round(p.y, 2)}) is outside the ${d.width} × ${d.height} cm drawing. Move it or enlarge the drawing.`,
      );
  }
  for (const o of d.objects)
    if ("label" in o && o.label.show === "show" && !o.label.text.trim() && o.type === "text") notes.push(`Text ${o.id} is empty.`);
  const overlapping = textBoxes.some((a, i) => textBoxes.slice(i + 1).some((b) => a.x1 < b.x2 - 0.2 && b.x1 < a.x2 - 0.2 && a.y1 < b.y2 - 0.2 && b.y1 < a.y2 - 0.2));
  if (overlapping) notes.push("Two labels overlap. Move a point, set a label position (labelAt) or shorten a label.");

  // 5. Caption below the drawing, in a box as on exam papers.
  let captionBox: Box | null = null;
  const cap = d.caption;
  if (cap.text.trim() && cap.show === "show") {
    const w = textWidth(typeset(cap.text)) + 8;
    const bottom = Math.max(...boxes.map((b) => b.y2));
    captionBox = { x1: 0, y1: bottom + 3, x2: w, y2: bottom + 3 + FONT + 4 };
    boxes.push(captionBox);
  }

  const left = Math.min(...boxes.map((b) => b.x1)),
    top = Math.min(...boxes.map((b) => b.y1)),
    right = Math.max(...boxes.map((b) => b.x2)),
    bottom = Math.max(...boxes.map((b) => b.y2));
  const dx = MARGIN - left,
    dy = MARGIN - top;
  const width = Math.ceil((right - left + 2 * MARGIN) * 10) / 10,
    height = Math.ceil((bottom - top + 2 * MARGIN) * 10) / 10;
  if (width > 280) issues.push("The drawing is wider than 28 cm. Make it narrower.");
  if (height > 320) issues.push("The drawing is taller than 32 cm. Make it shorter.");
  return {
    width,
    height,
    dx,
    dy,
    frame: { x: dx, y: dy, width: Wmm, height: Hmm },
    paths,
    texts: texts.map((t) => ({ ...t, x: t.x + dx, y: t.y + dy })),
    marks: marks.map((m) => ({ ...m, x: m.x + dx, y: m.y + dy })),
    caption: captionBox && { text: typeset(cap.text), x: captionBox.x1 + dx, y: captionBox.y1 + dy, width: captionBox.x2 - captionBox.x1, height: captionBox.y2 - captionBox.y1 },
    issues,
    notes,
  };
}
export type Layout = ReturnType<typeof layout>;
export const exportIssue = (e: Envelope) => layout(e).issues.join(" ") || null;
export function warnings(e: Envelope) {
  const g = layout(e);
  return [...g.issues, ...g.notes];
}

/** Hatching for a region: diagonal lines at 2.5 mm spacing, kept only where every rule holds. */
function hatch(d: ConstructionDocument, o: Of<"region">, Wmm: number, Hmm: number, paths: Path[]) {
  const byId = new Map(d.points.map((p) => [p.id, p]));
  const segs = new Map(d.objects.filter((x): x is Of<"segment"> => x.type === "segment").map((s) => [s.id, s]));
  const polys = new Map(d.objects.filter((x): x is Of<"polygon"> => x.type === "polygon").map((s) => [s.id, s.points.map((q) => byId.get(q)!)]));
  const distTo = (ref: string, v: Vec) => {
    const p = byId.get(ref);
    if (p) return dist(v, p);
    const s = segs.get(ref)!;
    return distanceToSegment(v, byId.get(s.from)!, byId.get(s.to)!);
  };
  const holds = (v: Vec) =>
    o.rules.every((r) => {
      if (r.kind === "distance") {
        const k = distTo(r.from, v);
        return r.side === "within" ? k <= r.distance : k >= r.distance;
      }
      if (r.kind === "closer") return distTo(r.to, v) < distTo(r.than, v);
      const inside = insidePolygon(v, polys.get(r.shape)!);
      return r.side === "within" ? inside : !inside;
    });
  const SPACING = 2.5,
    STEP = 0.25;
  const parts: string[] = [];
  const f = (v: number) => String(Math.round(v * 100) / 100);
  const directions = o.pattern === "cross" ? [1, -1] : [1];
  for (const s of directions) {
    // Lines x - s*y = c (in page millimetres, y down) crossing the frame.
    const cs = s === 1 ? [-Hmm, Wmm] : [0, Wmm + Hmm];
    for (let c = Math.ceil(cs[0] / SPACING) * SPACING; c <= cs[1]; c += SPACING) {
      // Parametrise by page y; x = c + s*y. Clip to the frame.
      let y0 = 0,
        y1 = Hmm;
      const ylo = s === 1 ? -c : c - Wmm,
        yhi = s === 1 ? Wmm - c : c;
      y0 = Math.max(y0, Math.min(ylo, yhi));
      y1 = Math.min(y1, Math.max(ylo, yhi));
      if (y1 - y0 < 0.1) continue;
      const at = (y: number) => {
        const x = c + s * y;
        return { x: x / 10, y: (Hmm - y) / 10 };
      };
      const n = Math.ceil((y1 - y0) / STEP);
      let prev = holds(at(y0)),
        runStart = prev ? y0 : NaN;
      const edge = (a: number, b: number, inside: boolean) => {
        for (let k = 0; k < 14; k++) {
          const m = (a + b) / 2;
          if (holds(at(m)) === inside) a = m;
          else b = m;
        }
        return (a + b) / 2;
      };
      for (let k = 1; k <= n; k++) {
        const y = Math.min(y1, y0 + k * STEP),
          now = holds(at(y));
        if (now !== prev) {
          const yb = edge(y - STEP, y, prev);
          if (now) runStart = yb;
          else if (yb - runStart > 0.2) parts.push(`M${f(c + s * runStart)} ${f(runStart)}L${f(c + s * yb)} ${f(yb)}`);
          prev = now;
        }
      }
      if (prev && y1 - runStart > 0.2) parts.push(`M${f(c + s * runStart)} ${f(runStart)}L${f(c + s * y1)} ${f(y1)}`);
    }
  }
  if (parts.length) paths.push({ d: parts.join(""), width: 0.2, dash: false });
}

/* ---------- SVG ---------- */

const n = (v: number) => String(Math.round(v * 1000) / 1000);
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function renderSvg(e: Envelope): string {
  const d = e.document,
    g = layout(e),
    out: string[] = [];
  out.push(`<rect width="${n(g.width)}" height="${n(g.height)}" fill="white"/>`);
  const F = g.frame;
  if (d.grid === "cm") {
    const lines: string[] = [];
    for (let x = 0; x <= F.width + 1e-6; x += 10) lines.push(`M${n(F.x + x)} ${n(F.y)}V${n(F.y + F.height)}`);
    for (let y = 0; y <= F.height + 1e-6; y += 10) lines.push(`M${n(F.x)} ${n(F.y + F.height - y)}H${n(F.x + F.width)}`);
    out.push(`<path d="${lines.join("")}" fill="none" stroke="#9a9a9a" stroke-width="0.2"/>`);
  }
  if (d.border) out.push(`<rect x="${n(F.x)}" y="${n(F.y)}" width="${n(F.width)}" height="${n(F.height)}" fill="none" stroke="black" stroke-width="${STROKE}"/>`);
  out.push(`<g transform="translate(${n(g.dx)} ${n(g.dy)})">`);
  for (const p of g.paths)
    out.push(
      p.fill
        ? `<path d="${p.d}" fill="black" stroke="black" stroke-width="${n(p.width)}" stroke-linejoin="round"/>`
        : `<path d="${p.d}" fill="none" stroke="black" stroke-width="${n(p.width)}" stroke-linecap="round" stroke-linejoin="round"${p.dash ? ' stroke-dasharray="1.6 1.2"' : ""}/>`,
    );
  out.push(`</g>`);
  for (const m of g.marks) {
    if (m.mark === "dot") out.push(`<circle cx="${n(m.x)}" cy="${n(m.y)}" r="0.6" fill="black"/>`);
    else {
      const s = 1.1;
      const d = `M${n(m.x - s)} ${n(m.y - s)}L${n(m.x + s)} ${n(m.y + s)}M${n(m.x - s)} ${n(m.y + s)}L${n(m.x + s)} ${n(m.y - s)}`;
      // A thin white edge keeps the cross readable on hatching or a grid.
      out.push(`<path d="${d}" stroke="white" stroke-width="0.9" stroke-linecap="round"/><path d="${d}" stroke="black" stroke-width="${THIN}" stroke-linecap="round"/>`);
    }
  }
  for (const t of g.texts)
    out.push(
      `<text x="${n(t.x)}" y="${n(t.y)}" text-anchor="middle" font-family="STIX Two Text,STIX Two Math,serif" font-size="${n(FONT)}"${t.italic ? ' font-style="italic"' : ""} fill="black">${esc(t.text)}</text>`,
    );
  if (g.caption) {
    const c = g.caption;
    out.push(`<rect x="${n(c.x)}" y="${n(c.y)}" width="${n(c.width)}" height="${n(c.height)}" fill="none" stroke="black" stroke-width="${THIN}"/>`);
    out.push(`<text x="${n(c.x + 4)}" y="${n(c.y + c.height / 2 + FONT * 0.34)}" font-family="STIX Two Text,STIX Two Math,serif" font-size="${n(FONT)}" fill="black">${esc(c.text)}</text>`);
  }
  const shown = d.points.filter((p) => p.role === "given" && p.label.text.trim() && p.label.show === "show").map((p) => p.label.text.trim());
  const description = `Construction drawing ${d.width} by ${d.height} cm${shown.length ? ` with points ${shown.join(", ")}` : ""}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${n(g.width)}mm" height="${n(g.height)}mm" viewBox="0 0 ${n(g.width)} ${n(g.height)}" role="img" aria-label="${esc(description)}">${out.join("")}</svg>`;
}

/* ---------- Hashes and editor links ---------- */

export async function hash(e: Envelope) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical(e)));
  return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, "0")).join("");
}
export const MAX_LINK_LENGTH = 16_000;
export const LINK_PREFIX = "#construction=";
export function linkHash(e: Envelope): string {
  const bytes = new TextEncoder().encode(canonical(e));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return LINK_PREFIX + btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/g, "");
}
/** The website editor is a later step; until it is released the connector returns no editor link. */
export const EDITOR_RELEASED = false;
export function editorLink(e: Envelope, base: string): string | null {
  if (!EDITOR_RELEASED) return null;
  const url = new URL(base);
  url.pathname = url.pathname.replace(/(\/tools(\/[^/]*)?)?\/?$/, "/") + "tools/construction";
  url.search = "";
  url.hash = linkHash(e);
  return url.href.length <= MAX_LINK_LENGTH ? url.href : null;
}
export function decodeLinkHash(hashText: string): Envelope {
  if (!/^#construction=[A-Za-z0-9_-]+$/.test(hashText) || hashText.length > MAX_LINK_LENGTH)
    throw Error("This is not a supported construction link. Open an editable file instead.");
  try {
    const binary = atob(hashText.slice(LINK_PREFIX.length).replaceAll("-", "+").replaceAll("_", "/"));
    const t = new TextDecoder("utf-8", { fatal: true }).decode(Uint8Array.from(binary, (c) => c.charCodeAt(0)));
    return parseFile(t);
  } catch {
    throw Error("This construction link could not be read. Open an editable file instead.");
  }
}
