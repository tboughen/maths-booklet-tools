import { z } from "zod";
import { envelopeSchema as chartEnvelope } from "../../chart-core/src/index";
import { envelopeSchema as treeEnvelope } from "../../probability-tree-core/src/index";

/**
 * A two-sided A3 worksheet, as Tim's finalised question sets describe it: each side has three
 * strand columns, each column holds titled question cards, and each card holds items.
 *
 * Text is plain Unicode with two marks only: **bold** and *italic*. Nothing is evaluated.
 * Answer states stay distinct: a table cell is supplied (printed), blank (an empty box for the
 * pupil) or hidden (an empty box whose saved answer prints only in the answers view).
 */
const text = (max: number) =>
  z
    .string()
    .max(max)
    .refine((s) => ![...s].some((c) => c.charCodeAt(0) < 32 || c === "<" || c === ">"), "Use ordinary text without markup.");

export const cellSchema = z
  .object({
    text: text(40),
    state: z.enum(["supplied", "blank", "hidden"]),
  })
  .strict();

export const diagramSchema = z.discriminatedUnion("tool", [
  z.object({ tool: z.literal("charts"), envelope: chartEnvelope }).strict(),
  z.object({ tool: z.literal("probability-tree"), envelope: treeEnvelope }).strict(),
]);

const answerLine = z
  .object({
    type: z.literal("answerLine"),
    /** Printed before the line, e.g. "x =" or "Class A:". */
    prefix: text(40).default(""),
    /** Printed after the line, e.g. "cm". */
    suffix: text(20).default(""),
    /** Saved answer: printed only in the answers view. */
    answer: text(60).default(""),
    /** Several short lines side by side on one row (e.g. three totals). */
    inline: z.boolean().default(false),
  })
  .strict();

const leafItems = [
  z.object({ type: z.literal("text"), text: text(600) }).strict(),
  z.object({ type: z.literal("info"), text: text(400) }).strict(),
  z.object({ type: z.literal("claim"), text: text(300) }).strict(),
  z.object({ type: z.literal("bullets"), items: z.array(text(200)).min(1).max(8) }).strict(),
  z
    .object({
      type: z.literal("table"),
      columns: z.array(text(40)).min(2).max(6),
      rows: z.array(z.array(cellSchema).min(2).max(6)).min(1).max(12),
    })
    .strict(),
  z
    .object({
      type: z.literal("choice"),
      /** circle: options on one row, pupil circles one. tick: one box per option, stacked. */
      mode: z.enum(["circle", "tick"]),
      options: z.array(text(120)).min(2).max(5),
      /** Index of the saved answer: marked only in the answers view. */
      answer: z.number().int().min(0).max(4).nullable().default(null),
    })
    .strict(),
  answerLine,
  z
    .object({
      type: z.literal("space"),
      /** working: blank room for calculations. drawing: open area for a sketch or chart. */
      kind: z.enum(["working", "drawing"]),
      heightMm: z.number().min(8).max(200),
    })
    .strict(),
  z.object({ type: z.literal("diagram"), diagram: diagramSchema }).strict(),
] as const;

export const leafSchema = z.discriminatedUnion("type", leafItems);
export const partSchema = z
  .object({
    type: z.literal("part"),
    text: text(400),
    items: z.array(leafSchema).max(8).default([]),
  })
  .strict();
export const itemSchema = z.discriminatedUnion("type", [...leafItems, partSchema]);

export const cardSchema = z
  .object({
    title: text(60),
    items: z.array(itemSchema).min(1).max(16),
  })
  .strict();

export const columnSchema = z
  .object({
    heading: text(40),
    cards: z.array(cardSchema).max(6),
  })
  .strict();

export const sideSchema = z
  .object({
    /** One line under the title on this side, e.g. "Use a ruler when drawing charts." */
    instruction: text(160).default(""),
    columns: z.array(columnSchema).length(3),
  })
  .strict();

export const resourceSchema = z
  .object({
    tool: z.literal("resource"),
    schemaVersion: z.literal(1),
    document: z
      .object({
        kind: z.literal("worksheet-a3"),
        title: text(80),
        /** Objective code such as SP2.08; may be empty. */
        code: text(16),
        objective: text(200),
        /** Year group or tier shown top right, e.g. "Year 8". */
        group: text(40).default(""),
        nameLine: z.boolean().default(true),
        sides: z.array(sideSchema).length(2),
      })
      .strict(),
  })
  .strict();

export type Resource = z.infer<typeof resourceSchema>;
export type ResourceDocument = Resource["document"];
export type Side = z.infer<typeof sideSchema>;
export type Card = z.infer<typeof cardSchema>;
export type Item = z.infer<typeof itemSchema>;
export type Leaf = z.infer<typeof leafSchema>;
export type Cell = z.infer<typeof cellSchema>;
export type Diagram = z.infer<typeof diagramSchema>;

export function validate(input: unknown): Resource {
  const r = resourceSchema.safeParse(input);
  if (!r.success) {
    const issue = r.error.issues[0];
    throw Error(`${issue.path.join(".") || "document"}: ${issue.message}`);
  }
  return r.data;
}
