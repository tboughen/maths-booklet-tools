/**
 * 3D solids: prisms (cuboids, triangular and any cross-section), pyramids and their frustums,
 * cylinders, cones and their frustums, spheres and hemispheres, alone or stuck together, drawn the
 * way Edexcel draws them: hidden edges dashed, round solids with elliptical rims whose hidden halves
 * are dashed, and lengths beside edges or on double-headed arrows.
 *
 * Positions are 3D mm (x right, y up, z towards the viewer). The view is either oblique (front faces
 * true shape, depth drawn at an angle and scale, as Edexcel draws prisms and cuboids) or turned (an
 * exact parallel view from a direction, as Edexcel draws cones, cylinders and spheres).
 *
 * Every solid gives named corners or centres, so lines (diagonals, heights, radii), angles and
 * lengths refer to points by ID. Labels use the house five states: value, symbol, blank, answer
 * line and hidden. A saved answer prints only on the answers copy, in the house answer colour.
 * Nothing is calculated or filled in, and the drawing never has to match the numbers.
 */
import { z } from "zod";
import { aboutShape } from "../../envelope-core/src/about";
import { defineEnvelope } from "../../envelope-core/src/index";
import { ANSWER_COLOUR } from "../../envelope-core/src/answer-state";
import {
  boldLines,
  LINE_WEIGHTS,
  MIN_TEXT_PT,
} from "../../envelope-core/src/house-style";
import {
  degrees,
  textHeight,
  textSvg,
  textWidth,
} from "../../area-core/src/index";

/** The drawing rules version this core writes and reads: the one source for schemas, guides and the connector (M19). */
export const RENDERER_VERSION = "solids-1" as const;
export { ANSWER_COLOUR };
export const STATES = [
  "value",
  "symbol",
  "blank",
  "answer-line",
  "hidden",
] as const;
export type LabelState = (typeof STATES)[number];
export const SOLID_TYPES = [
  "prism",
  "pyramid",
  "cylinder",
  "cone",
  "sphere",
  "hemisphere",
] as const;
export type SolidType = (typeof SOLID_TYPES)[number];
export const AXES = ["x", "y", "z"] as const;
export const STYLES = ["solid", "dashed", "dotted"] as const;
export type LineStyle = (typeof STYLES)[number];
export const MARKS = ["none", "arc", "right"] as const;
export const DIM_KINDS = ["beside", "arrow"] as const;
export const SIDES = ["auto", "left", "right"] as const;
export const SHOWS = ["none", "dot"] as const;
export const MAX_LABEL = 24;
export const LIMITS = {
  solids: 4,
  points: 20,
  lines: 20,
  dims: 12,
  angles: 8,
} as const;
export const REACH = 120;

const plain = (max: number) =>
  z
    .string()
    .max(max)
    .refine(
      (s) =>
        ![...s].some(
          (c) => c.charCodeAt(0) < 32 || c === "<" || c === ">" || c === "&",
        ),
      "Use ordinary text without markup.",
    );
const id = z.string().regex(/^[a-z][a-z0-9]{0,7}$/);
/** A solid's ID is one to three letters, so its corners can be named after it (p1, p2 ... pt). */
const solidId = z.string().regex(/^[a-z]{1,3}$/);
const coord = z.number().finite().min(-REACH).max(REACH);
const size = (min: number, max: number) =>
  z.number().finite().min(min).max(max);
const p3 = z.object({ x: coord, y: coord, z: coord }).strict();
const p2 = z.object({ x: coord, y: coord }).strict();

export const labelSchema = z
  .object({
    state: z.enum(STATES),
    /** What pupils see: a length ("15 cm", "2x"), a size for an angle ("35", "x"), or a letter for symbol. */
    text: plain(MAX_LABEL),
    /** The saved answer, printed only on the answers copy. Empty means none. */
    answer: plain(MAX_LABEL),
  })
  .strict();

export const solidSchema = z.discriminatedUnion("type", [
  /**
   * A prism: the cross-section (3 to 12 corners, anticlockwise, mm) at `at`, carried `length` mm along
   * its axis. Axis z: the section faces you and runs back. Axis x: the section is the left end and
   * runs right (across, then up, the section's x going back). Axis y: the section is the bottom and
   * runs up (x across, y going back). Corners are named id1..idn at the start and idb1..idbn at the end.
   */
  z
    .object({
      id: solidId,
      type: z.literal("prism"),
      at: p3,
      section: z.array(p2).min(3).max(12),
      length: size(2, 150),
      axis: z.enum(AXES),
    })
    .strict(),
  /** A pyramid: a base (3 to 12 corners, x across and y going back) at `at`, and an apex offset from `at`. top > 0 cuts it to a frustum. Corners id1..idn, apex idt, frustum top idb1..idbn. */
  z
    .object({
      id: solidId,
      type: z.literal("pyramid"),
      at: p3,
      base: z.array(p2).min(3).max(12),
      apex: p3,
      top: size(0, 0.9),
    })
    .strict(),
  /** A cylinder: base centre at `at`, radius r and height h along its axis. Base centre ido, top centre idt. */
  z
    .object({
      id: solidId,
      type: z.literal("cylinder"),
      at: p3,
      r: size(3, 80),
      h: size(1, 150),
      axis: z.enum(AXES),
    })
    .strict(),
  /** A cone: base centre at `at`, base radius r, height h along its axis; top > 0 is the top radius of a frustum. Base centre ido, apex or top centre idt. */
  z
    .object({
      id: solidId,
      type: z.literal("cone"),
      at: p3,
      r: size(3, 80),
      h: size(1, 150),
      top: size(0, 80),
      axis: z.enum(AXES),
    })
    .strict(),
  /** A sphere: centre at `at` (ido) and radius r; equator draws its rim with the back half dashed. */
  z
    .object({
      id: solidId,
      type: z.literal("sphere"),
      at: p3,
      r: size(3, 80),
      equator: z.boolean(),
    })
    .strict(),
  /** A hemisphere: the middle of its flat face at `at` (ido), radius r, flat face up (a bowl) or down (a dome). */
  z
    .object({
      id: solidId,
      type: z.literal("hemisphere"),
      at: p3,
      r: size(3, 80),
      flat: z.enum(["up", "down"]),
    })
    .strict(),
]);
export const placeSchema = z.discriminatedUnion("type", [
  /** Anywhere, in 3D mm. */
  z.object({ type: z.literal("at"), x: coord, y: coord, z: coord }).strict(),
  /** On the line through a and b: t = 0 at a, 1 at b. */
  z
    .object({
      type: z.literal("along"),
      a: id,
      b: id,
      t: z.number().finite().min(-2).max(3),
    })
    .strict(),
  /** On a round solid's rim: its base, its top (cylinders and frustums) or a sphere's equator, deg round it. Upright (axis y): 0 right, 90 back, 270 nearest you. Axis z: 0 right, 90 top. Axis x: 0 back, 90 top. */
  z
    .object({
      type: z.literal("rim"),
      solid: solidId,
      end: z.enum(["base", "top"]),
      deg: z.number().finite().min(0).max(360),
    })
    .strict(),
]);
export const pointSchema = z
  .object({ id, place: placeSchema, show: z.enum(SHOWS) })
  .strict();
export const nameSchema = z.object({ id, text: plain(3) }).strict();
export const lineSchema = z
  .object({ id, a: id, b: id, style: z.enum(STYLES) })
  .strict();
export const dimSchema = z
  .object({
    id,
    a: id,
    b: id,
    /** beside: the label sits beside the edge or line ab. arrow: a double-headed arrow drawn offset mm from ab (0 is on it), the label in a gap in the arrow or beside it. */
    kind: z.enum(DIM_KINDS),
    offset: z.number().finite().min(-40).max(40),
    gap: z.boolean(),
    side: z.enum(SIDES),
    label: labelSchema,
  })
  .strict();
export const angleSchema = z
  .object({
    id,
    at: id,
    from: id,
    to: id,
    mark: z.enum(MARKS),
    label: labelSchema,
  })
  .strict();
export const viewSchema = z.discriminatedUnion("type", [
  /** Front faces true shape; depth drawn at angle deg (0 right, 90 up, 180 left) and scale. */
  z
    .object({
      type: z.literal("oblique"),
      angle: size(10, 170),
      scale: size(0.3, 1),
    })
    .strict(),
  /** An exact parallel view: turned deg round the vertical, tilted deg to look down. */
  z
    .object({
      type: z.literal("turned"),
      turn: size(-89, 89),
      tilt: size(0, 60),
    })
    .strict(),
]);
export const documentSchema = z
  .object({
    view: viewSchema,
    solids: z.array(solidSchema).min(1).max(LIMITS.solids),
    points: z.array(pointSchema).max(LIMITS.points),
    names: z.array(nameSchema).max(40),
    lines: z.array(lineSchema).max(LIMITS.lines),
    dims: z.array(dimSchema).max(LIMITS.dims),
    angles: z.array(angleSchema).max(LIMITS.angles),
    /** Hidden edges: dashed (as Edexcel draws them) or left out. */
    hidden: z.enum(["dashed", "none"]),
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
    weight: z
      .enum(LINE_WEIGHTS)
      .transform((v) => (v === "bold" ? v : undefined))
      .optional(),
  })
  .strict();
export const envelopeSchema = z
  .object({
    kind: z.literal("solids"),
    schemaVersion: z.literal(1),
    rendererVersion: z.literal(RENDERER_VERSION),
    document: documentSchema,
    ...aboutShape,
  })
  .strict();
export type Envelope = z.infer<typeof envelopeSchema>;
export type SolidsDocument = Envelope["document"];
export type Solid = z.infer<typeof solidSchema>;
export type Place = z.infer<typeof placeSchema>;
export type Point = z.infer<typeof pointSchema>;
export type Line = z.infer<typeof lineSchema>;
export type Dim = z.infer<typeof dimSchema>;
export type Angle = z.infer<typeof angleSchema>;
export type Label = z.infer<typeof labelSchema>;
export type ViewSpec = z.infer<typeof viewSchema>;
export type View = "pupil" | "answer";
export type V3 = { x: number; y: number; z: number };
export type P = { x: number; y: number };

export const label = (
  text = "",
  state: LabelState = text ? "value" : "blank",
  answer = "",
): Label => ({ state, text, answer });
export const dim = (
  did: string,
  a: string,
  b: string,
  l: Label,
  more: Partial<Omit<Dim, "id" | "a" | "b" | "label">> = {},
): Dim => ({
  id: did,
  a,
  b,
  kind: "beside",
  offset: 0,
  gap: false,
  side: "auto",
  label: l,
  ...more,
});

/* ---------- Vectors ---------- */

const rad = (deg: number) => (deg * Math.PI) / 180;
const v3 = (x: number, y: number, z: number): V3 => ({ x, y, z });
const add3 = (a: V3, b: V3): V3 => v3(a.x + b.x, a.y + b.y, a.z + b.z);
const sub3 = (a: V3, b: V3): V3 => v3(a.x - b.x, a.y - b.y, a.z - b.z);
const mul3 = (a: V3, s: number): V3 => v3(a.x * s, a.y * s, a.z * s);
const dot3 = (a: V3, b: V3) => a.x * b.x + a.y * b.y + a.z * b.z;
const cross3 = (a: V3, b: V3): V3 =>
  v3(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
const len3 = (a: V3) => Math.hypot(a.x, a.y, a.z);
const unit3 = (a: V3): V3 => {
  const l = len3(a);
  return l < 1e-12 ? v3(1, 0, 0) : mul3(a, 1 / l);
};
const add = (a: P, b: P): P => ({ x: a.x + b.x, y: a.y + b.y });
const sub = (a: P, b: P): P => ({ x: a.x - b.x, y: a.y - b.y });
const mul = (a: P, s: number): P => ({ x: a.x * s, y: a.y * s });
const dot = (a: P, b: P) => a.x * b.x + a.y * b.y;
const len = (a: P) => Math.hypot(a.x, a.y);
const unit = (a: P): P => {
  const l = len(a);
  return l < 1e-12 ? { x: 1, y: 0 } : mul(a, 1 / l);
};
const perp = (a: P): P => ({ x: -a.y, y: a.x });
const dir = (deg: number): P => ({
  x: Math.cos(rad(deg)),
  y: Math.sin(rad(deg)),
});
const heading = (a: P) => {
  const d = (Math.atan2(a.y, a.x) * 180) / Math.PI;
  return d < 0 ? d + 360 : d;
};
const norm = (deg: number) => ((deg % 360) + 360) % 360;
const ccw = (from: number, to: number) => {
  const s = norm(to - from);
  return s === 0 ? 360 : s;
};
const AXIS: Record<(typeof AXES)[number], V3> = {
  x: v3(1, 0, 0),
  y: v3(0, 1, 0),
  z: v3(0, 0, -1),
};

/* ---------- Projection ---------- */

export type Projection = { project: (p: V3) => P; toward: V3 };
/** The screen position (mm, y up) of a 3D point, and the direction from the solid to the viewer, for hiding back faces. */
export function projection(view: ViewSpec): Projection {
  if (view.type === "oblique") {
    const c = Math.cos(rad(view.angle)) * view.scale,
      s = Math.sin(rad(view.angle)) * view.scale;
    // Depth (towards the back, -z) runs at the angle; the viewer looks along the receding direction.
    return {
      project: (p) => ({ x: p.x - p.z * c, y: p.y - p.z * s }),
      toward: unit3(v3(c, s, 1)),
    };
  }
  const t = rad(view.turn),
    f = rad(view.tilt);
  const toward = v3(
    Math.sin(t) * Math.cos(f),
    Math.sin(f),
    Math.cos(t) * Math.cos(f),
  );
  const right = v3(Math.cos(t), 0, -Math.sin(t));
  const up = cross3(toward, right);
  return { project: (p) => ({ x: dot3(p, right), y: dot3(p, up) }), toward };
}

/* ---------- Solids ---------- */

/** A flat face of a polyhedron, corners in order, with its outward normal. */
type Face = { ids: string[]; normal: V3 };
/** A round solid's surface of revolution: base centre c, axis a, height h, radii r1 (base) and r2 (top). */
type Round = {
  sid: string;
  c: V3;
  a: V3;
  e1: V3;
  e2: V3;
  h: number;
  r1: number;
  r2: number;
};
type Built = {
  points: Map<string, V3>;
  faces: Map<string, Face[]>;
  rounds: Map<string, Round>;
  kinds: Map<string, string>;
};

/** Two unit vectors at right angles to an axis, so a circle round it is c + r(cos e1 + sin e2). */
function frame(a: V3): [V3, V3] {
  if (Math.abs(a.y) > 0.9) return [v3(1, 0, 0), v3(0, 0, -1)];
  if (Math.abs(a.x) > 0.9) return [v3(0, 0, -1), v3(0, 1, 0)];
  return [v3(1, 0, 0), v3(0, 1, 0)];
}
/** A point on a section or base, in 3D: the section's x and y in the plane at right angles to the axis. */
function sectionPoint(axis: (typeof AXES)[number], at: V3, q: P): V3 {
  if (axis === "z") return add3(at, v3(q.x, q.y, 0));
  if (axis === "x") return add3(at, v3(0, q.y, -q.x));
  return add3(at, v3(q.x, 0, -q.y));
}
function newell(pts: V3[]): V3 {
  let nx = 0,
    ny = 0,
    nz = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i],
      b = pts[(i + 1) % pts.length];
    nx += (a.y - b.y) * (a.z + b.z);
    ny += (a.z - b.z) * (a.x + b.x);
    nz += (a.x - b.x) * (a.y + b.y);
  }
  return unit3(v3(nx, ny, nz));
}
function centroid3(pts: V3[]): V3 {
  return mul3(pts.reduce(add3, v3(0, 0, 0)), 1 / pts.length);
}
/**
 * Faces with normals pointing out of the solid. Each face comes with a direction its outward normal
 * agrees with, worked out from how the solid was built, so non-convex sections (an L-shaped prism)
 * point every face the right way; the middle of the solid would not.
 */
function outward(points: Map<string, V3>, faces: { ids: string[]; out: V3 }[]): Face[] {
  return faces.map(({ ids, out }) => {
    let normal = newell(ids.map((k) => points.get(k)!));
    if (dot3(normal, out) < 0) normal = mul3(normal, -1);
    return { ids, normal };
  });
}
/** The direction out of a polygon across its edge from a to b, in the polygon's plane (normal n, either way round). */
function across(points: Map<string, V3>, ring: string[], a: string, b: string): V3 {
  const n = newell(ring.map((k) => points.get(k)!));
  return cross3(sub3(points.get(b)!, points.get(a)!), n);
}
/** The IDs a solid gives its corners or centres. */
export function solidPointIds(s: Solid): string[] {
  if (s.type === "prism")
    return [
      ...s.section.map((_, k) => `${s.id}${k + 1}`),
      ...s.section.map((_, k) => `${s.id}b${k + 1}`),
    ];
  if (s.type === "pyramid")
    return [
      ...s.base.map((_, k) => `${s.id}${k + 1}`),
      ...(s.top > 0 ? s.base.map((_, k) => `${s.id}b${k + 1}`) : [`${s.id}t`]),
    ];
  if (s.type === "cylinder" || s.type === "cone")
    return [`${s.id}o`, `${s.id}t`];
  return [`${s.id}o`];
}

/** Every solid's corners and centres, faces and round surfaces, then the extra points. Throws a readable error for a missing or looping reference. */
export function build(d: SolidsDocument): Built {
  const points = new Map<string, V3>(),
    faces = new Map<string, Face[]>(),
    rounds = new Map<string, Round>(),
    kinds = new Map<string, string>();
  for (const s of d.solids) {
    kinds.set(s.id, s.type);
    const at = v3(s.at.x, s.at.y, s.at.z);
    if (s.type === "prism") {
      const step = mul3(AXIS[s.axis], s.length);
      const front = s.section.map(
        (q, k) => [`${s.id}${k + 1}`, sectionPoint(s.axis, at, q)] as const,
      );
      for (const [k, p] of front) points.set(k, p);
      front.forEach(([, p], k) =>
        points.set(`${s.id}b${k + 1}`, add3(p, step)),
      );
      const n = s.section.length,
        f = (k: number) => `${s.id}${(k % n) + 1}`,
        b = (k: number) => `${s.id}b${(k % n) + 1}`;
      const ring = s.section.map((_, k) => f(k));
      const list = [
        { ids: ring, out: mul3(step, -1) },
        { ids: s.section.map((_, k) => b(k)), out: step },
      ];
      for (let k = 0; k < n; k++) list.push({ ids: [f(k), f(k + 1), b(k + 1), b(k)], out: across(points, ring, f(k), f(k + 1)) });
      faces.set(s.id, outward(points, list));
    } else if (s.type === "pyramid") {
      const n = s.base.length,
        f = (k: number) => `${s.id}${(k % n) + 1}`,
        b = (k: number) => `${s.id}b${(k % n) + 1}`;
      const base = s.base.map((q) => sectionPoint("y", at, q));
      base.forEach((p, k) => points.set(f(k), p));
      const apex = add3(at, v3(s.apex.x, s.apex.y, s.apex.z));
      const ring = s.base.map((_, k) => f(k));
      // The base faces away from the apex; each side faces out across its base edge, whichever way the apex leans.
      const up = sub3(apex, centroid3(base));
      const list = [{ ids: ring, out: mul3(up, -1) }];
      if (s.top > 0) {
        // The top is the base shrunk towards the apex: the frustum left when the tip is cut off.
        base.forEach((p, k) =>
          points.set(b(k), add3(apex, mul3(sub3(p, apex), s.top))),
        );
        list.push({ ids: s.base.map((_, k) => b(k)), out: up });
        for (let k = 0; k < n; k++) list.push({ ids: [f(k), f(k + 1), b(k + 1), b(k)], out: across(points, ring, f(k), f(k + 1)) });
      } else {
        points.set(`${s.id}t`, apex);
        for (let k = 0; k < n; k++) list.push({ ids: [f(k), f(k + 1), `${s.id}t`], out: across(points, ring, f(k), f(k + 1)) });
      }
      faces.set(s.id, outward(points, list));
    } else if (s.type === "cylinder" || s.type === "cone") {
      const a = unit3(AXIS[s.axis]),
        [e1, e2] = frame(a);
      points.set(`${s.id}o`, at);
      points.set(`${s.id}t`, add3(at, mul3(a, s.h)));
      rounds.set(s.id, {
        sid: s.id,
        c: at,
        a,
        e1,
        e2,
        h: s.h,
        r1: s.r,
        r2: s.type === "cylinder" ? s.r : s.top,
      });
    } else {
      points.set(`${s.id}o`, at);
      const a = v3(0, 1, 0),
        [e1, e2] = frame(a);
      rounds.set(s.id, { sid: s.id, c: at, a, e1, e2, h: 0, r1: s.r, r2: s.r });
    }
  }
  const byId = new Map(d.points.map((p) => [p.id, p]));
  const seen = new Set<string>();
  const need = (pid: string, by: string): V3 => {
    const done = points.get(pid);
    if (done) return done;
    const p = byId.get(pid);
    if (!p)
      throw Error(`${by} refers to point ${pid}, which is not in the figure.`);
    if (seen.has(pid))
      throw Error(
        `Point ${pid} is placed using itself (through other points). Place one of them another way.`,
      );
    seen.add(pid);
    const s = p.place;
    let at: V3;
    if (s.type === "at") at = v3(s.x, s.y, s.z);
    else if (s.type === "along") {
      const a = need(s.a, `Point ${pid}`),
        b = need(s.b, `Point ${pid}`);
      at = add3(a, mul3(sub3(b, a), s.t));
    } else {
      const r = rounds.get(s.solid);
      if (!r)
        throw Error(
          `Point ${pid} is on the rim of ${s.solid}, which is not a cylinder, cone, sphere or hemisphere in the figure.`,
        );
      const radius = s.end === "base" ? r.r1 : r.r2;
      if (
        s.end === "top" &&
        (kinds.get(s.solid) === "sphere" ||
          kinds.get(s.solid) === "hemisphere" ||
          radius <= 0)
      )
        throw Error(
          `Point ${pid} is on the top rim of ${s.solid}, which has no top rim. Use the base rim.`,
        );
      const c = s.end === "base" ? r.c : add3(r.c, mul3(r.a, r.h));
      at = add3(
        c,
        add3(
          mul3(r.e1, radius * Math.cos(rad(s.deg))),
          mul3(r.e2, radius * Math.sin(rad(s.deg))),
        ),
      );
    }
    points.set(pid, at);
    return at;
  };
  for (const p of d.points) need(p.id, `Point ${p.id}`);
  return { points, faces, rounds, kinds };
}

/* ---------- Visible and hidden lines ---------- */

/** A drawn piece in screen mm (y up): a straight line or a polyline (rims and outlines). */
export type Piece = { pts: P[]; hidden: boolean; style: LineStyle };
const EPS = 1e-6;
const STEPS = 144;
/** A cap is hidden inside the figure when another solid's flat face covers it, facing it, at least as wide. */
function glued(
  d: SolidsDocument,
  b: Built,
  sid: string,
  centre: V3,
  normal: V3,
  r: number,
) {
  for (const s of d.solids) {
    if (s.id === sid) continue;
    const caps: { c: V3; n: V3; r: number }[] = [];
    const round = b.rounds.get(s.id);
    if (round && (s.type === "cylinder" || s.type === "cone")) {
      caps.push({ c: round.c, n: mul3(round.a, -1), r: round.r1 });
      if (round.r2 > 0)
        caps.push({
          c: add3(round.c, mul3(round.a, round.h)),
          n: round.a,
          r: round.r2,
        });
    }
    if (round && s.type === "hemisphere")
      caps.push({
        c: round.c,
        n: s.flat === "up" ? v3(0, 1, 0) : v3(0, -1, 0),
        r: round.r1,
      });
    for (const f of b.faces.get(s.id) ?? []) {
      // A polyhedron face covers the cap if the cap's centre is on it (inside its outline) and the face faces it; the cap's size is not checked.
      const fp = f.ids.map((k) => b.points.get(k)!);
      if (
        Math.abs(dot3(sub3(centre, fp[0]), f.normal)) < 0.3 &&
        dot3(f.normal, normal) < -0.99 &&
        insideFace(centre, fp, f.normal)
      )
        caps.push({ c: centre, n: f.normal, r: Infinity });
    }
    for (const c of caps)
      if (
        len3(sub3(c.c, centre)) < 0.3 &&
        dot3(c.n, normal) < -0.99 &&
        c.r >= r - 0.01
      )
        return true;
  }
  return false;
}
/** Whether a point in a face's plane lies inside its outline: the face seen square on, then a ray crossing count. */
function insideFace(p: V3, pts: V3[], n: V3): boolean {
  const ax = Math.abs(n.x), ay = Math.abs(n.y), az = Math.abs(n.z);
  const flat = (q: V3): P => (ax >= ay && ax >= az ? { x: q.y, y: q.z } : ay >= az ? { x: q.x, y: q.z } : { x: q.x, y: q.y });
  const t = flat(p), ring = pts.map(flat);
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if (a.y > t.y !== b.y > t.y && t.x < ((b.x - a.x) * (t.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}
function splitRuns(
  samples: { p: P; visible: boolean }[],
  closed: boolean,
): { pts: P[]; visible: boolean }[] {
  const runs: { pts: P[]; visible: boolean }[] = [];
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i];
    const last = runs[runs.length - 1];
    if (last && last.visible === s.visible) last.pts.push(s.p);
    else {
      // Each run starts where the last one ended, so the pieces join.
      const start = last ? [last.pts[last.pts.length - 1]] : [];
      runs.push({ pts: [...start, s.p], visible: s.visible });
    }
  }
  if (
    closed &&
    runs.length > 1 &&
    runs[0].visible === runs[runs.length - 1].visible
  ) {
    const first = runs.shift()!;
    runs[runs.length - 1].pts.push(...first.pts.slice(1));
  }
  return runs;
}

export type Geometry = {
  built: Built;
  projection: Projection;
  screen: Map<string, P>;
  pieces: Piece[];
};
export function geometry(d: SolidsDocument): Geometry {
  const built = build(d),
    proj = projection(d.view),
    V = proj.toward,
    pr = proj.project;
  const screen = new Map([...built.points].map(([k, p]) => [k, pr(p)]));
  const pieces: Piece[] = [];
  const push = (pts: P[], visible: boolean) =>
    pieces.push({ pts, hidden: !visible, style: visible ? "solid" : "dashed" });
  type Rim = { c: V3; r: number; e1: V3; e2: V3; visible: (phi: number) => boolean };
  const rims: Rim[] = [];
  for (const s of d.solids) {
    const fs = built.faces.get(s.id);
    if (fs) {
      const facing = fs.map((f) => dot3(f.normal, V) > EPS);
      const edges = new Map<
        string,
        { a: string; b: string; visible: boolean }
      >();
      fs.forEach((f, i) => {
        for (let k = 0; k < f.ids.length; k++) {
          const a = f.ids[k],
            b = f.ids[(k + 1) % f.ids.length];
          const key = a < b ? `${a}|${b}` : `${b}|${a}`;
          const e = edges.get(key);
          if (e) e.visible ||= facing[i];
          else edges.set(key, { a, b, visible: facing[i] });
        }
      });
      for (const e of edges.values())
        push([screen.get(e.a)!, screen.get(e.b)!], e.visible);
      continue;
    }
    const r = built.rounds.get(s.id)!;
    const rimAt = (c: V3, radius: number, phi: number) =>
      add3(
        c,
        add3(
          mul3(r.e1, radius * Math.cos(phi)),
          mul3(r.e2, radius * Math.sin(phi)),
        ),
      );
    const radial = (phi: number) =>
      add3(mul3(r.e1, Math.cos(phi)), mul3(r.e2, Math.sin(phi)));
    if (s.type === "cylinder" || s.type === "cone") {
      const top = add3(r.c, mul3(r.a, r.h));
      const sideNormal = (phi: number) =>
        unit3(add3(mul3(radial(phi), r.h), mul3(r.a, r.r1 - r.r2)));
      const baseCap =
        dot3(mul3(r.a, -1), V) > EPS &&
        !glued(d, built, s.id, r.c, mul3(r.a, -1), r.r1);
      const topCap =
        r.r2 > 0 &&
        dot3(r.a, V) > EPS &&
        !glued(d, built, s.id, top, r.a, r.r2);
      rims.push({ c: r.c, r: r.r1, e1: r.e1, e2: r.e2, visible: (phi) => baseCap || dot3(sideNormal(phi), V) > EPS });
      if (r.r2 > 0) rims.push({ c: top, r: r.r2, e1: r.e1, e2: r.e2, visible: (phi) => topCap || dot3(sideNormal(phi), V) > EPS });
      // Outline: the slanting or straight sides where the surface turns away from the viewer.
      const A = r.h * dot3(r.e1, V),
        B = r.h * dot3(r.e2, V),
        C = (r.r1 - r.r2) * dot3(r.a, V),
        R = Math.hypot(A, B);
      if (R > EPS && Math.abs(C) <= R) {
        const base = Math.atan2(B, A),
          spread = Math.acos(Math.max(-1, Math.min(1, -C / R)));
        for (const phi of [base + spread, base - spread])
          push(
            [
              pr(rimAt(r.c, r.r1, phi)),
              pr(r.r2 > 0 ? rimAt(top, r.r2, phi) : top),
            ],
            true,
          );
      }
      continue;
    }
    // Spheres and hemispheres: the outline is the great circle at right angles to the view.
    const s1 = unit3(
        cross3(V, Math.abs(V.y) < 0.95 ? v3(0, 1, 0) : v3(1, 0, 0)),
      ),
      s2 = cross3(V, s1);
    const ring = (keep: (p: V3) => boolean) => {
      const samples = Array.from({ length: STEPS + 1 }, (_, i) => {
        const t = (2 * Math.PI * i) / STEPS;
        const p = add3(
          r.c,
          add3(mul3(s1, r.r1 * Math.cos(t)), mul3(s2, r.r1 * Math.sin(t))),
        );
        return { p: pr(p), visible: keep(p) };
      });
      for (const run of splitRuns(samples, true))
        if (run.visible) push(run.pts, true);
    };
    if (s.type === "sphere") {
      ring(() => true);
      if (s.equator) rims.push({ c: r.c, r: r.r1, e1: r.e1, e2: r.e2, visible: (phi) => dot3(radial(phi), V) > EPS });
      continue;
    }
    if (s.type !== "hemisphere") continue;
    const flatUp = s.flat === "up";
    const flatNormal = flatUp ? v3(0, 1, 0) : v3(0, -1, 0);
    // The dome's half of the outline is on the side away from the flat face.
    ring((p) => dot3(sub3(p, r.c), flatNormal) <= 1e-9);
    const face =
      dot3(flatNormal, V) > EPS &&
      !glued(d, built, s.id, r.c, flatNormal, r.r1);
    rims.push({ c: r.c, r: r.r1, e1: r.e1, e2: r.e2, visible: (phi) => face || dot3(radial(phi), V) > EPS });
  }
  // Stuck-together round solids share a rim: draw it once, each part solid if either solid shows it.
  const groups: Rim[][] = [];
  for (const rim of rims) {
    const same = groups.find((gr) => len3(sub3(gr[0].c, rim.c)) < 0.05 && Math.abs(gr[0].r - rim.r) < 0.05 && len3(sub3(gr[0].e1, rim.e1)) < 1e-9 && len3(sub3(gr[0].e2, rim.e2)) < 1e-9);
    if (same) same.push(rim);
    else groups.push([rim]);
  }
  for (const gr of groups) {
    const { c, r, e1, e2 } = gr[0];
    const samples = Array.from({ length: STEPS + 1 }, (_, i) => {
      const phi = (2 * Math.PI * i) / STEPS;
      return { p: pr(add3(c, add3(mul3(e1, r * Math.cos(phi)), mul3(e2, r * Math.sin(phi))))), visible: gr.some((x) => x.visible(phi)) };
    });
    for (const run of splitRuns(samples, true)) push(run.pts, run.visible);
  }
  return { built, projection: proj, screen, pieces };
}

/* ---------- Text ---------- */

const n = (v: number) => String(Math.round(v * 1000) / 1000);
const esc = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
const FAMILY = "STIX Two Text,STIX Two Math,serif";
const LINE_TEXT = "______";
/** What a label prints on one copy, and whether it is in the answer colour. Empty text prints nothing. Angle sizes take a degree sign. */
export function printed(
  l: Label,
  view: View,
  isAngle = false,
): { text: string; answer: boolean } {
  const fmt = (t: string) => (isAngle ? degrees(t) : t);
  if (view === "answer" && l.state !== "value" && l.answer)
    return { text: fmt(l.answer), answer: true };
  if (l.state === "value" || l.state === "symbol")
    return { text: fmt(l.text), answer: false };
  if (l.state === "answer-line")
    return { text: isAngle ? LINE_TEXT + "°" : LINE_TEXT, answer: false };
  return { text: "", answer: false };
}

/* ---------- Validation ---------- */

function noteError(path: (string | number)[], message: string): string {
  const where = path.join(".");
  const key =
    [...path].reverse().find((k): k is string => typeof k === "string") ?? "";
  if (key === "text" && path.includes("names"))
    return "Use point names of at most 3 characters, such as A or B1.";
  if (key === "text" || key === "answer")
    return `Use labels of at most ${MAX_LABEL} characters without markup (${where}).`;
  if (path.includes("solids") && key === "id")
    return `${where}: a solid's ID is one to three lower-case letters, such as p or cyl; its corners are named after it.`;
  if (["id", "a", "b", "at", "from", "to"].includes(key))
    return `${where}: IDs are short lower-case names such as a, p1 or m (letters and digits, starting with a letter).`;
  if (key === "x" || key === "y" || key === "z")
    return `${where}: keep positions within ${REACH} mm of the middle of the figure.`;
  return `${where}: ${message}`;
}
export function validate(input: unknown): Envelope {
  const parsed = envelopeSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue?.path ?? [];
    throw Error(
      path.length > 1
        ? noteError(path as (string | number)[], issue.message)
        : path.length
          ? `${path.join(".")}: ${issue.message}`
          : "This is not a supported 3D solids file (version 1 is supported).",
    );
  }
  const e = parsed.data,
    d = e.document;
  const ids = new Set<string>();
  const claim = (pid: string, what: string) => {
    if (ids.has(pid))
      throw Error(`Two things are called ${pid}${what}. Give each its own ID.`);
    ids.add(pid);
  };
  const solidIds = new Set<string>();
  for (const s of d.solids) {
    if (solidIds.has(s.id))
      throw Error(`There are two solids called ${s.id}. Give each its own ID.`);
    solidIds.add(s.id);
    for (const pid of solidPointIds(s))
      claim(pid, ` (a corner or centre of solid ${s.id})`);
  }
  for (const p of d.points) claim(p.id, "");
  for (const list of [d.lines, d.dims, d.angles]) {
    const seen = new Set<string>();
    for (const x of list) {
      if (seen.has(x.id))
        throw Error(
          `There are two objects called ${x.id}. Give each its own ID.`,
        );
      seen.add(x.id);
    }
  }
  for (const s of d.solids) {
    if (s.type === "prism" || s.type === "pyramid") {
      const poly = s.type === "prism" ? s.section : s.base;
      let area = 0;
      for (let i = 0; i < poly.length; i++) {
        const a = poly[i],
          b = poly[(i + 1) % poly.length];
        area += a.x * b.y - b.x * a.y;
      }
      if (Math.abs(area) < 4)
        throw Error(
          `Solid ${s.id}'s ${s.type === "prism" ? "cross-section" : "base"} has almost no area. Spread its corners out.`,
        );
    }
    if (s.type === "pyramid" && Math.abs(s.apex.y) < 1)
      throw Error(
        `Pyramid ${s.id}'s apex is level with its base. Raise it (apex y) or lower it.`,
      );
  }
  const b = build(d);
  const ref = (pid: string, by: string) => {
    const p = b.points.get(pid);
    if (!p)
      throw Error(`${by} refers to point ${pid}, which is not in the figure.`);
    return p;
  };
  const tidy = (l: Label, by: string, what: "length" | "size") => {
    l.text = l.text.trim().replace(/\s+/g, " ");
    l.answer = l.answer.trim().replace(/\s+/g, " ");
    if (l.state === "value" && l.answer)
      throw Error(
        `${by} is a given ${what}, so it cannot hold a saved answer. Clear the answer or change the label.`,
      );
    if ((l.state === "value" || l.state === "symbol") && !l.text)
      throw Error(
        `${by} is ${l.state === "value" ? `a given ${what}` : "a letter"} but has no text. Type it, or make the label blank.`,
      );
  };
  for (const l of d.lines)
    if (len3(sub3(ref(l.b, `Line ${l.id}`), ref(l.a, `Line ${l.id}`))) < 0.5)
      throw Error(
        `Line ${l.id} joins ${l.a} and ${l.b}, which are in the same place.`,
      );
  const pr = projection(d.view).project;
  for (const m of d.dims) {
    const a = ref(m.a, `Length ${m.id}`),
      c = ref(m.b, `Length ${m.id}`);
    if (len(sub(pr(c), pr(a))) < 2)
      throw Error(
        `Length ${m.id} runs from ${m.a} to ${m.b}, which are drawn almost on top of each other. Choose two points further apart.`,
      );
    tidy(m.label, `Length ${m.id}`, "length");
  }
  for (const a of d.angles) {
    const v = ref(a.at, `Angle ${a.id}`),
      p = ref(a.from, `Angle ${a.id}`),
      q = ref(a.to, `Angle ${a.id}`);
    if (len3(sub3(p, v)) < 0.5 || len3(sub3(q, v)) < 0.5)
      throw Error(
        `Angle ${a.id} has an arm with no length: its points are in the same place as its vertex ${a.at}.`,
      );
    if (len3(cross3(unit3(sub3(p, v)), unit3(sub3(q, v)))) < 0.02)
      throw Error(
        `Angle ${a.id}'s arms lie along one line, so there is no angle to mark.`,
      );
    tidy(a.label, `Angle ${a.id}`, "size");
  }
  for (const nm of d.names) {
    ref(nm.id, "A point name");
    nm.text = nm.text.trim();
  }
  d.names = d.names.filter((x) => x.text);
  return e;
}
const envelope = defineEnvelope<Envelope>({
  kind: "solids",
  validate,
  canonical: "sorted",
});
export const canonical = envelope.canonical;
export const hash = envelope.contentHash;
export function parseFile(text: string) {
  if (text.length > 60_000) throw Error("This editable file is too large.");
  return validate(JSON.parse(text));
}
const labels = (d: SolidsDocument) => [
  ...d.dims.map((x) => x.label),
  ...d.angles.map((a) => a.label),
];
export const hasHidden = (e: Envelope) =>
  labels(e.document).some((l) => l.state !== "value" && l.answer);

/* ---------- Building ---------- */

export function blank(): Envelope {
  return {
    kind: "solids",
    schemaVersion: 1,
    rendererVersion: RENDERER_VERSION,
    document: {
      view: { type: "oblique", angle: 35, scale: 0.5 },
      solids: [
        {
          id: "p",
          type: "prism",
          at: { x: 0, y: 0, z: 0 },
          section: [
            { x: 0, y: 0 },
            { x: 40, y: 0 },
            { x: 40, y: 25 },
            { x: 0, y: 25 },
          ],
          length: 30,
          axis: "z",
        },
      ],
      points: [],
      names: [],
      lines: [],
      dims: [],
      angles: [],
      hidden: "dashed",
      notToScale: true,
    },
  };
}
/** A cuboid with its three lengths given: the starting figure. */
export function create(): Envelope {
  const e = blank(),
    d = e.document;
  d.dims = [
    dim("w", "p1", "p2", label("8 cm")),
    dim("h", "p1", "p4", label("5 cm")),
    dim("dp", "p2", "pb2", label("6 cm")),
  ];
  return validate(e);
}

/* ---------- Layout ---------- */

const MARGIN = 2;
const ALONG = [0.5, 0.42, 0.58, 0.34, 0.66, 0.26, 0.74, 0.2, 0.8];
const FRACTIONS = [0.5, 0.42, 0.58, 0.34, 0.66, 0.26, 0.74, 0.18, 0.82];
const ARC = 5;
const ARROW = { long: 2.4, half: 0.8 };
const CAPTION = "Diagram NOT accurately drawn";
type Rect = { x: number; y: number; w: number; h: number };
export type PlacedText = {
  id: string;
  text: { pupil: string; answer: string };
  centre: P;
  box: Rect;
  clear: boolean;
};
export type PlacedDim = PlacedText & { arrow: [P, P] | null };
export type PlacedAngle = PlacedText & {
  vertex: P;
  start: number;
  sweep: number;
  radius: number;
};
export type Layout = {
  width: number;
  height: number;
  font: number;
  map: (p: P) => P;
  geometry: Geometry;
  lines: Piece[];
  dims: PlacedDim[];
  angles: PlacedAngle[];
  names: { id: string; text: string; centre: P }[];
  caption: P | null;
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
const overlaps = (a: Rect, b: Rect, gap = 0.6) =>
  a.x + a.w + gap > b.x &&
  b.x + b.w + gap > a.x &&
  a.y + a.h + gap > b.y &&
  b.y + b.h + gap > a.y;
const grow = (r: Rect, by: number): Rect => ({
  x: r.x - by,
  y: r.y - by,
  w: r.w + 2 * by,
  h: r.h + 2 * by,
});
const boxAt = (c: P, w: number, h: number): Rect => ({
  x: c.x - w / 2,
  y: c.y - h / 2,
  w,
  h,
});
const reachOf = (u: P, w: number, h: number) =>
  Math.abs(u.x) * w * 0.5 + Math.abs(u.y) * h * 0.5;
function roomiest(dirs: number[], fallback: number): number {
  if (!dirs.length) return fallback;
  const s = [
    ...new Set(dirs.map((x) => Math.round(norm(x) * 1000) / 1000)),
  ].sort((a, b) => a - b);
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
const segmentsOf = (p: Piece): [P, P][] =>
  p.pts.slice(1).map((q, i) => [p.pts[i], q]);

/** Places every label once, sized for the wider of its two copies, clear of lines and of each other. */
export function layout(e: Envelope): Layout {
  const d = e.document,
    font = ((d.fontPt ?? 11) * 25.4) / 72;
  const g = geometry(d);
  const S = (pid: string) => g.screen.get(pid)!;
  const issues: string[] = [];
  const lines: Piece[] = d.lines.map((l) => ({
    pts: [S(l.a), S(l.b)],
    hidden: false,
    style: l.style,
  }));
  const drawn = [
    ...g.pieces.filter((p) => !p.hidden || d.hidden === "dashed"),
    ...lines,
  ];
  const obstacles: [P, P][] = drawn.flatMap(segmentsOf);
  const placed: Rect[] = [];
  const clearOf = (box: Rect, pad = 0.4) =>
    !obstacles.some(([a, b]) => hitsSegment(grow(box, pad), a, b)) &&
    // A small gap between texts, so a name never runs into a length beside it.
    !placed.some((p) => overlaps(p, grow(box, 0.5)));
  for (const p of d.points)
    if (p.show === "dot") placed.push(boxAt(S(p.id), 1.4, 1.4));
  // The middle of the drawing: labels go away from it, outside the solids.
  const all = drawn.flatMap((p) => p.pts);
  const middle = mul(
    all.reduce(add, { x: 0, y: 0 }),
    1 / Math.max(1, all.length),
  );
  const sized = (l: Label, isAngle = false) => {
    const text = {
      pupil: printed(l, "pupil", isAngle).text,
      answer: printed(l, "answer", isAngle).text,
    };
    const w = Math.max(
      text.pupil ? textWidth(text.pupil, font) : 0,
      text.answer ? textWidth(text.answer, font) : 0,
    );
    const h = Math.max(
      text.pupil ? textHeight(text.pupil, font) : 0,
      text.answer ? textHeight(text.answer, font) : 0,
    );
    return { text, w, h };
  };

  // Angles first: their labels need the space inside the angle.
  const angles: PlacedAngle[] = [];
  for (const a of d.angles) {
    const v = S(a.at);
    let start = heading(sub(S(a.from), v)),
      sweep = ccw(start, heading(sub(S(a.to), v)));
    // Drawn on the page, the angle is the smaller turn between its projected arms.
    if (sweep > 180) {
      start = norm(start + sweep);
      sweep = 360 - sweep;
    }
    const radius = sweep < 25 ? ARC + 3 : sweep < 45 ? ARC + 1.5 : ARC;
    const { text, w, h } = sized(a.label, true);
    if (!w) {
      angles.push({
        id: a.id,
        text,
        vertex: v,
        start,
        sweep,
        radius,
        centre: v,
        box: boxAt(v, 0, 0),
        clear: true,
      });
      continue;
    }
    let chosen: Rect | null = null;
    let best = Infinity;
    for (let dist = radius + 0.6; dist < radius + 20; dist += 0.4)
      for (const t of FRACTIONS) {
        const u = dir(start + sweep * t);
        const at = dist + reachOf(u, w, h);
        if (at >= best - 1e-9) continue;
        const box = boxAt(add(v, mul(u, at)), w, h);
        if (clearOf(box)) {
          chosen = box;
          best = at;
        }
      }
    const clear = chosen !== null;
    if (!chosen) {
      const u = dir(start + sweep / 2);
      chosen = boxAt(add(v, mul(u, radius + 2 + reachOf(u, w, h))), w, h);
      issues.push(
        `The label for angle ${a.id} has no clear space. Make the solid larger or the label shorter.`,
      );
    }
    placed.push(chosen);
    angles.push({
      id: a.id,
      text,
      vertex: v,
      start,
      sweep,
      radius,
      centre: { x: chosen.x + w / 2, y: chosen.y + h / 2 },
      box: chosen,
      clear,
    });
  }

  const dims: PlacedDim[] = [];
  for (const m of d.dims) {
    const a = S(m.a),
      b = S(m.b),
      u = unit(sub(b, a)),
      left = perp(u);
    const outside = dot(sub(mul(add(a, b), 0.5), middle), left) >= 0 ? 1 : -1;
    const order =
      m.side === "left" ? [1] : m.side === "right" ? [-1] : [outside, -outside];
    const { text, w, h } = sized(m.label);
    let arrow: [P, P] | null = null;
    let base = a,
      tip = b;
    if (m.kind === "arrow") {
      // A positive offset is on the label's side (or outside the solid when the side is auto).
      const shift = mul(left, m.offset * order[0]);
      base = add(a, shift);
      tip = add(b, shift);
      arrow = [base, tip];
      obstacles.push([base, tip]);
    }
    if (!w) {
      dims.push({
        id: m.id,
        text,
        arrow,
        centre: mul(add(base, tip), 0.5),
        box: boxAt(mul(add(base, tip), 0.5), 0, 0),
        clear: true,
      });
      continue;
    }
    let chosen: Rect | null = null;
    if (m.kind === "arrow" && m.gap) {
      // The label sits in a gap in the arrow, as on exam papers; the gap is cut when drawing.
      chosen = boxAt(mul(add(base, tip), 0.5), w, h);
      if (
        len(sub(tip, base)) <
        Math.abs(dot(u, { x: w, y: 0 })) +
          Math.abs(dot(u, { x: 0, y: h })) +
          2 * ARROW.long +
          2
      )
        issues.push(
          `Length ${m.id}'s arrow is too short for its label to sit in it. Turn off the gap or move the arrow.`,
        );
      const ownLine = (x: [P, P]) => x[0] === base && x[1] === tip;
      if (
        obstacles.some(
          (x) => !ownLine(x) && hitsSegment(grow(chosen!, 0.3), x[0], x[1]),
        ) ||
        placed.some((p) => overlaps(p, chosen!))
      )
        issues.push(
          `Length ${m.id}'s label crosses a line. Move its arrow further out.`,
        );
    } else
      // Near the line on its own side first, then near on the other side (auto only), then further out.
      search: for (const [from, to] of [
        [1, 7],
        [7, 14],
      ])
        for (const sign of order)
          for (let dist = from; dist < to; dist += 0.4)
            for (const t of ALONG) {
              const nrm = mul(left, sign);
              const box = boxAt(
                add(
                  add(base, mul(sub(tip, base), t)),
                  mul(nrm, dist + reachOf(nrm, w, h)),
                ),
                w,
                h,
              );
              if (clearOf(box)) {
                chosen = box;
                break search;
              }
            }
    const clear = chosen !== null;
    if (!chosen) {
      const nrm = mul(left, order[0]);
      chosen = boxAt(
        add(mul(add(base, tip), 0.5), mul(nrm, 1.5 + reachOf(nrm, w, h))),
        w,
        h,
      );
      issues.push(
        `Length ${m.id}'s label has no clear space. Make the solid larger or the label shorter.`,
      );
    }
    placed.push(chosen);
    dims.push({
      id: m.id,
      text,
      arrow,
      centre: { x: chosen.x + w / 2, y: chosen.y + h / 2 },
      box: chosen,
      clear,
    });
  }

  const names: Layout["names"] = [];
  for (const nm of d.names) {
    const at = S(nm.id);
    const w = textWidth(nm.text, font),
      h = font * 1.05;
    // Directions of every drawn line leaving the point.
    const dirs: number[] = [];
    for (const [p, q] of obstacles)
      for (const [x, y] of [
        [p, q],
        [q, p],
      ])
        if (len(sub(x, at)) < 0.3 && len(sub(y, at)) > 0.3)
          dirs.push(heading(sub(y, at)));
    const best = roomiest(dirs, heading(sub(at, middle)));
    let centre: P | null = null;
    search: for (let dist = 0.8; dist < 12; dist += 0.3)
      for (const off of [0, -15, 15, -30, 30, -45, 45, -60, 60]) {
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
      issues.push(
        `Point ${nm.text} (${nm.id}) has no clear space for its name. Make the solid larger.`,
      );
    }
    placed.push(boxAt(centre, w, h));
    names.push({ id: nm.id, text: nm.text, centre });
  }

  const xs: number[] = [],
    ys: number[] = [];
  const take = (p: P) => {
    xs.push(p.x);
    ys.push(p.y);
  };
  for (const p of all) take(p);
  for (const [a, b] of obstacles) {
    take(a);
    take(b);
  }
  for (const l of angles)
    for (let i = 0; i <= 12; i++)
      take(
        add(l.vertex, mul(dir(l.start + (l.sweep * i) / 12), l.radius + 0.3)),
      );
  for (const r of placed) {
    take({ x: r.x, y: r.y });
    take({ x: r.x + r.w, y: r.y + r.h });
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
    caption = {
      x: maxX - minX - MARGIN - w / 2,
      y: height + captionFont * 0.9,
    };
    height += captionFont * 1.4;
  }
  const map = (p: P): P => ({ x: p.x - minX, y: maxY - p.y });
  const width = Math.ceil((maxX - minX) * 10) / 10;
  height = Math.ceil(height * 10) / 10;
  if (width > 270)
    issues.push(`The drawing is ${n(width / 10)} cm wide. Make it smaller.`);
  if (height > 270)
    issues.push(`The drawing is ${n(height / 10)} cm tall. Make it smaller.`);
  return {
    width,
    height,
    font,
    map,
    geometry: g,
    lines,
    dims,
    angles,
    names,
    caption,
    issues,
    notes: teacherNotes(d, g),
  };
}

/** Teacher-only notes (never printed): a right-angle mark on an angle that is not square in 3D, and repeated point names. */
export function teacherNotes(
  d: SolidsDocument,
  g: Geometry = geometry(d),
): string[] {
  const notes: string[] = [];
  const P3 = (pid: string) => g.built.points.get(pid)!;
  for (const a of d.angles) {
    if (a.mark !== "right") continue;
    const u = unit3(sub3(P3(a.from), P3(a.at))),
      w = unit3(sub3(P3(a.to), P3(a.at)));
    const deg =
      (Math.acos(Math.max(-1, Math.min(1, dot3(u, w)))) * 180) / Math.PI;
    if (Math.abs(deg - 90) > 5)
      notes.push(
        `Angle ${a.id} has a right-angle mark but its arms meet at ${Math.round(deg)}° in the solid.`,
      );
  }
  const seen = new Map<string, string>();
  for (const nm of d.names) {
    const before = seen.get(nm.text);
    if (before)
      notes.push(`Points ${before} and ${nm.id} are both named ${nm.text}.`);
    else seen.set(nm.text, nm.id);
  }
  return notes;
}
export const exportIssue = (e: Envelope) => layout(e).issues.join(" ") || null;
export const warnings = (e: Envelope) => {
  const g = layout(e);
  return [...g.issues, ...g.notes];
};

/* ---------- SVG ---------- */

const MAIN = 0.26;
const THIN = 0.2;
const dash = (style: LineStyle) =>
  style === "dashed"
    ? ' stroke-dasharray="1.2 0.9"'
    : style === "dotted"
      ? ' stroke-dasharray="0.15 0.7"'
      : "";
function arcPath(
  c: P,
  r: number,
  start: number,
  sweep: number,
  map: Layout["map"],
) {
  const a = map(add(c, mul(dir(start), r))),
    b = map(add(c, mul(dir(start + sweep), r)));
  return `M${n(a.x)} ${n(a.y)}A${n(r)} ${n(r)} 0 ${sweep > 180 ? 1 : 0} 0 ${n(b.x)} ${n(b.y)}`;
}
function head(tip: P, back: P, map: Layout["map"]) {
  const u = unit(sub(tip, back)),
    nrm = perp(u),
    b = sub(tip, mul(u, ARROW.long));
  const t = map(tip),
    p = map(add(b, mul(nrm, ARROW.half))),
    q = map(sub(b, mul(nrm, ARROW.half)));
  return `<path d="M${n(t.x)} ${n(t.y)}L${n(p.x)} ${n(p.y)}L${n(q.x)} ${n(q.y)}Z" fill="black"/>`;
}

/** The artwork at its printed size in mm. The answers copy adds saved answers in the answer colour. */
export function renderSvg(e: Envelope, view: View = "pupil"): string {
  const d = validate(structuredClone(e)).document;
  const g = layout({ ...e, document: d });
  const map = g.map;
  const out: string[] = [
    `<rect width="${n(g.width)}" height="${n(g.height)}" fill="white"/>`,
  ];
  const path = (pts: P[]) =>
    pts.map((p, i) => `${i ? "L" : "M"}${n(map(p).x)} ${n(map(p).y)}`).join("");
  const groups = new Map<LineStyle, string[]>();
  for (const p of [
    ...g.geometry.pieces.filter((x) => !x.hidden || d.hidden === "dashed"),
    ...g.lines,
  ]) {
    const list = groups.get(p.style) ?? [];
    list.push(path(p.pts));
    groups.set(p.style, list);
  }
  for (const style of STYLES) {
    const list = groups.get(style);
    if (list?.length)
      out.push(
        `<path d="${list.join("")}" fill="none" stroke="black" stroke-width="${MAIN}" stroke-linejoin="round" stroke-linecap="round"${dash(style)}/>`,
      );
  }
  const marks: string[] = [];
  const heads: string[] = [];
  const S3 = (pid: string) => g.geometry.built.points.get(pid)!;
  for (const l of g.angles) {
    const a = d.angles.find((x) => x.id === l.id)!;
    if (a.mark === "arc")
      marks.push(arcPath(l.vertex, l.radius, l.start, l.sweep, map));
    if (a.mark === "right") {
      // A square in the plane of the arms, drawn in the solid's own view.
      const pr = g.geometry.projection.project;
      const v = S3(a.at),
        u1 = unit3(sub3(S3(a.from), v)),
        u2 = unit3(sub3(S3(a.to), v));
      const scale = Math.max(
        0.35,
        Math.min(
          len(sub(pr(add3(v, u1)), pr(v))),
          len(sub(pr(add3(v, u2)), pr(v))),
        ),
      );
      const k = 2.4 / scale;
      marks.push(
        path([
          pr(add3(v, mul3(u1, k))),
          pr(add3(v, add3(mul3(u1, k), mul3(u2, k)))),
          pr(add3(v, mul3(u2, k))),
        ]),
      );
    }
  }
  for (const m of g.dims) {
    if (!m.arrow) continue;
    const [a, b] = m.arrow;
    const dm = d.dims.find((x) => x.id === m.id)!;
    const u = unit(sub(b, a));
    if (dm.gap && m.box.w) {
      // Leave a gap round the label.
      const half =
        Math.abs(u.x) * (m.box.w / 2 + 0.8) +
        Math.abs(u.y) * (m.box.h / 2 + 0.6);
      const mid = mul(add(a, b), 0.5);
      marks.push(
        path([a, sub(mid, mul(u, half))]),
        path([add(mid, mul(u, half)), b]),
      );
    } else marks.push(path([a, b]));
    heads.push(head(a, b, map), head(b, a, map));
  }
  if (marks.length)
    out.push(
      `<path d="${marks.join("")}" fill="none" stroke="black" stroke-width="${THIN}" stroke-linejoin="round"/>`,
    );
  out.push(...heads);
  for (const p of d.points)
    if (p.show === "dot") {
      const m = map(g.geometry.screen.get(p.id)!);
      out.push(`<circle cx="${n(m.x)}" cy="${n(m.y)}" r="0.5" fill="black"/>`);
    }
  const texts: string[] = [];
  for (const l of [...g.angles, ...g.dims]) {
    const isAngle = "vertex" in l;
    const lab = isAngle
      ? d.angles.find((a) => a.id === l.id)!.label
      : d.dims.find((x) => x.id === l.id)!.label;
    const p = printed(lab, view, isAngle);
    if (!p.text) continue;
    const c = map(l.centre);
    texts.push(
      textSvg(p.text, c.x, c.y, g.font, p.answer ? ANSWER_COLOUR : "black"),
    );
  }
  for (const nm of g.names) {
    const c = map(nm.centre);
    texts.push(
      `<text x="${n(c.x)}" y="${n(c.y + g.font * 0.34)}" text-anchor="middle" font-family="${FAMILY}" font-size="${n(g.font)}" font-style="italic" fill="black">${esc(nm.text)}</text>`,
    );
  }
  if (g.caption)
    texts.push(
      `<text x="${n(g.caption.x)}" y="${n(g.caption.y)}" text-anchor="middle" font-family="${FAMILY}" font-size="${n((MIN_TEXT_PT * 25.4) / 72)}" fill="black">${CAPTION}</text>`,
    );
  out.push(...texts);
  const body = boldLines(out.join(""), d.weight);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${n(g.width)}mm" height="${n(g.height)}mm" viewBox="0 0 ${n(g.width)} ${n(g.height)}" role="img" aria-label="${esc(altText(e))}">${body}</svg>`;
}

const SOLID_NAMES: Record<SolidType, string> = {
  prism: "prism",
  pyramid: "pyramid",
  cylinder: "cylinder",
  cone: "cone",
  sphere: "sphere",
  hemisphere: "hemisphere",
};
/** Plain description of the pupil copy; it never names a saved answer. */
export function altText(e: Envelope): string {
  const d = e.document;
  const what = d.solids.map((s) => {
    if (s.type === "prism")
      return s.section.length === 4
        ? "a cuboid or prism"
        : s.section.length === 3
          ? "a triangular prism"
          : "a prism";
    if (s.type === "pyramid")
      return s.top > 0 ? "a frustum of a pyramid" : "a pyramid";
    if (s.type === "cone" && s.top > 0) return "a frustum of a cone";
    return `a ${SOLID_NAMES[s.type]}`;
  });
  const parts = [`3D drawing of ${what.join(" and ")}`];
  const named = d.names.map((x) => x.text);
  if (named.length) parts.push(`points ${named.join(", ")}`);
  const given = d.dims
    .filter((m) => m.label.state === "value")
    .map((m) => m.label.text);
  if (given.length) parts.push(`lengths ${given.join(", ")}`);
  const angles = d.angles
    .filter((a) => a.label.state === "value")
    .map((a) => degrees(a.label.text));
  if (angles.length) parts.push(`angles ${angles.join(", ")}`);
  const letters = [...d.dims, ...d.angles]
    .filter((x) => x.label.state === "symbol")
    .map((x) => x.label.text);
  if (letters.length) parts.push(`marked ${letters.join(", ")}`);
  return parts.join("; ") + (d.notToScale ? ". Not accurately drawn." : ".");
}

/* ---------- Links ---------- */

export const MAX_LINK_LENGTH = 16_000;
export const LINK_PREFIX = "#solids=";
export const linkHash = (e: Envelope): string =>
  LINK_PREFIX + envelope.encodeLink(e);
export function editorLink(e: Envelope, base: string): string | null {
  const url = new URL(base);
  url.pathname =
    url.pathname.replace(/(\/tools(\/[^/]*)?)?\/?$/, "/") + "tools/solids";
  url.search = "";
  url.hash = linkHash(e);
  return url.href.length <= MAX_LINK_LENGTH ? url.href : null;
}
export function decodeLinkHash(hashText: string): Envelope {
  if (
    !/^#solids=[A-Za-z0-9_-]+$/.test(hashText) ||
    hashText.length > MAX_LINK_LENGTH
  )
    throw Error(
      "This is not a supported 3D solids link. Open an editable file instead.",
    );
  try {
    return envelope.decodeLink(
      hashText.slice(LINK_PREFIX.length),
      MAX_LINK_LENGTH,
    );
  } catch {
    throw Error(
      "This 3D solids link could not be read. Open an editable file instead.",
    );
  }
}

/* ---------- Editor helpers ---------- */

/** Every point a label can refer to, with a readable name: corners and centres of each solid, then extra points. */
export function pointList(d: SolidsDocument): { id: string; name: string }[] {
  const named = new Map(d.names.map((x) => [x.id, x.text]));
  const out: { id: string; name: string }[] = [];
  for (const s of d.solids)
    for (const pid of solidPointIds(s)) {
      const role =
        pid.endsWith("o") && s.type !== "prism" && s.type !== "pyramid"
          ? "centre"
          : pid.endsWith("t") && s.type !== "prism"
            ? (s.type === "cone" && s.top === 0) || s.type === "pyramid"
              ? "apex"
              : "top centre"
            : "corner";
      out.push({
        id: pid,
        name: named.get(pid)
          ? `${named.get(pid)} (${pid})`
          : `${s.id} ${role} ${pid}`,
      });
    }
  for (const p of d.points)
    out.push({
      id: p.id,
      name: named.get(p.id) ? `${named.get(p.id)} (${p.id})` : `point ${p.id}`,
    });
  return out;
}
/** Where the editor puts each select button (artwork mm): on a label if there is one, else at the middle of its line or angle. */
export function hitAnchors(
  e: Envelope,
  g: Layout = layout(e),
): { id: string; kind: "dim" | "angle" | "point"; name: string; at: P }[] {
  const out: {
    id: string;
    kind: "dim" | "angle" | "point";
    name: string;
    at: P;
  }[] = [];
  const named = new Map(e.document.names.map((x) => [x.id, x.text]));
  const nm = (pid: string) => named.get(pid) ?? pid;
  for (const l of g.angles) {
    const a = e.document.angles.find((x) => x.id === l.id)!;
    out.push({
      id: l.id,
      kind: "angle",
      name: `angle ${nm(a.from)}${nm(a.at)}${nm(a.to)}`,
      at: g.map(
        l.box.w
          ? l.centre
          : add(l.vertex, mul(dir(l.start + l.sweep / 2), l.radius + 2)),
      ),
    });
  }
  for (const l of g.dims) {
    const m = e.document.dims.find((x) => x.id === l.id)!;
    out.push({
      id: l.id,
      kind: "dim",
      name: `length ${nm(m.a)}${nm(m.b)}`,
      at: g.map(l.centre),
    });
  }
  for (const [pid, p] of g.geometry.screen)
    out.push({
      id: pid,
      kind: "point",
      name: `point ${nm(pid)}`,
      at: g.map(p),
    });
  return out;
}
