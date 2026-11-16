import { z } from "zod";
import * as core from "./index";
import { examples } from "./examples";
import { guidance, renderedTextSizesPt } from "../../graph-core/src/print-guidance";
import { sha256Hex, toBase64Url } from "../../envelope-core/src/index";

/** Connector adapter: the same schema, layout and renderer as the browser editor. */
export const exampleNames = examples.map((x) => x.id) as [string, ...string[]];
export const outputViewSchema = z.enum(["pupil", "answer"]);
const value = z.string().max(12).nullable();
const seriesSpec = z
  .object({
    name: z.string().max(24),
    fill: z.enum(core.fills).optional(),
    values: z.array(value).min(1).max(core.MAX_CATEGORIES),
    hidden: z.array(z.number().int().min(0).max(core.MAX_CATEGORIES - 1)).max(core.MAX_CATEGORIES).optional(),
  })
  .strict();
const axis = z
  .object({
    min: z.string().max(12).optional(),
    max: z.string().max(12).optional(),
    step: z.string().max(12).optional(),
    minor: z.union([z.literal(1), z.literal(2), z.literal(4), z.literal(5), z.literal(10)]).optional(),
  })
  .strict();
/** One shared shape, so the connector's schema writes it once. */
const axisPatch = core.paperAxisSchema.partial().optional();
const presentation = z
  .object({
    xTitle: z.string().max(40).optional(),
    yTitle: z.string().max(40).optional(),
    grid: z.enum(core.gridChoices).optional(),
    key: z.boolean().optional(),
    heightMm: z.number().int().min(40).max(140).optional(),
    barMm: z.number().int().min(5).max(20).optional(),
    lines: core.envelopeSchema.shape.document.shape.lines,
    pie: core.pieSchema.partial().optional(),
    pictogram: core.pictogramSchema.partial().optional(),
    /** Fields merge; axes merge field by field; bestFit null removes the line; points replaces all points. */
    scatter: core.scatterSchema
      .partial()
      .extend({
        xAxis: core.scatterAxisSchema.partial().optional(),
        yAxis: core.scatterAxisSchema.partial().optional(),
        bestFit: core.bestFitSchema.nullable().optional(),
      })
      .optional(),
    /** Fields merge; axis merges field by field; rows replaces every plot. */
    boxplot: core.boxplotSchema.partial().extend({ axis: axisPatch }).optional(),
    /** Fields merge; key merges field by field; rows replaces every row. */
    stemleaf: core.stemleafSchema.partial().extend({ key: core.stemleafSchema.shape.key.partial().optional() }).optional(),
    /** Fields merge; xAxis and each kind's settings and yAxis merge field by field; classes replaces all classes. */
    grouped: core.groupedSchema
      .partial()
      .extend({
        xAxis: axisPatch,
        histogram: core.groupedSchema.shape.histogram.partial().extend({ yAxis: axisPatch }).optional(),
        polygon: core.groupedSchema.shape.polygon.partial().extend({ yAxis: axisPatch }).optional(),
        cumulative: core.groupedSchema.shape.cumulative.partial().extend({ yAxis: axisPatch }).optional(),
      })
      .optional(),
  })
  .strict();
type Presentation = z.infer<typeof presentation>;
/** Pie, pictogram and scatter settings merge field by field with the current ones; everything else replaces. */
function present(d: core.ChartDocument, p: Presentation) {
  const { pie, pictogram, scatter, grouped, boxplot, stemleaf, ...rest } = p;
  Object.assign(d, rest);
  if (pie) d.pie = { ...core.pieOf(d), ...pie };
  if (pictogram) d.pictogram = { ...core.pictogramOf(d), ...pictogram };
  if (scatter) {
    const { xAxis, yAxis, bestFit, ...fields } = scatter,
      now = core.scatterOf(d),
      next: core.ScatterSettings = { ...now, ...fields, xAxis: { ...now.xAxis, ...xAxis }, yAxis: { ...now.yAxis, ...yAxis } };
    if (bestFit === null) delete next.bestFit;
    else if (bestFit) next.bestFit = bestFit;
    d.scatter = next;
  }
  if (stemleaf) {
    const now = core.stemleafOf(d);
    d.stemleaf = { ...now, ...stemleaf, key: { ...now.key, ...stemleaf.key } };
  }
  if (boxplot) {
    const now = core.boxplotOf(d);
    d.boxplot = { ...now, ...boxplot, axis: { ...now.axis, ...boxplot.axis } };
  }
  if (grouped) {
    const { xAxis, histogram, polygon, cumulative, ...fields } = grouped,
      now = core.groupedOf(d);
    const kind = <K extends core.GroupedKind>(k: K, over: { yAxis?: Partial<core.PaperAxis> } | undefined) =>
      ({ ...now[k], ...over, yAxis: { ...now[k].yAxis, ...over?.yAxis } }) as core.GroupedSettings[K];
    d.grouped = {
      ...now,
      ...fields,
      xAxis: { ...now.xAxis, ...xAxis },
      histogram: kind("histogram", histogram),
      polygon: kind("polygon", polygon),
      cumulative: kind("cumulative", cumulative),
    };
  }
}
export const createSchema = z
  .object({
    envelope: core.envelopeSchema.optional(),
    spec: z
      .object({
        example: z.enum(exampleNames).optional(),
        worked: z.boolean().optional(),
        kind: z.enum(core.kinds).optional(),
        categories: z.array(z.string().max(16)).min(1).max(core.MAX_CATEGORIES).optional(),
        series: z.array(seriesSpec).min(1).max(core.MAX_SERIES).optional(),
        axis: axis.optional(),
        presentation: presentation.optional(),
      })
      .strict()
      .optional(),
    outputView: outputViewSchema.optional(),
  })
  .strict();
const index = z.number().int().min(0).max(core.MAX_CATEGORIES - 1);
export const operationSchema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("set_kind"), kind: z.enum(core.kinds) }).strict(),
  z
    .object({
      op: z.literal("set_value"),
      series: z.number().int().min(0).max(core.MAX_SERIES - 1),
      category: index,
      value,
      hidden: z.boolean().optional(),
    })
    .strict(),
  z.object({ op: z.literal("set_category"), category: index, label: z.string().max(16) }).strict(),
  z.object({ op: z.literal("add_category"), label: z.string().max(16).optional() }).strict(),
  z.object({ op: z.literal("remove_category"), category: index }).strict(),
  z
    .object({ op: z.literal("add_series"), name: z.string().max(24), fill: z.enum(core.fills).optional() })
    .strict(),
  z.object({ op: z.literal("remove_series"), series: z.number().int().min(0).max(core.MAX_SERIES - 1) }).strict(),
  z
    .object({
      op: z.literal("set_series"),
      series: z.number().int().min(0).max(core.MAX_SERIES - 1),
      name: z.string().max(24).optional(),
      fill: z.enum(core.fills).optional(),
    })
    .strict(),
  z.object({ op: z.literal("set_axis"), axis }).strict(),
  z.object({ op: z.literal("set_presentation"), presentation }).strict(),
  z.object({ op: z.literal("set_all_visibility"), hidden: z.boolean() }).strict(),
]);
export const revisionSchema = z
  .object({
    envelope: core.envelopeSchema,
    baseHash: z.string().regex(/^[a-f0-9]{64}$/),
    operations: z.array(operationSchema).max(30),
    outputView: outputViewSchema.optional(),
  })
  .strict();

export async function hash(e: core.Envelope): Promise<string> {
  return sha256Hex(core.canonical(e));
}
const cell = (v: string | null, hidden: boolean): core.Cell => ({ value: v ?? "", show: hidden ? "hidden" : "show" });

export function create(input: unknown): core.Envelope {
  const v = createSchema.parse(input);
  if (v.envelope && v.spec) throw Error("Supply spec or envelope, not both.");
  if (v.envelope) return core.validate(v.envelope);
  const s = v.spec ?? {};
  if (s.example && (s.categories || s.series))
    throw Error("Use an example or custom categories and series, not both.");
  if (s.worked !== undefined && !s.example) throw Error("worked applies only to an example.");
  let e = s.example ? examples.find((x) => x.id === s.example)!.make(s.worked ?? false) : core.create();
  const d = e.document;
  if (s.kind) d.kind = s.kind;
  if (s.categories || s.series) {
    const categories = s.categories ?? d.categories;
    if (!s.series) throw Error("Supply series with one value per category.");
    if (s.series.some((x) => x.values.length !== categories.length))
      throw Error("Each series needs exactly one value (string or null) per category.");
    d.categories = categories;
    d.series = s.series.map((x, i) => ({
      name: x.name,
      fill: x.fill ?? core.defaultFill(i),
      values: x.values.map((value, ci) => cell(value, x.hidden?.includes(ci) ?? false)),
    }));
  }
  if (s.axis) d.axis = { ...d.axis, ...s.axis };
  if (s.presentation) present(d, s.presentation);
  e = core.validate(e);
  return e;
}

export async function revise(input: unknown): Promise<core.Envelope> {
  const v = revisionSchema.parse(input);
  if ((await hash(v.envelope)) !== v.baseHash)
    throw Error("stale_hash: Use the exact returned envelope and contentHash.");
  let e = core.validate(structuredClone(v.envelope));
  const need = (ok: boolean, message: string) => {
    if (!ok) throw Error(message);
  };
  for (const op of v.operations) {
    const d = e.document;
    switch (op.op) {
      case "set_kind":
        d.kind = op.kind;
        break;
      case "set_value": {
        need(op.series < d.series.length && op.category < d.categories.length, "Use an existing series and category index (0-based).");
        const c = d.series[op.series].values[op.category];
        d.series[op.series].values[op.category] = cell(op.value, op.hidden ?? c.show === "hidden");
        break;
      }
      case "set_category":
        need(op.category < d.categories.length, "Use an existing category index (0-based).");
        d.categories[op.category] = op.label;
        break;
      case "add_category":
        need(d.categories.length < core.MAX_CATEGORIES, `Use at most ${core.MAX_CATEGORIES} categories.`);
        e = core.addCategory(e);
        e.document.categories[e.document.categories.length - 1] = op.label ?? "";
        break;
      case "remove_category":
        need(op.category < d.categories.length && d.categories.length > 1, "Keep at least one category and use an existing index.");
        e = core.removeCategory(e, op.category);
        break;
      case "add_series":
        need(d.series.length < core.MAX_SERIES, `Use at most ${core.MAX_SERIES} data sets.`);
        e = core.addSeries(e);
        e.document.series[e.document.series.length - 1].name = op.name;
        if (op.fill) e.document.series[e.document.series.length - 1].fill = op.fill;
        break;
      case "remove_series":
        need(op.series < d.series.length && d.series.length > 1, "Keep at least one data set and use an existing index.");
        e = core.removeSeries(e, op.series);
        break;
      case "set_series":
        need(op.series < d.series.length, "Use an existing series index (0-based).");
        if (op.name !== undefined) d.series[op.series].name = op.name;
        if (op.fill) d.series[op.series].fill = op.fill;
        break;
      case "set_axis":
        d.axis = { ...d.axis, ...op.axis };
        break;
      case "set_presentation":
        present(d, op.presentation);
        break;
      case "set_all_visibility":
        e = core.setAllShown(e, op.hidden ? "hidden" : "show");
        break;
    }
    e = core.validate(e);
  }
  return e;
}

export function editorLink(e: core.Envelope, base: string) {
  const u = new URL(base);
  u.pathname = u.pathname.replace(/\/?$/, "/") + "tools/charts";
  u.search = "";
  u.hash =
    "chart=" +
    toBase64Url(core.canonical(e));
  return u.href.length <= 16000 ? u.href : null;
}

export function printFacts(e: core.Envelope, view: "pupil" | "answer" = "pupil") {
  const shown = core.forView(e, view);
  if (shown.document.kind === "scatter") {
    const g = core.scatterLayout(shown),
      sc = g.settings,
      steps = [g.plot.width / g.xs.count, g.plot.height / g.ys.count];
    return guidance({
      textSizesPt: renderedTextSizesPt(core.renderSvg(shown), 72 / 25.4),
      gridPitchMm: sc.grid === "none" ? [] : [...steps, ...(sc.grid === "fine" ? steps.map((x) => x / sc.minor) : [])],
    });
  }
  if (core.groupedKind(shown.document.kind) || shown.document.kind === "boxplot")
    return guidance({ textSizesPt: renderedTextSizesPt(core.renderSvg(shown), 72 / 25.4), gridPitchMm: [2, 10, 20] });
  if (!core.axisKind(shown.document.kind))
    return guidance({ textSizesPt: renderedTextSizesPt(core.renderSvg(shown), 72 / 25.4), gridPitchMm: [] });
  const g = core.axesLayout(shown);
  return guidance({
    textSizesPt: renderedTextSizesPt(core.renderSvg(shown), 72 / 25.4),
    gridPitchMm: shown.document.grid === "none" ? [] : [g.major, ...(shown.document.grid === "fine" ? [g.minor] : [])],
  });
}
