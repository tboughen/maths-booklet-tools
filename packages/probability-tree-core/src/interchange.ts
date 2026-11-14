import { z } from "zod";
import * as core from "./index";
import { examples } from "./examples";
import { guidance, renderedTextSizesPt } from "../../graph-core/src/print-guidance";

/** MCP adapter: the same schema, maths and renderer as the browser editor. */
export const exampleIds = examples.map((x) => x.id) as [string, ...string[]];
const id = z.string().regex(/^b[0-9]{1,3}$/);
const show = z.enum(["show", "hidden"]);
const part = z.enum(["outcome", "probability", "endOutcome", "endProbability"]);
/** A path is a branch ID or its outcome names joined by ", " (for example "Red, Blue"). */
const pathRef = z.string().max(120);
const settings = z
  .object({
    stageTitles: core.documentSchema.shape.stageTitles,
    linkLabels: z.boolean(),
    endColumn: core.documentSchema.shape.endColumn,
    endHeadings: core.documentSchema.shape.endHeadings,
    blankStyle: core.documentSchema.shape.blankStyle,
    branchMm: core.documentSchema.shape.branchMm,
    gapMm: core.documentSchema.shape.gapMm,
  })
  .partial()
  .strict();
const questionInput = z
  .object({
    text: z.string().max(60),
    event: z.array(pathRef).max(core.MAX_LEAVES).optional(),
    given: z.array(pathRef).max(core.MAX_LEAVES).optional(),
    answer: z.string().max(24).optional(),
    answerShow: show.optional(),
    calculate: z.boolean().optional(),
  })
  .strict();
const flatBranch = z
  .object({
    id,
    parent: id.nullable(),
    outcome: z.string().max(24),
    probability: z.string().max(24).optional(),
    /** Path-end column text (a path's last branch only): with hidden, a saved answer pupils write. */
    endOutcome: z.string().max(24).optional(),
    endProbability: z.string().max(24).optional(),
    hidden: z.array(part).max(4).optional(),
    bold: z.boolean().optional(),
  })
  .strict();
export const outputViewSchema = z.enum(["pupil", "answer"]);
export const createSchema = z
  .object({
    envelope: core.envelopeSchema.optional(),
    spec: z
      .object({
        example: z.enum(exampleIds).optional(),
        worked: z.boolean().optional(),
        stages: z
          .array(
            z
              .object({
                outcomes: z.array(z.string().max(24)).min(2).max(core.MAX_CHILDREN),
                probabilities: z.array(z.string().max(24)).max(core.MAX_CHILDREN).optional(),
              })
              .strict(),
          )
          .min(1)
          .max(core.MAX_DEPTH)
          .optional(),
        branches: z.array(flatBranch).min(2).max(core.MAX_BRANCHES).optional(),
        bag: z
          .object({ counts: z.array(z.number().int().min(0).max(999)).min(2).max(core.MAX_CHILDREN), replacement: z.boolean() })
          .strict()
          .optional(),
        hide: z.enum(["none", "probabilities", "end", "all"]).optional(),
        settings: settings.optional(),
        questions: z.array(questionInput).max(core.MAX_QUESTIONS).optional(),
      })
      .strict()
      .optional(),
    outputView: outputViewSchema.optional(),
  })
  .strict();

export const operationSchema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("set_label"), branchId: id, part, text: z.string().max(24).optional(), show: show.optional() }).strict(),
  z.object({ op: z.literal("set_outcome_name"), branchId: id, text: z.string().max(24) }).strict(),
  z.object({ op: z.literal("set_bold"), branchId: id, bold: z.boolean() }).strict(),
  z.object({ op: z.literal("extend_branch"), branchId: id, count: z.number().int().min(1).max(core.MAX_CHILDREN).optional() }).strict(),
  z.object({ op: z.literal("end_path"), branchId: id }).strict(),
  z.object({ op: z.literal("add_branch"), parentId: id.nullable() }).strict(),
  z.object({ op: z.literal("remove_last_branch"), parentId: id.nullable() }).strict(),
  z.object({ op: z.literal("add_stage") }).strict(),
  z.object({ op: z.literal("remove_stage") }).strict(),
  z
    .object({
      op: z.literal("fill_from_bag"),
      counts: z.array(z.number().int().min(0).max(999)).min(2).max(core.MAX_CHILDREN),
      replacement: z.boolean(),
      overwrite: z.boolean().default(false),
    })
    .strict(),
  z.object({ op: z.literal("fill_complements") }).strict(),
  z.object({ op: z.literal("fill_end"), part: z.enum(["outcome", "probability"]) }).strict(),
  z.object({ op: z.literal("set_visibility"), part: z.enum(["probabilities", "end", "all"]), show }).strict(),
  z.object({ op: z.literal("set_settings"), settings }).strict(),
  z.object({ op: z.literal("add_question"), question: questionInput }).strict(),
  z
    .object({
      op: z.literal("set_question"),
      questionId: z.string().regex(/^q[0-9]{1,2}$/),
      question: questionInput.partial(),
    })
    .strict(),
  z.object({ op: z.literal("remove_question"), questionId: z.string().regex(/^q[0-9]{1,2}$/) }).strict(),
  z.object({ op: z.literal("calculate_question"), questionId: z.string().regex(/^q[0-9]{1,2}$/) }).strict(),
]);
export const revisionSchema = z
  .object({
    envelope: core.envelopeSchema,
    baseHash: z.string().regex(/^[a-f0-9]{64}$/),
    operations: z.array(operationSchema).max(30),
    outputView: outputViewSchema.optional(),
  })
  .strict();

function resolvePaths(d: core.TreeDocument, refs: string[]): string[] {
  const ends = core.leaves(d);
  return refs.map((ref) => {
    const byId = ends.find((b) => b.id === ref);
    if (byId) return byId.id;
    const byName = ends.find((b) => core.pathName(d, b.id).toLowerCase() === ref.trim().toLowerCase());
    if (!byName)
      throw Error(`Path "${ref}" is not a complete path. Use an end branch ID or outcome names such as "Red, Blue".`);
    return byName.id;
  });
}
function applyQuestion(e: core.Envelope, q: core.Question, input: Partial<z.infer<typeof questionInput>>): core.Envelope {
  const d = e.document;
  if (input.text !== undefined) q.text = input.text;
  if (input.event) q.event = resolvePaths(d, input.event);
  if (input.given) q.given = resolvePaths(d, input.given);
  if (input.answer !== undefined) q.answer.text = input.answer;
  if (input.answerShow) q.answer.show = input.answerShow;
  let out = core.validate(e);
  if (input.calculate) {
    const calculated = core.calculateQuestion(out, q.id);
    if (!calculated) throw Error("calculate needs event paths whose probabilities are all numbers.");
    out = calculated;
  }
  return out;
}
function addQuestion(e: core.Envelope, input: z.infer<typeof questionInput>) {
  if (e.document.questions.length >= core.MAX_QUESTIONS) throw Error(`Use at most ${core.MAX_QUESTIONS} questions.`);
  const n = core.addQuestion(e);
  const q = n.document.questions[n.document.questions.length - 1];
  return applyQuestion(n, q, input);
}
function setVisibility(e: core.Envelope, which: "none" | "probabilities" | "end" | "all") {
  return which === "none" ? e : core.setAllShown(e, which, "hidden");
}
function requireBranch(e: core.Envelope, branchId: string) {
  const b = e.document.branches.find((x) => x.id === branchId);
  if (!b) throw Error(`Unknown branchId ${branchId}. Use IDs from the returned envelope.`);
  return b;
}
function unchanged(before: core.Envelope, after: core.Envelope, message: string) {
  if (core.canonical(before) === core.canonical(after)) throw Error(message);
  return after;
}

export function create(input: unknown): core.Envelope {
  const v = createSchema.parse(input);
  if (v.envelope && v.spec) throw Error("Supply spec or envelope, not both.");
  if (v.envelope) return core.validate(v.envelope);
  const s = v.spec;
  if (!s) return core.create();
  const shapes = [s.example, s.stages, s.branches].filter((x) => x !== undefined).length;
  if (shapes > 1) throw Error("Use one of example, stages or branches.");
  let e: core.Envelope;
  if (s.example) {
    if (s.bag || s.questions) throw Error("Examples already contain their probabilities and questions; revise the result instead.");
    e = examples.find((x) => x.id === s.example)!.make(s.worked ?? false);
  } else if (s.branches) {
    const n = core.create();
    n.document.branches = s.branches.map((b) => {
      const branch = core.newBranch(b.id, b.parent, b.outcome, b.probability ?? "");
      branch.bold = b.bold ?? false;
      if (b.endOutcome !== undefined) branch.endOutcome.text = b.endOutcome;
      if (b.endProbability !== undefined) branch.endProbability.text = b.endProbability;
      for (const h of b.hidden ?? []) branch[h].show = "hidden";
      return branch;
    });
    n.document.stageTitles = [];
    n.document.linkLabels = false;
    const parents = new Set(s.branches.map((b) => b.parent));
    for (const b of s.branches)
      if (parents.has(b.id) && (b.endOutcome !== undefined || b.endProbability !== undefined))
        throw Error(`branches ${b.id}: endOutcome and endProbability belong on the last branch of a path.`);
    e = core.validate(n);
  } else if (s.stages) {
    e = core.uniform(s.stages, { stageTitles: [] });
  } else e = core.create();
  if (s.settings) e = core.validate({ ...e, document: { ...e.document, ...s.settings } });
  if (s.bag) {
    const filled = core.fillFromBag(e, s.bag.counts, s.bag.replacement);
    if (!filled) throw Error("bag.counts needs one count for every branch at each point and enough items for every stage.");
    e = filled;
  }
  if (s.hide) e = setVisibility(e, s.hide);
  for (const q of s.questions ?? []) e = addQuestion(e, q);
  if (s.worked) e = core.forView(e, "answer");
  return e;
}

export async function revise(input: unknown): Promise<core.Envelope> {
  const v = revisionSchema.parse(input);
  if ((await core.hash(v.envelope)) !== v.baseHash)
    throw Error("base_hash_mismatch: Use the exact returned envelope and contentHash.");
  let e = core.validate(structuredClone(v.envelope));
  for (const op of v.operations) {
    switch (op.op) {
      case "set_label": {
        const n = structuredClone(e);
        const b = requireBranch(n, op.branchId);
        if (op.text !== undefined) b[op.part].text = op.text;
        if (op.show) b[op.part].show = op.show;
        e = core.validate(n);
        break;
      }
      case "set_outcome_name":
        requireBranch(e, op.branchId);
        e = core.setOutcome(e, op.branchId, op.text);
        break;
      case "set_bold": {
        const n = structuredClone(e);
        requireBranch(n, op.branchId).bold = op.bold;
        e = n;
        break;
      }
      case "extend_branch":
        requireBranch(e, op.branchId);
        e = unchanged(e, core.extendBranch(e, op.branchId, op.count), "Only a path end below the fourth stage can be extended.");
        break;
      case "end_path":
        requireBranch(e, op.branchId);
        e = unchanged(e, core.pruneBranch(e, op.branchId), "This branch already ends its path.");
        break;
      case "add_branch":
        e = unchanged(e, core.addSibling(e, op.parentId), `Each point allows at most ${core.MAX_CHILDREN} branches.`);
        break;
      case "remove_last_branch":
        e = unchanged(e, core.removeLastSibling(e, op.parentId), "The first stage keeps at least 2 branches and each later point at least 1.");
        break;
      case "add_stage":
        e = unchanged(e, core.addStage(e), `Use at most ${core.MAX_DEPTH} stages.`);
        break;
      case "remove_stage":
        e = unchanged(e, core.removeStage(e), "A tree keeps at least one stage.");
        break;
      case "fill_from_bag": {
        if (!op.overwrite && e.document.branches.some((b) => b.probability.text.trim()))
          throw Error("Existing probabilities require overwrite:true.");
        const filled = core.fillFromBag(e, op.counts, op.replacement);
        if (!filled) throw Error("counts needs one count for every branch at each point and enough items for every stage.");
        e = filled;
        break;
      }
      case "fill_complements":
        e = core.fillComplements(e).envelope;
        break;
      case "fill_end":
        e = core.fillEnd(e, op.part);
        break;
      case "set_visibility":
        e = core.setAllShown(e, op.part, op.show);
        break;
      case "set_settings":
        e = core.validate({ ...e, document: { ...e.document, ...op.settings } });
        break;
      case "add_question":
        e = addQuestion(e, op.question);
        break;
      case "set_question": {
        const n = structuredClone(e);
        const q = n.document.questions.find((x) => x.id === op.questionId);
        if (!q) throw Error(`Unknown questionId ${op.questionId}.`);
        e = applyQuestion(n, q, op.question);
        break;
      }
      case "remove_question": {
        const n = structuredClone(e);
        n.document.questions = n.document.questions.filter((q) => q.id !== op.questionId);
        e = core.validate(n);
        break;
      }
      case "calculate_question": {
        const calculated = core.calculateQuestion(e, op.questionId);
        if (!calculated) throw Error("Choose event paths whose probabilities are all numbers before calculating.");
        e = calculated;
        break;
      }
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
