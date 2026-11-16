import { aboutShape } from "../../packages/envelope-core/src/about";
import { artworkSizeMm, workedOf } from "../../packages/envelope-core/src/worked";
import { z } from "zod";
import { GraphError, documentFromEnvelope, type GraphEnvelope } from "../../packages/graph-core/src/interchange";
import { getExportMetrics, graphPrintFacts } from "../../packages/graph-core/src/svg";
import type { RatioEnvelope } from "../../packages/ratio-table-core/src/schema";
import { ratioMetrics, ratioPrintFacts } from "../../packages/ratio-table-core/src/svg";
import { metrics, valuePrintFacts } from "../../packages/value-graph-core/src/svg";
import type { ValueEnvelope } from "../../packages/value-graph-core/src/schema";
import * as cuboid from "../../packages/cuboid-core/src/index";
import { printFacts as cuboidPrintFacts } from "../../packages/cuboid-core/src/interchange";
import * as numberLine from "../../packages/number-line-core/src/index";
import * as venn from "../../packages/venn-core/src/index";
import * as bar from "../../packages/bar-model-core/src/versioned";
import * as algebra from "../../packages/algebra-grid-core/src/index";
import { printFacts as algebraPrintFacts } from "../../packages/algebra-grid-core/src/interchange";
import { printFacts as vennPrintFacts } from "../../packages/venn-core/src/interchange";
import * as chart from "../../packages/chart-core/src/index";
import { printFacts as chartPrintFacts } from "../../packages/chart-core/src/interchange";
import * as tree from "../../packages/probability-tree-core/src/index";
import { printFacts as treePrintFacts } from "../../packages/probability-tree-core/src/interchange";
import * as ftree from "../../packages/frequency-tree-core/src/index";
import { printFacts as ftreePrintFacts } from "../../packages/frequency-tree-core/src/interchange";
import * as construction from "../../packages/construction-core/src/index";
import { printFacts as constructionPrintFacts } from "../../packages/construction-core/src/interchange";
import * as elevations from "../../packages/elevation-core/src/index";
import { printFacts as elevationsPrintFacts } from "../../packages/elevation-core/src/interchange";
import * as twt from "../../packages/two-way-table-core/src/index";
import { printFacts as twtPrintFacts } from "../../packages/two-way-table-core/src/interchange";
import * as angles from "../../packages/angle-core/src/index";
import { printFacts as anglesPrintFacts } from "../../packages/angle-core/src/interchange";
import * as area from "../../packages/area-core/src/index";
import { printFacts as areaPrintFacts } from "../../packages/area-core/src/interchange";
import * as figures from "../../packages/figure-core/src/index";
import { printFacts as figuresPrintFacts } from "../../packages/figure-core/src/interchange";
import * as ft from "../../packages/factor-tree-core/src/index";
import { printFacts as ftPrintFacts } from "../../packages/factor-tree-core/src/interchange";
import * as wm from "../../packages/written-method-core/src/index";
import { printFacts as wmPrintFacts } from "../../packages/written-method-core/src/interchange";
import * as fm from "../../packages/function-machine-core/src/index";
import { printFacts as fmPrintFacts } from "../../packages/function-machine-core/src/interchange";
import * as po from "../../packages/probability-objects-core/src/index";
import { printFacts as poPrintFacts } from "../../packages/probability-objects-core/src/interchange";
import * as nets from "../../packages/net-core/src/index";
import { printFacts as netsPrintFacts } from "../../packages/net-core/src/interchange";
import * as at from "../../packages/algebra-tile-core/src/index";
import { printFacts as atPrintFacts } from "../../packages/algebra-tile-core/src/interchange";
import * as ss from "../../packages/sample-space-core/src/index";
import { printFacts as ssPrintFacts } from "../../packages/sample-space-core/src/interchange";
import * as triangle from "../../packages/triangle-core/src/index";
import * as ti from "../../packages/triangle-core/src/interchange";
import type { Crop, RasterQueue } from "./raster";
import { ANSWER_VIEW_KINDS, FAMILIES, describeIssues, diagramKindSchema } from "../../packages/diagram-core/src/registry";

export const diagramKind = diagramKindSchema;
export type DiagramKind = z.infer<typeof diagramKind>;
// The outer discovery schema is homogeneous; each core validates the exact envelope.
export const diagramSourceSchema = z.object({
  kind: diagramKind,
  envelope: z.object({
    schemaVersion: z.number().int(), rendererVersion: z.string(), styleProfile: z.string().optional(),
    document: z.record(z.string(), z.unknown()), kind: z.string().optional(), tool: z.string().optional(),
    title: aboutShape.title, note: aboutShape.note,
    // Worked notes (U116) are checked by the family; the outer schema only lets them through.
    worked: z.array(z.unknown()).optional(),
  }).strict(),
  outputView: z.enum(["pupil", "answer"]).optional(),
}).strict();
export type DiagramSource =
  | { kind: "graph"; envelope: GraphEnvelope; outputView?: "pupil" | "answer" }
  | { kind: "ratio-table"; envelope: RatioEnvelope; outputView?: "pupil" | "answer" }
  | { kind: "value-graph"; envelope: ValueEnvelope }
  | { kind: "cuboids"; envelope: cuboid.Envelope }
  | { kind: "number-line"; envelope: numberLine.Envelope; outputView?: "pupil" | "answer" }
  | { kind: "venn"; envelope: venn.Envelope; outputView?: "pupil" | "answer" }
  | { kind: "bar-model"; envelope: bar.Envelope; outputView?: "pupil" | "answer" }
  | { kind: "algebra-grid"; envelope: algebra.Envelope }
  | { kind: "charts"; envelope: chart.Envelope; outputView?: "pupil" | "answer" }
  | { kind: "probability-tree"; envelope: tree.Envelope; outputView?: "pupil" | "answer" }
  | { kind: "frequency-tree"; envelope: ftree.Envelope; outputView?: "pupil" | "answer" }
  | { kind: "construction"; envelope: construction.Envelope; outputView?: "pupil" | "answer" }
  | { kind: "elevations"; envelope: elevations.Envelope; outputView?: "pupil" | "answer" }
  | { kind: "two-way-table"; envelope: twt.Envelope; outputView?: "pupil" | "answer" }
  | { kind: "angles"; envelope: angles.Envelope; outputView?: "pupil" | "answer" }
  | { kind: "area"; envelope: area.Envelope; outputView?: "pupil" | "answer" }
  | { kind: "figures"; envelope: figures.Envelope; outputView?: "pupil" | "answer" }
  | { kind: "factor-tree"; envelope: ft.Envelope; outputView?: "pupil" | "answer" }
  | { kind: "written-method"; envelope: wm.Envelope; outputView?: "pupil" | "answer" }
  | { kind: "function-machine"; envelope: fm.Envelope; outputView?: "pupil" | "answer" }
  | { kind: "probability-objects"; envelope: po.Envelope; outputView?: "pupil" | "answer" }
  | { kind: "nets"; envelope: nets.Envelope; outputView?: "pupil" | "answer" }
  | { kind: "algebra-tiles"; envelope: at.Envelope; outputView?: "pupil" | "answer" }
  | { kind: "sample-space"; envelope: ss.Envelope; outputView?: "pupil" | "answer" }
  | { kind: "triangle"; envelope: triangle.Envelope };
export function diagramSource(raw: unknown): DiagramSource {
  try {
    const s = diagramSourceSchema.parse(raw);
    const family = FAMILIES[s.kind];
    if (s.outputView !== undefined && !family.answerView) throw Error(`outputView applies only to ${ANSWER_VIEW_KINDS}.`);
    const envelope = family.validate(s.envelope, s.outputView ?? "pupil");
    return { kind: s.kind, envelope, ...(s.outputView === undefined ? {} : { outputView: s.outputView }) } as DiagramSource;
  } catch (error) {
    throw new GraphError("invalid_diagram", `Use a supported ${String((raw as {kind?: unknown})?.kind ?? "diagram")} envelope: ${describeIssues(error) ?? (error instanceof Error ? error.message : "invalid source")}`);
  }
}
/**
 * Print information for one copy. Worked notes in the margin (U116) grow the answers copy's page
 * round the artwork, so its printed size is that page's, read from the answers SVG itself.
 */
export function diagramPrintInfo(source: DiagramSource, crop?: Crop) {
  const info = familyPrintInfo(source, crop);
  const view = ("outputView" in source && source.outputView) || "pupil";
  if (view !== "answer" || !workedOf(source.envelope).length || !FAMILIES[source.kind].answerView) return info;
  const page = artworkSizeMm(FAMILIES[source.kind].svg(source.envelope, "answer"));
  const cm = (mm: number) => Math.round(mm * 100) / 1000;
  const grown = Math.abs(page.width / 10 - info.physicalSizeCm.width) > 0.001 || Math.abs(page.height / 10 - info.physicalSizeCm.height) > 0.001;
  return grown && page.width > 0 && page.height > 0 ? { ...info, physicalSizeCm: { width: cm(page.width), height: cm(page.height) } } : info;
}
function familyPrintInfo(source: DiagramSource, crop?: Crop) {
  if(source.kind==="bar-model") {const g=bar.layout(bar.forView(source.envelope, source.outputView ?? "pupil"));return {physicalSizeCm:{width:g.width/10,height:g.height/10},printGuidance:bar.printFacts(source.envelope)};}
  if(source.kind==="charts") { const view=source.outputView ?? "pupil", g=chart.layout(chart.forView(source.envelope, view));return {physicalSizeCm:{width:g.width/10,height:g.height/10},printGuidance:chartPrintFacts(source.envelope, view)}; }
  if(source.kind==="triangle") {const g=triangle.layout(source.envelope);return {physicalSizeCm:{width:g.width/10,height:g.height/10},printGuidance:ti.printFacts(source.envelope)};}
  if(source.kind==="algebra-grid") { const g=algebra.layout(source.envelope);return {physicalSizeCm:{width:g.width/10,height:g.height/10},printGuidance:algebraPrintFacts(source.envelope)}; }
  if (source.kind === "probability-tree") {
    const view = source.outputView ?? "pupil", g = tree.layout(tree.forView(source.envelope, view));
    return { physicalSizeCm: { width: g.width / 10, height: g.height / 10 }, printGuidance: treePrintFacts(source.envelope, view) };
  }
  if (source.kind === "frequency-tree") {
    const view = source.outputView ?? "pupil", g = ftree.layout(ftree.forView(source.envelope, view));
    return { physicalSizeCm: { width: g.width / 10, height: g.height / 10 }, printGuidance: ftreePrintFacts(source.envelope, view) };
  }
  if (source.kind === "construction") {
    const view = source.outputView ?? "pupil", g = construction.layout(source.envelope, view);
    return { physicalSizeCm: { width: +(g.width / 10).toFixed(2), height: +(g.height / 10).toFixed(2) }, printGuidance: constructionPrintFacts(source.envelope, view) };
  }
  if (source.kind === "elevations") {
    const view = source.outputView ?? "pupil", g = elevations.layout(source.envelope, view);
    return { physicalSizeCm: { width: +(g.width / 10).toFixed(2), height: +(g.height / 10).toFixed(2) }, printGuidance: elevationsPrintFacts(source.envelope, view) };
  }
  if (source.kind === "figures") {
    const view = source.outputView ?? "pupil", g = figures.layout(source.envelope);
    return { physicalSizeCm: { width: +(g.width / 10).toFixed(2), height: +(g.height / 10).toFixed(2) }, printGuidance: figuresPrintFacts(source.envelope, view) };
  }
  if (source.kind === "area") {
    const view = source.outputView ?? "pupil", g = area.layout(source.envelope);
    return { physicalSizeCm: { width: +(g.width / 10).toFixed(2), height: +(g.height / 10).toFixed(2) }, printGuidance: areaPrintFacts(source.envelope, view) };
  }
  if (source.kind === "angles") {
    const view = source.outputView ?? "pupil", g = angles.layout(source.envelope);
    return { physicalSizeCm: { width: +(g.width / 10).toFixed(2), height: +(g.height / 10).toFixed(2) }, printGuidance: anglesPrintFacts(source.envelope, view) };
  }
  if (source.kind === "sample-space") {
    const view = source.outputView ?? "pupil", g = ss.layout(ss.forView(source.envelope, view));
    return { physicalSizeCm: { width: g.width / 10, height: g.height / 10 }, printGuidance: ssPrintFacts(source.envelope, view) };
  }
  if (source.kind === "factor-tree") {
    const view = source.outputView ?? "pupil", g = ft.layout(ft.forView(source.envelope, view));
    return { physicalSizeCm: { width: g.width / 10, height: g.height / 10 }, printGuidance: ftPrintFacts(source.envelope, view) };
  }
  if (source.kind === "written-method") {
    const view = source.outputView ?? "pupil", g = wm.layout(wm.forView(source.envelope, view));
    return { physicalSizeCm: { width: g.width / 10, height: g.height / 10 }, printGuidance: wmPrintFacts(source.envelope, view) };
  }
  if (source.kind === "probability-objects") {
    const view = source.outputView ?? "pupil", g = po.layout(po.forView(source.envelope, view));
    return { physicalSizeCm: { width: g.width / 10, height: g.height / 10 }, printGuidance: poPrintFacts(source.envelope, view) };
  }
  if (source.kind === "function-machine") {
    const view = source.outputView ?? "pupil", g = fm.layout(fm.forView(source.envelope, view));
    return { physicalSizeCm: { width: g.width / 10, height: g.height / 10 }, printGuidance: fmPrintFacts(source.envelope, view) };
  }
  if (source.kind === "nets") {
    const view = source.outputView ?? "pupil", g = nets.layout(nets.forView(source.envelope, view));
    return { physicalSizeCm: { width: g.width / 10, height: g.height / 10 }, printGuidance: netsPrintFacts(source.envelope, view) };
  }
  if (source.kind === "algebra-tiles") {
    const view = source.outputView ?? "pupil", g = at.layout(at.forView(source.envelope, view));
    return { physicalSizeCm: { width: g.width / 10, height: g.height / 10 }, printGuidance: atPrintFacts(source.envelope, view) };
  }
  if (source.kind === "two-way-table") {
    const view = source.outputView ?? "pupil", g = twt.layout(twt.forView(source.envelope, view));
    return { physicalSizeCm: { width: g.width / 10, height: g.height / 10 }, printGuidance: twtPrintFacts(source.envelope, view) };
  }
  if (source.kind === "cuboids") {
    if (!crop) throw new GraphError("invalid_diagram", "Cuboid print information requires measured cropped artwork.");
    return { physicalSizeCm: { width: crop.widthCm, height: crop.heightCm }, printGuidance: cuboidPrintFacts(source.envelope) };
  }
  if (source.kind === "number-line") {
    const d = numberLine.forView(source.envelope, source.outputView ?? "pupil").document, m = numberLine.metrics(d);
    return { physicalSizeCm: { width: m.widthCm, height: m.heightCm }, printGuidance: numberLine.printFacts(d) };
  }
  if (source.kind === "venn") {
    const view = source.outputView ?? "pupil", e = venn.forView(source.envelope, view), g = venn.geometry(e);
    return { physicalSizeCm: { width: g.width / 10, height: g.height / 10 }, printGuidance: vennPrintFacts(source.envelope, view) };
  }
  if (source.kind === "graph") {
    const d = documentFromEnvelope(source.envelope), m = getExportMetrics(d);
    return { physicalSizeCm: { width: m.widthCm, height: m.heightCm }, printGuidance: graphPrintFacts(d, source.outputView ?? "pupil") };
  }
  if (source.kind === "ratio-table") {
    const m = ratioMetrics(source.envelope.document);
    return { physicalSizeCm: { width: m.widthCm, height: m.heightCm }, printGuidance: ratioPrintFacts(source.envelope.document) };
  }
  const m = metrics(source.envelope);
  return { physicalSizeCm: { width: m.widthCm, height: m.heightCm }, printGuidance: valuePrintFacts(source.envelope) };
}
export async function prepareDiagram(source: DiagramSource, raster: RasterQueue, signal?: AbortSignal) {
  const crop = source.kind === "cuboids" ? await raster.crop(cuboid.renderSvg(source.envelope), signal) : undefined;
  return { ...diagramPrintInfo(source, crop), crop };
}
