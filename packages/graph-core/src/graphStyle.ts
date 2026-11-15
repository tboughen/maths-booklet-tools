/** Physical styling shared by the editor preview and exported artwork. */
export const POINTS_PER_CENTIMETRE = 72 / 2.54;
/** Plotted lines, points and shapes (this was once also the grid's weight, hence the name). */
export const GRID_STROKE_POINTS = 1.5;
/**
 * Exam parity: line weights measured in Edexcel GCSE papers (Jun 2019 2H Q2, Nov 2017 3F Q13,
 * Nov 2021 1F Q18, mock sets 1 and 4). Axes 1.5 pt (0.53 mm); a 1 cm grid on its own 1 pt
 * (0.35 mm); graph paper with a fine grid 0.51 pt fine lines (0.18 mm), 1.02 pt 1 cm lines
 * (0.36 mm) and 1.417 pt every 2 cm (0.5 mm). The value graph draws the same weights.
 */
export const AXIS_STROKE_POINTS = 1.5;
export const CENTIMETRE_GRID_STROKE_POINTS = 1;
export const FINE_GRID_STROKE_POINTS = { fine: 0.51, centimetre: 1.02, twoCentimetre: 1.417 } as const;
export const AXIS_LABEL_FONT_POINTS = 12;
export const EQUATION_FONT_POINTS = 10;

export const MATHS_FONT_FAMILY =
  '"Cambria Math", Cambria, "Times New Roman", serif';
export const SVG_MATHS_FONT_FAMILY =
  "'Cambria Math', Cambria, 'Times New Roman', serif";
export const AXIS_X_NAME = "𝑥";
export const AXIS_Y_NAME = "𝑦";
export const Y_AXIS_LABEL_GAP_CENTIMETRES = 0.12;
/** Five editor SVG units, expressed physically so exported artwork matches the preview. */
export const AXIS_ARROW_EXTRA_SHAFT_CENTIMETRES = 5 / 60;
export const STRAIGHT_DASH_LENGTH_CENTIMETRES = 0.18;
export const STRAIGHT_DASH_GAP_CENTIMETRES = 0.12;

export function pointsToDiagramUnits(
  points: number,
  unitsPerCentimetre: number,
): number {
  return (points / POINTS_PER_CENTIMETRE) * unitsPerCentimetre;
}

/**
 * A compact estimate is more reliable than browser-only text measurement because
 * the same geometry must be present in the standalone SVG copied into Word.
 */
export function axisLabelBoxWidth(label: string, fontSize: number): number {
  const glyphWidth = [...label].reduce((width, character) => {
    if (character === ".") return width + 0.28;
    if (character === "/") return width + 0.38;
    if (character === "−" || character === "-") return width + 0.58;
    return width + 0.56;
  }, 0);
  return Math.max(fontSize * 0.72, glyphWidth * fontSize) + fontSize * 0.32;
}

export function axisLabelBoxHeight(fontSize: number): number {
  return fontSize * 1.04;
}

import type { DiagramDocumentV1 } from "./types";
export const PORTABLE_FONT_FAMILY = "'STIX Two Text', 'STIX Two Math', serif";
export function svgFontFamily(document: DiagramDocumentV1): string {
  return document.styleProfile === "portable-v1"
    ? PORTABLE_FONT_FAMILY
    : SVG_MATHS_FONT_FAMILY;
}

/** Allow the portable italic y's overhang to clear the upward arrowhead. */
export function axisNameYGapCentimetres(document: DiagramDocumentV1): number {
  return document.styleProfile === "portable-v1"
    ? 0.2
    : Y_AXIS_LABEL_GAP_CENTIMETRES;
}
