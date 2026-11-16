import { z } from "zod";
import * as core from "./index";
import { examples } from "./examples";
import { guidance, renderedTextSizesPt } from "../../graph-core/src/print-guidance";
import { LINE_WEIGHTS } from "../../envelope-core/src/house-style";

/** Connector adapter: the same schema and renderer as the browser editor. Nothing is ever worked out. */
export const exampleIds = examples.map((x) => x.id) as [string, ...string[]];
const show = z.enum(["show", "hidden"]);
const text = z.string().max(core.MAX_TEXT);
const fill = z.enum(core.FILLS);
export const outputViewSchema = z.enum(["pupil", "answer"]);

/** A label: text ("" is a pupil blank) or {text, hidden}. */
const item = z.union([text, z.object({ text, hidden: z.boolean().optional() }).strict()]);
const caption = z.string().max(core.MAX_CAPTION);
const spinnerInput = z
  .object({
    type: z.literal("spinner"),
    /** The sector labels, clockwise from the first. */
    labels: z.array(item).min(core.MIN_SECTORS).max(core.MAX_SECTORS),
    /** Sector angles in degrees, one per label; null shares what is left. Omit for equal sectors. */
    angles: z.array(z.number().positive().max(360).nullable()).max(core.MAX_SECTORS).optional(),
    fills: z.array(fill).max(core.MAX_SECTORS).optional(),
    shape: core.spinnerSchema.shape.shape.optional(),
    rotation: core.spinnerSchema.shape.rotation.optional(),
    pointer: core.spinnerSchema.shape.pointer.optional(),
    pointerAngle: core.spinnerSchema.shape.pointerAngle.optional(),
    rightAngles: z.boolean().optional(),
    sizeMm: core.spinnerSchema.shape.sizeMm.optional(),
    emptyLabels: core.spinnerSchema.shape.emptyLabels.optional(),
    caption: caption.optional(),
  })
  .strict();
const diceInput = z
  .object({
    type: z.literal("dice"),
    view: core.diceSchema.shape.view.optional(),
    /** Cube: front, top, right. Faces: 1 to 6, left to right. */
    faces: z.array(item).min(1).max(core.MAX_FACES).optional(),
    marks: core.diceSchema.shape.marks.optional(),
    sizeMm: core.diceSchema.shape.sizeMm.optional(),
    emptyLabels: core.diceSchema.shape.emptyLabels.optional(),
    caption: caption.optional(),
  })
  .strict();
const bagInput = z
  .object({
    type: z.literal("bag"),
    groups: z
      .array(z.object({ label: item.optional(), fill: fill.optional(), count: z.number().int().min(1).max(core.MAX_COUNTERS) }).strict())
      .min(1)
      .max(core.MAX_GROUPS),
    caption: caption.optional(),
  })
  .strict();
export const objectInput = z.discriminatedUnion("type", [spinnerInput, diceInput, bagInput]);
export const specSchema = z
  .object({
    example: z.enum(exampleIds).optional(),
    worked: z.boolean().optional(),
    objects: z.array(objectInput).min(1).max(core.MAX_OBJECTS).optional(),
    lines: z.enum(LINE_WEIGHTS).optional(),
  })
  .strict();
export const createSchema = z
  .object({ envelope: core.envelopeSchema.optional(), spec: specSchema.optional(), outputView: outputViewSchema.optional() })
  .strict();
const objectRef = z.string().max(24).describe('An object ID such as "o1".');
const slotRef = z
  .string()
  .regex(/^(sector:(1[01]|\d)|face:[0-5]|group:[0-5])$/)
  .describe('"sector:0" (a spinner\'s first sector), "face:0" (a dice\'s first face: front on a cube) or "group:0" (a bag\'s first group).');
export const operationSchema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("set_label"), objectId: objectRef, slot: slotRef, text: text.optional(), show: show.optional() }).strict(),
  z.object({ op: z.literal("replace_object"), objectId: objectRef, object: objectInput }).strict(),
  z.object({ op: z.literal("add_object"), object: objectInput }).strict(),
  z.object({ op: z.literal("remove_object"), objectId: objectRef }).strict(),
  z.object({ op: z.literal("move_object"), objectId: objectRef, by: z.union([z.literal(-1), z.literal(1)]) }).strict(),
  z.object({ op: z.literal("set_settings"), settings: z.object({ lines: z.enum(LINE_WEIGHTS) }).partial().strict() }).strict(),
]);
export const revisionSchema = z
  .object({
    envelope: core.envelopeSchema,
    baseHash: z.string().regex(/^[a-f0-9]{64}$/),
    operations: z.array(operationSchema).max(40),
    outputView: outputViewSchema.optional(),
  })
  .strict();

function toValue(input: z.infer<typeof item> | undefined): core.Value {
  if (input === undefined) return core.value();
  const t = (typeof input === "string" ? input : input.text).trim(),
    hidden = typeof input === "object" && !!input.hidden;
  if (hidden && !t) throw Error("A blank cannot hold a hidden answer. Give its value, then hide it.");
  return core.value(t, hidden ? "hidden" : "show");
}
/** Builds an object from connector input, starting from the editor's defaults. */
export function buildObject(objectId: string, input: z.infer<typeof objectInput>): core.ProbabilityObject {
  if (input.type === "spinner") {
    const s = core.newSpinner(objectId, []);
    if (input.angles && input.angles.length !== input.labels.length) throw Error("Give one angle per label (null for an equal share of what is left).");
    if (input.fills && input.fills.length !== input.labels.length) throw Error("Give one fill per label.");
    s.sectors = input.labels.map((l, i) => ({ label: toValue(l), fill: input.fills?.[i] ?? "none", angle: input.angles?.[i] ?? null }));
    if (input.shape === "polygon") {
      s.shape = "polygon";
      s.pointer = "stick";
      s.pointerAngle = 25;
    }
    for (const k of ["rotation", "pointer", "pointerAngle", "rightAngles", "sizeMm", "emptyLabels", "caption"] as const)
      if (input[k] !== undefined) (s as Record<string, unknown>)[k] = input[k];
    return s;
  }
  if (input.type === "dice") {
    const d = core.newDice(objectId, input.view ?? "cube");
    if (input.faces) d.faces = input.faces.map(toValue);
    for (const k of ["marks", "sizeMm", "emptyLabels", "caption"] as const) if (input[k] !== undefined) (d as Record<string, unknown>)[k] = input[k];
    return d;
  }
  return {
    ...core.newBag(objectId),
    groups: input.groups.map((g) => ({ label: toValue(g.label), fill: g.fill ?? "none", count: g.count })),
    caption: input.caption ?? "",
  };
}
function settings(e: core.Envelope, s: { lines?: "normal" | "bold" }): core.Envelope {
  const n = structuredClone(e);
  if (s.lines === "bold") n.document.lines = "bold";
  else if (s.lines === "normal") delete n.document.lines;
  return core.validate(n);
}

export function create(input: unknown): core.Envelope {
  const v = createSchema.parse(input);
  if (v.envelope && v.spec) throw Error("Supply spec or envelope, not both.");
  if (v.envelope) return core.validate(v.envelope);
  const s = v.spec;
  if (!s) return core.create();
  if (s.example && s.objects) throw Error("Examples already contain their objects; revise the result instead.");
  let e: core.Envelope;
  if (s.example) e = examples.find((x) => x.id === s.example)!.make(false);
  else {
    const base = core.create();
    e = core.validate({ ...base, document: { objects: (s.objects ?? [{ type: "spinner", labels: ["1", "2", "3", "4"] }]).map((o, i) => buildObject(`o${i + 1}`, o)) } });
  }
  e = settings(e, s);
  if (s.worked) e = core.forView(e, "answer");
  return e;
}

export async function revise(input: unknown): Promise<core.Envelope> {
  const v = revisionSchema.parse(input);
  if ((await core.hash(v.envelope)) !== v.baseHash) throw Error("stale_hash: Use the exact returned envelope and contentHash.");
  let e = core.validate(structuredClone(v.envelope));
  for (const op of v.operations) {
    switch (op.op) {
      case "set_label":
        e = core.setLabel(e, op.objectId, op.slot as core.Slot, { text: op.text, show: op.show });
        break;
      case "replace_object":
        e = core.replaceObject(e, op.objectId, buildObject(op.objectId, op.object));
        break;
      case "add_object":
        e = core.addObject(e, buildObject("o0", op.object));
        break;
      case "remove_object":
        e = core.removeObject(e, op.objectId);
        break;
      case "move_object":
        e = core.moveObject(e, op.objectId, op.by);
        break;
      case "set_settings":
        e = settings(e, op.settings);
        break;
    }
  }
  return e;
}

export function printFacts(e: core.Envelope, view: "pupil" | "answer" = "pupil") {
  const shown = core.forView(e, view);
  return guidance({
    textSizesPt: renderedTextSizesPt(core.renderSvg(shown), 72 / 25.4),
    gridPitchMm: [],
    tableRowHeightsMm: [],
    answerLineLengthsMm: [],
  });
}
