// Worked solutions for the question bank (schema 2): checked steps per part, drawn by MathsDock over
// the part's own cut at true size. No Node or browser side effects; the bank page loads this lazily.
//
// Units are PDF points of the cut ("surface") the working is drawn on: the same width and height as
// the cut's catalogue view. Working is black in the handwriting font, guidance is dark pink in Inter,
// and method diagrams come from MathsDock's own renderers. See docs/content/WORKED-SOLUTIONS.md.
import { z } from "zod";
import { handAdvance } from "./metrics";
import { advance as interAdvance } from "../../resource-core/src/metrics";
import { renderSvg as renderGrid, validate as validateGrid } from "../../algebra-grid-core/src/index";
import { renderSvg as renderNumberLine, validate as validateNumberLine } from "../../number-line-core/src/index";
import { renderRatioSvg } from "../../ratio-table-core/src/svg";
import { validateRatioEnvelope } from "../../ratio-table-core/src/interchange";
import { renderSvg as renderFactorTree, validate as validateFactorTree } from "../../factor-tree-core/src/index";
import type { Band } from "./slices";
export { slices, type Band } from "./slices";

export const WORKED_SCHEMA_VERSION = 2 as const;
/** The working font: Shantell Sans, served by the site as this family. */
export const HAND_FAMILY = "MathsDock Hand";
export const HAND_SIZE = 12;
export const NOTE_SIZE = 10;
export const INK = "#111111";
export const PINK = "#b0125b";
const CARRY_INK = "#41526b";
const LINE = 26;
const FRACTION_LINE = 38;
const BUBBLE_ROW = 26;
const NOTE_LEADING = 13;
const MM = 72 / 25.4;

// ---------------------------------------------------------------- schema

export const DIAGRAM_FAMILIES = ["algebra-grid", "ratio-table", "number-line", "factor-tree"] as const;
export type DiagramFamily = typeof DIAGRAM_FAMILIES[number];
const text = (max: number) => z.string().trim().min(1).max(max);
const id = z.string().regex(/^[A-Za-z0-9_-]{1,40}$/);
const coordinate = z.number().finite().min(0).max(2000);
const point = z.tuple([coordinate, coordinate]);
/** One mark, with its mark-scheme code. A bracketed code such as "(B1)" is partial credit and is not counted. */
const markSchema = z.object({
  code: z.string().regex(/^(\([BMAPC][1-9]\)|[BMAPC][1-9])$/),
  note: text(90),
  /** Another route the mark scheme accepts, in one short line (decision 3, 16 November 2026). */
  also: text(110).optional(),
}).strict();
const beside = { mark: markSchema.optional(), note: text(140).optional() };
const relation = z.enum(["=", "<", ">", "≤", "≥", "≠", "≈"]);
const shape = z.discriminatedUnion("type", [
  z.object({ type: z.literal("line"), from: point, to: point }).strict(),
  z.object({ type: z.literal("path"), points: z.array(point).min(2).max(60) }).strict(),
  z.object({ type: z.literal("cross"), at: point, label: text(8).optional() }).strict(),
  z.object({ type: z.literal("ring"), at: point, r: z.number().positive().max(40).default(5) }).strict(),
  z.object({ type: z.literal("label"), at: point, text: text(24), background: z.boolean().default(true) }).strict(),
]);
const stepSchema = z.discriminatedUnion("kind", [
  /** An equation or inequality line, aligned on its sign with the other lines of the part. */
  z.object({ kind: z.literal("line"), lhs: text(80), rel: relation.default("="), rhs: text(80), ...beside }).strict(),
  /** A line of words or maths that does not align on a sign. */
  z.object({ kind: z.literal("text"), text: text(120), ...beside }).strict(),
  /** The bubble method: each operation in a bubble under the term it acts on, on both sides. */
  z.object({ kind: z.literal("bubbles"), lhs: text(12), rhs: text(12) }).strict(),
  /** A MathsDock diagram drawn by its own renderer at true size. */
  z.object({ kind: z.literal("diagram"), family: z.enum(DIAGRAM_FAMILIES), envelope: z.unknown(), ...beside }).strict(),
  /** A value carried from an earlier part, tagged "from (a)". */
  z.object({ kind: z.literal("carry"), from: text(12), text: text(80) }).strict(),
  /** Guidance with no mark; "watch" marks a slip the mark scheme itself flags. */
  z.object({ kind: z.literal("note"), text: text(160), watch: z.boolean().default(false) }).strict(),
  /** Drawing on a surface, in its points: a graph line, a tangent, a triangle, a ringed point. */
  z.object({ kind: z.literal("draw"), on: id, shapes: z.array(shape).min(1).max(30), ...beside }).strict(),
  /** The final answer, written on the part's answer line, box or table. */
  z.object({ kind: z.literal("answer"), value: text(90), at: z.number().int().min(0).max(5).default(0), mark: markSchema.optional(),
    /** Words on a full-width line start at its left; a value sits in the middle of its line. */
    align: z.enum(["centre", "left"]).default("centre") }).strict(),
]);
const area = z.object({ x: coordinate, y: coordinate, width: z.number().positive().max(2000), bottom: coordinate }).strict()
  .refine(a => a.bottom > a.y, { message: "The working space must end below where it starts.", path: ["bottom"] });
/** Where an answer is written: the left end and baseline of the printed answer line, and its length. */
const anchor = z.object({ x: coordinate, y: coordinate, width: z.number().positive().max(2000) }).strict();
const partSchema = z.object({
  /** The surface (cut view, or question view for an uncut question) the working is drawn on. */
  on: id,
  /** The catalogue part labels this working answers, for the marks check. */
  parts: z.array(text(16)).min(1).max(12),
  /** The school method used, so a change of common approach can find every part that uses it. */
  method: z.string().regex(/^[a-z0-9-]{1,40}$/).optional(),
  /** The printed blank working space. Working that does not fit adds room below it; type never shrinks. */
  area,
  /** The left edge of the guidance column. */
  notesX: coordinate,
  answers: z.array(anchor).max(6).default([]),
  steps: z.array(stepSchema).min(1).max(40),
}).strict();
export const workedDataSchema = z.object({
  schemaVersion: z.literal(WORKED_SCHEMA_VERSION),
  questionId: text(80),
  questionRevision: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/),
  parts: z.array(partSchema).min(1).max(12),
}).strict();

export type WorkedData = z.output<typeof workedDataSchema>;
export type WorkedPart = WorkedData["parts"][number];
export type WorkedStep = WorkedPart["steps"][number];
export type WorkedMark = z.output<typeof markSchema>;

/** Reads a worked-solution file. Throws with the first problem's path on anything invalid. */
export function parseWorked(raw: unknown): WorkedData {
  const parsed = workedDataSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new Error(`Worked solution is invalid at ${issue.path.join(".") || "the top level"}: ${issue.message}`);
  }
  for (const part of parsed.data.parts) for (const step of part.steps) if (step.kind === "diagram") diagramSvg(step.family, step.envelope);
  return parsed.data;
}

// ---------------------------------------------------------------- maths text

/** Typed maths to printed maths: "-" is a minus sign (a hyphen between letters stays), "*" a times sign, "<=" and ">=" their signs. */
export function mathsText(s: string): string {
  return s.replace(/<=/g, "≤").replace(/>=/g, "≥").replace(/\*/g, "×").replace(/(?<![A-Za-z])-|-(?![A-Za-z])/g, "−");
}

type Piece = { kind: "run"; text: string; sup: boolean } | { kind: "fraction"; num: string; den: string };

/** Splits "{3/4}" stacked fractions and "^2" or "^{12}" powers out of a line. */
export function pieces(s: string): Piece[] {
  const out: Piece[] = [];
  let run = "";
  const flush = () => { if (run) out.push({ kind: "run", text: run, sup: false }); run = ""; };
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === "{") {
      const end = s.indexOf("}", i);
      const inner = end > i ? s.slice(i + 1, end) : "";
      const slash = inner.indexOf("/");
      if (end > i && slash > 0 && slash < inner.length - 1) { flush(); out.push({ kind: "fraction", num: inner.slice(0, slash).trim(), den: inner.slice(slash + 1).trim() }); i = end; continue; }
    }
    if (c === "^") {
      let power = "";
      if (s[i + 1] === "{") { const end = s.indexOf("}", i + 1); if (end > i) { power = s.slice(i + 2, end); i = end; } }
      else { const m = /^[−-]?[0-9a-zA-Z]+/.exec(s.slice(i + 1)); if (m) { power = m[0]; i += m[0].length; } }
      if (power) { flush(); out.push({ kind: "run", text: power, sup: true }); continue; }
    }
    run += c;
  }
  flush();
  return out;
}

const handWidth = (s: string, size: number) => Array.from(s).reduce((n, c) => n + handAdvance(c), 0) * size;
const noteWidth = (s: string, size: number, bold = false) => Array.from(s).reduce((n, c) => n + interAdvance(c, bold ? "bold" : "regular"), 0) * size;
const pieceWidth = (p: Piece, size: number) => p.kind === "run" ? handWidth(p.text, p.sup ? size * 0.7 : size) : Math.max(handWidth(p.num, size), handWidth(p.den, size)) + size * 0.4;
export const mathsWidth = (s: string, size = HAND_SIZE) => pieces(s).reduce((n, p) => n + pieceWidth(p, size), 0);
const hasFraction = (s: string) => pieces(s).some(p => p.kind === "fraction");
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const n = (v: number) => Number(v.toFixed(2));

/** Maths text placed with its start at x on baseline y, as SVG. */
function maths(s: string, x: number, y: number, size = HAND_SIZE, fill = INK): string {
  let cursor = x, out = "";
  for (const p of pieces(s)) {
    const w = pieceWidth(p, size);
    if (p.kind === "run") out += `<text x="${n(cursor)}" y="${n(p.sup ? y - size * 0.4 : y)}" font-size="${n(p.sup ? size * 0.7 : size)}" fill="${fill}" xml:space="preserve">${esc(p.text)}</text>`;
    else {
      const mid = cursor + w / 2, bar = y - size * 0.32;
      out += `<text x="${n(mid)}" y="${n(bar - size * 0.22)}" font-size="${size}" fill="${fill}" text-anchor="middle">${esc(p.num)}</text>`
        + `<path d="M${n(cursor + size * 0.1)} ${n(bar)}H${n(cursor + w - size * 0.1)}" stroke="${fill}" stroke-width="0.9" fill="none"/>`
        + `<text x="${n(mid)}" y="${n(bar + size * 0.95)}" font-size="${size}" fill="${fill}" text-anchor="middle">${esc(p.den)}</text>`;
    }
    cursor += w;
  }
  return out;
}

// ---------------------------------------------------------------- diagrams

/** Prefixes each selector with the overlay's own class. */
const scopeCss = (css: string) => css.replace(/(^|})\s*([^{}@]+)\{/g, (_, end: string, selectors: string) => `${end}${selectors.split(",").map(x => `.wk ${x.trim()}`).join(",")}{`);

/** A MathsDock diagram as SVG with its printed size in points. */
export function diagramSvg(family: DiagramFamily, envelope: unknown): { svg: string; width: number; height: number } {
  const svg = family === "algebra-grid" ? renderGrid(validateGrid(envelope))
    : family === "number-line" ? renderNumberLine(validateNumberLine(envelope))
    : family === "factor-tree" ? renderFactorTree(validateFactorTree(envelope))
    : renderRatioSvg(validateRatioEnvelope(envelope).document);
  const root = /^<svg\b[^>]*>/.exec(svg)?.[0] ?? "";
  const size = (name: string) => {
    const m = new RegExp(`${name}="([0-9.]+)(mm|cm)"`).exec(root);
    if (!m) throw new Error(`The ${family} drawing has no printed ${name}.`);
    return Number(m[1]) * (m[2] === "cm" ? 10 : 1) * MM;
  };
  const viewBox = /viewBox="([^"]+)"/.exec(root)?.[1];
  if (!viewBox) throw new Error(`The ${family} drawing has no viewBox.`);
  const inner = svg.slice(root.length).replace(/<\/svg>\s*$/, "").replace(/<title>[\s\S]*?<\/title>|<desc>[\s\S]*?<\/desc>/g, "")
    // A diagram's own style rules would reach the whole page once the overlay is in it: keep them inside.
    .replace(/<style>([\s\S]*?)<\/style>/g, (_, css: string) => `<style>${scopeCss(css)}</style>`);
  return { svg: `<svg viewBox="${viewBox}" overflow="visible">${inner}</svg>`, width: size("width"), height: size("height") };
}

// ---------------------------------------------------------------- layout

export interface Surface { id: string; width: number; height: number }
export interface Box { x: number; y: number; width: number; height: number; what: string }
export interface WorkedIssue { surface: string; message: string }
/** What one surface shows: its working drawn over it, and any room added below working spaces. */
export interface SurfaceOverlay {
  id: string;
  width: number;
  /** The cut's own height in points. */
  height: number;
  /** Room added inside the cut, top to bottom; empty when the working fits the printed space. */
  bands: Band[];
  /** Room added below the cut for the "Total for Question" line. */
  footer: number;
  /** A complete SVG, width × (height + bands + footer) points, drawn over the cut as the viewer splits it. */
  svg: string;
}
export interface WorkedLayout {
  overlays: Map<string, SurfaceOverlay>;
  /** Steps in the whole solution; step numbers run through every part in order. */
  steps: number;
  /** The step numbers of the shown parts, for step by step; empty when nothing is shown. */
  shownSteps: number[];
  issues: WorkedIssue[];
}
export interface LayoutOptions {
  /** Surfaces of the parts being shown, in order; all parts when absent. */
  parts?: string[];
  /** Show the mark codes, partial credit and "also scores" lines (the Mark notes switch). */
  marks?: boolean;
  /** Step by step: show steps 1 to this number only. */
  upTo?: number;
  /** Adds "(Total for Question N is M marks)" under the last surface, for a whole question. */
  total?: { question: number; marks: number };
}

/** Something drawn on a surface, in the cut's own points; `anchor` decides which bands move it down. */
interface Item { svg: string; anchor: number; boxes: Box[] }
interface Draft { surface: Surface; items: Item[]; bands: Band[]; footer: number }

/** Total room added above a point of the cut. */
const shiftAt = (bands: Band[], y: number) => bands.reduce((sum, b) => sum + (y >= b.at - 0.5 ? b.size : 0), 0);

function wrap(s: string, width: number, size: number): string[] {
  const words = s.split(/\s+/), lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (line && noteWidth(next, size) > width) { lines.push(line); line = word; } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

const overlaps = (a: Box, b: Box) => a.x < b.x + b.width - 0.5 && b.x < a.x + a.width - 0.5 && a.y < b.y + b.height - 0.5 && b.y < a.y + a.height - 0.5;

/** The last term of an expression, with its sign: what a bubble under the left-hand side acts on. */
export function lastTerm(s: string): string {
  let depth = 0;
  for (let i = s.length - 1; i > 0; i--) {
    const c = s[i];
    if (c === ")" || c === "}") depth++;
    else if (c === "(" || c === "{") depth--;
    else if (depth === 0 && (c === "+" || c === "−") && s[i - 1] === " ") return s.slice(i).trim();
  }
  return s.trim();
}

const chip = (code: string, x: number, y: number) => `<g class="wk-mark"><rect x="${n(x)}" y="${n(y - 9)}" width="${n(noteWidth(code, 9, true) + 8)}" height="12" rx="2.5" fill="#fff" stroke="${PINK}" stroke-width="0.8"/><text x="${n(x + 4)}" y="${n(y)}" font-size="9" font-weight="700" fill="${PINK}">${esc(code)}</text></g>`;
const UI = `font-family="MathsDock UI, Inter, sans-serif"`;
const HAND = `font-family="${HAND_FAMILY}, 'Shantell Sans', cursive"`;

/**
 * Lays out the shown parts' working over their surfaces. Positions come from the data's working
 * space and guidance column; the checks report anything that would overlap or leave the cut.
 */
export function layoutWorked(data: WorkedData, surfaces: Surface[], options: LayoutOptions = {}): WorkedLayout {
  const bySurface = new Map(surfaces.map(s => [s.id, s]));
  const drafts = new Map<string, Draft>();
  const issues: WorkedIssue[] = [];
  const marks = options.marks ?? true;
  const draft = (id: string): Draft | undefined => {
    const surface = bySurface.get(id);
    if (!surface) return undefined;
    let d = drafts.get(id);
    if (!d) { d = { surface, items: [], bands: [], footer: 0 }; drafts.set(id, d); }
    return d;
  };
  const shown = data.parts.filter(p => !options.parts || options.parts.includes(p.on));
  // Step numbers count through every part, so step by step means the same steps whatever is shown.
  let stepNumber = 0;
  const shownSteps: number[] = [];
  const visible = (k: number) => options.upTo === undefined || k <= options.upTo;

  for (const part of data.parts) {
    if (!shown.includes(part)) { stepNumber += part.steps.length; continue; }
    const d = draft(part.on);
    if (!d) { issues.push({ surface: part.on, message: `No cut called ${part.on} is shown for this question.` }); stepNumber += part.steps.length; continue; }
    const { area: a } = part;
    const emit = (target: Draft, k: number, svg: string, anchor: number, boxes: Box[]) => {
      if (visible(k)) target.items.push({ svg: `<g data-step="${k}">${svg}</g>`, anchor, boxes });
    };
    const lines = part.steps.filter(s => s.kind === "line") as Extract<WorkedStep, { kind: "line" }>[];
    const eq = a.x + Math.max(0, ...lines.map(l => mathsWidth(mathsText(l.lhs)))) + 10;
    const notesWidth = d.surface.width - part.notesX - 4;
    if (notesWidth < 60) issues.push({ surface: part.on, message: "The guidance column starts too near the right edge of the cut." });
    let cursor = a.y, noteBottom = 0;
    let last: { lhsCentre: number; rhsCentre: number } | undefined;
    const later: (() => void)[] = [];

    const placeNote = (k: number, baseline: number, mark: WorkedMark | undefined, note: string | undefined, watch = false) => {
      if (!mark && !note) return;
      let y = Math.max(baseline, noteBottom + NOTE_LEADING);
      const top = y - NOTE_SIZE;
      let svg = "";
      if (mark) {
        const chipWidth = noteWidth(mark.code, 9, true) + 8;
        const words = wrap(mark.note, notesWidth - chipWidth - 5, NOTE_SIZE);
        svg += chip(mark.code, part.notesX, y);
        // The words keep their place without the chip, so guidance never jumps when the switch changes.
        words.forEach((l, i) => { svg += `<text x="${n(part.notesX + chipWidth + 5)}" y="${n(y + i * NOTE_LEADING)}" font-size="${NOTE_SIZE}" fill="${PINK}">${esc(l)}</text>`; });
        y += (words.length - 1) * NOTE_LEADING;
        // Its room is kept without the mark notes too, so the layout is the same either way.
        if (mark.also) for (const l of wrap(`Also scores: ${mark.also}`, notesWidth - chipWidth - 5, 9)) { y += 12; if (marks) svg += `<text class="wk-mark" x="${n(part.notesX + chipWidth + 5)}" y="${n(y)}" font-size="9" font-style="italic" fill="${PINK}">${esc(l)}</text>`; }
        if (note) y += NOTE_LEADING;
      }
      if (note) {
        const prefix = watch ? "Watch out:" : "";
        wrap(prefix ? `${prefix} ${note}` : note, notesWidth, NOTE_SIZE).forEach((l, i) => {
          const body = i === 0 && prefix ? `<tspan font-weight="700">${prefix}</tspan>${esc(l.slice(prefix.length))}` : esc(l);
          if (i) y += NOTE_LEADING;
          svg += `<text x="${n(part.notesX)}" y="${n(y)}" font-size="${NOTE_SIZE}" fill="${PINK}" xml:space="preserve">${body}</text>`;
        });
      }
      noteBottom = y + 3;
      emit(d, k, `<g ${UI}>${svg}</g>`, a.y, [{ x: part.notesX, y: top, width: notesWidth, height: y + 3 - top, what: "guidance" }]);
    };
    const work = (k: number, svg: string, box: Omit<Box, "what">, what = "working") => emit(d, k, `<g ${HAND}>${svg}</g>`, a.y, [{ ...box, what }]);

    for (const step of part.steps) {
      const k = ++stepNumber;
      // A bubble row with no line above it draws nothing, so step by step skips it (the checks report it).
      if (!(step.kind === "bubbles" && !last)) shownSteps.push(k);
      switch (step.kind) {
        case "line": {
          const lhs = mathsText(step.lhs), rhs = mathsText(step.rhs);
          const h = hasFraction(lhs) || hasFraction(rhs) ? FRACTION_LINE : LINE;
          const y = cursor + h * 0.68, lw = mathsWidth(lhs), rw = mathsWidth(rhs);
          work(k, maths(lhs, eq - 8 - lw, y) + `<text x="${n(eq)}" y="${n(y)}" font-size="${HAND_SIZE}" fill="${INK}" text-anchor="middle">${esc(step.rel)}</text>` + maths(rhs, eq + 8, y),
            { x: eq - 8 - lw, y: y - HAND_SIZE, width: lw + rw + 16, height: HAND_SIZE * 1.3 });
          last = { lhsCentre: eq - 8 - mathsWidth(lastTerm(lhs)) / 2, rhsCentre: eq + 8 + rw / 2 };
          placeNote(k, y, step.mark, step.note);
          cursor += h;
          break;
        }
        case "text": case "carry": {
          const s = mathsText(step.text);
          const h = hasFraction(s) ? FRACTION_LINE : LINE;
          const y = cursor + h * 0.68, w = mathsWidth(s);
          let svg = maths(s, a.x, y), tagWidth = 0;
          if (step.kind === "carry") {
            const tag = `from ${step.from}`;
            tagWidth = noteWidth(tag, 9, true) + 12;
            svg += `<g ${UI}><rect x="${n(a.x + w + 10)}" y="${n(y - 10)}" width="${n(tagWidth)}" height="14" rx="7" fill="#eef3fa" stroke="#9fb3cc" stroke-width="0.6"/><text x="${n(a.x + w + 16)}" y="${n(y)}" font-size="9" font-weight="600" fill="${CARRY_INK}">${esc(tag)}</text></g>`;
          }
          work(k, svg, { x: a.x, y: y - HAND_SIZE, width: w + (tagWidth ? tagWidth + 10 : 0), height: HAND_SIZE * 1.3 });
          if (step.kind === "text") placeNote(k, y, step.mark, step.note);
          last = undefined;
          cursor += h;
          break;
        }
        case "bubbles": {
          if (!last) { issues.push({ surface: part.on, message: `Step ${k}: bubbles need an equation or inequality line above them.` }); break; }
          const cy = cursor + BUBBLE_ROW / 2;
          const radius = (t: string) => Math.max(15, handWidth(mathsText(t), 10.5) / 2 + 7);
          const bubble = (cx: number, rx: number, t: string) => `<ellipse cx="${n(cx)}" cy="${n(cy)}" rx="${n(rx)}" ry="9.5" fill="none" stroke="${INK}" stroke-width="0.9"/><text x="${n(cx)}" y="${n(cy + 3.8)}" font-size="10.5" fill="${INK}" text-anchor="middle">${esc(mathsText(t))}</text>`;
          const lr = radius(step.lhs), rr = radius(step.rhs);
          // Each bubble sits under its term; short sides would make them touch, so the right one moves over.
          const lx = Math.max(a.x + lr, last.lhsCentre), rx = Math.max(last.rhsCentre, lx + lr + rr + 8);
          work(k, bubble(lx, lr, step.lhs) + bubble(rx, rr, step.rhs), { x: lx - lr, y: cy - 9.5, width: rx + rr - (lx - lr), height: 19 });
          cursor += BUBBLE_ROW;
          break;
        }
        case "diagram": {
          const dg = diagramSvg(step.family, step.envelope);
          const top = cursor + 4;
          work(k, dg.svg.replace("<svg ", `<svg x="${n(a.x)}" y="${n(top)}" width="${n(dg.width)}" height="${n(dg.height)}" `), { x: a.x, y: top, width: dg.width, height: dg.height }, "diagram");
          placeNote(k, top + 12, step.mark, step.note);
          last = undefined;
          cursor = top + dg.height + 6;
          break;
        }
        case "note":
          placeNote(k, cursor + LINE * 0.68, undefined, step.text, step.watch);
          break;
        case "draw": {
          const target = draft(step.on);
          if (!target) { issues.push({ surface: part.on, message: `Step ${k}: no cut called ${step.on} is shown.` }); break; }
          const shapes = step.shapes;
          // Drawn after every part, so the target's own added room is known.
          later.push(() => {
            let svg = "", top = Infinity, low = -Infinity;
            const boxes: Box[] = [];
            const at = (p: readonly [number, number]) => { top = Math.min(top, p[1]); low = Math.max(low, p[1]); return `${n(p[0])} ${n(p[1])}`; };
            for (const s of shapes) {
              if (s.type === "line") svg += `<path d="M${at(s.from)}L${at(s.to)}" stroke="${INK}" stroke-width="1.1" stroke-linecap="round" fill="none"/>`;
              else if (s.type === "path") svg += `<path d="M${s.points.map(at).join("L")}" stroke="${INK}" stroke-width="1" stroke-linejoin="round" fill="none"/>`;
              else if (s.type === "cross") { at(s.at); svg += `<path d="M${n(s.at[0] - 3.5)} ${n(s.at[1] - 3.5)}l7 7M${n(s.at[0] + 3.5)} ${n(s.at[1] - 3.5)}l-7 7" stroke="${INK}" stroke-width="1.1" fill="none"/>` + (s.label ? `<text x="${n(s.at[0] - 7)}" y="${n(s.at[1] - 5)}" font-size="${HAND_SIZE}" fill="${INK}" text-anchor="end">${esc(mathsText(s.label))}</text>` : ""); }
              else if (s.type === "ring") { at(s.at); svg += `<circle cx="${n(s.at[0])}" cy="${n(s.at[1])}" r="${n(s.r)}" stroke="${INK}" stroke-width="1" fill="none"/>`; }
              else {
                at(s.at);
                const t = mathsText(s.text), w = mathsWidth(t, 11);
                boxes.push({ x: s.at[0] - 2, y: s.at[1] - 11, width: w + 4, height: 14, what: "drawing label" });
                svg += (s.background ? `<rect x="${n(s.at[0] - 2)}" y="${n(s.at[1] - 11)}" width="${n(w + 4)}" height="14" fill="#fff"/>` : "") + maths(t, s.at[0], s.at[1], 11);
              }
            }
            // A drawing moves as one piece, so added room must not split it from its graph.
            if (target.bands.some(b => b.at > top + 0.5 && b.at < low - 0.5)) issues.push({ surface: step.on, message: `Step ${k}: room added inside the cut would split this drawing.` });
            emit(target, k, `<g ${HAND}>${svg}</g>`, top, boxes);
          });
          placeNote(k, cursor + LINE * 0.68, step.mark, step.note);
          break;
        }
        case "answer": {
          const anchor = part.answers[step.at];
          if (!anchor) { issues.push({ surface: part.on, message: `Step ${k}: the part has no answer line ${step.at + 1}.` }); break; }
          const value = mathsText(step.value), w = mathsWidth(value), mark = step.mark;
          if (w > anchor.width) issues.push({ surface: part.on, message: `Step ${k}: the answer is longer than its answer line.` });
          const lift = hasFraction(value) ? 10 : 0, base = anchor.y - 3 - lift;
          const left = step.align === "left" ? anchor.x + 6 : anchor.x + anchor.width / 2 - w / 2;
          let svg = `<g ${HAND}>${maths(value, left, base)}</g>`;
          const boxes: Box[] = [{ x: left, y: base - HAND_SIZE, width: w, height: HAND_SIZE * 1.2 + lift, what: "answer" }];
          if (mark) {
            const chipWidth = noteWidth(mark.code, 9, true) + 8, words = noteWidth(mark.note, NOTE_SIZE) + chipWidth + 5;
            const x = Math.min(anchor.x + anchor.width - words, d.surface.width - words - 2), y = base - HAND_SIZE - 7;
            svg += `<g ${UI}>${chip(mark.code, x, y)}<text x="${n(x + chipWidth + 5)}" y="${n(y)}" font-size="${NOTE_SIZE}" fill="${PINK}">${esc(mark.note)}</text></g>`;
            boxes.push({ x, y: y - 10, width: words, height: 13, what: "answer guidance" });
          }
          // The answer line sits below the working space, so it moves down with any room added there.
          emit(d, k, svg, anchor.y, boxes);
          break;
        }
      }
    }
    const bottom = Math.max(cursor, noteBottom);
    if (bottom > a.bottom + 0.5) d.bands.push({ at: a.bottom, size: Math.ceil(bottom - a.bottom + 4) });
    d.bands.sort((p, q) => p.at - q.at);
    for (const place of later) place();
  }

  if (options.total && surfaces.length) {
    // Under the last cut shown, whether or not it carries working.
    const lastSurface = draft(surfaces[surfaces.length - 1].id);
    if (lastSurface) {
      const { surface } = lastSurface;
      lastSurface.footer = 28;
      lastSurface.items.push({ anchor: surface.height, boxes: [], svg: `<text x="${n(surface.width - 6)}" y="${n(surface.height + 19)}" font-family="'STIX Two Text', 'Times New Roman', serif" font-size="11" font-weight="700" fill="#000" text-anchor="end">(Total for Question ${options.total.question} is ${options.total.marks} mark${options.total.marks === 1 ? "" : "s"})</text>` });
    }
  }

  const overlays = new Map<string, SurfaceOverlay>();
  for (const d of drafts.values()) {
    const { surface, bands } = d;
    const added = bands.reduce((sum, b) => sum + b.size, 0);
    const boxes: Box[] = [];
    let body = "";
    for (const item of d.items) {
      const dy = shiftAt(bands, item.anchor);
      body += dy ? `<g transform="translate(0 ${n(dy)})">${item.svg}</g>` : item.svg;
      for (const b of item.boxes) boxes.push({ ...b, y: b.y + dy });
    }
    for (const b of boxes) if (b.x < -0.5 || b.x + b.width > surface.width + 0.5) issues.push({ surface: surface.id, message: `Some ${b.what} runs off the side of the cut.` });
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
      const p = boxes[i], q = boxes[j];
      if (p.what === "working" && q.what === "working") continue;
      if (overlaps(p, q)) issues.push({ surface: surface.id, message: `The ${p.what} and the ${q.what} overlap.` });
    }
    const height = surface.height + added + d.footer;
    const style = marks ? "" : "<style>.wk .wk-mark{display:none}</style>";
    overlays.set(surface.id, {
      id: surface.id, width: surface.width, height: surface.height, bands: [...bands], footer: d.footer,
      svg: `<svg xmlns="http://www.w3.org/2000/svg" class="wk" viewBox="0 0 ${n(surface.width)} ${n(height)}" width="${n(surface.width)}" height="${n(height)}" overflow="visible">${style}${body}</svg>`,
    });
  }
  return { overlays, steps: stepNumber, shownSteps, issues: dedupe(issues) };
}

const dedupe = (issues: WorkedIssue[]) => [...new Map(issues.map(i => [`${i.surface}\u0000${i.message}`, i])).values()];



/** Marks claimed by a part's notes: every unbracketed code counts its number (M1, B2). */
export function claimedMarks(part: WorkedPart): number {
  const codes: WorkedMark[] = [];
  for (const s of part.steps) if ("mark" in s && s.mark) codes.push(s.mark);
  return codes.filter(m => !m.code.startsWith("(")).reduce((sum, m) => sum + Number(m.code.slice(1)), 0);
}

/**
 * The machine checks for a worked solution against its question: every part answered once, marks
 * that add up to each part's grey (N), an answer on every answer line, nothing overlapping.
 */
export function checkWorked(data: WorkedData, question: { id: string; revision: string; parts: { label: string; marks: number }[] }, surfaces: Surface[]): string[] {
  const problems: string[] = [];
  if (data.questionId !== question.id) problems.push(`The file is for ${data.questionId}, not ${question.id}.`);
  if (data.questionRevision !== question.revision) problems.push("The file was written for a different revision of the question.");
  const covered = data.parts.flatMap(p => p.parts);
  for (const p of question.parts) {
    const count = covered.filter(l => l === p.label).length;
    if (count !== 1) problems.push(count ? `Part ${p.label} is answered ${count} times.` : `Part ${p.label} has no working.`);
  }
  for (const label of covered) if (!question.parts.some(p => p.label === label)) problems.push(`There is no part ${label} in this question.`);
  for (const part of data.parts) {
    const marks = question.parts.filter(p => part.parts.includes(p.label)).reduce((sum, p) => sum + p.marks, 0);
    const claimed = claimedMarks(part);
    if (claimed !== marks) problems.push(`The notes for ${part.parts.join(", ")} give ${claimed} mark${claimed === 1 ? "" : "s"}; the part is worth ${marks}.`);
    const answered = new Set(part.steps.filter(s => s.kind === "answer").map(s => (s as Extract<WorkedStep, { kind: "answer" }>).at));
    part.answers.forEach((_, i) => { if (!answered.has(i)) problems.push(`Answer line ${i + 1} of ${part.parts.join(", ")} is left empty.`); });
    for (const s of part.steps) {
      const words = s.kind === "line" ? [s.lhs, s.rhs] : s.kind === "text" ? [s.text] : s.kind === "answer" ? [s.value] : [];
      for (const w of words) if (/(^|[^{\d])\d+\/\d+(?![^{]*})/.test(w) || /[½⅓⅔¼¾⅕⅛]/.test(w)) problems.push(`"${w}" uses a slash or a small fraction; fractions are stacked: write {3/4}.`);
      const said = [s.kind === "text" || s.kind === "note" ? s.text : "", "note" in s && s.note ? s.note : "", "mark" in s && s.mark ? s.mark.note : ""].join(" ");
      if (/\bput\b/i.test(said)) problems.push(`"${said.trim()}" says "put"; the school says "substitute".`);
      if (/y\s*↓/.test(said)) problems.push(`"${said.trim()}" uses y ↓; movements are y ↑ with a negative number.`);
    }
  }
  // WS9: a value carried from an earlier part is that part's own answer, never a different one.
  for (const part of data.parts) for (const s of part.steps) {
    if (s.kind !== "carry") continue;
    const source = data.parts.find(p => p.parts.includes(s.from));
    const values = source?.steps.filter(t => t.kind === "answer").map(t => mathsText((t as Extract<WorkedStep, { kind: "answer" }>).value)) ?? [];
    if (!source) problems.push(`"${s.text}" is carried from ${s.from}, which has no working.`);
    else if (values.length && !values.some(v => mathsText(s.text).includes(v))) problems.push(`"${s.text}" does not match the answer to ${s.from}.`);
  }
  const layout = layoutWorked(data, surfaces);
  for (const issue of layout.issues) problems.push(`${issue.surface}: ${issue.message}`);
  return [...new Set(problems)];
}
