import { z } from "zod";
import * as core from "./index";
import { examples } from "./examples";
import { guidance, renderedTextSizesPt } from "../../graph-core/src/print-guidance";

/** Connector adapter: the same schema, geometry and renderer as the browser editor. */
export const exampleIds = examples.map((x) => x.id) as [string, ...string[]];
const id = z.string().regex(/^[A-Za-z][A-Za-z0-9_'-]{0,15}$/);
const text = (max: number) => z.string().max(max);
const num = z.number().finite();
const compass = core.pointSchema.shape.labelAt;

/** answer:true saves the item as an answer: left out of the pupil copy, printed on the answer copy. */
const common = { id: id.optional(), answer: z.boolean().optional() };
const labelled = { label: text(40).optional(), labelHidden: z.boolean().optional() };
const measure = z
  .object({ scaleCm: num.positive().optional(), represents: num.positive().optional(), unit: text(12).optional() })
  .strict();

export const pointInput = z
  .object({
    id,
    x: num,
    y: num,
    /** Defaults to the ID. Use "" for an unlabelled point. */
    label: text(40).optional(),
    labelHidden: z.boolean().optional(),
    labelAt: compass.optional(),
    mark: core.pointSchema.shape.mark.optional(),
    answer: z.boolean().optional(),
  })
  .strict();
export const objectInput = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("segment"),
      ...common,
      from: id,
      to: id,
      extend: z.array(num.min(0).max(30)).length(2).optional(),
      dash: z.boolean().optional(),
      ...labelled,
      /** Explicitly writes the measured length into the label, in the scale's units. */
      measure: measure.optional(),
    })
    .strict(),
  z.object({ type: z.literal("arc"), ...common, center: id, radius: num, start: num, sweep: num, dash: z.boolean().optional() }).strict(),
  z
    .object({
      type: z.literal("angle"),
      ...common,
      at: id,
      from: id,
      to: id,
      style: z.enum(["arc", "right"]).optional(),
      reflex: z.boolean().optional(),
      ...labelled,
      measure: z.boolean().optional(),
    })
    .strict(),
  z.object({ type: z.literal("north"), ...common, at: id, length: num.optional() }).strict(),
  z
    .object({ type: z.literal("bearing"), ...common, from: id, to: id, northLine: z.boolean().optional(), ...labelled, measure: z.boolean().optional() })
    .strict(),
  z.object({ type: z.literal("polygon"), ...common, points: z.array(id).min(3).max(12), dash: z.boolean().optional() }).strict(),
  z
    .object({ type: z.literal("text"), ...common, x: num, y: num, text: text(40), hidden: z.boolean().optional(), italic: z.boolean().optional() })
    .strict(),
  z
    .object({ type: z.literal("region"), ...common, rules: z.array(core.ruleSchema).min(1).max(core.MAX_RULES), pattern: z.enum(["hatch", "cross"]).optional() })
    .strict(),
]);
const helper = { group: id.optional(), answer: z.boolean().optional() };
export const constructionInput = z.discriminatedUnion("type", [
  z.object({ type: z.literal("perpendicular-bisector"), ...helper, a: id, b: id, radius: num.optional(), extend: num.min(0).max(30).optional(), reach: id.optional() }).strict(),
  z.object({ type: z.literal("angle-bisector"), ...helper, at: id, from: id, to: id, radius: num.optional(), extend: num.min(0).max(30).optional(), reach: id.optional() }).strict(),
  z.object({ type: z.literal("perpendicular-from-point"), ...helper, point: id, a: id, b: id, radius: num.optional() }).strict(),
  z
    .object({ type: z.literal("perpendicular-at-point"), ...helper, point: id, a: id, b: id, radius: num.optional(), side: z.enum(["left", "right"]).optional() })
    .strict(),
  z.object({ type: z.literal("locus-point"), ...helper, point: id, distance: num.positive(), dash: z.boolean().optional() }).strict(),
  z.object({ type: z.literal("locus-segment"), ...helper, a: id, b: id, distance: num.positive(), dash: z.boolean().optional() }).strict(),
  z
    .object({
      type: z.literal("point-by-bearing"),
      id,
      from: id,
      bearing: num.min(0).max(360),
      distance: num.positive(),
      label: text(40).optional(),
      mark: core.pointSchema.shape.mark.optional(),
      answer: z.boolean().optional(),
    })
    .strict(),
]);
const drawing = {
  widthCm: num.optional(),
  heightCm: num.optional(),
  grid: z.enum(["none", "cm"]).optional(),
  border: z.boolean().optional(),
  caption: text(40).optional(),
  captionHidden: z.boolean().optional(),
};
export const outputViewSchema = z.enum(["pupil", "answer"]);
export const specSchema = z
  .object({
    example: z.enum(exampleIds).optional(),
    worked: z.boolean().optional(),
    ...drawing,
    points: z.array(pointInput).max(core.MAX_POINTS).optional(),
    objects: z.array(objectInput).max(core.MAX_OBJECTS).optional(),
    constructions: z.array(constructionInput).max(20).optional(),
  })
  .strict();
export const createSchema = z
  .object({ envelope: core.envelopeSchema.optional(), spec: specSchema.optional(), outputView: outputViewSchema.optional() })
  .strict();

const objectFields = z
  .object({
    from: id,
    to: id,
    at: id,
    center: id,
    points: z.array(id).min(3).max(12),
    extend: z.array(num.min(0).max(30)).length(2),
    dash: z.boolean(),
    label: text(40),
    labelHidden: z.boolean(),
    radius: num,
    start: num,
    sweep: num,
    style: z.enum(["arc", "right"]),
    reflex: z.boolean(),
    length: num,
    northLine: z.boolean(),
    x: num,
    y: num,
    text: text(40),
    hidden: z.boolean(),
    italic: z.boolean(),
    rules: z.array(core.ruleSchema).min(1).max(core.MAX_RULES),
    pattern: z.enum(["hatch", "cross"]),
    answer: z.boolean(),
  })
  .partial()
  .strict();
export const operationSchema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("set_drawing"), ...drawing }).strict(),
  z.object({ op: z.literal("add_point"), point: pointInput }).strict(),
  z.object({ op: z.literal("set_point"), id, point: pointInput.omit({ id: true }).partial() }).strict(),
  z.object({ op: z.literal("add_object"), object: objectInput }).strict(),
  z.object({ op: z.literal("set_object"), id, fields: objectFields }).strict(),
  z.object({ op: z.literal("add_construction"), construction: constructionInput }).strict(),
  z.object({ op: z.literal("remove"), ids: z.array(id).min(1).max(60) }).strict(),
  z.object({ op: z.literal("remove_group"), group: id }).strict(),
  z.object({ op: z.literal("set_answer"), ids: z.array(id).min(1).max(60), answer: z.boolean() }).strict(),
  z.object({ op: z.literal("measure"), id, scaleCm: num.positive().optional(), represents: num.positive().optional(), unit: text(12).optional() }).strict(),
  z.object({ op: z.literal("show_all") }).strict(),
]);
export const revisionSchema = z
  .object({
    envelope: core.envelopeSchema,
    baseHash: z.string().regex(/^[a-f0-9]{64}$/),
    operations: z.array(operationSchema).max(30),
    outputView: outputViewSchema.optional(),
  })
  .strict();

type PointInput = z.infer<typeof pointInput>;
type ObjectInput = z.infer<typeof objectInput>;
type ConstructionInput = z.infer<typeof constructionInput>;
const role = (answer: boolean | undefined, fallback: core.Role = "given"): core.Role => (answer === undefined ? fallback : answer ? "answer" : "given");
const lbl = (t: string | undefined, hidden: boolean | undefined) => core.label(t ?? "", hidden ? "hidden" : "show");

function point(p: PointInput): core.Point {
  return {
    id: p.id,
    x: p.x,
    y: p.y,
    label: lbl(p.label ?? p.id, p.labelHidden),
    labelAt: p.labelAt ?? "auto",
    mark: p.mark ?? "cross",
    role: role(p.answer),
  };
}
function addPoint(e: core.Envelope, p: PointInput) {
  const n = structuredClone(e);
  n.document.points.push(point(p));
  return core.validate(n);
}
function object(d: core.ConstructionDocument, o: ObjectInput): core.Obj {
  const oid = o.id ?? core.freshId(d, o.type === "segment" ? "s" : o.type);
  const r = role(o.answer);
  switch (o.type) {
    case "segment":
      return { id: oid, type: "segment", from: o.from, to: o.to, extend: (o.extend as [number, number]) ?? [0, 0], dash: !!o.dash, label: lbl(o.label, o.labelHidden), role: r };
    case "arc":
      return { id: oid, type: "arc", center: o.center, radius: o.radius, start: o.start, sweep: o.sweep, dash: !!o.dash, role: r };
    case "angle":
      return { id: oid, type: "angle", at: o.at, from: o.from, to: o.to, style: o.style ?? "arc", reflex: !!o.reflex, label: lbl(o.label, o.labelHidden), role: r };
    case "north":
      return { id: oid, type: "north", at: o.at, length: o.length ?? 2, role: r };
    case "bearing":
      return { id: oid, type: "bearing", from: o.from, to: o.to, northLine: o.northLine ?? true, label: lbl(o.label, o.labelHidden), role: r };
    case "polygon":
      return { id: oid, type: "polygon", points: o.points, dash: !!o.dash, role: r };
    case "text":
      return { id: oid, type: "text", x: o.x, y: o.y, label: lbl(o.text, o.hidden), italic: !!o.italic, role: r };
    case "region":
      return { id: oid, type: "region", rules: o.rules, pattern: o.pattern ?? "hatch", role: r };
  }
}
function measureItem(e: core.Envelope, oid: string, scale: { scaleCm?: number; represents?: number; unit?: string }) {
  const o = core.objectById(e.document, oid);
  if (o?.type === "segment") return core.measureSegment(e, oid, { cm: scale.scaleCm ?? 1, per: scale.represents ?? scale.scaleCm ?? 1, unit: scale.unit ?? "cm" });
  if (o?.type === "bearing") return core.measureBearing(e, oid);
  if (o?.type === "angle") return core.measureAngle(e, oid);
  throw Error(`measure works on a segment, angle or bearing; ${oid} is not one.`);
}
function addObject(e: core.Envelope, o: ObjectInput) {
  const n = structuredClone(e);
  const made = object(n.document, o);
  n.document.objects.push(made);
  let out = core.validate(n);
  if ("measure" in o && o.measure) out = measureItem(out, made.id, typeof o.measure === "object" ? o.measure : {});
  return out;
}
function construct(e: core.Envelope, c: ConstructionInput): core.Envelope {
  const base = { group: "group" in c ? c.group : undefined, role: role(c.answer, "answer") };
  switch (c.type) {
    case "perpendicular-bisector":
      return core.perpendicularBisector(e, { ...base, a: c.a, b: c.b, radius: c.radius, extend: c.extend, reach: c.reach });
    case "angle-bisector":
      return core.angleBisector(e, { ...base, at: c.at, from: c.from, to: c.to, radius: c.radius, extend: c.extend, reach: c.reach });
    case "perpendicular-from-point":
      return core.perpendicularFromPoint(e, { ...base, point: c.point, a: c.a, b: c.b, radius: c.radius });
    case "perpendicular-at-point":
      return core.perpendicularAtPoint(e, { ...base, point: c.point, a: c.a, b: c.b, radius: c.radius, side: c.side });
    case "locus-point":
      return core.locusFromPoint(e, { ...base, point: c.point, distance: c.distance, dash: c.dash });
    case "locus-segment":
      return core.locusFromSegment(e, { ...base, a: c.a, b: c.b, distance: c.distance, dash: c.dash });
    case "point-by-bearing":
      return core.pointByBearing(e, { id: c.id, from: c.from, bearing: c.bearing, distance: c.distance, label: c.label, mark: c.mark, role: role(c.answer) });
  }
}
function setDrawing(e: core.Envelope, s: Partial<Record<keyof typeof drawing, unknown>>) {
  const n = structuredClone(e),
    d = n.document;
  if (s.widthCm !== undefined) d.width = s.widthCm as number;
  if (s.heightCm !== undefined) d.height = s.heightCm as number;
  if (s.grid !== undefined) d.grid = s.grid as "none" | "cm";
  if (s.border !== undefined) d.border = s.border as boolean;
  if (s.caption !== undefined) d.caption.text = s.caption as string;
  if (s.captionHidden !== undefined) d.caption.show = s.captionHidden ? "hidden" : "show";
  return core.validate(n);
}
const APPLIES: Record<core.Obj["type"], string[]> = {
  segment: ["from", "to", "extend", "dash", "label", "labelHidden", "answer"],
  arc: ["center", "radius", "start", "sweep", "dash", "answer"],
  angle: ["at", "from", "to", "style", "reflex", "label", "labelHidden", "answer"],
  north: ["at", "length", "answer"],
  bearing: ["from", "to", "northLine", "label", "labelHidden", "answer"],
  polygon: ["points", "dash", "answer"],
  text: ["x", "y", "text", "hidden", "italic", "answer"],
  region: ["rules", "pattern", "answer"],
};
function setObject(e: core.Envelope, oid: string, fields: z.infer<typeof objectFields>) {
  const n = structuredClone(e);
  const o = core.objectById(n.document, oid) as Record<string, unknown> & core.Obj;
  if (!o) throw Error(`Unknown object ${oid}. Use IDs from the returned envelope.`);
  const allowed = APPLIES[o.type];
  for (const [k, v] of Object.entries(fields)) {
    if (v === undefined) continue;
    if (!allowed.includes(k)) throw Error(`${k} does not apply to ${o.type} ${oid}; use ${allowed.join(", ")}.`);
    if (k === "answer") o.role = v ? "answer" : "given";
    else if (k === "label" || k === "text") (o as { label: core.Label }).label.text = v as string;
    else if (k === "labelHidden" || k === "hidden") (o as { label: core.Label }).label.show = v ? "hidden" : "show";
    else o[k] = v;
  }
  return core.validate(n);
}
function setPoint(e: core.Envelope, pid: string, f: Partial<PointInput>) {
  const n = structuredClone(e);
  const p = core.pointById(n.document, pid);
  if (!p) throw Error(`Unknown point ${pid}. Use IDs from the returned envelope.`);
  if (f.x !== undefined) p.x = f.x;
  if (f.y !== undefined) p.y = f.y;
  if (f.label !== undefined) p.label.text = f.label;
  if (f.labelHidden !== undefined) p.label.show = f.labelHidden ? "hidden" : "show";
  if (f.labelAt !== undefined) p.labelAt = f.labelAt;
  if (f.mark !== undefined) p.mark = f.mark;
  if (f.answer !== undefined) p.role = f.answer ? "answer" : "given";
  return core.validate(n);
}

export function create(input: unknown): core.Envelope {
  const v = createSchema.parse(input);
  if (v.envelope && v.spec) throw Error("Supply spec or envelope, not both.");
  if (v.envelope) return core.validate(v.envelope);
  const s = v.spec;
  if (!s) return core.create();
  if (s.example && (s.points || s.objects || s.constructions))
    throw Error("Examples already contain their points and objects; revise the result instead.");
  let e: core.Envelope = s.example ? examples.find((x) => x.id === s.example)!.make(false) : core.blank(s.widthCm ?? 12, s.heightCm ?? 8);
  e = setDrawing(e, s);
  for (const p of s.points ?? []) e = addPoint(e, p);
  const bearings = (s.constructions ?? []).filter((c) => c.type === "point-by-bearing");
  for (const c of bearings) e = construct(e, c);
  const objects = s.objects ?? [];
  for (const o of objects.filter((x) => x.type !== "region")) e = addObject(e, o);
  for (const c of (s.constructions ?? []).filter((x) => x.type !== "point-by-bearing")) e = construct(e, c);
  for (const o of objects.filter((x) => x.type === "region")) e = addObject(e, o);
  if (s.worked) e = core.forView(e, "answer");
  return e;
}

export async function revise(input: unknown): Promise<core.Envelope> {
  const v = revisionSchema.parse(input);
  if ((await core.hash(v.envelope)) !== v.baseHash) throw Error("base_hash_mismatch: Use the exact returned envelope and contentHash.");
  let e = core.validate(structuredClone(v.envelope));
  for (const op of v.operations) {
    switch (op.op) {
      case "set_drawing":
        e = setDrawing(e, op);
        break;
      case "add_point":
        e = addPoint(e, op.point);
        break;
      case "set_point":
        e = setPoint(e, op.id, op.point);
        break;
      case "add_object":
        e = addObject(e, op.object);
        break;
      case "set_object":
        e = setObject(e, op.id, op.fields);
        break;
      case "add_construction":
        e = construct(e, op.construction);
        break;
      case "remove": {
        const known = new Set([...e.document.points.map((p) => p.id), ...e.document.objects.map((o) => o.id)]);
        const missing = op.ids.filter((x) => !known.has(x));
        if (missing.length) throw Error(`Unknown IDs ${missing.join(", ")}.`);
        e = core.remove(e, op.ids);
        break;
      }
      case "remove_group":
        e = core.removeGroup(e, op.group);
        break;
      case "set_answer":
        e = core.setRole(e, op.ids, op.answer ? "answer" : "given");
        break;
      case "measure":
        e = measureItem(e, op.id, op);
        break;
      case "show_all":
        e = core.forView(e, "answer");
        break;
    }
  }
  return e;
}

export function printFacts(e: core.Envelope, view: "pupil" | "answer" = "pupil") {
  return guidance({
    textSizesPt: renderedTextSizesPt(core.renderSvg(core.forView(e, view)), 72 / 25.4),
    gridPitchMm: e.document.grid === "cm" ? [10] : [],
    tableRowHeightsMm: [],
    answerLineLengthsMm: [],
  });
}
