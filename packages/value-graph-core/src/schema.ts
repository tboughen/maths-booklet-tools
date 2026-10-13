import { z } from "zod";
import { parseNumber } from "../../ratio-table-core/src/numbers";

export const numeric = z
  .string()
  .max(32)
  .superRefine((value, ctx) => {
    try {
      parseNumber(value);
    } catch (error) {
      ctx.addIssue({
        code: "custom",
        message: error instanceof Error ? error.message : "Invalid number.",
      });
    }
  });
const id = z.string().regex(/^[a-zA-Z0-9_-]{1,40}$/);
export const equationSchema = z
  .object({ a: numeric, b: numeric, c: numeric })
  .strict();
export const cellSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("value"), value: numeric }).strict(),
  z.object({ kind: z.literal("blank") }).strict(),
  z.object({ kind: z.literal("answer-line") }).strict(),
]);
export const columnSchema = z
  .object({ id, x: numeric, y: cellSchema })
  .strict();
export const boundsSchema = z
  .object({ xMin: numeric, xMax: numeric, yMin: numeric, yMax: numeric })
  .strict();
export const pointSchema = z
  .object({ id, x: numeric, y: numeric, columnId: id.optional() })
  .strict();
export const connectionSchema = z.enum(["none", "straight-joins"]);
export const seriesSchema = z
  .object({
    id,
    source: z.enum(["table", "equation", "custom"]),
    points: z.array(pointSchema).max(40),
    connection: connectionSchema,
  })
  .strict();
export const curveSchema = z
  .object({ id, equation: equationSchema, min: numeric, max: numeric })
  .strict();
export const graphSchema = z
  .object({
    bounds: boundsSchema,
    xUnitsPer10mm: numeric,
    yUnitsPer10mm: numeric,
    minorPitchMm: z.union([z.literal(1), z.literal(2), z.literal(5)]),
    intermediatePitchMm: z.literal(10),
    heavyPitchMm: z.literal(20),
    xLabelEvery: numeric,
    yLabelEvery: numeric,
    originLabel: z.enum(["O", "0"]),
    axisStyle: z.enum(["exam", "plain"]),
    positiveEndArrows: z.boolean(),
    series: z.array(seriesSchema).max(4),
    curves: z.array(curveSchema).max(1),
    referenceLines: z.array(z.object({ id, y: numeric }).strict()).max(4),
  })
  .strict();
export const presentationSchema = z
  .object({
    composition: z.enum(["combined", "table", "graph"]),
    showEquation: z.boolean(),
    showMarkers: z.boolean(),
    showJoins: z.boolean(),
    showCurves: z.boolean(),
    showReferenceLines: z.boolean(),
    decimalPlaces: z.number().int().min(0).max(6).nullable(),
  })
  .strict();
export const printSchema = z
  .object({
    tableWidthMm: z.number().min(60).max(180),
    tableRowHeightMm: z.number().min(10).max(16),
    gapMm: z.number().min(4).max(30),
  })
  .strict();
export const documentSchema = z
  .object({
    equation: equationSchema,
    columns: z.array(columnSchema).min(2).max(13),
    graph: graphSchema,
    presentation: presentationSchema,
    print: printSchema,
  })
  .strict();
export const envelopeSchema = z
  .object({
    schemaVersion: z.literal(1),
    rendererVersion: z.literal("value-graph-1"),
    styleProfile: z.literal("exam-v1"),
    document: documentSchema,
  })
  .strict();
export type Equation = z.infer<typeof equationSchema>;
export type ValueCell = z.infer<typeof cellSchema>;
export type Column = z.infer<typeof columnSchema>;
export type PlotPoint = z.infer<typeof pointSchema>;
export type Series = z.infer<typeof seriesSchema>;
export type ValueDocument = z.infer<typeof documentSchema>;
export type ValueEnvelope = z.infer<typeof envelopeSchema>;
export const operationSchema = z.discriminatedUnion("op", [
  z
    .object({ op: z.literal("set_equation"), equation: equationSchema })
    .strict(),
  z
    .object({
      op: z.literal("set_cell"),
      columnId: id,
      x: numeric.optional(),
      y: cellSchema.optional(),
    })
    .strict(),
  z
    .object({
      op: z.literal("insert_column"),
      afterId: id,
      column: columnSchema,
    })
    .strict(),
  z.object({ op: z.literal("remove_column"), columnId: id }).strict(),
  z
    .object({
      op: z.literal("replace_columns"),
      columns: z.array(columnSchema).min(2).max(13),
    })
    .strict(),
  z
    .object({
      op: z.literal("calculate_cells"),
      columnIds: z.array(id).min(1).max(13),
      overwrite: z.boolean(),
    })
    .strict(),
  z
    .object({
      op: z.literal("set_graph"),
      settings: graphSchema
        .omit({ series: true, curves: true, referenceLines: true })
        .partial(),
    })
    .strict(),
  z
    .object({
      op: z.literal("plot_series"),
      id,
      source: z.enum(["table", "equation"]),
      columnIds: z.array(id).min(1).max(13),
      connection: connectionSchema,
    })
    .strict(),
  z.object({ op: z.literal("put_series"), series: seriesSchema }).strict(),
  z.object({ op: z.literal("remove_series"), id }).strict(),
  z
    .object({
      op: z.literal("set_connection"),
      id,
      connection: connectionSchema,
    })
    .strict(),
  z
    .object({
      op: z.literal("move_point"),
      seriesId: id,
      pointId: id,
      x: numeric,
      y: numeric,
      linked: z.enum(["update-table", "detach"]),
    })
    .strict(),
  z
    .object({ op: z.literal("set_curve"), curve: curveSchema.nullable() })
    .strict(),
  z
    .object({
      op: z.literal("set_reference_lines"),
      lines: graphSchema.shape.referenceLines,
    })
    .strict(),
  z
    .object({
      op: z.literal("set_presentation"),
      settings: presentationSchema.partial(),
    })
    .strict(),
  z
    .object({ op: z.literal("set_print"), settings: printSchema.partial() })
    .strict(),
]);
export type ValueOperation = z.infer<typeof operationSchema>;
export const revisionSchema = z
  .object({
    envelope: envelopeSchema,
    baseHash: z.string().regex(/^[a-f0-9]{64}$/),
    operations: z.array(operationSchema).max(40),
  })
  .strict();
