import { z } from "zod";
import * as core from "./index";
import { examples } from "./examples";
import { guidance, renderedTextSizesPt } from "../../graph-core/src/print-guidance";

/** Connector adapter: the same schema and renderer as the browser editor. */
export const exampleIds = examples.map((x) => x.id) as [string, ...string[]];
const direction = z.number().finite().min(0).max(360);
const figureInput = z
  .object({
    type: z.enum(core.FIGURES),
    /** straight-line: 1-5 directions from 5 to 175; point: 2-8 directions from 0 to 360. */
    rays: z.array(direction).min(1).max(8).optional(),
    /** crossing: 2-3 line directions from 0 to 179. */
    lines: z.array(direction).min(2).max(3).optional(),
    /** parallel */
    count: z.union([z.literal(2), z.literal(3)]).optional(),
    gapMm: z.number().finite().min(12).max(50).optional(),
    crossDeg: z.number().finite().min(20).max(160).optional(),
    arrows: z.number().int().min(0).max(3).optional(),
    /** parallel: a second transversal at its own angle, crossing the top line offsetMm right of the first; null removes it. */
    second: z.object({ crossDeg: z.number().finite().min(20).max(160), offsetMm: z.number().finite().min(-80).max(80) }).strict().nullable().optional(),
    /** polygon: the number of sides; polygons: 2 or 3 side counts, one per polygon round the shared corner. */
    sides: z.union([z.number().int().min(core.MIN_SIDES).max(core.MAX_SIDES), z.array(z.number().int().min(core.MIN_SIDES).max(core.MAX_SIDES)).min(2).max(3)]).optional(),
    corners: z.array(z.object({ x: z.number().finite(), y: z.number().finite() }).strict()).min(core.MIN_SIDES).max(core.MAX_SIDES).optional(),
    exterior: z.array(z.number().int().min(1).max(core.MAX_SIDES)).max(core.MAX_SIDES).optional(),
    diagonals: z.boolean().optional(),
    /** One count for every side, or one per side. */
    ticks: z.union([z.number().int().min(0).max(3), z.array(z.number().int().min(0).max(3)).min(core.MIN_SIDES).max(core.MAX_SIDES)]).optional(),
  })
  .strict();
const angleInput = z
  .object({
    id: z.string().max(12),
    /** Defaults: text with a digit is a given value, letters alone a symbol, no text a blank. */
    state: z.enum(core.STATES).optional(),
    text: z.string().max(core.MAX_LABEL).optional(),
    answer: z.string().max(core.MAX_LABEL).optional(),
    mark: z.enum(core.MARKS).optional(),
    shade: z.boolean().optional(),
  })
  .strict();
const nameInput = z.object({ point: z.string().max(12), text: z.string().max(3) }).strict();
const letterInput = z.object({ a: z.string().max(12), b: z.string().max(12) }).strict();
const settings = z
  .object({
    turnDeg: core.documentSchema.shape.turnDeg,
    sizeMm: core.documentSchema.shape.sizeMm,
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
    figure: figureInput.optional(),
    angles: z.array(angleInput).max(40).optional(),
    names: z.array(nameInput).max(30).optional(),
    letters: z.array(letterInput).max(3).optional(),
    settings: settings.optional(),
  })
  .strict();
export const createSchema = z.object({ envelope: core.envelopeSchema.optional(), spec: specSchema.optional(), outputView: outputViewSchema.optional() }).strict();
export const operationSchema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("set_figure"), figure: figureInput, dropMissing: z.boolean().optional() }).strict(),
  z.object({ op: z.literal("set_angle"), angle: angleInput }).strict(),
  z.object({ op: z.literal("remove_angle"), id: z.string().max(12) }).strict(),
  z.object({ op: z.literal("set_name"), name: nameInput }).strict(),
  z.object({ op: z.literal("set_letters"), letters: z.array(letterInput).max(3) }).strict(),
  z.object({ op: z.literal("set_settings"), settings }).strict(),
]);
export const revisionSchema = z
  .object({ envelope: core.envelopeSchema, baseHash: z.string().regex(/^[a-f0-9]{64}$/), operations: z.array(operationSchema).max(30), outputView: outputViewSchema.optional() })
  .strict();

type FigureInput = z.infer<typeof figureInput>;
type AngleInput = z.infer<typeof angleInput>;

/** A figure from its input, keeping the current figure's numbers where the input leaves them out. */
export function toFigure(input: FigureInput, base?: core.Figure): core.Figure {
  const same = base && base.type === input.type ? base : undefined;
  if (input.type === "straight-line") return { type: input.type, rays: input.rays ?? (same?.type === input.type ? same.rays : [60]) };
  if (input.type === "point") return { type: input.type, rays: input.rays ?? (same?.type === input.type ? same.rays : [30, 150, 260]) };
  if (input.type === "crossing") return { type: input.type, lines: input.lines ?? (same?.type === input.type ? same.lines : [15, 70]) };
  if (input.type === "parallel") {
    const b: core.ParallelFigure = same?.type === "parallel" ? same : { type: "parallel", count: 2, gapMm: 24, crossDeg: 60, arrows: 1 };
    const second = input.second === null ? undefined : (input.second ?? b.second);
    return { type: "parallel", count: input.count ?? b.count, gapMm: input.gapMm ?? b.gapMm, crossDeg: input.crossDeg ?? b.crossDeg, arrows: input.arrows ?? b.arrows, ...(second ? { second } : {}) };
  }
  if (input.type === "polygons") {
    const b = same?.type === "polygons" ? same : { sides: [5, 6], ticks: 1 };
    if (typeof input.sides === "number") throw Error("Polygons meeting take sides as a list, such as [5, 6]: one side count per polygon.");
    const ticks = typeof input.ticks === "number" ? input.ticks : (input.ticks?.[0] ?? b.ticks);
    return { type: "polygons", sides: input.sides ?? b.sides, ticks };
  }
  if (Array.isArray(input.sides)) throw Error("A polygon takes one number of sides. Use the polygons figure for polygons meeting at a corner.");
  const b = same?.type === "polygon" ? same : undefined;
  const sides = input.corners?.length ?? input.sides ?? b?.sides ?? 5;
  const corners = input.corners ?? (input.sides !== undefined && input.sides !== b?.sides ? null : (b?.corners ?? null));
  const ticks =
    typeof input.ticks === "number"
      ? Array(sides).fill(input.ticks)
      : (input.ticks ?? (b && b.ticks.length === sides ? b.ticks : Array(sides).fill(corners ? 0 : 1)));
  return { type: "polygon", sides, corners, exterior: input.exterior ?? (b?.exterior.filter((k) => k <= sides) ?? []), diagonals: input.diagonals ?? b?.diagonals ?? false, ticks };
}
function defaultState(text: string, answer: string): core.LabelState {
  if (!text.trim()) return "blank";
  // A given size never holds an answer, so text with a saved answer is a letter or expression to find (as in the editor).
  return /\d/.test(text) && !answer.trim() ? "value" : "symbol";
}
function toAngle(input: AngleInput, base?: core.Angle): core.Angle {
  const out = base ? structuredClone(base) : core.angle(input.id);
  if (input.text !== undefined) out.label.text = input.text;
  if (input.answer !== undefined) out.label.answer = input.answer;
  if (input.state) out.label.state = input.state;
  else if (input.text !== undefined) out.label.state = defaultState(input.text, out.label.answer);
  if (input.mark) out.mark = input.mark;
  if (input.shade !== undefined) out.shade = input.shade;
  return out;
}
function applySettings(d: core.AngleDocument, s: z.infer<typeof settings>) {
  const { fontPt, lines, ...rest } = s;
  // An irregular polygon grows with the size, like a regular one (the editor does the same).
  if (rest.sizeMm !== undefined && d.figure.type === "polygon" && d.figure.corners) {
    const k = rest.sizeMm / d.sizeMm;
    d.figure.corners = d.figure.corners.map((c) => ({ x: Math.round(c.x * k * 10) / 10, y: Math.round(c.y * k * 10) / 10 }));
  }
  Object.assign(d, rest);
  if (fontPt !== undefined) d.fontPt = fontPt === 11 ? undefined : fontPt;
  if (lines !== undefined) d.lines = lines === "bold" ? "bold" : undefined;
}
function setNames(d: core.AngleDocument, names: z.infer<typeof nameInput>[]) {
  for (const nm of names) {
    d.names = d.names.filter((x) => x.id !== nm.point);
    if (nm.text.trim()) d.names.push({ id: nm.point, text: nm.text.trim() });
  }
}
const withDoc = (e: core.Envelope, f: (d: core.AngleDocument) => void) => {
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
  if (s.example && (s.figure || s.angles)) throw Error("Examples already contain their figure and angles; revise the result instead.");
  const base = s.example ? examples.find((x) => x.id === s.example)!.make(!!s.worked) : core.blank(s.figure ? toFigure(s.figure) : undefined);
  return withDoc(base, (d) => {
    if (s.settings) applySettings(d, s.settings);
    if (s.figure) d.figure = toFigure(s.figure);
    for (const a of s.angles ?? []) {
      const i = d.angles.findIndex((x) => x.id === a.id);
      if (i >= 0) d.angles[i] = toAngle(a, d.angles[i]);
      else d.angles.push(toAngle(a));
    }
    if (s.names) setNames(d, s.names);
    if (s.letters) d.letters = s.letters;
  });
}

export async function revise(input: unknown): Promise<core.Envelope> {
  const v = revisionSchema.parse(input);
  if ((await core.hash(v.envelope)) !== v.baseHash) throw Error("stale_hash: Use the exact returned envelope and contentHash.");
  let e = core.validate(structuredClone(v.envelope));
  for (const op of v.operations) {
    if (op.op === "set_figure") {
      const next = structuredClone(e);
      next.document.figure = toFigure(op.figure, e.document.figure);
      // Rays are kept in order; labels and names follow their rays, as in the editor.
      const f = next.document.figure;
      if (f.type === "crossing") f.lines.sort((a, b) => a - b);
      if (f.type === "straight-line" || f.type === "point") f.rays.sort((a, b) => a - b);
      // Adding or removing a ray moves the slots, so labels follow their rays; moving a ray keeps every slot and point by position, as in the editor.
      const count = (x: core.Figure) => (x.type === "crossing" ? x.lines.length : x.type === "straight-line" || x.type === "point" ? x.rays.length : -1);
      const old = e.document.figure;
      if (old.type === f.type && count(old) >= 0 && count(old) !== count(f)) Object.assign(next.document, core.remapRays(e.document, next.document));
      const kept = core.prune(next);
      const lostAngles = e.document.angles.length - kept.document.angles.length,
        lostNames = e.document.names.length - kept.document.names.length,
        lostLetters = (e.document.letters?.length ?? 0) - (kept.document.letters?.length ?? 0);
      const lost = [
        ...(lostAngles ? [`${lostAngles} labelled angle${lostAngles > 1 ? "s" : ""}`] : []),
        ...(lostNames ? [`${lostNames} point name${lostNames > 1 ? "s" : ""}`] : []),
        ...(lostLetters ? [`${lostLetters} Z, F or C shape${lostLetters > 1 ? "s" : ""}`] : []),
      ];
      if (lost.length && !op.dropMissing) throw Error(`The new figure has no place for ${lost.join(" and ")}. Pass dropMissing: true to remove those labels, or remove them first.`);
      e = core.validate(kept);
    } else
      e = withDoc(e, (d) => {
        if (op.op === "set_angle") {
          const i = d.angles.findIndex((x) => x.id === op.angle.id);
          if (i >= 0) d.angles[i] = toAngle(op.angle, d.angles[i]);
          else d.angles.push(toAngle(op.angle));
        }
        if (op.op === "remove_angle") {
          if (!d.angles.some((a) => a.id === op.id)) throw Error(`Angle ${op.id} is not marked.`);
          d.angles = d.angles.filter((a) => a.id !== op.id);
        }
        if (op.op === "set_name") setNames(d, [op.name]);
        if (op.op === "set_letters") d.letters = op.letters;
        if (op.op === "set_settings") applySettings(d, op.settings);
      });
  }
  return e;
}

export function printFacts(e: core.Envelope, view: "pupil" | "answer" = "pupil") {
  return guidance({
    textSizesPt: renderedTextSizesPt(core.renderSvg(e, view), 72 / 25.4),
    gridPitchMm: [],
    tableRowHeightsMm: [],
    answerLineLengthsMm: [],
  });
}
