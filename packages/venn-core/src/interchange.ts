import { z } from "zod";
import {
  activeMasks,
  arrangement,
  arrangements,
  canonical,
  changeArrangement,
  changeSets,
  createExtended,
  emptyRegion,
  envelopeSchema,
  exportIssue,
  expressionMasks,
  forView,
  hasRegionData,
  labelSchema,
  regionSchema,
  renderSvg,
  upgrade,
  validate,
  type Envelope,
} from "./index";
const set = z.enum(["universe", "A", "B", "C"]);
const mask = z.number().int().min(0).max(7);
const widthCm = z.number().min(8).max(16),
  fontPt = z.number().min(9).max(14);
const entry = z.object({ mask, region: regionSchema.partial() }).strict();
export const specSchema = z
  .object({
    sets: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
    shape: z.enum(["circles", "ovals"]).optional(),
    arrangement: z.enum(arrangements).optional(),
    caption: z.enum(["off", "relationship", "line"]).optional(),
    labels: z
      .array(z.object({ set, label: labelSchema.partial() }).strict())
      .max(4)
      .optional(),
    definitions: z
      .array(z.object({ set, text: z.string().max(120) }).strict())
      .max(4)
      .optional(),
    regions: z.array(entry).max(8).optional(),
    showDefinitions: z.boolean().optional(),
    widthCm: widthCm.optional(),
    fontPt: fontPt.optional(),
  })
  .strict();
export const outputViewSchema = z.enum(["pupil", "answer"]);
export const createSchema = z
  .object({
    spec: specSchema.optional(),
    envelope: envelopeSchema.optional(),
    outputView: outputViewSchema.optional(),
  })
  .strict();
const index = (id: z.infer<typeof set>) =>
  ["universe", "A", "B", "C"].indexOf(id);
function unique<T>(values: T[], key: (v: T) => unknown) {
  if (new Set(values.map(key)).size !== values.length)
    throw Error("Use each region or set identifier once.");
}
export function createVenn(raw: unknown = {}): Envelope {
  const v = createSchema.parse(raw);
  if (v.envelope && v.spec) throw Error("Supply spec or envelope, not both.");
  if (v.envelope) {
    const e = validate(v.envelope);
    assertPrintable(e);
    return e;
  }
  const s = v.spec ?? {},
    e = createExtended(s.sets ?? 2);
  const { labels, definitions, regions, ...settings } = s;
  Object.assign(e.document, settings);
  unique(labels ?? [], (v) => v.set);
  unique(definitions ?? [], (v) => v.set);
  unique(regions ?? [], (v) => v.mask);
  for (const l of labels ?? [])
    e.document.labels[index(l.set)] = {
      ...e.document.labels[index(l.set)],
      ...l.label,
    };
  for (const d of definitions ?? [])
    e.document.definitions[index(d.set)] = d.text;
  for (const r of regions ?? []) {
    if (!activeMasks(e).includes(r.mask))
      throw Error("This region does not exist in the selected layout.");
    e.document.regions[r.mask] = { ...emptyRegion(), ...r.region };
  }
  const n = validate(e);
  assertPrintable(n);
  return n;
}
export const operationSchema = z.discriminatedUnion("op", [
  z
    .object({
      op: z.literal("set_region"),
      mask,
      region: regionSchema.partial(),
    })
    .strict(),
  z
    .object({ op: z.literal("set_label"), set, label: labelSchema.partial() })
    .strict(),
  z
    .object({ op: z.literal("set_definition"), set, text: z.string().max(120) })
    .strict(),
  z
    .object({ op: z.literal("set_definitions_visible"), visible: z.boolean() })
    .strict(),
  z
    .object({
      op: z.literal("set_layout"),
      sets: specSchema.shape.sets,
      shape: specSchema.shape.shape,
      arrangement: specSchema.shape.arrangement,
      caption: specSchema.shape.caption,
      discardIncompatible: z.boolean().optional(),
    })
    .strict(),
  z
    .object({
      op: z.literal("shade_regions"),
      masks: z.array(mask).max(8),
      style: z.enum(["none", "grey", "hatch"]),
      mode: z.enum(["replace", "add"]),
    })
    .strict(),
  z
    .object({
      op: z.literal("shade_expression"),
      expression: z.string().max(120),
      style: z.enum(["none", "grey", "hatch"]),
      mode: z.enum(["replace", "add"]),
    })
    .strict(),
  z.object({ op: z.literal("clear_shading") }).strict(),
  z
    .object({
      op: z.literal("set_print"),
      widthCm: widthCm.optional(),
      fontPt: fontPt.optional(),
    })
    .strict(),
  z.object({ op: z.literal("upgrade_document") }).strict(),
]);
export const revisionSchema = z
  .object({
    envelope: envelopeSchema,
    baseHash: z.string().regex(/^[a-f0-9]{64}$/),
    operations: z.array(operationSchema).max(30),
    outputView: outputViewSchema.optional(),
  })
  .strict();
export async function hash(e: Envelope) {
  const bytes = await globalThis.crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(canonical(e)),
  );
  return Array.from(new Uint8Array(bytes), (n) =>
    n.toString(16).padStart(2, "0"),
  ).join("");
}
export function apply(raw: Envelope, operations: unknown): Envelope {
  let next = structuredClone(validate(raw));
  for (const o of z.array(operationSchema).max(30).parse(operations)) {
    if (o.op === "upgrade_document") {
      next = upgrade(next);
      continue;
    }
    if (o.op === "set_region") {
      if (!activeMasks(next).includes(o.mask))
        throw Error("This region does not exist in the current layout.");
      next.document.regions[o.mask] = {
        ...next.document.regions[o.mask],
        ...o.region,
      };
    }
    if (o.op === "set_label")
      next.document.labels[index(o.set)] = {
        ...next.document.labels[index(o.set)],
        ...o.label,
      };
    if (o.op === "set_definition")
      next.document.definitions[index(o.set)] = o.text;
    if (o.op === "set_definitions_visible")
      next.document.showDefinitions = o.visible;
    if (o.op === "set_layout") {
      const before = structuredClone(next);
      if (
        next.schemaVersion === 1 &&
        (o.sets === 1 || o.arrangement !== undefined || o.caption !== undefined)
      )
        throw Error(
          "Use upgrade_document before selecting version-2 layout features.",
        );
      if (o.sets !== undefined && o.sets !== next.document.sets) {
        next = changeSets(next, o.sets);
        if (before.schemaVersion === 1 && next.document.sets !== 1) {
          next = {
            tool: "venn",
            schemaVersion: 1,
            rendererVersion: "venn-1",
            document: {
              sets: next.document.sets,
              shape: next.document.shape,
              labels: next.document.labels,
              regions: next.document.regions,
              definitions: next.document.definitions,
              showDefinitions: next.document.showDefinitions,
              widthCm: next.document.widthCm,
              fontPt: next.document.fontPt,
            },
          };
        }
      }
      if (o.arrangement !== undefined && o.arrangement !== arrangement(next))
        next = changeArrangement(next, o.arrangement);
      if (o.shape !== undefined) next.document.shape = o.shape;
      if (o.caption !== undefined && next.schemaVersion === 2)
        next.document.caption = o.caption;
      const lost = before.document.regions.some(
        (r, i) =>
          hasRegionData(r) &&
          JSON.stringify(r) !== JSON.stringify(next.document.regions[i]),
      );
      const removedSets = ["A", "B", "C"]
        .slice(next.document.sets, before.document.sets)
        .some((s) => {
          const i = index(s as "A" | "B" | "C"),
            l = before.document.labels[i];
          return (
            before.document.definitions[i] ||
            l.text !== s ||
            l.visibility !== "show"
          );
        });
      const lostCaption =
        before.schemaVersion === 2 &&
        before.document.caption !== "off" &&
        next.schemaVersion === 2 &&
        before.document.caption !== next.document.caption &&
        o.caption === undefined;
      if ((lost || removedSets || lostCaption) && !o.discardIncompatible)
        throw Error(
          "This layout change would discard or deactivate saved contents, answers, shading or definitions. Retain the current layout, or explicitly request discardIncompatible=true.",
        );
    }
    if (o.op === "shade_regions" || o.op === "shade_expression") {
      const allowed = activeMasks(next),
        selected =
          o.op === "shade_regions"
            ? o.masks
            : expressionMasks(o.expression, next.document.sets, allowed);
      if (selected.some((m) => !allowed.includes(m)))
        throw Error("Shade only existing regions.");
      if (o.mode === "replace")
        for (const m of allowed) next.document.regions[m].shade = "none";
      for (const m of selected) next.document.regions[m].shade = o.style;
    }
    if (o.op === "clear_shading")
      next.document.regions.forEach((r) => (r.shade = "none"));
    if (o.op === "set_print") {
      if (o.widthCm !== undefined) next.document.widthCm = o.widthCm;
      if (o.fontPt !== undefined) next.document.fontPt = o.fontPt;
    }
  }
  const e = validate(next);
  assertPrintable(e);
  return e;
}
export async function reviseVenn(raw: unknown) {
  const v = revisionSchema.parse(raw);
  if ((await hash(v.envelope)) !== v.baseHash)
    throw Error(
      "The baseHash does not match this definition. Use the last returned envelope and hash.",
    );
  return apply(v.envelope, v.operations);
}
export function editorLink(e: Envelope, base: string) {
  const bytes = new TextEncoder().encode(canonical(e));
  if (bytes.length > 40_000) return null;
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  const u = new URL(base);
  u.search = "?tool=venn";
  u.hash = `venn=${btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "")}`;
  return u.href.length <= 16_000 ? u.href : null;
}
export function printFacts(raw: Envelope, view: "pupil" | "answer" = "pupil") {
  const e = forView(raw, view),
    svg = renderSvg(e);
  const distinct = (v: number[]) =>
    [...new Set(v.map((n) => Number(n.toFixed(6))))].sort((a, b) => a - b);
  const textSizesPt = distinct(
    [...svg.matchAll(/<text\b[^>]*font-size="([\d.]+)"/g)].map(
      (m) => (Number(m[1]) * 72) / 25.4,
    ),
  );
  const answerLineLengthsMm = distinct(
    [
      ...svg.matchAll(
        /<path\s+d="[^"]*h([\d.]+)"\s+stroke="black"\s+stroke-width="\.22"/g,
      ),
    ].map((m) => Number(m[1])),
  );
  return {
    recommendedScale: 1 as const,
    preserveAspectRatio: true as const,
    referenceFeatures: {
      textSizesPt,
      gridPitchMm: [],
      answerLineLengthsMm,
      tableRowHeightsMm: [],
    },
  };
}
export function assertPrintable(e: Envelope) {
  const issue = exportIssue(e);
  if (issue) throw Error(issue);
}
