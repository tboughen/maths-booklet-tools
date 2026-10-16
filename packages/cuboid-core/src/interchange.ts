import { z } from "zod";
import {
  appearance,
  appearanceSchema,
  axes,
  canonical,
  create,
  envelopeSchema,
  keys,
  labelSchema,
  newShape,
  renderSvg,
  setCubeSide,
  setDimension,
  setUnit,
  shapeSchema,
  upgrade,
  validate,
  type Envelope,
  type Shape,
} from "./index";

const id = shapeSchema.shape.id;
const labelPatch = labelSchema.partial().optional();
const labels = z
  .object({
    width: labelPatch,
    depth: labelPatch,
    height: labelPatch,
    front: labelPatch,
    top: labelPatch,
    side: labelPatch,
  })
  .strict();
export const shapeSpecSchema = shapeSchema
  .partial()
  .extend({
    dimensions: shapeSchema.shape.dimensions.partial().optional(),
    labels: labels.optional(),
  })
  .strict();
export const specSchema = z
  .object({
    widthCm: z.number().min(4).max(18).optional(),
    shapes: z.array(shapeSpecSchema).min(1).max(3).optional(),
  })
  .strict();
export const createSchema = z
  .object({ spec: specSchema.optional(), envelope: envelopeSchema.optional() })
  .strict();
function shape(spec: z.infer<typeof shapeSpecSchema>, fallback: string): Shape {
  const base = newShape(spec.id ?? fallback);
  return {
    ...base,
    ...spec,
    dimensions: { ...base.dimensions, ...spec.dimensions },
    labels: Object.fromEntries(
      keys.map((k) => [k, { ...base.labels[k], ...spec.labels?.[k] }]),
    ) as Shape["labels"],
  };
}
export function createCuboid(raw: unknown = {}): Envelope {
  const v = createSchema.parse(raw);
  if (v.spec && v.envelope) throw Error("Supply spec or envelope, not both.");
  if (v.envelope) {
    const e = validate(v.envelope);
    renderSvg(e);
    return e;
  }
  const e = upgrade(create());
  if (v.spec?.widthCm !== undefined) e.document.widthCm = v.spec.widthCm;
  if (v.spec?.shapes)
    e.document.shapes = v.spec.shapes.map((s, i) =>
      shape(s, `cuboid-${i + 1}`),
    );
  const n = validate(e);
  renderSvg(n);
  return n;
}
const presentation = shapeSchema
  .pick({
    title: true,
    hiddenEdges: true,
    arrows: true,
    workedVolume: true,
    workedArea: true,
    counts: true,
    layerNumbers: true,
    caption: true,
  })
  .partial();
export const operationSchema = z.discriminatedUnion("op", [
  z
    .object({
      op: z.literal("add_shape"),
      afterId: id.optional(),
      shape: shapeSpecSchema,
    })
    .strict(),
  z.object({ op: z.literal("remove_shape"), id }).strict(),
  z
    .object({ op: z.literal("replace_shape"), id, shape: shapeSpecSchema })
    .strict(),
  z
    .object({
      op: z.literal("set_dimension"),
      id,
      axis: z.enum(axes),
      value: z.string().max(32),
    })
    .strict(),
  z
    .object({ op: z.literal("set_unit"), id, unit: shapeSchema.shape.unit })
    .strict(),
  z
    .object({
      op: z.literal("set_cube"),
      id,
      enabled: z.boolean(),
      referenceAxis: z.enum(axes).optional(),
    })
    .strict(),
  z
    .object({ op: z.literal("set_cube_side"), id, value: z.string().max(32) })
    .strict(),
  z
    .object({ op: z.literal("set_view"), id, view: shapeSchema.shape.view })
    .strict(),
  z
    .object({
      op: z.literal("set_projection"),
      id,
      direction: shapeSchema.shape.direction.optional(),
      projection: shapeSchema.shape.projection.optional(),
      schematic: z.boolean().optional(),
      proportions: shapeSchema.shape.proportions.optional(),
    })
    .strict(),
  z
    .object({
      op: z.literal("set_label"),
      id,
      key: z.enum(keys),
      label: labelSchema.partial(),
    })
    .strict(),
  z
    .object({
      op: z.literal("set_appearance"),
      id,
      appearance: appearanceSchema,
    })
    .strict(),
  z
    .object({ op: z.literal("set_presentation"), id, settings: presentation })
    .strict(),
  z
    .object({ op: z.literal("set_print"), widthCm: z.number().min(4).max(18) })
    .strict(),
  z.object({ op: z.literal("upgrade_document") }).strict(),
]);
export const revisionSchema = z
  .object({
    envelope: envelopeSchema,
    baseHash: z.string().regex(/^[a-f0-9]{64}$/),
    operations: z.array(operationSchema).max(30),
  })
  .strict();
export async function hash(e: Envelope) {
  const bytes = await globalThis.crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(canonical(e)),
  );
  return Array.from(new Uint8Array(bytes), (n) =>
    n.toString(16).padStart(2, "0"),
  ).join("");
}
export function apply(raw: Envelope, operations: unknown): Envelope {
  let next = structuredClone(validate(raw));
  for (const o of z.array(operationSchema).max(30).parse(operations)) {
    if (o.op === "upgrade_document") {
      next = upgrade(next);
      continue;
    }
    if (o.op === "set_print") {
      next.document.widthCm = o.widthCm;
      continue;
    }
    if (o.op === "add_shape") {
      const at =
        o.afterId === undefined
          ? next.document.shapes.length - 1
          : next.document.shapes.findIndex((s) => s.id === o.afterId);
      if (at < 0) throw Error("The preceding cuboid does not exist.");
      if (next.schemaVersion === 1 && o.shape.appearance)
        throw Error("Use upgrade_document before adding version-2 appearance.");
      let suffix = 1;
      while (next.document.shapes.some((s) => s.id === `cuboid-${suffix}`))
        suffix++;
      next.document.shapes.splice(
        at + 1,
        0,
        shape(o.shape, `cuboid-${suffix}`),
      );
      continue;
    }
    const at = next.document.shapes.findIndex((s) => s.id === o.id);
    if (at < 0) throw Error("Cuboid not found. Use its returned stable ID.");
    let s = next.document.shapes[at];
    if (o.op === "remove_shape") {
      next.document.shapes.splice(at, 1);
      continue;
    }
    if (o.op === "replace_shape") {
      if (o.shape.id !== undefined && o.shape.id !== o.id)
        throw Error("replace_shape retains the existing ID.");
      if (next.schemaVersion === 1 && o.shape.appearance)
        throw Error("Use upgrade_document before version-2 appearance.");
      next.document.shapes[at] = shape(o.shape, o.id);
      continue;
    }
    if (o.op === "set_dimension") s = setDimension(s, o.axis, o.value);
    if (o.op === "set_unit") s = setUnit(s, o.unit);
    if (o.op === "set_cube") {
      if (o.enabled && !s.cube && !o.referenceAxis)
        throw Error("Choose referenceAxis when enabling cube lock.");
      s.cube = o.enabled;
      if (o.enabled)
        s = setDimension(
          s,
          o.referenceAxis ?? "width",
          s.dimensions[o.referenceAxis ?? "width"],
        );
    }
    if (o.op === "set_cube_side") s = setCubeSide(s, o.value);
    if (o.op === "set_view") s.view = o.view;
    if (o.op === "set_projection") {
      if (o.direction !== undefined) s.direction = o.direction;
      if (o.projection !== undefined) s.projection = o.projection;
      if (o.schematic !== undefined) s.schematic = o.schematic;
      if (o.proportions !== undefined) s.proportions = o.proportions;
    }
    if (o.op === "set_label")
      s.labels[o.key] = { ...s.labels[o.key], ...o.label };
    if (o.op === "set_appearance") {
      if (next.schemaVersion === 1)
        throw Error(
          "Use upgrade_document before changing version-2 appearance.",
        );
      s.appearance = o.appearance;
    }
    if (o.op === "set_presentation") s = { ...s, ...o.settings };
    next.document.shapes[at] = s;
  }
  const e = validate(next);
  renderSvg(e);
  return e;
}
export async function reviseCuboid(raw: unknown) {
  const v = revisionSchema.parse(raw);
  if ((await hash(v.envelope)) !== v.baseHash)
    throw Error(
      "The baseHash does not match this definition. Use the last returned envelope and hash.",
    );
  return apply(v.envelope, v.operations);
}
export function printFacts(e: Envelope) {
  const visible = e.document.shapes.some(
    (s) =>
      s.title ||
      s.caption ||
      s.workedArea ||
      s.workedVolume ||
      s.counts ||
      s.layerNumbers ||
      keys.some((k) => s.labels[k].mode !== "hidden") ||
      appearance(s).area.mode !== "hidden",
  );
  return {
    recommendedScale: 1 as const,
    preserveAspectRatio: true as const,
    referenceFeatures: {
      textSizesPt: visible ? [11] : [],
      gridPitchMm: [],
      answerLineLengthsMm: [],
      tableRowHeightsMm: [],
    },
  };
}
