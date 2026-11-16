import { z } from "zod";
import * as core from "./index";
import { examples } from "./examples";
import { guidance, renderedTextSizesPt } from "../../graph-core/src/print-guidance";
import { LINE_WEIGHTS } from "../../envelope-core/src/house-style";

/** Connector adapter: the same schema, explicit completion and renderer as the browser editor. */
export const exampleIds = examples.map((x) => x.id) as [string, ...string[]];
const show = z.enum(["show", "hidden"]);
const text = z.string().max(core.MAX_TEXT);
export const outputViewSchema = z.enum(["pupil", "answer"]);

/** A printed item: text ("" is a pupil blank) or {text, hidden}. */
const item = z.union([text, z.object({ text, hidden: z.boolean().optional() }).strict()]);
const machineInput = z
  .object({
    /** The word or number before the first box (default "input"). */
    start: item.optional(),
    /** The boxes, first to last: "× 3", "− 8", "" for an empty box. */
    ops: z.array(item).min(1).max(core.MAX_STEPS),
    /** Values on the arrows between boxes: one fewer than ops; null for nothing there. */
    between: z.array(item.nullable()).max(core.MAX_STEPS - 1).optional(),
    /** The word or number after the last box (default "output"). */
    end: item.optional(),
    /** "left" draws the machine backwards, arrows right to left. */
    direction: core.machineSchema.shape.direction.optional(),
  })
  .strict();
const completeInput = z.union([z.boolean(), z.object({ hidden: z.boolean().optional(), between: z.boolean().optional() }).strict()]);
export const specSchema = z
  .object({
    example: z.enum(exampleIds).optional(),
    worked: z.boolean().optional(),
    /** Shorthand for one machine: its boxes. */
    ops: z.array(item).min(1).max(core.MAX_STEPS).optional(),
    start: item.optional(),
    end: item.optional(),
    machines: z.array(machineInput).min(1).max(core.MAX_MACHINES).optional(),
    boxShape: core.documentSchema.shape.boxShape.optional(),
    intentionalError: z.boolean().optional(),
    lines: z.enum(LINE_WEIGHTS).optional(),
    /** Explicitly add the inverse of machine 1 beneath it (before any completion). */
    inverse: z.boolean().optional(),
    /** Explicitly work every machine out (forwards from a numeric start, or back from a numeric end); hidden answers unless hidden is false. */
    complete: completeInput.optional(),
  })
  .strict();
export const createSchema = z
  .object({ envelope: core.envelopeSchema.optional(), spec: specSchema.optional(), outputView: outputViewSchema.optional() })
  .strict();
const machineRef = z.string().max(24).describe('A machine ID such as "m1".');
const slotRef = z
  .string()
  .regex(/^(start|end|op:[0-4]|out:[0-3])$/)
  .describe('"start", "end", "op:0" (the first box) or "out:0" (the value on the arrow after the first box).');
export const operationSchema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("set_item"), machineId: machineRef, slot: slotRef, text: text.optional(), show: show.optional() }).strict(),
  z.object({ op: z.literal("remove_between"), machineId: machineRef, slot: slotRef }).strict(),
  z.object({ op: z.literal("add_box"), machineId: machineRef, after: z.number().int().min(-1).max(4).optional(), text: text.optional() }).strict(),
  z.object({ op: z.literal("remove_box"), machineId: machineRef, index: z.number().int().min(0).max(4) }).strict(),
  z.object({ op: z.literal("add_machine"), ops: z.array(text).min(1).max(core.MAX_STEPS).optional() }).strict(),
  z.object({ op: z.literal("remove_machine"), machineId: machineRef }).strict(),
  z.object({ op: z.literal("add_inverse"), machineId: machineRef }).strict(),
  z.object({ op: z.literal("set_direction"), machineId: machineRef, direction: core.machineSchema.shape.direction }).strict(),
  z.object({ op: z.literal("complete"), machineId: machineRef.optional(), hidden: z.boolean().optional(), between: z.boolean().optional() }).strict(),
  z
    .object({
      op: z.literal("set_settings"),
      settings: z.object({ boxShape: core.documentSchema.shape.boxShape, intentionalError: z.boolean(), lines: z.enum(LINE_WEIGHTS) }).partial().strict(),
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

function toValue(input: z.infer<typeof item> | undefined, fallback: string): core.Value {
  if (input === undefined) return core.value(fallback);
  const t = (typeof input === "string" ? input : input.text).trim(),
    hidden = typeof input === "object" && !!input.hidden;
  if (hidden && !t) throw Error("A blank cannot hold a hidden answer. Give its value, then hide it.");
  return core.value(t, hidden ? "hidden" : "show");
}
function buildMachine(machineId: string, m: z.infer<typeof machineInput>): core.Machine {
  if (m.between && m.between.length !== m.ops.length - 1) throw Error("Give one fewer value between boxes than there are boxes (null for none).");
  return {
    id: machineId,
    direction: m.direction ?? "right",
    start: toValue(m.start, "input"),
    steps: m.ops.map((op, i) => ({ op: toValue(op, ""), out: i < m.ops.length - 1 && m.between?.[i] != null ? toValue(m.between[i]!, "") : null })),
    end: toValue(m.end, "output"),
  };
}
function settings(e: core.Envelope, s: { boxShape?: "pentagon" | "rectangle"; intentionalError?: boolean; lines?: "normal" | "bold" }): core.Envelope {
  const n = structuredClone(e),
    d = n.document;
  if (s.boxShape !== undefined) d.boxShape = s.boxShape;
  if (s.intentionalError !== undefined) d.intentionalError = s.intentionalError;
  if (s.lines === "bold") d.lines = "bold";
  else if (s.lines === "normal") delete d.lines;
  return core.validate(n);
}

export function create(input: unknown): core.Envelope {
  const v = createSchema.parse(input);
  if (v.envelope && v.spec) throw Error("Supply spec or envelope, not both.");
  if (v.envelope) return core.validate(v.envelope);
  const s = v.spec;
  if (!s) return core.create();
  if (s.example && (s.ops || s.machines || s.start !== undefined || s.end !== undefined || s.complete || s.inverse))
    throw Error("Examples already contain their machines; revise the result instead.");
  if (s.machines && (s.ops || s.start !== undefined || s.end !== undefined)) throw Error("Give machines, or ops, start and end for one machine, not both.");
  let e: core.Envelope;
  if (s.example) e = examples.find((x) => x.id === s.example)!.make(false);
  else {
    const machines = s.machines ?? [{ ops: s.ops ?? ["", ""], start: s.start, end: s.end }];
    const base = core.create();
    e = core.validate({ ...base, document: { ...base.document, machines: machines.map((m, i) => buildMachine(`m${i + 1}`, m)) } });
  }
  e = settings(e, s);
  if (s.inverse) e = core.addInverse(e, e.document.machines[0].id);
  if (s.complete) {
    const c = typeof s.complete === "object" ? s.complete : {};
    e = core.complete(e, undefined, c.hidden ?? true, c.between ?? true).envelope;
  }
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
        e = core.setSlot(e, op.machineId, op.slot as core.Slot, { text: op.text, show: op.show });
        break;
      case "remove_between":
        e = core.setSlot(e, op.machineId, op.slot as core.Slot, null);
        break;
      case "add_box":
        e = core.addStep(e, op.machineId, op.after, op.text);
        break;
      case "remove_box":
        e = core.removeStep(e, op.machineId, op.index);
        break;
      case "add_machine":
        e = core.addMachine(e, op.ops);
        break;
      case "remove_machine":
        e = core.removeMachine(e, op.machineId);
        break;
      case "add_inverse":
        e = core.addInverse(e, op.machineId);
        break;
      case "set_direction":
        e = core.setDirection(e, op.machineId, op.direction);
        break;
      case "complete":
        e = core.complete(e, op.machineId, op.hidden ?? true, op.between ?? true).envelope;
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
  const blanks = g.rows.flatMap((r) => r.labels.filter((l) => !l.v.text || l.v.show === "hidden").map((l) => l.blank));
  return guidance({
    textSizesPt: renderedTextSizesPt(core.renderSvg(shown), 72 / 25.4),
    gridPitchMm: [],
    tableRowHeightsMm: [],
    answerLineLengthsMm: [...new Set(blanks)],
  });
}
