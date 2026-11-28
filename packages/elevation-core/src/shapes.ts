import { z } from "zod";

/**
 * Solids built from shapes for plans and elevations (Hanley GM8.08-09): prisms (any cross-section,
 * including L-shapes and trapezia), pyramids, cylinders, cones, spheres and hemispheres.
 *
 * Units are grid squares (one square is `unitCm` on the plan and elevation grids). x runs across to
 * the right, y runs back from the front and z runs up, as for the cube solids: the plan looks down,
 * the front elevation looks from the front and the side elevation looks from the left.
 *
 * Every shape becomes a polyhedron (round surfaces as 64 flat strips whose shared edges are smooth).
 * A view draws each sharp edge, and each smooth edge where the surface turns away from the viewer
 * (the outline of a cylinder, cone or sphere). Every edge is cut wherever another edge crosses it in
 * the view, and each piece is hidden when a face lies in front of it. Hidden pieces are left out, as
 * on Edexcel elevations, or dashed when asked.
 */
export const SHAPE_TYPES = ["prism", "pyramid", "cylinder", "cone", "sphere", "hemisphere"] as const;
export type ShapeType = (typeof SHAPE_TYPES)[number];
export const AXES = ["x", "y", "z"] as const;
export type Axis = (typeof AXES)[number];
export const MAX_SHAPES = 4;
export const MAX_EXTENT = 12;
export const MAX_LENGTH_LABELS = 8;

const half = (min: number, max: number) =>
  z
    .number()
    .min(min)
    .max(max)
    .refine((v) => Math.abs(v * 2 - Math.round(v * 2)) < 1e-9, "Use whole or half squares.");
const coord = half(0, MAX_EXTENT);
const offset = half(-MAX_EXTENT, MAX_EXTENT);
export const p3Schema = z.object({ x: coord, y: coord, z: coord }).strict();
/** A corner (a, b): an array of two numbers rather than a tuple, so connector schemas stay plain arrays. */
const p2 = z.array(offset).length(2);
export const shapeSchema = z.discriminatedUnion("type", [
  /**
   * A prism: a cross-section of 3 to 12 corners carried `length` squares along an axis from `at`.
   * Axis y: the section is the FRONT face (across, up) and runs back. Axis x: the section is the LEFT
   * end (back, up) and runs right. Axis z: the section is the BASE (across, back) and runs up.
   */
  z.object({ type: z.literal("prism"), at: p3Schema, section: z.array(p2).min(3).max(12), axis: z.enum(AXES), length: half(0.5, MAX_EXTENT) }).strict(),
  /** A pyramid: a base of 3 to 12 corners (across, back) on the level of `at`, and its apex offset from `at`. */
  z.object({ type: z.literal("pyramid"), at: p3Schema, base: z.array(p2).min(3).max(12), apex: z.object({ x: offset, y: offset, z: half(0.5, MAX_EXTENT) }).strict() }).strict(),
  /** A cylinder: the centre of one end at `at`, radius r and length h along the axis. */
  z.object({ type: z.literal("cylinder"), at: p3Schema, r: half(0.5, 6), h: half(0.5, MAX_EXTENT), axis: z.enum(AXES) }).strict(),
  /** A cone: the centre of its base at `at`, radius r, and its apex h along the axis. */
  z.object({ type: z.literal("cone"), at: p3Schema, r: half(0.5, 6), h: half(0.5, MAX_EXTENT), axis: z.enum(AXES) }).strict(),
  /** A sphere: centre `at`, radius r. */
  z.object({ type: z.literal("sphere"), at: p3Schema, r: half(0.5, 6) }).strict(),
  /** A hemisphere: the middle of its flat face at `at`, radius r, flat face down (a dome) or up (a bowl). */
  z.object({ type: z.literal("hemisphere"), at: p3Schema, r: half(0.5, 6), flat: z.enum(["down", "up"]) }).strict(),
]);
export type Shape = z.infer<typeof shapeSchema>;
/** A length printed beside an edge of the 3D drawing, such as "5 cm", between two corners of the solid. */
export const lengthLabelSchema = z
  .object({
    a: p3Schema,
    b: p3Schema,
    text: z
      .string()
      .max(12)
      .refine((s) => ![...s].some((c) => c.charCodeAt(0) < 32 || c === "<" || c === ">"), "Use ordinary text without markup."),
    show: z.enum(["show", "hidden"]),
  })
  .strict();
export type LengthLabel = z.infer<typeof lengthLabelSchema>;

export type V3 = { x: number; y: number; z: number };
export type P = { x: number; y: number };
const v3 = (x: number, y: number, zz: number): V3 => ({ x, y, z: zz });
const add = (a: V3, b: V3) => v3(a.x + b.x, a.y + b.y, a.z + b.z);
const sub = (a: V3, b: V3) => v3(a.x - b.x, a.y - b.y, a.z - b.z);
const mul = (a: V3, k: number) => v3(a.x * k, a.y * k, a.z * k);
const dot = (a: V3, b: V3) => a.x * b.x + a.y * b.y + a.z * b.z;
const cross = (a: V3, b: V3) => v3(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
const length = (a: V3) => Math.hypot(a.x, a.y, a.z);
const unit = (a: V3) => mul(a, 1 / length(a));

const AXIS: Record<Axis, V3> = { x: v3(1, 0, 0), y: v3(0, 1, 0), z: v3(0, 0, 1) };
/** Two directions at right angles to an axis, for circles round it. */
const FRAME: Record<Axis, [V3, V3]> = { x: [v3(0, 1, 0), v3(0, 0, 1)], y: [v3(1, 0, 0), v3(0, 0, 1)], z: [v3(1, 0, 0), v3(0, 1, 0)] };
/** Where a section corner (a, b) goes for a prism along each axis. */
const sectionPoint = (axis: Axis, at: V3, [a, b]: number[]) =>
  axis === "y" ? add(at, v3(a, 0, b)) : axis === "x" ? add(at, v3(0, a, b)) : add(at, v3(a, b, 0));

/** Strips round a circle; a multiple of 4, so the outline of a round solid falls exactly on an edge in every grid view. */
export const STRIPS = 64;

export type Mesh = {
  points: V3[];
  /** Corner indexes in order, anticlockwise seen from outside, with the outward normal. */
  faces: { ids: number[]; normal: V3; solid: number }[];
  /** Each edge once: its two faces and whether it is smooth (inside a curved surface). */
  edges: { a: number; b: number; faces: number[]; smooth: boolean }[];
  /** Cone apexes: drawn as a dot when the view looks straight along the cone. */
  apexes: { at: number; axis: V3 }[];
};

function newell(pts: V3[]): V3 {
  let n = v3(0, 0, 0);
  pts.forEach((p, i) => {
    const q = pts[(i + 1) % pts.length];
    n = add(n, v3((p.y - q.y) * (p.z + q.z), (p.z - q.z) * (p.x + q.x), (p.x - q.x) * (p.y + q.y)));
  });
  return n;
}

/** Builds every shape into one mesh; throws a teacher-facing reason for a shape that cannot be built. */
export function buildMesh(shapes: Shape[]): Mesh {
  const points: V3[] = [];
  const faces: (Mesh["faces"][number] & { curved: boolean })[] = [];
  const apexes: Mesh["apexes"] = [];
  const point = (p: V3) => points.push(p) - 1;
  /** A face; `centre` (inside a convex round solid) turns it to face outwards. */
  const face = (ids: number[], solid: number, curved = false, centre?: V3) => {
    let n = newell(ids.map((i) => points[i]));
    if (length(n) < 1e-12) return;
    if (centre) {
      const mid = mul(ids.reduce((acc, i) => add(acc, points[i]), v3(0, 0, 0)), 1 / ids.length);
      if (dot(n, sub(mid, centre)) < 0) {
        ids = [...ids].reverse();
        n = mul(n, -1);
      }
    }
    faces.push({ ids, normal: unit(n), solid, curved });
  };
  const ring = (c: V3, axis: Axis, r: number) => {
    const [e1, e2] = FRAME[axis];
    return Array.from({ length: STRIPS }, (_, k) => {
      const t = (2 * Math.PI * k) / STRIPS;
      return point(add(c, add(mul(e1, r * Math.cos(t)), mul(e2, r * Math.sin(t)))));
    });
  };
  /** Orders a ring of corners anticlockwise seen from the `toward` side. */
  const facing = (ids: number[], toward: V3) => (dot(newell(ids.map((i) => points[i])), toward) < 0 ? [...ids].reverse() : ids);
  shapes.forEach((given, si) => {
    let s = given;
    const at = v3(s.at.x, s.at.y, s.at.z);
    const which = `Shape ${si + 1} (${s.type})`;
    if (s.type === "prism" || s.type === "pyramid") {
      // A corner on a straight side (or a repeated corner) is not a corner of the solid: drop it, so no false edge is drawn.
      const corners = straighten(s.type === "prism" ? s.section : s.base);
      if (s.type === "prism") s = { ...s, section: corners };
      else s = { ...s, base: corners };
      const flat = corners.map(([a, b]) => ({ x: a, y: b }));
      let area = 0;
      flat.forEach((p, i) => {
        const q = flat[(i + 1) % flat.length];
        area += p.x * q.y - q.x * p.y;
      });
      if (Math.abs(area) < 1e-9) throw Error(`${which} has corners in a line; its ${s.type === "prism" ? "cross-section" : "base"} needs an area.`);
      if (selfCrossing(flat)) throw Error(`${which}: the sides of its ${s.type === "prism" ? "cross-section" : "base"} cross. List the corners in order round the shape.`);
    }
    if (s.type === "prism") {
      const dir = AXIS[s.axis];
      const start = facing(
        s.section.map((q) => point(sectionPoint(s.axis, at, q))),
        dir,
      );
      const end = start.map((i) => point(add(points[i], mul(dir, s.length))));
      face([...start].reverse(), si);
      face(end, si);
      start.forEach((_, i) => {
        const j = (i + 1) % start.length;
        face([start[i], start[j], end[j], end[i]], si);
      });
    } else if (s.type === "pyramid") {
      const base = facing(
        s.base.map(([a, b]) => point(add(at, v3(a, b, 0)))),
        v3(0, 0, 1),
      );
      const apex = point(add(at, v3(s.apex.x, s.apex.y, s.apex.z)));
      face([...base].reverse(), si);
      base.forEach((_, i) => face([base[i], base[(i + 1) % base.length], apex], si));
    } else if (s.type === "cylinder" || s.type === "cone") {
      const dir = AXIS[s.axis];
      const centre = add(at, mul(dir, s.h / 3));
      const start = ring(at, s.axis, s.r);
      face(start, si, false, centre);
      if (s.type === "cylinder") {
        const end = start.map((i) => point(add(points[i], mul(dir, s.h))));
        face(end, si, false, centre);
        start.forEach((_, i) => {
          const j = (i + 1) % STRIPS;
          face([start[i], start[j], end[j], end[i]], si, true, centre);
        });
      } else {
        const apex = point(add(at, mul(dir, s.h)));
        apexes.push({ at: apex, axis: dir });
        start.forEach((_, i) => face([start[i], start[(i + 1) % STRIPS], apex], si, true, centre));
      }
    } else {
      // Spheres and hemispheres: latitude bands round the vertical, with the equator as one of the edges.
      const bands = STRIPS / 2;
      const low = s.type === "sphere" || s.flat === "up" ? -bands / 2 : 0,
        high = s.type === "sphere" || s.flat === "down" ? bands / 2 : 0;
      const centre = s.type === "sphere" ? at : add(at, v3(0, 0, (s.flat === "down" ? 0.4 : -0.4) * s.r));
      const rings: number[][] = [];
      for (let k = low; k <= high; k++) {
        if (Math.abs(k) === bands / 2) rings.push([point(add(at, v3(0, 0, s.r * Math.sign(k))))]);
        else {
          const lat = (Math.PI * k) / bands;
          rings.push(ring(add(at, v3(0, 0, s.r * Math.sin(lat))), "z", s.r * Math.cos(lat)));
        }
      }
      for (let k = 0; k < rings.length - 1; k++) {
        const lo = rings[k],
          hi = rings[k + 1];
        for (let i = 0; i < STRIPS; i++) {
          const j = (i + 1) % STRIPS;
          if (lo.length === 1) face([lo[0], hi[i], hi[j]], si, true, centre);
          else if (hi.length === 1) face([lo[i], lo[j], hi[0]], si, true, centre);
          else face([lo[i], lo[j], hi[j], hi[i]], si, true, centre);
        }
      }
      if (s.type === "hemisphere") face(s.flat === "down" ? rings[0] : rings[rings.length - 1], si, false, centre);
    }
  });
  const key = (a: number, b: number) => (a < b ? `${a}|${b}` : `${b}|${a}`);
  const edgeMap = new Map<string, Mesh["edges"][number]>();
  faces.forEach((f, fi) =>
    f.ids.forEach((a, k) => {
      const b = f.ids[(k + 1) % f.ids.length];
      const id = key(a, b);
      const e = edgeMap.get(id);
      if (e) e.faces.push(fi);
      else edgeMap.set(id, { a, b, faces: [fi], smooth: false });
    }),
  );
  // An edge between two strips of one curved surface is smooth; a rim (curved meets flat) is sharp.
  for (const e of edgeMap.values()) e.smooth = e.faces.length === 2 && e.faces.every((f) => faces[f].curved);
  return { points, faces: faces.map(({ ids, normal, solid }) => ({ ids, normal, solid })), edges: [...edgeMap.values()], apexes };
}

/** Corners with any that lie on the straight line between their neighbours (or repeat one) left out. */
function straighten(corners: number[][]): number[][] {
  const out = corners.map(([a, b]) => [a, b]);
  for (let changed = true; changed && out.length > 3; ) {
    changed = false;
    for (let i = 0; i < out.length && out.length > 3; i++) {
      const p = out[(i + out.length - 1) % out.length],
        q = out[i],
        r = out[(i + 1) % out.length];
      const turn = (q[0] - p[0]) * (r[1] - q[1]) - (q[1] - p[1]) * (r[0] - q[0]);
      const ahead = (q[0] - p[0]) * (r[0] - q[0]) + (q[1] - p[1]) * (r[1] - q[1]);
      const same = Math.hypot(q[0] - p[0], q[1] - p[1]) < 1e-9;
      if (same || (Math.abs(turn) < 1e-9 && ahead > 0)) {
        out.splice(i, 1);
        changed = true;
        i--;
      }
    }
  }
  return out;
}

function selfCrossing(pts: P[]): boolean {
  const n = pts.length;
  const crosses = (a: P, b: P, c: P, d: P) => {
    const o = (p: P, q: P, r: P) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
    return o(a, b, c) * o(a, b, d) < -1e-12 && o(c, d, a) * o(c, d, b) < -1e-12;
  };
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++) {
      if (j === i + 1 || (i === 0 && j === n - 1)) continue;
      if (crosses(pts[i], pts[(i + 1) % n], pts[j], pts[(j + 1) % n])) return true;
    }
  return false;
}

/** The extent of the solid in squares. */
export function bounds(mesh: Mesh) {
  const xs = mesh.points.map((p) => p.x),
    ys = mesh.points.map((p) => p.y),
    zs = mesh.points.map((p) => p.z);
  return { min: v3(Math.min(...xs), Math.min(...ys), Math.min(...zs)), max: v3(Math.max(...xs), Math.max(...ys), Math.max(...zs)) };
}

/* ---------- Views ---------- */

export type ViewName = "plan" | "front" | "side" | "isometric";
const C30 = Math.cos(Math.PI / 6);
/** Each view: where a point lands (x right, y up, in squares) and the direction towards the viewer. */
export const PROJECTIONS: Record<ViewName, { project: (p: V3) => P; toward: V3 }> = {
  plan: { project: (p) => ({ x: p.x, y: p.y }), toward: v3(0, 0, 1) },
  front: { project: (p) => ({ x: p.x, y: p.z }), toward: v3(0, -1, 0) },
  // From the left: the back is on the left of the view, the front on the right.
  side: { project: (p) => ({ x: 0 - p.y, y: p.z }), toward: v3(-1, 0, 0) },
  // The same isometric drawing as the cube solids: top, front and left side.
  isometric: { project: (p) => ({ x: (p.x - p.y) * C30, y: p.z + (p.x + p.y) / 2 }), toward: unit(v3(-1, -1, 1)) },
};

/** A drawn line: a run of joined points, visible or hidden. */
export type Stroke = { pts: P[]; hidden: boolean };
export type Lines = { strokes: Stroke[]; dots: P[]; min: P; max: P };
const EPS = 1e-7;

/** The lines of one view: visible pieces, and hidden pieces that no visible line covers. */
export function viewLines(mesh: Mesh, view: ViewName): Lines {
  const { project, toward } = PROJECTIONS[view];
  const screen = mesh.points.map(project);
  const depth = mesh.points.map((p) => dot(p, toward));
  const faceFacing = mesh.faces.map((f) => dot(f.normal, toward));
  // Faces seen edge-on cover nothing; the rest are kept with their outline and bounding box.
  const covers = mesh.faces
    .map((f, i) => ({ i, pts: f.ids.map((k) => screen[k]), f }))
    .filter((c) => Math.abs(faceFacing[c.i]) > 1e-9)
    .map((c) => ({
      ...c,
      box: { x1: Math.min(...c.pts.map((p) => p.x)), y1: Math.min(...c.pts.map((p) => p.y)), x2: Math.max(...c.pts.map((p) => p.x)), y2: Math.max(...c.pts.map((p) => p.y)) },
    }));
  const drawn = mesh.edges.filter((e) => {
    if (!e.smooth) return true;
    // A smooth edge is drawn only where the surface turns away: the outline of a round solid.
    const [f1, f2] = e.faces;
    if (f2 === undefined) return true;
    return faceFacing[f1] > 1e-9 !== faceFacing[f2] > 1e-9;
  });
  // The shadows of the drawn edges, for cutting each one where visibility can change: coverage by nearer faces
  // changes only across sharp edges and outlines, never across the hidden smooth edges inside a curved surface.
  const all = drawn.map((e) => ({ a: screen[e.a], b: screen[e.b] })).filter((s) => Math.hypot(s.b.x - s.a.x, s.b.y - s.a.y) > EPS);
  const strokes: { a: P; b: P; hidden: boolean }[] = [];
  const seams = new Set(mesh.faces.map((f) => f.solid)).size > 1 ? [true] : [];
  for (const e of drawn) {
    const A = screen[e.a],
      B = screen[e.b];
    const d = { x: B.x - A.x, y: B.y - A.y };
    const L2 = d.x * d.x + d.y * d.y;
    if (L2 < EPS * EPS) continue;
    const ts = [0, 1];
    for (const s of all) {
      const t = cut(A, d, s.a, s.b);
      for (const v of t) if (v > 1e-6 && v < 1 - 1e-6) ts.push(v);
    }
    ts.sort((p, q) => p - q);
    const own = new Set(e.faces);
    for (let k = 0; k < ts.length - 1; k++) {
      const t0 = ts[k],
        t1 = ts[k + 1];
      if (t1 - t0 < 1e-6) continue;
      const tm = (t0 + t1) / 2;
      const m = { x: A.x + d.x * tm, y: A.y + d.y * tm };
      const dm = depth[e.a] + (depth[e.b] - depth[e.a]) * tm;
      // Where two shapes meet on one flat surface (a roof on a box of the same width), there is no edge.
      const m3 = add(mesh.points[e.a], mul(sub(mesh.points[e.b], mesh.points[e.a]), tm));
      if (seams.length && isSeam(mesh, e, m3)) continue;
      let hidden = false;
      for (const c of covers) {
        if (own.has(c.i)) continue;
        if (m.x < c.box.x1 + 1e-6 || m.x > c.box.x2 - 1e-6 || m.y < c.box.y1 + 1e-6 || m.y > c.box.y2 - 1e-6) continue;
        if (!strictlyInside(m, c.pts)) continue;
        if (faceDepth(mesh, c.f, project, toward, m) > dm + 1e-6) {
          hidden = true;
          break;
        }
      }
      strokes.push({ a: { x: A.x + d.x * t0, y: A.y + d.y * t0 }, b: { x: A.x + d.x * t1, y: A.y + d.y * t1 }, hidden });
    }
  }
  const visible = mergeCollinear(strokes.filter((s) => !s.hidden));
  // A hidden piece under a visible line (a back edge behind a front one) is not drawn twice.
  const hidden = mergeCollinear(strokes.filter((s) => s.hidden)).flatMap((s) => uncovered(s, visible));
  const dots: P[] = [];
  for (const a of mesh.apexes) {
    // A cone seen straight along its axis, apex towards the viewer: a dot at the apex, as the papers draw it.
    if (dot(a.axis, toward) > 1 - 1e-9) {
      const m = screen[a.at];
      const covered = covers.some((c) => strictlyInside(m, c.pts) && faceDepth(mesh, c.f, project, toward, m) > depth[a.at] + 1e-6);
      if (!covered) dots.push(m);
    }
  }
  const xs = screen.map((p) => p.x),
    ys = screen.map((p) => p.y);
  return {
    strokes: [...chain(visible).map((pts) => ({ pts, hidden: false })), ...chain(hidden).map((pts) => ({ pts, hidden: true }))],
    dots,
    min: { x: Math.min(...xs), y: Math.min(...ys) },
    max: { x: Math.max(...xs), y: Math.max(...ys) },
  };
}

/** A point of a face's plane strictly inside the face (seen square on, with a small margin). */
function inFace(mesh: Mesh, f: Mesh["faces"][number], p: V3): boolean {
  const o = mesh.points[f.ids[0]];
  if (Math.abs(dot(sub(p, o), f.normal)) > 1e-6) return false;
  const n = f.normal,
    ax = Math.abs(n.x),
    ay = Math.abs(n.y),
    az = Math.abs(n.z);
  const flat = (q: V3): P => (ax >= ay && ax >= az ? { x: q.y, y: q.z } : ay >= az ? { x: q.x, y: q.z } : { x: q.x, y: q.y });
  return strictlyInside(flat(p), f.ids.map((i) => flat(mesh.points[i])));
}
/**
 * A piece of edge (at m) is a seam when each of its two faces either carries on flat into a face of
 * another shape across the edge, or is hidden inside the solid, pressed against another shape's face.
 */
function isSeam(mesh: Mesh, e: Mesh["edges"][number], m: V3): boolean {
  if (e.faces.length !== 2) return false;
  const along = unit(sub(mesh.points[e.b], mesh.points[e.a]));
  return e.faces.every((fi) => {
    const f = mesh.faces[fi];
    let w = unit(cross(f.normal, along));
    const step = 2e-3;
    if (!inFace(mesh, f, add(m, mul(w, step)))) w = mul(w, -1);
    const into = add(m, mul(w, step)),
      across = add(m, mul(w, -step));
    return mesh.faces.some((g) => {
      if (g.solid === f.solid) return false;
      const same = dot(g.normal, f.normal);
      if (same > 1 - 1e-9) return inFace(mesh, g, across);
      if (same < -1 + 1e-9) return inFace(mesh, g, into);
      return false;
    });
  });
}

/** Where segment c-d crosses (or overlaps) the line A + t·d, as values of t. */
function cut(A: P, d: P, c: P, e: P): number[] {
  const f = { x: e.x - c.x, y: e.y - c.y };
  const den = d.x * f.y - d.y * f.x;
  const ac = { x: c.x - A.x, y: c.y - A.y };
  const L2 = d.x * d.x + d.y * d.y;
  if (Math.abs(den) < 1e-12) {
    // Parallel: if on the same line, the other segment's ends cut this one.
    if (Math.abs(ac.x * d.y - ac.y * d.x) / Math.sqrt(L2) > 1e-7) return [];
    return [c, e].map((p) => ((p.x - A.x) * d.x + (p.y - A.y) * d.y) / L2);
  }
  const t = (ac.x * f.y - ac.y * f.x) / den,
    u = (ac.x * d.y - ac.y * d.x) / den;
  return u >= -1e-9 && u <= 1 + 1e-9 ? [t] : [];
}

/** Inside a polygon and not on (or within a hair of) its outline. */
function strictlyInside(p: P, poly: P[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i],
      b = poly[j];
    if (segmentDistance(p, a, b) < 1e-5) return false;
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}
function segmentDistance(p: P, a: P, b: P) {
  const dx = b.x - a.x,
    dy = b.y - a.y,
    l2 = dx * dx + dy * dy;
  const t = l2 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2)) : 0;
  return Math.hypot(p.x - a.x - dx * t, p.y - a.y - dy * t);
}
/** How near the viewer a face is at a point of the view: its plane met along the line of sight. */
function faceDepth(mesh: Mesh, f: Mesh["faces"][number], project: (p: V3) => P, toward: V3, m: P): number {
  // Points on the face's plane: p = o + s·u + t·v; solve for the one that projects to m.
  const o = mesh.points[f.ids[0]];
  const u = sub(mesh.points[f.ids[1]], o);
  let v = v3(0, 0, 0);
  for (let k = 2; k < f.ids.length; k++) {
    const w = sub(mesh.points[f.ids[k]], o);
    if (length(cross(u, w)) > 1e-9) {
      v = w;
      break;
    }
  }
  const po = project(o),
    pu = project(add(o, u)),
    pv = project(add(o, v));
  const U = { x: pu.x - po.x, y: pu.y - po.y },
    V = { x: pv.x - po.x, y: pv.y - po.y };
  const den = U.x * V.y - U.y * V.x;
  const r = { x: m.x - po.x, y: m.y - po.y };
  const s = (r.x * V.y - r.y * V.x) / den,
    t = (U.x * r.y - U.y * r.x) / den;
  return dot(add(o, add(mul(u, s), mul(v, t))), toward);
}

type Seg = { a: P; b: P };
/** Joins pieces that meet end to end into runs, so a dashed curve keeps one even dash pattern. */
function chain(segs: Seg[]): P[][] {
  const k = (p: P) => `${Math.round(p.x * 1e4)}|${Math.round(p.y * 1e4)}`;
  const at = new Map<string, number[]>();
  segs.forEach((s, i) => {
    for (const p of [s.a, s.b]) at.set(k(p), [...(at.get(k(p)) ?? []), i]);
  });
  const used = new Set<number>();
  const runs: P[][] = [];
  const extend = (run: P[]) => {
    for (;;) {
      const end = run[run.length - 1];
      const next = (at.get(k(end)) ?? []).filter((i) => !used.has(i));
      // Only a simple joint (two pieces meeting) continues the run.
      if (next.length !== 1 || (at.get(k(end)) ?? []).length !== 2) return;
      const s = segs[next[0]];
      used.add(next[0]);
      run.push(k(s.a) === k(end) ? s.b : s.a);
    }
  };
  segs.forEach((s, i) => {
    if (used.has(i)) return;
    used.add(i);
    const run = [s.a, s.b];
    extend(run);
    run.reverse();
    extend(run);
    runs.push(run);
  });
  return runs;
}
/** Joins pieces on one straight line that touch or overlap, so each line is one clean stroke. */
function mergeCollinear(segs: Seg[]): Seg[] {
  const groups = new Map<string, { dir: P; base: P; spans: [number, number][] }>();
  for (const s of segs) {
    let dx = s.b.x - s.a.x,
      dy = s.b.y - s.a.y;
    const L = Math.hypot(dx, dy);
    if (L < 1e-9) continue;
    dx /= L;
    dy /= L;
    if (dx < -1e-9 || (Math.abs(dx) <= 1e-9 && dy < 0)) {
      dx = -dx;
      dy = -dy;
    }
    // The line: its direction and its distance from the origin, rounded so equal lines share a key.
    const off = s.a.x * -dy + s.a.y * dx;
    const k = `${Math.round(dx * 1e5)}|${Math.round(dy * 1e5)}|${Math.round(off * 1e5)}`;
    const g = groups.get(k) ?? { dir: { x: dx, y: dy }, base: { x: -dy * off, y: dx * off }, spans: [] };
    const t1 = s.a.x * dx + s.a.y * dy,
      t2 = s.b.x * dx + s.b.y * dy;
    g.spans.push([Math.min(t1, t2), Math.max(t1, t2)]);
    groups.set(k, g);
  }
  const out: Seg[] = [];
  for (const g of groups.values()) {
    g.spans.sort((p, q) => p[0] - q[0]);
    let cur = g.spans[0];
    const flush = () => out.push({ a: { x: g.base.x + g.dir.x * cur[0], y: g.base.y + g.dir.y * cur[0] }, b: { x: g.base.x + g.dir.x * cur[1], y: g.base.y + g.dir.y * cur[1] } });
    for (const sp of g.spans.slice(1)) {
      if (sp[0] <= cur[1] + 1e-6) cur = [cur[0], Math.max(cur[1], sp[1])];
      else {
        flush();
        cur = sp;
      }
    }
    flush();
  }
  return out;
}
/** The parts of a hidden piece not lying on a visible line. */
function uncovered(s: Seg, visible: Seg[]): Seg[] {
  const d = { x: s.b.x - s.a.x, y: s.b.y - s.a.y };
  const L = Math.hypot(d.x, d.y);
  let free: [number, number][] = [[0, 1]];
  for (const v of visible) {
    const e = { x: v.b.x - v.a.x, y: v.b.y - v.a.y };
    const cr = d.x * e.y - d.y * e.x;
    if (Math.abs(cr) / (L * Math.hypot(e.x, e.y)) > 1e-6) continue;
    if (Math.abs((v.a.x - s.a.x) * d.y - (v.a.y - s.a.y) * d.x) / L > 1e-5) continue;
    const t1 = ((v.a.x - s.a.x) * d.x + (v.a.y - s.a.y) * d.y) / (L * L),
      t2 = ((v.b.x - s.a.x) * d.x + (v.b.y - s.a.y) * d.y) / (L * L);
    const lo = Math.min(t1, t2),
      hi = Math.max(t1, t2);
    free = free.flatMap(([a, b]) => {
      if (hi <= a || lo >= b) return [[a, b] as [number, number]];
      const parts: [number, number][] = [];
      if (lo > a) parts.push([a, lo]);
      if (hi < b) parts.push([hi, b]);
      return parts;
    });
  }
  return free.filter(([a, b]) => (b - a) * L > 0.05).map(([a, b]) => ({ a: { x: s.a.x + d.x * a, y: s.a.y + d.y * a }, b: { x: s.a.x + d.x * b, y: s.a.y + d.y * b } }));
}

const IN = 1e-9;
/** Strictly inside a polygon (not on or next to a side). */
function inPolygon(pts: number[][], x: number, y: number): boolean {
  let hit = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [ax, ay] = pts[i],
      [bx, by] = pts[j];
    const dx = bx - ax,
      dy = by - ay,
      l2 = dx * dx + dy * dy;
    const t = l2 ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l2)) : 0;
    if (Math.hypot(x - ax - t * dx, y - ay - t * dy) < 1e-7) return false;
    if (ay > y !== by > y && x < (dx * (y - ay)) / dy + ax) hit = !hit;
  }
  return hit;
}
/** True when a point is strictly inside a shape (a point on its surface is not). */
export function insideShape(s: Shape, p: V3): boolean {
  const d = sub(p, v3(s.at.x, s.at.y, s.at.z));
  switch (s.type) {
    case "prism": {
      const [a, b, along] = s.axis === "y" ? [d.x, d.z, d.y] : s.axis === "x" ? [d.y, d.z, d.x] : [d.x, d.y, d.z];
      return along > IN && along < s.length - IN && inPolygon(s.section, a, b);
    }
    case "pyramid": {
      const t = d.z / s.apex.z;
      if (t <= IN || t >= 1 - IN) return false;
      return inPolygon(s.base, (d.x - t * s.apex.x) / (1 - t), (d.y - t * s.apex.y) / (1 - t));
    }
    case "cylinder":
    case "cone": {
      const along = dot(d, AXIS[s.axis]),
        radial = length(sub(d, mul(AXIS[s.axis], along)));
      if (along <= IN || along >= s.h - IN) return false;
      return radial < (s.type === "cylinder" ? s.r : s.r * (1 - along / s.h)) - 1e-7;
    }
    case "sphere":
      return length(d) < s.r - 1e-7;
    case "hemisphere":
      return length(d) < s.r - 1e-7 && (s.flat === "down" ? d.z > IN : d.z < -IN);
  }
}
/**
 * The first two shapes (numbered from 0) whose insides overlap, or null. Shapes may touch face to face but not
 * overlap, because lines where two solids pass through each other are not edges of either. Each shape's corners
 * are tried inside the other, then points on a grid of quarter squares (offset off the half-square lines) inside
 * both shapes' common box.
 */
export function overlappingShapes(shapes: Shape[]): [number, number] | null {
  const meshes = shapes.map((s) => buildMesh([s]));
  const boxes = meshes.map(bounds);
  for (let i = 0; i < shapes.length; i++)
    for (let j = i + 1; j < shapes.length; j++) {
      // A corner (a cone's or pyramid's tip too) strictly inside the other shape: catches tips thinner than the grid.
      if (meshes[i].points.some((p) => insideShape(shapes[j], p)) || meshes[j].points.some((p) => insideShape(shapes[i], p))) return [i, j];
      const lo = v3(Math.max(boxes[i].min.x, boxes[j].min.x), Math.max(boxes[i].min.y, boxes[j].min.y), Math.max(boxes[i].min.z, boxes[j].min.z));
      const hi = v3(Math.min(boxes[i].max.x, boxes[j].max.x), Math.min(boxes[i].max.y, boxes[j].max.y), Math.min(boxes[i].max.z, boxes[j].max.z));
      if (lo.x >= hi.x || lo.y >= hi.y || lo.z >= hi.z) continue;
      const step = 0.25,
        start = (v: number) => Math.floor(v / step) * step + step / 2;
      for (let x = start(lo.x); x < hi.x; x += step)
        for (let y = start(lo.y); y < hi.y; y += step)
          for (let z = start(lo.z); z < hi.z; z += step) {
            const p = v3(x, y, z);
            if (insideShape(shapes[i], p) && insideShape(shapes[j], p)) return [i, j];
          }
    }
  return null;
}
