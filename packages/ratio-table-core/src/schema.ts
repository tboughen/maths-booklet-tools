import { aboutShape } from "../../envelope-core/src/about";
import { z } from "zod";
import { LINE_WEIGHTS } from "../../envelope-core/src/house-style";
import { canonicalRatioNumber, RatioError } from "./numbers";
import { zodFields } from "../../envelope-core/src/errors";

export const RATIO_RENDERER_VERSION = "ratio-2";
export const RATIO_STYLE_PROFILE = "ratio-lesson-v1";
export const RATIO_MAX_FILE_BYTES = 64 * 1024;
export const RATIO_MAX_ENVELOPE_BYTES = 8 * 1024;
export const RATIO_MAX_REQUEST_BYTES = 16 * 1024;
export const RATIO_MAX_LINK_LENGTH = 8192;
const id = z
  .string()
  .min(1)
  .max(32)
  .regex(/^[A-Za-z0-9_-]+$/);
export const cellSchema = z.discriminatedUnion("kind", [
  z
    .object({ kind: z.literal("number"), value: z.string().min(1).max(32) })
    .strict(),
  z.object({ kind: z.literal("empty") }).strict(),
  z.object({ kind: z.literal("answer-line") }).strict(),
  // A saved answer: blank (or an answer line, with line: true) in the pupil copy, printed in the
  // answers copy only. Never filled or calculated by the tool.
  z
    .object({
      kind: z.literal("hidden"),
      value: z.string().min(1).max(32),
      line: z.boolean().optional(),
    })
    .strict(),
]);
export type RatioCell = z.infer<typeof cellSchema>;
// Homogeneous array items keep nested schemas importable by ChatGPT.
export const cellsSchema = z.array(cellSchema).min(1).max(3);
/**
 * Heading text: words and units such as "Time (min)", "Speed (m/s)", "Temperature (°C)", "%" or
 * "£" (Tim, 11 and 16 Nov 2026), or a power such as x^2 or 1/x^2. The column widens to fit.
 */
export const HEADING_MAX = 16;
export const HEADING_PATTERN = /^[A-Za-z0-9 _/%£°()-]+$|^(?:\d+\/)?[A-Za-z]+\^\d$/;
export const headingSchema = z
  .object({
    text: z
      .string()
      .min(1)
      .max(HEADING_MAX)
      .regex(HEADING_PATTERN, "Use letters, digits, spaces, brackets, _ / % £ ° -, or a power such as x^2 or 1/x^2."),
    italic: z.boolean(),
    direction: z.enum(["right", "up", "down", "none"]),
    /**
     * A hidden heading (faded tables, booklet rule N8): blank on the pupil copy, with no arrow, and
     * printed with its arrow in the answer colour on the answers copy. Only true is saved.
     */
    hidden: z
      .boolean()
      .transform((v) => (v ? (true as const) : undefined))
      .optional(),
  })
  .strict();
/** Typed powers become the saved form: "x²" is "x^2", "x³" is "x^3". */
export const headingPowers = (t: string) => t.replaceAll("²", "^2").replaceAll("³", "^3");
/** A heading that is one letter, a power of it or 1 over it ("x", "x^2", "1/x") prints the letter italic. */
export const letterHeading = (t: string) => /^(?:1\/)?[A-Za-z](?:\^\d)?$/.test(t);
/** A heading as it is read aloud: "x^2" is "x squared", "1/x" is "1 over x". */
export const spokenHeading = (t: string) =>
  t
    .replace(/\^2\b/g, " squared")
    .replace(/\^3\b/g, " cubed")
    .replace(/\^(\d)/g, " to the power $1")
    .replace(/^1\/([A-Za-z])/, "1 over $1");
export const headingsSchema = z.array(headingSchema).min(1).max(3);
export const rowSchema = z.object({ id, cells: cellsSchema }).strict();
export const transitionSchema = z
  .object({
    from: id,
    to: id,
    operation: z.enum(["multiply", "divide"]),
    factor: z.string().min(1).max(32),
    /** The operation label prints only in the answers copy; the pupil copy shows an answer line. */
    hidden: z.boolean().optional(),
    /**
     * Two-column tables only: the arrow and operation print on one side ("left" or "right").
     * Omitted, they print on both sides.
     */
    side: z.enum(["left", "right"]).optional(),
  })
  .strict();
export const documentSchema = z
  .object({
    headings: headingsSchema,
    rows: z.array(rowSchema).min(1).max(6),
    transitions: z.array(transitionSchema).max(5),
    size: z.enum(["standard", "large"]),
    mode: z.enum(["simple", "annotated"]),
    showArrows: z.boolean(),
    showOperations: z.boolean(),
    /** Bold lines (U111). Normal lines are the default and are never saved. */
    lines: z
      .enum(LINE_WEIGHTS)
      .transform((v) => (v === "bold" ? v : undefined))
      .optional(),
    /**
     * An answers-only table (faded tables, booklet rule N8): the pupil copy keeps the table's space
     * as blank paper, with no cross, headings, cells or arrows; the answers copy prints the whole
     * table in the answer colour. Only true is saved.
     */
    answerOnly: z
      .boolean()
      .transform((v) => (v ? (true as const) : undefined))
      .optional(),
  })
  .strict();
export type RatioDocument = z.infer<typeof documentSchema>;
export type RatioTransition = z.infer<typeof transitionSchema>;
export const ratioEnvelopeSchema = z
  .object({
    kind: z.literal("ratio-table"),
    schemaVersion: z.literal(2),
    rendererVersion: z.literal(RATIO_RENDERER_VERSION),
    styleProfile: z.literal(RATIO_STYLE_PROFILE),
    document: documentSchema,
    ...aboutShape,
  })
  .strict();
export type RatioEnvelope = z.infer<typeof ratioEnvelopeSchema>;
export const DEFAULT_HEADINGS: RatioDocument["headings"] = [
  { text: "x", italic: true, direction: "right" },
  { text: "y", italic: true, direction: "up" },
];
export const ratioSpecSchema = z
  .object({
    schemaVersion: z.literal(2).optional(),
    rows: z
      .array(z.object({ id: id.optional(), cells: cellsSchema }).strict())
      .min(1)
      .max(6)
      .optional(),
    headings: headingsSchema.optional(),
    transitions: z.array(transitionSchema).max(5).optional(),
    size: z.enum(["standard", "large"]).optional(),
    mode: z.enum(["simple", "annotated"]).optional(),
    showArrows: z.boolean().optional(),
    showOperations: z.boolean().optional(),
    lines: z.enum(LINE_WEIGHTS).optional(),
    /** The whole table prints on the answers copy only; the pupil copy keeps its space blank. */
    answerOnly: z.boolean().optional(),
    /**
     * Compact form, for booklets and worksheets with many tables. Use instead of headings, rows
     * and transitions. columns: heading strings ending in → ↑ ↓ for an arrow ("x →", "y ↑"; a gradient is always y ↑, with -4 for a line going down);
     * units such as "Time (min) ↑" widen the column; a single letter prints italic; "[x →]" is a hidden heading, blank on the pupil copy and printed in the answer colour on the answers copy. table: one string array per row; a cell is "3", "-1/2", "2 1/2" (mixed number),
     * "" (empty), "_" (answer line), "[3]" (hidden answer) or "[3]_" (hidden answer on an
     * answer line). steps: one string per gap between rows, "" for none, "× 2" or "÷ 2"
     * (also "x2", "*2", "/2"); "[÷ 2]" hides the operation in the pupil copy; "left: × 2" or
     * "right: [÷ 2]" prints it on one side only (two columns). Any step turns on
     * the curved arrows unless mode says otherwise.
     */
    columns: z.array(z.string().min(1).max(HEADING_MAX + 4)).min(1).max(3).optional(),
    table: z.array(z.array(z.string().max(40)).min(1).max(3)).min(1).max(6).optional(),
    steps: z.array(z.string().max(40)).max(5).optional(),
  })
  .strict();
export function readSchema<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    const fields = zodFields(result.error);
    throw new RatioError("invalid_ratio_table", `Invalid ratio table at ${fields[0].path === "input" ? "document" : fields[0].path}: ${fields[0].message}`, { fields });
  }
  return result.data;
}
export function normalizeDocument(input: unknown): RatioDocument {
  const document = readSchema(documentSchema, input);
  if (
    document.rows.some((row) => row.cells.length !== document.headings.length)
  )
    throw new RatioError(
      "invalid_ratio_table",
      "Every row must have one cell for each heading.",
    );
  const ids = document.rows.map((r) => r.id);
  if (new Set(ids).size !== ids.length)
    throw new RatioError("invalid_ratio_table", "Row IDs must be unique.");
  for (const row of document.rows)
    for (const cell of row.cells)
      if (cell.kind === "number" || cell.kind === "hidden") {
        cell.value = canonicalRatioNumber(cell.value);
        // One saved form per state: line: false is the default, so it is left out.
        if (cell.kind === "hidden" && !cell.line) delete cell.line;
      }
  const fromIds = new Set<string>();
  for (const step of document.transitions) {
    const index = ids.indexOf(step.from);
    if (index < 0 || ids[index + 1] !== step.to || fromIds.has(step.from))
      throw new RatioError(
        "invalid_ratio_table",
        "Each scaling step must connect two adjacent rows, with one step per pair.",
      );
    fromIds.add(step.from);
    step.factor = canonicalRatioNumber(step.factor);
    if (!step.hidden) delete step.hidden;
    if (step.side && document.headings.length !== 2)
      throw new RatioError(
        "invalid_ratio_table",
        "Only a two-column table can print a scaling step on one side (left or right); remove side for a wider table.",
      );
    if (step.operation === "divide" && step.factor === "0")
      throw new RatioError("invalid_operation", "Cannot divide by zero.");
  }
  document.transitions.sort(
    (a, b) => ids.indexOf(a.from) - ids.indexOf(b.from),
  );
  return document;
}
