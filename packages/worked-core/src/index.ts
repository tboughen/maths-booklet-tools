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
import { renderSvg as renderBubbleMethod, validate as validateBubbleMethod } from "../../bubble-method-core/src/index";
import { renderSvg as renderAngles, validate as validateAngles } from "../../angle-core/src/index";
import { renderSvg as renderArea, validate as validateArea } from "../../area-core/src/index";
import { renderSvg as renderVenn, validate as validateVenn } from "../../venn-core/src/index";
import { renderSvg as renderProbabilityTree, validate as validateProbabilityTree } from "../../probability-tree-core/src/index";
import { renderSvg as renderFrequencyTree, validate as validateFrequencyTree } from "../../frequency-tree-core/src/index";
import { renderSvg as renderTwoWay, validate as validateTwoWay } from "../../two-way-table-core/src/index";
import { renderSvg as renderSampleSpace, validate as validateSampleSpace } from "../../sample-space-core/src/index";
import { renderSvg as renderChart, validate as validateChart } from "../../chart-core/src/index";
import { renderSvg as renderConstruction, validate as validateConstruction } from "../../construction-core/src/index";
import { renderSvg as renderCuboid, validate as validateCuboid } from "../../cuboid-core/src/index";
import { renderSvg as renderElevation, validate as validateElevation } from "../../elevation-core/src/index";
import { renderSvg as renderTriangle, validate as validateTriangle } from "../../triangle-core/src/index";
import { renderSvg as renderValueGraph, validate as validateValueGraph } from "../../value-graph-core/src/interchange";
import { validateEnvelope as validateGraph } from "../../graph-core/src/interchange";
import { renderDiagramSvg as renderGraph } from "../../graph-core/src/svg";
import { renderSvg as renderBarModel, validate as validateBarModel } from "../../bar-model-core/src/v3";
import { renderSvg as renderFunctionMachine, validate as validateFunctionMachine } from "../../function-machine-core/src/index";
import { renderSvg as renderWrittenMethod, validate as validateWrittenMethod } from "../../written-method-core/src/index";
import { renderSvg as renderFigure, validate as validateFigure } from "../../figure-core/src/index";
import { renderSvg as renderSolid, validate as validateSolid } from "../../solid-core/src/index";
import { READING_ARROWHEAD_POINTS, VECTOR_ARROWHEAD_POINTS, WORKING_DASH_POINTS } from "../../graph-core/src/graphStyle";
import { smoothCurvePath } from "../../graph-core/src/curve";
import { arrowheadPath } from "../../graph-core/src/arrow";
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
/** The gap between a line of working and its guidance. */
const NOTE_GAP = 16;
const MM = 72 / 25.4;

// ---------------------------------------------------------------- schema

/**
 * Every MathsDock renderer a worked solution can draw, each from its own saved envelope. Diagrams are
 * drawn as the pupil sees them: values in the working are written into the envelope as given.
 */
const RENDERERS = {
  "algebra-grid": (e: unknown) => renderGrid(validateGrid(e)),
  "ratio-table": (e: unknown) => renderRatioSvg(validateRatioEnvelope(e).document),
  "number-line": (e: unknown) => renderNumberLine(validateNumberLine(e)),
  "factor-tree": (e: unknown) => renderFactorTree(validateFactorTree(e)),
  "bubble-method": (e: unknown) => renderBubbleMethod(validateBubbleMethod(e)),
  "angles": (e: unknown) => renderAngles(validateAngles(e)),
  "area": (e: unknown) => renderArea(validateArea(e)),
  "venn": (e: unknown) => renderVenn(validateVenn(e)),
  "probability-tree": (e: unknown) => renderProbabilityTree(validateProbabilityTree(e)),
  "frequency-tree": (e: unknown) => renderFrequencyTree(validateFrequencyTree(e)),
  "two-way-table": (e: unknown) => renderTwoWay(validateTwoWay(e)),
  "sample-space": (e: unknown) => renderSampleSpace(validateSampleSpace(e)),
  "chart": (e: unknown) => renderChart(validateChart(e)),
  "construction": (e: unknown) => renderConstruction(validateConstruction(e)),
  "cuboid": (e: unknown) => renderCuboid(validateCuboid(e)),
  "elevations": (e: unknown) => renderElevation(validateElevation(e)),
  "triangle": (e: unknown) => renderTriangle(validateTriangle(e)),
  "value-graph": (e: unknown) => renderValueGraph(validateValueGraph(e)),
  "graph": (e: unknown) => renderGraph(validateGraph(e).document),
  "bar-model": (e: unknown) => renderBarModel(validateBarModel(e)),
  "function-machine": (e: unknown) => renderFunctionMachine(validateFunctionMachine(e)),
  "written-method": (e: unknown) => renderWrittenMethod(validateWrittenMethod(e)),
  "figures": (e: unknown) => renderFigure(validateFigure(e)),
  "solids": (e: unknown) => renderSolid(validateSolid(e)),
} as const;
export const DIAGRAM_FAMILIES = Object.keys(RENDERERS) as [keyof typeof RENDERERS, ...(keyof typeof RENDERERS)[]];
export type DiagramFamily = typeof DIAGRAM_FAMILIES[number];
const text = (max: number) => z.string().trim().min(1).max(max);
const id = z.string().regex(/^[A-Za-z0-9_-]{1,40}$/);
const coordinate = z.number().finite().min(0).max(2000);
/** One mark, with its mark-scheme code. A bracketed code such as "(B1)" is partial credit and is not counted. */
const markSchema = z.object({
  code: z.string().regex(/^(\([BMAPC][1-9]\)|[BMAPC][1-9])$/),
  note: text(90),
  /** Another route the mark scheme accepts, in one short line (decision 3, 16 November 2026). */
  also: text(110).optional(),
}).strict();
const beside = { mark: markSchema.optional(), note: text(140).optional() };
const relation = z.enum(["=", "<", ">", "≤", "≥", "≠", "≈"]);
/** A position on a surface: in its points, or in graph units when the drawing names a calibrated grid. */
const where = z.tuple([z.number().finite().min(-1e6).max(1e6), z.number().finite().min(-1e6).max(1e6)]);
const dashed = z.boolean().default(false);
const shape = z.discriminatedUnion("type", [
  z.object({ type: z.literal("line"), from: where, to: where, dashed }).strict(),
  z.object({ type: z.literal("path"), points: z.array(where).min(2).max(60), dashed }).strict(),
  /** A smooth curve through the points, in order: a plotted quadratic, a cumulative-frequency curve. */
  z.object({ type: z.literal("curve"), points: z.array(where).min(3).max(80), dashed }).strict(),
  z.object({ type: z.literal("cross"), at: where, label: text(8).optional() }).strict(),
  z.object({ type: z.literal("ring"), at: where, r: z.number().positive().max(40).default(5) }).strict(),
  z.object({ type: z.literal("label"), at: where, text: text(24), background: z.boolean().default(true) }).strict(),
  /** A compass arc about a centre; angles in degrees, anticlockwise from the right as on paper. */
  z.object({ type: z.literal("arc"), centre: where, radius: z.number().positive().max(1e6), from: z.number().min(-720).max(720), to: z.number().min(-720).max(720) }).strict()
    .refine(s => s.to !== s.from, { message: "An arc needs two different angles.", path: ["to"] }),
  /** A shaded region with its edges left as printed or drawn: the region a set of inequalities describes. */
  z.object({ type: z.literal("region"), points: z.array(where).min(3).max(60) }).strict(),
  /** A dashed reading line ending in an arrow: up from the axis to the curve, then across to the other axis. */
  z.object({ type: z.literal("reading"), points: z.array(where).min(2).max(3) }).strict(),
  /** A vector: a line with its arrowhead in the middle (as Edexcel draws them) or at the end. */
  z.object({ type: z.literal("vector"), from: where, to: where, head: z.enum(["middle", "end"]).default("middle") }).strict(),
  /** An angle marked at a vertex between two arms, with its size; a right angle draws its square. */
  z.object({ type: z.literal("angle"), at: where, from: where, to: where, label: text(12).optional(), right: z.boolean().default(false) }).strict(),
  /** Equal-length ticks or parallel arrows across the middle of a side. */
  z.object({ type: z.literal("ticks"), from: where, to: where, count: z.number().int().min(1).max(3).default(1), style: z.enum(["ticks", "arrows"]).default("ticks") }).strict(),
]);
/** One printed gridline: its position in the cut's points and the value it shows. */
const gridline = z.object({ at: coordinate, value: z.number().finite() }).strict();
const twoLines = z.tuple([gridline, gridline]).refine(([p, q]) => p.at !== q.at && p.value !== q.value, { message: "Use two different gridlines." });
/** A printed coordinate grid calibrated once, so drawings on it are given in its own units. */
const gridSchema = z.object({ id, on: id, x: twoLines, y: twoLines }).strict();
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
  z.object({ kind: z.literal("draw"), on: id,
    /** A calibrated grid on the same surface: every position below is then in its units. */
    grid: id.optional(),
    shapes: z.array(shape).min(1).max(30),
    /** Where the drawing's mark or note starts (its first baseline), beside the drawing; the guidance column when absent. */
    noteAt: where.optional(),
    ...beside }).strict(),
  /** The final answer, written on the part's answer line, box or table. */
  z.object({ kind: z.literal("answer"), value: text(90), at: z.number().int().min(0).max(5).default(0), mark: markSchema.optional(),
    /** Words on a full-width line start at its left; a value sits in the middle of its line. */
    align: z.enum(["centre", "left"]).default("centre"),
    /** Where the mark sits: just above the answer (the default), or after the end of its line, level with the answer. */
    markAt: z.enum(["above", "after"]).default("above") }).strict(),
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
  grids: z.array(gridSchema).max(12).default([]),
  parts: z.array(partSchema).min(1).max(12),
}).strict().superRefine((d, ctx) => {
  const ids = d.grids.map(g => g.id);
  ids.forEach((g, i) => { if (ids.indexOf(g) !== i) ctx.addIssue({ code: "custom", message: `There are two grids called ${g}.`, path: ["grids", i, "id"] }); });
  d.parts.forEach((p, i) => p.steps.forEach((s, j) => {
    if (s.kind !== "draw" || s.grid === undefined) return;
    const grid = d.grids.find(g => g.id === s.grid);
    if (!grid) ctx.addIssue({ code: "custom", message: `There is no grid called ${s.grid}.`, path: ["parts", i, "steps", j, "grid"] });
    else if (grid.on !== s.on) ctx.addIssue({ code: "custom", message: `Grid ${s.grid} is on ${grid.on}, not ${s.on}.`, path: ["parts", i, "steps", j, "grid"] });
  }));
});

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

type Piece = { kind: "run"; text: string; sup: boolean; under?: boolean; arrow?: boolean; dot?: boolean }
  | { kind: "fraction"; num: Piece[]; den: Piece[]; mixed?: boolean }
  | { kind: "column"; top: string; bottom: string }
  | { kind: "root"; body: Piece[]; index?: string }
  | { kind: "power"; sign: string; num: string; den: string };

/** The index of the bracket closing the one at i, or -1. */
const closing = (s: string, i: number, open: string, close: string) => {
  for (let j = i + 1, depth = 1; j < s.length; j++) { if (s[j] === open) depth++; else if (s[j] === close && --depth === 0) return j; }
  return -1;
};

/** The first "/" outside any nested braces, or -1: {√{a/b}/c} splits after the root. */
function topSlash(s: string): number {
  let depth = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "{") depth++;
    else if (s[i] === "}") depth--;
    else if (s[i] === "/" && depth === 0) return i;
  }
  return -1;
}

/**
 * Splits "{3/4}" stacked fractions and "^2" or "^{12}" powers out of a line, and the vector forms:
 * "_{a}" an underlined (handwritten bold) vector, "vec{AB}" an arrow over AB, "[3;-2]" a column vector,
 * and "dot{4}" a recurring-decimal dot over the 4 (0.2dot{4}dot{6} is 0.2464646...).
 * "sqrt{...}" is a square root with an overbar, and so is "√" before a number, a letter run, a braced
 * group or a bracketed group "(...)", whose brackets the overbar replaces. "∛" and "∜" (or "root{n}{...}")
 * are the same with a small index. A fractional power "^{2/3}" or "^{-1/2}" is a small stacked fraction.
 * A fraction's numerator and denominator are laid out as maths too, but flat: a fraction inside one stays inline.
 */
export function pieces(s: string, flat = false): Piece[] {
  const out: Piece[] = [];
  let run = "";
  const flush = () => { if (run) out.push({ kind: "run", text: run, sup: false }); run = ""; };
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    const rest = s.slice(i);
    const vector = /^(_|vec|dot)\{([^{}]+)\}/.exec(rest);
    if (vector) { flush(); out.push({ kind: "run", text: vector[2], sup: false, ...(vector[1] === "_" ? { under: true } : vector[1] === "dot" ? { dot: true } : { arrow: true }) }); i += vector[0].length - 1; continue; }
    const column = /^\[([^[\];]+);([^[\];]+)\]/.exec(rest);
    if (column) { flush(); out.push({ kind: "column", top: column[1].trim(), bottom: column[2].trim() }); i += column[0].length - 1; continue; }
    if (rest.startsWith("sqrt{")) {
      const end = closing(s, i + 4, "{", "}");
      if (end > i + 5) { flush(); out.push({ kind: "root", body: pieces(s.slice(i + 5, end), flat) }); i = end; continue; }
    }
    const nth = /^root\{([0-9a-z]+)\}\{/.exec(rest);
    if (nth) {
      const open = i + nth[0].length - 1, end = closing(s, open, "{", "}");
      if (end > open + 1) { flush(); out.push({ kind: "root", body: pieces(s.slice(open + 1, end), flat), index: nth[1] }); i = end; continue; }
    }
    if (c === "√" || c === "∛" || c === "∜") {
      const index = c === "∛" ? "3" : c === "∜" ? "4" : undefined;
      const next = s[i + 1];
      // A bracketed group loses its brackets under the overbar; a braced group is kept whole, so {a/b} stays a fraction.
      const end = next === "(" ? closing(s, i + 1, "(", ")") : next === "{" ? closing(s, i + 1, "{", "}") : -1;
      // A braced fraction keeps its braces so it stacks; any other braced group loses them.
      const body = end > i + 2 ? (next === "{" && topSlash(s.slice(i + 2, end)) > 0 ? s.slice(i + 1, end + 1) : s.slice(i + 2, end)) : undefined;
      const atom = body === undefined ? /^(?:[0-9]+(?:\.[0-9]+)?|[A-Za-z]+)/.exec(s.slice(i + 1))?.[0] : undefined;
      if (body !== undefined || atom) { flush(); out.push({ kind: "root", body: pieces(body ?? atom!, flat), ...(index ? { index } : {}) }); i = body !== undefined ? end : i + atom!.length; continue; }
    }
    if (c === "{") {
      // The matching brace, so a fraction may hold a braced power: {4/x^{2}}.
      const end = closing(s, i, "{", "}");
      const inner = end > i ? s.slice(i + 1, end) : "";
      const slash = topSlash(inner);
      if (end > i && slash > 0 && slash < inner.length - 1) {
        flush();
        if (flat) out.push(...pieces(inner, true));
        else {
          // A fraction straight after a whole number is a mixed number: it gets a small gap after the whole number.
          const last = out[out.length - 1];
          // Only a whole number standing on its own (not 0.5 or Q2), over a fraction of whole numbers.
          const top = inner.slice(0, slash).trim(), bottom = inner.slice(slash + 1).trim();
          const mixed = last?.kind === "run" && !last.sup && /(?:^|[\s(=+−×÷,:])\d+$/.test(last.text) && /^\d+$/.test(top) && /^\d+$/.test(bottom);
          out.push({ kind: "fraction", num: pieces(top, true), den: pieces(bottom, true), ...(mixed ? { mixed } : {}) });
        }
        i = end; continue;
      }
    }
    if (c === "^") {
      let power = "";
      if (s[i + 1] === "{") { const end = s.indexOf("}", i + 1); if (end > i) { power = s.slice(i + 2, end); i = end; } }
      else { const m = /^[−-]?[0-9a-zA-Z]+/.exec(s.slice(i + 1)); if (m) { power = m[0]; i += m[0].length; } }
      power = power.trim();
      // Inside a fraction a fractional power stays inline as raised text, like a fraction inside a fraction.
      const frac = flat ? null : /^([−-]?)\s*([^/{}\s]+)\s*\/\s*([^/{}\s]+)$/.exec(power);
      if (frac) { flush(); out.push({ kind: "power", sign: frac[1] ? "−" : "", num: frac[2], den: frac[3] }); continue; }
      if (power) { flush(); out.push({ kind: "run", text: power, sup: true }); continue; }
    }
    run += c;
  }
  flush();
  // Runs that meet (after a flat fraction is unpacked) join, so a run is always as long as it can be.
  return out.reduce<Piece[]>((all, p) => {
    const last = all[all.length - 1];
    if (p.kind === "run" && last?.kind === "run" && !p.sup && !last.sup && !p.under && !last.under && !p.arrow && !last.arrow && !p.dot && !last.dot) all[all.length - 1] = { ...last, text: last.text + p.text };
    else all.push(p);
    return all;
  }, []);
}

const handWidth = (s: string, size: number) => Array.from(s).reduce((n, c) => n + handAdvance(c), 0) * size;
export const noteWidth = (s: string, size: number, bold = false) => Array.from(s).reduce((n, c) => n + interAdvance(c, bold ? "bold" : "regular"), 0) * size;

/** How far a row of pieces reaches above and below its baseline. */
const extent = (ps: Piece[], size: number): { up: number; down: number } => ps.reduce((e, p) => {
  const x = pieceExtent(p, size);
  return { up: Math.max(e.up, x.up), down: Math.max(e.down, x.down) };
}, { up: size * 0.72, down: size * 0.2 });
const pieceExtent = (p: Piece, size: number): { up: number; down: number } => {
  if (p.kind === "run") return { up: p.sup ? size * 0.9 : p.arrow ? size * 1.05 : p.dot ? size * 1.0 : size * 0.72, down: p.under ? size * 0.25 : size * 0.2 };
  if (p.kind === "column") return { up: size * 1.45, down: size * 0.95 };
  if (p.kind === "power") return { up: size * 1.4, down: size * 0.2 };
  if (p.kind === "fraction") return { up: size * 0.32 + numLift(p.num, size) + extent(p.num, size).up, down: denDrop(p.den, size) - size * 0.32 + extent(p.den, size).down };
  const body = extent(p.body, size);
  return { up: body.up + size * 0.22, down: body.down + size * 0.04 };
};
/** How far a numerator's baseline sits above the fraction bar: higher when a letter or bracket in it hangs below the line (p, q, y, brackets, commas) or a root's foot does. */
const numLift = (num: Piece[], size: number) => size * (num.some(q => (q.kind === "run" && /[gjpqyQ()[\],;]/.test(q.text) && !q.sup) || q.kind === "root") ? 0.34 : 0.22);
/** How far a denominator's baseline sits below the fraction bar: lower when a power or root in it reaches up. */
const denDrop = (den: Piece[], size: number) => Math.max(size * 0.95, extent(den, size).up + size * 0.2);
/** A root's radical sign: wider for a taller root, so its long stroke keeps the same slope. */
const radical = (p: Extract<Piece, { kind: "root" }>, size: number) => {
  const e = pieceExtent(p, size);
  const one = handWidth("3", size * 0.55), iw = p.index ? handWidth(p.index, size * 0.55) : 0;
  return { e, lead: size * 0.32 + (e.up + e.down) * 0.16 + (p.index ? one * 0.6 + Math.max(0, iw - one) : 0) };
};
const rowWidth = (ps: Piece[], size: number) => ps.reduce((n, p) => n + pieceWidth(p, size), 0);
const pieceWidth = (p: Piece, size: number): number => p.kind === "run" ? handWidth(p.text, p.sup ? size * 0.7 : size)
  : p.kind === "fraction" ? Math.max(rowWidth(p.num, size), rowWidth(p.den, size)) + size * (p.mixed ? 0.56 : 0.4)
  : p.kind === "root" ? radical(p, size).lead + rowWidth(p.body, size) + size * 0.12
  : p.kind === "power" ? powerWidth(p, size)
  : Math.max(handWidth(p.top, size), handWidth(p.bottom, size)) + size * 1.5;
/** A fractional power: its sign, then a small stacked fraction, raised like a power. */
const POWER_SIZE = 0.58;
const powerWidth = (p: Extract<Piece, { kind: "power" }>, size: number) => handWidth(p.sign, size * POWER_SIZE) + Math.max(handWidth(p.num, size * POWER_SIZE), handWidth(p.den, size * POWER_SIZE)) + size * 0.2;
export const mathsWidth = (s: string, size = HAND_SIZE) => rowWidth(pieces(s), size);
/** Fractions and column vectors stand two lines tall, so their line takes more room, and so does a root over one. */
const tall = (p: Piece): boolean => p.kind === "fraction" || p.kind === "column" || p.kind === "power" || (p.kind === "root" && p.body.some(tall));
const hasFraction = (s: string) => pieces(s).some(tall);
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const n = (v: number) => Number(v.toFixed(2));

/** Maths text placed with its start at x on baseline y, as SVG. */
function maths(s: string, x: number, y: number, size = HAND_SIZE, fill = INK): string {
  return row(pieces(s), x, y, size, fill);
}

/** A row of pieces placed with its start at x on baseline y. */
function row(ps: Piece[], x: number, y: number, size: number, fill: string): string {
  let cursor = x, out = "";
  for (const p of ps) {
    const w = pieceWidth(p, size);
    // Each run is held to its measured width, so a power or fraction after it lands where it was laid out.
    if (p.kind === "run") {
      out += `<text x="${n(cursor)}" y="${n(p.sup ? y - size * 0.4 : y)}" font-size="${n(p.sup ? size * 0.7 : size)}" fill="${fill}" xml:space="preserve"${p.text.trim().length > 1 ? ` textLength="${n(w)}" lengthAdjust="spacing"` : ""}>${esc(p.text)}</text>`;
      if (p.dot) out += `<circle cx="${n(cursor + w / 2)}" cy="${n(y - size * 0.92)}" r="${n(size * 0.085)}" fill="${fill}"/>`;
      if (p.under) out += `<path d="M${n(cursor + 0.5)} ${n(y + size * 0.2)}H${n(cursor + w - 0.5)}" stroke="${fill}" stroke-width="0.8" fill="none"/>`;
      if (p.arrow) {
        const top = y - size * 0.95, end = cursor + w - 0.5;
        out += `<path d="M${n(cursor + 0.5)} ${n(top)}H${n(end)}M${n(end - 3)} ${n(top - 2)}L${n(end)} ${n(top)}L${n(end - 3)} ${n(top + 2)}" stroke="${fill}" stroke-width="0.8" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`;
      }
    } else if (p.kind === "column") {
      const mid = cursor + w / 2, high = y - size * 1.45, low = y + size * 0.95, half = (high + low) / 2;
      const l = cursor + size * 0.4, r = cursor + w - size * 0.4;
      out += `<path d="M${n(l)} ${n(high)}Q${n(l - size * 0.28)} ${n(half)} ${n(l)} ${n(low)}M${n(r)} ${n(high)}Q${n(r + size * 0.28)} ${n(half)} ${n(r)} ${n(low)}" stroke="${fill}" stroke-width="0.9" fill="none"/>`
        + `<text x="${n(mid)}" y="${n(y - size * 0.54)}" font-size="${size}" fill="${fill}" text-anchor="middle">${esc(p.top)}</text>`
        + `<text x="${n(mid)}" y="${n(y + size * 0.63)}" font-size="${size}" fill="${fill}" text-anchor="middle">${esc(p.bottom)}</text>`;
    } else if (p.kind === "root") {
      // A small tick, a short stroke down to the foot, a long stroke up, then the overbar over the contents.
      const { e, lead } = radical(p, size), top = y - e.up, foot = y + e.down, h = foot - top;
      const tick = cursor + size * 0.04, toe = cursor + size * 0.32 - size * 0.12 + h * 0.06, head = cursor + lead;
      out += `<path class="wk-root" d="M${n(tick)} ${n(foot - h * 0.42)}L${n(tick + size * 0.12)} ${n(foot - h * 0.5)}L${n(toe)} ${n(foot)}L${n(head)} ${n(top)}H${n(cursor + w - size * 0.04)}" stroke="${fill}" stroke-width="0.9" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`
        + (p.index ? `<text x="${n(tick + size * 0.02)}" y="${n(foot - h * 0.5 - size * 0.12)}" font-size="${n(size * 0.55)}" fill="${fill}">${esc(p.index)}</text>` : "")
        + row(p.body, head + size * 0.04, y, size, fill);
    } else if (p.kind === "power") {
      const f = size * POWER_SIZE, sw = handWidth(p.sign, f), body = w - sw - size * 0.2, mid = cursor + size * 0.06 + sw + body / 2, bar = y - size * 0.78;
      out += (p.sign ? `<text x="${n(cursor + size * 0.06)}" y="${n(bar + f * 0.3)}" font-size="${n(f)}" fill="${fill}">${p.sign}</text>` : "")
        + `<text x="${n(mid)}" y="${n(bar - f * 0.22)}" font-size="${n(f)}" fill="${fill}" text-anchor="middle">${esc(p.num)}</text>`
        + `<path d="M${n(mid - body / 2 - 0.5)} ${n(bar)}H${n(mid + body / 2 + 0.5)}" stroke="${fill}" stroke-width="0.7" fill="none"/>`
        + `<text x="${n(mid)}" y="${n(bar + f * 0.88)}" font-size="${n(f)}" fill="${fill}" text-anchor="middle">${esc(p.den)}</text>`;
    } else {
      const bar = y - size * 0.32, nw = rowWidth(p.num, size), dw = rowWidth(p.den, size), gap = p.mixed ? size * 0.16 : 0, fw = w - gap, x0 = cursor + gap;
      out += row(p.num, x0 + (fw - nw) / 2, bar - numLift(p.num, size), size, fill)
        + `<path d="M${n(x0 + size * 0.1)} ${n(bar)}H${n(x0 + fw - size * 0.1)}" stroke="${fill}" stroke-width="0.9" fill="none"/>`
        + row(p.den, x0 + (fw - dw) / 2, bar + denDrop(p.den, size), size, fill);
    }
    cursor += w;
  }
  return out;
}

// ---------------------------------------------------------------- diagrams

/** Prefixes each selector with the overlay's own class. */
const scopeCss = (css: string) => css.replace(/(^|})\s*([^{}@]+)\{/g, (_, end: string, selectors: string) => `${end}${selectors.split(",").map(x => `.wk ${x.trim()}`).join(",")}{`);

const fnv = (s: string) => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193); return (h >>> 0).toString(36); };

/** A MathsDock diagram as SVG with its printed size in points. */
export function diagramSvg(family: DiagramFamily, envelope: unknown): { svg: string; width: number; height: number } {
  const svg = RENDERERS[family](envelope).replace(/^\s*<\?xml[^>]*\?>\s*/, "");
  const root = /^<svg\b[^>]*>/.exec(svg)?.[0] ?? "";
  const size = (name: string) => {
    const m = new RegExp(`${name}="([0-9.]+)(mm|cm)"`).exec(root);
    if (!m) throw new Error(`The ${family} drawing has no printed ${name}.`);
    return Number(m[1]) * (m[2] === "cm" ? 10 : 1) * MM;
  };
  const viewBox = /viewBox="([^"]+)"/.exec(root)?.[1];
  if (!viewBox) throw new Error(`The ${family} drawing has no viewBox.`);
  const inner = svg.slice(root.length).replace(/<\/svg>\s*$/, "").replace(/<title\b[^>]*>[\s\S]*?<\/title>|<desc\b[^>]*>[\s\S]*?<\/desc>/g, "")
    // A diagram's own style rules would reach the whole page once the overlay is in it: keep them inside.
    .replace(/<style>([\s\S]*?)<\/style>/g, (_, css: string) => `<style>${scopeCss(css)}</style>`);
  // Two drawings on one page must not share clip or marker ids: each gets its own prefix from its content.
  const prefix = `w${fnv(inner)}-`;
  const scoped = inner.replace(/\bid="([^"]+)"/g, `id="${prefix}$1"`).replace(/url\(#([^)]+)\)/g, `url(#${prefix}$1)`).replace(/href="#([^"]+)"/g, `href="#${prefix}$1"`)
    .replace(/aria-labelledby="[^"]*"/g, "");
  return { svg: `<svg viewBox="${viewBox}" overflow="visible">${scoped}</svg>`, width: size("width"), height: size("height") };
}

// ---------------------------------------------------------------- drawings

type Grid = WorkedData["grids"][number];
type Shape = Extract<WorkedStep, { kind: "draw" }>["shapes"][number];
type Pt = readonly [number, number];

/** Graph units to the cut's points for a calibrated grid; positions are points already without one. */
export function toPoints(grid: Grid | undefined): (p: Pt) => [number, number] {
  if (!grid) return p => [p[0], p[1]];
  const axis = ([p, q]: Grid["x"]) => (v: number) => p.at + (v - p.value) * (q.at - p.at) / (q.value - p.value);
  const x = axis(grid.x), y = axis(grid.y);
  return p => [x(p[0]), y(p[1])];
}

// Dash, arrowheads and curves are shared with the graph tools (graph-core), so a worked solution
// draws them exactly as the graph family does.
const DASH = `stroke-dasharray="${WORKING_DASH_POINTS.join(" ")}"`;
const stroke = (d: string, width = 1.1, extra = "") => `<path d="${d}" stroke="${INK}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" fill="none"${extra ? ` ${extra}` : ""}/>`;
const pt = (p: Pt) => `${n(p[0])} ${n(p[1])}`;
const unit = (from: Pt, to: Pt): [number, number] => { const dx = to[0] - from[0], dy = to[1] - from[1], l = Math.hypot(dx, dy) || 1; return [dx / l, dy / l]; };
const xy = (p: Pt) => ({ x: p[0], y: p[1] });
const head = (from: Pt, to: Pt, position: "end" | "middle", size: { length: number; halfWidth: number }) =>
  `<path d="${arrowheadPath(xy(from), xy(to), position, size.length, size.halfWidth)}" fill="${INK}" stroke="none"/>`;
const smooth = (p: Pt[]) => smoothCurvePath(p.map(xy));

/** A drawing's SVG in the cut's points, with every point it reaches and the boxes of its labels. */
export function drawShapes(shapes: Shape[], place: (p: Pt) => [number, number]) {
  let svg = "";
  const points: [number, number][] = [], boxes: Box[] = [];
  const at = (p: Pt) => { const q = place(p); points.push(q); return q; };
  const text = (t: string, x: number, y: number, background: boolean, what = "drawing label") => {
    const s = mathsText(t), w = mathsWidth(s, 11);
    boxes.push({ x: x - 2, y: y - 11, width: w + 4, height: 14, what });
    points.push([x + w, y]);
    return (background ? `<rect x="${n(x - 2)}" y="${n(y - 11)}" width="${n(w + 4)}" height="14" fill="#fff"/>` : "") + maths(s, x, y, 11);
  };
  for (const s of shapes) {
    switch (s.type) {
      case "line": svg += stroke(`M${pt(at(s.from))}L${pt(at(s.to))}`, 1.1, s.dashed ? DASH : ""); break;
      case "path": svg += stroke(`M${s.points.map(p => pt(at(p))).join("L")}`, 1, s.dashed ? DASH : ""); break;
      case "curve": svg += stroke(smooth(s.points.map(at)), 1, s.dashed ? DASH : ""); break;
      case "cross": {
        const c = at(s.at);
        svg += stroke(`M${n(c[0] - 3.5)} ${n(c[1] - 3.5)}l7 7M${n(c[0] + 3.5)} ${n(c[1] - 3.5)}l-7 7`);
        if (s.label) svg += `<text x="${n(c[0] - 7)}" y="${n(c[1] - 5)}" font-size="${HAND_SIZE}" fill="${INK}" text-anchor="end">${esc(mathsText(s.label))}</text>`;
        break;
      }
      case "ring": { const c = at(s.at); svg += `<circle cx="${n(c[0])}" cy="${n(c[1])}" r="${n(s.r)}" stroke="${INK}" stroke-width="1" fill="none"/>`; break; }
      case "label": { const c = at(s.at); svg += text(s.text, c[0], c[1], s.background); break; }
      case "arc": {
        // A compass arc is a circle on the paper: its radius is in the grid's x units (or points), and
        // it turns anticlockwise as seen on paper whichever way the grid's values run.
        const c = place(s.centre), r = Math.abs(place([s.centre[0] + s.radius, s.centre[1]])[0] - c[0]);
        const steps = Math.max(8, Math.ceil(Math.abs(s.to - s.from) / 3));
        const p: Pt[] = [];
        for (let i = 0; i <= steps; i++) { const t = (s.from + (s.to - s.from) * i / steps) * Math.PI / 180; const q: [number, number] = [c[0] + r * Math.cos(t), c[1] - r * Math.sin(t)]; points.push(q); p.push(q); }
        svg += stroke(`M${p.map(pt).join("L")}`, 0.8);
        break;
      }
      case "region": svg += `<path d="M${s.points.map(p => pt(at(p))).join("L")}Z" fill="${INK}" fill-opacity="0.15" stroke="none"/>`; break;
      case "reading": {
        const p = s.points.map(at);
        svg += stroke(`M${p.map(pt).join("L")}`, 0.9, DASH) + head(p[p.length - 2], p[p.length - 1], "end", READING_ARROWHEAD_POINTS);
        break;
      }
      case "vector": {
        const a = at(s.from), b = at(s.to);
        svg += stroke(`M${pt(a)}L${pt(b)}`) + head(a, b, s.head, VECTOR_ARROWHEAD_POINTS);
        break;
      }
      case "angle": {
        const v = at(s.at), p = place(s.from), q = place(s.to), u = unit(v, p), w = unit(v, q);
        if (s.right) svg += stroke(`M${pt([v[0] + u[0] * 7, v[1] + u[1] * 7])}l${n(w[0] * 7)} ${n(w[1] * 7)}l${n(-u[0] * 7)} ${n(-u[1] * 7)}`, 0.8);
        else svg += stroke(`M${pt([v[0] + u[0] * 11, v[1] + u[1] * 11])}A11 11 0 0 ${u[0] * w[1] - u[1] * w[0] > 0 ? 1 : 0} ${pt([v[0] + w[0] * 11, v[1] + w[1] * 11])}`, 0.8);
        if (s.label) {
          // A straight angle has no bisector between its arms: the label goes on the side its arc bulges.
          const m = Math.hypot(u[0] + w[0], u[1] + w[1]) < 1e-6 ? [u[1], -u[0]] : unit([0, 0], [u[0] + w[0], u[1] + w[1]]), t = mathsText(s.label), width = mathsWidth(t, 11);
          // Centred on the bisector, just clear of the arc whichever way the bisector points.
          const r = 13 + Math.hypot(width / 2 + 2, 7);
          svg += text(s.label, v[0] + m[0] * r - width / 2, v[1] + m[1] * r + 4, false, "angle label");
        }
        break;
      }
      case "ticks": {
        const a = at(s.from), b = at(s.to), u = unit(a, b), nrm: Pt = [-u[1], u[0]], m: Pt = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
        let d = "";
        for (let i = 0; i < s.count; i++) {
          const o = (i - (s.count - 1) / 2) * (s.style === "ticks" ? 3 : 4), c: Pt = [m[0] + u[0] * o, m[1] + u[1] * o];
          d += s.style === "ticks"
            ? `M${pt([c[0] - nrm[0] * 4, c[1] - nrm[1] * 4])}L${pt([c[0] + nrm[0] * 4, c[1] + nrm[1] * 4])}`
            : `M${pt([c[0] - u[0] * 3 + nrm[0] * 3, c[1] - u[1] * 3 + nrm[1] * 3])}L${pt(c)}L${pt([c[0] - u[0] * 3 - nrm[0] * 3, c[1] - u[1] * 3 - nrm[1] * 3])}`;
        }
        svg += stroke(d, 0.9);
        break;
      }
    }
  }
  return { svg, points, boxes };
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
  // A stacked fraction with spaces inside, {x + 1/2}, stays one word.
  const words = s.match(/(?:[^\s{]|\{[^{}]*\}?)+/g) ?? [], lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (line && guideWidth(next, size) > width) { lines.push(line); line = word; } else line = next;
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
 * Guidance is plain words in the interface font, so it gets light typesetting instead of the working's
 * maths layout: ^2 and ^3 as raised digits (other powers are raised by noteMarkup), a hyphen used as a minus sign as a true minus.
 */
export function noteText(s: string): string {
  return s.replace(/\^2(?![\d.])/g, "²").replace(/\^3(?![\d.])/g, "³")
    .replace(/(^|[\s(=×÷+,{])-(?=[\d.(a-zA-Zπ√{])/g, "$1−").replace(/((?:^|[\s(=])(?:\d[\d.]*[a-zA-Z]?|[a-zA-Z])|[)²³]) - (?=[\d(√π{]|[a-zA-Z](?![a-zA-Z]))/g, "$1 − ");
}

const GUIDE_FRACTION = /(?<!\^)\{([^{}/]+)\/([^{}/]+)\}/g;
/** Guidance may hold stacked fractions, {1/2}: smaller figures over and under a short bar. */
const guideFraction = (num: string, den: string, size: number) => Math.max(noteWidth(num, size), noteWidth(den, size)) + 4;
/** The width of a line of guidance as drawn, fractions included. */
export const guideWidth = (s: string, size: number, bold = false) => {
  let w = 0, last = 0;
  for (const m of s.matchAll(GUIDE_FRACTION)) { w += noteWidth(s.slice(last, m.index), size, bold) + guideFraction(m[1], m[2], size); last = m.index + m[0].length; }
  return w + noteWidth(s.slice(last), size, bold);
};
/** A line of guidance holding a stacked fraction stands taller, so it takes extra room above and below. */
const FRACTION_ROOM = 7;
const guideTall = (s: string) => /(?<!\^)\{[^{}/]+\/[^{}/]+\}/.test(s);

/** One line of guidance at x on baseline y, as SVG text: stacked fractions placed by measure between the words. */
function noteLine(line: string, x: number, y: number, size: number, attrs = "", prefix = ""): string {
  const text = (body: string, at: number) => `<text x="${n(at)}" y="${n(y)}" font-size="${size}" fill="${PINK}"${attrs} xml:space="preserve">${body}</text>`;
  // A bold prefix such as "Watch out:" opens the line; the words after it start where it ends.
  const lead = prefix ? `<tspan font-weight="700">${esc(prefix)}</tspan>` : "";
  if (!guideTall(line)) return text(lead + noteMarkup(line), x);
  let out = "", cursor = x, last = 0, first = true;
  const small = n(size), bar = y - size * 0.33;
  for (const m of line.matchAll(GUIDE_FRACTION)) {
    const words = line.slice(last, m.index);
    if (words || (first && lead)) out += text((first ? lead : "") + noteMarkup(words), cursor);
    cursor += noteWidth(words, size) + (first && prefix ? noteWidth(prefix, size, true) : 0); first = false;
    const w = guideFraction(m[1], m[2], size), mid = cursor + w / 2;
    out += `<text x="${n(mid)}" y="${n(bar - 2)}" font-size="${small}" fill="${PINK}"${attrs} text-anchor="middle">${noteMarkup(m[1].trim())}</text>`
      + `<path d="M${n(cursor + 1)} ${n(bar)}H${n(cursor + w - 1)}" stroke="${PINK}" stroke-width="0.75" fill="none"${attrs}/>`
      + `<text x="${n(mid)}" y="${n(bar + size * 0.98)}" font-size="${small}" fill="${PINK}"${attrs} text-anchor="middle">${noteMarkup(m[2].trim())}</text>`;
    cursor += w; last = m.index + m[0].length;
  }
  if (last < line.length) out += text(noteMarkup(line.slice(last)), cursor);
  return out;
}

/** One escaped line of guidance, with any remaining power such as ^24 or ^-3 raised and smaller. */
export function noteMarkup(line: string): string {
  return esc(line).replace(/\^\{([^{}]+)\}|\^(−?-?\d+)/g, (_, braced: string | undefined, digits: string | undefined) => { const p = braced ?? digits ?? ""; return `<tspan dy="-3.5" font-size="7">${p.replaceAll("-", "−")}</tspan><tspan dy="3.5">\u200b</tspan>`; });
}

/** Guidance at x with its first baseline at y, wrapped to width: a mark chip and words, an "Also scores" line, a note. */
function guidance(x: number, y0: number, width: number, rawMark: WorkedMark | undefined, rawNote: string | undefined, watch: boolean, marks: boolean) {
  const mark = rawMark && { ...rawMark, note: noteText(rawMark.note), ...(rawMark.also ? { also: noteText(rawMark.also) } : {}) };
  const note = rawNote === undefined ? undefined : noteText(rawNote);
  let y = y0, svg = "", used = 0, top = y0 - NOTE_SIZE, tall = false;
  // A line with a stacked fraction takes extra room above and below it.
  const advance = (step: number, line: string, first: boolean) => {
    if (guideTall(line)) { if (first && !svg) top -= FRACTION_ROOM; else y += FRACTION_ROOM; }
    if (!first) y += step + (tall ? FRACTION_ROOM : 0);
    tall = guideTall(line);
  };
  if (mark) {
    const chipWidth = noteWidth(mark.code, 9, true) + 8;
    const words = wrap(mark.note, width - chipWidth - 5, NOTE_SIZE);
    // The words keep their place without the chip, so guidance never jumps when the switch changes.
    words.forEach((l, i) => { advance(NOTE_LEADING, l, i === 0); used = Math.max(used, chipWidth + 5 + guideWidth(l, NOTE_SIZE)); if (i === 0) svg += chip(mark.code, x, y); svg += noteLine(l, x + chipWidth + 5, y, NOTE_SIZE); });
    // Its room is kept without the mark notes too, so the layout is the same either way.
    if (mark.also) for (const l of wrap(`Also scores: ${mark.also}`, width - chipWidth - 5, 9)) { advance(12, l, false); used = Math.max(used, chipWidth + 5 + guideWidth(l, 9)); if (marks) svg += noteLine(l, x + chipWidth + 5, y, 9, ` class="wk-mark" font-style="italic"`); }
  }
  if (note) {
    const prefix = watch ? "Watch out:" : "";
    wrap(prefix ? `${prefix} ${note}` : note, width, NOTE_SIZE).forEach((l, i) => {
      advance(NOTE_LEADING, l, i === 0 && !mark);
      const bold = i === 0 && prefix;
      used = Math.max(used, guideWidth(l, NOTE_SIZE) + (bold ? 4 : 0));
      svg += noteLine(bold ? l.slice(prefix.length) : l, x, y, NOTE_SIZE, "", bold ? prefix : "");
    });
  }
  const bottom = y + 3 + (tall ? FRACTION_ROOM : 0);
  return { svg, bottom, box: { x, y: top, width: Math.min(used + 2, width), height: bottom - top, what: "guidance" } satisfies Box };
}

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
    let cursor = a.y, noteBottom = 0, answerClear = 0;
    let last: { lhsCentre: number; rhsCentre: number } | undefined;
    const later: (() => void)[] = [];

    // Guidance starts just after the working it belongs to, so it is plain what earns each mark (Tim,
    // 16 Nov 2026). It falls back to the guidance column when the line is long or the note has had to
    // move down below an earlier one.
    let noteX = 0;
    const placeNote = (k: number, baseline: number, mark: WorkedMark | undefined, note: string | undefined, watch = false, beside?: number) => {
      if (!mark && !note) return false;
      const y = Math.max(baseline, noteBottom + NOTE_LEADING);
      // Close beside its line only when the words fit on that one line; longer guidance would run
      // down past the working below it.
      const near = beside !== undefined && y <= baseline + 0.5 ? Math.min(part.notesX, beside + NOTE_GAP) : part.notesX;
      const oneLine = (from: number) => {
        const room = d.surface.width - from - 4;
        if (mark && note) return false;
        const words = room - noteWidth(mark?.code ?? "", 9, true) - 13;
        // Measured as guidance() draws it: after typesetting.
        if (mark) return wrap(noteText(mark.note), words, NOTE_SIZE).length === 1 && (!mark.also || wrap(`Also scores: ${noteText(mark.also)}`, words, 9).length === 1);
        return wrap(noteText(watch ? `Watch out: ${note}` : note ?? ""), room, NOTE_SIZE).length === 1;
      };
      const x = near < part.notesX && oneLine(near) ? near : part.notesX;
      const g = guidance(x, y, d.surface.width - x - 4, mark, note, watch, marks);
      noteBottom = g.bottom;
      noteX = x;
      emit(d, k, `<g ${UI}>${g.svg}</g>`, a.y, [g.box]);
      return x < part.notesX;
    };
    // Close guidance with an "Also scores" line under it: the next working moves down only if it
    // would reach under that line.
    let pending: { x: number; bottom: number } | undefined;
    const clearOf = (close: boolean) => { pending = close ? { x: noteX, bottom: noteBottom } : undefined; };
    const clearFor = (right: number) => { if (pending && right + 2 > pending.x) cursor = Math.max(cursor, pending.bottom - 3); pending = undefined; };
    const work = (k: number, svg: string, box: Omit<Box, "what">, what = "working") => emit(d, k, `<g ${HAND}>${svg}</g>`, a.y, [{ ...box, what }]);

    for (const step of part.steps) {
      const k = ++stepNumber;
      // A bubble row with no line above it draws nothing, so step by step skips it (the checks report it).
      if (!(step.kind === "bubbles" && !last)) shownSteps.push(k);
      switch (step.kind) {
        case "line": {
          const lhs = mathsText(step.lhs), rhs = mathsText(step.rhs);
          const h = hasFraction(lhs) || hasFraction(rhs) ? FRACTION_LINE : LINE;
          const lw = mathsWidth(lhs), rw = mathsWidth(rhs);
          clearFor(eq + 8 + rw);
          const y = cursor + h * 0.68;
          work(k, maths(lhs, eq - 8 - lw, y) + `<text x="${n(eq)}" y="${n(y)}" font-size="${HAND_SIZE}" fill="${INK}" text-anchor="middle">${esc(step.rel)}</text>` + maths(rhs, eq + 8, y),
            { x: eq - 8 - lw, y: y - HAND_SIZE, width: lw + rw + 16, height: HAND_SIZE * 1.3 });
          last = { lhsCentre: eq - 8 - mathsWidth(lastTerm(lhs)) / 2, rhsCentre: eq + 8 + rw / 2 };
          const close = placeNote(k, y, step.mark, step.note, false, eq + 8 + rw);
          cursor += h;
          clearOf(close);
          break;
        }
        case "text": case "carry": {
          const s = mathsText(step.text);
          const h = hasFraction(s) ? FRACTION_LINE : LINE, w = mathsWidth(s);
          clearFor(a.x + w + (step.kind === "carry" ? noteWidth(`from ${step.from}`, 9, true) + 22 : 0));
          const y = cursor + h * 0.68;
          let svg = maths(s, a.x, y), tagWidth = 0;
          if (step.kind === "carry") {
            const tag = `from ${step.from}`;
            tagWidth = noteWidth(tag, 9, true) + 12;
            svg += `<g ${UI}><rect x="${n(a.x + w + 10)}" y="${n(y - 10)}" width="${n(tagWidth)}" height="14" rx="7" fill="#eef3fa" stroke="#9fb3cc" stroke-width="0.6"/><text x="${n(a.x + w + 16)}" y="${n(y)}" font-size="9" font-weight="600" fill="${CARRY_INK}">${esc(tag)}</text></g>`;
          }
          work(k, svg, { x: a.x, y: y - HAND_SIZE, width: w + (tagWidth ? tagWidth + 10 : 0), height: HAND_SIZE * 1.3 });
          const close = step.kind === "text" && placeNote(k, y, step.mark, step.note, false, a.x + w);
          last = undefined;
          cursor += h;
          clearOf(close);
          break;
        }
        case "bubbles": {
          if (!last) { issues.push({ surface: part.on, message: `Step ${k}: bubbles need an equation or inequality line above them.` }); break; }
          // Bubble text is laid out like the working (stacked fractions, powers); a fraction makes both bubbles taller.
          const tall = hasFraction(mathsText(step.lhs)) || hasFraction(mathsText(step.rhs));
          const ry = tall ? 15 : 9.5, row = tall ? BUBBLE_ROW + 12 : BUBBLE_ROW;
          const radius = (t: string) => Math.max(15, mathsWidth(mathsText(t), 10.5) / 2 + 7);
          const bubble = (cx: number, rx: number, t: string) => {
            const m = mathsText(t), w = mathsWidth(m, 10.5);
            return `<ellipse cx="${n(cx)}" cy="${n(cy)}" rx="${n(rx)}" ry="${ry}" fill="none" stroke="${INK}" stroke-width="0.9"/>` + maths(m, cx - w / 2, cy + 3.8, 10.5);
          };
          const lr = radius(step.lhs), rr = radius(step.rhs);
          // Each bubble sits under its term; short sides would make them touch, so the right one moves over.
          const lx = Math.max(a.x + lr, last.lhsCentre), rx = Math.max(last.rhsCentre, lx + lr + rr + 8);
          clearFor(rx + rr);
          const cy = cursor + row / 2;
          work(k, bubble(lx, lr, step.lhs) + bubble(rx, rr, step.rhs), { x: lx - lr, y: cy - ry, width: rx + rr - (lx - lr), height: ry * 2 });
          cursor += row;
          break;
        }
        case "diagram": {
          const dg = diagramSvg(step.family, step.envelope);
          clearFor(a.x + dg.width);
          const top = cursor + 4;
          work(k, dg.svg.replace("<svg ", `<svg x="${n(a.x)}" y="${n(top)}" width="${n(dg.width)}" height="${n(dg.height)}" `), { x: a.x, y: top, width: dg.width, height: dg.height }, "diagram");
          const close = placeNote(k, top + 12, step.mark, step.note, false, a.x + dg.width);
          last = undefined;
          cursor = top + dg.height + 6;
          clearOf(close);
          break;
        }
        case "note":
          placeNote(k, cursor + LINE * 0.68, undefined, step.text, step.watch);
          break;
        case "draw": {
          const target = draft(step.on);
          if (!target) { issues.push({ surface: part.on, message: `Step ${k}: no cut called ${step.on} is shown.` }); break; }
          const grid = step.grid === undefined ? undefined : data.grids.find(g => g.id === step.grid);
          const place = toPoints(grid);
          const shapes = step.shapes;
          const drawn = drawShapes(shapes, place);
          const outside = drawn.points.some(([x, y]) => x < -0.5 || y < -0.5 || x > target.surface.width + 0.5 || y > target.surface.height + 0.5);
          if (outside) issues.push({ surface: step.on, message: `Step ${k}: the drawing goes outside the cut.` });
          const beside = step.noteAt && (step.mark || step.note) ? place(step.noteAt) : undefined;
          // Drawn after every part, so the target's own added room is known.
          later.push(() => {
            const g = beside && guidance(beside[0], beside[1], target.surface.width - beside[0] - 4, step.mark, step.note, false, marks);
            // The guidance beside a drawing moves with it as one piece.
            const ys = [...drawn.points.map(p => p[1]), ...(g ? [g.box.y, g.box.y + g.box.height] : [])];
            const top = Math.min(...ys), low = Math.max(...ys);
            // A drawing moves as one piece, so added room must not split it from its graph.
            if (target.bands.some(b => b.at > top + 0.5 && b.at < low - 0.5)) issues.push({ surface: step.on, message: `Step ${k}: room added inside the cut would split this drawing.` });
            emit(target, k, `<g ${HAND}>${drawn.svg}</g>`, top, drawn.boxes);
            // Guidance beside the drawing moves with it (Tim, 16 Nov 2026: marks close to what earns them).
            if (g) {
              emit(target, k, `<g ${UI}>${g.svg}</g>`, top, [g.box]);
            }
          });
          if (!beside) placeNote(k, cursor + LINE * 0.68, step.mark, step.note);
          break;
        }
        case "answer": {
          const anchor = part.answers[step.at];
          if (!anchor) { issues.push({ surface: part.on, message: `Step ${k}: the part has no answer line ${step.at + 1}.` }); break; }
          const value = mathsText(step.value), w = mathsWidth(value), mark = step.mark && { ...step.mark, note: noteText(step.mark.note), ...(step.mark.also ? { also: noteText(step.mark.also) } : {}) };
          if (w > anchor.width) issues.push({ surface: part.on, message: `Step ${k}: the answer is longer than its answer line.` });
          const lift = hasFraction(value) ? 10 : 0, base = anchor.y - 3 - lift;
          const left = step.align === "left" ? anchor.x + 6 : anchor.x + anchor.width / 2 - w / 2;
          let svg = `<g ${HAND}>${maths(value, left, base)}</g>`;
          const boxes: Box[] = [{ x: left, y: base - HAND_SIZE, width: w, height: HAND_SIZE * 1.2 + lift, what: "answer" }];
          if (mark) {
            const chipWidth = noteWidth(mark.code, 9, true) + 8, also = mark.also ? `Also scores: ${mark.also}` : "";
            const words = Math.max(guideWidth(mark.note, NOTE_SIZE), also ? guideWidth(also, 9) : 0) + chipWidth + 5;
            // A fraction in the words or the Also line lifts them clear of each other and of the answer.
            const noteRoom = guideTall(mark.note) ? FRACTION_ROOM : 0, alsoRoom = also && guideTall(also) ? FRACTION_ROOM : 0;
            // An "Also scores" line sits under the mark's words, just above the answer; its room is kept without the mark notes.
            // "after" keeps a mark on a later answer line off the dotted line above it.
            // On a full-width line it sits at the line's right end, level with the answer and clear of the
            // dotted line below, with any Also line above it; the overlap check reports a clash with the answer.
            const after = step.markAt === "after";
            const x = after ? Math.min(anchor.x + anchor.width + 6, d.surface.width - words - 2) : Math.min(anchor.x + anchor.width - words, d.surface.width - words - 2);
            const y = after ? base - 2 - noteRoom : base - HAND_SIZE - 7 - (also ? 12 : 0) - noteRoom - alsoRoom * 2;
            const alsoY = after ? y - 12 - noteRoom - alsoRoom : y + 11 + noteRoom + alsoRoom;
            svg += `<g ${UI}>${chip(mark.code, x, y)}${noteLine(mark.note, x + chipWidth + 5, y, NOTE_SIZE)}`
              + (also && marks ? noteLine(also, x + chipWidth + 5, alsoY, 9, ` class="wk-mark" font-style="italic"`) : "") + `</g>`;
            const boxTop = after && also ? alsoY - 10 - alsoRoom : y - 10 - noteRoom, boxBottom = after ? y + 3 + noteRoom : also ? alsoY + 3 + alsoRoom : y + 3 + noteRoom;
            boxes.push({ x, y: boxTop, width: words, height: boxBottom - boxTop, what: "answer guidance" });
          }
          // The answer line sits below the working space, so it moves down with any room added there,
          // and room is added when guidance beside the last lines would reach its words.
          const top = Math.min(...boxes.map(b => b.y)), right = Math.max(...boxes.map(b => b.x + b.width));
          if (noteBottom && right > noteX && anchor.y > a.bottom) answerClear = Math.max(answerClear, noteBottom + 3 - top);
          emit(d, k, svg, anchor.y, boxes);
          break;
        }
      }
    }
    const bottom = Math.max(cursor, noteBottom);
    const room = Math.max(bottom > a.bottom + 0.5 ? bottom - a.bottom + 4 : 0, answerClear);
    if (room > 0) d.bands.push({ at: a.bottom, size: Math.ceil(room) });
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
      for (const w of words) if (/\{[^{}]*(_|vec)\{|\^\{[^{}]*_\{/.test(w)) problems.push(`"${w}" puts a vector inside a fraction or power; write {1/2}_{a}, not {_{a}/2}.`);
      if (/\bput\b/i.test(said)) problems.push(`"${said.trim()}" says "put"; the school says "substitute".`);
      if (/y\s*↓/.test(said)) problems.push(`"${said.trim()}" uses y ↓; movements are y ↑ with a negative number.`);
    }
  }
  // WS9: a value carried from an earlier part is that part's own answer, never a different one.
  for (const part of data.parts) for (const s of part.steps) {
    if (s.kind !== "carry") continue;
    // "from (a)" names part 13a of this question: the tag is written as the paper prints it.
    const printed = /^\((.+)\)$/.exec(s.from)?.[1];
    const source = data.parts.find(p => p !== part && p.parts.some(l => l === s.from || (printed !== undefined && l.replace(/^\d+/, "") === printed)));
    const values = source?.steps.filter(t => t.kind === "answer").map(t => mathsText((t as Extract<WorkedStep, { kind: "answer" }>).value)) ?? [];
    if (!source) problems.push(`"${s.text}" is carried from ${s.from}, which has no working.`);
    else if (values.length && !values.some(v => mathsText(s.text).includes(v))) problems.push(`"${s.text}" does not match the answer to ${s.from}.`);
  }
  const layout = layoutWorked(data, surfaces);
  for (const issue of layout.issues) problems.push(`${issue.surface}: ${issue.message}`);
  return [...new Set(problems)];
}
