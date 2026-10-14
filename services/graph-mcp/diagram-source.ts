import { z } from "zod";
import { GraphError, validateEnvelope, documentFromEnvelope, type GraphEnvelope } from "../../packages/graph-core/src/interchange";
import { getExportMetrics, graphPrintFacts } from "../../packages/graph-core/src/svg";
import type { RatioEnvelope } from "../../packages/ratio-table-core/src/schema";
import { validateRatioEnvelope } from "../../packages/ratio-table-core/src/interchange";
import { ratioMetrics, ratioPrintFacts } from "../../packages/ratio-table-core/src/svg";
import { validate as validateValue } from "../../packages/value-graph-core/src/model";
import { metrics, valuePrintFacts } from "../../packages/value-graph-core/src/svg";
import type { ValueEnvelope } from "../../packages/value-graph-core/src/schema";

export const diagramKind = z.enum(["graph", "ratio-table", "value-graph"]);
export type DiagramKind = z.infer<typeof diagramKind>;
// The outer discovery schema is homogeneous; each core validates the exact envelope.
export const diagramSourceSchema = z.object({
  kind: diagramKind,
  envelope: z.object({
    schemaVersion: z.number().int(), rendererVersion: z.string(), styleProfile: z.string(),
    document: z.record(z.string(), z.unknown()), kind: z.string().optional(),
  }).strict(),
}).strict();
export type DiagramSource =
  | { kind: "graph"; envelope: GraphEnvelope }
  | { kind: "ratio-table"; envelope: RatioEnvelope }
  | { kind: "value-graph"; envelope: ValueEnvelope };
export function diagramSource(raw: unknown): DiagramSource {
  try {
    const s = diagramSourceSchema.parse(raw);
    switch (s.kind) {
      case "graph": return { kind: s.kind, envelope: validateEnvelope(s.envelope, true) };
      case "ratio-table": {
        const envelope = validateRatioEnvelope(s.envelope);
        // Layout validation is also required before publishing physical facts.
        ratioMetrics(envelope.document);
        return { kind: s.kind, envelope };
      }
      case "value-graph": return { kind: s.kind, envelope: validateValue(s.envelope) };
    }
  } catch (error) {
    throw new GraphError("invalid_diagram", `Use a supported ${String((raw as {kind?: unknown})?.kind ?? "diagram")} envelope: ${error instanceof Error ? error.message : "invalid source"}`);
  }
}
export function diagramPrintInfo(source: DiagramSource) {
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
