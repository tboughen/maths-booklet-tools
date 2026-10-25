import { z } from "zod";
import * as c from "./index";
const target = z
  .object({
    barId: z.string().optional(),
    partId: z.string().optional(),
    spanId: z.string().optional(),
  })
  .strict();
export const operationSchema = z.discriminatedUnion("op", [
  z
    .object({ op: z.literal("set_label"), target, label: c.labelSchema })
    .strict(),
  z
    .object({
      op: z.literal("set_part"),
      barId: z.string(),
      partId: z.string(),
      weight: z.string().optional(),
      shade: z.boolean().optional(),
    })
    .strict(),
  z
    .object({
      op: z.literal("add_bar"),
      bar: c.barSchema,
      afterId: z.string().optional(),
    })
    .strict(),
  z
    .object({
      op: z.literal("remove_bar"),
      barId: z.string(),
      discardSpans: z.boolean().default(false),
    })
    .strict(),
  z
    .object({
      op: z.literal("add_part"),
      barId: z.string(),
      part: c.partSchema,
      afterId: z.string().optional(),
    })
    .strict(),
  z
    .object({
      op: z.literal("remove_part"),
      barId: z.string(),
      partId: z.string(),
      discardSpans: z.boolean().default(false),
    })
    .strict(),
  z.object({ op: z.literal("add_span"), span: c.spanSchema }).strict(),
  z.object({ op: z.literal("set_span"), span: c.spanSchema }).strict(),
  z.object({ op: z.literal("remove_span"), spanId: z.string() }).strict(),
  z
    .object({
      op: z.literal("set_alignment"),
      barId: z.string(),
      offset: z.string(),
    })
    .strict(),
  z
    .object({
      op: z.literal("set_print"),
      presentation: c.presentationSchema.partial(),
    })
    .strict(),
  z.object({ op: z.literal("reveal_saved_answers") }).strict(),
]);
export type Operation = z.input<typeof operationSchema>;
export const specSchema = z
  .object({
    example: z.enum(c.exampleNames).optional(),
    worked: z.boolean().default(false),
    bars: z.array(c.barSchema).min(1).max(c.LIMITS.bars).optional(),
    spans: z.array(c.spanSchema).max(c.LIMITS.spans).optional(),
    presentation: c.presentationSchema.partial().optional(),
  })
  .strict();
export const createSchema = z
  .object({ spec: specSchema.optional(), envelope: c.schema.optional() })
  .strict();
export const revisionSchema = z
  .object({
    envelope: c.schema,
    baseHash: z.string().regex(/^[a-f0-9]{64}$/),
    operations: z.array(operationSchema).max(c.LIMITS.operations),
  })
  .strict();
function bounded(raw: unknown) {
  if (
    new TextEncoder().encode(JSON.stringify(raw)).length > c.LIMITS.requestBytes
  )
    throw Error("Bar-model requests are limited to 32 KiB.");
}
export function create(raw: unknown) {
  bounded(raw);
  const v = createSchema.parse(raw);
  if (v.spec && v.envelope) throw Error("Supply spec or envelope, not both.");
  if (v.envelope) return c.validate(v.envelope);
  const s = v.spec;
  if (s?.example && (s.bars || s.spans))
    throw Error("Supply an example or bars/spans, not both.");
  if (s?.worked && !s.example)
    throw Error(
      "A worked preset requires an explicit example. Use reveal_saved_answers for a saved resource.",
    );
  const e = c.example(s?.example ?? "BM01", s?.worked);
  if (s?.bars) {
    e.document.bars = s.bars;
    e.document.spans = s.spans ?? [];
  } else if (s?.spans) e.document.spans = s.spans;
  Object.assign(e.document.presentation, s?.presentation);
  return c.validate(e);
}
export function apply(e: c.Envelope, operations: Operation[]) {
  if (operations.length > c.LIMITS.operations)
    throw Error("Use at most 30 revision operations.");
  const n = c.validate(e),
    d = n.document;
  const bar = (id: string) => {
    const b = d.bars.find((b) => b.id === id);
    if (!b) throw Error(`Unknown bar ${id}.`);
    return b;
  };
  function orphan(test: (a: c.Anchor) => boolean, discard: boolean) {
    const affected = d.spans.filter((s) => test(s.from) || test(s.to));
    if (affected.length && !discard)
      throw Error(
        `This removal affects braces ${affected.map((s) => s.id).join(", ")}. Remove them explicitly or set discardSpans:true; Undo restores everything.`,
      );
    d.spans = d.spans.filter((s) => !affected.includes(s));
  }
  for (const raw of operations) {
    const op = operationSchema.parse(raw);
    switch (op.op) {
      case "set_label": {
        const t = op.target;
        let l: c.Label;
        if (t.spanId && !t.barId && !t.partId) {
          const s = d.spans.find((s) => s.id === t.spanId);
          if (!s) throw Error("Unknown span.");
          l = s.label;
        } else if (t.barId && !t.spanId) {
          const b = bar(t.barId);
          const p = t.partId ? b.parts.find((p) => p.id === t.partId) : null;
          if (t.partId && !p) throw Error("Unknown part.");
          l = p ? p.label : b.name;
        } else
          throw Error(
            "Label target requires spanId alone, or barId with optional partId.",
          );
        Object.assign(l, op.label);
        break;
      }
      case "set_part": {
        const p = bar(op.barId).parts.find((p) => p.id === op.partId);
        if (!p) throw Error("Unknown part.");
        if (op.weight !== undefined) p.weight = op.weight;
        if (op.shade !== undefined) p.shade = op.shade;
        break;
      }
      case "add_bar": {
        const i = op.afterId
          ? d.bars.findIndex((b) => b.id === op.afterId)
          : d.bars.length - 1;
        if (i < 0) throw Error("Unknown preceding bar.");
        d.bars.splice(i + 1, 0, op.bar);
        break;
      }
      case "remove_bar": {
        bar(op.barId);
        orphan((a) => a.barId === op.barId, op.discardSpans);
        d.bars = d.bars.filter((b) => b.id !== op.barId);
        break;
      }
      case "add_part": {
        const b = bar(op.barId),
          i = op.afterId
            ? b.parts.findIndex((p) => p.id === op.afterId)
            : b.parts.length - 1;
        if (i < 0) throw Error("Unknown preceding part.");
        b.parts.splice(i + 1, 0, op.part);
        break;
      }
      case "remove_part": {
        const b = bar(op.barId);
        if (!b.parts.some((p) => p.id === op.partId))
          throw Error("Unknown part.");
        orphan(
          (a) => a.barId === op.barId && a.partId === op.partId,
          op.discardSpans,
        );
        b.parts = b.parts.filter((p) => p.id !== op.partId);
        break;
      }
      case "add_span":
        d.spans.push(op.span);
        break;
      case "set_span": {
        const i = d.spans.findIndex((s) => s.id === op.span.id);
        if (i < 0) throw Error("Unknown span.");
        d.spans[i] = op.span;
        break;
      }
      case "remove_span":
        if (!d.spans.some((s) => s.id === op.spanId))
          throw Error("Unknown span.");
        d.spans = d.spans.filter((s) => s.id !== op.spanId);
        break;
      case "set_alignment":
        bar(op.barId).offset = op.offset;
        break;
      case "set_print":
        Object.assign(d.presentation, op.presentation);
        break;
      case "reveal_saved_answers":
        [
          ...d.bars.flatMap((b) => [b.name, ...b.parts.map((p) => p.label)]),
          ...d.spans.map((s) => s.label),
        ].forEach((l) => {
          if (l.state === "hidden") l.state = "value";
        });
        break;
    }
  }
  return c.validate(n);
}
export async function revise(raw: unknown) {
  bounded(raw);
  const v = revisionSchema.parse(raw);
  if ((await c.hash(v.envelope)) !== v.baseHash)
    throw Error("stale_hash: use the exact returned envelope and contentHash.");
  return apply(v.envelope, v.operations);
}
export function editorLink(e: c.Envelope, base: string) {
  const bytes = new TextEncoder().encode(c.canonical(e));
  let binary = "";
  bytes.forEach((v) => (binary += String.fromCharCode(v)));
  const u = new URL(base);
  u.search = "?tool=bar-model";
  u.hash =
    "bar-model=" +
    btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
  if (u.href.length > 16000)
    throw Error("This model is too large for a link. Save its editable file.");
  return u.href;
}
export function parseLink(href: string) {
  const u = new URL(href);
  if (
    href.length > 16000 ||
    u.searchParams.get("tool") !== "bar-model" ||
    !/^#bar-model=[A-Za-z0-9_-]+$/.test(u.hash)
  )
    throw Error("Invalid bar-model link. Open an editable file.");
  return c.parseFile(
    new TextDecoder("utf-8", { fatal: true }).decode(
      Uint8Array.from(
        atob(u.hash.slice(11).replaceAll("-", "+").replaceAll("_", "/")),
        (c) => c.charCodeAt(0),
      ),
    ),
  );
}
export const hash = c.hash;
