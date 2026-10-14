import { z } from "zod";
import { GraphError } from "../../packages/graph-core/src/interchange";
import { diagramSourceSchema, diagramSource, diagramPrintInfo } from "./diagram-source";
export const printGuidanceSchema = z.object({
  recommendedScale: z.literal(1), preserveAspectRatio: z.literal(true),
  referenceFeatures: z.object({
    textSizesPt: z.array(z.number()), gridPitchMm: z.array(z.number()),
    answerLineLengthsMm: z.array(z.number()), tableRowHeightsMm: z.array(z.number()),
  }).strict(),
}).strict();
export const PRINT_INSTRUCTIONS = "Use SVG for vectors or the downloaded 600 ppi PNG for raster insertion, not the inline preview. Place at physicalSizeCm by default and preserve aspect ratio. Use check_diagram_placement when considering a resize. Keep JSON for editing. printVerified checks the PNG only, not a downstream PDF, Word document or physical print.";
export const placementInputSchema = diagramSourceSchema.extend({
  widthMm: z.number().finite().positive().optional(),
  heightMm: z.number().finite().positive().optional(),
}).strict();
const size = z.object({ width: z.number().finite(), height: z.number().finite() });
export const placementOutputSchema = z.object({
  nativeSizeMm: size, requestedSizeMm: size, proportionalSizeMm: size,
  uniformScale: z.number().finite(), wouldDistort: z.boolean(),
  scaledReferenceFeatures: printGuidanceSchema.shape.referenceFeatures,
  effectivePngDpi: z.number().finite(),
  warnings: z.array(z.object({ code: z.string(), message: z.string() })),
}).strict();
export function checkPlacement(raw: unknown) {
  const input = placementInputSchema.safeParse(raw);
  if (!input.success) throw new GraphError("invalid_placement", "Use a supported source and finite positive widthMm and/or heightMm.");
  const { kind, envelope, widthMm, heightMm } = input.data;
  if (widthMm === undefined && heightMm === undefined)
    throw new GraphError("invalid_placement", "Supply widthMm and/or heightMm.");
  const info = diagramPrintInfo(diagramSource({ kind, envelope }));
  const nativeSizeMm = { width: info.physicalSizeCm.width * 10, height: info.physicalSizeCm.height * 10 };
  const requestedSizeMm = {
    width: widthMm ?? heightMm! * nativeSizeMm.width / nativeSizeMm.height,
    height: heightMm ?? widthMm! * nativeSizeMm.height / nativeSizeMm.width,
  };
  const uniformScale = Math.min(requestedSizeMm.width / nativeSizeMm.width, requestedSizeMm.height / nativeSizeMm.height);
  const proportionalSizeMm = { width: nativeSizeMm.width * uniformScale, height: nativeSizeMm.height * uniformScale };
  const tolerance = (v: number) => Math.max(0.1, v * 0.001);
  const wouldDistort = Math.abs(proportionalSizeMm.width - requestedSizeMm.width) > tolerance(requestedSizeMm.width)
    || Math.abs(proportionalSizeMm.height - requestedSizeMm.height) > tolerance(requestedSizeMm.height);
  const scale = (values: number[]) => values.map((v) => v * uniformScale);
  const facts = info.printGuidance.referenceFeatures;
  const scaledReferenceFeatures = {
    textSizesPt: scale(facts.textSizesPt), gridPitchMm: scale(facts.gridPitchMm),
    answerLineLengthsMm: scale(facts.answerLineLengthsMm), tableRowHeightsMm: scale(facts.tableRowHeightsMm),
  };
  const warnings: Array<{ code: string; message: string }> = [];
  if (wouldDistort) warnings.push({ code: "aspect_ratio_mismatch", message: "The requested box would stretch the diagram. proportionalSizeMm fits inside it without distortion; scaled facts describe that proportional fit." });
  if (uniformScale < 0.999) {
    const f = info.printGuidance.referenceFeatures;
    const changes = (values: number[], unit: string) => values.map((v) => `${Number(v.toFixed(3))} ${unit} becomes ${Number((v * uniformScale).toFixed(3))} ${unit}`).join(", ");
    warnings.push({ code: "reduced_print_size", message: `Reduction to ${Number((uniformScale * 100).toFixed(2))}% reduces text, grids and writing space. ${[changes(f.textSizesPt, "pt"), changes(f.gridPitchMm, "mm grid pitch"), changes(f.answerLineLengthsMm, "mm answer line"), changes(f.tableRowHeightsMm, "mm row height")].filter(Boolean).join("; ")}. Check the destination print; no universal minimum size is assumed.` });
  }
  if (uniformScale > 1.001) warnings.push({ code: "png_enlargement", message: `Only for the 600 ppi PNG: proportional enlargement yields ${Number((600 / uniformScale).toFixed(2))} ppi. SVG remains vector.` });
  const result = { nativeSizeMm, requestedSizeMm, proportionalSizeMm, uniformScale, wouldDistort, scaledReferenceFeatures, effectivePngDpi: 600 / uniformScale, warnings };
  if (!placementOutputSchema.safeParse(result).success) throw new GraphError("invalid_placement", "These dimensions exceed supported numeric precision. Use ordinary physical dimensions in millimetres.");
  return result;
}
