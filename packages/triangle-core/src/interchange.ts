import { triangleEditorLink } from "./links";
import { z } from "zod";
import * as m from "./model";
import * as g from "./geometry";
import * as maths from "./maths";
import { layout, exportIssue } from "./render";
import { calculationContexts } from "./context";
import { owningTriangles } from "./ownership";
import { teachingExamples, sourceExamples } from "./examples";
import { guidance, renderedTextSizesPt } from "../../graph-core/src/print-guidance";
import { glyphAdvance } from "../../ratio-table-core/src/font-metrics";

const id = m.documentSchema.shape.vertices.element.shape.id;
const ref = z.string().max(43);
// Preserve the saved tuple and its order; only the advertised wire schema differs.
export const wireEnvelopeSchema = m.envelopeSchema.extend({
  document: m.documentSchema.extend({
    triangles: z.array(m.documentSchema.shape.triangles.element.extend({
      vertices: z.array(id).length(3),
    })).min(1).max(3),
  }),
});
const patch = m.labelSchema.omit({ calculation: true, answer: true, answerVisible: true, shared: true }).partial();
const labelEdit = z.object({ ref, label: patch }).strict();
export const contextSchema = z.object({
  target: ref, triangle: id, method: z.enum(maths.methods),
  raw: z.record(z.string(), z.string()), unit: z.enum(["cm", "mm", "m"]),
  sources: z.array(z.string()), missing: z.array(z.string()),
}).strict();
export function contexts(e: m.Envelope) {
  return m.allLabels(e).filter(l => l.kind !== "vertex").flatMap(l =>
    owningTriangles(e, l.ref).flatMap(t => calculationContexts(e, l.ref, t.id)));
}
const inputs = z.record(z.string().max(24), z.string().max(80)).refine(v => Object.keys(v).length <= 16, "Use at most 16 named inputs.");
export const operationSchema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("set_label"), ref, patch }).strict(),
  z.object({ op: z.literal("set_angle_mark"), id, mark: z.enum(["none", "arc", "double", "triple", "right"]) }).strict(),
  z.object({ op: z.literal("set_edge_style"), id, ticks: z.number().int().min(0).max(3).optional(), dashed: z.boolean().optional() }).strict(),
  z.object({ op: z.literal("move_vertex"), id, x: z.number().min(-10000).max(10000), y: z.number().min(-10000).max(10000) }).strict(),
  z.object({ op: z.literal("transform"), kind: z.enum(["left", "right", "reflect", "vertical"]) }).strict(),
  z.object({ op: z.literal("set_constraint"), triangleId: id, type: z.enum(["right", "equal", "equilateral", "none"]), vertex: id }).strict(),
  z.object({ op: z.literal("add_triangle"), layout: z.enum(["separate", "joined", "split"]), edgeId: id.optional() }).strict(),
  z.object({ op: z.literal("remove_second") }).strict(),
  z.object({ op: z.literal("add_height"), triangleId: id, apex: id }).strict(),
  z.object({ op: z.literal("remove_height"), id }).strict(),
  z.object({ op: z.literal("set_area"), triangleId: id, label: patch.nullable() }).strict(),
  z.object({ op: z.literal("add_caption"), label: patch }).strict(),
  z.object({ op: z.literal("remove_caption"), id }).strict(),
  z.object({ op: z.literal("set_shared_label"), id, text: z.string().max(40) }).strict(),
  z.object({ op: z.literal("link_label"), ref, sharedId: id.nullable() }).strict(),
  z.object({ op: z.literal("set_print"), widthCm: z.number().min(6).max(18) }).strict(),
  z.object({ op: z.literal("set_not_to_scale"), visible: z.boolean() }).strict(),
  z.object({ op: z.literal("construct"), triangleId: id, method: z.enum(["SSS", "SAS", "ASA", "AAS", "right"]), inputs }).strict(),
  z.object({ op: z.literal("calculate_and_store"), ref, triangleId: id, method: z.enum(maths.methods), inputs: inputs.optional(), branch: z.string().max(80).optional(), rounding: z.object({ kind: z.enum(["dp", "sf", "exact"]), digits: z.number().int().min(0).max(10) }).strict(), overwrite: z.boolean().default(false) }).strict(),
  z.object({ op: z.literal("set_saved_answer"), ref, answer: z.string().max(40), overwrite: z.boolean().default(false) }).strict(),
  z.object({ op: z.literal("keep_answer_manual"), ref }).strict(),
  z.object({ op: z.literal("set_answer_visibility"), ref: ref.optional(), visible: z.boolean() }).strict(),
  z.object({ op: z.literal("worked_copy") }).strict(),
]);
export const examples = [...teachingExamples, ...sourceExamples];
export const createSchema = z.object({
  envelope: wireEnvelopeSchema.optional(),
  spec: z.object({
    shape: z.enum(["right", "scalene", "isosceles", "equilateral"]).optional(),
    example: z.string().max(80).optional(),
    widthCm: z.number().min(6).max(18).optional(), notToScale: z.boolean().optional(),
    labels: z.array(labelEdit).max(40).optional(), operations: z.array(operationSchema).max(30).optional(),
  }).strict().optional(),
}).strict();
export const revisionSchema = z.object({ envelope: wireEnvelopeSchema, baseHash: z.string().regex(/^[a-f0-9]{64}$/), operations: z.array(operationSchema).max(30) }).strict();
export async function hash(e: m.Envelope) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(m.canonical(e)));
  return Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, "0")).join("");
}
function found<T extends { id: string }>(list: T[], id: string): T {
  const item = list.find(v => v.id === id);
  if (!item) throw Error(`Unknown stable ID: ${id}. Use IDs from the returned envelope.`);
  return item;
}
function triangle(e: m.Envelope, id: string, vertex?: string) {
  const t = found(e.document.triangles, id);
  if (vertex && !t.vertices.includes(vertex)) throw Error("The vertex must belong to the named triangle.");
  return t;
}
function visible(e: m.Envelope, target: string | undefined, value: boolean) {
  const labels = target ? [m.getLabel(e, target)] : m.allLabels(e).map(v => v.label);
  for (const l of labels) {
    if (value && l.answer && m.isStale(e, l)) throw Error("This saved answer is stale. Recalculate or explicitly keep it as manual.");
    if (target && value && !l.answer) throw Error("Save an answer before showing it.");
    l.answerVisible = value;
  }
}
function calculate(e: m.Envelope, op: Extract<z.infer<typeof operationSchema>, { op: "calculate_and_store" }>) {
  triangle(e, op.triangleId);
  m.getLabel(e, op.ref);
  if (!owningTriangles(e, op.ref).some(t => t.id === op.triangleId)) throw Error("The target does not belong to this triangle.");
  const context = calculationContexts(e, op.ref, op.triangleId).find(c => c.method === op.method);
  if (!context) throw Error("This method does not match the named target and triangle. Use a supported contextual method.");
  const units = new Set(e.document.edges.filter(a => triangle(e, op.triangleId).vertices.includes(a.from) && triangle(e, op.triangleId).vertices.includes(a.to) && a.label.state === "value" && a.label.unit).map(a => a.label.unit));
  if (units.size > 1) throw Error("Convert printed lengths to one unit before calculating.");
  const raw = { ...context.raw };
  for (const [key, value] of Object.entries(op.inputs ?? {})) {
    if (!(key in raw)) throw Error(`Unknown calculation input: ${key}.`);
    if (raw[key] && raw[key] !== value) throw Error(`Input ${key} disagrees with its named printed given. Edit the label explicitly first.`);
    raw[key] = value;
  }
  if (Object.values(raw).some(v => !v)) throw Error(`Supply missing named inputs: ${Object.keys(raw).filter(k => !raw[k]).join(", ")}. Drawn lengths and hidden answers are never inputs.`);
  const results = maths.calculate(op.method, raw);
  const result = op.branch ? results.find(r => r.branch === op.branch) : results.length === 1 ? results[0] : undefined;
  if (!result) throw Error(`Choose a valid branch: ${results.map(r => r.branch).join("; ")}.`);
  if (op.rounding.kind === "sf" && op.rounding.digits < 1) throw Error("Significant figures must be at least 1.");
  const unit = result.dimension === "angle" ? "°" : result.dimension === "area" ? `${context.unit}²` as m.Label["unit"] : context.unit;
  return maths.saveAnswer(e, op.ref, result, op.rounding, unit, op.overwrite);
}
export function applyOperations(source: m.Envelope, operations: z.infer<typeof operationSchema>[]) {
  let e = structuredClone(source);
  for (const op of operations) {
    const d = e.document;
    switch (op.op) {
      case "set_label": e = m.editLabel(e, op.ref, op.patch); break;
      case "set_angle_mark": found(d.angles, op.id).mark = op.mark; break;
      case "set_edge_style": {
        const edge = found(d.edges, op.id);
        if (op.ticks !== undefined) edge.ticks = op.ticks;
        if (op.dashed !== undefined) edge.dashed = op.dashed;
        break;
      }
      case "move_vertex": found(d.vertices, op.id); e = g.moveVertex(e, op.id, { x: op.x, y: op.y }); break;
      case "transform": e = g.transform(e, op.kind); break;
      case "set_constraint": triangle(e, op.triangleId, op.vertex); e = g.setConstraint(e, op.triangleId, op.type, op.vertex); break;
      case "add_triangle":
        if (op.layout !== "separate" && !op.edgeId) throw Error("Name the shared/split edge explicitly.");
        if (op.edgeId) found(d.edges, op.edgeId);
        e = g.addTriangle(e, op.layout, op.edgeId); break;
      case "remove_second": e = g.removeSecond(e); break;
      case "add_height": triangle(e, op.triangleId, op.apex); e = g.addHeight(e, op.triangleId, op.apex); break;
      case "remove_height": found(d.heights, op.id); d.heights = d.heights.filter(h => h.id !== op.id); break;
      case "set_area": {
        const t = triangle(e, op.triangleId);
        if (op.label === null) delete t.area;
        else t.area = { ...(t.area ?? m.label("", "blank", "cm²")), ...op.label };
        e.schemaVersion = d.triangles.some(t => t.area) ? 2 : 1;
        e.rendererVersion = e.schemaVersion === 2 ? "triangle-2" : "triangle-1";
        break;
      }
      case "add_caption": e = g.caption(e); Object.assign(e.document.captions.at(-1)!.label, op.label); break;
      case "remove_caption": found(d.captions, op.id); d.captions = d.captions.filter(c => c.id !== op.id); break;
      case "set_shared_label": {
        const shared = d.sharedLabels.find(s => s.id === op.id);
        if (shared) shared.text = op.text;
        else d.sharedLabels.push({ id: op.id, text: op.text });
        break;
      }
      case "link_label": {
        const l = m.getLabel(e, op.ref), oldText = m.textOf(e, l);
        if (op.sharedId) found(d.sharedLabels, op.sharedId);
        l.shared = op.sharedId;
        if (!op.sharedId) l.text = oldText;
        break;
      }
      case "set_print": d.widthCm = op.widthCm; break;
      case "set_not_to_scale": d.notToScale = op.visible; break;
      case "construct": triangle(e, op.triangleId); e = maths.construct(e, op.triangleId, op.method, op.inputs); break;
      case "calculate_and_store": e = calculate(e, op); break;
      case "set_saved_answer": {
        const l = m.getLabel(e, op.ref);
        if ((l.answer || l.state === "value") && !op.overwrite) throw Error("Explicit overwrite is required for an occupied answer target.");
        l.answer = op.answer; l.answerVisible = false; l.calculation = null; break;
      }
      case "keep_answer_manual": {
        const l = m.getLabel(e, op.ref);
        if (!l.answer) throw Error("There is no saved answer to keep.");
        l.calculation = null; break;
      }
      case "set_answer_visibility": visible(e, op.ref, op.visible); break;
      case "worked_copy": visible(e, undefined, true); break;
    }
    e = m.validate(e);
  }
  if (new TextEncoder().encode(m.canonical(e)).length > 64000) throw Error("Use a Triangle source of at most 64000 UTF-8 bytes.");
  return e;
}
export function create(input: unknown): m.Envelope {
  const v = createSchema.parse(input);
  if (v.spec && v.envelope) throw Error("Supply spec or envelope, not both.");
  if (v.envelope) return applyOperations(m.validate(v.envelope), []);
  const s = v.spec;
  if (s?.shape && s.example) throw Error("Choose shape or example, not both.");
  const example = s?.example ? examples.find(v => v.key === s.example) : undefined;
  if (s?.example && !example) throw Error("Choose a supported example from triangle_capabilities.");
  let e = example ? example.build() : g.create(s?.shape);
  if (s?.widthCm !== undefined) e.document.widthCm = s.widthCm;
  if (s?.notToScale !== undefined) e.document.notToScale = s.notToScale;
  for (const l of s?.labels ?? []) e = m.editLabel(e, l.ref, l.label);
  return applyOperations(m.validate(e), s?.operations ?? []);
}
export async function revise(input: unknown) {
  const v = revisionSchema.parse(input), e = m.validate(v.envelope);
  if (await hash(e) !== v.baseHash) throw Error("base_hash_mismatch: Use the exact returned envelope and contentHash.");
  return applyOperations(e, v.operations);
}
export function editorLink(e: m.Envelope, base: string): string | null {
  try { return triangleEditorLink(e,base); } catch { return null; }
}
export function assertPrintable(e: m.Envelope) {
  const issue = exportIssue(e);
  if (issue) throw Error(issue);
}
export function printFacts(e: m.Envelope) {
  const svg = layout(e).svg;
  const hasLines = m.allLabels(e).some(({label:l}) => l.state === "answer-line" && !(l.answer && l.answerVisible));
  return guidance({ textSizesPt: renderedTextSizesPt(svg, 72 / 25.4),
    answerLineLengthsMm: hasLines ? [4 * glyphAdvance("_") * 11 * 25.4 / 72] : [],
  });
}
