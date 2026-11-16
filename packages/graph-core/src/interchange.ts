import { aboutOf, aboutShape } from "../../envelope-core/src/about";
import { LINE_WEIGHTS } from "../../envelope-core/src/house-style";
import { z } from "zod";
import {
  MAX_AXIS_ORIGIN,
  MAX_AXIS_TITLE_LENGTH,
  cloneDefaultDocument,
  getBounds,
  isUnitsPerSquare,
  pointInBounds,
  visibleStraightPoints,
} from "./diagram";
import {
  LABEL_SIDES,
  MAX_LABEL_TEXT_LENGTH,
  OBJECT_NAME_PATTERN,
  coordinatesPrintable,
  formatAxisValue,
  normaliseLabelText,
  normaliseObjectName,
  readableName,
  xNumbersCrowded,
} from "./axes";
import {
  parseNumericInput,
  pointsForEquation,
  equationForObject,
} from "./equations";
import type { AxisConfig, DiagramDocumentV1, FunctionEquation, GraphObject, StraightObject } from "./types";
import { POLYGON_MAX_VERTICES, POLYGON_MIN_VERTICES, formatVertices, polygonInBounds, polygonProblem } from "./polygon";
import { gradientTriangleProblem } from "./gradient-triangle";
import { axesCrossing, circleVisible, curveProblem, curveVisible, readingLegs, readingVisible } from "./curve";
import { stripObjects, tangentObject } from "./working";
import { formatFunction, functionProblem, functionVisible } from "./function";
import { imageObjects, transformationProblem, type Transformation } from "./transform";
import { gradientLabelClashes } from "./svg";
import {
  MAX_INEQUALITY_LENGTH,
  MAX_REGION_INEQUALITIES,
  regionHalfPlanes,
  regionPolygon,
  regionProblem,
} from "./region";
import { sha256Hex, toBase64Url } from "../../envelope-core/src/index";
import { MathsDockError, zodFields } from "../../envelope-core/src/errors";

import { RENDERER_VERSION } from "./version";
export { RENDERER_VERSION };
export const MAX_REQUEST_BYTES = 64 * 1024;
/** Points in one curve: enough for a travel graph or a curve read off a paper every half square. */
export const MAX_CURVE_POINTS = 40;
export const MAX_LINK_LENGTH = 8192;
export const MAX_FILE_BYTES = 1024 * 1024;
export class GraphError extends MathsDockError {
  constructor(code: string, message: string, details?: ConstructorParameters<typeof MathsDockError>[2]) {
    super(code, message, details);
    this.name = "GraphError";
  }
}
const finite = z.number().finite().min(-1_000_000).max(1_000_000);
const numeric = z
  .union([finite, z.string().max(48)])
  .transform((value, context) => {
    const result = typeof value === "number" ? value : parseNumericInput(value);
    if (result === null || Math.abs(result) > 1_000_000) {
      context.addIssue({
        code: "custom",
        message:
          "Use a finite number or fraction between -1000000 and 1000000.",
      });
      return z.NEVER;
    }
    return result;
  });
const coordinate = z.object({ x: finite, y: finite }).strict();
const inputCoordinate = z.object({ x: numeric, y: numeric }).strict();
const identifier = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-zA-Z0-9_-]+$/);
const inequalitiesSchema = z
  .array(z.string().trim().min(1).max(MAX_INEQUALITY_LENGTH))
  .min(1)
  .max(MAX_REGION_INEQUALITIES);
const nameSchema = z
  .string()
  .regex(OBJECT_NAME_PATTERN, "Use a capital letter with an optional prime and subscript number, such as A, B′, L or L1.");
const nameInput = z
  .string()
  .max(8)
  .transform(normaliseObjectName)
  .pipe(nameSchema)
  .describe(
    "Exam-style name printed beside the object: a capital letter, optional prime and optional subscript number (A, B, P′, L, L1, L2). Lines print bold (L₁), points italic beside their cross (A).",
  );
const answerOnlyInput = z
  .boolean()
  .optional()
  .describe(
    "true makes this a hidden answer: drawn in the answer colour only on the answers copy (outputView answer, or a worksheet's answers view); the pupil copy stays blank for the pupil to draw. Use for the line or shape a pupil is asked to draw.",
  );
const functionInput = z
  .discriminatedUnion("family", [
    z.object({ family: z.literal("polynomial"), cubic: numeric.optional(), a: numeric.optional(), b: numeric.optional(), c: numeric.optional() }).strict(),
    z.object({ family: z.literal("reciprocal"), k: numeric, c: numeric.optional() }).strict(),
    z.object({ family: z.literal("exponential"), coefficient: numeric.optional(), base: numeric, c: numeric.optional() }).strict(),
    z
      .object({ family: z.literal("trig"), fn: z.enum(["sin", "cos", "tan"]), amplitude: numeric.optional(), multiplier: numeric.optional(), shift: numeric.optional(), c: numeric.optional() })
      .strict()
      .describe("y = amplitude fn(multiplier x + shift) + c, x in degrees."),
  ])
  .describe("polynomial y = cubic x³ + a x² + b x + c; reciprocal y = k/x + c; exponential y = coefficient × baseˣ + c; omitted terms are 0 (amplitude, multiplier and coefficient 1).");
const functionSaved = z.discriminatedUnion("family", [
  z.object({ family: z.literal("polynomial"), a: finite, b: finite, c: finite, cubic: finite.optional() }).strict(),
  z.object({ family: z.literal("reciprocal"), k: finite, c: finite }).strict(),
  z.object({ family: z.literal("exponential"), coefficient: finite, base: finite, c: finite }).strict(),
  z.object({ family: z.literal("trig"), fn: z.enum(["sin", "cos", "tan"]), amplitude: finite, multiplier: finite, shift: finite, c: finite }).strict(),
]);
const titleSchema = z
  .string()
  .max(MAX_AXIS_TITLE_LENGTH)
  .refine((t) => t.trim().length > 0 && t.trim() === t && ![...t].some((c) => c.charCodeAt(0) < 32), "Use a short single-line title without leading or trailing spaces.");
export const axisSchema = z
  .object({
    negativeSquares: z.number().int().nonnegative(),
    positiveSquares: z.number().int().nonnegative(),
    unitsPerSquare: z
      .number()
      .refine(isUnitsPerSquare, "Use a positive scale of at most 100000 units a square, to 3 decimal places.")
      .describe("Units per 1 cm square, such as 0.5, 1, 2, 5, 10, 20, 25 or 50. For time axes, minutes per square (15, 30, 60)."),
    origin: z
      .number()
      .finite()
      .min(-MAX_AXIS_ORIGIN)
      .max(MAX_AXIS_ORIGIN)
      .optional()
      .describe("Value where the other axis crosses, default 0. A travel graph from 12 00 uses x origin 720 (minutes) with negativeSquares 0."),
    labelEvery: z
      .number()
      .int()
      .min(1)
      .max(10)
      .optional()
      .describe("Number every nth 1 cm line from the origin. Omit for every line (every second line at 0.5 a square)."),
    format: z
      .enum(["number", "time"])
      .optional()
      .describe("time reads values as minutes after midnight and prints 12 00, 12 30. Default number."),
    name: z
      .string()
      .regex(/^[a-zA-Z]$/, "Use one letter, such as t or v.")
      .optional()
      .describe("Italic letter at the arrow, such as t."),
    title: titleSchema
      .optional()
      .describe("Axis title in words with its unit in brackets, such as \"Distance from home (km)\" or \"Time of day\". Replaces the italic x or y."),
  })
  .strict();
const gridSchema = z
  .enum(["1cm", "5mm", "2mm", "none"])
  .describe("1cm squares (default), or a fine grid of 5mm or 2mm squares inside heavier 1 cm lines. Scales still count 1 cm squares. none draws sketch axes, as exam sketch questions print them: no grid and no axis numbers, only the axes with arrowheads, x, y and the origin (use originLabel O). Mark values on a sketch with a line's labels.");
const labelTextSchema = z
  .string()
  .min(1)
  .max(MAX_LABEL_TEXT_LENGTH)
  .refine((t) => t.trim() === t, "Label text cannot start or end with a space.")
  .refine((t) => ![...t].some((c) => c.charCodeAt(0) < 32), "Label text must be one line.");
const labelSideSchema = z.enum(LABEL_SIDES);
const labelInput = z
  .object({
    at: inputCoordinate.describe("The point the label marks, usually where the line crosses an axis."),
    text: z
      .string()
      .max(MAX_LABEL_TEXT_LENGTH)
      .transform(normaliseLabelText)
      .pipe(labelTextSchema)
      .describe('Short text such as "3", "-2" (printed −2) or "(0, 3)".'),
    side: labelSideSchema
      .optional()
      .describe("Where the text sits beside the point. Default: left of the y-axis, below the x-axis, otherwise above-right."),
  })
  .strict();
const labelsInput = z
  .array(labelInput)
  .max(4)
  .optional()
  .describe("Up to 4 short labels beside points on this line, such as its axis intercepts on a sketch. They print upright at 12 pt and follow the line's answerOnly.");
const gradientTriangleLabels = z.enum(["values", "blank"]);
const gradientTriangleInput = z
  .object({
    x: numeric.describe("The x where the triangle starts on the line."),
    run: numeric.describe("The horizontal leg from x: positive runs right, negative left. Choose one that gives a whole-number rise."),
    labels: gradientTriangleLabels
      .optional()
      .describe("values prints the run and rise beside the legs; blank prints dotted answer spaces on the pupil copy and the values in pink on the answers copy. Omit for no labels."),
  })
  .strict()
  .optional()
  .describe("A right-angled gradient triangle drawn with dashed legs between the line and a horizontal and vertical leg. Not for vertical or horizontal lines.");
const linesSchema = z
  .enum(LINE_WEIGHTS)
  .describe("normal (default) or bold: bold makes the axes and everything plotted 1.5 times as heavy; the grid keeps its weight.");
const originLabelSchema = z
  .enum(["0", "O"])
  .describe("The origin mark: an italic O, as Edexcel papers print it (default), or 0.");
const axesSchema = z
  .object({ x: axisSchema, y: axisSchema })
  .strict()
  .superRefine((axes, c) => {
    for (const [key, maximum] of [
      ["x", 18],
      ["y", 26],
    ] as const) {
      const total = axes[key].negativeSquares + axes[key].positiveSquares;
      if (total < 2 || total > maximum)
        c.addIssue({
          code: "custom",
          path: [key],
          message: `Use 2 to ${maximum} squares on the ${key} axis.`,
        });
    }
  });
export const equationSchema = z.discriminatedUnion("kind", [
  z
    .object({ kind: z.literal("slope"), slope: numeric, intercept: numeric })
    .strict(),
  z.object({ kind: z.literal("vertical"), x: numeric }).strict(),
]);
const coordinatesSchema = z.enum(["show", "blank"]);
const arrowSchema = z.enum(["end", "middle"]);
const straightInput = {
  id: identifier.optional(),
  start: inputCoordinate.optional(),
  end: inputCoordinate.optional(),
  strokeStyle: z.enum(["solid", "dashed"]).default("solid"),
  equationVisible: z
    .boolean()
    .default(false)
    .describe(
      "Print the equation on the diagram only when the user explicitly asks to show or label it. Plotting an equation alone does not request a printed label. Default false.",
    ),
  equationLabelPosition: inputCoordinate.optional(),
  name: nameInput.optional(),
  namePosition: inputCoordinate
    .optional()
    .describe("Centre of the printed name in graph coordinates. Omit to place it automatically."),
  answerOnly: answerOnlyInput,
  labels: labelsInput,
  gradientTriangle: gradientTriangleInput,
  arrow: arrowSchema
    .optional()
    .describe("Segments only: a vector arrowhead at the end, or centred on the middle as exam vector diagrams print it."),
};
export const transformationSchema = z
  .discriminatedUnion("kind", [
    z.object({ kind: z.literal("translate"), vector: inputCoordinate }).strict(),
    z.object({ kind: z.literal("reflect"), mirror: equationSchema.describe("y = x is slope 1, intercept 0; x = k is vertical.") }).strict(),
    z
      .object({
        kind: z.literal("rotate"),
        centre: inputCoordinate,
        angle: z.union([z.literal(90), z.literal(180), z.literal(270)]),
        direction: z.enum(["clockwise", "anticlockwise"]).default("clockwise").describe("Ignored for 180°."),
      })
      .strict(),
    z
      .object({
        kind: z.literal("enlarge"),
        centre: inputCoordinate,
        scaleFactor: numeric.describe("Nonzero, such as 2, \"1/2\" or -2."),
      })
      .strict(),
  ])
  .describe("Corner i of the image is the image of corner i.");
// One branch per kind, so a bad field is reported against that kind only (M11).
export const objectInputSchema = z.discriminatedUnion("kind", [
  z
    .object({
      id: identifier.optional(),
      kind: z.literal("polygon"),
      vertices: z
        .array(inputCoordinate)
        .min(POLYGON_MIN_VERTICES)
        .max(POLYGON_MAX_VERTICES)
        .describe("3 to 12 corners in order, such as a triangle (1, 1), (4, 1), (1, 3). The shape closes itself."),
      shaded: z.boolean().optional().describe("true shades the shape grey. Default unshaded."),
      name: nameInput.optional(),
      namePosition: inputCoordinate
        .optional()
        .describe("Centre of the printed name in graph coordinates. Omit to print it in the middle of the shape."),
      answerOnly: answerOnlyInput,
    })
    .strict(),
  z
    .object({
      id: identifier.optional(),
      kind: z.literal("point"),
      position: inputCoordinate,
      name: nameInput.optional(),
      namePosition: inputCoordinate
        .optional()
        .describe("Centre of the printed name in graph coordinates. Omit to place it automatically."),
      coordinates: coordinatesSchema
        .optional()
        .describe(
          'Print the coordinates after the name, as A(2, 3): "show" prints them; "blank" leaves ( ……… , ……… ) for pupils to write ("write down the coordinates of A") and prints them only on the answers copy. Omit for none.',
        ),
      answerOnly: answerOnlyInput,
    })
    .strict(),
  z
    .object({
      ...straightInput,
      kind: z.literal("segment"),
      start: inputCoordinate,
      end: inputCoordinate,
    })
    .strict(),
  z
    .object({
      ...straightInput,
      kind: z.literal("line"),
      equation: equationSchema.optional(),
    })
    .strict()
    .refine(
      (o) => (o.equation ? !o.start && !o.end : !!o.start && !!o.end),
      "A line needs either an equation or two distinct points, not both.",
    ),
  z
    .object({
      id: identifier.optional(),
      kind: z.literal("curve"),
      points: z.array(inputCoordinate).min(2).max(MAX_CURVE_POINTS).describe("2 to 40 points in order."),
      smooth: z.boolean().optional().describe("Smooth through every point; omitted joins with straight pieces."),
      strokeStyle: z.enum(["solid", "dashed"]).optional(),
      name: nameInput.optional(),
      namePosition: inputCoordinate.optional(),
      answerOnly: answerOnlyInput,
    })
    .strict()
    .describe("A travel or real-life graph through points."),
  z
    .object({
      id: identifier.optional(),
      kind: z.literal("reading"),
      at: inputCoordinate,
      read: z.enum(["x", "y", "both"]).describe("Which value is read: the head is on that axis."),
      answerOnly: answerOnlyInput,
    })
    .strict()
    .describe("Dashed reading lines from a point to the axes."),
  z
    .object({
      id: identifier.optional(),
      kind: z.literal("function"),
      equation: functionInput,
      from: numeric.optional().describe("Start x; omitted is the grid's left edge."),
      to: numeric.optional(),
      strokeStyle: z.enum(["solid", "dashed"]).optional(),
      name: nameInput.optional(),
      namePosition: inputCoordinate.optional(),
      answerOnly: answerOnlyInput,
    })
    .strict()
    .describe("An equation curve drawn exactly."),
  z
    .object({
      id: identifier.optional(),
      kind: z.literal("circle"),
      centre: inputCoordinate,
      radius: numeric,
      strokeStyle: z.enum(["solid", "dashed"]).optional(),
      name: nameInput.optional(),
      namePosition: inputCoordinate.optional(),
      answerOnly: answerOnlyInput,
    })
    .strict()
    .describe("A circle, such as x² + y² = 25: centre (0, 0), radius 5."),
  z
    .object({
      id: identifier.optional(),
      kind: z.literal("tangent"),
      of: identifier.describe("An earlier curve's id."),
      x: numeric.describe("Where it touches."),
      run: numeric.optional().describe("How far it reaches each side, in x units. Default 2 squares."),
      gradientTriangle: gradientTriangleInput,
      answerOnly: answerOnlyInput,
    })
    .strict()
    .describe("A tangent to an earlier curve, saved as a segment."),
  z
    .object({
      id: identifier.optional(),
      kind: z.literal("strips"),
      of: identifier.describe("An earlier curve's id."),
      from: numeric,
      to: numeric,
      count: z.number().int().min(1).max(10),
      shaded: z.boolean().optional(),
      answerOnly: answerOnlyInput,
    })
    .strict()
    .describe("Equal trapezium strips under an earlier curve down to the x-axis, saved as shapes."),
  z
    .object({
      id: identifier.optional(),
      kind: z.literal("image"),
      of: identifier.describe("An earlier polygon's id."),
      transformation: transformationSchema,
      shaded: z.boolean().optional(),
      name: nameInput.optional(),
      namePosition: inputCoordinate.optional(),
      answerOnly: answerOnlyInput,
      rays: z
        .boolean()
        .optional()
        .describe("Enlargements only: dashed rays from the centre through each corner and its image."),
    })
    .strict()
    .describe("The exact image of an earlier polygon, saved as a polygon. answerOnly when pupils draw it."),
  z
    .object({
      id: identifier.optional(),
      kind: z.literal("region"),
      inequalities: inequalitiesSchema.describe(
        "1 to 4 inequalities in x and y, as printed in the question: \"y > 2x - 1\", \"x <= 3\", \"x + y < 6\" or a range \"-2 < x <= 3\". < and > print dashed boundaries, <= and >= solid.",
      ),
      shade: z
        .enum(["wanted", "unwanted"])
        .default("wanted")
        .describe("wanted shades the region that satisfies every inequality; unwanted shades the rest and leaves the answer region clear."),
      boundaries: z
        .boolean()
        .default(true)
        .describe("Draw each boundary line across the grid. Set false when the lines are already separate line objects."),
      name: nameInput.optional().describe("Region name printed upright in the middle of the region, usually R."),
      namePosition: inputCoordinate.optional(),
      answerOnly: answerOnlyInput,
    })
    .strict(),
]);
export const graphSpecSchema = z
  .object({
    // Only version 1 exists, so it may be omitted (M6).
    schemaVersion: z.literal(1).default(1),
    axes: axesSchema.optional(),
    grid: gridSchema.optional(),
    originLabel: originLabelSchema.optional(),
    lines: linesSchema.optional(),
    objects: z.array(objectInputSchema).max(50),
  })
  .strict();
const objectSchema = z.discriminatedUnion("kind", [
  z
    .object({
      id: identifier,
      kind: z.literal("polygon"),
      vertices: z.array(coordinate).min(POLYGON_MIN_VERTICES).max(POLYGON_MAX_VERTICES),
      shaded: z.literal(true).optional(),
      name: nameSchema.optional(),
      namePosition: coordinate.optional(),
      answerOnly: z.literal(true).optional(),
    })
    .strict(),
  z
    .object({
      id: identifier,
      kind: z.literal("point"),
      position: coordinate,
      name: nameSchema.optional(),
      namePosition: coordinate.optional(),
      coordinates: coordinatesSchema.optional(),
      answerOnly: z.literal(true).optional(),
    })
    .strict(),
  z
    .object({
      id: identifier,
      kind: z.literal("straight"),
      display: z.enum(["segment", "line"]),
      strokeStyle: z.enum(["solid", "dashed"]).optional(),
      start: coordinate,
      end: coordinate,
      equationVisible: z.boolean(),
      equationLabelPosition: coordinate.optional(),
      name: nameSchema.optional(),
      namePosition: coordinate.optional(),
      answerOnly: z.literal(true).optional(),
      labels: z
        .array(z.object({ at: coordinate, text: labelTextSchema, side: labelSideSchema.optional() }).strict())
        .min(1)
        .max(4)
        .optional(),
      gradientTriangle: z.object({ x: finite, run: finite, labels: gradientTriangleLabels.optional() }).strict().optional(),
      arrow: arrowSchema.optional(),
    })
    .strict(),
  z
    .object({
      id: identifier,
      kind: z.literal("region"),
      inequalities: inequalitiesSchema,
      shade: z.enum(["wanted", "unwanted"]),
      boundaries: z.boolean(),
      name: nameSchema.optional(),
      namePosition: coordinate.optional(),
      answerOnly: z.literal(true).optional(),
    })
    .strict(),
  z
    .object({
      id: identifier,
      kind: z.literal("curve"),
      points: z.array(coordinate).min(2).max(MAX_CURVE_POINTS),
      smooth: z.literal(true).optional(),
      strokeStyle: z.literal("dashed").optional(),
      name: nameSchema.optional(),
      namePosition: coordinate.optional(),
      answerOnly: z.literal(true).optional(),
    })
    .strict(),
  z
    .object({
      id: identifier,
      kind: z.literal("function"),
      equation: functionSaved,
      from: finite.optional(),
      to: finite.optional(),
      strokeStyle: z.literal("dashed").optional(),
      name: nameSchema.optional(),
      namePosition: coordinate.optional(),
      answerOnly: z.literal(true).optional(),
    })
    .strict(),
  z
    .object({
      id: identifier,
      kind: z.literal("circle"),
      centre: coordinate,
      radius: finite.positive(),
      strokeStyle: z.literal("dashed").optional(),
      name: nameSchema.optional(),
      namePosition: coordinate.optional(),
      answerOnly: z.literal(true).optional(),
    })
    .strict(),
  z
    .object({
      id: identifier,
      kind: z.literal("reading"),
      at: coordinate,
      read: z.enum(["x", "y", "both"]),
      answerOnly: z.literal(true).optional(),
    })
    .strict(),
]);
const documentSchema = z
  .object({
    version: z.literal(1),
    axes: axesSchema,
    objects: z.array(objectSchema),
    styleProfile: z.enum(["legacy", "portable-v1"]).optional(),
    grid: gridSchema.optional(),
    originLabel: originLabelSchema.optional(),
    lines: z.literal("bold").optional(),
  })
  .strict()
  .superRefine((d, c) => {
    const ids = new Set<string>();
    for (const o of d.objects) {
      if (ids.has(o.id))
        c.addIssue({ code: "custom", message: `Duplicate object ID: ${o.id}` });
      ids.add(o.id);
      if (o.kind === "region") {
        const problem = regionProblem(o);
        if (problem) c.addIssue({ code: "custom", message: `${o.id}: ${problem}` });
      } else if (
        o.kind === "straight" &&
        Math.hypot(o.end.x - o.start.x, o.end.y - o.start.y) < 1e-10
      )
        c.addIssue({
          code: "custom",
          message: `${o.id} needs two distinct points.`,
        });
      if (o.kind === "function") {
        const problem = functionProblem(o.equation) ?? (o.from !== undefined && o.to !== undefined && !(o.to > o.from) ? "to must be after from." : null);
        if (problem) c.addIssue({ code: "custom", message: `${o.id}: ${problem}` });
      }
      if (o.kind === "curve") {
        const problem = curveProblem(o.points);
        if (problem) c.addIssue({ code: "custom", message: `${o.id}: ${problem}` });
      }
      if (o.kind === "polygon") {
        const problem = polygonProblem(o.vertices);
        if (problem) c.addIssue({ code: "custom", message: `${o.id}: ${problem}` });
      }
      if (o.kind === "straight" && o.arrow && o.display !== "segment")
        c.addIssue({ code: "custom", message: `${o.id}: only a segment can carry a vector arrowhead.` });
      if (o.kind === "straight" && o.gradientTriangle && Math.abs(o.gradientTriangle.run) < 1e-12)
        c.addIssue({ code: "custom", message: `${o.id}: a gradient triangle needs a run that is not zero.` });
    }
  });
export const envelopeSchema = z
  .object({
    schemaVersion: z.literal(1),
    rendererVersion: z.literal(RENDERER_VERSION),
    styleProfile: z.enum(["legacy", "portable-v1"]),
    document: documentSchema,
    ...aboutShape,
  })
  .strict()
  .superRefine((e, c) => {
    if (
      e.document.styleProfile !== undefined &&
      e.document.styleProfile !== e.styleProfile
    )
      c.addIssue({
        code: "custom",
        message: "Graph style metadata disagrees.",
      });
  });
export type GraphEnvelope = z.infer<typeof envelopeSchema>;
export type GraphSpec = z.input<typeof graphSpecSchema>;
export function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    const fields = zodFields(result.error);
    throw new GraphError("invalid_graph", fields.map((f) => `${f.path === "input" ? "graph" : f.path}: ${f.message}`).join("; "), { fields });
  }
  return result.data;
}
/** The saved envelope for a drawing. An editor's selection (U35) is never saved. */
export function createEnvelope(document: DiagramDocumentV1): GraphEnvelope {
  const { styleProfile, ...raw } = document;
  delete (raw as { selectedObjectId?: unknown }).selectedObjectId;
  return {
    schemaVersion: 1,
    rendererVersion: RENDERER_VERSION,
    styleProfile: styleProfile ?? "legacy",
    document: structuredClone(raw),
  };
}
/** The note the connector gives when a saved graph moves to the portable print font. */
export const PORTABLE_NOTE = "The graph now uses the portable print font; mathematical values are unchanged.";
/**
 * A graph in the portable print profile, as the connector draws every graph: a legacy envelope is
 * converted (values, title and note unchanged) and `converted` says so.
 */
export function portableEnvelope(raw: GraphEnvelope): { envelope: GraphEnvelope; converted: boolean } {
  if (raw.styleProfile === "portable-v1") return { envelope: raw, converted: false };
  return { envelope: { ...createEnvelope({ ...documentFromEnvelope(raw), styleProfile: "portable-v1" }), ...aboutOf(raw) }, converted: true };
}
export function documentFromEnvelope(
  envelope: GraphEnvelope,
): DiagramDocumentV1 {
  const document = structuredClone(envelope.document);
  if (envelope.styleProfile === "portable-v1")
    document.styleProfile = "portable-v1";
  else delete document.styleProfile;
  return document;
}
export function validateEnvelope(
  value: unknown,
  network = false,
): GraphEnvelope {
  const envelope = parse(envelopeSchema, value);
  for (const o of envelope.document.objects)
    if (o.kind === "point" && o.coordinates && !coordinatesPrintable(o.position))
      throw new GraphError(
        "invalid_input",
        `Point ${o.id} is at (${o.position.x}, ${o.position.y}); printed coordinates need values with at most 3 decimal places, so move it to an exact position or leave its coordinates off.`,
      );
  if (
    network &&
    (envelope.document.objects.length > 50 ||
      new TextEncoder().encode(JSON.stringify(envelope)).length >
        MAX_REQUEST_BYTES)
  )
    throw new GraphError(
      "size_limit",
      "Service graphs allow up to 50 objects and 64 KiB.",
    );
  return envelope;
}
/** The objects an input makes: one, or an image with its construction rays. */
function makeObjects(
  input: z.output<typeof objectInputSchema>,
  index: number,
  document: DiagramDocumentV1,
): GraphObject[] {
  const id = input.id ?? `object-${index + 1}`;
  if (input.kind === "tangent" || input.kind === "strips") {
    const curve = document.objects.find((o) => o.id === input.of);
    if (!curve || (curve.kind !== "curve" && curve.kind !== "function"))
      throw new GraphError("invalid_graph", `${id}: ${curve ? `${input.of} is not a graph through points or an equation curve` : `no earlier graph has ID ${input.of}`}.`);
    try {
      if (input.kind === "tangent")
        return [tangentObject(curve, input.x, input.run ?? 2 * document.axes.x.unitsPerSquare, {
          id,
          answerOnly: input.answerOnly,
          ...(input.gradientTriangle ? { gradientTriangle: { x: input.gradientTriangle.x, run: input.gradientTriangle.run, ...(input.gradientTriangle.labels ? { labels: input.gradientTriangle.labels } : {}) } } : {}),
        })];
      return stripObjects(curve, input.from, input.to, input.count, document.axes.y.origin ?? 0, { id: (i) => `${id}-strip-${i + 1}`, shaded: input.shaded, answerOnly: input.answerOnly });
    } catch (error) {
      throw new GraphError("invalid_graph", `${id}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  if (input.kind !== "image") return [makeObject(input, index, document)];
  const source = document.objects.find((o) => o.id === input.of);
  if (!source || source.kind !== "polygon")
    throw new GraphError("invalid_graph", `${id}: ${source ? `${input.of} is not a shape` : `no earlier shape has ID ${input.of}`}, so it has no image.`);
  const t = input.transformation;
  const transformation: Transformation =
    t.kind === "rotate" ? { ...t, direction: t.angle === 180 ? "clockwise" : t.direction } : t;
  const problem = transformationProblem(transformation);
  if (problem) throw new GraphError("invalid_graph", `${id}: ${problem}`);
  if (input.rays && t.kind !== "enlarge")
    throw new GraphError("invalid_graph", `${id}: rays belong to an enlargement only.`);
  const objects = imageObjects(source, transformation, {
    id,
    name: input.name,
    shaded: input.shaded,
    answerOnly: input.answerOnly,
    rays: input.rays,
  });
  if (input.namePosition) objects[0].namePosition = input.namePosition;
  return objects;
}
function makeObject(
  input: Exclude<z.output<typeof objectInputSchema>, { kind: "image" | "tangent" | "strips" }>,
  index: number,
  document: DiagramDocumentV1,
): GraphObject {
  const id = input.id ?? `object-${index + 1}`;
  const named = {
    ...("name" in input && input.name ? { name: input.name } : {}),
    ...("namePosition" in input && input.namePosition ? { namePosition: input.namePosition } : {}),
    ...(input.answerOnly ? { answerOnly: true as const } : {}),
  };
  if (input.kind === "point")
    return { id, kind: "point", position: input.position, ...named, ...(input.coordinates ? { coordinates: input.coordinates } : {}) };
  if (input.kind === "polygon")
    return {
      id,
      kind: "polygon",
      vertices: input.vertices.map((p) => ({ x: p.x, y: p.y })),
      ...(input.shaded ? { shaded: true as const } : {}),
      ...named,
    };
  if (input.kind === "curve") {
    const problem = curveProblem(input.points);
    if (problem) throw new GraphError("invalid_graph", `${id}: ${problem}`);
    return {
      id,
      kind: "curve",
      points: input.points.map((p) => ({ x: p.x, y: p.y })),
      ...(input.smooth ? { smooth: true as const } : {}),
      ...(input.strokeStyle === "dashed" ? { strokeStyle: "dashed" as const } : {}),
      ...named,
    };
  }
  if (input.kind === "function") {
    const equation = functionEquationFrom(input.equation);
    const problem = functionProblem(equation) ?? (input.from !== undefined && input.to !== undefined && !(input.to > input.from) ? "to must be after from." : null);
    if (problem) throw new GraphError("invalid_graph", `${id}: ${problem}`);
    return {
      id,
      kind: "function",
      equation,
      ...(input.from !== undefined ? { from: input.from } : {}),
      ...(input.to !== undefined ? { to: input.to } : {}),
      ...(input.strokeStyle === "dashed" ? { strokeStyle: "dashed" as const } : {}),
      ...named,
    };
  }
  if (input.kind === "circle") {
    if (!(input.radius > 0)) throw new GraphError("invalid_graph", `${id}: a circle needs a radius above 0.`);
    return {
      id,
      kind: "circle",
      centre: { x: input.centre.x, y: input.centre.y },
      radius: input.radius,
      ...(input.strokeStyle === "dashed" ? { strokeStyle: "dashed" as const } : {}),
      ...named,
    };
  }
  if (input.kind === "reading")
    return { id, kind: "reading", at: { x: input.at.x, y: input.at.y }, read: input.read, ...(input.answerOnly ? { answerOnly: true as const } : {}) };
  if (input.kind === "region") {
    const problem = regionProblem(input);
    if (problem) throw new GraphError("invalid_region", `${id}: ${problem}`);
    return {
      id,
      kind: "region",
      inequalities: input.inequalities,
      shade: input.shade,
      boundaries: input.boundaries,
      ...named,
    };
  }
  // A label off the axes would never print, so a new one must mark a point on them.
  for (const label of input.labels ?? [])
    if (!pointInBounds(label.at, getBounds(document)))
      throw new GraphError(
        "invalid_label",
        `${id}: the label "${label.text}" marks (${label.at.x}, ${label.at.y}), which is outside the axes.`,
      );
  const [start, end] =
    input.kind === "line" && input.equation
      ? pointsForEquation(input.equation, getBounds(document))
      : [input.start!, input.end!];
  return {
    id,
    kind: "straight",
    display: input.kind === "line" ? "line" : "segment",
    start,
    end,
    strokeStyle: input.strokeStyle,
    equationVisible: input.equationVisible,
    ...(input.equationLabelPosition
      ? { equationLabelPosition: input.equationLabelPosition }
      : {}),
    ...named,
    ...(input.labels?.length
      ? { labels: input.labels.map((l) => ({ at: l.at, text: l.text, ...(l.side ? { side: l.side } : {}) })) }
      : {}),
    ...(input.gradientTriangle
      ? {
          gradientTriangle: {
            x: input.gradientTriangle.x,
            run: input.gradientTriangle.run,
            ...(input.gradientTriangle.labels ? { labels: input.gradientTriangle.labels } : {}),
          },
        }
      : {}),
    ...(input.arrow ? { arrow: input.arrow } : {}),
  };
}
export function createGraph(value: unknown): GraphEnvelope {
  const input = parse(graphSpecSchema, value);
  const document = cloneDefaultDocument();
  if (input.axes) document.axes = input.axes;
  if (input.grid) document.grid = input.grid;
  if (input.originLabel === "0") document.originLabel = "0";
  if (input.lines === "bold") document.lines = "bold";
  document.styleProfile = "portable-v1";
  // One at a time, so an image can refer to a shape made before it.
  document.objects = [];
  input.objects.forEach((object, index) => document.objects.push(...makeObjects(object, index, document)));
  return validateEnvelope(createEnvelope(document), true);
}
const operationSchema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("add_object"), object: objectInputSchema }).strict(),
  z
    .object({
      op: z.literal("replace_object"),
      id: identifier,
      object: objectInputSchema,
    })
    .strict(),
  z.object({ op: z.literal("remove_object"), id: identifier }).strict(),
  z.object({ op: z.literal("set_axes"), axes: axesSchema }).strict(),
  z.object({ op: z.literal("set_lines"), lines: linesSchema }).strict(),
  z
    .object({
      op: z.literal("set_grid"),
      grid: gridSchema.optional(),
      originLabel: originLabelSchema.optional(),
    })
    .strict(),
  z
    .object({
      op: z.literal("set_name"),
      id: identifier,
      name: nameInput.nullable().optional(),
      position: inputCoordinate.nullable().optional(),
    })
    .strict(),
  z
    .object({
      op: z.literal("set_label"),
      id: identifier,
      visible: z.boolean().optional(),
      position: inputCoordinate.nullable().optional(),
    })
    .strict(),
]);
export const revisionSchema = z
  .object({
    envelope: envelopeSchema,
    baseHash: z.string().regex(/^[a-f0-9]{64}$/),
    operations: z.array(operationSchema).max(100),
  })
  .strict();
function canonicalAxis(a: AxisConfig): AxisConfig {
  return {
    negativeSquares: a.negativeSquares,
    positiveSquares: a.positiveSquares,
    unitsPerSquare: a.unitsPerSquare,
    ...(a.origin !== undefined ? { origin: a.origin } : {}),
    ...(a.labelEvery !== undefined ? { labelEvery: a.labelEvery } : {}),
    ...(a.format !== undefined ? { format: a.format } : {}),
    ...(a.title !== undefined ? { title: a.title } : {}),
    ...(a.name !== undefined ? { name: a.name } : {}),
  };
}
function canonicalName(o: GraphObject) {
  return {
    ...(o.name ? { name: o.name } : {}),
    ...(o.namePosition ? { namePosition: { x: o.namePosition.x, y: o.namePosition.y } } : {}),
    ...(o.answerOnly ? { answerOnly: true as const } : {}),
  };
}
/** A saved equation with every term present, in a fixed order. */
function canonicalFunction(e: FunctionEquation): FunctionEquation {
  if (e.family === "polynomial") return { family: e.family, a: e.a, b: e.b, c: e.c, ...(e.cubic ? { cubic: e.cubic } : {}) };
  if (e.family === "reciprocal") return { family: e.family, k: e.k, c: e.c };
  if (e.family === "exponential") return { family: e.family, coefficient: e.coefficient, base: e.base, c: e.c };
  return { family: e.family, fn: e.fn, amplitude: e.amplitude, multiplier: e.multiplier, shift: e.shift, c: e.c };
}
/** Fills an input equation's omitted terms. */
function functionEquationFrom(e: z.output<typeof functionInput>): FunctionEquation {
  if (e.family === "polynomial") return canonicalFunction({ family: e.family, a: e.a ?? 0, b: e.b ?? 0, c: e.c ?? 0, cubic: e.cubic });
  if (e.family === "reciprocal") return { family: e.family, k: e.k, c: e.c ?? 0 };
  if (e.family === "exponential") return { family: e.family, coefficient: e.coefficient ?? 1, base: e.base, c: e.c ?? 0 };
  return { family: e.family, fn: e.fn, amplitude: e.amplitude ?? 1, multiplier: e.multiplier ?? 1, shift: e.shift ?? 0, c: e.c ?? 0 };
}
export function canonicalEnvelope(envelope: GraphEnvelope): string {
  const document = documentFromEnvelope(envelope);
  // Explicit property construction fixes ordering and defaults across all clients.
  document.objects = document.objects.map((o): GraphObject =>
    o.kind === "curve"
      ? {
          id: o.id,
          kind: o.kind,
          points: o.points.map((p) => ({ x: p.x, y: p.y })),
          ...(o.smooth ? { smooth: true as const } : {}),
          ...(o.strokeStyle ? { strokeStyle: o.strokeStyle } : {}),
          ...canonicalName(o),
        }
      : o.kind === "function"
      ? {
          id: o.id,
          kind: o.kind,
          equation: canonicalFunction(o.equation),
          ...(o.from !== undefined ? { from: o.from } : {}),
          ...(o.to !== undefined ? { to: o.to } : {}),
          ...(o.strokeStyle ? { strokeStyle: o.strokeStyle } : {}),
          ...canonicalName(o),
        }
      : o.kind === "circle"
      ? { id: o.id, kind: o.kind, centre: { x: o.centre.x, y: o.centre.y }, radius: o.radius, ...(o.strokeStyle ? { strokeStyle: o.strokeStyle } : {}), ...canonicalName(o) }
      : o.kind === "reading"
      ? { id: o.id, kind: o.kind, at: { x: o.at.x, y: o.at.y }, read: o.read, ...(o.answerOnly ? { answerOnly: true as const } : {}) }
      : o.kind === "region"
      ? {
          id: o.id,
          kind: o.kind,
          inequalities: [...o.inequalities],
          shade: o.shade,
          boundaries: o.boundaries,
          ...canonicalName(o),
        }
      : o.kind === "point"
      ? {
          id: o.id,
          kind: o.kind,
          position: { x: o.position.x, y: o.position.y },
          ...canonicalName(o),
          ...(o.coordinates ? { coordinates: o.coordinates } : {}),
        }
      : o.kind === "polygon"
      ? {
          id: o.id,
          kind: o.kind,
          vertices: o.vertices.map((p) => ({ x: p.x, y: p.y })),
          ...(o.shaded ? { shaded: true as const } : {}),
          ...canonicalName(o),
        }
      : {
          id: o.id,
          kind: o.kind,
          display: o.display,
          strokeStyle: o.strokeStyle ?? "solid",
          start: { x: o.start.x, y: o.start.y },
          end: { x: o.end.x, y: o.end.y },
          equationVisible: o.equationVisible,
          ...(o.equationLabelPosition
            ? {
                equationLabelPosition: {
                  x: o.equationLabelPosition.x,
                  y: o.equationLabelPosition.y,
                },
              }
            : {}),
          ...canonicalName(o),
          ...(o.labels
            ? {
                labels: o.labels.map((l) => ({
                  at: { x: l.at.x, y: l.at.y },
                  text: l.text,
                  ...(l.side ? { side: l.side } : {}),
                })),
              }
            : {}),
          ...(o.gradientTriangle
            ? {
                gradientTriangle: {
                  x: o.gradientTriangle.x,
                  run: o.gradientTriangle.run,
                  ...(o.gradientTriangle.labels ? { labels: o.gradientTriangle.labels } : {}),
                },
              }
            : {}),
          ...(o.arrow ? { arrow: o.arrow } : {}),
        },
  );
  document.axes = {
    x: canonicalAxis(document.axes.x),
    y: canonicalAxis(document.axes.y),
  };
  // The saved title and note (U34) follow the drawing, only when present, so other hashes stay put.
  return JSON.stringify({
    ...createEnvelope({
      version: 1,
      axes: document.axes,
      objects: document.objects,
      styleProfile: envelope.styleProfile,
      // New settings join the hash only when present, so older graphs keep their hashes.
      ...(document.grid ? { grid: document.grid } : {}),
      // O is the default (Edexcel), so only a 0 origin mark is part of the hash.
      ...(document.originLabel === "0" ? { originLabel: "0" } : {}),
      ...(document.lines ? { lines: document.lines } : {}),
    }),
    ...aboutOf(envelope),
  });
}
export async function graphHash(envelope: GraphEnvelope): Promise<string> {
  return sha256Hex(canonicalEnvelope(envelope));
}
export async function reviseGraph(value: unknown): Promise<GraphEnvelope> {
  const input = parse(revisionSchema, value),
    envelope = validateEnvelope(input.envelope, true);
  if ((await graphHash(envelope)) !== input.baseHash)
    throw new GraphError(
      "stale_hash",
      "Use the content hash from the exact graph being revised.",
    );
  const document = documentFromEnvelope(envelope);
  for (const op of input.operations) {
    if (op.op === "set_axes") {
      document.axes = op.axes;
      continue;
    }
    if (op.op === "set_lines") {
      if (op.lines === "bold") document.lines = "bold";
      else delete document.lines;
      continue;
    }
    if (op.op === "set_grid") {
      if (op.grid !== undefined) {
        if (op.grid === "1cm") delete document.grid;
        else document.grid = op.grid;
      }
      if (op.originLabel !== undefined) {
        if (op.originLabel === "O") delete document.originLabel;
        else document.originLabel = "0";
      }
      continue;
    }
    if (op.op === "add_object") {
      let id = op.object.id;
      if (!id) {
        let n = 1;
        while (document.objects.some((o) => o.id === `object-${n}` || o.id.startsWith(`object-${n}-ray-`) || o.id.startsWith(`object-${n}-strip-`))) n++;
        id = `object-${n}`;
      }
      document.objects.push(...makeObjects({ ...op.object, id }, document.objects.length, document));
      continue;
    }
    const index = document.objects.findIndex((o) => o.id === op.id);
    if (index === -1)
      throw new GraphError("invalid_graph", `No object has ID ${op.id}.`);
    if (op.op === "remove_object") {
      document.objects.splice(index, 1);
      continue;
    }
    if (op.op === "replace_object") {
      if (op.object.id && op.object.id !== op.id)
        throw new GraphError(
          "invalid_graph",
          "Replacing an object must retain its ID.",
        );
      if (op.object.kind === "strips")
        throw new GraphError("invalid_graph", "Strips are several shapes: remove the object and add the strips with add_object.");
      const made = makeObjects({ ...op.object, id: op.id }, index, document);
      if (made.length !== 1)
        throw new GraphError("invalid_graph", "Replace an image without rays, or remove it and add it again with rays.");
      document.objects[index] = made[0];
      // An image's enlargement rays belong to the image they were drawn for, so they go with it.
      const rayId = new RegExp(`^${op.id}-ray-\\d+$`); // ids are letters, digits, _ and -, all literal here
      document.objects = document.objects.filter((o) => !rayId.test(o.id));
      continue;
    }
    const object = document.objects[index];
    if (op.op === "set_name") {
      if (op.name === null) {
        delete object.name;
        delete object.namePosition;
      } else if (op.name !== undefined) object.name = op.name;
      if (op.position === null) delete object.namePosition;
      else if (op.position) {
        if (!object.name)
          throw new GraphError("invalid_graph", `${op.id} needs a name before its name can be moved.`);
        object.namePosition = op.position;
      }
      continue;
    }
    if (object.kind !== "straight")
      throw new GraphError(
        "invalid_graph",
        "Only lines have equation labels.",
      );
    if (op.visible !== undefined) object.equationVisible = op.visible;
    if (op.position === null) delete object.equationLabelPosition;
    else if (op.position) object.equationLabelPosition = op.position;
  }
  return validateEnvelope({ ...createEnvelope(document), ...aboutOf(envelope) }, true);
}
export function graphWarnings(envelope: GraphEnvelope): string[] {
  const bounds = getBounds(envelope.document);
  const crowded = xNumbersCrowded(envelope.document)
    ? ["The x-axis numbers touch at print size. Number every 2nd, 3rd or 5th line (labelEvery) or use a larger scale."]
    : [];
  const arrows = envelope.document.objects.flatMap((o) =>
    o.kind === "straight" && o.arrow === "end" && o.display === "segment" && visibleStraightPoints(o, bounds) && !pointInBounds(o.end, bounds)
      ? [`${o.id}: the end of this vector is off the grid, so its arrowhead does not print. Move the end onto the grid or widen the axes.`]
      : [],
  );
  const readings = envelope.document.objects.flatMap((o) =>
    o.kind === "reading" && readingVisible(o, bounds) && !readingLegs(o, axesCrossing(envelope.document.axes)).some((l) => l.head)
      ? [`${o.id}: this reading sits on the axis it reads, so it has no arrowhead. Move it onto the graph or choose the other value.`]
      : [],
  );
  const circles = envelope.document.objects.flatMap((o) =>
    o.kind === "circle" && circleVisible(o, bounds) &&
    (o.centre.x - o.radius < bounds.xMin || o.centre.x + o.radius > bounds.xMax || o.centre.y - o.radius < bounds.yMin || o.centre.y + o.radius > bounds.yMax)
      ? [`${o.id}: part of this circle is off the grid, so it is cut off. Make the radius smaller or widen the axes.`]
      : [],
  );
  const triangles = envelope.document.objects.flatMap((o) => {
    const problem = o.kind === "straight" ? gradientTriangleProblem(o, bounds) : null;
    return problem ? [`${o.id}: ${problem}`] : [];
  });
  return crowded.concat(arrows, readings, circles, triangles, gradientLabelClashes(envelope.document), envelope.document.objects
    .filter((o) =>
      o.kind === "circle"
        ? !circleVisible(o, bounds)
        : o.kind === "function"
        ? !functionVisible(o, bounds)
        : o.kind === "curve"
        ? !curveVisible(o, bounds)
        : o.kind === "reading"
        ? !readingVisible(o, bounds)
        : o.kind === "region"
        ? !regionPolygon(regionHalfPlanes(o), bounds).length
        : o.kind === "point"
        ? !pointInBounds(o.position, bounds)
        : o.kind === "polygon"
          ? !polygonInBounds(o, bounds)
          : !visibleStraightPoints(o, bounds),
    )
    .map((o) =>
      o.kind === "region"
        ? `${o.id}: no part of the grid satisfies ${o.inequalities.join(", ")}. Check the inequality signs or widen the axes.`
        : `${o.id} is outside the visible grid.`,
    ));
}
export function describeGraph(envelope: GraphEnvelope): string {
  const d = envelope.document,
    b = getBounds(d);
  const named = (o: GraphObject) =>
    `${o.name ? ` named ${readableName(o.name)}` : ""}${o.answerOnly ? " (answer only: hidden on the pupil copy)" : ""}`;
  const objects = d.objects
    .map((o) =>
      o.kind === "function"
        ? `${o.id}: ${o.strokeStyle === "dashed" ? "dashed " : ""}curve ${formatFunction(o.equation)}${o.equation.family === "trig" ? " (x in degrees)" : ""}${o.from !== undefined || o.to !== undefined ? ` from x = ${o.from ?? b.xMin} to ${o.to ?? b.xMax}` : ""}${named(o)}`
        : o.kind === "circle"
        ? `${o.id}: ${o.strokeStyle === "dashed" ? "dashed " : ""}circle centre (${o.centre.x}, ${o.centre.y}) radius ${o.radius}${named(o)}`
        : o.kind === "curve"
        ? `${o.id}: ${o.strokeStyle === "dashed" ? "dashed " : ""}${o.smooth ? "smooth curve" : "graph of straight pieces"} through ${o.points.map((p) => `(${p.x}, ${p.y})`).join(" ")}${named(o)}`
        : o.kind === "reading"
        ? `${o.id}: dashed reading lines at (${o.at.x}, ${o.at.y}), ${o.read === "both" ? "to both axes" : `reading ${o.read}`}${named(o)}`
        : o.kind === "region"
        ? `${o.id}: region ${o.inequalities.join(", ")}${named(o)}, ${o.shade === "wanted" ? "region shaded" : "unwanted side shaded, region left clear"}${o.boundaries ? ", boundaries drawn (dashed for < and >)" : ""}`
        : o.kind === "point"
        ? `${o.id}: point (${o.position.x}, ${o.position.y})${named(o)}`
        : o.kind === "polygon"
        ? `${o.id}: ${o.shaded ? "shaded " : ""}shape with corners ${formatVertices(o.vertices)}${named(o)}`
        : `${o.id}: ${o.strokeStyle ?? "solid"} ${o.display}${named(o)}, ${equationForObject(o as StraightObject)}, equation ${o.equationVisible ? "shown" : "hidden"}${o.labels ? `, labelled ${o.labels.map((l) => `"${l.text}" at (${l.at.x}, ${l.at.y})`).join(" and ")}` : ""}${o.gradientTriangle ? `, gradient triangle from x = ${o.gradientTriangle.x} with run ${o.gradientTriangle.run}${o.gradientTriangle.labels ? ` (${o.gradientTriangle.labels === "blank" ? "blank labels" : "run and rise printed"})` : ""}` : ""}`,
    )
    .join("; ");
  const range = (axis: "x" | "y", min: number, max: number) => {
    const a = d.axes[axis];
    const words = `${axis} ${formatAxisValue(min, a)} to ${formatAxisValue(max, a)}`;
    return a.format === "time" || a.title
      ? `${words}${a.format === "time" ? " (times of day)" : ""}${a.title ? ` titled "${a.title}"` : ""}`
      : `${axis} ${min} to ${max}`;
  };
  const extras = [
    d.grid === "none"
      ? " Sketch axes: no grid or axis numbers."
      : d.grid && d.grid !== "1cm"
        ? ` ${d.grid} fine grid.`
        : "",
    d.originLabel === "0" ? " Origin labelled 0." : "",
  ].join("");
  return `Coordinate graph: ${range("x", b.xMin, b.xMax)}, ${range("y", b.yMin, b.yMax)}; scales ${d.axes.x.unitsPerSquare} and ${d.axes.y.unitsPerSquare} units per 1 cm square.${extras} ${objects || "Empty grid."}`;
}
export function encodeEnvelope(envelope: GraphEnvelope): string {
  return toBase64Url(canonicalEnvelope(envelope));
}
export function decodeEnvelope(payload: string): GraphEnvelope {
  if (payload.length > MAX_FILE_BYTES * 2 || !/^[A-Za-z0-9_-]+$/.test(payload))
    throw new GraphError("size_limit", "Invalid or oversized graph link.");
  try {
    const bytes = Uint8Array.from(
      atob(payload.replaceAll("-", "+").replaceAll("_", "/")),
      (c) => c.charCodeAt(0),
    );
    if (bytes.length > MAX_FILE_BYTES)
      throw new GraphError("size_limit", "Graph file is too large.");
    return validateEnvelope(
      JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)),
    );
  } catch (error) {
    if (error instanceof GraphError) throw error;
    throw new GraphError("invalid_graph", "The graph link cannot be read.");
  }
}
export function editorLink(envelope: GraphEnvelope, base: string): string {
  const url = new URL(base);
  // The editor's own page path, such as /tools/graph (old ?tool= links still redirect).
  url.pathname = url.pathname.replace(/(\/tools(\/[^/]*)?)?\/?$/, "/") + "tools/graph";
  url.search = "";
  url.hash = `graph=${encodeEnvelope(envelope)}`;
  if (url.href.length > MAX_LINK_LENGTH)
    throw new GraphError(
      "size_limit",
      "This graph is too large for a link. Save its editable JSON instead.",
    );
  return url.href;
}
export function parseGraphFile(text: string): GraphEnvelope {
  if (new TextEncoder().encode(text).length > MAX_FILE_BYTES)
    throw new GraphError(
      "size_limit",
      "Editable files must be smaller than 1 MiB.",
    );
  try {
    return validateEnvelope(JSON.parse(text));
  } catch (error) {
    if (error instanceof GraphError) throw error;
    throw new GraphError(
      "invalid_graph",
      "Choose a valid editable graph JSON file.",
    );
  }
}
