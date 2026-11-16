import { z } from "zod";
import * as core from "./index";
import { examples } from "./examples";
import { guidance, renderedTextSizesPt } from "../../graph-core/src/print-guidance";

/** Connector adapter: the same schema and renderer as the browser editor. */
export const exampleIds = examples.map((x) => x.id) as [string, ...string[]];
const id = z.string().max(8);
const labelInput = z
  .object({
    /** Defaults when text is given: a digit and no answer is a given value, other text a letter, an answer alone hidden, nothing blank. An answer alone on a blank place makes it hidden; other states are kept. */
    state: z.enum(core.STATES).optional(),
    text: z.string().max(core.MAX_LABEL).optional(),
    answer: z.string().max(core.MAX_LABEL).optional(),
  })
  .strict();
const dimInput = z
  .object({
    id,
    a: id.optional(),
    b: id.optional(),
    kind: z.enum(core.DIM_KINDS).optional(),
    offset: z.number().finite().min(-40).max(40).optional(),
    gap: z.boolean().optional(),
    side: z.enum(core.SIDES).optional(),
    label: labelInput.optional(),
  })
  .strict();
const angleInput = z.object({ id, at: id.optional(), from: id.optional(), to: id.optional(), mark: z.enum(core.MARKS).optional(), label: labelInput.optional() }).strict();
const lineInput = z.object({ id, a: id.optional(), b: id.optional(), style: z.enum(core.STYLES).optional() }).strict();
const pointInput = z.object({ id, place: core.placeSchema.optional(), show: z.enum(core.SHOWS).optional() }).strict();
const settings = z
  .object({
    view: core.viewSchema,
    hidden: z.enum(["dashed", "none"]),
    notToScale: z.boolean(),
    fontPt: z.number().int().min(10).max(14),
    lines: z.enum(["normal", "bold"]),
  })
  .partial()
  .strict();
export const outputViewSchema = z.enum(["pupil", "answer"]);
export const specSchema = z
  .object({
    example: z.enum(exampleIds).optional().describe("A starting drawing redrawn from a Question Bank question; revise the result to change it."),
    solids: z.array(core.solidSchema).min(1).max(core.LIMITS.solids).optional().describe("The solids (prism, pyramid, cylinder, cone, sphere, hemisphere), each with an id of 1-3 letters that names its corners and centres."),
    points: z.array(pointInput).max(core.LIMITS.points).optional().describe("Extra points: {id, place: at {x,y,z} | along {a,b,t} | rim {solid, end, deg}}."),
    names: z.array(core.nameSchema).max(40).optional().describe("Letters printed beside points: {id, text} such as {id:'p1', text:'A'}."),
    lines: z.array(lineInput).max(core.LIMITS.lines).optional().describe("Extra lines between points (diagonals, heights, radii): {id, a, b, style?}."),
    dims: z.array(dimInput).max(core.LIMITS.dims).optional().describe("Lengths: {id, a, b, label, kind beside|arrow, offset?, gap?, side?}."),
    angles: z.array(angleInput).max(core.LIMITS.angles).optional().describe("Marked angles: {id, at, from, to, mark arc|right|none, label}."),
    settings: settings.optional().describe("view (oblique or turned), hidden (dashed or none), notToScale, fontPt (10-14), lines (normal or bold)."),
  })
  .strict();
export const createSchema = z.object({ envelope: core.envelopeSchema.optional(), spec: specSchema.optional(), outputView: outputViewSchema.optional() }).strict();
export const operationSchema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("set_solid"), solid: core.solidSchema }).strict(),
  z.object({ op: z.literal("set_point"), point: pointInput }).strict(),
  z.object({ op: z.literal("set_name"), name: core.nameSchema }).strict(),
  z.object({ op: z.literal("set_line"), line: lineInput }).strict(),
  z.object({ op: z.literal("set_dim"), dim: dimInput }).strict(),
  z.object({ op: z.literal("set_angle"), angle: angleInput }).strict(),
  z.object({ op: z.literal("remove"), what: z.enum(["solid", "point", "line", "dim", "angle"]), id }).strict(),
  z.object({ op: z.literal("set_settings"), settings }).strict(),
]);
export const revisionSchema = z
  .object({ envelope: core.envelopeSchema, baseHash: z.string().regex(/^[a-f0-9]{64}$/), operations: z.array(operationSchema).max(40), outputView: outputViewSchema.optional() })
  .strict();

type LabelInput = z.infer<typeof labelInput>;
function toLabel(input: LabelInput | undefined, base: core.Label): core.Label {
  const out = structuredClone(base);
  if (!input) return out;
  if (input.text !== undefined) out.text = input.text;
  if (input.answer !== undefined) out.answer = input.answer;
  if (input.state) out.state = input.state;
  else if (input.text !== undefined) {
    const t = out.text.trim(),
      a = out.answer.trim();
    out.state = !t ? (a ? "hidden" : "blank") : /\d/.test(t) && !a ? "value" : "symbol";
  }
  // An answer alone changes only an empty place, to hidden (as the editor does); an answer line or a letter keeps its state.
  else if (input.answer !== undefined && out.state === "blank" && out.answer.trim()) out.state = "hidden";
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
type Doc = core.SolidsDocument;
const setPoint = (d: Doc, p: z.infer<typeof pointInput>) => upsert(d.points, p, (b) => ({ id: p.id, place: p.place ?? need(b?.place, `point (${p.id}: place)`), show: p.show ?? b?.show ?? "none" }));
const setLine = (d: Doc, l: z.infer<typeof lineInput>) =>
  upsert(d.lines, l, (b) => ({ id: l.id, a: l.a ?? need(b?.a, `line (${l.id}: a)`), b: l.b ?? need(b?.b, `line (${l.id}: b)`), style: l.style ?? b?.style ?? "solid" }));
const setDim = (d: Doc, m: z.infer<typeof dimInput>) =>
  upsert(d.dims, m, (b) => {
    const base = b ?? core.dim(m.id, need(m.a, `length (${m.id}: a)`), need(m.b, `length (${m.id}: b)`), core.label());
    return { ...base, a: m.a ?? base.a, b: m.b ?? base.b, kind: m.kind ?? base.kind, offset: m.offset ?? base.offset, gap: m.gap ?? base.gap, side: m.side ?? base.side, label: toLabel(m.label, base.label) };
  });
const setAngle = (d: Doc, a: z.infer<typeof angleInput>) =>
  upsert(d.angles, a, (b) => {
    const base = b ?? { id: a.id, at: need(a.at, `angle (${a.id}: at)`), from: need(a.from, `angle (${a.id}: from)`), to: need(a.to, `angle (${a.id}: to)`), mark: "arc" as const, label: core.label() };
    return { ...base, at: a.at ?? base.at, from: a.from ?? base.from, to: a.to ?? base.to, mark: a.mark ?? base.mark, label: toLabel(a.label, base.label) };
  });
const setName = (d: Doc, nm: z.infer<typeof core.nameSchema>) => {
  d.names = d.names.filter((x) => x.id !== nm.id);
  if (nm.text.trim()) d.names.push(nm);
};
function applySettings(d: Doc, s: z.infer<typeof settings>) {
  if (s.view) d.view = s.view;
  if (s.hidden) d.hidden = s.hidden;
  if (s.notToScale !== undefined) d.notToScale = s.notToScale;
  if (s.fontPt !== undefined) d.fontPt = s.fontPt === 11 ? undefined : s.fontPt;
  if (s.lines !== undefined) d.weight = s.lines === "bold" ? "bold" : undefined;
}
/** Which points, lines, lengths and angles use a point (through its own place, too). */
function usersOf(d: Doc, pids: string[]): string[] {
  const set = new Set(pids);
  return [
    ...d.points.filter((p) => p.place.type === "along" && (set.has(p.place.a) || set.has(p.place.b))).map((p) => `point ${p.id}`),
    ...d.lines.filter((l) => set.has(l.a) || set.has(l.b)).map((l) => `line ${l.id}`),
    ...d.dims.filter((m) => set.has(m.a) || set.has(m.b)).map((m) => `length ${m.id}`),
    ...d.angles.filter((a) => [a.at, a.from, a.to].some((x) => set.has(x))).map((a) => `angle ${a.id}`),
  ];
}
/** Removing something still used is refused, naming the users, so nothing goes unseen. */
function remove(d: Doc, what: string, rid: string) {
  if (what === "solid") {
    const s = d.solids.find((x) => x.id === rid);
    if (!s) throw Error(`There is no solid ${rid} to remove.`);
    if (d.solids.length === 1) throw Error("A drawing keeps at least one solid. Change it with set_solid instead.");
    const users = [...usersOf(d, core.solidPointIds(s)), ...d.points.filter((p) => p.place.type === "rim" && p.place.solid === rid).map((p) => `point ${p.id}`)];
    if (users.length) throw Error(`Solid ${rid} is used by ${[...new Set(users)].join(", ")}. Remove or change those first.`);
    d.solids = d.solids.filter((x) => x.id !== rid);
    d.names = d.names.filter((x) => !core.solidPointIds(s).includes(x.id));
    return;
  }
  const lists: Record<string, { id: string }[]> = { point: d.points, line: d.lines, dim: d.dims, angle: d.angles };
  const list = lists[what];
  if (!list.some((x) => x.id === rid)) throw Error(`There is no ${what} ${rid} to remove.`);
  if (what === "point") {
    const users = usersOf(d, [rid]);
    if (users.length) throw Error(`Point ${rid} is used by ${users.join(", ")}. Remove or change those first.`);
    d.names = d.names.filter((x) => x.id !== rid);
  }
  list.splice(
    list.findIndex((x) => x.id === rid),
    1,
  );
}
const withDoc = (e: core.Envelope, f: (d: Doc) => void) => {
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
  if (s.example && (s.solids || s.points || s.lines || s.dims || s.angles || s.names)) throw Error("Examples already contain their drawing; revise the result instead.");
  const base = s.example ? examples.find((x) => x.id === s.example)!.make() : core.blank();
  return withDoc(base, (d) => {
    if (s.solids) d.solids = s.solids;
    for (const p of s.points ?? []) setPoint(d, p);
    for (const nm of s.names ?? []) setName(d, nm);
    for (const l of s.lines ?? []) setLine(d, l);
    for (const m of s.dims ?? []) setDim(d, m);
    for (const a of s.angles ?? []) setAngle(d, a);
    if (s.settings) applySettings(d, s.settings);
  });
}

export async function revise(input: unknown): Promise<core.Envelope> {
  const v = revisionSchema.parse(input);
  if ((await core.hash(v.envelope)) !== v.baseHash) throw Error("stale_hash: Use the exact returned envelope and contentHash.");
  // Every set operation applies first, in order, then every remove, and the result is checked once.
  const ordered = v.operations.filter((op) => op.op !== "remove");
  const removes = v.operations.flatMap((op) => (op.op === "remove" ? [op] : []));
  return withDoc(core.validate(structuredClone(v.envelope)), (d) => {
    for (const op of ordered) {
      if (op.op === "set_solid") upsert(d.solids, op.solid, () => op.solid);
      if (op.op === "set_point") setPoint(d, op.point);
      if (op.op === "set_name") setName(d, op.name);
      if (op.op === "set_line") setLine(d, op.line);
      if (op.op === "set_dim") setDim(d, op.dim);
      if (op.op === "set_angle") setAngle(d, op.angle);
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
