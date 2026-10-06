import { z } from "zod";
import {
  cloneDefaultDocument,
  getBounds,
  pointInBounds,
  visibleStraightPoints,
} from "./diagram";
import {
  parseNumericInput,
  pointsForEquation,
  equationForObject,
} from "./equations";
import type { DiagramDocumentV1, GraphObject, StraightObject } from "./types";

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
export const axisSchema = z
  .object({
    negativeSquares: z.number().int().nonnegative(),
    positiveSquares: z.number().int().nonnegative(),
    unitsPerSquare: z.union([z.literal(0.5), z.literal(1), z.literal(2)]),
  })
  .strict();
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
};
export const objectInputSchema = z.union([
  z
    .object({
      id: identifier.optional(),
      kind: z.literal("point"),
      position: inputCoordinate,
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
    schemaVersion: z.literal(1),
    axes: axesSchema.optional(),
    objects: z.array(objectInputSchema).max(50),
  })
  .strict();
const objectSchema = z.union([
  z
    .object({ id: identifier, kind: z.literal("point"), position: coordinate })
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
  if (input.kind === "point")
    return { id, kind: "point", position: input.position };
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
  };
}
export function createGraph(value: unknown): GraphEnvelope {
  const input = parse(graphSpecSchema, value);
  const document = cloneDefaultDocument();
  if (input.axes) document.axes = input.axes;
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
export function canonicalEnvelope(envelope: GraphEnvelope): string {
  const document = documentFromEnvelope(envelope);
  // Explicit property construction fixes ordering and defaults across all clients.
  document.objects = document.objects.map((o) =>
    o.kind === "point"
      ? {
          id: o.id,
          kind: o.kind,
          position: { x: o.position.x, y: o.position.y },
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
        },
  );
  document.axes = {
    x: {
      negativeSquares: document.axes.x.negativeSquares,
      positiveSquares: document.axes.x.positiveSquares,
      unitsPerSquare: document.axes.x.unitsPerSquare,
    },
    y: {
      negativeSquares: document.axes.y.negativeSquares,
      positiveSquares: document.axes.y.positiveSquares,
      unitsPerSquare: document.axes.y.unitsPerSquare,
    },
  };
  return JSON.stringify(
    createEnvelope({
      version: 1,
      axes: document.axes,
      objects: document.objects,
      selectedObjectId: null,
      styleProfile: envelope.styleProfile,
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
  return envelope.document.objects
    .filter((o) =>
      o.kind === "point"
        ? !pointInBounds(o.position, bounds)
        : !visibleStraightPoints(o, bounds),
    )
    .map((o) => `${o.id} is outside the visible grid.`);
}
export function describeGraph(envelope: GraphEnvelope): string {
  const d = envelope.document,
    b = getBounds(d);
  const objects = d.objects
    .map((o) =>
      o.kind === "point"
        ? `${o.id}: point (${o.position.x}, ${o.position.y})`
        : `${o.id}: ${o.strokeStyle ?? "solid"} ${o.display}, ${equationForObject(o as StraightObject)}, equation ${o.equationVisible ? "shown" : "hidden"}`,
    )
    .join("; ");
  return `Coordinate graph: x ${b.xMin} to ${b.xMax}, y ${b.yMin} to ${b.yMax}; scales ${d.axes.x.unitsPerSquare} and ${d.axes.y.unitsPerSquare} units per 1 cm square. ${objects || "Empty grid."}`;
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
  url.search = "?tool=graph";
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
