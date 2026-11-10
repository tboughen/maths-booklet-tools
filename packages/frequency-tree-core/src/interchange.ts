import { z } from "zod";
import * as core from "./index";
import { examples } from "./examples";
import { guidance, renderedTextSizesPt } from "../../graph-core/src/print-guidance";

/** Connector adapter: the same schema, counts and renderer as the browser editor. */
export const exampleIds = examples.map((x) => x.id) as [string, ...string[]];
const nodeId = z.string().regex(/^n[0-9]{1,2}$/);
const questionId = z.string().regex(/^q[0-9]$/);
const show = z.enum(["show", "hidden"]);
/** A group is named by its ID or its names joined by ", " (for example "men, like coffee"). */
const groupRef = z.string().max(70);
const settings = z
  .object({
    linkLabels: z.boolean(),
    labelPlace: core.documentSchema.shape.labelPlace,
    nodeShape: core.documentSchema.shape.nodeShape,
    branchMm: core.documentSchema.shape.branchMm,
    gapMm: core.documentSchema.shape.gapMm,
  })
  .partial()
  .strict();
const groupFields = {
  name: z.string().max(30),
  count: z.string().max(12).optional(),
  /** Keep the count as a saved answer and leave the oval empty for pupils. */
  countHidden: z.boolean().optional(),
  nameHidden: z.boolean().optional(),
};
const leafGroup = z.object(groupFields).strict();
const group = z
  .object({ ...groupFields, children: z.array(leafGroup).min(2).max(core.MAX_CHILDREN).optional() })
  .strict();
const questionInput = z
  .object({
    text: z.string().max(60),
    /** Groups added for the top of the fraction. */
    top: z.array(groupRef).max(core.MAX_NODES).optional(),
    /** Groups added for the bottom; leave out for the total. */
    bottom: z.array(groupRef).max(core.MAX_NODES).optional(),
    answer: z.string().max(24).optional(),
    answerShow: show.optional(),
    /** The only way an answer is calculated. */
    calculate: z.boolean().optional(),
  })
  .strict();
export const outputViewSchema = z.enum(["pupil", "answer"]);
export const specSchema = z
  .object({
    example: z.enum(exampleIds).optional(),
    worked: z.boolean().optional(),
    total: z.string().max(12).optional(),
    totalHidden: z.boolean().optional(),
    groups: z.array(group).min(2).max(core.MAX_CHILDREN).optional(),
    /** Hide counts for pupils after building: every count but the total, or every count. */
    hide: z.enum(["none", "counts", "all"]).optional(),
    /** Explicitly work out empty counts that follow from the others. */
    fillCounts: z.boolean().optional(),
    settings: settings.optional(),
    questions: z.array(questionInput).max(core.MAX_QUESTIONS).optional(),
  })
  .strict();
export const createSchema = z
  .object({ envelope: core.envelopeSchema.optional(), spec: specSchema.optional(), outputView: outputViewSchema.optional() })
  .strict();

export const operationSchema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("set_count"), groupId: z.union([nodeId, z.literal("total")]), text: z.string().max(12).optional(), show: show.optional() }).strict(),
  z.object({ op: z.literal("set_name"), groupId: nodeId, text: z.string().max(30).optional(), show: show.optional() }).strict(),
  z.object({ op: z.literal("split_group"), groupId: nodeId, count: z.number().int().min(2).max(core.MAX_CHILDREN).optional() }).strict(),
  z.object({ op: z.literal("end_path"), groupId: nodeId }).strict(),
  z.object({ op: z.literal("add_branch"), parentId: nodeId.nullable() }).strict(),
  z.object({ op: z.literal("remove_last_branch"), parentId: nodeId.nullable() }).strict(),
  z.object({ op: z.literal("add_level") }).strict(),
  z.object({ op: z.literal("remove_level") }).strict(),
  z.object({ op: z.literal("fill_counts") }).strict(),
  z.object({ op: z.literal("hide_counts"), keepTotal: z.boolean().default(true) }).strict(),
  z.object({ op: z.literal("show_all") }).strict(),
  z.object({ op: z.literal("set_settings"), settings }).strict(),
  z.object({ op: z.literal("add_question"), question: questionInput }).strict(),
  z.object({ op: z.literal("set_question"), questionId, question: questionInput.partial() }).strict(),
  z.object({ op: z.literal("remove_question"), questionId }).strict(),
  z.object({ op: z.literal("calculate_question"), questionId }).strict(),
]);
export const revisionSchema = z
  .object({
    envelope: core.envelopeSchema,
    baseHash: z.string().regex(/^[a-f0-9]{64}$/),
    operations: z.array(operationSchema).max(30),
    outputView: outputViewSchema.optional(),
  })
  .strict();

function resolveGroups(d: core.TreeDocument, refs: string[]): string[] {
  return refs.map((ref) => {
    const byId = d.nodes.find((b) => b.id === ref);
    if (byId) return byId.id;
    const byName = d.nodes.find((b) => core.groupName(d, b.id).toLowerCase() === ref.trim().toLowerCase());
    if (!byName) throw Error(`Group "${ref}" is not in the tree. Use a group ID or names such as "men, like coffee".`);
    return byName.id;
  });
}
function applyQuestion(e: core.Envelope, qid: string, input: Partial<z.infer<typeof questionInput>>): core.Envelope {
  const n = structuredClone(e),
    d = n.document,
    q = d.questions.find((x) => x.id === qid);
  if (!q) throw Error(`Unknown questionId ${qid}.`);
  if (input.text !== undefined) q.text = input.text;
  if (input.top) q.numerator = resolveGroups(d, input.top);
  if (input.bottom) q.denominator = resolveGroups(d, input.bottom);
  if (input.answer !== undefined) q.answer.text = input.answer;
  if (input.answerShow) q.answer.show = input.answerShow;
  let out = core.validate(n);
  if (input.calculate) {
    const calculated = core.calculateQuestion(out, qid);
    if (!calculated) throw Error("calculate needs top groups (and bottom groups or the total) with whole-number counts.");
    out = calculated;
  }
  return out;
}
function addQuestion(e: core.Envelope, input: z.infer<typeof questionInput>) {
  if (e.document.questions.length >= core.MAX_QUESTIONS) throw Error(`Use at most ${core.MAX_QUESTIONS} questions.`);
  const n = core.addQuestion(e);
  return applyQuestion(n, n.document.questions[n.document.questions.length - 1].id, input);
}
function requireNode(e: core.Envelope, id: string) {
  const b = e.document.nodes.find((x) => x.id === id);
  if (!b) throw Error(`Unknown groupId ${id}. Use IDs from the returned envelope.`);
  return b;
}
function unchanged(before: core.Envelope, after: core.Envelope, message: string) {
  if (core.canonical(before) === core.canonical(after)) throw Error(message);
  return after;
}
const nested = (g: z.infer<typeof group>): core.NestedNode => ({
  category: g.name,
  count: g.count ?? "",
  hidden: [...(g.countHidden ? (["count"] as const) : []), ...(g.nameHidden ? (["category"] as const) : [])],
  children: g.children?.map(nested),
});

export function create(input: unknown): core.Envelope {
  const v = createSchema.parse(input);
  if (v.envelope && v.spec) throw Error("Supply spec or envelope, not both.");
  if (v.envelope) return core.validate(v.envelope);
  const s = v.spec;
  if (!s) return core.create();
  if (s.example && (s.groups || s.total !== undefined || s.questions))
    throw Error("Examples already contain their groups, counts and questions; revise the result instead.");
  let e: core.Envelope;
  if (s.example) e = examples.find((x) => x.id === s.example)!.make(false);
  else if (s.groups) e = core.fromNested(s.total ?? "", s.groups.map(nested), { hideTotal: s.totalHidden });
  else {
    e = core.create();
    if (s.total !== undefined) e.document.total.text = s.total;
    if (s.totalHidden) e.document.total.show = "hidden";
  }
  if (s.settings) e = core.validate({ ...e, document: { ...e.document, ...s.settings } });
  if (s.fillCounts) e = core.fillCounts(e).envelope;
  if (s.hide === "counts") e = core.hideCounts(e);
  if (s.hide === "all") e = core.hideCounts(e, false);
  for (const q of s.questions ?? []) e = addQuestion(e, q);
  if (s.worked) e = core.forView(e, "answer");
  return e;
}

export async function revise(input: unknown): Promise<core.Envelope> {
  const v = revisionSchema.parse(input);
  if ((await core.hash(v.envelope)) !== v.baseHash) throw Error("base_hash_mismatch: Use the exact returned envelope and contentHash.");
  let e = core.validate(structuredClone(v.envelope));
  for (const op of v.operations) {
    switch (op.op) {
      case "set_count": {
        const n = structuredClone(e);
        const l = op.groupId === "total" ? n.document.total : requireNode(n, op.groupId).count;
        if (op.text !== undefined) l.text = op.text;
        if (op.show) l.show = op.show;
        e = core.validate(n);
        break;
      }
      case "set_name": {
        requireNode(e, op.groupId);
        if (op.text !== undefined) e = core.setCategory(e, op.groupId, op.text);
        if (op.show) {
          const n = structuredClone(e);
          requireNode(n, op.groupId).category.show = op.show;
          e = n;
        }
        break;
      }
      case "split_group":
        requireNode(e, op.groupId);
        e = unchanged(e, core.splitNode(e, op.groupId, op.count), `Only a first-level group that ends its path can be split (at most ${core.MAX_DEPTH} levels).`);
        break;
      case "end_path":
        requireNode(e, op.groupId);
        e = unchanged(e, core.mergeNode(e, op.groupId), "This group already ends its path.");
        break;
      case "add_branch":
        e = unchanged(e, core.addSibling(e, op.parentId), `Each split allows at most ${core.MAX_CHILDREN} branches.`);
        break;
      case "remove_last_branch":
        e = unchanged(e, core.removeLastSibling(e, op.parentId), "Each split needs at least 2 branches.");
        break;
      case "add_level":
        e = unchanged(e, core.addLevel(e), `Use at most ${core.MAX_DEPTH} levels.`);
        break;
      case "remove_level":
        e = unchanged(e, core.removeLevel(e), "A tree keeps at least one level.");
        break;
      case "fill_counts":
        e = core.fillCounts(e).envelope;
        break;
      case "hide_counts":
        e = core.hideCounts(e, op.keepTotal);
        break;
      case "show_all":
        e = core.showAll(e);
        break;
      case "set_settings":
        e = core.validate({ ...e, document: { ...e.document, ...op.settings } });
        break;
      case "add_question":
        e = addQuestion(e, op.question);
        break;
      case "set_question":
        e = applyQuestion(e, op.questionId, op.question);
        break;
      case "remove_question": {
        const n = structuredClone(e);
        n.document.questions = n.document.questions.filter((q) => q.id !== op.questionId);
        e = core.validate(n);
        break;
      }
      case "calculate_question": {
        const calculated = core.calculateQuestion(e, op.questionId);
        if (!calculated) throw Error("Choose top groups (and bottom groups or the total) with whole-number counts before calculating.");
        e = calculated;
        break;
      }
    }
  }
  return e;
}

export function printFacts(e: core.Envelope, view: "pupil" | "answer" = "pupil") {
  return guidance({
    textSizesPt: renderedTextSizesPt(core.renderSvg(core.forView(e, view)), 72 / 25.4),
    gridPitchMm: [],
    tableRowHeightsMm: [],
    answerLineLengthsMm: e.document.questions.length ? [32] : [],
  });
}
