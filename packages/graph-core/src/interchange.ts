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
import type { AxisConfig, DiagramDocumentV1, GraphObject, StraightObject } from "./types";

export const RENDERER_VERSION = "graph-1";
export const MAX_REQUEST_BYTES = 64 * 1024;
export const MAX_LINK_LENGTH = 8192;
export const MAX_FILE_BYTES = 1024 * 1024;
export class GraphError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
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
const originLabelSchema = z
  .enum(["0", "O"])
  .describe("O prints an italic O at the origin, as Edexcel papers do. Default 0.");
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
};
export const objectInputSchema = z.union([
  z
    .object({
      id: identifier.optional(),
      kind: z.literal("point"),
      position: inputCoordinate,
      name: nameInput.optional(),
      namePosition: inputCoordinate
        .optional()
        .describe("Centre of the printed name in graph coordinates. Omit to place it automatically."),
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
]);
export const graphSpecSchema = z
  .object({
    // Only version 1 exists, so it may be omitted (M6).
    schemaVersion: z.literal(1).default(1),
    axes: axesSchema.optional(),
    grid: gridSchema.optional(),
    originLabel: originLabelSchema.optional(),
    objects: z.array(objectInputSchema).max(50),
  })
  .strict();
const objectSchema = z.union([
  z
    .object({
      id: identifier,
      kind: z.literal("point"),
      position: coordinate,
      name: nameSchema.optional(),
      namePosition: coordinate.optional(),
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
    })
    .strict(),
]);
const documentSchema = z
  .object({
    version: z.literal(1),
    axes: axesSchema,
    objects: z.array(objectSchema),
    selectedObjectId: identifier.nullable(),
    styleProfile: z.enum(["legacy", "portable-v1"]).optional(),
    grid: gridSchema.optional(),
    originLabel: originLabelSchema.optional(),
  })
  .strict()
  .superRefine((d, c) => {
    const ids = new Set<string>();
    for (const o of d.objects) {
      if (ids.has(o.id))
        c.addIssue({ code: "custom", message: `Duplicate object ID: ${o.id}` });
      ids.add(o.id);
      if (
        o.kind === "straight" &&
        Math.hypot(o.end.x - o.start.x, o.end.y - o.start.y) < 1e-10
      )
        c.addIssue({
          code: "custom",
          message: `${o.id} needs two distinct points.`,
        });
    }
    if (d.selectedObjectId !== null && !ids.has(d.selectedObjectId))
      c.addIssue({
        code: "custom",
        message: "The selected object is missing.",
      });
  });
export const envelopeSchema = z
  .object({
    schemaVersion: z.literal(1),
    rendererVersion: z.literal(RENDERER_VERSION),
    styleProfile: z.enum(["legacy", "portable-v1"]),
    document: documentSchema,
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
  if (!result.success)
    throw new GraphError(
      "invalid_graph",
      result.error.issues
        .map((i) => `${i.path.join(".") || "graph"}: ${i.message}`)
        .join("; "),
    );
  return result.data;
}
export function createEnvelope(
  document: DiagramDocumentV1,
  clearSelection = true,
): GraphEnvelope {
  const { styleProfile, ...raw } = document;
  return {
    schemaVersion: 1,
    rendererVersion: RENDERER_VERSION,
    styleProfile: styleProfile ?? "legacy",
    document: {
      ...structuredClone(raw),
      selectedObjectId: clearSelection ? null : raw.selectedObjectId,
    },
  };
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
function makeObject(
  input: z.output<typeof objectInputSchema>,
  index: number,
  document: DiagramDocumentV1,
): GraphObject {
  const id = input.id ?? `object-${index + 1}`;
  const named = {
    ...(input.name ? { name: input.name } : {}),
    ...(input.namePosition ? { namePosition: input.namePosition } : {}),
    ...(input.answerOnly ? { answerOnly: true as const } : {}),
  };
  if (input.kind === "point")
    return { id, kind: "point", position: input.position, ...named };
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
  };
}
export function createGraph(value: unknown): GraphEnvelope {
  const input = parse(graphSpecSchema, value);
  const document = cloneDefaultDocument();
  if (input.axes) document.axes = input.axes;
  if (input.grid) document.grid = input.grid;
  if (input.originLabel) document.originLabel = input.originLabel;
  document.styleProfile = "portable-v1";
  document.objects = input.objects.map((object, index) =>
    makeObject(object, index, document),
  );
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
  };
}
function canonicalName(o: GraphObject) {
  return {
    ...(o.name ? { name: o.name } : {}),
    ...(o.namePosition ? { namePosition: { x: o.namePosition.x, y: o.namePosition.y } } : {}),
    ...(o.answerOnly ? { answerOnly: true as const } : {}),
  };
}
export function canonicalEnvelope(envelope: GraphEnvelope): string {
  const document = documentFromEnvelope(envelope);
  // Explicit property construction fixes ordering and defaults across all clients.
  document.objects = document.objects.map((o) =>
    o.kind === "point"
      ? {
          id: o.id,
          kind: o.kind,
          position: { x: o.position.x, y: o.position.y },
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
        },
  );
  document.axes = {
    x: canonicalAxis(document.axes.x),
    y: canonicalAxis(document.axes.y),
  };
  return JSON.stringify(
    createEnvelope({
      version: 1,
      axes: document.axes,
      objects: document.objects,
      selectedObjectId: null,
      styleProfile: envelope.styleProfile,
      // New settings join the hash only when present, so older graphs keep their hashes.
      ...(document.grid ? { grid: document.grid } : {}),
      ...(document.originLabel ? { originLabel: document.originLabel } : {}),
    }),
  );
}
export async function graphHash(envelope: GraphEnvelope): Promise<string> {
  const hash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(canonicalEnvelope(envelope)),
  );
  return Array.from(new Uint8Array(hash), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}
export async function reviseGraph(value: unknown): Promise<GraphEnvelope> {
  const input = parse(revisionSchema, value),
    envelope = validateEnvelope(input.envelope, true);
  if ((await graphHash(envelope)) !== input.baseHash)
    throw new GraphError(
      "stale_document",
      "Use the content hash from the exact graph being revised.",
    );
  const document = documentFromEnvelope(envelope);
  for (const op of input.operations) {
    if (op.op === "set_axes") {
      document.axes = op.axes;
      continue;
    }
    if (op.op === "set_grid") {
      if (op.grid !== undefined) {
        if (op.grid === "1cm") delete document.grid;
        else document.grid = op.grid;
      }
      if (op.originLabel !== undefined) {
        if (op.originLabel === "0") delete document.originLabel;
        else document.originLabel = op.originLabel;
      }
      continue;
    }
    if (op.op === "add_object") {
      const object = makeObject(op.object, document.objects.length, document);
      if (!op.object.id) {
        let n = 1;
        while (document.objects.some((o) => o.id === `object-${n}`)) n++;
        object.id = `object-${n}`;
      }
      document.objects.push(object);
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
      document.objects[index] = makeObject(
        { ...op.object, id: op.id },
        index,
        document,
      );
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
        "Points do not have equation labels.",
      );
    if (op.visible !== undefined) object.equationVisible = op.visible;
    if (op.position === null) delete object.equationLabelPosition;
    else if (op.position) object.equationLabelPosition = op.position;
  }
  document.selectedObjectId = null;
  return validateEnvelope(createEnvelope(document), true);
}
export function graphWarnings(envelope: GraphEnvelope): string[] {
  const bounds = getBounds(envelope.document);
  const crowded = xNumbersCrowded(envelope.document)
    ? ["The x-axis numbers touch at print size. Number every 2nd, 3rd or 5th line (labelEvery) or use a larger scale."]
    : [];
  return crowded.concat(envelope.document.objects
    .filter((o) =>
      o.kind === "point"
        ? !pointInBounds(o.position, bounds)
        : !visibleStraightPoints(o, bounds),
    )
    .map((o) => `${o.id} is outside the visible grid.`));
}
export function describeGraph(envelope: GraphEnvelope): string {
  const d = envelope.document,
    b = getBounds(d);
  const named = (o: GraphObject) =>
    `${o.name ? ` named ${readableName(o.name)}` : ""}${o.answerOnly ? " (answer only: hidden on the pupil copy)" : ""}`;
  const objects = d.objects
    .map((o) =>
      o.kind === "point"
        ? `${o.id}: point (${o.position.x}, ${o.position.y})${named(o)}`
        : `${o.id}: ${o.strokeStyle ?? "solid"} ${o.display}${named(o)}, ${equationForObject(o as StraightObject)}, equation ${o.equationVisible ? "shown" : "hidden"}${o.labels ? `, labelled ${o.labels.map((l) => `"${l.text}" at (${l.at.x}, ${l.at.y})`).join(" and ")}` : ""}`,
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
    d.originLabel === "O" ? " Origin labelled O." : "",
  ].join("");
  return `Coordinate graph: ${range("x", b.xMin, b.xMax)}, ${range("y", b.yMin, b.yMax)}; scales ${d.axes.x.unitsPerSquare} and ${d.axes.y.unitsPerSquare} units per 1 cm square.${extras} ${objects || "Empty grid."}`;
}
export function encodeEnvelope(envelope: GraphEnvelope): string {
  return btoa(
    Array.from(new TextEncoder().encode(canonicalEnvelope(envelope)), (b) =>
      String.fromCharCode(b),
    ).join(""),
  )
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
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
