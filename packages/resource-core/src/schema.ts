import { z } from "zod";
import { FAMILIES, describeIssues, diagramKindSchema, type DiagramKind } from "../../diagram-core/src/registry";

/**
 * A two-sided A3 worksheet, as Tim's finalised question sets describe it: each side has three
 * strand columns, each column holds titled question cards, and each card holds items.
 *
 * Text is plain Unicode with two marks only: **bold** and *italic*. Nothing is evaluated.
 * Answer states stay distinct: a table cell is supplied (printed), blank (an empty box for the
 * pupil) or hidden (an empty box whose saved answer prints only in the answers view).
 */
export const text = (max: number) =>
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

/**
 * A diagram from any registered family (packages/diagram-core). Supply the family's envelope (a
 * saved source.json or an envelope the connector returned) or a spec, which is built into an
 * envelope with that family's own create rules. Saved worksheets always hold the envelope.
 */
const diagramInput = z
  .object({
    tool: diagramKindSchema.describe("Diagram family, as diagram_capabilities lists them."),
    envelope: z.record(z.string(), z.unknown()).optional().describe("The family's complete envelope, unchanged."),
    spec: z.record(z.string(), z.unknown()).optional().describe("Or the family's create spec; it is built into an envelope. Give spec or envelope, not both."),
  })
  .strict();
/** The family's envelope for a diagram item, built from its spec when it has no envelope yet. */
export function diagramEnvelope(d: { tool: DiagramKind; envelope?: unknown; spec?: unknown }): unknown {
  const f = FAMILIES[d.tool];
  const envelope = d.envelope !== undefined ? f.validate(d.envelope, "pupil") : f.create({ spec: d.spec });
  // The answers copy must print too.
  if (f.answerView) f.validate(envelope, "answer");
  return envelope;
}
// A refinement, not a transform, so the schema still converts to JSON Schema for tool inputs.
export const diagramSchema = diagramInput.superRefine((d, ctx) => {
  if ((d.envelope === undefined) === (d.spec === undefined)) {
    ctx.addIssue({ code: "custom", message: "Give the diagram's envelope or its spec, not both." });
    return;
  }
  try {
    diagramEnvelope(d);
  } catch (error) {
    ctx.addIssue({ code: "custom", message: `${FAMILIES[d.tool].label}: ${describeIssues(error) ?? (error instanceof Error ? error.message : "invalid diagram")}` });
  }
});

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
      /**
       * circle: options on one row, pupil circles one. tick: one box per option, stacked.
       * letters: lettered options A, B, C… for mini-whiteboard hinge questions.
       */
      mode: z.enum(["circle", "tick", "letters"]),
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
  z
    .object({
      type: z.literal("steps"),
      /** A worked method, one step a line: "Step 1: Mark two perfect points." An empty label prints "Step n". */
      steps: z
        .array(z.object({ label: text(24).default(""), text: text(300) }).strict())
        .min(1)
        .max(8),
    })
    .strict(),
  z
    .object({
      type: z.literal("paper"),
      /**
       * Blank grid for pupils to draw on. squared: 5 mm squares. dotted: 5 mm dot grid.
       * graph: exam graph paper, 2 mm squares with a bold line every 10 mm.
       */
      style: z.enum(["squared", "dotted", "graph"]),
      widthMm: z.number().min(20).max(400),
      heightMm: z.number().min(10).max(250),
      /**
       * Blank axes with no numbers, so pupils choose their own scale: the origin sits this many
       * millimetres from the grid's left and bottom edges (snapped to the grid). Omit for no axes.
       */
      axes: z
        .object({
          originMm: z.object({ x: z.number().min(0).max(400), y: z.number().min(0).max(250) }).strict(),
          xLabel: text(8).default("x"),
          yLabel: text(8).default("y"),
        })
        .strict()
        .optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal("checklist"),
      /** Self-check boxes the pupil ticks as they work ("Mark two perfect points"). Nothing is saved as an answer. */
      items: z.array(text(120)).min(1).max(6),
    })
    .strict(),
] as const;

export const leafSchema = z.discriminatedUnion("type", leafItems);
/**
 * A worked solution kept with the question: never printed (pupil or answers copy). It lets a
 * reviewer or teacher check the saved answers. Several lines are allowed.
 */
export const workingSchema = z
  .string()
  .max(3000)
  // Never printed or read as markup, so < and > are allowed for inequalities; control characters are not.
  .refine((s) => ![...s].some((c) => c.charCodeAt(0) < 32 && c !== "\n"), "Use ordinary text: line breaks are the only control characters allowed.")
  .describe("Hidden worked solution: stored with the question, never printed.");

export const partSchema = z
  .object({
    type: z.literal("part"),
    text: text(400),
    items: z.array(leafSchema).max(8).default([]),
    working: workingSchema.optional(),
  })
  .strict();
export const itemSchema = z.discriminatedUnion("type", [...leafItems, partSchema]);

export const cardSchema = z
  .object({
    title: text(60),
    items: z.array(itemSchema).min(1).max(16),
    /** Starts a new labelled stage band (the next letter) above this card: stages on wider layouts. */
    stage: text(40).optional(),
    working: workingSchema.optional(),
  })
  .strict();

export const columnSchema = z
  .object({
    heading: text(40),
    cards: z.array(cardSchema).max(6),
  })
  .strict();

/**
 * Column layouts for a side, as widths in thirds of the page: three columns; two wide columns;
 * one wide and one narrow (either way round); or one full-width column of cards.
 */
export const LAYOUTS = {
  three: [1, 1, 1],
  two: [1.5, 1.5],
  "wide-narrow": [2, 1],
  "narrow-wide": [1, 2],
  one: [3],
} as const;
export type Layout = keyof typeof LAYOUTS;

export const sideSchema = z
  .object({
    /** One line under the title on this side, e.g. "Use a ruler when drawing charts." */
    instruction: text(160).default(""),
    layout: z.enum(Object.keys(LAYOUTS) as [Layout, ...Layout[]]).default("three"),
    /** One mark per answer: prints "Score ____ / n" in the header. Leave null for no score box. */
    score: z.number().int().min(1).max(200).nullable().default(null),
    columns: z.array(columnSchema).min(1).max(3),
  })
  .strict()
  .superRefine((side, ctx) => {
    const want = LAYOUTS[side.layout].length;
    if (side.columns.length !== want) ctx.addIssue({ code: "custom", path: ["columns"], message: `The ${side.layout} layout has ${want} column${want === 1 ? "" : "s"}; this side has ${side.columns.length}.` });
  });

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
        /**
         * plain (saved files from before, and the default): text prints as typed. maths: {3/4} in
         * question text prints as a stacked fraction, and as a native equation in Word.
         */
        notation: z.enum(["plain", "maths"]).default("plain"),
        sides: z.array(sideSchema).length(2),
      })
      .strict()
      .describe("The worksheet: header fields and exactly two sides, each with strand columns of question cards (three by default)."),
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
  return resolveDiagrams(r.data);
}

/** A card with every diagram given as a spec built into its envelope. */
export function resolveCard(card: Card): Card {
  const fix = <T extends { type: string }>(item: T): T => {
    if (item.type === "diagram") {
      const d = (item as unknown as { diagram: Diagram }).diagram;
      if (d.envelope === undefined) return { ...item, diagram: { tool: d.tool, envelope: diagramEnvelope(d) } };
    }
    if (item.type === "part") {
      const p = item as unknown as { items: { type: string }[] };
      return { ...item, items: p.items.map(fix) };
    }
    return item;
  };
  return { ...card, items: card.items.map(fix) };
}

/** Builds every diagram given as a spec into its envelope, so a saved worksheet holds envelopes only. */
export function resolveDiagrams(resource: Resource): Resource {
  return {
    ...resource,
    document: {
      ...resource.document,
      sides: resource.document.sides.map((side) => ({
        ...side,
        columns: side.columns.map((column) => ({ ...column, cards: column.cards.map(resolveCard) })),
      })),
    },
  };
}
