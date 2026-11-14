import { z } from "zod";
import { glyphAdvance } from "../../ratio-table-core/src/font-metrics";

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
export const documentSchema = z
  .object({
    heights: z.array(z.array(z.number().int().min(0).max(MAX_HEIGHT)).min(1).max(MAX_SIDE)).min(1).max(MAX_SIDE),
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
  .object({ tool: z.literal("elevations"), schemaVersion: z.literal(1), rendererVersion: z.literal("elevations-1"), document: documentSchema })
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
    if (path.includes("unitCm")) throw Error("Use a cube edge of 0.5, 1 or 2 cm on the grids.");
    throw Error(path.length ? `${path.join(".")}: ${issue.message}` : "This is not a supported plans and elevations file (version 1 is supported).");
  }
  const e = parsed.data,
    h = e.document.heights;
  if (h.some((row) => row.length !== h[0].length)) throw Error("Every row of heights needs the same number of squares.");
  if (!h.flat().some((v) => v > 0)) throw Error("The solid needs at least one cube.");
  return e;
}
export const canonical = (e: Envelope) => JSON.stringify(validate(e));
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
  return n;
}
export const hasHidden = (e: Envelope) => e.document.panels.some((p) => p.state === "answer" || (p.label.show === "hidden" && p.label.text.trim()));
export const cubeCount = (d: ElevationDocument) => d.heights.flat().reduce((a, b) => a + b, 0);

export function blank(): Envelope {
  return {
    tool: "elevations",
    schemaVersion: 1,
    rendererVersion: "elevations-1",
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
  const H = d.heights,
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
  const H = d.heights,
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

function gridPanel(d: ElevationDocument, p: Panel): Built {
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

function isoPanel(d: ElevationDocument, p: Panel): Built {
  const faces = isoFaces(d);
  const s = 10; // 1 cm isometric paper
  const pts = faces.flatMap((f) => f.pts);
  let minU = Math.min(...pts.map((q) => q.u)),
    maxU = Math.max(...pts.map((q) => q.u)),
    minV = Math.min(...pts.map((q) => q.v)),
    maxV = Math.max(...pts.map((q) => q.v));
  if (p.state !== "drawn" && p.squares.across) {
    maxU = minU + p.squares.across * C;
    maxV = minV + p.squares.up;
  }
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
    for (const f of faces)
      out.push(`<path d="M${f.pts.map((q) => `${n(X(q.u))} ${n(Y(q.v))}`).join("L")}Z" fill="white" stroke="black" stroke-width="0.35" stroke-linejoin="round"/>`);
    if (arrows) {
      const H = d.heights,
        rows = H.length,
        cols = H[0].length;
      // Front arrow points at the middle of the front face; side arrow at the middle of the left face.
      const front = iso(cols / 2, 0, 0.5),
        side = iso(0, rows / 2, 0.5);
      const arrow = (q: { u: number; v: number }, du: number, dv: number, word: string) => {
        const tip = { x: X(q.u) + du * 1.5, y: Y(q.v) + dv * 1.5 },
          tail = { x: tip.x + du * 9, y: tip.y + dv * 9 };
        const back = { x: tip.x + du * 2.2, y: tip.y + dv * 2.2 },
          side1 = { x: back.x - dv * 1, y: back.y + du * 1 },
          side2 = { x: back.x + dv * 1, y: back.y - du * 1 };
        out.push(`<path d="M${n(tail.x)} ${n(tail.y)}L${n(back.x)} ${n(back.y)}" stroke="black" stroke-width="0.3"/>`);
        out.push(`<path d="M${n(tip.x)} ${n(tip.y)}L${n(side1.x)} ${n(side1.y)}L${n(side2.x)} ${n(side2.y)}Z" fill="black"/>`);
        return { tail, word };
      };
      const a1 = arrow(front, Math.cos(Math.PI / 6) * 0.6, 0.8, "Front");
      const a2 = arrow(side, -0.6, 0.8, "Side");
      const extra: string[] = [];
      for (const a of [a1, a2]) extra.push(text(a.word, a.tail.x, a.tail.y + FONT * 1.05));
      out.push(...extra);
      const lowest = Math.max(a1.tail.y, a2.tail.y) + FONT * 1.3;
      const left = Math.min(0, a2.tail.x - textWidth("Side") / 2 - 1),
        right = Math.max(W, a1.tail.x + textWidth("Front") / 2 + 1);
      return { width: right - left, height: Math.max(Hh, lowest), svg: `<g transform="translate(${n(-left)} 0)">${out.join("")}</g>` };
    }
  }
  return { width: W, height: Hh, svg: out.join("") };
}

/** Panels placed left to right, wrapping to a new row at maxWidthCm, each with its label underneath. */
export function layout(e: Envelope) {
  const d = e.document,
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
  if (d.panels.every((p) => p.state === "drawn") && d.panels.length > 1) notes.push("Every view is drawn, so pupils have nothing to draw. Make a view blank or an answer for a question.");
  for (const p of d.panels)
    if (p.view !== "isometric" && p.state !== "drawn" && p.squares.across) {
      const f = flatView(d, p.view);
      if (p.squares.across < f.across || p.squares.up < f.up) notes.push(`The ${p.view} grid is smaller than the ${p.view} view (${f.across} by ${f.up} squares).`);
    }
  return { width: Math.ceil((width + 2 * M) * 10) / 10, height: Math.ceil((height + 2 * M) * 10) / 10, margin: M, placed, issues, notes };
}
export const exportIssue = (e: Envelope) => layout(e).issues.join(" ") || null;
export const warnings = (e: Envelope) => {
  const g = layout(e);
  return [...g.issues, ...g.notes];
};

export function renderSvg(e: Envelope): string {
  const g = layout(e),
    out: string[] = [`<rect width="${n(g.width)}" height="${n(g.height)}" fill="white"/>`];
  for (const { x, y, p, b } of g.placed) {
    out.push(`<g transform="translate(${n(x + g.margin)} ${n(y + g.margin)})">${b.svg}</g>`);
    if (p.label.text.trim() && p.label.show === "show") out.push(text(p.label.text.trim(), x + g.margin + b.width / 2, y + g.margin + b.height + FONT + 1));
  }
  const views = e.document.panels.map((p) => `${p.view}${p.state === "drawn" ? "" : " (blank grid)"}`).join(", ");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${n(g.width)}mm" height="${n(g.height)}mm" viewBox="0 0 ${n(g.width)} ${n(g.height)}" role="img" aria-label="${esc(`Solid of ${cubeCount(e.document)} cubes: ${views}`)}">${out.join("")}</svg>`;
}

/* ---------- Hashes and links ---------- */

export async function hash(e: Envelope) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical(e)));
  return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, "0")).join("");
}
export const MAX_LINK_LENGTH = 16_000;
export const LINK_PREFIX = "#elevations=";
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
  url.pathname = url.pathname.replace(/(\/tools(\/[^/]*)?)?\/?$/, "/") + "tools/elevations";
  url.search = "";
  url.hash = linkHash(e);
  return url.href.length <= MAX_LINK_LENGTH ? url.href : null;
}
export function decodeLinkHash(hashText: string): Envelope {
  if (!/^#elevations=[A-Za-z0-9_-]+$/.test(hashText) || hashText.length > MAX_LINK_LENGTH)
    throw Error("This is not a supported plans and elevations link. Open an editable file instead.");
  try {
    const binary = atob(hashText.slice(LINK_PREFIX.length).replaceAll("-", "+").replaceAll("_", "/"));
    return parseFile(new TextDecoder("utf-8", { fatal: true }).decode(Uint8Array.from(binary, (c) => c.charCodeAt(0))));
  } catch {
    throw Error("This plans and elevations link could not be read. Open an editable file instead.");
  }
}
