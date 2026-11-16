import { z } from "zod";
import * as core from "./index";
import { examples } from "./examples";
import { guidance, renderedTextSizesPt } from "../../graph-core/src/print-guidance";

/** Connector adapter: the same schema and renderer as the browser editor. */
export const exampleIds = examples.map((x) => x.id) as [string, ...string[]];
const id = z.string().max(8);
const labelInput = z
  .object({
    /** Defaults: text with a digit is a given value, letters alone a symbol, no text a blank. */
    state: z.enum(core.STATES).optional(),
    text: z.string().max(core.MAX_LABEL).optional(),
    answer: z.string().max(core.MAX_LABEL).optional(),
  })
  .strict();
const pointInput = z
  .object({
    id,
    /** Where the point goes (see placeTypes in diagram_capabilities). */
    place: core.placeSchema.optional(),
    name: z.string().max(3).optional(),
    show: z.enum(core.SHOWS).optional(),
  })
  .strict();
const circleInput = z.object({ id, centre: id.optional(), r: z.number().finite().min(5).max(90).optional(), style: z.enum(core.STYLES).optional() }).strict();
const segmentInput = z
  .object({
    id,
    a: id.optional(),
    b: id.optional(),
    style: z.enum(core.STYLES).optional(),
    extend: z.array(z.number().finite().min(0).max(80)).length(2).optional(),
    ticks: z.number().int().min(0).max(3).optional(),
    arrows: z.number().int().min(0).max(3).optional(),
    label: labelInput.optional(),
    side: z.enum(core.SIDES).optional(),
  })
  .strict();
const angleInput = z
  .object({ id, at: id.optional(), from: id.optional(), to: id.optional(), label: labelInput.optional(), mark: z.enum(core.MARKS).optional(), shade: z.boolean().optional() })
  .strict();
const fillInput = core.fillSchema;
const captionInput = core.captionSchema.partial({ bold: true });
const settings = z
  .object({
    notToScale: z.boolean(),
    fontPt: z.number().int().min(10).max(14),
    lines: z.enum(["normal", "bold"]),
  })
  .partial()
  .strict();
export const outputViewSchema = z.enum(["pupil", "answer"]);
export const specSchema = z
  .object({
    example: z.enum(exampleIds).optional().describe("A starting figure redrawn from a Question Bank question; revise the result to change it."),
    worked: z.boolean().optional().describe("With example: also save the mark scheme's answers, printed only on the answers copy."),
    points: z.array(pointInput).max(core.LIMITS.points).optional().describe("The points: each {id, place, name?, show?}. Every other object refers to points by id."),
    circles: z.array(circleInput).max(core.LIMITS.circles).optional().describe("Circles: {id, centre (a point id), r in mm, style?}."),
    segments: z.array(segmentInput).max(core.LIMITS.segments).optional().describe("Straight lines between two points, with optional extension, ticks, parallel arrows and a length label."),
    angles: z.array(angleInput).max(core.LIMITS.angles).optional().describe("Marked angles: vertex at, sweeping anticlockwise from the arm to from to the arm to to."),
    fills: z.array(fillInput).max(core.LIMITS.fills).optional().describe("Grey regions: {id, points: [point ids in order]}."),
    captions: z.array(captionInput).max(core.LIMITS.captions).optional().describe("Free text such as \"Triangle A\": {id, x, y, text, bold?}."),
    settings: settings.optional().describe("notToScale, fontPt (10-14) and lines (normal or bold)."),
  })
  .strict();
export const createSchema = z.object({ envelope: core.envelopeSchema.optional(), spec: specSchema.optional(), outputView: outputViewSchema.optional() }).strict();
export const operationSchema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("set_point"), point: pointInput }).strict(),
  z.object({ op: z.literal("set_circle"), circle: circleInput }).strict(),
  z.object({ op: z.literal("set_segment"), segment: segmentInput }).strict(),
  z.object({ op: z.literal("set_angle"), angle: angleInput }).strict(),
  z.object({ op: z.literal("set_fill"), fill: fillInput }).strict(),
  z.object({ op: z.literal("set_caption"), caption: captionInput }).strict(),
  z.object({ op: z.literal("remove"), what: z.enum(["point", "circle", "segment", "angle", "fill", "caption"]), id }).strict(),
  z.object({ op: z.literal("set_settings"), settings }).strict(),
]);
export const revisionSchema = z
  .object({ envelope: core.envelopeSchema, baseHash: z.string().regex(/^[a-f0-9]{64}$/), operations: z.array(operationSchema).max(40), outputView: outputViewSchema.optional() })
  .strict();

type LabelInput = z.infer<typeof labelInput>;
function defaultState(text: string, answer: string): core.LabelState {
  if (!text.trim()) return "blank";
  // A given length or size never holds an answer, so text with a saved answer is something to find (as in the editor).
  return /\d/.test(text) && !answer.trim() ? "value" : "symbol";
}
function toLabel(input: LabelInput | undefined, base: core.Label): core.Label {
  const out = structuredClone(base);
  if (!input) return out;
  if (input.text !== undefined) out.text = input.text;
  if (input.answer !== undefined) out.answer = input.answer;
  if (input.state) out.state = input.state;
  else if (input.text !== undefined) out.state = defaultState(input.text, out.answer);
  return out;
}
const need = <T>(v: T | undefined, what: string): T => {
  if (v === undefined) throw Error(`A new ${what} needs every field marked required in the schema.`);
  return v;
};
function upsert<T extends { id: string }>(list: T[], item: { id: string }, make: (base: T | undefined) => T) {
  const i = list.findIndex((x) => x.id === item.id);
  if (i >= 0) list[i] = make(list[i]);
  else list.push(make(undefined));
}
function setPoint(d: core.FigureDocument, p: z.infer<typeof pointInput>) {
  upsert(d.points, p, (b) => ({ id: p.id, place: p.place ?? need(b?.place, `point (${p.id}: place)`), name: p.name ?? b?.name ?? "", show: p.show ?? b?.show ?? "none" }));
}
function setCircle(d: core.FigureDocument, c: z.infer<typeof circleInput>) {
  upsert(d.circles, c, (b) => ({ id: c.id, centre: c.centre ?? need(b?.centre, `circle (${c.id}: centre)`), r: c.r ?? need(b?.r, `circle (${c.id}: r)`), style: c.style ?? b?.style ?? "solid" }));
}
function setSegment(d: core.FigureDocument, s: z.infer<typeof segmentInput>) {
  upsert(d.segments, s, (b) => {
    const base = b ?? core.segment(s.id, need(s.a, `segment (${s.id}: a)`), need(s.b, `segment (${s.id}: b)`));
    return {
      ...base,
      a: s.a ?? base.a,
      b: s.b ?? base.b,
      style: s.style ?? base.style,
      extend: s.extend ?? base.extend,
      ticks: s.ticks ?? base.ticks,
      arrows: s.arrows ?? base.arrows,
      side: s.side ?? base.side,
      label: toLabel(s.label, base.label),
    };
  });
}
function setAngle(d: core.FigureDocument, a: z.infer<typeof angleInput>) {
  upsert(d.angles, a, (b) => {
    const base = b ?? core.angle(a.id, need(a.at, `angle (${a.id}: at)`), need(a.from, `angle (${a.id}: from)`), need(a.to, `angle (${a.id}: to)`));
    return { ...base, at: a.at ?? base.at, from: a.from ?? base.from, to: a.to ?? base.to, mark: a.mark ?? base.mark, shade: a.shade ?? base.shade, label: toLabel(a.label, base.label) };
  });
}
function applySettings(d: core.FigureDocument, s: z.infer<typeof settings>) {
  if (s.notToScale !== undefined) d.notToScale = s.notToScale;
  if (s.fontPt !== undefined) d.fontPt = s.fontPt === 11 ? undefined : s.fontPt;
  if (s.lines !== undefined) d.lines = s.lines === "bold" ? "bold" : undefined;
}
/** Removing a point or circle that anything still uses is refused, naming the users, so nothing goes unseen. */
function remove(d: core.FigureDocument, what: string, rid: string) {
  const lists: Record<string, { id: string }[]> = { point: d.points, circle: d.circles, segment: d.segments, angle: d.angles, fill: d.fills, caption: d.captions };
  const list = lists[what];
  if (!list.some((x) => x.id === rid)) throw Error(`There is no ${what} ${rid} to remove.`);
  if (what === "point" || what === "circle") {
    const u = core.dependents(d, what, rid, true);
    const users = [
      ...u.points.map((x) => `point ${x}`),
      ...u.circles.map((x) => `circle ${x}`),
      ...u.segments.map((x) => `segment ${x}`),
      ...u.angles.map((x) => `angle ${x}`),
      ...u.fills.map((x) => `fill ${x}`),
    ];
    if (users.length) throw Error(`${what === "point" ? "Point" : "Circle"} ${rid} is used by ${users.join(", ")}. Remove or change those first.`);
  }
  const i = list.findIndex((x) => x.id === rid);
  list.splice(i, 1);
}
const withDoc = (e: core.Envelope, f: (d: core.FigureDocument) => void) => {
  const n = structuredClone(e);
  f(n.document);
  return core.validate(n);
};

export function create(input: unknown): core.Envelope {
  const v = createSchema.parse(input);
  if (v.envelope && v.spec) throw Error("Supply spec or envelope, not both.");
  if (v.envelope) return core.validate(v.envelope);
  const s = v.spec;
  if (!s) return core.create();
  if (s.example && (s.points || s.segments || s.circles || s.angles || s.fills || s.captions)) throw Error("Examples already contain their figure; revise the result instead.");
  const base = s.example ? examples.find((x) => x.id === s.example)!.make(!!s.worked) : core.blank();
  return withDoc(base, (d) => {
    if (!s.example && s.points) d.points = [];
    for (const p of s.points ?? []) setPoint(d, p);
    for (const c of s.circles ?? []) setCircle(d, c);
    for (const x of s.segments ?? []) setSegment(d, x);
    for (const a of s.angles ?? []) setAngle(d, a);
    if (s.fills) d.fills = s.fills;
    if (s.captions) d.captions = s.captions.map((c) => ({ ...c, bold: c.bold ?? false }));
    if (s.settings) applySettings(d, s.settings);
  });
}

export async function revise(input: unknown): Promise<core.Envelope> {
  const v = revisionSchema.parse(input);
  if ((await core.hash(v.envelope)) !== v.baseHash) throw Error("stale_hash: Use the exact returned envelope and contentHash.");
  // Every set operation applies first, in order, then every remove, and the result is checked once. So a point and the
  // objects using it can arrive in any order, and a remove sees the figure after the changes that free the object.
  const ordered = v.operations.filter((op) => op.op !== "remove");
  const removes = v.operations.flatMap((op) => (op.op === "remove" ? [op] : []));
  return withDoc(core.validate(structuredClone(v.envelope)), (d) => {
    for (const op of ordered) {
      if (op.op === "set_point") setPoint(d, op.point);
      if (op.op === "set_circle") setCircle(d, op.circle);
      if (op.op === "set_segment") setSegment(d, op.segment);
      if (op.op === "set_angle") setAngle(d, op.angle);
      if (op.op === "set_fill") upsert(d.fills, op.fill, () => op.fill);
      if (op.op === "set_caption") upsert(d.captions, op.caption, (b) => ({ ...op.caption, bold: op.caption.bold ?? b?.bold ?? false }));
      if (op.op === "set_settings") applySettings(d, op.settings);
    }
    // Removes go in whatever order works: one refused because something still uses it is tried again after the rest.
    let left = removes;
    while (left.length) {
      const refused: typeof left = [];
      let first: unknown = null;
      for (const op of left)
        try {
          remove(d, op.what, op.id);
        } catch (err) {
          refused.push(op);
          first ??= err;
        }
      if (refused.length === left.length) throw first;
      left = refused;
    }
  });
}

export function printFacts(e: core.Envelope, view: "pupil" | "answer" = "pupil") {
  return guidance({
    textSizesPt: renderedTextSizesPt(core.renderSvg(e, view), 72 / 25.4),
    gridPitchMm: [],
    tableRowHeightsMm: [],
    answerLineLengthsMm: [],
  });
}
