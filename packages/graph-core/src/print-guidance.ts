/** Physical facts about visible artwork, independent of the saved definition. */
export interface PrintReferenceFeatures {
  textSizesPt: number[];
  gridPitchMm: number[];
  answerLineLengthsMm: number[];
  tableRowHeightsMm: number[];
}
export interface PrintGuidance {
  recommendedScale: 1;
  preserveAspectRatio: true;
  referenceFeatures: PrintReferenceFeatures;
}
export function guidance(features: Partial<PrintReferenceFeatures>): PrintGuidance {
  const unique = (values: number[] = []) =>
    [...new Set(values.map((v) => Number(v.toFixed(8))))].sort((a, b) => a - b);
  return {
    recommendedScale: 1,
    preserveAspectRatio: true,
    referenceFeatures: {
      textSizesPt: unique(features.textSizesPt),
      gridPitchMm: unique(features.gridPitchMm),
      answerLineLengthsMm: unique(features.answerLineLengthsMm),
      tableRowHeightsMm: unique(features.tableRowHeightsMm),
    },
  };
}
/** These renderers emit an explicit font-size on each text element. */
export function renderedTextSizesPt(svg: string, pointsPerSvgUnit: number): number[] {
  return [...svg.matchAll(/<text\b[^>]*\bfont-size="([\d.]+)"[^>]*>([\s\S]*?)<\/text>/g)]
    .filter((m) => m[2].replace(/<[^>]*>/g, "").trim().length > 0)
    .map((m) => Number(m[1]) * pointsPerSvgUnit);
}
