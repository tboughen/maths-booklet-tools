import { z } from "zod";
import * as core from "./index";
import { examples } from "./examples";
import { guidance, renderedTextSizesPt } from "../../graph-core/src/print-guidance";
import { LINE_WEIGHTS } from "../../envelope-core/src/house-style";

/** Connector adapter: the same schema, presets, explicit marking and renderer as the browser editor. */
export const exampleIds = examples.map((x) => x.id) as [string, ...string[]];
const show = z.enum(["show", "hidden"]);
const text = z.string().max(core.MAX_TEXT);
export const outputViewSchema = z.enum(["pupil", "answer"]);
const len = z.number().min(0.5).max(12);

/** A printed label: text, or {text, hidden} for a hidden answer. */
const item = z.union([text, z.object({ text, hidden: z.boolean().optional() }).strict()]);
/** [x, y] in grid squares (arrays of two, not tuples, for every client's schema reader). */
const point = z.array(z.number().min(0).max(60)).length(2);
const cell = (max: number) => z.array(z.number().int().min(0).max(max)).length(2);
const pt = (p: number[]): core.Pt => [p[0], p[1]];
export const presetSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("cube"), net: z.number().int().min(1).max(11), side: z.number().int().min(1).max(4).optional() }).strict(),
  z.object({ type: z.literal("cuboid"), length: len, width: len, height: len }).strict(),
  z.object({ type: z.literal("triangular-prism"), a: len, b: len, length: len }).strict(),
  z.object({ type: z.literal("square-pyramid"), base: len, slant: len }).strict(),
  z.object({ type: z.literal("tetrahedron"), side: len }).strict(),
]);
const markInput = z.union([z.enum(["dot", "cross", "shade"]), z.object({ kind: z.enum(["dot", "cross", "shade"]), hidden: z.boolean().optional() }).strict()]);
const faceInput = z
  .object({
    label: item.optional(),
    mark: markInput.optional(),
    /** true: nothing for pupils, drawn in the answer colour on the answers copy. */
    hidden: z.boolean().optional(),
  })
  .strict();
const netInput = z
  .object({
    preset: presetSchema.optional(),
    /** Instead of a preset: grid cells [column, row] of square faces, for any arrangement (including ones that are not nets). */
    squares: z.array(cell(30)).min(1).max(core.MAX_FACES).optional(),
    /** Squares across each face when using squares (default 1). */
    side: z.number().int().min(1).max(4).optional(),
    solid: z.enum(core.SOLIDS).optional(),
    caption: item.optional(),
    /** Faces in the preset's order; null leaves a face as it is. */
    faces: z.array(faceInput.nullable()).max(core.MAX_FACES).optional(),
    /** true hides every face: an empty grid for "draw the net", the net on the answers copy. */
    hideAll: z.boolean().optional(),
    vertices: z.array(z.object({ at: point, label: item }).strict()).max(core.MAX_LABELS).optional(),
    edges: z.array(z.object({ from: point, to: point, label: item }).strict()).max(core.MAX_LABELS).optional(),
    size: core.netSchema.shape.size.optional(),
  })
  .strict();
export const specSchema = z
  .object({
    example: z.enum(exampleIds).optional(),
    worked: z.boolean().optional(),
    nets: z.array(netInput).min(1).max(core.MAX_NETS).optional(),
    grid: z.enum(core.GRIDS).optional(),
    unitCm: core.documentSchema.shape.unitCm.optional(),
    lines: z.enum(LINE_WEIGHTS).optional(),
  })
  .strict();
export const createSchema = z
  .object({ envelope: core.envelopeSchema.optional(), spec: specSchema.optional(), outputView: outputViewSchema.optional() })
  .strict();
const netRef = z.string().max(24).describe('A net ID such as "n1".');
const faceRef = z.string().max(24).describe('A face ID such as "f1" (faces are numbered in the preset\'s order).');
const textChange = z.object({ text: text.optional(), show: show.optional() }).strict();
export const operationSchema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("make_net"), netId: netRef, preset: presetSchema }).strict(),
  z.object({ op: z.literal("add_net"), preset: presetSchema, caption: text.optional() }).strict(),
  z.object({ op: z.literal("remove_net"), netId: netRef }).strict(),
  z
    .object({ op: z.literal("set_net"), netId: netRef, solid: z.enum(core.SOLIDS).optional(), caption: textChange.optional(), size: core.netSchema.shape.size.optional() })
    .strict(),
  z.object({ op: z.literal("add_square"), netId: netRef, at: cell(39).describe("The square's top-left corner in grid squares from the panel's corner."), side: z.number().int().min(1).max(4).optional() }).strict(),
  z.object({ op: z.literal("remove_face"), netId: netRef, faceId: faceRef }).strict(),
  z
    .object({
      op: z.literal("set_face"),
      netId: netRef,
      faceId: faceRef,
      show: show.optional(),
      label: textChange.optional(),
      mark: z.object({ kind: z.enum(core.MARKS).optional(), show: show.optional() }).strict().optional(),
    })
    .strict(),
  z.object({ op: z.literal("set_vertex"), netId: netRef, at: point, text: text.optional(), show: show.optional() }).strict(),
  z.object({ op: z.literal("set_edge"), netId: netRef, from: point, to: point, text: text.optional(), show: show.optional() }).strict(),
  z.object({ op: z.literal("move_net"), netId: netRef, dx: z.number().int().min(-20).max(20), dy: z.number().int().min(-20).max(20) }).strict(),
  z.object({ op: z.literal("mark_opposite"), netId: netRef, faceId: faceRef, kind: z.enum(["dot", "cross", "shade"]).optional() }).strict(),
  z
    .object({
      op: z.literal("set_settings"),
      settings: z.object({ grid: z.enum(core.GRIDS), unitCm: core.documentSchema.shape.unitCm, lines: z.enum(LINE_WEIGHTS) }).partial().strict(),
    })
    .strict(),
]);
export const revisionSchema = z
  .object({
    envelope: core.envelopeSchema,
    baseHash: z.string().regex(/^[a-f0-9]{64}$/),
    operations: z.array(operationSchema).max(40),
    outputView: outputViewSchema.optional(),
  })
  .strict();

function toText(input: z.infer<typeof item> | undefined): core.Text {
  if (input === undefined) return core.text();
  const t = (typeof input === "string" ? input : input.text).trim(),
    hidden = typeof input === "object" && !!input.hidden;
  if (hidden && !t) throw Error("A hidden label needs its answer. Give the text, then hide it.");
  return core.text(t, hidden ? "hidden" : "show");
}
const toPreset = (p: z.infer<typeof presetSchema>): core.Preset => (p.type === "cube" ? { ...p, side: p.side ?? 2 } : p);
function buildNet(netId: string, n: z.infer<typeof netInput>): core.Net {
  if (n.preset && n.squares) throw Error("Give a preset or squares for a net, not both.");
  let net: core.Net;
  if (n.squares) {
    const side = n.side ?? 1;
    net = core.newNet(netId, { type: "cube", net: 1, side });
    net.faces = core.facesOf(core.squaresNet(n.squares.map(pt), side).map((f) => f.map(([x, y]): core.Pt => [x + 1, y + 1])));
    net.solid = "cube";
  } else net = core.newNet(netId, toPreset(n.preset ?? { type: "cube", net: 1 }));
  if (n.solid) net.solid = n.solid;
  net.caption = toText(n.caption);
  if (n.faces && n.faces.length > net.faces.length) throw Error(`This net has ${net.faces.length} faces; faces lists ${n.faces.length}.`);
  n.faces?.forEach((f, i) => {
    if (!f) return;
    const face = net.faces[i];
    if (f.label !== undefined) face.label = toText(f.label);
    if (f.mark !== undefined) face.mark = typeof f.mark === "string" ? { kind: f.mark, show: "show" } : { kind: f.mark.kind, show: f.mark.hidden ? "hidden" : "show" };
    if (f.hidden !== undefined) face.show = f.hidden ? "hidden" : "show";
  });
  if (n.hideAll) net.faces.forEach((f) => (f.show = "hidden"));
  net.vertices = (n.vertices ?? []).map((v) => ({ at: pt(v.at), label: toText(v.label) }));
  net.edges = (n.edges ?? []).map((v) => ({ from: pt(v.from), to: pt(v.to), label: toText(v.label) }));
  if (n.size) net.size = n.size;
  return net;
}

export function create(input: unknown): core.Envelope {
  const v = createSchema.parse(input);
  if (v.envelope && v.spec) throw Error("Supply spec or envelope, not both.");
  if (v.envelope) return core.validate(v.envelope);
  const s = v.spec;
  if (!s) return core.create();
  if (s.example && s.nets) throw Error("Examples already contain their nets; revise the result instead.");
  let e: core.Envelope;
  if (s.example) e = examples.find((x) => x.id === s.example)!.make(false);
  else {
    const nets = (s.nets ?? [{}]).map((n, i) => buildNet(`n${i + 1}`, n));
    const base = core.create();
    const tetra = nets.every((n) => n.solid === "tetrahedron");
    e = core.validate({ ...base, document: { ...base.document, nets, grid: tetra ? "none" : "squares" } });
  }
  e = core.setSettings(e, { grid: s.grid, unitCm: s.unitCm, lines: s.lines });
  if (s.worked) e = core.forView(e, "answer");
  return e;
}

export async function revise(input: unknown): Promise<core.Envelope> {
  const v = revisionSchema.parse(input);
  if ((await core.hash(v.envelope)) !== v.baseHash) throw Error("stale_hash: Use the exact returned envelope and contentHash.");
  let e = core.validate(structuredClone(v.envelope));
  for (const op of v.operations) {
    switch (op.op) {
      case "make_net":
        e = core.makeNet(e, op.netId, toPreset(op.preset));
        break;
      case "add_net":
        e = core.addNet(e, toPreset(op.preset), op.caption);
        break;
      case "remove_net":
        e = core.removeNet(e, op.netId);
        break;
      case "set_net":
        e = core.setNet(e, op.netId, { solid: op.solid, caption: op.caption, size: op.size });
        break;
      case "add_square":
        e = core.addSquare(e, op.netId, op.at[0], op.at[1], op.side);
        break;
      case "remove_face":
        e = core.removeFace(e, op.netId, op.faceId);
        break;
      case "set_face":
        e = core.setFace(e, op.netId, op.faceId, { show: op.show, label: op.label, mark: op.mark });
        break;
      case "set_vertex":
        e = core.setVertex(e, op.netId, pt(op.at), { text: op.text, show: op.show });
        break;
      case "set_edge":
        e = core.setEdge(e, op.netId, pt(op.from), pt(op.to), { text: op.text, show: op.show });
        break;
      case "move_net":
        e = core.moveNet(e, op.netId, op.dx, op.dy);
        break;
      case "mark_opposite":
        e = core.markOpposite(e, op.netId, op.faceId, op.kind);
        break;
      case "set_settings":
        e = core.setSettings(e, op.settings);
        break;
    }
  }
  return e;
}

export function printFacts(e: core.Envelope, view: "pupil" | "answer" = "pupil") {
  const shown = core.forView(e, view);
  return guidance({
    textSizesPt: renderedTextSizesPt(core.renderSvg(shown), 72 / 25.4),
    gridPitchMm: e.document.grid === "none" ? [] : [e.document.unitCm * 10],
    tableRowHeightsMm: [],
    answerLineLengthsMm: [],
  });
}
