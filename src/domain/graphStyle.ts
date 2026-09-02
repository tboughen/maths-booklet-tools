/** Physical styling shared by the editor preview and exported artwork. */
export const POINTS_PER_CENTIMETRE = 72 / 2.54;
export const GRID_STROKE_POINTS = 1.5;
export const AXIS_STROKE_POINTS = 2;
export const AXIS_LABEL_FONT_POINTS = 12;
export const EQUATION_FONT_POINTS = 10;

export const MATHS_FONT_FAMILY = '"Cambria Math", Cambria, "Times New Roman", serif';
export const SVG_MATHS_FONT_FAMILY = "'Cambria Math', Cambria, 'Times New Roman', serif";
export const AXIS_X_NAME = "𝑥";
export const AXIS_Y_NAME = "𝑦";
export const Y_AXIS_LABEL_GAP_CENTIMETRES = 0.12;

export function pointsToDiagramUnits(points: number, unitsPerCentimetre: number): number {
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
