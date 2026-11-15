import { z } from "zod";
import * as core from "./index";
import { examples } from "./examples";
import { guidance, renderedTextSizesPt } from "../../graph-core/src/print-guidance";

/** Connector adapter: the same schema and renderer as the browser editor. */
export const exampleIds = examples.map((x) => x.id) as [string, ...string[]];
const xy = z.object({ x: z.number().finite(), y: z.number().finite() }).strict();
const shapeInput = z
  .object({
    type: z.enum(["polygon", "circle"]),
    /** polygon: corners in mm, anticlockwise; or outline moves from (0, 0), the last side closing back. */
    corners: z.array(xy).min(core.MIN_CORNERS).max(core.MAX_CORNERS).optional(),
    outline: z
      .array(z.object({ dir: z.enum(["right", "up", "left", "down"]), length: z.number().finite().min(3).max(250) }).strict())
      .min(2)
      .max(core.MAX_CORNERS)
      .optional(),
    arcs: z.array(z.enum(core.ARCS)).max(core.MAX_CORNERS).optional(),
    heights: z.array(z.object({ corner: z.number().int(), side: z.number().int() }).strict()).max(4).optional(),
    rightAngles: z.array(z.number().int()).max(core.MAX_CORNERS).optional(),
    /** circle */
    part: z.enum(core.PARTS).optional(),
    radiusMm: z.number().finite().optional(),
    angleDeg: z.number().finite().optional(),
    line: z.enum(["radius", "diameter", "none"]).optional(),
    centre: z.boolean().optional(),
  })
  .strict();
const labelInput = z
  .object({
    id: z.string().max(8),
    /** Defaults: text with a digit is given (value), letters alone a symbol, no text a blank (hidden with an answer). */
    state: z.enum(core.STATES).optional(),
    text: z.string().max(core.MAX_LABEL).optional(),
    answer: z.string().max(core.MAX_LABEL).optional(),
  })
  .strict();
const nameInput = z.object({ point: z.string().max(8), text: z.string().max(3) }).strict();
const settings = z
  .object({
    shaded: z.enum(core.SHADES),
    grid: z.boolean(),
    notToScale: z.boolean(),
    fontPt: z.number().int().min(10).max(14),
    lines: z.enum(["normal", "bold"]),
  })
  .partial()
  .strict();
export const outputViewSchema = z.enum(["pupil", "answer"]);
export const specSchema = z
  .object({
    example: z.enum(exampleIds).optional(),
    worked: z.boolean().optional(),
    preset: z.enum(core.PRESETS).optional(),
    shape: shapeInput.optional(),
    hole: core.holeSchema.nullable().optional(),
    labels: z.array(labelInput).max(40).optional(),
    names: z.array(nameInput).max(20).optional(),
    settings: settings.optional(),
  })
  .strict();
export const createSchema = z.object({ envelope: core.envelopeSchema.optional(), spec: specSchema.optional(), outputView: outputViewSchema.optional() }).strict();
export const operationSchema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("set_shape"), preset: z.enum(core.PRESETS).optional(), shape: shapeInput.optional(), hole: core.holeSchema.nullable().optional(), dropMissing: z.boolean().optional() }).strict(),
  z.object({ op: z.literal("set_label"), label: labelInput }).strict(),
  z.object({ op: z.literal("remove_label"), id: z.string().max(8) }).strict(),
  z.object({ op: z.literal("set_name"), name: nameInput }).strict(),
  z.object({ op: z.literal("set_settings"), settings }).strict(),
]);
export const revisionSchema = z
  .object({ envelope: core.envelopeSchema, baseHash: z.string().regex(/^[a-f0-9]{64}$/), operations: z.array(operationSchema).max(30), outputView: outputViewSchema.optional() })
  .strict();

type ShapeInput = z.infer<typeof shapeInput>;
type LabelInput = z.infer<typeof labelInput>;

const STEP = { right: { x: 1, y: 0 }, up: { x: 0, y: 1 }, left: { x: -1, y: 0 }, down: { x: 0, y: -1 } };
/** A shape from its input, keeping the current shape's settings where the input leaves them out. */
export function toShape(input: ShapeInput, base?: core.Shape): core.Shape {
  if (input.type === "circle") {
    const b = base?.type === "circle" ? base : undefined;
    const part = input.part ?? b?.part ?? "full";
    return {
      type: "circle",
      part,
      radiusMm: input.radiusMm ?? b?.radiusMm ?? 30,
      angleDeg: input.angleDeg ?? b?.angleDeg ?? (part === "sector" ? 110 : 90),
      line: input.line ?? (part === "full" ? (b?.part === "full" ? b.line : "radius") : "none"),
      centre: input.centre ?? (b ? b.centre : part === "full"),
    };
  }
  const b = base?.type === "polygon" ? base : undefined;
  if (input.corners && input.outline) throw Error("Give corners or outline, not both.");
  let corners = input.corners ?? b?.corners;
  if (input.outline) {
    corners = [{ x: 0, y: 0 }];
    for (const m of input.outline.slice(0, -1)) {
      const last = corners[corners.length - 1];
      corners.push({ x: last.x + STEP[m.dir].x * m.length, y: last.y + STEP[m.dir].y * m.length });
    }
    // The last move must bring the outline back to its start.
    const end = corners[corners.length - 1],
      m = input.outline[input.outline.length - 1],
      back = { x: end.x + STEP[m.dir].x * m.length, y: end.y + STEP[m.dir].y * m.length };
    if (Math.abs(back.x) > 0.05 || Math.abs(back.y) > 0.05) throw Error(`The outline does not close: its last move ends ${Math.round(back.x * 10) / 10} mm across and ${Math.round(back.y * 10) / 10} mm up from the start.`);
    // Centre the drawing range on the shape, so long outlines stay within ±150 mm.
    const xs = corners.map((c) => c.x),
      ys = corners.map((c) => c.y);
    const dx = Math.round((Math.min(...xs) + Math.max(...xs)) / 2),
      dy = Math.round((Math.min(...ys) + Math.max(...ys)) / 2);
    corners = corners.map((c) => ({ x: c.x - dx, y: c.y - dy }));
  }
  if (!corners) throw Error("A polygon needs corners or an outline.");
  const count = corners.length,
    sameCount = b && b.corners.length === count;
  return {
    type: "polygon",
    corners,
    arcs: input.arcs ?? (sameCount ? b.arcs : Array(count).fill("none")),
    heights: input.heights ?? (sameCount ? b.heights : []),
    rightAngles: input.rightAngles ?? (sameCount ? b.rightAngles : []),
  };
}
function defaultState(text: string, answer: string): core.LabelState {
  if (!text.trim()) return answer.trim() ? "hidden" : "blank";
  // A given length never holds an answer, so text with a saved answer is a letter or expression to find (as in the editor).
  return /\d/.test(text) && !answer.trim() ? "value" : "symbol";
}
function toLabel(input: LabelInput, base?: core.Label): core.Label {
  const out = base ? structuredClone(base) : core.label(input.id);
  if (input.text !== undefined) out.text = input.text;
  if (input.answer !== undefined) out.answer = input.answer;
  if (input.state) out.state = input.state;
  else if (input.text !== undefined || input.answer !== undefined) out.state = defaultState(out.text, out.answer);
  return out;
}
function applySettings(d: core.AreaDocument, s: z.infer<typeof settings>) {
  const { fontPt, lines, ...rest } = s;
  Object.assign(d, rest);
  if (fontPt !== undefined) d.fontPt = fontPt === 11 ? undefined : fontPt;
  if (lines !== undefined) d.lines = lines === "bold" ? "bold" : undefined;
}
function setLabels(d: core.AreaDocument, labels: LabelInput[]) {
  for (const l of labels) {
    const i = d.labels.findIndex((x) => x.id === l.id);
    if (i >= 0) d.labels[i] = toLabel(l, d.labels[i]);
    else d.labels.push(toLabel(l));
  }
}
function setNames(d: core.AreaDocument, names: z.infer<typeof nameInput>[]) {
  for (const nm of names) {
    d.names = d.names.filter((x) => x.id !== nm.point);
    if (nm.text.trim()) d.names.push({ id: nm.point, text: nm.text.trim() });
  }
}
const withDoc = (e: core.Envelope, f: (d: core.AreaDocument) => void) => {
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
  if (s.example && (s.preset || s.shape || s.labels)) throw Error("Examples already contain their shape and labels; revise the result instead.");
  const base = s.example ? examples.find((x) => x.id === s.example)!.make(!!s.worked) : core.blank(s.preset ?? "rectangle");
  return withDoc(base, (d) => {
    if (s.shape) d.shape = toShape(s.shape, d.shape);
    if (s.hole !== undefined) d.hole = s.hole;
    if (s.settings) applySettings(d, s.settings);
    if (!d.hole && d.shaded === "hole") d.shaded = "none";
    if (s.labels) setLabels(d, s.labels);
    if (s.names) setNames(d, s.names);
  });
}

export async function revise(input: unknown): Promise<core.Envelope> {
  const v = revisionSchema.parse(input);
  if ((await core.hash(v.envelope)) !== v.baseHash) throw Error("stale_hash: Use the exact returned envelope and contentHash.");
  let e = core.validate(structuredClone(v.envelope));
  for (const op of v.operations) {
    if (op.op === "set_shape") {
      if (op.preset && op.shape) throw Error("Give a preset or a shape, not both.");
      const next = structuredClone(e);
      if (op.preset) Object.assign(next.document, core.presetShape(op.preset));
      if (op.shape) next.document.shape = toShape(op.shape, e.document.shape);
      if (op.hole !== undefined) next.document.hole = op.hole;
      if (!next.document.hole && next.document.shaded === "hole") next.document.shaded = "none";
      const kept = core.prune(next);
      const lostLabels = e.document.labels.length - kept.document.labels.length,
        lostNames = e.document.names.length - kept.document.names.length;
      const lost = [...(lostLabels ? [`${lostLabels} label${lostLabels > 1 ? "s" : ""}`] : []), ...(lostNames ? [`${lostNames} point name${lostNames > 1 ? "s" : ""}`] : [])];
      if (lost.length && !op.dropMissing) throw Error(`The new shape has no place for ${lost.join(" and ")}. Pass dropMissing: true to remove them, or remove them first.`);
      e = core.validate(kept);
    } else
      e = withDoc(e, (d) => {
        if (op.op === "set_label") setLabels(d, [op.label]);
        if (op.op === "remove_label") {
          if (!d.labels.some((l) => l.id === op.id)) throw Error(`Label ${op.id} is not set.`);
          d.labels = d.labels.filter((l) => l.id !== op.id);
        }
        if (op.op === "set_name") setNames(d, [op.name]);
        if (op.op === "set_settings") applySettings(d, op.settings);
      });
  }
  return e;
}

export function printFacts(e: core.Envelope, view: "pupil" | "answer" = "pupil") {
  return guidance({
    textSizesPt: renderedTextSizesPt(core.renderSvg(e, view), 72 / 25.4),
    gridPitchMm: e.document.grid ? [core.GRID_MM] : [],
    tableRowHeightsMm: [],
    answerLineLengthsMm: [],
  });
}
