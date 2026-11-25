import { z } from "zod";
import * as core from "./index";
import { examples } from "./examples";
import { guidance, renderedTextSizesPt } from "../../graph-core/src/print-guidance";
import { LINE_WEIGHTS } from "../../envelope-core/src/house-style";

/** Connector adapter: the same schema, explicit actions and renderer as the browser editor. */
export const exampleIds = examples.map((x) => x.id) as [string, ...string[]];
const show = z.enum(["show", "hidden"]);
const sideText = z.string().max(core.MAX_SIDE);
const opText = z.string().max(core.MAX_OP);
export const outputViewSchema = z.enum(["pupil", "answer"]);

/** A printed item: text ("" is a pupil blank) or {text, hidden}. */
const sideItem = z.union([sideText, z.object({ text: sideText, hidden: z.boolean().optional() }).strict()]);
const opItem = z.union([opText, z.object({ text: opText, hidden: z.boolean().optional() }).strict()]);
const relation = z.enum(core.RELATIONS);
/** A whole line as text ("y − 2 = 3x"), {text, hidden} to hide both sides, or {lhs, rel, rhs}. */
const lineInput = z.union([
  z.string().max(core.MAX_SIDE * 2 + 3),
  z.object({ text: z.string().max(core.MAX_SIDE * 2 + 3), hidden: z.boolean().optional() }).strict(),
  z.object({ lhs: sideItem, rel: relation.optional(), rhs: sideItem }).strict(),
]);
const stepInput = z
  .object({
    /** The same operation in both bubbles: "−2", "÷3", "" for empty bubbles. */
    bubble: opItem.optional(),
    left: opItem.optional(),
    right: opItem.optional(),
    leftUnder: core.underSchema.optional(),
    rightUnder: core.underSchema.optional(),
    /** The line the bubbles lead to; blank when left out. */
    line: lineInput.optional(),
  })
  .strict();
export const specSchema = z
  .object({
    example: z.enum(exampleIds).optional(),
    worked: z.boolean().optional(),
    /** The first line: an equation, inequality or formula. */
    start: lineInput.optional(),
    steps: z.array(stepInput).max(core.MAX_STEPS).optional(),
    intentionalError: z.boolean().optional(),
    lines: z.enum(LINE_WEIGHTS).optional(),
    /** "house": navy rounded bubbles for house-style booklet pages; "plain" (default): black ovals. */
    bubbles: z.enum(core.BUBBLE_STYLES).optional(),
  })
  .strict();
export const createSchema = z
  .object({ envelope: core.envelopeSchema.optional(), spec: specSchema.optional(), outputView: outputViewSchema.optional() })
  .strict();
const slotRef = z
  .string()
  .regex(core.SLOT_PATTERN)
  .describe('"first:lhs", "first:rhs", or for step N from 0 "step:N:left" / "step:N:right" (its bubbles) and "step:N:lhs" / "step:N:rhs" (its line).');
const lineRef = z.union([z.literal("first"), z.number().int().min(0).max(core.MAX_STEPS - 1)]);
export const operationSchema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("set_item"), slot: slotRef, text: sideText.optional(), show: show.optional() }).strict(),
  z.object({ op: z.literal("set_bubbles"), step: z.number().int().min(0).max(core.MAX_STEPS - 1), text: opText }).strict(),
  z.object({ op: z.literal("set_under"), step: z.number().int().min(0).max(core.MAX_STEPS - 1), side: z.enum(["left", "right"]), under: core.underSchema }).strict(),
  z.object({ op: z.literal("set_relation"), line: lineRef, rel: relation }).strict(),
  z.object({ op: z.literal("add_step"), after: z.number().int().min(-1).max(core.MAX_STEPS - 1).optional(), bubble: opText.optional() }).strict(),
  z.object({ op: z.literal("remove_step"), index: z.number().int().min(0).max(core.MAX_STEPS - 1) }).strict(),
  z
    .object({
      op: z.literal("set_settings"),
      settings: z.object({ intentionalError: z.boolean(), lines: z.enum(LINE_WEIGHTS), bubbles: z.enum(core.BUBBLE_STYLES) }).partial().strict(),
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

const NO_ANSWER = "A blank cannot hold a hidden answer. Give its value, then hide it.";
function toValue(input: string | { text: string; hidden?: boolean } | undefined): core.Value {
  if (input === undefined) return core.value();
  const t = (typeof input === "string" ? input : input.text).trim(),
    hidden = typeof input === "object" && !!input.hidden;
  if (hidden && !t) throw Error(NO_ANSWER);
  return core.value(t, hidden ? "hidden" : "show");
}
/** Splits "y − 2 = 3x" at its one relation sign. */
function splitLine(text: string): { lhs: string; rel: core.Relation; rhs: string } {
  const t = text.replace(/<=/g, "≤").replace(/>=/g, "≥");
  const at = [...t].flatMap((c, i) => ((core.RELATIONS as readonly string[]).includes(c) ? [i] : []));
  if (at.length !== 1) throw Error(`Write the line "${text}" with one sign (=, <, >, ≤ or ≥), or give {lhs, rel, rhs}.`);
  return { lhs: t.slice(0, at[0]).trim(), rel: t[at[0]] as core.Relation, rhs: t.slice(at[0] + 1).trim() };
}
function buildLine(input: z.infer<typeof lineInput> | undefined, rel: core.Relation): core.Line {
  if (input === undefined) return core.line("", "", rel);
  if (typeof input === "object" && "lhs" in input)
    return { lhs: toValue(input.lhs), rel: input.rel ?? rel, rhs: toValue(input.rhs) };
  const text = typeof input === "string" ? input : input.text,
    hidden = typeof input === "object" && !!input.hidden;
  if (!text.trim()) {
    if (hidden) throw Error(NO_ANSWER);
    return core.line("", "", rel);
  }
  const s = splitLine(text);
  return { lhs: toValue({ text: s.lhs, hidden: hidden && !!s.lhs }), rel: s.rel, rhs: toValue({ text: s.rhs, hidden: hidden && !!s.rhs }) };
}
function settings(e: core.Envelope, s: { intentionalError?: boolean; lines?: "normal" | "bold"; bubbles?: core.BubbleStyle }): core.Envelope {
  const n = structuredClone(e),
    d = n.document;
  if (s.intentionalError !== undefined) d.intentionalError = s.intentionalError;
  if (s.lines === "bold") d.lines = "bold";
  else if (s.lines === "normal") delete d.lines;
  if (s.bubbles === "house") d.bubbles = "house";
  else if (s.bubbles === "plain") delete d.bubbles;
  return core.validate(n);
}

export function create(input: unknown): core.Envelope {
  const v = createSchema.parse(input);
  if (v.envelope && v.spec) throw Error("Supply spec or envelope, not both.");
  if (v.envelope) return core.validate(v.envelope);
  const s = v.spec;
  if (!s) return core.create();
  if (s.example && (s.start !== undefined || s.steps)) throw Error("Examples already contain their working; revise the result instead.");
  let e: core.Envelope;
  if (s.example) e = examples.find((x) => x.id === s.example)!.make(false);
  else {
    const first = s.start === undefined ? core.create().document.first : buildLine(s.start, "=");
    let rel = first.rel;
    const steps = (s.steps ?? [{}]).map((st) => {
      if (st.bubble !== undefined && (st.left !== undefined || st.right !== undefined)) throw Error("Give bubble for both sides, or left and right, not both.");
      const l = st.left ?? st.bubble,
        r = st.right ?? st.bubble;
      const next = buildLine(st.line, rel);
      rel = next.rel;
      return {
        left: { op: toValue(l), under: st.leftUnder ?? "auto" },
        right: { op: toValue(r), under: st.rightUnder ?? "auto" },
        line: next,
      };
    });
    e = core.create(first, steps);
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
      case "set_item":
        if (op.text !== undefined && core.isBubble(op.slot as core.Slot) && op.text.length > core.MAX_OP) throw Error(`Use at most ${core.MAX_OP} characters in each bubble.`);
        e = core.setSlot(e, op.slot as core.Slot, { text: op.text, show: op.show });
        break;
      case "set_bubbles":
        e = core.setBubbles(e, op.step, op.text);
        break;
      case "set_under":
        e = core.setUnder(e, op.step, op.side, op.under);
        break;
      case "set_relation":
        e = core.setRelation(e, op.line, op.rel);
        break;
      case "add_step":
        e = core.addStep(e, op.after, op.bubble);
        break;
      case "remove_step":
        e = core.removeStep(e, op.index);
        break;
      case "set_settings":
        e = settings(e, op.settings);
        break;
    }
  }
  return e;
}

export function printFacts(e: core.Envelope, view: "pupil" | "answer" = "pupil") {
  const shown = core.forView(e, view),
    g = core.layout(shown);
  const blanks = g.rows.flatMap((r) => (r.kind === "line" ? [r.lhs, r.rhs].filter((s) => !s.v.text || s.v.show === "hidden").map((s) => s.width) : []));
  return guidance({
    textSizesPt: renderedTextSizesPt(core.renderSvg(shown), 72 / 25.4),
    gridPitchMm: [],
    tableRowHeightsMm: [],
    answerLineLengthsMm: [...new Set(blanks)],
  });
}
