import { aboutShape } from "../../envelope-core/src/about";
import { z } from "zod";
import { glyphAdvance } from "../../ratio-table-core/src/font-metrics";
import { defineEnvelope } from "../../envelope-core/src/index";
import { buildMesh, bounds as meshBounds, lengthLabelSchema, MAX_EXTENT, MAX_LENGTH_LABELS, MAX_SHAPES, PROJECTIONS, shapeSchema, viewLines, type Lines, type Mesh, type Shape } from "./shapes";
export * from "./shapes";

/** The drawing rules version this core writes and reads: the one source for schemas, guides and the connector (M19). */
export const RENDERER_VERSION = "elevations-1" as const;

/**
 * Plans and elevations of solids made from centimetre cubes (Hanley GM8.08-09).
 *
 * The solid is a height map: `heights[row][column]` is the number of cubes stacked on that square,
 * row 0 at the FRONT and column 0 at the LEFT. The isometric drawing shows the top, the front and
 * the left-hand side (the side elevation is the view from the left, as the arrows show).
 *
 * Each panel is one view with a state: "drawn" prints it on both copies, "blank" prints an empty
 * grid (or isometric dot paper) for pupils to draw on, and "answer" prints the empty grid for
 * pupils and the drawing on the answer copy. Plans and elevations print on centimetre squares at
 * `unitCm` per cube edge; the isometric drawing uses 1 cm isometric paper. Nothing is shrunk.
 */
export const MAX_SIDE = 6;
export const MAX_HEIGHT = 6;
export const MAX_PANELS = 6;
export const VIEWS = ["isometric", "plan", "front", "side"] as const;
export type ViewKind = (typeof VIEWS)[number];

const plain = (max: number) =>
  z
    .string()
    .max(max)
    .refine((s) => ![...s].some((c) => c.charCodeAt(0) < 32 || c === "<" || c === ">"), "Use ordinary text without markup.");
export const labelSchema = z.object({ text: plain(40), show: z.enum(["show", "hidden"]) }).strict();
export const panelSchema = z
  .object({
    view: z.enum(VIEWS),
    state: z.enum(["drawn", "blank", "answer"]),
    /** Printed under the panel, for example "Plan" or "Front elevation". */
    label: labelSchema,
    /** Size of an empty grid in squares (or isometric dots across and up); 0 fits the solid with a square to spare. */
    squares: z.object({ across: z.number().int().min(0).max(20), up: z.number().int().min(0).max(20) }).strict(),
  })
  .strict();
export const heightsSchema = z.array(z.array(z.number().int().min(0).max(MAX_HEIGHT)).min(1).max(MAX_SIDE)).min(1).max(MAX_SIDE);
export const documentSchema = z
  .object({
    /** A solid of cubes: cubes on each square. Give this or shapes, not both. */
    heights: heightsSchema.optional(),
    /** A solid built from prisms, pyramids, cylinders, cones, spheres and hemispheres (see shapes.ts). */
    shapes: z.array(shapeSchema).min(1).max(MAX_SHAPES).optional(),
    /** Lengths printed beside edges of a shapes solid's 3D drawing, such as "5 cm". */
    lengths: z.array(lengthLabelSchema).max(MAX_LENGTH_LABELS).optional(),
    /** Hidden edges of a shapes solid: left out (as Edexcel elevations) or dashed. Only "dashed" is saved. */
    hiddenLines: z
      .enum(["none", "dashed"])
      .transform((v) => (v === "dashed" ? v : undefined))
      .optional(),
    panels: z.array(panelSchema).min(1).max(MAX_PANELS),
    /** Printed length of one cube edge on the plan and elevation grids, in centimetres. */
    unitCm: z.union([z.literal(0.5), z.literal(1), z.literal(2)]),
    /** Front and Side arrows on the isometric drawing. */
    arrows: z.boolean(),
    /** Dots behind the isometric drawing. */
    isoDots: z.boolean(),
    /** Widest printed row of panels in centimetres before the next panel moves down. */
    maxWidthCm: z.number().int().min(8).max(27),
  })
  .strict();
export const envelopeSchema = z
  .object({ tool: z.literal("elevations"), schemaVersion: z.literal(1), rendererVersion: z.literal(RENDERER_VERSION), document: documentSchema, ...aboutShape })
  .strict();
export type Envelope = z.infer<typeof envelopeSchema>;
export type ElevationDocument = Envelope["document"];
export type Panel = z.infer<typeof panelSchema>;
export type View = "pupil" | "answer";

export const label = (text = "", show: "show" | "hidden" = "show") => ({ text, show });
export const DEFAULT_LABELS: Record<ViewKind, string> = { isometric: "", plan: "Plan", front: "Front elevation", side: "Side elevation" };
export const panel = (view: ViewKind, state: Panel["state"] = "drawn", text = DEFAULT_LABELS[view]): Panel => ({
  view,
  state,
  label: label(text),
  squares: { across: 0, up: 0 },
});

export function validate(input: unknown): Envelope {
  const parsed = envelopeSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue?.path ?? [];
    if (path.includes("heights")) throw Error(`Use a grid of up to ${MAX_SIDE} by ${MAX_SIDE} squares with 0 to ${MAX_HEIGHT} cubes on each.`);
    if (path.includes("panels")) throw Error(`Use 1 to ${MAX_PANELS} panels: isometric, plan, front or side, each drawn, blank or answer.`);
    const sp = path.indexOf("shapes"),
      lp = path.indexOf("lengths");
    if (sp >= 0 && typeof path[sp + 1] === "number") {
      const names: Record<string, string> = { r: "radius", h: "size along its axis", length: "length", at: "position", section: "cross-section", base: "base", apex: "apex" };
      throw Error(`Shape ${(path[sp + 1] as number) + 1} ${names[String(path[sp + 2])] ?? "settings"}: ${issue.message}`);
    }
    if (sp >= 0) throw Error(`Use 1 to ${MAX_SHAPES} shapes.`);
    if (lp >= 0) throw Error(typeof path[lp + 1] === "number" ? `Length ${(path[lp + 1] as number) + 1}: ${issue.message}` : `Use at most ${MAX_LENGTH_LABELS} lengths.`);
    if (path.includes("unitCm")) throw Error("Use a cube edge of 0.5, 1 or 2 cm on the grids.");
    throw Error(path.length ? `${path.join(".")}: ${issue.message}` : "This is not a supported plans and elevations file (version 1 is supported).");
  }
  const e = parsed.data,
    d = e.document,
    h = d.heights;
  if (!h === !d.shapes) throw Error(h ? "Give the solid as cubes (heights) or as shapes, not both." : "The solid needs cubes (heights) or shapes.");
  if (h) {
    if (h.some((row) => row.length !== h[0].length)) throw Error("Every row of heights needs the same number of squares.");
    if (!h.flat().some((v) => v > 0)) throw Error("The solid needs at least one cube.");
    if (d.lengths?.length) throw Error("Lengths go on a solid made of shapes; a cube solid is counted in squares.");
  } else {
    const mesh = meshOf(d);
    const b = meshBounds(mesh);
    if (b.min.x < -1e-6 || b.min.y < -1e-6 || b.min.z < -1e-6 || b.max.x > MAX_EXTENT + 1e-6 || b.max.y > MAX_EXTENT + 1e-6 || b.max.z > MAX_EXTENT + 1e-6)
      throw Error(`The solid must fit in a space of ${MAX_EXTENT} by ${MAX_EXTENT} by ${MAX_EXTENT} squares from 0. Move or shrink a shape so nothing is below 0 or above ${MAX_EXTENT}.`);
  }
  return e;
}
/** Shared envelope helpers: sorted canonical JSON, as envelope-core asks of new families. */
const envelope = defineEnvelope<Envelope>({ kind: "elevations", validate, canonical: "sorted" });
export const canonical = envelope.canonical;
export function parseFile(text: string) {
  if (text.length > 30_000) throw Error("This editable file is too large.");
  return validate(JSON.parse(text));
}
/** The answer copy draws every "answer" panel; the pupil copy leaves its grid empty. */
export function forView(e: Envelope, view: View): Envelope {
  if (view === "pupil") return e;
  const n = structuredClone(e);
  for (const p of n.document.panels) {
    if (p.state === "answer") p.state = "drawn";
    p.label.show = "show";
  }
  for (const l of n.document.lengths ?? []) l.show = "show";
  return n;
}
export const hasHidden = (e: Envelope) =>
  e.document.panels.some((p) => p.state === "answer" || (p.label.show === "hidden" && p.label.text.trim())) ||
  (e.document.lengths ?? []).some((l) => l.show === "hidden" && l.text.trim());
export const cubeCount = (d: ElevationDocument) => (d.heights ?? []).flat().reduce((a, b) => a + b, 0);
/** "a prism and a cone": the shapes a solid is made of, for alt text and summaries. */
/** One description of the solid: "Solid of 7 cubes" or "Solid made of a prism and a cone". */
export function solidDescription(d: ElevationDocument): string {
  if (!d.shapes) return `Solid of ${cubeCount(d)} cubes`;
  const names = d.shapes.map((s) => `${/^[aeiou]/.test(s.type) ? "an" : "a"} ${s.type}`);
  return `Solid made of ${names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`}`;
}

/* ---------- Shapes solids: meshes and their lines, kept for repeated drawing ---------- */

const meshes = new Map<string, Mesh>();
const lineCache = new Map<string, Lines>();
/** The polyhedron of a shapes solid, built once per distinct list of shapes. */
export function meshOf(d: ElevationDocument): Mesh {
  const k = JSON.stringify(d.shapes);
  let m = meshes.get(k);
  if (!m) {
    m = buildMesh(d.shapes as Shape[]);
    if (meshes.size > 24) meshes.clear();
    meshes.set(k, m);
  }
  return m;
}
/** The lines of one view of a shapes solid (hidden pieces included, marked). */
export function shapeLines(d: ElevationDocument, view: ViewKind): Lines {
  const k = `${view}|${JSON.stringify(d.shapes)}`;
  let l = lineCache.get(k);
  if (!l) {
    l = viewLines(meshOf(d), view);
    if (lineCache.size > 96) lineCache.clear();
    lineCache.set(k, l);
  }
  return l;
}

export function blank(): Envelope {
  return {
    tool: "elevations",
    schemaVersion: 1,
    rendererVersion: RENDERER_VERSION,
    document: { heights: [[1]], panels: [panel("isometric")], unitCm: 1, arrows: true, isoDots: false, maxWidthCm: 26 },
  };
}
/** The starting solid: an L of five cubes with a tower; plan, front and side are hidden answers. */
export function create(): Envelope {
  const e = blank();
  e.document.heights = [
    [2, 1, 1],
    [3, 0, 0],
  ];
  e.document.panels = [panel("isometric"), panel("plan", "answer"), panel("front", "answer"), panel("side", "answer")];
  return validate(e);
}

/* ---------- Views of the solid ---------- */

type Seg = { x1: number; y1: number; x2: number; y2: number };
/** A view as a grid of filled squares (x right, y up) with the edges to draw. */
export type Flat = { across: number; up: number; filled: boolean[][]; edges: Seg[] };

/**
 * Plans and elevations by the exam convention: the outline, plus a line wherever two neighbouring
 * visible squares are at different depths (a step in height on the plan, a step back on an elevation).
 */
export function flatView(d: ElevationDocument, view: Exclude<ViewKind, "isometric">): Flat {
  const H = d.heights!,
    rows = H.length,
    cols = H[0].length,
    top = Math.max(...H.flat());
  // depth[a][b]: a key for the visible surface at column a, row b of the view (up is b), or null.
  let across: number, up: number;
  let key: (a: number, b: number) => number | null;
  if (view === "plan") {
    across = cols;
    up = rows;
    // Looking down: column a, row b counted from the front (b = 0 is the front, at the bottom).
    key = (a, b) => (H[b][a] > 0 ? H[b][a] : null);
  } else if (view === "front") {
    across = cols;
    up = top;
    key = (a, b) => {
      for (let r = 0; r < rows; r++) if (H[r][a] > b) return r;
      return null;
    };
  } else {
    // From the left: the back is on the left of the view, the front on the right.
    across = rows;
    up = top;
    key = (a, b) => {
      const r = rows - 1 - a;
      for (let c = 0; c < cols; c++) if (H[r][c] > b) return c;
      return null;
    };
  }
  const filled = Array.from({ length: across }, (_, a) => Array.from({ length: up }, (_, b) => key(a, b) !== null));
  const edges: Seg[] = [];
  const k = (a: number, b: number) => (a < 0 || b < 0 || a >= across || b >= up ? null : key(a, b));
  for (let a = 0; a <= across; a++)
    for (let b = 0; b < up; b++) {
      const l = k(a - 1, b),
        r = k(a, b);
      if (l !== r) edges.push({ x1: a, y1: b, x2: a, y2: b + 1 });
    }
  for (let b = 0; b <= up; b++)
    for (let a = 0; a < across; a++) {
      const lo = k(a, b - 1),
        hi = k(a, b);
      if (lo !== hi) edges.push({ x1: a, y1: b, x2: a + 1, y2: b });
    }
  return { across, up, filled, edges: merge(edges) };
}
/** Joins collinear touching unit edges so the SVG has long clean strokes. */
function merge(edges: Seg[]): Seg[] {
  const out: Seg[] = [];
  const horizontal = edges.filter((e) => e.y1 === e.y2).sort((a, b) => a.y1 - b.y1 || a.x1 - b.x1);
  const vertical = edges.filter((e) => e.x1 === e.x2).sort((a, b) => a.x1 - b.x1 || a.y1 - b.y1);
  for (const e of horizontal) {
    const last = out[out.length - 1];
    if (last && last.y1 === last.y2 && last.y1 === e.y1 && last.x2 === e.x1) last.x2 = e.x2;
    else out.push({ ...e });
  }
  for (const e of vertical) {
    const last = out[out.length - 1];
    if (last && last.x1 === last.x2 && last.x1 === e.x1 && last.y2 === e.y1) last.y2 = e.y2;
    else out.push({ ...e });
  }
  return out;
}

/* ---------- Isometric projection ---------- */

const C = Math.cos(Math.PI / 6);
/** Screen position in centimetres (x right, y up) of the solid's point (x, row depth d, z). */
export const iso = (x: number, d: number, z: number) => ({ u: (x - d) * C, v: z + (x + d) / 2 });
type Face = { pts: { u: number; v: number }[]; key: number };
/** Visible cube faces in painting order (far first). */
export function isoFaces(d: ElevationDocument): Face[] {
  const H = d.heights!,
    rows = H.length,
    cols = H[0].length;
  const has = (x: number, r: number, z: number) => x >= 0 && r >= 0 && x < cols && r < rows && z >= 0 && H[r][x] > z;
  const faces: Face[] = [];
  for (let r = 0; r < rows; r++)
    for (let x = 0; x < cols; x++)
      for (let z = 0; z < H[r][x]; z++) {
        const key = x + r - z;
        const q = (a: number, b: number, c: number) => iso(a, b, c);
        if (!has(x, r, z + 1)) faces.push({ key: key - 0.5, pts: [q(x, r, z + 1), q(x + 1, r, z + 1), q(x + 1, r + 1, z + 1), q(x, r + 1, z + 1)] });
        if (!has(x, r - 1, z)) faces.push({ key: key - 0.4, pts: [q(x, r, z), q(x + 1, r, z), q(x + 1, r, z + 1), q(x, r, z + 1)] });
        if (!has(x - 1, r, z)) faces.push({ key: key - 0.4, pts: [q(x, r, z), q(x, r + 1, z), q(x, r + 1, z + 1), q(x, r, z + 1)] });
      }
  return faces.sort((a, b) => b.key - a.key);
}

/* ---------- Layout and SVG ---------- */

export const FONT = (11 * 25.4) / 72;
const GAP = 10;
const LABEL_H = FONT + 3;
const n = (v: number) => String(Math.round(v * 1000) / 1000);
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const textWidth = (t: string) => [...t].reduce((s, c) => s + glyphAdvance(c), 0) * FONT;
const text = (t: string, x: number, y: number, anchor = "middle") =>
  `<text x="${n(x)}" y="${n(y)}" text-anchor="${anchor}" font-family="STIX Two Text,STIX Two Math,serif" font-size="${n(FONT)}" fill="black">${esc(t)}</text>`;

type Built = { width: number; height: number; svg: string };

/** The strokes of a shapes solid's view as SVG: visible lines, hidden lines dashed when asked, cone apex dots. */
function shapeStrokes(d: ElevationDocument, l: Lines, X: (a: number) => number, Y: (b: number) => number, width: number): string {
  const path = (pts: { x: number; y: number }[]) => `M${pts.map((q) => `${n(X(q.x))} ${n(Y(q.y))}`).join("L")}`;
  const out: string[] = [];
  const shown = l.strokes.filter((st) => !st.hidden);
  if (shown.length) out.push(`<path d="${shown.map((st) => path(st.pts)).join("")}" fill="none" stroke="black" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`);
  const hidden = d.hiddenLines === "dashed" ? l.strokes.filter((st) => st.hidden) : [];
  if (hidden.length) out.push(`<path d="${hidden.map((st) => path(st.pts)).join("")}" fill="none" stroke="black" stroke-width="${n(width * 0.8)}" stroke-dasharray="1.5 1" stroke-linejoin="round"/>`);
  for (const q of l.dots) out.push(`<circle cx="${n(X(q.x))}" cy="${n(Y(q.y))}" r="0.7" fill="black"/>`);
  return out.join("");
}
/** A view's extent in whole squares, so the drawing sits on grid lines. */
export function viewSpan(d: ElevationDocument, view: Exclude<ViewKind, "isometric">) {
  if (!d.shapes) {
    const f = flatView(d, view);
    return { x0: 0, y0: 0, across: f.across, up: f.up };
  }
  const l = shapeLines(d, view);
  const x0 = Math.floor(l.min.x + 1e-9),
    y0 = Math.floor(l.min.y + 1e-9);
  return { x0, y0, across: Math.ceil(l.max.x - 1e-9) - x0, up: Math.ceil(l.max.y - 1e-9) - y0 };
}

function gridPanel(d: ElevationDocument, p: Panel): Built {
  if (d.shapes) return gridShapesPanel(d, p);
  const f = flatView(d, p.view as Exclude<ViewKind, "isometric">);
  const u = d.unitCm * 10;
  const across = p.squares.across || f.across + 2,
    up = p.squares.up || f.up + 2;
  const W = across * u,
    H = up * u;
  const out: string[] = [];
  const lines: string[] = [];
  for (let i = 0; i <= across; i++) lines.push(`M${n(i * u)} 0V${n(H)}`);
  for (let j = 0; j <= up; j++) lines.push(`M0 ${n(j * u)}H${n(W)}`);
  out.push(`<path d="${lines.join("")}" fill="none" stroke="#9a9a9a" stroke-width="0.2"/>`);
  if (p.state === "drawn") {
    // Centred with whole squares around it, so the drawing sits on grid lines.
    const ox = Math.floor((across - f.across) / 2),
      oy = Math.floor((up - f.up) / 2);
    const X = (a: number) => (ox + a) * u,
      Y = (b: number) => H - (oy + b) * u;
    out.push(
      `<path d="${f.edges.map((e) => `M${n(X(e.x1))} ${n(Y(e.y1))}L${n(X(e.x2))} ${n(Y(e.y2))}`).join("")}" fill="none" stroke="black" stroke-width="0.5" stroke-linecap="square"/>`,
    );
  }
  return { width: W, height: H, svg: out.join("") };
}

function gridShapesPanel(d: ElevationDocument, p: Panel): Built {
  const view = p.view as Exclude<ViewKind, "isometric">;
  const span = viewSpan(d, view);
  const u = d.unitCm * 10;
  const across = p.squares.across || span.across + 2,
    up = p.squares.up || span.up + 2;
  const W = across * u,
    H = up * u;
  const lines: string[] = [];
  for (let i = 0; i <= across; i++) lines.push(`M${n(i * u)} 0V${n(H)}`);
  for (let j = 0; j <= up; j++) lines.push(`M0 ${n(j * u)}H${n(W)}`);
  const out = [`<path d="${lines.join("")}" fill="none" stroke="#9a9a9a" stroke-width="0.2"/>`];
  if (p.state === "drawn") {
    const ox = Math.floor((across - span.across) / 2) - span.x0,
      oy = Math.floor((up - span.up) / 2) - span.y0;
    out.push(shapeStrokes(d, shapeLines(d, view), (a) => (ox + a) * u, (b) => H - (oy + b) * u, 0.5));
  }
  return { width: W, height: H, svg: out.join("") };
}

function isoPanel(d: ElevationDocument, p: Panel): Built {
  // An answer panel is laid out exactly as its drawing on the answers copy (same box, same dot
  // paper), with the solid and its arrows left out, so both copies match.
  const ghost = p.state === "answer";
  if (ghost) p = { ...p, state: "drawn" };
  const faces = d.shapes ? [] : isoFaces(d);
  const lines = d.shapes ? shapeLines(d, "isometric") : null;
  const s = 10; // 1 cm isometric paper
  const pts = lines ? [{ u: lines.min.x, v: lines.min.y }, { u: lines.max.x, v: lines.max.y }] : faces.flatMap((f) => f.pts);
  let minU = Math.min(...pts.map((q) => q.u)),
    maxU = Math.max(...pts.map((q) => q.u)),
    minV = Math.min(...pts.map((q) => q.v)),
    maxV = Math.max(...pts.map((q) => q.v));
  // across/up size the panel in isometric squares; each 0 means "fit the solid", as on grid panels.
  if (p.squares.across) maxU = Math.max(maxU, minU + p.squares.across * C);
  if (p.squares.up) maxV = Math.max(maxV, minV + p.squares.up);
  const arrows = d.arrows && p.state === "drawn";
  const pad = arrows ? 2.2 : 0.6;
  minU -= pad;
  maxU += pad;
  minV -= pad;
  maxV += 0.6;
  const W = (maxU - minU) * s,
    Hh = (maxV - minV) * s;
  const X = (u: number) => (u - minU) * s,
    Y = (v: number) => (maxV - v) * s;
  const out: string[] = [];
  if (d.isoDots) {
    const dots: string[] = [];
    for (let i = Math.floor(minU / C) - 1; i <= Math.ceil(maxU / C) + 1; i++)
      for (let j = Math.floor(minV * 2) - 1; j <= Math.ceil(maxV * 2) + 1; j++) {
        if ((i + j) % 2 !== 0) continue;
        const u = i * C,
          v = j / 2;
        if (u < minU + 0.2 || u > maxU - 0.2 || v < minV + 0.2 || v > maxV - 0.2) continue;
        dots.push(`<circle cx="${n(X(u))}" cy="${n(Y(v))}" r="0.45"/>`);
      }
    out.push(`<g fill="#6b6b6b">${dots.join("")}</g>`);
  }
  if (p.state === "drawn") {
    for (const f of ghost ? [] : faces)
      out.push(`<path d="M${f.pts.map((q) => `${n(X(q.u))} ${n(Y(q.v))}`).join("L")}Z" fill="white" stroke="black" stroke-width="0.35" stroke-linejoin="round"/>`);
    if (lines && !ghost) {
      out.push(shapeStrokes(d, lines, X, Y, 0.35));
      out.push(lengthLabels(d, X, Y));
    }
    if (arrows) {
      // Front arrow points at the middle of the front face; side arrow at the middle of the left face.
      let front: { u: number; v: number }, side: { u: number; v: number };
      if (d.shapes) {
        const b = meshBounds(meshOf(d));
        const z = b.min.z + Math.min(0.5, (b.max.z - b.min.z) / 2);
        // With lengths on the drawing, the arrows move three quarters along, clear of a length in the middle of an edge.
        const k = (d.lengths ?? []).some((l) => l.show === "show" && l.text.trim()) ? 0.75 : 0.5;
        front = iso(b.min.x + (b.max.x - b.min.x) * k, b.min.y, z);
        side = iso(b.min.x, b.min.y + (b.max.y - b.min.y) * k, z);
      } else {
        const H = d.heights!;
        front = iso(H[0].length / 2, 0, 0.5);
        side = iso(0, H.length / 2, 0.5);
      }
      const arrow = (q: { u: number; v: number }, du: number, dv: number, word: string) => {
        const tip = { x: X(q.u) + du * 1.5, y: Y(q.v) + dv * 1.5 },
          tail = { x: tip.x + du * 9, y: tip.y + dv * 9 };
        const back = { x: tip.x + du * 2.2, y: tip.y + dv * 2.2 },
          side1 = { x: back.x - dv * 1, y: back.y + du * 1 },
          side2 = { x: back.x + dv * 1, y: back.y - du * 1 };
        if (!ghost) {
          out.push(`<path d="M${n(tail.x)} ${n(tail.y)}L${n(back.x)} ${n(back.y)}" stroke="black" stroke-width="0.3"/>`);
          out.push(`<path d="M${n(tip.x)} ${n(tip.y)}L${n(side1.x)} ${n(side1.y)}L${n(side2.x)} ${n(side2.y)}Z" fill="black"/>`);
        }
        return { tail, word };
      };
      const a1 = arrow(front, Math.cos(Math.PI / 6) * 0.6, 0.8, "Front");
      const a2 = arrow(side, -0.6, 0.8, "Side");
      const extra: string[] = [];
      if (!ghost) for (const a of [a1, a2]) extra.push(text(a.word, a.tail.x, a.tail.y + FONT * 1.05));
      out.push(...extra);
      const lowest = Math.max(a1.tail.y, a2.tail.y) + FONT * 1.3;
      const left = Math.min(0, a2.tail.x - textWidth("Side") / 2 - 1),
        right = Math.max(W, a1.tail.x + textWidth("Front") / 2 + 1);
      return { width: right - left, height: Math.max(Hh, lowest), svg: `<g transform="translate(${n(-left)} 0)">${out.join("")}</g>` };
    }
  }
  return { width: W, height: Hh, svg: out.join("") };
}

/** Lengths beside edges of a shapes solid's 3D drawing: on the side of the edge away from the solid where there is
 * one (an outline edge), otherwise pushed out from the middle of the drawing (an edge between two faces). */
function lengthLabels(d: ElevationDocument, X: (u: number) => number, Y: (v: number) => number): string {
  const ls = (d.lengths ?? []).filter((l) => l.show === "show" && l.text.trim());
  if (!ls.length) return "";
  const proj = PROJECTIONS.isometric.project;
  const mesh = meshOf(d);
  const b = meshBounds(mesh);
  const mid = proj({ x: (b.min.x + b.max.x) / 2, y: (b.min.y + b.max.y) / 2, z: (b.min.z + b.max.z) / 2 });
  // The solid's shadow in the drawing: every face, in drawing millimetres.
  const shadow = mesh.faces.map((f) => f.ids.map((i) => proj(mesh.points[i])).map((q) => ({ x: X(q.x), y: Y(q.y) })));
  const inside = (q: { x: number; y: number }) =>
    shadow.some((poly) => {
      let hit = false;
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++)
        if (poly[i].y > q.y !== poly[j].y > q.y && q.x < ((poly[j].x - poly[i].x) * (q.y - poly[i].y)) / (poly[j].y - poly[i].y) + poly[i].x) hit = !hit;
      return hit;
    });
  return ls
    .map((l) => {
      const a = proj(l.a),
        c = proj(l.b);
      const m = { x: (X(a.x) + X(c.x)) / 2, y: (Y(a.y) + Y(c.y)) / 2 };
      let nx = -(Y(c.y) - Y(a.y)),
        ny = X(c.x) - X(a.x);
      const len = Math.hypot(nx, ny) || 1;
      nx /= len;
      ny /= len;
      const probe = 1.5;
      const plus = inside({ x: m.x + nx * probe, y: m.y + ny * probe }),
        minus = inside({ x: m.x - nx * probe, y: m.y - ny * probe });
      // Outside the solid when one side is clear; otherwise away from the middle of the drawing.
      if (plus && !minus) {
        nx = -nx;
        ny = -ny;
      } else if (plus === minus && nx * (m.x - X(mid.x)) + ny * (m.y - Y(mid.y)) < 0) {
        nx = -nx;
        ny = -ny;
      }
      const t = l.text.trim(),
        w = textWidth(t);
      const reach = (w / 2) * Math.abs(nx) + FONT * 0.45 * Math.abs(ny) + 1.5;
      return text(t, m.x + nx * reach, m.y + ny * reach + FONT * 0.34);
    })
    .join("");
}

/** Panels placed left to right, wrapping to a new row at maxWidthCm, each with its label underneath.
 * Pass the saved envelope and the copy to draw; an answer panel keeps one size on both copies. */
export function layout(saved: Envelope, view: View = "pupil") {
  const e = forView(saved, view),
    d = e.document,
    issues: string[] = [],
    notes: string[] = [];
  const built = d.panels.map((p) => ({ p, b: p.view === "isometric" ? isoPanel(d, p) : gridPanel(d, p) }));
  const max = d.maxWidthCm * 10;
  const placed: { x: number; y: number; p: Panel; b: Built }[] = [];
  let x = 0,
    y = 0,
    rowH = 0,
    width = 0;
  for (const { p, b } of built) {
    if (x > 0 && x + b.width > max) {
      x = 0;
      y += rowH + GAP;
      rowH = 0;
    }
    placed.push({ x, y, p, b });
    x += b.width + GAP;
    width = Math.max(width, x - GAP);
    rowH = Math.max(rowH, b.height + (p.label.text.trim() ? LABEL_H : 0));
    if (b.width > max) issues.push(`A ${p.view} panel is ${n(b.width / 10)} cm wide, wider than ${d.maxWidthCm} cm. Use fewer squares or a smaller cube edge.`);
  }
  const height = y + rowH;
  const M = 1.5;
  if (height > 300) issues.push("The panels are taller than 30 cm. Use fewer panels or a smaller cube edge.");
  // Notes describe the saved question, so both copies give the same notes.
  const sd = saved.document;
  if (sd.panels.every((p) => p.state === "drawn") && sd.panels.length > 1) notes.push("Every view is drawn, so pupils have nothing to draw. Make a view blank or an answer for a question.");
  for (const p of sd.panels)
    if (p.view !== "isometric" && p.state !== "drawn" && p.squares.across) {
      const f = viewSpan(d, p.view);
      if (p.squares.across < f.across || p.squares.up < f.up) notes.push(`The ${p.view} grid is smaller than the ${p.view} view (${f.across} by ${f.up} squares).`);
    }
  return { width: Math.ceil((width + 2 * M) * 10) / 10, height: Math.ceil((height + 2 * M) * 10) / 10, margin: M, placed, issues, notes };
}
export const exportIssue = (e: Envelope, view: View = "pupil") => layout(e, view).issues.join(" ") || null;
export const warnings = (e: Envelope, view: View = "pupil") => {
  const g = layout(e, view);
  return [...g.issues, ...g.notes];
};

export function renderSvg(saved: Envelope, view: View = "pupil"): string {
  const e = forView(saved, view),
    g = layout(saved, view),
    out: string[] = [`<rect width="${n(g.width)}" height="${n(g.height)}" fill="white"/>`];
  for (const { x, y, p, b } of g.placed) {
    out.push(`<g transform="translate(${n(x + g.margin)} ${n(y + g.margin)})">${b.svg}</g>`);
    if (p.label.text.trim() && p.label.show === "show") out.push(text(p.label.text.trim(), x + g.margin + b.width / 2, y + g.margin + b.height + FONT + 1));
  }
  const views = e.document.panels.map((p) => `${p.view}${p.state === "drawn" ? "" : p.view === "isometric" ? " (space to sketch)" : " (blank grid)"}`).join(", ");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${n(g.width)}mm" height="${n(g.height)}mm" viewBox="0 0 ${n(g.width)} ${n(g.height)}" role="img" aria-label="${esc(`${solidDescription(e.document)}: ${views}`)}">${out.join("")}</svg>`;
}

/* ---------- Hashes and links ---------- */

export const hash = envelope.contentHash;
export const MAX_LINK_LENGTH = 16_000;
export const LINK_PREFIX = "#elevations=";
export const linkHash = (e: Envelope): string => LINK_PREFIX + envelope.encodeLink(e);
/** The website editor link, or null when the drawing is too large for a link. */
export function editorLink(e: Envelope, base: string): string | null {
  const url = new URL(base);
  url.pathname = url.pathname.replace(/(\/tools(\/[^/]*)?)?\/?$/, "/") + "tools/elevations";
  url.search = "";
  url.hash = linkHash(e);
  return url.href.length <= MAX_LINK_LENGTH ? url.href : null;
}
export function decodeLinkHash(hashText: string): Envelope {
  if (!/^#elevations=[A-Za-z0-9_-]+$/.test(hashText) || hashText.length > MAX_LINK_LENGTH)
    throw Error("This is not a supported plans and elevations link. Open an editable file instead.");
  try {
    return envelope.decodeLink(hashText.slice(LINK_PREFIX.length), MAX_LINK_LENGTH);
  } catch {
    throw Error("This plans and elevations link could not be read. Open an editable file instead.");
  }
}
