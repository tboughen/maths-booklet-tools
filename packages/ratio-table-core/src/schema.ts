import { z } from "zod";
import { canonicalNumber, RatioError } from "./numbers";

export const RATIO_RENDERER_VERSION = "ratio-1";
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
]);
export type RatioCell = z.infer<typeof cellSchema>;
// Both positions have the same schema. Use homogeneous array items rather than
// draft-07 tuple items, while retaining the exact two-column validation.
export const cellsSchema = z.array(cellSchema).length(2);
export const headingSchema = z
  .object({
    text: z
      .string()
      .min(1)
      .max(12)
      .regex(/^[A-Za-z0-9 _-]+$/),
    italic: z.boolean(),
    direction: z.enum(["right", "up", "none"]),
  })
  .strict();
export const headingsSchema = z.array(headingSchema).length(2);
export const rowSchema = z.object({ id, cells: cellsSchema }).strict();
export const transitionSchema = z
  .object({
    from: id,
    to: id,
    operation: z.enum(["multiply", "divide"]),
    factor: z.string().min(1).max(32),
  })
  .strict();
export const documentSchema = z
  .object({
    headings: headingsSchema,
    rows: z.array(rowSchema).min(2).max(6),
    transitions: z.array(transitionSchema).max(5),
    size: z.enum(["compact", "standard", "large"]),
    mode: z.enum(["simple", "annotated"]),
    showArrows: z.boolean(),
    showOperations: z.boolean(),
  })
  .strict();
export type RatioDocument = z.infer<typeof documentSchema>;
export type RatioTransition = z.infer<typeof transitionSchema>;
export const ratioEnvelopeSchema = z
  .object({
    kind: z.literal("ratio-table"),
    schemaVersion: z.literal(1),
    rendererVersion: z.literal(RATIO_RENDERER_VERSION),
    styleProfile: z.literal(RATIO_STYLE_PROFILE),
    document: documentSchema,
  })
  .strict();
export type RatioEnvelope = z.infer<typeof ratioEnvelopeSchema>;
export const DEFAULT_HEADINGS: RatioDocument["headings"] = [
  { text: "x", italic: true, direction: "right" },
  { text: "y", italic: true, direction: "up" },
];
export const ratioSpecSchema = z
  .object({
    schemaVersion: z.literal(1),
    rows: z
      .array(z.object({ id: id.optional(), cells: cellsSchema }).strict())
      .min(2)
      .max(6),
    headings: headingsSchema.optional(),
    transitions: z.array(transitionSchema).max(5).optional(),
    size: z.enum(["compact", "standard", "large"]).optional(),
    mode: z.enum(["simple", "annotated"]).optional(),
    showArrows: z.boolean().optional(),
    showOperations: z.boolean().optional(),
  })
  .strict();
export function readSchema<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    const issue = result.error.issues[0];
    throw new RatioError(
      "invalid_ratio_table",
      `Invalid ratio table at ${issue.path.join(".") || "document"}: ${issue.message}`,
    );
  }
  return result.data;
}
export function normalizeDocument(input: unknown): RatioDocument {
  const document = readSchema(documentSchema, input);
  const ids = document.rows.map((r) => r.id);
  if (new Set(ids).size !== ids.length)
    throw new RatioError("invalid_ratio_table", "Row IDs must be unique.");
  for (const row of document.rows)
    for (const cell of row.cells)
      if (cell.kind === "number") cell.value = canonicalNumber(cell.value);
  const fromIds = new Set<string>();
  for (const step of document.transitions) {
    const index = ids.indexOf(step.from);
    if (index < 0 || ids[index + 1] !== step.to || fromIds.has(step.from))
      throw new RatioError(
        "invalid_ratio_table",
        "Each scaling step must connect two adjacent rows, with one step per pair.",
      );
    fromIds.add(step.from);
    step.factor = canonicalNumber(step.factor);
    if (step.operation === "divide" && step.factor === "0")
      throw new RatioError("invalid_operation", "Cannot divide by zero.");
  }
  document.transitions.sort(
    (a, b) => ids.indexOf(a.from) - ids.indexOf(b.from),
  );
  return document;
}
