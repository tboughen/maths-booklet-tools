import { z } from "zod";
import { GraphError, validateEnvelope, documentFromEnvelope, type GraphEnvelope } from "../../packages/graph-core/src/interchange";
import { getExportMetrics, graphPrintFacts } from "../../packages/graph-core/src/svg";
import type { RatioEnvelope } from "../../packages/ratio-table-core/src/schema";
import { validateRatioEnvelope } from "../../packages/ratio-table-core/src/interchange";
import { ratioMetrics, ratioPrintFacts } from "../../packages/ratio-table-core/src/svg";
import { validate as validateValue } from "../../packages/value-graph-core/src/model";
import { metrics, valuePrintFacts } from "../../packages/value-graph-core/src/svg";
import type { ValueEnvelope } from "../../packages/value-graph-core/src/schema";
import * as cuboid from "../../packages/cuboid-core/src/index";
import { printFacts as cuboidPrintFacts } from "../../packages/cuboid-core/src/interchange";
import * as numberLine from "../../packages/number-line-core/src/index";
import * as venn from "../../packages/venn-core/src/index";
import * as algebra from "../../packages/algebra-grid-core/src/index";
import { printFacts as algebraPrintFacts } from "../../packages/algebra-grid-core/src/interchange";
import { assertPrintable, printFacts as vennPrintFacts } from "../../packages/venn-core/src/interchange";
import type { Crop, RasterQueue } from "./raster";

export const diagramKind = z.enum(["graph", "ratio-table", "value-graph", "cuboids", "number-line", "venn", "algebra-grid"]);
export type DiagramKind = z.infer<typeof diagramKind>;
// The outer discovery schema is homogeneous; each core validates the exact envelope.
export const diagramSourceSchema = z.object({
  kind: diagramKind,
  envelope: z.object({
    schemaVersion: z.number().int(), rendererVersion: z.string(), styleProfile: z.string().optional(),
    document: z.record(z.string(), z.unknown()), kind: z.string().optional(), tool: z.string().optional(),
  }).strict(),
  outputView: z.enum(["pupil", "answer"]).optional(),
}).strict();
export type DiagramSource =
  | { kind: "graph"; envelope: GraphEnvelope }
  | { kind: "ratio-table"; envelope: RatioEnvelope }
  | { kind: "value-graph"; envelope: ValueEnvelope }
  | { kind: "cuboids"; envelope: cuboid.Envelope }
  | { kind: "number-line"; envelope: numberLine.Envelope }
  | { kind: "venn"; envelope: venn.Envelope; outputView?: "pupil" | "answer" }
  | { kind: "algebra-grid"; envelope: algebra.Envelope };
export function diagramSource(raw: unknown): DiagramSource {
  try {
    const s = diagramSourceSchema.parse(raw);
    if (s.outputView !== undefined && s.kind !== "venn") throw Error("outputView applies only to Venn diagrams.");
    switch (s.kind) {
      case "algebra-grid": { const envelope=algebra.validate(s.envelope);const issue=algebra.exportIssue(envelope);if(issue)throw Error(issue);return {kind:s.kind,envelope}; }
      case "graph": return { kind: s.kind, envelope: validateEnvelope(s.envelope, true) };
      case "ratio-table": {
        const envelope = validateRatioEnvelope(s.envelope);
        // Layout validation is also required before publishing physical facts.
        ratioMetrics(envelope.document);
        return { kind: s.kind, envelope };
      }
      case "value-graph": return { kind: s.kind, envelope: validateValue(s.envelope) };
      case "cuboids": { const envelope = cuboid.validate(s.envelope); cuboid.renderSvg(envelope); return { kind: s.kind, envelope }; }
      case "number-line": return { kind: s.kind, envelope: numberLine.validate(s.envelope) };
      case "venn": { const envelope = venn.validate(s.envelope); assertPrintable(venn.forView(envelope, s.outputView ?? "pupil")); return { kind: s.kind, envelope, ...(s.outputView === undefined ? {} : { outputView: s.outputView }) }; }
    }
  } catch (error) {
    throw new GraphError("invalid_diagram", `Use a supported ${String((raw as {kind?: unknown})?.kind ?? "diagram")} envelope: ${error instanceof Error ? error.message : "invalid source"}`);
  }
}
export function diagramPrintInfo(source: DiagramSource, crop?: Crop) {
  if(source.kind==="algebra-grid") { const g=algebra.layout(source.envelope);return {physicalSizeCm:{width:g.width/10,height:g.height/10},printGuidance:algebraPrintFacts(source.envelope)}; }
  if (source.kind === "cuboids") {
    if (!crop) throw new GraphError("invalid_diagram", "Cuboid print information requires measured cropped artwork.");
    return { physicalSizeCm: { width: crop.widthCm, height: crop.heightCm }, printGuidance: cuboidPrintFacts(source.envelope) };
  }
  if (source.kind === "number-line") {
    const m = numberLine.metrics(source.envelope.document);
    return { physicalSizeCm: { width: m.widthCm, height: m.heightCm }, printGuidance: numberLine.printFacts(source.envelope.document) };
  }
  if (source.kind === "venn") {
    const view = source.outputView ?? "pupil", e = venn.forView(source.envelope, view), g = venn.geometry(e);
    return { physicalSizeCm: { width: g.width / 10, height: g.height / 10 }, printGuidance: vennPrintFacts(source.envelope, view) };
  }
  if (source.kind === "graph") {
    const d = documentFromEnvelope(source.envelope), m = getExportMetrics(d);
    return { physicalSizeCm: { width: m.widthCm, height: m.heightCm }, printGuidance: graphPrintFacts(d) };
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
