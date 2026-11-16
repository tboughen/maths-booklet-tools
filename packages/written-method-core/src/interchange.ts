import { z } from "zod";
import * as core from "./index";
import { examples } from "./examples";
import { guidance, renderedTextSizesPt } from "../../graph-core/src/print-guidance";
import { LINE_WEIGHTS } from "../../envelope-core/src/house-style";

/** Connector adapter: the same schema, explicit completion and renderer as the browser editor. */
export const exampleIds = examples.map((x) => x.id) as [string, ...string[]];
const show = z.enum(["show", "hidden"]);
const digits = z.string().max(core.MAX_DIGITS + 2);
export const outputViewSchema = z.enum(["pupil", "answer"]);

/** A row: digits ("" is a pupil blank) or {text, hidden}. */
const item = z.union([digits, z.object({ text: digits, hidden: z.boolean().optional() }).strict()]);
const workingInput = z
  .object({ text: item, place: core.rowSchema.shape.place.optional(), kind: core.rowSchema.shape.kind.optional() })
  .strict();
const completeInput = z.union([z.boolean(), z.object({ hidden: z.boolean().optional(), decimals: z.boolean().optional() }).strict()]);
export const specSchema = z
  .object({
    example: z.enum(exampleIds).optional(),
    worked: z.boolean().optional(),
    method: core.documentSchema.shape.method.optional(),
    /** add: 2 to 4 numbers; subtract and multiply: 2; division: [number to divide, number to divide by]. */
    numbers: z.array(item).min(2).max(4).optional(),
    /** Blank or given working rows (long multiplication, long division). A number gives that many blank rows. */
    working: z.union([z.number().int().min(0).max(core.MAX_ROWS), z.array(workingInput).max(core.MAX_ROWS)]).optional(),
    answer: item.optional(),
    /** Division: true for an "r ..." space after the quotient, or the remainder. */
    remainder: z.union([z.boolean(), item]).optional(),
    /** Division: zeros written after the number to keep dividing, such as "0". */
    extend: item.optional(),
    cellMm: core.documentSchema.shape.cellMm.optional(),
    intentionalError: z.boolean().optional(),
    lines: z.enum(LINE_WEIGHTS).optional(),
    /** Explicitly work the method out (answer, working rows, carries, exchanges); hidden answers unless hidden is false. */
    complete: completeInput.optional(),
  })
  .strict();
export const createSchema = z
  .object({ envelope: core.envelopeSchema.optional(), spec: specSchema.optional(), outputView: outputViewSchema.optional() })
  .strict();
const rowRef = z.string().max(24).describe('A row ID: "n1", "n2" (the numbers), "w1"... (working rows), "answer", "remainder" or "extend".');
export const operationSchema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("set_row"), row: rowRef, text: digits.optional(), show: show.optional() }).strict(),
  z.object({ op: z.literal("set_method"), method: core.documentSchema.shape.method }).strict(),
  z.object({ op: z.literal("add_number"), text: digits.optional() }).strict(),
  z.object({ op: z.literal("remove_number"), row: rowRef }).strict(),
  z.object({ op: z.literal("add_row"), text: digits.optional(), place: core.rowSchema.shape.place.optional(), kind: core.rowSchema.shape.kind.optional() }).strict(),
  z.object({ op: z.literal("remove_row"), row: rowRef }).strict(),
  z.object({ op: z.literal("shift_row"), row: rowRef, by: z.number().int().min(-6).max(6) }).strict(),
  z.object({ op: z.literal("set_remainder"), on: z.boolean() }).strict(),
  z
    .object({
      op: z.literal("set_mark"),
      row: rowRef,
      place: core.markSchema.shape.place,
      text: z.string().max(2).optional().describe('One or two digits; "" removes the small digit.'),
      show: show.optional(),
      cross: z.boolean().optional(),
    })
    .strict(),
  z.object({ op: z.literal("complete"), hidden: z.boolean().optional(), decimals: z.boolean().optional() }).strict(),
  z
    .object({
      op: z.literal("set_settings"),
      settings: z.object({ cellMm: core.documentSchema.shape.cellMm, intentionalError: z.boolean(), lines: z.enum(LINE_WEIGHTS) }).partial().strict(),
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

function toValue(input: z.infer<typeof item> | undefined): core.Value {
  if (input === undefined) return core.value();
  const t = (typeof input === "string" ? input : input.text).trim(),
    hidden = typeof input === "object" && !!input.hidden;
  if (hidden && !t) throw Error("A blank row cannot hold a hidden answer. Give its value, then hide it.");
  return core.value(t, hidden ? "hidden" : "show");
}
function settings(e: core.Envelope, s: { cellMm?: number; intentionalError?: boolean; lines?: "normal" | "bold" }): core.Envelope {
  const n = structuredClone(e),
    d = n.document;
  if (s.cellMm !== undefined) d.cellMm = s.cellMm;
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
  if (s.example && (s.method || s.numbers || s.working !== undefined || s.answer !== undefined || s.remainder !== undefined || s.extend !== undefined || s.complete))
    throw Error("Examples already contain their numbers; revise the result instead.");
  let e: core.Envelope;
  if (s.example) e = examples.find((x) => x.id === s.example)!.make(false);
  else {
    const method = s.method ?? "multiply";
    const base = core.create(method);
    const d = base.document;
    d.numbers = (s.numbers ?? ["", ""]).map((t, i) => ({ id: `n${i + 1}`, value: toValue(t) }));
    const kindFor = (i: number): core.Row["kind"] => (method === "multiply" ? "product" : i % 2 ? "remainder" : "subtract");
    if (typeof s.working === "number") d.working = Array.from({ length: s.working }, (_, i) => ({ id: `w${i + 1}`, value: core.value(), place: 0, kind: kindFor(i) }));
    else if (s.working) d.working = s.working.map((w, i) => ({ id: `w${i + 1}`, value: toValue(w.text), place: w.place ?? 0, kind: w.kind ?? kindFor(i) }));
    d.answer = toValue(s.answer);
    if (s.remainder !== undefined && s.remainder !== false) d.remainder = s.remainder === true ? core.value() : toValue(s.remainder);
    d.extend = toValue(s.extend);
    e = core.validate(base);
  }
  e = settings(e, s);
  if (s.complete) {
    const c = typeof s.complete === "object" ? s.complete : {};
    e = core.complete(e, c.hidden ?? true, c.decimals ?? false).envelope;
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
      case "set_row":
        e = core.setRow(e, op.row, { text: op.text, show: op.show });
        break;
      case "set_method":
        e = core.setMethod(e, op.method);
        break;
      case "add_number":
        e = core.addNumber(e, op.text);
        break;
      case "remove_number":
        e = core.removeNumber(e, op.row);
        break;
      case "add_row":
        e = core.addRow(e, op.kind, op.place, op.text);
        break;
      case "remove_row":
        e = core.removeRow(e, op.row);
        break;
      case "shift_row":
        e = core.shiftRow(e, op.row, op.by);
        break;
      case "set_remainder":
        e = core.setRemainder(e, op.on);
        break;
      case "set_mark":
        e = core.setMark(e, op.row, op.place, op.text === "" ? null : { text: op.text, show: op.show, cross: op.cross });
        break;
      case "complete":
        e = core.complete(e, op.hidden ?? true, op.decimals ?? false).envelope;
        break;
      case "set_settings":
        e = settings(e, op.settings);
        break;
    }
  }
  return e;
}

export function printFacts(e: core.Envelope, view: "pupil" | "answer" = "pupil") {
  const shown = core.forView(e, view);
  return guidance({
    textSizesPt: renderedTextSizesPt(core.renderSvg(shown), 72 / 25.4),
    gridPitchMm: [e.document.cellMm],
    tableRowHeightsMm: [e.document.cellMm],
    answerLineLengthsMm: [],
  });
}
