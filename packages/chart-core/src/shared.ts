import { z } from "zod";
import { glyphAdvance } from "../../ratio-table-core/src/font-metrics";

/**
 * Values, text and drawing primitives shared by every kind of chart. They live apart from
 * index.ts so the kind renderers (pie.ts) can use them without an import cycle.
 */

/** What each pie sector prints: its category name, optionally with its angle or percentage. */
export const pieLabelChoices = ["name", "name-angle", "name-percent", "none"] as const;
export type PieLabels = (typeof pieLabelChoices)[number];
export const pieLabelNames: Record<PieLabels, string> = {
  name: "Category names",
  "name-angle": "Names and angles",
  "name-percent": "Names and percentages",
  none: "No labels",
};
export const PIE_RADIUS = { minimum: 25, maximum: 70, standard: 40 } as const;
export const pieSchema = z
  .object({
    radiusMm: z.number().int().min(PIE_RADIUS.minimum).max(PIE_RADIUS.maximum),
    labels: z.enum(pieLabelChoices),
  })
  .strict();
export type PieSettings = z.infer<typeof pieSchema>;
/** The pie settings used when a document has none saved. */
export const PIE_DEFAULTS: PieSettings = { radiusMm: PIE_RADIUS.standard, labels: "name" };
export const pieOf = (d: { pie?: PieSettings }): PieSettings => d.pie ?? PIE_DEFAULTS;

/** Pictogram symbols. Parts are exact: a sector of a circle, or the left part of a square drawn
 * open on its right, as Edexcel prints them. */
export const symbolChoices = ["circle", "square"] as const;
export type PictogramSymbol = (typeof symbolChoices)[number];
export const symbolNames: Record<PictogramSymbol, string> = { circle: "Circle", square: "Square" };
export const SYMBOL_MM = { minimum: 6, maximum: 14, standard: 10 } as const;
export const MAX_SYMBOLS = 20;
export const pictogramSchema = z
  .object({
    symbol: z.enum(symbolChoices),
    symbolMm: z.number().int().min(SYMBOL_MM.minimum).max(SYMBOL_MM.maximum),
    /** What one whole symbol represents. Hidden leaves an answer line in the key for pupils. */
    key: z.object({ value: z.string().max(12), show: z.enum(["show", "hidden"]) }).strict(),
    /** Printed after the key value: "represents 8 pictures". */
    unit: z
      .string()
      .max(24)
      .refine((s) => ![...s].some((c) => c.charCodeAt(0) < 32 || c === "<" || c === ">"), "Use ordinary text without markup."),
  })
  .strict();
export type PictogramSettings = z.infer<typeof pictogramSchema>;
/** The pictogram settings used when a document has none saved. */
export const PICTOGRAM_DEFAULTS: PictogramSettings = { symbol: "circle", symbolMm: SYMBOL_MM.standard, key: { value: "4", show: "show" }, unit: "" };
export const pictogramOf = (d: { pictogram?: PictogramSettings }): PictogramSettings => d.pictogram ?? PICTOGRAM_DEFAULTS;

/** Cells an answer view draws only because they were saved hidden. */
const REVEALED = new WeakSet<object>();
export const markRevealed = (c: object) => void REVEALED.add(c);
export const revealed = (c: object) => REVEALED.has(c);
/** Pictogram keys an answer view shows only because they were saved hidden, marked or not, so
 * both copies keep the key's answer-line width. */
const WAS_HIDDEN = new WeakSet<object>();
export const markWasHidden = (c: object) => void WAS_HIDDEN.add(c);
export const wasHidden = (c: object) => WAS_HIDDEN.has(c);
/** The house answer colour, as on graphs, ratio tables, trees and worksheet answer lines. */
export const CHART_ANSWER_COLOUR = "#b0125b";

const NUMBER = /^-?\d{1,9}(\.\d{1,4})?$/;
export function readNumber(text: string): number | null {
  const t = text.trim().replace("−", "-");
  return NUMBER.test(t) ? Number(t) : null;
}
export function formatNumber(n: number) {
  const text = String(Math.round(n * 1e6) / 1e6);
  return text.startsWith("-") ? "−" + text.slice(1) : text;
}

export const FONT = (11 * 25.4) / 72;
export const MARGIN = 2;
export const textWidth = (text: string, font = FONT) =>
  [...text].reduce((n, c) => n + glyphAdvance(c), 0) * font;

export const n = (v: number) => String(Math.round(v * 1000) / 1000);
export const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
export const text = (t: string, x: number, y: number, anchor = "middle", fill = "black") =>
  `<text x="${n(x)}" y="${n(y)}" text-anchor="${anchor}" font-family="STIX Two Text,STIX Two Math,serif" font-size="${n(FONT)}" fill="${fill}">${esc(t)}</text>`;
