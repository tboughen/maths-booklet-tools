/**
 * Nets of 3D shapes (Hanley GM2.07: "recognise and use nets of 3D shapes, e.g. when the net is
 * folded where does the dot end up"). Nets of cubes, cuboids, triangular prisms, square-based
 * pyramids and tetrahedra on centimetre squares (or dots, or plain paper), up to six nets side by
 * side with captions ("A", "B", …) for "which of these are nets of a cube?".
 *
 * Each face is a polygon in grid squares from the panel's top-left corner. A face can carry a label
 * (a letter or word), a mark (dot, cross or shading) and be hidden. A hidden face prints nothing for
 * pupils (so "complete the net" or "draw the net" leaves empty squares) and prints in the answer
 * colour on the answers copy; hidden labels, marks, corner letters and edge lengths work the same way.
 * Both copies keep one size: the panel is sized from every face, shown or hidden.
 *
 * Nothing is folded or worked out unless the teacher asks. Nets made of rectangles are folded only
 * to write teacher notes (which faces end up opposite, which corners meet) and, on request, to mark
 * the face opposite a chosen face as a hidden answer.
 */
import { z } from "zod";
import { sha256Hex, toBase64Url } from "../../envelope-core/src/index";
import { aboutShape } from "../../envelope-core/src/about";
import { boldLines, LINE_WEIGHTS } from "../../envelope-core/src/house-style";
import { textWidth } from "../../function-machine-core/src/maths-text";
import { foldBox, type FoldResult } from "./fold";
import { presetFaces, squaresNet, type Preset, type Pt } from "./presets";

export { foldBox } from "./fold";
export * from "./presets";

/** The renderer version every new nets envelope carries. */
export const RENDERER_VERSION = "nets-1" as const;

export const MAX_NETS = 6;
export const MAX_FACES = 12;
export const MAX_POINTS = 8;
export const MAX_LABELS = 24;
export const MAX_TEXT = 24;
export const MAX_SQUARES = 30;
export const ANSWER_COLOUR = "#b0125b";
/** 11 pt, the house body size. */
export const FONT = (11 * 25.4) / 72;
const FAMILY = "STIX Two Text,STIX Two Math,serif";
/** Exam parity (packages/graph-core/src/graphStyle.ts): a 1 cm grid on its own is 1 pt grey; shapes are 1.5 pt. */
const GRID_STROKE = 25.4 / 72;
const GRID_COLOUR = "#a9abaa";
const NET_STROKE = (1.5 * 25.4) / 72;
const SHADE = "#c6c6c6";

export const SOLIDS = ["cube", "cuboid", "triangular-prism", "square-pyramid", "tetrahedron", "other"] as const;
export type Solid = (typeof SOLIDS)[number];
export const SOLID_NAMES: Record<Solid, string> = {
  cube: "cube",
  cuboid: "cuboid",
  "triangular-prism": "triangular prism",
  "square-pyramid": "square-based pyramid",
  tetrahedron: "tetrahedron",
  other: "3D shape",
};
export const MARKS = ["none", "dot", "cross", "shade"] as const;
export const GRIDS = ["squares", "dots", "none"] as const;

const plain = z
  .string()
  .max(MAX_TEXT)
  .refine((s) => ![...s].some((c) => c.charCodeAt(0) < 32 || c === "<" || c === ">"), "Use ordinary text without markup.");
/** "omit" (Leave out) keeps the object but prints it on neither copy. */
const show = z.enum(["show", "hidden", "omit"]);
export const textSchema = z.object({ text: plain, show }).strict();
const coord = z.number().min(0).max(60);
export const pointSchema = z.tuple([coord, coord]);
const id = z.string().regex(/^[a-z][a-z0-9-]{0,23}$/);
export const faceSchema = z
  .object({
    id,
    /** Corners in order, in grid squares from the panel's top-left corner. */
    points: z.array(pointSchema).min(3).max(MAX_POINTS),
    /** "hidden": nothing for pupils, drawn in the answer colour on the answers copy. */
    show,
    /** A letter or word in the middle of the face; empty text prints nothing. */
    label: textSchema,
    mark: z.object({ kind: z.enum(MARKS), show }).strict(),
  })
  .strict();
export const vertexSchema = z.object({ at: pointSchema, label: textSchema }).strict();
export const edgeSchema = z.object({ from: pointSchema, to: pointSchema, label: textSchema }).strict();
export const netSchema = z
  .object({
    id,
    /** What the net folds into: checked for cubes and cuboids, named in notes for the others. */
    solid: z.enum(SOLIDS),
    /** Printed under the net, such as "A" for "which of these are nets of a cube?". */
    caption: textSchema,
    /** The panel in grid squares; 0 fits the net with a square to spare on the right and below. */
    size: z.object({ across: z.number().int().min(0).max(40), down: z.number().int().min(0).max(40) }).strict(),
    /** Faces; none leaves an empty grid to draw a net on. */
    faces: z.array(faceSchema).max(MAX_FACES),
    /** Letters at corners, printed just outside the net. */
    vertices: z.array(vertexSchema).max(MAX_LABELS),
    /** Lengths or letters beside edges, printed outside the net. */
    edges: z.array(edgeSchema).max(MAX_LABELS),
  })
  .strict();
export const documentSchema = z
  .object({
    nets: z.array(netSchema).min(1).max(MAX_NETS),
    /** Squared paper, dot paper or plain paper. */
    grid: z.enum(GRIDS),
    /** Printed size of one grid square in centimetres. */
    unitCm: z.union([z.literal(0.5), z.literal(1)]),
    /** Bold lines (U111). Normal lines are the default and are never saved. */
    lines: z
      .enum(LINE_WEIGHTS)
      .transform((v) => (v === "bold" ? v : undefined))
      .optional(),
  })
  .strict();
export const envelopeSchema = z
  .object({
    kind: z.literal("nets"),
    schemaVersion: z.literal(1),
    rendererVersion: z.literal(RENDERER_VERSION),
    document: documentSchema,
    ...aboutShape,
  })
  .strict();
export type Envelope = z.infer<typeof envelopeSchema>;
export type NetsDocument = Envelope["document"];
export type Net = NetsDocument["nets"][number];
export type Face = Net["faces"][number];
export type Text = Face["label"];
export type Mark = Face["mark"]["kind"];
export type View = "pupil" | "answer";

export const text = (t = "", visibility: Text["show"] = "show"): Text => ({ text: t, show: visibility });
const r3 = (v: number) => Math.round(v * 1000) / 1000;
const samePt = (a: Pt, b: Pt) => Math.abs(a[0] - b[0]) < 1e-6 && Math.abs(a[1] - b[1]) < 1e-6;

/* ---------- Validation ---------- */

function tidy(t: Text, what: string) {
  t.text = t.text.trim().replace(/\s+/g, " ");
  if (!t.text && t.show === "hidden") throw Error(`A hidden ${what} needs its answer. Enter it, then hide it.`);
}
export function validate(input: unknown): Envelope {
  const parsed = envelopeSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue?.path ?? [];
    if (path.includes("text")) throw Error(`Use at most ${MAX_TEXT} characters in each label, without markup.`);
    if (path.includes("points")) throw Error(`Each face has 3 to ${MAX_POINTS} corners, each 0 to 60 squares from the top-left corner.`);
    if (path.includes("faces")) throw Error(`Use at most ${MAX_FACES} faces in a net.`);
    if (path.includes("nets") && path.length <= 3) throw Error(`Use 1 to ${MAX_NETS} nets.`);
    throw Error("This is not a supported nets file (version 1 is supported).");
  }
  const e = parsed.data;
  const nets = new Set<string>();
  for (const net of e.document.nets) {
    if (nets.has(net.id)) throw Error(`The net ID ${net.id} appears twice.`);
    nets.add(net.id);
    const faces = new Set<string>();
    for (const f of net.faces) {
      if (faces.has(f.id)) throw Error(`The face ID ${f.id} appears twice in one net.`);
      faces.add(f.id);
      f.points = f.points.map(([x, y]) => [r3(x), r3(y)]);
      if (Math.abs(area(f.points)) < 1e-6) throw Error("A face needs some area: its corners all lie on one line.");
      tidy(f.label, "label");
      if (f.mark.kind === "none") f.mark.show = "show";
    }
    tidy(net.caption, "caption");
    net.vertices.forEach((v) => tidy(v.label, "letter"));
    net.edges.forEach((v) => tidy(v.label, "length"));
    net.vertices = net.vertices.filter((v) => v.label.text);
    net.edges = net.edges.filter((v) => v.label.text);
    const { across, down } = extent(net);
    if (net.size.across && net.size.across < across) throw Error(`The net is ${across} squares across, wider than its panel of ${net.size.across}.`);
    if (net.size.down && net.size.down < down) throw Error(`The net is ${down} squares down, taller than its panel of ${net.size.down}.`);
  }
  return e;
}
export const canonical = (e: Envelope) => JSON.stringify(validate(e));
export function parseFile(raw: string) {
  if (raw.length > 60000) throw Error("This editable file is too large.");
  return validate(JSON.parse(raw));
}
export async function hash(e: Envelope) {
  return sha256Hex(canonical(e));
}
export const hasHidden = (e: Envelope) =>
  e.document.nets.some(
    (n) =>
      n.caption.show === "hidden" ||
      n.faces.some((f) => f.show === "hidden" || f.label.show === "hidden" || f.mark.show === "hidden") ||
      n.vertices.some((v) => v.label.show === "hidden") ||
      n.edges.some((v) => v.label.show === "hidden"),
  );

function area(pts: readonly Pt[]) {
  let a = 0;
  pts.forEach((p, i) => {
    const q = pts[(i + 1) % pts.length];
    a += p[0] * q[1] - q[0] * p[1];
  });
  return a / 2;
}
/** The centre of a face (its centroid). */
export function centre(pts: readonly Pt[]): Pt {
  const a = area(pts);
  if (Math.abs(a) < 1e-9) return [pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length];
  let cx = 0,
    cy = 0;
  pts.forEach((p, i) => {
    const q = pts[(i + 1) % pts.length],
      k = p[0] * q[1] - q[0] * p[1];
    cx += (p[0] + q[0]) * k;
    cy += (p[1] + q[1]) * k;
  });
  return [cx / (6 * a), cy / (6 * a)];
}
/** Squares the net reaches across and down, with one to spare: the panel size when `size` is 0. */
export function extent(net: Net) {
  const pts = [...net.faces.flatMap((f) => f.points), ...net.vertices.map((v) => v.at), ...net.edges.flatMap((v) => [v.from, v.to])];
  if (!pts.length) return { across: 0, down: 0 };
  return { across: Math.ceil(Math.max(...pts.map((p) => p[0])) - 1e-6) + 1, down: Math.ceil(Math.max(...pts.map((p) => p[1])) - 1e-6) + 1 };
}
export function panelSize(net: Net) {
  const fit = extent(net);
  return { across: net.size.across || Math.max(fit.across, 2), down: net.size.down || Math.max(fit.down, 2) };
}

/* ---------- Building ---------- */

const clone = (e: Envelope) => structuredClone(e);
/** Copies only the fields a change gives, so an omitted field keeps its value. */
function merge<T extends object>(target: T, change: Partial<T>) {
  for (const [k, v] of Object.entries(change)) if (v !== undefined) (target as Record<string, unknown>)[k] = v;
  // Emptying a label removes it, so it can no longer be a hidden answer.
  const t = target as { text?: unknown; show?: unknown };
  if (typeof t.text === "string" && !t.text.trim() && "show" in t) t.show = "show";
  return target;
}
export const newFace = (faceId: string, points: Pt[]): Face => ({ id: faceId, points, show: "show", label: text(), mark: { kind: "none", show: "show" } });
export function facesOf(points: Pt[][]): Face[] {
  return points.map((p, i) => newFace(`f${i + 1}`, p));
}
export const solidOf = (p: Preset): Solid => p.type;
export function newNet(netId: string, preset: Preset, caption = ""): Net {
  return { id: netId, solid: solidOf(preset), caption: text(caption), size: { across: 0, down: 0 }, faces: facesOf(presetFaces(preset)), vertices: [], edges: [] };
}
/** One cube net (the 1-4-1 net with both end squares level) on 1 cm squares, each face 2 squares across. */
export function create(preset: Preset = { type: "cube", net: 1, side: 2 }): Envelope {
  return validate({
    kind: "nets",
    schemaVersion: 1,
    rendererVersion: RENDERER_VERSION,
    document: { nets: [newNet("n1", preset)], grid: preset.type === "tetrahedron" ? "none" : "squares", unitCm: 1 },
  });
}
export function netOf(d: NetsDocument, netId: string): Net {
  const n = d.nets.find((x) => x.id === netId);
  if (!n) throw Error(`There is no net ${netId}.`);
  return n;
}
export function faceOf(net: Net, faceId: string): Face {
  const f = net.faces.find((x) => x.id === faceId);
  if (!f) throw Error(`There is no face ${faceId} in this net.`);
  return f;
}
function freshId(taken: string[], prefix: string) {
  let i = 1;
  while (taken.includes(`${prefix}${i}`)) i++;
  return `${prefix}${i}`;
}
/** Replaces a net's faces with a preset's, keeping its caption; corner letters and lengths are cleared. */
export function makeNet(e: Envelope, netId: string, preset: Preset): Envelope {
  const n = clone(e),
    net = netOf(n.document, netId);
  const fresh = newNet(net.id, preset, "");
  Object.assign(net, { solid: fresh.solid, faces: fresh.faces, vertices: [], edges: [], size: { across: 0, down: 0 } });
  return validate(n);
}
/** Adds a net beside the others. */
export function addNet(e: Envelope, preset: Preset, caption = ""): Envelope {
  const n = clone(e),
    d = n.document;
  if (d.nets.length >= MAX_NETS) throw Error(`Use at most ${MAX_NETS} nets.`);
  d.nets.push(newNet(freshId(d.nets.map((x) => x.id), "n"), preset, caption));
  return validate(n);
}
export function removeNet(e: Envelope, netId: string): Envelope {
  const n = clone(e),
    d = n.document;
  if (d.nets.length <= 1) throw Error("A diagram needs at least one net.");
  netOf(d, netId);
  d.nets = d.nets.filter((x) => x.id !== netId);
  return validate(n);
}
export function setNet(e: Envelope, netId: string, change: { solid?: Solid; caption?: Partial<Text>; size?: Net["size"] }): Envelope {
  const n = clone(e),
    net = netOf(n.document, netId);
  if (change.solid) net.solid = change.solid;
  if (change.caption) merge(net.caption, change.caption);
  if (change.size) net.size = change.size;
  return validate(n);
}
/** Adds a square face `side` squares across with its top-left corner at (x, y), to build or complete a net. */
export function addSquare(e: Envelope, netId: string, x: number, y: number, side = 1): Envelope {
  const n = clone(e),
    net = netOf(n.document, netId);
  if (net.faces.length >= MAX_FACES) throw Error(`A net can have at most ${MAX_FACES} faces.`);
  const pts = squaresNet([[0, 0]], side)[0].map(([px, py]): Pt => [px + x, py + y]);
  // Any overlap with a face, sampled across the new square, is refused.
  const samples: Pt[] = [];
  for (let i = 1; i < 8; i++) for (let j = 1; j < 8; j++) samples.push([x + (side * i) / 8, y + (side * j) / 8]);
  if (net.faces.some((f) => samples.some((q) => inside(q, f.points)) || inside(centre(f.points), pts))) throw Error("There is already a face there.");
  net.faces.push(newFace(freshId(net.faces.map((f) => f.id), "f"), pts));
  return validate(n);
}
export function removeFace(e: Envelope, netId: string, faceId: string): Envelope {
  const n = clone(e),
    net = netOf(n.document, netId);
  faceOf(net, faceId);
  net.faces = net.faces.filter((f) => f.id !== faceId);
  return validate(n);
}
/** Changes a face: hidden or shown, its label and its mark. Hiding an empty label is refused. */
export function setFace(e: Envelope, netId: string, faceId: string, change: { show?: Text["show"]; label?: Partial<Text>; mark?: { kind?: Mark; show?: Text["show"] } }): Envelope {
  const n = clone(e),
    f = faceOf(netOf(n.document, netId), faceId);
  if (change.show) f.show = change.show;
  if (change.label) merge(f.label, change.label);
  if (change.mark) merge(f.mark, change.mark);
  return validate(n);
}
/** Puts a letter at a corner (empty text removes it). */
export function setVertex(e: Envelope, netId: string, at: Pt, label: Partial<Text>): Envelope {
  const n = clone(e),
    net = netOf(n.document, netId);
  const v = net.vertices.find((x) => samePt(x.at, at));
  if (v) merge(v.label, label);
  else {
    if (net.vertices.length >= MAX_LABELS) throw Error(`A net can have at most ${MAX_LABELS} corner letters.`);
    net.vertices.push({ at, label: merge(text(), label) });
  }
  return validate(n);
}
/** Puts a length or letter beside an edge (empty text removes it). */
export function setEdge(e: Envelope, netId: string, from: Pt, to: Pt, label: Partial<Text>): Envelope {
  const n = clone(e),
    net = netOf(n.document, netId);
  const v = net.edges.find((x) => (samePt(x.from, from) && samePt(x.to, to)) || (samePt(x.from, to) && samePt(x.to, from)));
  if (v) merge(v.label, label);
  else {
    if (net.edges.length >= MAX_LABELS) throw Error(`A net can have at most ${MAX_LABELS} edge labels.`);
    net.edges.push({ from, to, label: merge(text(), label) });
  }
  return validate(n);
}
/** Moves a whole net by whole squares inside its panel. */
export function moveNet(e: Envelope, netId: string, dx: number, dy: number): Envelope {
  const n = clone(e),
    net = netOf(n.document, netId);
  const shift = (p: Pt): Pt => [r3(p[0] + dx), r3(p[1] + dy)];
  const pts = [...net.faces.flatMap((f) => f.points), ...net.vertices.map((v) => v.at), ...net.edges.flatMap((v) => [v.from, v.to])];
  if (pts.some((p) => p[0] + dx < -1e-6 || p[1] + dy < -1e-6)) throw Error("The net is already at the edge of its panel.");
  for (const f of net.faces) f.points = f.points.map(shift);
  for (const v of net.vertices) v.at = shift(v.at);
  for (const v of net.edges) [v.from, v.to] = [shift(v.from), shift(v.to)];
  return validate(n);
}
export function setSettings(e: Envelope, s: { grid?: NetsDocument["grid"]; unitCm?: NetsDocument["unitCm"]; lines?: "normal" | "bold" }): Envelope {
  const n = clone(e),
    d = n.document;
  if (s.grid) d.grid = s.grid;
  if (s.unitCm) d.unitCm = s.unitCm;
  if (s.lines === "bold") d.lines = "bold";
  else if (s.lines === "normal") delete d.lines;
  return validate(n);
}
function inside(p: Pt, poly: readonly Pt[]) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i],
      [xj, yj] = poly[j];
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}
/** The face under a point of the panel, for clicks in the editor. */
export const faceAt = (net: Net, p: Pt) => net.faces.find((f) => inside(p, f.points)) ?? null;

/* ---------- Folding (explicit) ---------- */

export function foldNet(net: Net): FoldResult | null {
  return foldBox(net.faces.map((f) => f.points));
}
/**
 * Marks the face opposite `faceId` when the net is folded, as a hidden answer: "shade the face
 * opposite the shaded face", "where does the dot end up". Only for cube and cuboid nets that fold.
 */
export function markOpposite(e: Envelope, netId: string, faceId: string, kind?: Exclude<Mark, "none">): Envelope {
  const n = clone(e),
    net = netOf(n.document, netId),
    f = faceOf(net, faceId);
  const folded = foldNet(net);
  if (!folded) throw Error("Only nets of cubes and cuboids (all faces rectangles) can be folded to find the opposite face.");
  if (!folded.ok) throw Error(`This net does not fold into a box: ${folded.reason}.`);
  const mark = kind ?? (f.mark.kind === "none" ? "dot" : f.mark.kind);
  const other = net.faces[folded.opposite[net.faces.indexOf(f)]];
  other.mark = { kind: mark, show: "hidden" };
  return validate(n);
}

/* ---------- Teacher notes ---------- */

const MARK_NAMES: Record<Mark, string> = { none: "", dot: "the face with the dot", cross: "the face with the cross", shade: "the shaded face" };
function faceName(net: Net, i: number) {
  const f = net.faces[i];
  if (f.label.text) return f.label.text;
  if (f.mark.kind !== "none" && net.faces.filter((g) => g.mark.kind === f.mark.kind).length === 1) return MARK_NAMES[f.mark.kind];
  return null;
}
const list = (xs: string[]) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}`);
const FACE_COUNTS: Partial<Record<Solid, number>> = { "triangular-prism": 5, "square-pyramid": 5, tetrahedron: 4 };

/** Teacher notes: whether each cube or cuboid net folds, which named faces end up opposite and which corner letters meet. Never printed. */
export function warnings(e: Envelope): string[] {
  const d = e.document,
    out: string[] = [];
  d.nets.forEach((net, k) => {
    const where = net.caption.text ? `Net ${net.caption.text}` : d.nets.length > 1 ? `Net ${k + 1}` : "The net";
    if (!net.faces.length) return;
    const count = FACE_COUNTS[net.solid];
    if (count && net.faces.length !== count) out.push(`${where} has ${net.faces.length} faces; a ${SOLID_NAMES[net.solid]} has ${count}.`);
    if (net.solid !== "cube" && net.solid !== "cuboid") return;
    const folded = foldNet(net);
    if (!folded) {
      out.push(`${where} is marked as a ${net.solid} net but has faces that are not rectangles, so it cannot be checked.`);
      return;
    }
    if (!folded.ok) {
      out.push(`${where} does not fold into a ${net.solid}: ${folded.reason}.`);
      return;
    }
    if (folded.solid !== net.solid) out.push(`${where} folds into a ${folded.solid}, not a ${net.solid}.`);
    const facts: string[] = [];
    folded.opposite.forEach((j, i) => {
      if (j < i) return;
      const a = faceName(net, i),
        b = faceName(net, j);
      if (a || b) facts.push(`${a ?? "an unlabelled face"} is opposite ${b ?? "an unlabelled face"}`);
    });
    const groups = new Map<string, string[]>();
    for (const v of net.vertices) {
      const at = folded.where(v.at);
      if (at) groups.set(at, [...(groups.get(at) ?? []), v.label.text]);
    }
    for (const g of groups.values()) if (g.length > 1) facts.push(`${list(g)} meet`);
    if (facts.length) out.push(`When folded, ${where.charAt(0).toLowerCase() + where.slice(1)}: ${facts.join("; ")}.`);
  });
  return out;
}

/* ---------- Views ---------- */

/** Objects the answers copy prints in the answer colour. */
const REVEALED = new WeakSet<object>();
/** The answers copy prints hidden faces and labels; with `mark` they print in the answer colour. */
export function forView(e: Envelope, view: View, mark = false): Envelope {
  if (view === "pupil") return e;
  const n = clone(e);
  const open = (o: { show: Text["show"] }, when = true) => {
    // A left-out object prints on neither copy.
    if (o.show === "omit") return;
    if (o.show === "hidden" && when && mark) REVEALED.add(o);
    o.show = "show";
  };
  for (const net of n.document.nets) {
    open(net.caption);
    for (const f of net.faces) {
      // Everything on a hidden face is part of its answer.
      if (f.show === "hidden" && mark) [f.label, f.mark].forEach((o) => REVEALED.add(o));
      open(f);
      open(f.label);
      open(f.mark, f.mark.kind !== "none");
    }
    net.vertices.forEach((v) => open(v.label));
    net.edges.forEach((v) => open(v.label));
  }
  return n;
}
const ink = (o: object) => (REVEALED.has(o) ? ANSWER_COLOUR : "black");

/* ---------- Layout ---------- */

const GAP = 8;
const CAPTION_GAP = 2;
const LABEL_ROOM = FONT * 1.6;
export const MAX_ROW_MM = 260;

export type Placed = { net: Net; x: number; y: number; width: number; height: number; across: number; down: number; captionY: number | null };
/** Nets side by side, each on its own panel with room around it for corner letters and lengths. */
export function layout(e: Envelope) {
  const d = e.document,
    u = d.unitCm * 10,
    issues: string[] = [];
  const panels = d.nets.map((net) => {
    const s = panelSize(net);
    // Room around the grid for the widest corner letter or length printed outside the net.
    const outsideText = [...net.vertices, ...net.edges].map((v) => textWidth(v.label.text) + 3);
    const pad = outsideText.length ? Math.max(LABEL_ROOM, ...outsideText) : 0;
    const caption = net.caption.text ? FONT * 1.2 + CAPTION_GAP : 0;
    const grid = s.across * u + 2 * pad;
    // A caption wider than its net widens the panel; the net stays centred above it.
    const width = Math.max(grid, net.caption.text ? textWidth(net.caption.text) + 2 : 0);
    return { net, across: s.across, down: s.down, pad: pad + (width - grid) / 2, padY: pad, width, height: s.down * u + 2 * pad + caption };
  });
  const placed: Placed[] = [];
  let x = 0,
    y = 0,
    rowHeight = 0,
    width = 0,
    rowStart = 0;
  // Captions in a row line up under its tallest net.
  const endRow = () => placed.slice(rowStart).forEach((q) => q.captionY !== null && (q.captionY = y + rowHeight - FONT * 0.3));
  for (const p of panels) {
    if (x > 0 && x + p.width > MAX_ROW_MM) {
      endRow();
      rowStart = placed.length;
      x = 0;
      y += rowHeight + GAP;
      rowHeight = 0;
    }
    placed.push({
      net: p.net,
      x: x + p.pad,
      y: y + p.padY,
      width: p.across * u,
      height: p.down * u,
      across: p.across,
      down: p.down,
      captionY: p.net.caption.text ? y + p.height - FONT * 0.3 : null,
    });
    x += p.width + GAP;
    width = Math.max(width, x - GAP);
    rowHeight = Math.max(rowHeight, p.height);
  }
  endRow();
  const height = y + rowHeight;
  if (width > MAX_ROW_MM) issues.push(`A net is ${Math.round(width)} mm wide, over the ${MAX_ROW_MM} mm print width. Use smaller faces or 0.5 cm squares.`);
  return { width: Math.max(width, 1), height: Math.max(height, 1), unit: u, panels: placed, issues };
}
export const exportIssue = (e: Envelope) => layout(e).issues[0] ?? null;

/* ---------- SVG ---------- */

const num = (v: number) => String(Math.round(v * 1000) / 1000);
export const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
/** A white patch behind text on a grid, so grid lines never run through it (never over shading). */
const patch = (t: string, cx: number, cy: number) => {
  const w = textWidth(t) + 0.8,
    h = FONT * 0.95;
  return `<rect x="${num(cx - w / 2)}" y="${num(cy - h / 2)}" width="${num(w)}" height="${num(h)}" fill="white"/>`;
};
const label = (t: string, cx: number, cy: number, fill: string, backed = false) =>
  (backed ? patch(t, cx, cy) : "") +
  `<text x="${num(cx - textWidth(t) / 2)}" y="${num(cy + FONT * 0.33)}" font-family="${FAMILY}" font-size="${num(FONT)}" fill="${fill}" xml:space="preserve">${esc(t)}</text>`;
const unitVec = (x: number, y: number): Pt => {
  const l = Math.hypot(x, y);
  return l < 1e-9 ? [0, -1] : [x / l, y / l];
};
/** Where a label beside a point sits: `gap` mm out along `dir`, allowing for the text's own size. */
/** Half the width and height of a label's white patch. */
const halfBox = (t: string): Pt => [(textWidth(t) + 0.8) / 2, (FONT * 0.95) / 2];
/** The centre of a label `gap` mm beyond `p` along `dir`, its whole patch clear of the point. */
function outside(p: Pt, dir: Pt, t: string, gap: number): Pt {
  const [hw, hh] = halfBox(t);
  const reach = gap + hw * Math.abs(dir[0]) + hh * Math.abs(dir[1]);
  return [p[0] + dir[0] * reach, p[1] + dir[1] * reach];
}
function segmentsCross(a: Pt, b: Pt, c: Pt, d: Pt) {
  const o = (p: Pt, q: Pt, r: Pt) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
  return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0;
}
/** True when a label's patch centred at `c` would cover part of a face or its outline (faces in mm). */
function clashes(c: Pt, t: string, faces: Pt[][]) {
  const [hw, hh] = halfBox(t);
  const box: Pt[] = [
    [c[0] - hw, c[1] - hh],
    [c[0] + hw, c[1] - hh],
    [c[0] + hw, c[1] + hh],
    [c[0] - hw, c[1] + hh],
  ];
  return faces.some(
    (f) =>
      [...box, c].some((q) => inside(q, f)) ||
      f.some((q) => q[0] > box[0][0] && q[0] < box[1][0] && q[1] > box[0][1] && q[1] < box[2][1]) ||
      f.some((q, i) => box.some((b, k) => segmentsCross(q, f[(i + 1) % f.length], b, box[(k + 1) % 4]))),
  );
}
/**
 * Where a label beside a point goes: along `dir` if its patch is clear of every face there, else the
 * nearest clear direction (turning either way) or, failing that, further out along `dir`.
 */
function clearSpot(p: Pt, dir: Pt, t: string, gap: number, faces: Pt[][], turn = true): Pt {
  const base = Math.atan2(dir[1], dir[0]);
  const turns = turn ? [0, ...Array.from({ length: 12 }, (_, i) => (Math.ceil((i + 1) / 2) * (i % 2 ? -1 : 1) * Math.PI) / 12)] : [0];
  for (const extra of [0, 0.6, 1.2, 2])
    for (const a of turns) {
      const c = outside(p, [Math.cos(base + a), Math.sin(base + a)], t, gap + extra);
      if (!clashes(c, t, faces)) return c;
    }
  return outside(p, dir, t, gap);
}

export function renderSvg(e: Envelope): string {
  const d = e.document,
    g = layout(e),
    u = g.unit,
    out: string[] = [`<rect width="${num(g.width)}" height="${num(g.height)}" fill="white"/>`];
  const said: string[] = [];
  for (const p of g.panels) {
    const X = (gx: number) => p.x + gx * u,
      Y = (gy: number) => p.y + gy * u,
      P = (q: Pt) => `${num(X(q[0]))} ${num(Y(q[1]))}`;
    if (d.grid === "squares") {
      const lines: string[] = [];
      for (let i = 0; i <= p.across; i++) lines.push(`M${num(X(i))} ${num(Y(0))}V${num(Y(p.down))}`);
      for (let j = 0; j <= p.down; j++) lines.push(`M${num(X(0))} ${num(Y(j))}H${num(X(p.across))}`);
      out.push(`<path d="${lines.join("")}" fill="none" stroke="${GRID_COLOUR}" stroke-width="${num(GRID_STROKE)}"/>`);
    } else if (d.grid === "dots") {
      const dots: string[] = [];
      for (let i = 0; i <= p.across; i++) for (let j = 0; j <= p.down; j++) dots.push(`<circle cx="${num(X(i))}" cy="${num(Y(j))}" r="0.35"/>`);
      out.push(`<g fill="#6b6b6b">${dots.join("")}</g>`);
    }
    const faces = p.net.faces.filter((f) => f.show === "show");
    // Answer-coloured faces first, so an edge shared with a printed face stays black.
    const order = [...faces.filter((f) => REVEALED.has(f)), ...faces.filter((f) => !REVEALED.has(f))];
    for (const f of order) {
      const shaded = f.mark.kind === "shade" && f.mark.show === "show";
      const fill = shaded ? (REVEALED.has(f.mark) ? ANSWER_COLOUR : SHADE) : "none";
      const opacity = shaded && REVEALED.has(f.mark) ? ' fill-opacity="0.3"' : "";
      out.push(`<path d="M${f.points.map(P).join("L")}Z" fill="${fill}"${opacity} stroke="${ink(f)}" stroke-width="${num(NET_STROKE)}" stroke-linejoin="round"/>`);
    }
    for (const f of faces) {
      const c = centre(f.points),
        cx = X(c[0]),
        cy = Y(c[1]);
      const hasLabel = f.label.show === "show" && !!f.label.text,
        mark = f.mark.show === "show" ? f.mark.kind : "none";
      // Placed from what the face holds on either copy, so the answers copy lies exactly over the pupil copy.
      const both = !!f.label.text && (f.mark.kind === "dot" || f.mark.kind === "cross");
      const ys = f.points.map((q) => Y(q[1])),
        short = Math.max(...ys) - Math.min(...ys) < FONT * 2.6;
      const labelAt: Pt = both ? (short ? [cx - textWidth(f.label.text) / 2 - 1.2, cy] : [cx, cy - FONT * 0.2]) : [cx, cy];
      const markAt: Pt = both ? (short ? [cx + 1.6, cy] : [cx, cy + FONT * 0.95]) : [cx, cy];
      const backed = d.grid !== "none" && f.mark.kind !== "shade";
      if (hasLabel) out.push(label(f.label.text, labelAt[0], labelAt[1], ink(f.label), backed));
      if (mark === "dot") out.push(`<circle cx="${num(markAt[0])}" cy="${num(markAt[1])}" r="1.2" fill="${ink(f.mark)}"/>`);
      if (mark === "cross") {
        const [mx, my] = markAt;
        out.push(
          `<path d="M${num(mx - 1.3)} ${num(my - 1.3)}L${num(mx + 1.3)} ${num(my + 1.3)}M${num(mx - 1.3)} ${num(my + 1.3)}L${num(mx + 1.3)} ${num(my - 1.3)}" stroke="${ink(f.mark)}" stroke-width="0.4" stroke-linecap="round"/>`,
        );
      }
      said.push([f.label.show === "show" ? f.label.text : "", mark === "none" ? "" : mark].filter(Boolean).join(" ") || "face");
    }
    // Corner letters sit outside the net, away from every face at that corner.
    const all = p.net.faces;
    // Every face, shown or hidden, so both copies place labels alike.
    const mm = all.map((f) => f.points.map((q): Pt => [X(q[0]), Y(q[1])]));
    for (const v of p.net.vertices) {
      if (v.label.show !== "show") continue;
      let dx = 0,
        dy = 0;
      for (const f of all)
        if (f.points.some((q) => samePt(q, v.at))) {
          const c = centre(f.points);
          [dx, dy] = [dx + v.at[0] - c[0], dy + v.at[1] - c[1]];
        }
      const at = clearSpot([X(v.at[0]), Y(v.at[1])], unitVec(dx, dy), v.label.text, 0.6, mm);
      out.push(label(v.label.text, at[0], at[1], ink(v.label), d.grid !== "none"));
    }
    // Edge labels sit beside the edge, on the side away from the face it belongs to.
    for (const v of p.net.edges) {
      if (v.label.show !== "show") continue;
      const m: Pt = [(v.from[0] + v.to[0]) / 2, (v.from[1] + v.to[1]) / 2];
      const owner = all.find((f) => f.points.some((q) => samePt(q, v.from)) && f.points.some((q) => samePt(q, v.to)));
      let n = unitVec(-(v.to[1] - v.from[1]), v.to[0] - v.from[0]);
      if (owner) {
        const c = centre(owner.points);
        if (n[0] * (m[0] - c[0]) + n[1] * (m[1] - c[1]) < 0) n = [-n[0], -n[1]];
      }
      const at = clearSpot([X(m[0]), Y(m[1])], n, v.label.text, 1, mm, false);
      out.push(label(v.label.text, at[0], at[1], ink(v.label), d.grid !== "none"));
    }
    if (p.captionY !== null && p.net.caption.show === "show") out.push(label(p.net.caption.text, p.x + p.width / 2, p.captionY - FONT * 0.33, ink(p.net.caption)));
  }
  // Never names the solids: a hidden caption may be the answer.
  const name = `${d.nets.length > 1 ? `${d.nets.length} nets` : "Net"} of 3D shapes${said.length ? `: ${said.length} faces drawn` : ""}`;
  return boldLines(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${num(g.width)}mm" height="${num(g.height)}mm" viewBox="0 0 ${num(g.width)} ${num(g.height)}" role="img" aria-label="${esc(name)}">${out.join("")}</svg>`,
    d.lines,
  );
}

/* ---------- Editor links ---------- */

export const MAX_LINK_LENGTH = 16_000;
export const LINK_PREFIX = "#nets=";
export const linkHash = (e: Envelope) => LINK_PREFIX + toBase64Url(canonical(e));
export function editorLink(e: Envelope, base: string): string | null {
  const url = new URL(base);
  url.pathname = url.pathname.replace(/(\/tools(\/[^/]*)?)?\/?$/, "/") + "tools/nets";
  url.search = "";
  url.hash = linkHash(e);
  return url.href.length <= MAX_LINK_LENGTH ? url.href : null;
}
export function decodeLinkHash(hashText: string): Envelope {
  if (!hashText.startsWith(LINK_PREFIX) || !/^[A-Za-z0-9_-]+$/.test(hashText.slice(LINK_PREFIX.length)) || hashText.length > MAX_LINK_LENGTH)
    throw Error("This is not a supported nets link. Open an editable file instead.");
  try {
    const binary = atob(hashText.slice(LINK_PREFIX.length).replaceAll("-", "+").replaceAll("_", "/"));
    return parseFile(new TextDecoder("utf-8", { fatal: true }).decode(Uint8Array.from(binary, (c) => c.charCodeAt(0))));
  } catch {
    throw Error("This nets link could not be read. Open an editable file instead.");
  }
}
