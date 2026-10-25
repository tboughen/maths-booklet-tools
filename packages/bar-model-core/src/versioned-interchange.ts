import { z } from "zod";
import * as old from "./interchange";
import * as v1 from "./index";
import * as v2 from "./v2";
import * as v3 from "./v3";
import * as c from "./versioned";
const id = v2.idSchema,
  slot = z.enum(v2.slots);
const location = z.object({ barId: id, partId: id, slot }).strict();
export const newOperationSchema = z.discriminatedUnion("op", [
  z
    .object({
      op: z.literal("upgrade_document"),
      targetSchemaVersion: z.literal(3).optional(),
    })
    .strict(),
  z
    .object({
      op: z.literal("set_section_label"),
      barId: id,
      partId: id,
      slot,
      label: v1.labelSchema,
    })
    .strict(),
  z
    .object({
      op: z.literal("set_section_labels"),
      barId: id,
      partIds: z.array(id).min(1).max(24),
      slot,
      label: v1.labelSchema,
    })
    .strict(),
  z
    .object({
      op: z.literal("move_or_copy_label"),
      from: location,
      to: location,
      mode: z.enum(["move", "copy"]),
      overwrite: z.boolean().optional(),
    })
    .strict(),
  z
    .object({
      op: z.literal("set_annotation"),
      annotation: v2.annotationSchema,
    })
    .strict(),
  z.object({ op: z.literal("remove_annotation"), annotationId: id }).strict(),
  z
    .object({
      op: z.literal("equal_sections"),
      barId: id,
      count: z.number().int().min(1).max(24),
      discardContent: z.boolean().optional(),
    })
    .strict(),
  z
    .object({
      op: z.literal("set_fill"),
      barId: id,
      partIds: z.array(id).min(1).max(24),
      fill: z.enum(v2.fills),
    })
    .strict(),
  z
    .object({
      op: z.literal("add_caption"),
      caption: z.union([v2.captionSchema, v3.captionSchema]),
    })
    .strict(),
  z
    .object({
      op: z.literal("update_caption"),
      caption: z.union([v2.captionSchema, v3.captionSchema]),
    })
    .strict(),
  z.object({ op: z.literal("remove_caption"), captionId: id }).strict(),
  z
    .object({ op: z.literal("set_title"), label: v1.labelSchema.nullable() })
    .strict(),
  z
    .object({
      op: z.literal("set_presentation"),
      presentation: v3.presentationSchema.partial(),
      autoName: z.boolean().optional(),
    })
    .strict(),
  z
    .object({
      op: z.literal("set_quantity_name"),
      barId: id,
      label: v1.labelSchema,
    })
    .strict(),
  z
    .object({
      op: z.literal("set_relative_length"),
      barId: id,
      partId: id,
      weight: z.string().max(24),
    })
    .strict(),
  z
    .object({
      op: z.literal("append_section"),
      barId: id,
      part: v2.partSchema,
      afterId: id.optional(),
    })
    .strict(),
  z
    .object({
      op: z.literal("append_bar"),
      bar: v2.barSchema,
      afterId: id.optional(),
    })
    .strict(),
  z
    .object({
      op: z.literal("reorder_bars"),
      barIds: z.array(id).min(1).max(6),
    })
    .strict(),
]);
export const operationSchema = z.discriminatedUnion("op", [
  ...old.operationSchema.options,
  ...newOperationSchema.options,
]);
export type Operation = z.input<typeof operationSchema>;
export const specV2Schema = z
  .object({
    schemaVersion: z.literal(2),
    starter: z.enum(v2.starters).optional(),
    count: z.number().int().min(1).max(24).optional(),
    ratio: z.array(z.number().int().positive()).min(2).max(6).optional(),
    partitioned: z.boolean().optional(),
    comparisonLengths: z
      .array(z.number().int().min(1).max(24))
      .min(2)
      .max(2)
      .optional(),
    bars: z.array(v2.barSchema).min(1).max(6).optional(),
    annotations: z.array(v2.annotationSchema).max(18).optional(),
    captions: z.array(v2.captionSchema).max(3).optional(),
    title: v1.labelSchema.optional(),
    presentation: v2.presentationSchema.partial().optional(),
  })
  .strict();
export const specV3Schema = specV2Schema
  .extend({
    schemaVersion: z.literal(3),
    captions: z.array(v3.captionSchema).max(3).optional(),
    presentation: v3.presentationSchema.partial().optional(),
  })
  .strict();
export const specSchema = z.union([old.specSchema, specV2Schema, specV3Schema]);
export const createSchema = z
  .object({ spec: specSchema.optional(), envelope: c.schema.optional() })
  .strict();
export const revisionSchema = z
  .object({
    envelope: c.schema,
    baseHash: z.string().regex(/^[a-f0-9]{64}$/),
    operations: z.array(operationSchema).max(30),
  })
  .strict();
function bounded(raw: unknown) {
  if (new TextEncoder().encode(JSON.stringify(raw)).length > 32768)
    throw Error("Bar-model requests are limited to 32 KiB.");
}
export function create(raw: unknown): c.Envelope {
  bounded(raw);
  const v = createSchema.parse(raw);
  if (v.spec && v.envelope) throw Error("Supply spec or envelope, not both.");
  if (v.envelope) return c.validate(v.envelope);
  if (!v.spec || !("schemaVersion" in v.spec)) return old.create(v);
  const s = v.spec;
  if (s.bars && s.starter)
    throw Error("Supply a starter or custom bars, not both.");
  const core = s.schemaVersion === 3 ? v3 : v2;
  const e = core.fresh(
    s.starter ?? "part-whole",
    s.count,
    s.ratio,
    s.partitioned,
    s.comparisonLengths,
  );
  if (s.bars) e.document.bars = s.bars;
  if (s.annotations) e.document.annotations = s.annotations;
  else if (s.bars) e.document.annotations = [];
  if (s.captions) e.document.captions = s.captions;
  if (s.title) e.document.title = s.title;
  Object.assign(e.document.presentation, s.presentation);
  return core.validate(e);
}
export function affectedContent(
  e: v2.Envelope | v3.Envelope,
  barId: string,
  count: number,
) {
  const b = e.document.bars.find((b) => b.id === barId);
  if (!b) throw Error("Unknown bar.");
  if (count === b.parts.length) return [];
  return [
    ...b.parts.flatMap((p, i) =>
      Object.entries(p.labels)
        .filter(([, l]) => l.text || l.state !== "blank")
        .map(
          ([slot]) => `Section ${i + 1} ${slot} label (including saved text)`,
        ),
    ),
    ...(b.parts.some((p) => p.fill !== "none") ? ["Section fills"] : []),
    ...e.document.annotations
      .filter(
        (a) =>
          a.scope.kind === "range" &&
          (a.scope.from.barId === barId || a.scope.to.barId === barId),
      )
      .map((a) => `Fixed annotation ${a.id}`),
  ];
}
export function apply(source: c.Envelope, operations: Operation[]): c.Envelope {
  if (operations.length > 30)
    throw Error("Use at most 30 revision operations.");
  const ops = operations.map((o) => operationSchema.parse(o));
  const upgrades = ops.flatMap((o, i) =>
    o.op === "upgrade_document" ? [i] : [],
  );
  const upgrade = ops.find((o) => o.op === "upgrade_document");
  const target = upgrade?.targetSchemaVersion ?? 2;
  if (
    upgrades.length &&
    (upgrades.length !== 1 ||
      upgrades[0] !== 0 ||
      (target === 2 ? source.schemaVersion !== 1 : source.schemaVersion === 3))
  )
    throw Error(
      "Use upgrade_document exactly once, first, on an older resource; targetSchemaVersion:3 explicitly selects the new profile.",
    );
  if (source.schemaVersion === 1 && !upgrades.length) {
    if (ops.some((o) => !old.operationSchema.safeParse(o).success))
      throw Error("Use upgrade_document first before v2 features.");
    return old.apply(source, ops as old.Operation[]);
  }
  const core =
    source.schemaVersion === 3 || (upgrade && target === 3) ? v3 : v2;
  const e =
      upgrade && target === 3
        ? v3.upgrade(source as v1.Envelope | v2.Envelope)
        : source.schemaVersion === 1
          ? v2.upgrade(source)
          : core.validate(source),
    d = e.document;
  const bar = (id: string) => {
    const b = d.bars.find((b) => b.id === id);
    if (!b) throw Error(`Unknown bar ${id}.`);
    return b;
  };
  const part = (barId: string, partId: string) => {
    const p = bar(barId).parts.find((p) => p.id === partId);
    if (!p) throw Error(`Unknown section ${partId}.`);
    return p;
  };
  function orphan(test: (a: v1.Anchor) => boolean, discard: boolean) {
    const affected = d.annotations.filter((a) => {
      if (a.scope.kind === "whole")
        return test({ barId: a.scope.barId, partId: "", edge: "start" });
      return test(a.scope.from) || test(a.scope.to);
    });
    if (affected.length && !discard)
      throw Error(
        "Removal affects annotations. Choose explicit removal/outside placement or cancel.",
      );
    d.annotations = d.annotations.filter((a) => !affected.includes(a));
  }
  function unique(prefix: string) {
    const ids = new Set([
      ...d.bars.flatMap((b) => [b.id, ...b.parts.map((p) => p.id)]),
      ...d.annotations.map((a) => a.id),
      ...d.captions.map((c) => c.id),
    ]);
    let i = 1;
    while (ids.has(`${prefix}${i}`)) i++;
    return `${prefix}${i}`;
  }
  for (const op of ops) {
    switch (op.op) {
      case "upgrade_document":
        break;
      case "set_section_label":
        part(op.barId, op.partId).labels[op.slot] = op.label;
        break;
      case "set_section_labels":
        if (new Set(op.partIds).size !== op.partIds.length)
          throw Error("Duplicate section selection.");
        op.partIds.forEach(
          (id) =>
            (part(op.barId, id).labels[op.slot] = structuredClone(op.label)),
        );
        break;
      case "move_or_copy_label": {
        if (JSON.stringify(op.from) === JSON.stringify(op.to))
          throw Error("Choose a different destination slot.");
        const from = part(op.from.barId, op.from.partId),
          to = part(op.to.barId, op.to.partId),
          l = from.labels[op.from.slot] ?? v1.label(),
          dest = to.labels[op.to.slot];
        if (dest && (dest.text || dest.state !== "blank") && !op.overwrite)
          throw Error(
            "Destination contains visible or retained text. Preview it and explicitly overwrite, or cancel.",
          );
        to.labels[op.to.slot] = structuredClone(l);
        if (op.mode === "move") from.labels[op.from.slot] = v1.label();
        break;
      }
      case "set_annotation": {
        const i = d.annotations.findIndex((a) => a.id === op.annotation.id);
        if (i < 0) d.annotations.push(op.annotation);
        else d.annotations[i] = op.annotation;
        break;
      }
      case "remove_annotation":
        if (!d.annotations.some((a) => a.id === op.annotationId))
          throw Error("Unknown annotation.");
        d.annotations = d.annotations.filter((a) => a.id !== op.annotationId);
        break;
      case "equal_sections": {
        const b = bar(op.barId),
          weight = v2.divided(v2.sum(b.parts.map((p) => p.weight)), op.count);
        if (
          (Number(v1.exact(weight).n) / Number(v1.exact(weight).d)) *
            d.presentation.unitMm <
          4
        )
          throw Error(
            "Equal sections would be narrower than 4 mm; choose fewer sections or increase unit width.",
          );
        if (b.parts.length === op.count)
          b.parts.forEach((p) => (p.weight = weight));
        else {
          const affected = affectedContent(e, b.id, op.count);
          if (affected.length && !op.discardContent)
            throw Error(
              `Replacement would discard ${affected.join(", ")}. Preview and explicitly discard, or cancel.`,
            );
          d.annotations = d.annotations.filter(
            (a) =>
              a.scope.kind === "whole" ||
              (a.scope.from.barId !== b.id && a.scope.to.barId !== b.id),
          );
          // Allocate against old IDs before replacement, so fixed references can never reattach.
          const parts: v2.Part[] = [];
          for (let i = 0; i < op.count; i++) {
            const id = unique("section");
            const p: v2.Part = {
              id,
              weight,
              labels: { inside: v1.label() },
              fill: "none",
            };
            parts.push(p);
            b.parts.push(p);
          }
          b.parts = parts;
        }
        break;
      }
      case "set_fill":
        if (new Set(op.partIds).size !== op.partIds.length)
          throw Error("Duplicate section selection.");
        op.partIds.forEach((id) => (part(op.barId, id).fill = op.fill));
        break;
      case "add_caption":
        if (e.schemaVersion === 3)
          e.document.captions.push(v3.captionSchema.parse(op.caption));
        else e.document.captions.push(v2.captionSchema.parse(op.caption));
        break;
      case "update_caption": {
        const i = d.captions.findIndex((c) => c.id === op.caption.id);
        if (i < 0) throw Error("Unknown caption.");
        d.captions[i] = op.caption;
        break;
      }
      case "remove_caption":
        if (!d.captions.some((c) => c.id === op.captionId))
          throw Error("Unknown caption.");
        d.captions = d.captions.filter((c) => c.id !== op.captionId);
        break;
      case "set_title":
        if (op.label === null) delete d.title;
        else d.title = op.label;
        break;
      case "set_presentation":
        Object.assign(d.presentation, op.presentation);
        if (op.autoName) delete d.presentation.nameWidthMm;
        break;
      case "set_quantity_name":
        bar(op.barId).name = op.label;
        break;
      case "set_relative_length":
        part(op.barId, op.partId).weight = op.weight;
        break;
      case "append_section": {
        const b = bar(op.barId),
          i = op.afterId
            ? b.parts.findIndex((p) => p.id === op.afterId)
            : b.parts.length - 1;
        if (i < 0) throw Error("Unknown preceding section.");
        b.parts.splice(i + 1, 0, op.part);
        break;
      }
      case "append_bar": {
        const i = op.afterId
          ? d.bars.findIndex((b) => b.id === op.afterId)
          : d.bars.length - 1;
        if (i < 0) throw Error("Unknown preceding bar.");
        d.bars.splice(i + 1, 0, op.bar);
        break;
      }
      case "reorder_bars":
        if (
          op.barIds.length !== d.bars.length ||
          new Set(op.barIds).size !== d.bars.length
        )
          throw Error("Supply every bar ID exactly once.");
        d.bars = op.barIds.map(bar);
        break;
      case "set_label":
        if (op.target.spanId && !op.target.barId && !op.target.partId) {
          const a = d.annotations.find((a) => a.id === op.target.spanId);
          if (!a) throw Error("Unknown annotation.");
          a.label = op.label;
        } else if (op.target.barId && !op.target.spanId) {
          if (op.target.partId)
            part(op.target.barId, op.target.partId).labels.inside = op.label;
          else bar(op.target.barId).name = op.label;
        } else throw Error("Choose a label target.");
        break;
      case "set_part": {
        const p = part(op.barId, op.partId);
        if (op.weight !== undefined) p.weight = op.weight;
        if (op.shade !== undefined) p.fill = op.shade ? "neutral" : "none";
        break;
      }
      case "set_alignment":
        bar(op.barId).offset = op.offset;
        break;
      case "set_print":
        Object.assign(d.presentation, op.presentation);
        break;
      case "remove_part": {
        const b = bar(op.barId);
        part(b.id, op.partId);
        orphan(
          (a) => a.barId === b.id && a.partId === op.partId,
          op.discardSpans,
        );
        b.parts = b.parts.filter((p) => p.id !== op.partId);
        break;
      }
      case "remove_bar":
        bar(op.barId);
        orphan((a) => a.barId === op.barId, op.discardSpans);
        d.bars = d.bars.filter((b) => b.id !== op.barId);
        break;
      case "remove_span":
        if (!d.annotations.some((a) => a.id === op.spanId))
          throw Error("Unknown annotation.");
        d.annotations = d.annotations.filter((a) => a.id !== op.spanId);
        break;
      case "add_span":
      case "set_span": {
        const s = op.span,
          a: v2.Annotation = {
            id: s.id,
            scope: { kind: "range", from: s.from, to: s.to },
            label: s.label,
            decoration: s.style,
            placement: s.side,
          };
        const i = d.annotations.findIndex((a) => a.id === s.id);
        if (op.op === "set_span" && i < 0) throw Error("Unknown annotation.");
        if (op.op === "add_span") d.annotations.push(a);
        else d.annotations[i] = a;
        break;
      }
      case "add_part": {
        const p = op.part,
          b = bar(op.barId),
          i = op.afterId
            ? b.parts.findIndex((p) => p.id === op.afterId)
            : b.parts.length - 1;
        if (i < 0) throw Error("Unknown preceding section.");
        b.parts.splice(i + 1, 0, {
          id: p.id,
          weight: p.weight,
          labels: { inside: p.label },
          fill: p.shade ? "neutral" : "none",
        });
        break;
      }
      case "add_bar": {
        const b = op.bar,
          i = op.afterId
            ? d.bars.findIndex((b) => b.id === op.afterId)
            : d.bars.length - 1;
        if (i < 0) throw Error("Unknown preceding bar.");
        d.bars.splice(i + 1, 0, {
          id: b.id,
          name: b.name,
          offset: b.offset,
          parts: b.parts.map((p) => ({
            id: p.id,
            weight: p.weight,
            labels: { inside: p.label },
            fill: p.shade ? "neutral" : "none",
          })),
        });
        break;
      }
      case "reveal_saved_answers":
        core.allLabels(e as never).forEach((l) => {
          if (l.state === "hidden") l.state = "value";
        });
        break;
    }
  }
  const valid = core.validate(e),
    issue = core.exportIssue(valid as never);
  if (issue) throw Error(issue);
  return valid;
}
export async function revise(raw: unknown) {
  bounded(raw);
  const source = z
    .object({
      envelope: c.schema,
      baseHash: z.string().regex(/^[a-f0-9]{64}$/),
      operations: z.array(z.unknown()).max(30),
    })
    .strict()
    .parse(raw);
  if ((await c.hash(source.envelope)) !== source.baseHash)
    throw Error("stale_hash: use the exact returned envelope and contentHash.");
  const v = revisionSchema.parse(source);
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
