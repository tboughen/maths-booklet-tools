import { glyphAdvance } from "../../ratio-table-core/src/font-metrics";
import { BOLD_LINE_FACTOR, boldLines } from "../../envelope-core/src/house-style";
import {
  axisOrigin,
  coordinateToSvg,
  getBounds,
  gridDivisions,
  isSketch,
  pointInBounds,
  vectorArrowEnds,
  visibleStraightPoints,
} from "./diagram";
import {
  axisTicks,
  formatAxisValue,
  gridPitchesMm,
  mathsDigits,
  mathsLetter,
  nameParts,
  sharedOriginLabel,
} from "./axes";
import { equationForObject } from "./equations";
import {
  AXIS_ARROW_EXTRA_SHAFT_CENTIMETRES,
  AXIS_LABEL_FONT_POINTS,
  AXIS_STROKE_POINTS,
  axisLetter,
  EQUATION_FONT_POINTS,
  GRID_STROKE_POINTS,
  CENTIMETRE_GRID_STROKE_POINTS,
  FINE_GRID_STROKE_POINTS,
  STRAIGHT_DASH_GAP_CENTIMETRES,
  STRAIGHT_DASH_LENGTH_CENTIMETRES,
  svgFontFamily,
  Y_AXIS_LABEL_GAP_CENTIMETRES,
  axisLabelBoxHeight,
  axisLabelBoxWidth,
  axisNameYGapCentimetres,
  pointsToDiagramUnits,
} from "./graphStyle";
import type {
  Bounds,
  Coordinate,
  CircleObject,
  CurveObject,
  ReadingObject,
  DiagramDocumentV1,
  LabelSide,
  PointLabel,
  GraphObject,
  GraphView,
  PointObject,
  StraightObject,
  SvgLayout,
} from "./types";
import { guidance } from "./print-guidance";
import { polygonCentroid, polygonVisible } from "./polygon";
import { arrowheadPath } from "./arrow";
import { READING_ARROWHEAD_POINTS, VECTOR_ARROWHEAD_POINTS } from "./graphStyle";
import { functionNameAnchor, functionPathData, functionVisible } from "./function";
import { axesCrossing, circleVisible, curveVisible, readingLegs, readingVisible, smoothCurvePath } from "./curve";

/** Grey inside a shaded shape: light enough for black lines and names to stay clear in print. */
export const POLYGON_SHADE = "#d4d4d4";
/** Shading opacity for a hidden-answer shape, in the answer colour. */
export const POLYGON_ANSWER_SHADE_OPACITY = 0.18;

/** Exam papers print shape names upright, point names italic and line names bold. */
export function nameStyle(object: GraphObject): "bold" | "italic" | "upright" {
  return object.kind === "point" ? "italic" : object.kind === "polygon" || object.kind === "region" ? "upright" : "bold";
}
import { gradientTriangleCorners, gradientTriangleValues } from "./gradient-triangle";
import { regionBoundaries, regionCentroid, regionHalfPlanes, regionPolygon } from "./region";

const UNITS_PER_CM = 100;
const FIXED_PADDING = { right: 75, top: 70 };
const EXPORT_CONTENT_MARGIN = 18;
const POINT_MARK_HALF_SIZE = 14;
/** The answers copy's colour for hidden answers, shared with ratio tables. */
export const GRAPH_ANSWER_COLOUR = "#b0125b";
/** Region shading: light grey on the pupil copy, so grid lines and B/W print stay clear. */
export const REGION_SHADE = "#d4d4d4";
const REGION_ANSWER_OPACITY = 0.22;

/** The objects one copy draws: the pupil copy leaves out answer-only objects. */
export function documentForView<T extends DiagramDocumentV1>(document: T, view: GraphView = "pupil"): T {
  if (view === "answer" || !document.objects.some((o) => o.answerOnly)) return document;
  const objects = document.objects.filter((o) => !o.answerOnly);
  return { ...document, objects };
}

export function graphPrintFacts(document: DiagramDocumentV1, view: GraphView = "pupil") {
  document = documentForView(document, view);
  const m = getExportMetrics(document);
  const labelled = document.objects.some((o) =>
    o.kind === "straight" && o.equationVisible && visibleStraightPoints(o, m.layout.bounds));
  const subscripted = visibleNames(document, m.layout).some((o) => nameParts(o.name!).subscript);
  return guidance({
    textSizesPt: [
      AXIS_LABEL_FONT_POINTS,
      ...(labelled ? [EQUATION_FONT_POINTS] : []),
      ...(subscripted ? [NAME_SUBSCRIPT_FONT_POINTS] : []),
    ],
    gridPitchMm: document.grid ? gridPitchesMm(document) : [m.layout.square / UNITS_PER_CM * 10],
  });
}
const GRID_STROKE_WIDTH = pointsToDiagramUnits(
  GRID_STROKE_POINTS,
  UNITS_PER_CM,
);
/**
 * The plot clip reaches half a line's width past the grid, so a line or segment lying on the edge
 * of the grid (a distance-time graph stopped at its top value) prints at full weight instead of
 * half clipped (Tim, A7.11 marking, 15 Nov 2026). A line crossing the edge ends in its round cap.
 * Bold lines are heavier, so their clip reaches further. Polygon fills keep the exact plot clip.
 */
export function plotClipBleed(lines: DiagramDocumentV1["lines"]): number {
  return (GRID_STROKE_WIDTH * (lines === "bold" ? BOLD_LINE_FACTOR : 1)) / 2;
}
const AXIS_STROKE_WIDTH = pointsToDiagramUnits(
  AXIS_STROKE_POINTS,
  UNITS_PER_CM,
);
const AXIS_LABEL_FONT_SIZE = pointsToDiagramUnits(
  AXIS_LABEL_FONT_POINTS,
  UNITS_PER_CM,
);
const EQUATION_FONT_SIZE = pointsToDiagramUnits(
  EQUATION_FONT_POINTS,
  UNITS_PER_CM,
);
const AXIS_ARROW_EXTENSION =
  15 + UNITS_PER_CM * AXIS_ARROW_EXTRA_SHAFT_CENTIMETRES;
/** Object names print at the axis-number size; subscripts at the 10 pt house minimum. */
const NAME_SUBSCRIPT_FONT_POINTS = 10;
const NAME_SUBSCRIPT_FONT_SIZE = pointsToDiagramUnits(
  NAME_SUBSCRIPT_FONT_POINTS,
  UNITS_PER_CM,
);
const gridWidth = (points: number) => pointsToDiagramUnits(points, UNITS_PER_CM);
const TITLE_LINE_HEIGHT = AXIS_LABEL_FONT_SIZE * 1.2;
const Y_TITLE_MAX_WIDTH = 3.2 * UNITS_PER_CM;
const TITLE_GAP = 0.25 * UNITS_PER_CM;

export interface ExportMetrics {
  widthCm: number;
  heightCm: number;
  width: number;
  height: number;
  layout: SvgLayout;
}

/**
 * Width of a line of upright prose, such as an axis title. Like axisLabelBoxWidth it is an
 * estimate, kept generous so the same geometry holds in Word, PDF and PNG copies.
 */
function proseWidth(text: string, fontSize: number): number {
  return [...text].reduce((width, character) => {
    if (character === " ") return width + 0.26;
    if (/[iljtfr()[\].,:;'’]/.test(character)) return width + 0.32;
    if (/[mwMW%]/.test(character)) return width + 0.84;
    if (/[A-Z£]/.test(character)) return width + 0.7;
    return width + 0.52;
  }, 0) * fontSize;
}

function wrapTitle(text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const word of text.trim().split(/\s+/)) {
    const last = lines.at(-1);
    if (last !== undefined && proseWidth(`${last} ${word}`, AXIS_LABEL_FONT_SIZE) <= maxWidth)
      lines[lines.length - 1] = `${last} ${word}`;
    else lines.push(word);
  }
  return lines;
}

/**
 * How far below the x-axis the x numbers sit. When both axes number their crossing point
 * (a travel graph's 0 and 12 00), the x numbers drop a little so the two never touch.
 */
function xNumberDrop(document: DiagramDocumentV1): number {
  if (sharedOriginLabel(document)) return AXIS_LABEL_FONT_SIZE * 1.08;
  const atCorner = (axis: "x" | "y") =>
    axisTicks(document, axis).some((t) => t.index === document.axes[axis].negativeSquares);
  return atCorner("x") && atCorner("y") ? AXIS_LABEL_FONT_SIZE * 1.4 : AXIS_LABEL_FONT_SIZE * 1.08;
}

/** Distances from the plot's left edge, in export units, for the y-axis numbers and title. */
function yAxisTextGeometry(document: DiagramDocumentV1) {
  const originFromPlotLeft = document.axes.x.negativeSquares * UNITS_PER_CM;
  const yNumberFromPlotLeft =
    originFromPlotLeft - UNITS_PER_CM * Y_AXIS_LABEL_GAP_CENTIMETRES;
  let numbersLeft = yNumberFromPlotLeft;
  for (const { label } of axisTicks(document, "y"))
    numbersLeft = Math.min(
      numbersLeft,
      yNumberFromPlotLeft - axisLabelBoxWidth(label, AXIS_LABEL_FONT_SIZE),
    );
  const above = !!document.axes.y.title && document.axes.y.titleAbove === true;
  if (above) {
    // Above the axis, the title starts at the y numbers' left edge and runs over the plot,
    // wrapping only if it is wider than the graph.
    const left = Math.min(numbersLeft, originFromPlotLeft - TITLE_GAP);
    const horizontal = (document.axes.x.negativeSquares + document.axes.x.positiveSquares) * UNITS_PER_CM;
    const title = wrapTitle(document.axes.y.title!, Math.max(horizontal - left, 3 * UNITS_PER_CM));
    return { originFromPlotLeft, yNumberFromPlotLeft, title, titleLeft: left, above };
  }
  const title = document.axes.y.title
    ? wrapTitle(document.axes.y.title, Y_TITLE_MAX_WIDTH)
    : [];
  const titleWidth = Math.max(0, ...title.map((l) => proseWidth(l, AXIS_LABEL_FONT_SIZE)));
  const titleLeft = Math.min(numbersLeft, 0) - TITLE_GAP - titleWidth;
  return { originFromPlotLeft, yNumberFromPlotLeft, title, titleLeft, above };
}

/** The y-axis arrowhead's size and how far its line runs above the top grid line. */
function yArrow(document: DiagramDocumentV1) {
  // Bold axes (U111) get arrowheads 1.5 times as large, so the heavier line stays inside the head.
  const size = document.lines === "bold" ? 37.5 : 25;
  // The y-axis reaches far enough above a number on the top line for the arrowhead (drawn
  // 0.85 of its size back from the line's end) to clear that number's box.
  const topLabelled = axisTicks(document, "y").some((t) => t.index === document.axes.y.negativeSquares + document.axes.y.positiveSquares);
  const extension = Math.max(AXIS_ARROW_EXTENSION, topLabelled ? AXIS_LABEL_FONT_SIZE * 0.48 + CROSS_CLEARANCE + size * 0.85 : 0);
  return { size, extension };
}

/**
 * A y title above the axis: its first baseline, measured from the plot's top edge (negative is
 * above). The last line clears the arrowhead's tip and the axis letter beside it.
 */
function yTitleAboveFirstBaseline(document: DiagramDocumentV1, lines: number) {
  const { size, extension } = yArrow(document);
  const tip = extension + size * 0.15;
  const clear = Math.max(tip, axisLetter("y", document.axes.y) ? 30 + AXIS_LABEL_FONT_SIZE * 0.75 : 0);
  return -(clear + TITLE_GAP) - (lines - 1) * TITLE_LINE_HEIGHT;
}

/** Room above the plot: fixed, or more for a y title printed above the axis. */
function exportTopPadding(document: DiagramDocumentV1): number {
  const y = yAxisTextGeometry(document);
  if (!y.above) return FIXED_PADDING.top;
  const capTop = -yTitleAboveFirstBaseline(document, y.title.length) + AXIS_LABEL_FONT_SIZE * 0.8;
  return Math.max(FIXED_PADDING.top, Math.ceil(capTop + EXPORT_CONTENT_MARGIN));
}

/** The x title's lines and first baseline, measured down from the plot's bottom edge. */
function xTitleGeometry(document: DiagramDocumentV1) {
  if (!document.axes.x.title) return null;
  const horizontalSquares =
    document.axes.x.negativeSquares + document.axes.x.positiveSquares;
  const lines = wrapTitle(
    document.axes.x.title,
    Math.max(horizontalSquares * UNITS_PER_CM, 4 * UNITS_PER_CM),
  );
  const originFromPlotBottom = -document.axes.y.negativeSquares * UNITS_PER_CM;
  const numbers = Math.max(originFromPlotBottom, 0) + xNumberDrop(document);
  return { lines, baseline: numbers + AXIS_LABEL_FONT_SIZE * 1.55 };
}

/**
 * Where the axis titles and x numbers go, in print units (100 per cm) measured from the plot,
 * so the editor preview can draw them exactly where the print copy does.
 */
export function axisTextPlacement(document: DiagramDocumentV1) {
  const y = yAxisTextGeometry(document);
  const x = xTitleGeometry(document);
  return {
    xNumberDrop: xNumberDrop(document),
    lineHeight: TITLE_LINE_HEIGHT,
    xTitle: x ? { lines: x.lines, baselineBelowPlot: x.baseline } : null,
    yTitle: y.title.length
      ? {
          lines: y.title,
          leftFromPlotLeft: y.titleLeft,
          // Above the axis: the first line's baseline from the plot's top edge (negative is up).
          ...(y.above ? { firstBaselineFromPlotTop: yTitleAboveFirstBaseline(document, y.title.length) } : {}),
        }
      : null,
  };
}

export { NAME_SUBSCRIPT_FONT_POINTS };

function exportLeftPadding(document: DiagramDocumentV1): number {
  const { originFromPlotLeft, yNumberFromPlotLeft, title, titleLeft } =
    yAxisTextGeometry(document);
  let contentLeft = -POINT_MARK_HALF_SIZE - GRID_STROKE_WIDTH / 2;

  for (const { index, label } of axisTicks(document, "x")) {
    contentLeft = Math.min(
      contentLeft,
      index * UNITS_PER_CM - axisLabelBoxWidth(label, AXIS_LABEL_FONT_SIZE) / 2,
    );
  }
  for (const { label } of axisTicks(document, "y")) {
    contentLeft = Math.min(
      contentLeft,
      yNumberFromPlotLeft - axisLabelBoxWidth(label, AXIS_LABEL_FONT_SIZE),
    );
  }

  if (sharedOriginLabel(document)) {
    const originLabelX = originFromPlotLeft - AXIS_LABEL_FONT_SIZE * 0.38;
    contentLeft = Math.min(
      contentLeft,
      originLabelX - axisLabelBoxWidth("0", AXIS_LABEL_FONT_SIZE),
    );
  }
  if (title.length) contentLeft = Math.min(contentLeft, titleLeft);
  return Math.ceil(EXPORT_CONTENT_MARGIN - contentLeft);
}

function exportBottomPadding(document: DiagramDocumentV1): number {
  let contentBottom = POINT_MARK_HALF_SIZE + GRID_STROKE_WIDTH / 2;

  for (const { index } of axisTicks(document, "y")) {
    const baselineFromPlotBottom = -index * UNITS_PER_CM + AXIS_LABEL_FONT_SIZE * 0.34;
    const knockoutBottom =
      baselineFromPlotBottom -
      AXIS_LABEL_FONT_SIZE * 0.82 +
      axisLabelBoxHeight(AXIS_LABEL_FONT_SIZE);
    contentBottom = Math.max(contentBottom, knockoutBottom);
  }

  const originFromPlotBottom = -document.axes.y.negativeSquares * UNITS_PER_CM;
  const dropped = xNumberDrop(document) !== AXIS_LABEL_FONT_SIZE * 1.08;
  const xLabelBottom =
    originFromPlotBottom + AXIS_LABEL_FONT_SIZE * (dropped ? 1.62 : 1.3);
  contentBottom = Math.max(contentBottom, xLabelBottom);
  const title = xTitleGeometry(document);
  if (title)
    contentBottom = Math.max(
      contentBottom,
      title.baseline + (title.lines.length - 1) * TITLE_LINE_HEIGHT + AXIS_LABEL_FONT_SIZE * 0.3,
    );
  return Math.ceil(EXPORT_CONTENT_MARGIN + contentBottom);
}

/** Room right of the plot: the arrow and x name, or a wide last number such as 14 30. */
function exportRightPadding(document: DiagramDocumentV1): number {
  const fixed = document.styleProfile === "portable-v1" ? 90 : FIXED_PADDING.right;
  const total = document.axes.x.negativeSquares + document.axes.x.positiveSquares;
  let extent = 0;
  for (const { index, label } of axisTicks(document, "x"))
    extent = Math.max(
      extent,
      (index - total) * UNITS_PER_CM + axisLabelBoxWidth(label, AXIS_LABEL_FONT_SIZE) / 2,
    );
  return Math.max(fixed, Math.ceil(extent + EXPORT_CONTENT_MARGIN));
}

export function getExportMetrics(document: DiagramDocumentV1): ExportMetrics {
  const horizontalSquares =
    document.axes.x.negativeSquares + document.axes.x.positiveSquares;
  const verticalSquares =
    document.axes.y.negativeSquares + document.axes.y.positiveSquares;
  const leftPadding = exportLeftPadding(document);
  const bottomPadding = exportBottomPadding(document);
  const plotRight = leftPadding + horizontalSquares * UNITS_PER_CM;
  const plotTop = exportTopPadding(document);
  const plotBottom = plotTop + verticalSquares * UNITS_PER_CM;
  // Portable STIX x needs a visible margin beyond its actual ink bounds.
  const width = plotRight + exportRightPadding(document);
  const height = plotBottom + bottomPadding;
  return {
    widthCm: width / UNITS_PER_CM,
    heightCm: height / UNITS_PER_CM,
    width,
    height,
    layout: {
      width,
      height,
      plotLeft: leftPadding,
      plotTop,
      plotRight,
      plotBottom,
      square: UNITS_PER_CM,
      bounds: getBounds(document),
    },
  };
}

function n(value: number): string {
  return Number(value.toFixed(3)).toString();
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function axisTickLabelMarkup(
  label: string,
  x: number,
  baseline: number,
  textAnchor: "start" | "middle" | "end" = "middle",
  origin = false,
  tight = false,
): string {
  // On a fine grid the white box hugs the digits, so neighbouring fine lines stay whole.
  const width = tight
    ? axisLabelBoxWidth(label, AXIS_LABEL_FONT_SIZE) - AXIS_LABEL_FONT_SIZE * 0.22
    : axisLabelBoxWidth(label, AXIS_LABEL_FONT_SIZE);
  const height = tight
    ? AXIS_LABEL_FONT_SIZE * 0.82
    : axisLabelBoxHeight(AXIS_LABEL_FONT_SIZE);
  const rectX =
    textAnchor === "middle"
      ? x - width / 2
      : textAnchor === "end"
        ? x - width
        : x;
  const rectY = baseline - AXIS_LABEL_FONT_SIZE * (tight ? 0.74 : 0.82);
  const className = origin ? "axis-number axis-number-origin" : "axis-number";
  const originTransform = origin
    ? ` transform="translate(${n(x)} ${n(baseline)}) skewX(-12) translate(${n(-x)} ${n(-baseline)})"`
    : "";
  return `<g class="${className}"><rect x="${n(rectX)}" y="${n(rectY)}" width="${n(width)}" height="${n(height)}" rx="${n(AXIS_LABEL_FONT_SIZE * 0.05)}" fill="#ffffff"/><text x="${n(x)}" y="${n(baseline)}" text-anchor="${textAnchor}"${originTransform}>${escapeXml(label)}</text></g>`;
}

/**
 * An equation label, left-aligned at (x, baseline). A fraction such as 1/2 prints stacked, as on
 * worksheets: numerator over a bar over denominator, centred on the maths axis of the line.
 * Widths come from the bundled STIX Two Text italic metrics the label is drawn in.
 */
function equationLabelMarkup(equation: string, x: number, baseline: number): string {
  const size = EQUATION_FONT_SIZE;
  const width = (text: string, fontSize: number) =>
    Array.from(text).reduce((sum, c) => sum + glyphAdvance(c, true) * fontSize, 0);
  const parts = equation.split(/(\d+\/\d+)/);
  if (parts.length === 1)
    return `<text x="${n(x)}" y="${n(baseline)}">${escapeXml(equation)}</text>`;
  const small = size * 0.8;
  const axis = baseline - size * 0.31;
  const out: string[] = [];
  let left = x;
  for (const part of parts) {
    if (!part) continue;
    const fraction = part.match(/^(\d+)\/(\d+)$/);
    if (!fraction) {
      out.push(`<text x="${n(left)}" y="${n(baseline)}" xml:space="preserve">${escapeXml(part)}</text>`);
      left += width(part, size);
      continue;
    }
    const [, top, bottom] = fraction;
    const bar = Math.max(width(top, small), width(bottom, small)) + size * 0.2;
    const centre = left + size * 0.08 + bar / 2;
    out.push(
      `<text x="${n(centre)}" y="${n(axis - size * 0.15)}" font-size="${n(small)}" text-anchor="middle">${top}</text>`,
      // A filled bar, so it takes the label's own colour (black, or the answer colour).
      `<rect x="${n(centre - bar / 2)}" y="${n(axis - size * 0.03)}" width="${n(bar)}" height="${n(size * 0.06)}"/>`,
      `<text x="${n(centre)}" y="${n(axis + size * 0.78)}" font-size="${n(small)}" text-anchor="middle">${bottom}</text>`,
    );
    left = centre + bar / 2 + size * 0.08;
  }
  return `<g class="equation-label">${out.join("")}</g>`;
}

function autoLabelPosition(
  object: StraightObject,
  layout: SvgLayout,
): Coordinate {
  const visible = visibleStraightPoints(object, layout.bounds);
  if (!visible) return { x: layout.plotLeft + 20, y: layout.plotTop + 35 };
  const first = coordinateToSvg(visible[0], layout);
  const second = coordinateToSvg(visible[1], layout);
  const x = first.x + (second.x - first.x) * 0.72;
  const y = first.y + (second.y - first.y) * 0.72 - 16;
  return {
    x: Math.min(layout.plotRight - 110, Math.max(layout.plotLeft + 10, x)),
    y: Math.min(layout.plotBottom - 10, Math.max(layout.plotTop + 28, y)),
  };
}

function gridMarkup(document: DiagramDocumentV1, layout: SvgLayout): string {
  if (isSketch(document)) return "";
  const { x: ax, y: ay } = document.axes;
  const divisions = gridDivisions(document);
  // Exam parity: a 1 cm grid on its own is one weight; graph paper with a fine grid has three,
  // with the heavier 1 cm lines every 2 cm from the axes, as on Edexcel papers.
  const weights = divisions === 1
    ? [gridWidth(CENTIMETRE_GRID_STROKE_POINTS)]
    : [FINE_GRID_STROKE_POINTS.fine, FINE_GRID_STROKE_POINTS.centimetre, FINE_GRID_STROKE_POINTS.twoCentimetre].map(gridWidth);
  const tiers: string[][] = weights.map(() => []);
  const step = layout.square / divisions;
  const tier = (index: number, fromOrigin: number) =>
    divisions === 1 ? 0 : index % divisions !== 0 ? 0 : (fromOrigin / divisions) % 2 === 0 ? 2 : 1;
  for (let index = 0; index <= (ax.negativeSquares + ax.positiveSquares) * divisions; index += 1) {
    const x = layout.plotLeft + index * step;
    tiers[tier(index, Math.abs(index - ax.negativeSquares * divisions))].push(
      `<line x1="${n(x)}" y1="${n(layout.plotTop)}" x2="${n(x)}" y2="${n(layout.plotBottom)}"/>`,
    );
  }
  const vertical = (ay.negativeSquares + ay.positiveSquares) * divisions;
  for (let index = 0; index <= vertical; index += 1) {
    const y = layout.plotTop + index * step;
    tiers[tier(index, Math.abs(vertical - index - ay.negativeSquares * divisions))].push(
      `<line x1="${n(layout.plotLeft)}" y1="${n(y)}" x2="${n(layout.plotRight)}" y2="${n(y)}"/>`,
    );
  }
  // Lighter lines first, so heavier ones sit on top.
  const names = divisions === 1 ? ["grid-lines"] : ["grid-lines grid-lines-fine", "grid-lines", "grid-lines grid-lines-heavy"];
  return tiers
    .map((lines, i) => (lines.length ? `<g class="${names[i]}" stroke="#a9abaa" stroke-width="${n(weights[i])}" fill="none">${lines.join("")}</g>` : ""))
    .filter(Boolean)
    .join("\n  ");
}

function originMarkup(document: DiagramDocumentV1, x: number, baseline: number): string {
  if (!sharedOriginLabel(document)) return "";
  if (document.originLabel === "0")
    return axisTickLabelMarkup("0", x, baseline, "end", true, gridDivisions(document) > 1);
  const label = mathsLetter("O", "italic");
  const tight = gridDivisions(document) > 1;
  const width = axisLabelBoxWidth("O", AXIS_LABEL_FONT_SIZE) - (tight ? AXIS_LABEL_FONT_SIZE * 0.22 : 0);
  return `<g class="axis-number axis-number-origin"><rect x="${n(x - width)}" y="${n(baseline - AXIS_LABEL_FONT_SIZE * (tight ? 0.74 : 0.82))}" width="${n(width)}" height="${n(tight ? AXIS_LABEL_FONT_SIZE * 0.82 : axisLabelBoxHeight(AXIS_LABEL_FONT_SIZE))}" rx="${n(AXIS_LABEL_FONT_SIZE * 0.05)}" fill="#ffffff"/><text x="${n(x)}" y="${n(baseline)}" text-anchor="end">${label}</text></g>`;
}

function axisTitlesMarkup(document: DiagramDocumentV1, layout: SvgLayout): string {
  const parts: string[] = [];
  const x = xTitleGeometry(document);
  if (x) {
    const centre = (layout.plotLeft + layout.plotRight) / 2;
    const baseline = layout.plotBottom + x.baseline;
    parts.push(
      `<text class="axis-title axis-title-x" x="${n(centre)}" y="${n(baseline)}" text-anchor="middle">${x.lines
        .map((line, i) => `<tspan x="${n(centre)}" y="${n(baseline + i * TITLE_LINE_HEIGHT)}">${escapeXml(line)}</tspan>`)
        .join("")}</text>`,
    );
  }
  const y = yAxisTextGeometry(document);
  if (y.title.length) {
    const left = layout.plotLeft + y.titleLeft;
    const middle = (layout.plotTop + layout.plotBottom) / 2;
    const first = y.above
      ? layout.plotTop + yTitleAboveFirstBaseline(document, y.title.length)
      : middle - ((y.title.length - 1) * TITLE_LINE_HEIGHT) / 2 + AXIS_LABEL_FONT_SIZE * 0.34;
    parts.push(
      `<text class="axis-title axis-title-y" x="${n(left)}" y="${n(first)}" text-anchor="start">${y.title
        .map((line, i) => `<tspan x="${n(left)}" y="${n(first + i * TITLE_LINE_HEIGHT)}">${escapeXml(line)}</tspan>`)
        .join("")}</text>`,
    );
  }
  return parts.length
    ? `
      ${parts.join("")}`
    : "";
}

/**
 * The axes in two layers: the axis lines, and the numbers, names and titles on small white boxes
 * that hide the grid. Both are drawn under every plotted line, so a line runs straight through
 * an axis number as Edexcel papers print it, never broken where pupils read a y-intercept.
 */
/**
 * Half the width of the y-axis arrowhead at `above` units above the top grid line: the head's tip
 * is 0.15 of its size past the line's end, and it widens to half its size at the base.
 */
export function headHalfWidthAt(above: number, extension: number, size: number): number {
  const fromTip = extension + size * 0.15 - above;
  return Math.max(0, Math.min(size, fromTip)) * 0.5;
}

/** Space between a marked cross and an axis number moved clear of it. */
const CROSS_CLEARANCE = 4;

/** The boxes of the crosses marked on the grid (the document is already the copy's view). */
function crossBoxes(document: DiagramDocumentV1, layout: SvgLayout): { l: number; r: number; t: number; b: number }[] {
  const reach = POINT_MARK_HALF_SIZE + GRID_STROKE_WIDTH;
  return document.objects.flatMap((o) => {
    if (o.kind !== "point" || !pointInBounds(o.position, layout.bounds)) return [];
    const p = coordinateToSvg(o.position, layout);
    return [{ l: p.x - reach, r: p.x + reach, t: p.y - reach, b: p.y + reach }];
  });
}

function axesMarkup(document: DiagramDocumentV1, layout: SvgLayout): { lines: string; labels: string } {
  const origin = coordinateToSvg(axisOrigin(document), layout);
  const xLabels: string[] = [];
  const yLabels: string[] = [];
  const xNumberBaseline = origin.y + xNumberDrop(document);
  const yNumberX = origin.x - UNITS_PER_CM * Y_AXIS_LABEL_GAP_CENTIMETRES;
  const tight = gridDivisions(document) > 1;
  // A cross marked on or beside an axis would print over a number: the number moves clear of
  // it, away from the axis, as Edexcel papers do (x numbers down, y numbers left).
  const crosses = crossBoxes(document, layout);
  const boxWidth = (label: string) => axisLabelBoxWidth(label, AXIS_LABEL_FONT_SIZE) - (tight ? AXIS_LABEL_FONT_SIZE * 0.22 : 0);
  const boxTop = (baseline: number) => baseline - AXIS_LABEL_FONT_SIZE * (tight ? 0.74 : 0.82);
  const boxHeight = tight ? AXIS_LABEL_FONT_SIZE * 0.82 : axisLabelBoxHeight(AXIS_LABEL_FONT_SIZE);
  const overlapping = (l: number, r: number, t: number, b: number) => crosses.filter((c) => c.l < r && c.r > l && c.t < b && c.b > t);

  for (const tick of axisTicks(document, "x")) {
    const x = layout.plotLeft + tick.index * layout.square;
    const w = boxWidth(tick.label), top = boxTop(xNumberBaseline);
    const hit = overlapping(x - w / 2, x + w / 2, top, top + boxHeight);
    const drop = hit.length ? Math.max(...hit.map((c) => c.b + CROSS_CLEARANCE - top)) : 0;
    xLabels.push(axisTickLabelMarkup(tick.label, x, xNumberBaseline + drop, "middle", false, tight));
  }
  // Top to bottom, as the y numbers have always been written.
  for (const tick of axisTicks(document, "y").reverse()) {
    const y =
      layout.plotBottom - tick.index * layout.square + AXIS_LABEL_FONT_SIZE * 0.34;
    const w = boxWidth(tick.label), top = boxTop(y);
    const hit = overlapping(yNumberX - w, yNumberX, top, top + boxHeight);
    const shift = hit.length ? Math.max(...hit.map((c) => yNumberX - (c.l - CROSS_CLEARANCE))) : 0;
    yLabels.push(axisTickLabelMarkup(tick.label, yNumberX - shift, y, "end", false, tight));
  }

  const { size: arrowSize, extension: yArrowExtension } = yArrow(document);
  const originX = origin.x - AXIS_LABEL_FONT_SIZE * 0.38;
  const xLetter = axisLetter("x", document.axes.x), yLetter = axisLetter("y", document.axes.y);
  const xName = !xLetter
    ? ""
    : `
      <text class="axis-name axis-name-x" x="${n(layout.plotRight + 48)}" y="${n(xNumberBaseline)}" font-family="${svgFontFamily(document)}">${xLetter}</text>`;
  const yName = !yLetter
    ? ""
    : `
      <text class="axis-name axis-name-y" x="${n(Math.min(origin.x - UNITS_PER_CM * axisNameYGapCentimetres(document), origin.x - headHalfWidthAt(30, yArrowExtension, arrowSize)))}" y="${n(layout.plotTop - 30)}" text-anchor="end" font-family="${svgFontFamily(document)}">${yLetter}</text>`;
  const originLabel = originMarkup(document, originX, xNumberBaseline);
  const lines = `
    <defs>
      <marker id="axis-arrow" viewBox="0 0 10 10" refX="8.5" refY="5" markerUnits="userSpaceOnUse" markerWidth="${arrowSize}" markerHeight="${arrowSize}" orient="auto">
        <path d="M 0 0 L 10 5 L 0 10 z" fill="#1f2224"/>
      </marker>
    </defs>
    <g class="graph-axes" stroke="#1f2224" stroke-width="${n(AXIS_STROKE_WIDTH)}" fill="none">
      <line x1="${n(layout.plotLeft)}" y1="${n(origin.y)}" x2="${n(layout.plotRight + AXIS_ARROW_EXTENSION)}" y2="${n(origin.y)}" marker-end="url(#axis-arrow)"/>
      <line x1="${n(origin.x)}" y1="${n(layout.plotBottom)}" x2="${n(origin.x)}" y2="${n(layout.plotTop - yArrowExtension)}" marker-end="url(#axis-arrow)"/>
    </g>`;
  const labels = `
    <g class="axis-labels" fill="#242628" font-family="${svgFontFamily(document)}" font-size="${n(AXIS_LABEL_FONT_SIZE)}">
      ${xLabels.join("")}${yLabels.join("")}${originLabel ? `
      ${originLabel}` : ""}${xName}${yName}${axisTitlesMarkup(document, layout)}
    </g>`;
  return { lines, labels };
}

/**
 * A white outline drawn under a text so grid lines and plotted lines stop just short of the
 * letters, without the box that would cut whole grid lines.
 */
function halo(...texts: string[]): string {
  const outlines = texts.map((text) =>
    text.replace(
      "<text ",
      `<text aria-hidden="true" fill="#ffffff" stroke="#ffffff" stroke-width="${n(TEXT_HALO_WIDTH)}" stroke-linejoin="round" `,
    ),
  );
  return outlines.join("") + texts.join("");
}

const TEXT_HALO_WIDTH = AXIS_LABEL_FONT_SIZE * 0.14;
const POINT_LABEL_GAP = UNITS_PER_CM * 0.12;

/**
 * The automatic side for a line's label: left of the y-axis or below the x-axis, in the corner
 * the line leaves free (a rising line runs through the top right and bottom left).
 */
function defaultLabelSide(document: DiagramDocumentV1, at: Coordinate, line: StraightObject): LabelSide {
  const origin = axisOrigin(document);
  const onY = Math.abs(at.x - origin.x) < 1e-9;
  const onX = Math.abs(at.y - origin.y) < 1e-9;
  const dx = line.end.x - line.start.x,
    dy = line.end.y - line.start.y;
  const vertical = Math.abs(dx) < 1e-12,
    horizontal = Math.abs(dy) < 1e-12;
  const rising = !vertical && !horizontal && dy / dx > 0;
  if (onX && onY) return vertical ? "below-right" : horizontal ? "above-right" : rising ? "below-right" : "above-right";
  if (onY) return vertical || horizontal ? "left" : rising ? "above-left" : "below-left";
  if (onX) return vertical ? "below-right" : horizontal ? "below" : rising ? "below-right" : "below-left";
  return vertical ? "right" : horizontal ? "above" : rising ? "above-left" : "above-right";
}

/** Anchor and baseline of a line's label, in SVG units, for the given font size and gap. */
export function pointLabelPlacement(
  document: DiagramDocumentV1,
  line: StraightObject,
  label: PointLabel,
  layout: SvgLayout,
  fontSize = AXIS_LABEL_FONT_SIZE,
  gap = POINT_LABEL_GAP,
): { x: number; baseline: number; anchor: "start" | "middle" | "end" } {
  const p = coordinateToSvg(label.at, layout);
  const side = label.side ?? defaultLabelSide(document, label.at, line);
  const left = side.endsWith("left"),
    right = side.endsWith("right");
  const above = side.startsWith("above"),
    below = side.startsWith("below");
  return {
    x: left ? p.x - gap : right ? p.x + gap : p.x,
    baseline: above ? p.y - gap : below ? p.y + gap + fontSize * 0.68 : p.y + fontSize * 0.34,
    anchor: left ? "end" : right ? "start" : "middle",
  };
}

function pointLabelsMarkup(document: DiagramDocumentV1, layout: SvgLayout, objects: StraightObject[]): string {
  const marks = objects.flatMap((object) =>
    (object.labels ?? [])
      .filter((label) => label.at.x >= layout.bounds.xMin - 1e-9 && label.at.x <= layout.bounds.xMax + 1e-9 && label.at.y >= layout.bounds.yMin - 1e-9 && label.at.y <= layout.bounds.yMax + 1e-9)
      .map((label) => {
        const place = pointLabelPlacement(document, object, label, layout);
        return halo(`<text x="${n(place.x)}" y="${n(place.baseline)}" text-anchor="${place.anchor}">${escapeXml(label.text)}</text>`);
      }),
  );
  return marks.join("");
}

type Named = GraphObject & { name: string };

/** Named objects that are on the grid, in saved order. */
function visibleNames(document: DiagramDocumentV1, layout: SvgLayout): Named[] {
  return document.objects.filter((o): o is Named => {
    if (!o.name) return false;
    if (o.kind === "region") return regionPolygon(regionHalfPlanes(o), layout.bounds).length > 0;
    if (o.kind === "reading") return false;
    if (o.kind === "circle") return circleVisible(o, layout.bounds);
    if (o.kind === "curve") return curveNameAnchor(o, layout.bounds) !== null;
    if (o.kind === "function") return functionNameAnchor(o, layout.bounds) !== null;
    return o.kind === "point"
      ? o.position.x >= layout.bounds.xMin - 1e-9 &&
          o.position.x <= layout.bounds.xMax + 1e-9 &&
          o.position.y >= layout.bounds.yMin - 1e-9 &&
          o.position.y <= layout.bounds.yMax + 1e-9
      : o.kind === "polygon"
        ? polygonVisible(o, layout.bounds)
        : visibleStraightPoints(o, layout.bounds) !== null;
  });
}

/** Printed width and height of a name, in export units. */
export function nameBox(name: string, fontSize = AXIS_LABEL_FONT_SIZE) {
  const parts = nameParts(name);
  const subscriptSize = fontSize * (NAME_SUBSCRIPT_FONT_POINTS / AXIS_LABEL_FONT_POINTS);
  const letter = fontSize * (0.76 + (parts.prime ? 0.3 : 0));
  const subscript = parts.subscript.length * subscriptSize * 0.56;
  return {
    letterWidth: letter,
    width: letter + subscript + fontSize * 0.16,
    height: fontSize * 1.2,
    subscriptSize,
  };
}

type Axes = DiagramDocumentV1["axes"];
/**
 * Where a name sits automatically, as the centre of its box in SVG units. Points: up and to the
 * right of the cross. Lines: near the upper end, on the right of the line (above a horizontal
 * one). The box is kept inside the plot.
 */
function autoNameCentre(object: Named, layout: SvgLayout, unitsPerCm: number, axes?: Axes): Coordinate {
  const box = nameBox(object.name, AXIS_LABEL_FONT_SIZE * (unitsPerCm / UNITS_PER_CM));
  let centre: Coordinate;
  if (object.kind === "region") {
    centre = coordinateToSvg(regionCentroid(regionPolygon(regionHalfPlanes(object), layout.bounds)), layout);
  } else if (object.kind === "point") {
    // A name with printed coordinates, A(2, 3), is placed as one label; the name is its left part.
    const total = box.width + coordinatesWidth(object, unitsPerCm, axes);
    const p = coordinateToSvg(object.position, layout);
    const dx = 0.18 * unitsPerCm + total / 2;
    const dy = 0.16 * unitsPerCm + box.height / 2;
    const right = p.x + dx + total / 2 <= layout.plotRight;
    const up = p.y - dy - box.height / 2 >= layout.plotTop;
    centre = { x: (right ? p.x + dx : p.x - dx) - total / 2 + box.width / 2, y: up ? p.y - dy : p.y + dy };
  } else if (object.kind === "polygon") {
    centre = coordinateToSvg(polygonCentroid(object.vertices), layout);
  } else if (object.kind === "circle") {
    // Up and to the right of the circle, beside the point at 45°.
    const edge = coordinateToSvg({ x: object.centre.x + object.radius * Math.SQRT1_2, y: object.centre.y + object.radius * Math.SQRT1_2 }, layout);
    centre = { x: edge.x + 0.14 * unitsPerCm + box.width / 2, y: edge.y - 0.14 * unitsPerCm - box.height / 2 };
  } else if (object.kind === "curve" || object.kind === "reading" || object.kind === "function") {
    // A curve's name sits up and to the right of its last point on the grid, kept inside the plot.
    const anchor = object.kind === "curve" ? curveNameAnchor(object, layout.bounds) : object.kind === "function" ? functionNameAnchor(object, layout.bounds) : null;
    const p = coordinateToSvg(anchor ?? (object.kind === "reading" ? object.at : object.kind === "curve" ? object.points[0] : { x: 0, y: 0 }), layout);
    const dx = 0.2 * unitsPerCm + box.width / 2, dy = 0.2 * unitsPerCm + box.height / 2;
    const right = p.x + dx + box.width / 2 <= layout.plotRight;
    const up = p.y - dy - box.height / 2 >= layout.plotTop;
    centre = { x: right ? p.x + dx : p.x - dx, y: up ? p.y - dy : p.y + dy };
  } else {
    const visible = visibleStraightPoints(object, layout.bounds)!;
    const a = coordinateToSvg(visible[0], layout);
    const b = coordinateToSvg(visible[1], layout);
    const [low, high] = a.y >= b.y ? [a, b] : [b, a];
    const length = Math.hypot(high.x - low.x, high.y - low.y) || 1;
    const d = { x: (high.x - low.x) / length, y: (high.y - low.y) / length };
    let normal = { x: -d.y, y: d.x };
    if (Math.abs(normal.x) < 1e-6) normal = { x: 0, y: -1 };
    else if (normal.x < 0) normal = { x: -normal.x, y: -normal.y };
    const along = Math.min(length * 0.86, Math.max(length - 0.9 * unitsPerCm, length * 0.5));
    const reach =
      0.14 * unitsPerCm +
      Math.abs(normal.x) * (box.width / 2) +
      Math.abs(normal.y) * (box.height / 2);
    centre = {
      x: low.x + d.x * along + normal.x * reach,
      y: low.y + d.y * along + normal.y * reach,
    };
  }
  return centre;
}

/** The centre of an object's printed name in the given layout, with its box inside the plot. */
export function nameCentre(object: GraphObject, layout: SvgLayout, unitsPerCm = UNITS_PER_CM, axes?: Axes): Coordinate | null {
  if (!object.name) return null;
  const box = nameBox(object.name, AXIS_LABEL_FONT_SIZE * (unitsPerCm / UNITS_PER_CM));
  const centre = object.namePosition
    ? coordinateToSvg(object.namePosition, layout)
    : autoNameCentre(object as Named, layout, unitsPerCm, axes);
  // Printed coordinates follow the name, so they must fit inside the plot too.
  const after = object.kind === "point" ? coordinatesWidth(object, unitsPerCm, axes) : 0;
  return {
    x: Math.min(layout.plotRight - box.width / 2 - after, Math.max(layout.plotLeft + box.width / 2, centre.x)),
    y: Math.min(layout.plotBottom - box.height / 2, Math.max(layout.plotTop + box.height / 2, centre.y)),
  };
}

const COORDINATE_BLANK = "………";
/** The printed coordinates of a point: (2, −3), or the pupil's blank ( ……… , ……… ). */
export function coordinatesText(document: DiagramDocumentV1, object: PointObject, view: GraphView): string | null {
  if (!object.coordinates) return null;
  if (object.coordinates === "blank" && view === "pupil") return `( ${COORDINATE_BLANK} , ${COORDINATE_BLANK} )`;
  return `(${formatAxisValue(object.position.x, document.axes.x)}, ${formatAxisValue(object.position.y, document.axes.y)})`;
}
/** Width reserved after the name for the coordinates: the wider of the blank and the values. */
function coordinatesWidth(object: GraphObject, unitsPerCm: number, axes?: Axes): number {
  if (object.kind !== "point" || !object.coordinates) return 0;
  const fontSize = AXIS_LABEL_FONT_SIZE * (unitsPerCm / UNITS_PER_CM);
  const width = (text: string) => Array.from(text).reduce((sum, c) => sum + glyphAdvance(c) * fontSize, 0);
  const values = `(${formatAxisValue(object.position.x, axes?.x ?? {})}, ${formatAxisValue(object.position.y, axes?.y ?? {})})`;
  return Math.max(width(values), object.coordinates === "blank" ? width(`( ${COORDINATE_BLANK} , ${COORDINATE_BLANK} )`) : 0);
}
/** Where a point's coordinates are anchored and their vertical centre, in SVG units. After a name
 * they start at its right edge; alone on the left of the cross they end beside it. */
export function coordinatesAnchor(
  object: PointObject,
  layout: SvgLayout,
  unitsPerCm = UNITS_PER_CM,
  axes?: Axes,
): (Coordinate & { anchor: "start" | "end" }) | null {
  if (!object.coordinates) return null;
  const fontSize = AXIS_LABEL_FONT_SIZE * (unitsPerCm / UNITS_PER_CM);
  if (object.name) {
    const centre = nameCentre(object, layout, unitsPerCm, axes)!;
    // Exam papers write A(2, 3) with no space; the name box carries a little side padding.
    return { x: centre.x + nameBox(object.name, fontSize).width / 2 - fontSize * 0.1, y: centre.y, anchor: "start" };
  }
  // No name: the coordinates alone sit where a name would, up and to the right of the cross.
  const width = coordinatesWidth(object, unitsPerCm, axes),
    height = fontSize * 1.2;
  const p = coordinateToSvg(object.position, layout);
  const right = p.x + 0.18 * unitsPerCm + width <= layout.plotRight;
  const up = p.y - 0.16 * unitsPerCm - height >= layout.plotTop;
  const y = up ? p.y - 0.16 * unitsPerCm - height / 2 : p.y + 0.16 * unitsPerCm + height / 2;
  if (right) return { x: p.x + 0.18 * unitsPerCm, y, anchor: "start" };
  return { x: Math.max(layout.plotLeft + width, p.x - 0.18 * unitsPerCm), y, anchor: "end" };
}
function coordinatesMarkup(document: DiagramDocumentV1, layout: SvgLayout, view: GraphView): string {
  const marks = document.objects.flatMap((object) => {
    if (object.kind !== "point" || !object.coordinates) return [];
    const { x, y } = object.position;
    if (x < layout.bounds.xMin || x > layout.bounds.xMax || y < layout.bounds.yMin || y > layout.bounds.yMax) return [];
    const text = coordinatesText(document, object, view)!;
    const at = coordinatesAnchor(object, layout, UNITS_PER_CM, document.axes)!;
    // Saved answers print in the answer colour on the answers copy only.
    const answer = (object.coordinates === "blank" && view === "answer") || object.answerOnly;
    return [
      `<g class="point-coordinates${answer ? ` point-coordinates-answer" fill="${GRAPH_ANSWER_COLOUR}` : ""}" data-object-id="${escapeXml(object.id)}">${halo(`<text x="${n(at.x)}" y="${n(at.y + AXIS_LABEL_FONT_SIZE * 0.34)}"${at.anchor === "end" ? ' text-anchor="end"' : ""} font-size="${n(AXIS_LABEL_FONT_SIZE)}">${escapeXml(text)}</text>`)}</g>`,
    ];
  });
  if (!marks.length) return "";
  return `
    <g class="point-coordinates-all" fill="#202224" font-family="${svgFontFamily(document)}">${marks.join("")}</g>`;
}

function namesMarkup(document: DiagramDocumentV1, layout: SvgLayout): string {
  const names = visibleNames(document, layout);
  if (!names.length) return "";
  const marks = names.map((object) => {
    const style = nameStyle(object);
    const parts = nameParts(object.name);
    const box = nameBox(object.name);
    const centre = nameCentre(object, layout, UNITS_PER_CM, document.axes)!;
    const left = centre.x - box.width / 2 + AXIS_LABEL_FONT_SIZE * 0.08;
    const baseline = centre.y + AXIS_LABEL_FONT_SIZE * 0.34;
    const letter = `${mathsLetter(parts.letter, style)}${parts.prime ? "′" : ""}`;
    const subscript = parts.subscript
      ? `<text x="${n(left + box.letterWidth)}" y="${n(baseline + AXIS_LABEL_FONT_SIZE * 0.22)}" font-size="${n(NAME_SUBSCRIPT_FONT_SIZE)}">${mathsDigits(parts.subscript, style)}</text>`
      : "";
    const answer = object.answerOnly ? ` object-name-answer" fill="${GRAPH_ANSWER_COLOUR}` : "";
    return `<g class="object-name object-name-${object.kind}${answer}" data-object-id="${escapeXml(object.id)}">${halo(`<text x="${n(left)}" y="${n(baseline)}" font-size="${n(AXIS_LABEL_FONT_SIZE)}">${letter}</text>`, ...(subscript ? [subscript] : []))}</g>`;
  });
  return `
    <g class="object-names" fill="#202224" font-family="${svgFontFamily(document)}">${marks.join("")}</g>`;
}

/** The dotted space a blank gradient label prints on the pupil copy. Both copies place labels as
 * if they held it, so the answers copy shows each value where the pupil writes it. */
export const GRADIENT_BLANK = "………";

/** The bands the axis numbers print in, in the same units as the layout: under the x-axis and
 * left of the y-axis. Sketch axes have no numbers. */
export function axisNumberBands(document: DiagramDocumentV1, layout: SvgLayout, font: number) {
  if (isSketch(document)) return null;
  const o = coordinateToSvg(axisOrigin(document), layout);
  return { xAxisY: o.y, xBottom: o.y + font * 1.65, yAxisX: o.x, yLeft: o.x - font * 2.4 };
}
type NumberBands = ReturnType<typeof axisNumberBands>;

/** Where a gradient triangle's run and rise print: outside the triangle, unless that would leave
 * the grid or sit on the axis numbers, when the label moves to the other side of its leg.
 * `clash` is set when no side is clear. Shared by the export and the editor. */
export function gradientLabelPlacement(
  a: Coordinate,
  b: Coordinate,
  e: Coordinate,
  layout: SvgLayout,
  font: number,
  runText: string,
  riseText: string,
  bands: NumberBands = null,
) {
  const width = (text: string) => Array.from(text).reduce((sum, c) => sum + glyphAdvance(c), 0) * font;
  const gap = font * 0.45;
  const climbs = e.y < b.y;
  const runFits = (below: boolean) => (below ? b.y + gap + font * 0.95 <= layout.plotBottom : b.y - gap - font * 0.75 >= layout.plotTop);
  const runHitsNumbers = (below: boolean) => {
    if (!bands) return false;
    const top = below ? b.y + gap - font * 0.05 : b.y - gap - font * 0.75, bottom = below ? b.y + gap + font * 0.95 : b.y - gap + font * 0.2;
    const left = (a.x + b.x) / 2 - width(runText) / 2, rightEdge = (a.x + b.x) / 2 + width(runText) / 2;
    const xBand = top < bands.xBottom && bottom > bands.xAxisY;
    const yBand = left < bands.yAxisX && rightEdge > bands.yLeft;
    return xBand || yBand;
  };
  let runBelow = climbs;
  if (!runFits(runBelow) || (runHitsNumbers(runBelow) && runFits(!runBelow) && !runHitsNumbers(!runBelow))) runBelow = !runBelow;
  if (!runFits(runBelow)) runBelow = !runBelow;
  const right = b.x > a.x;
  const riseFits = (onRight: boolean) => (onRight ? b.x + gap + width(riseText) <= layout.plotRight : b.x - gap - width(riseText) >= layout.plotLeft);
  const riseHitsNumbers = (onRight: boolean) => {
    if (!bands) return false;
    const left = onRight ? b.x + gap : b.x - gap - width(riseText), rightEdge = onRight ? b.x + gap + width(riseText) : b.x - gap;
    const top = Math.min(b.y, e.y), bottom = Math.max(b.y, e.y);
    const yBand = left < bands.yAxisX && rightEdge > bands.yLeft;
    const mid = (b.y + e.y) / 2;
    const xBand = mid - font * 0.5 < bands.xBottom && mid + font * 0.5 > bands.xAxisY && top < bands.xBottom && bottom > bands.xAxisY;
    return yBand || xBand;
  };
  let riseRight = right;
  if (!riseFits(riseRight) || (riseHitsNumbers(riseRight) && riseFits(!riseRight) && !riseHitsNumbers(!riseRight))) riseRight = !riseRight;
  const clash = runHitsNumbers(runBelow) || riseHitsNumbers(riseRight);
  return {
    clash,
    run: { x: (a.x + b.x) / 2, y: runBelow ? b.y + gap + font * 0.72 : b.y - gap, anchor: "middle" as const },
    rise: {
      x: b.x + (riseRight ? gap : -gap),
      y: (b.y + e.y) / 2 + font * 0.34,
      anchor: riseRight ? ("start" as const) : ("end" as const),
    },
    runWidth: width(runText),
  };
}

/** The last point of a curve on the grid, where its name goes, or null when none is on the grid. */
function curveNameAnchor(object: CurveObject, bounds: Bounds): Coordinate | null {
  for (let i = object.points.length - 1; i >= 0; i--) if (pointInBounds(object.points[i], bounds)) return object.points[i];
  return null;
}

/** A circle true to both axes' scales (an ellipse when the scales differ). */
export function circleMarkup(document: DiagramDocumentV1, object: CircleObject, layout: SvgLayout, unitsPerCm = UNITS_PER_CM): string {
  const c = coordinateToSvg(object.centre, layout);
  const rx = (object.radius / document.axes.x.unitsPerSquare) * layout.square;
  const ry = (object.radius / document.axes.y.unitsPerSquare) * layout.square;
  const dash = object.strokeStyle === "dashed" ? ` stroke-dasharray="${n(unitsPerCm * STRAIGHT_DASH_LENGTH_CENTIMETRES)} ${n(unitsPerCm * STRAIGHT_DASH_GAP_CENTIMETRES)}"` : "";
  return `<ellipse class="graph-circle" data-object-id="${escapeXml(object.id)}" cx="${n(c.x)}" cy="${n(c.y)}" rx="${n(rx)}" ry="${n(ry)}"${dash}/>`;
}

/** Dashed reading legs to the axes, with a filled head where each reading is taken. */
export function readingMarkup(document: DiagramDocumentV1, object: ReadingObject, layout: SvgLayout, unitsPerCm = UNITS_PER_CM): string {
  const scale = document.lines === "bold" ? BOLD_LINE_FACTOR : 1;
  const length = pointsToDiagramUnits(READING_ARROWHEAD_POINTS.length, unitsPerCm) * scale;
  const half = pointsToDiagramUnits(READING_ARROWHEAD_POINTS.halfWidth, unitsPerCm) * scale;
  const dash = ` stroke-dasharray="${n(unitsPerCm * STRAIGHT_DASH_LENGTH_CENTIMETRES)} ${n(unitsPerCm * STRAIGHT_DASH_GAP_CENTIMETRES)}"`;
  const fill = object.answerOnly ? GRAPH_ANSWER_COLOUR : "#202224";
  const parts = readingLegs(object, axesCrossing(document.axes)).map((leg) => {
    const a = coordinateToSvg(leg.start, layout), b = coordinateToSvg(leg.end, layout);
    // The dashes stop at the back of the head, so the head reads cleanly on the axis.
    const d = Math.hypot(b.x - a.x, b.y - a.y);
    const stop = leg.head && d > length ? { x: b.x - ((b.x - a.x) / d) * length, y: b.y - ((b.y - a.y) / d) * length } : b;
    return `<line x1="${n(a.x)}" y1="${n(a.y)}" x2="${n(stop.x)}" y2="${n(stop.y)}"${dash}/>${leg.head ? `<path d="${arrowheadPath(a, b, "end", length, half)}" fill="${fill}" stroke="none"/>` : ""}`;
  });
  return `<g class="graph-reading" data-object-id="${escapeXml(object.id)}">${parts.join("")}</g>`;
}

/** A vector's filled arrowhead, at the end or centred on the middle, scaled with bold lines. */
export function vectorArrowMarkup(document: DiagramDocumentV1, object: StraightObject, ends: [Coordinate, Coordinate], layout: SvgLayout, unitsPerCm = UNITS_PER_CM): string {
  const scale = document.lines === "bold" ? BOLD_LINE_FACTOR : 1;
  const length = pointsToDiagramUnits(VECTOR_ARROWHEAD_POINTS.length, unitsPerCm) * scale;
  const half = pointsToDiagramUnits(VECTOR_ARROWHEAD_POINTS.halfWidth, unitsPerCm) * scale;
  const d = arrowheadPath(coordinateToSvg(ends[0], layout), coordinateToSvg(ends[1], layout), object.arrow ?? "end", length, half);
  return `<path class="vector-arrow" data-object-id="${escapeXml(object.id)}" d="${d}" fill="${object.answerOnly ? GRAPH_ANSWER_COLOUR : "#202224"}" stroke="none"/>`;
}

/** The legs and labels of a line's gradient triangle (U76), or nothing when it cannot be drawn. */
export function gradientTriangleMarkup(document: DiagramDocumentV1, object: StraightObject, layout: SvgLayout, view: GraphView): { legs: string; labels: string; answerLabels: string } {
  const none = { legs: "", labels: "", answerLabels: "" };
  const c = gradientTriangleCorners(object);
  if (!c || Math.abs(c.end.y - c.corner.y) < 1e-12) return none;
  const [a, b, e] = [c.start, c.corner, c.end].map((p) => coordinateToSvg(p, layout));
  const dash = ` stroke-dasharray="${n(UNITS_PER_CM * STRAIGHT_DASH_LENGTH_CENTIMETRES)} ${n(UNITS_PER_CM * STRAIGHT_DASH_GAP_CENTIMETRES)}"`;
  const legs = `<path class="gradient-triangle" data-object-id="${escapeXml(object.id)}" d="M ${n(a.x)} ${n(a.y)} H ${n(b.x)} V ${n(e.y)}"${dash}/>`;
  const mode = object.gradientTriangle?.labels;
  const inside = [c.start, c.corner, c.end].every((p) => pointInBounds(p, layout.bounds));
  if (!mode || !inside) return { ...none, legs };
  const values = gradientTriangleValues(object)!;
  const text = (x: number, y: number, anchor: string, value: string) =>
    halo(`<text x="${n(x)}" y="${n(y)}" text-anchor="${anchor}">${value}</text>`);
  // Blank spaces are placed as if they held the longer value, so the answers copy matches.
  const labels = (run: string, rise: string) => {
    const place = gradientLabelPlacement(a, b, e, layout, AXIS_LABEL_FONT_SIZE, run, mode === "blank" ? GRADIENT_BLANK : rise, axisNumberBands(document, layout, AXIS_LABEL_FONT_SIZE));
    return `<g class="gradient-triangle-labels" data-object-id="${escapeXml(object.id)}">${text(place.run.x, place.run.y, place.run.anchor, run)}${text(place.rise.x, place.rise.y, place.rise.anchor, rise)}</g>`;
  };
  if (mode === "values") return { legs, labels: labels(values.run, values.rise), answerLabels: "" };
  // Blank: dotted spaces for the pupil; the answers copy prints the values in the answer colour.
  return view === "answer"
    ? { legs, labels: "", answerLabels: labels(values.run, values.rise) }
    : { legs, labels: labels(GRADIENT_BLANK, GRADIENT_BLANK), answerLabels: "" };
}

function objectsMarkup(document: DiagramDocumentV1, layout: SvgLayout, view: GraphView = "pupil"): { fills: string; lines: string; marks: string } {
  // Shape fills sit under the grid and axes so they show through; outlines go before the lines, as in the editor.
  const fills: string[] = [];
  const shapes: string[] = [];
  const answerShapes: string[] = [];
  const straight: string[] = [];
  const triangleLabels: string[] = [];
  const answerTriangleLabels: string[] = [];
  const points: string[] = [];
  const labels: string[] = [];
  const answerStraight: string[] = [];
  const answerPoints: string[] = [];
  const answerLabels: string[] = [];
  for (const object of document.objects) {
    const [straightOut, pointsOut, labelsOut] = object.answerOnly
      ? [answerStraight, answerPoints, answerLabels]
      : [straight, points, labels];
    if (object.kind === "region") {
      if (!object.boundaries) continue;
      for (const b of regionBoundaries(regionHalfPlanes(object), layout.bounds)) {
        const start = coordinateToSvg(b.start, layout);
        const end = coordinateToSvg(b.end, layout);
        const dash = b.strict
          ? ` stroke-dasharray="${n(UNITS_PER_CM * STRAIGHT_DASH_LENGTH_CENTIMETRES)} ${n(UNITS_PER_CM * STRAIGHT_DASH_GAP_CENTIMETRES)}"`
          : "";
        straightOut.push(
          `<line class="region-boundary" data-object-id="${escapeXml(object.id)}" x1="${n(start.x)}" y1="${n(start.y)}" x2="${n(end.x)}" y2="${n(end.y)}"${dash}/>`,
        );
      }
      continue;
    }
    if (object.kind === "curve") {
      if (!curveVisible(object, layout.bounds)) continue;
      const svgPoints = object.points.map((p) => coordinateToSvg(p, layout));
      const d = object.smooth ? smoothCurvePath(svgPoints) : `M ${svgPoints.map((p) => `${n(p.x)} ${n(p.y)}`).join(" L ")}`;
      const dash = object.strokeStyle === "dashed" ? ` stroke-dasharray="${n(UNITS_PER_CM * STRAIGHT_DASH_LENGTH_CENTIMETRES)} ${n(UNITS_PER_CM * STRAIGHT_DASH_GAP_CENTIMETRES)}"` : "";
      straightOut.push(`<path class="graph-curve" data-object-id="${escapeXml(object.id)}" d="${d}" stroke-linejoin="round"${dash}/>`);
      continue;
    }
    if (object.kind === "function") {
      if (!functionVisible(object, layout.bounds)) continue;
      const d = functionPathData(object, layout.bounds, (p) => coordinateToSvg(p, layout), n);
      const dash = object.strokeStyle === "dashed" ? ` stroke-dasharray="${n(UNITS_PER_CM * STRAIGHT_DASH_LENGTH_CENTIMETRES)} ${n(UNITS_PER_CM * STRAIGHT_DASH_GAP_CENTIMETRES)}"` : "";
      straightOut.push(`<path class="graph-function" data-object-id="${escapeXml(object.id)}" d="${d}" stroke-linejoin="round"${dash}/>`);
      continue;
    }
    if (object.kind === "circle") {
      if (!circleVisible(object, layout.bounds)) continue;
      straightOut.push(circleMarkup(document, object, layout));
      continue;
    }
    if (object.kind === "reading") {
      if (!readingVisible(object, layout.bounds)) continue;
      straightOut.push(readingMarkup(document, object, layout));
      continue;
    }
    if (object.kind === "point") {
      const point = coordinateToSvg(object.position, layout);
      if (
        object.position.x < layout.bounds.xMin ||
        object.position.x > layout.bounds.xMax ||
        object.position.y < layout.bounds.yMin ||
        object.position.y > layout.bounds.yMax
      )
        continue;
      const size = POINT_MARK_HALF_SIZE;
      pointsOut.push(
        `<path d="M ${n(point.x - size)} ${n(point.y - size)} L ${n(point.x + size)} ${n(point.y + size)} M ${n(point.x - size)} ${n(point.y + size)} L ${n(point.x + size)} ${n(point.y - size)}"/>`,
      );
      continue;
    }
    if (object.kind === "polygon") {
      if (!polygonVisible(object, layout.bounds)) continue;
      const points = object.vertices.map((p) => coordinateToSvg(p, layout)).map((p) => `${n(p.x)},${n(p.y)}`).join(" ");
      if (object.shaded)
        fills.push(
          `<polygon class="graph-polygon-fill" points="${points}" ${object.answerOnly ? `fill="${GRAPH_ANSWER_COLOUR}" fill-opacity="${POLYGON_ANSWER_SHADE_OPACITY}"` : `fill="${POLYGON_SHADE}"`}/>`,
        );
      (object.answerOnly ? answerShapes : shapes).push(`<polygon class="graph-polygon" data-object-id="${escapeXml(object.id)}" points="${points}" stroke-linejoin="round"/>`);
      continue;
    }
    const visible = visibleStraightPoints(object, layout.bounds);
    if (visible) {
      const start = coordinateToSvg(visible[0], layout);
      const end = coordinateToSvg(visible[1], layout);
      const dash =
        object.strokeStyle === "dashed"
          ? ` stroke-dasharray="${n(UNITS_PER_CM * STRAIGHT_DASH_LENGTH_CENTIMETRES)} ${n(UNITS_PER_CM * STRAIGHT_DASH_GAP_CENTIMETRES)}"`
          : "";
      straightOut.push(
        `<line x1="${n(start.x)}" y1="${n(start.y)}" x2="${n(end.x)}" y2="${n(end.y)}"${dash}/>`,
      );
      const arrowEnds = vectorArrowEnds(object, layout.bounds);
      if (arrowEnds) straightOut.push(vectorArrowMarkup(document, object, arrowEnds, layout));
    }
    if (object.gradientTriangle) {
      const triangle = gradientTriangleMarkup(document, object, layout, view);
      straightOut.push(triangle.legs);
      (object.answerOnly ? answerTriangleLabels : triangleLabels).push(triangle.labels);
      answerTriangleLabels.push(triangle.answerLabels);
    }
    if (object.equationVisible && visible) {
      const position = object.equationLabelPosition
        ? coordinateToSvg(object.equationLabelPosition, layout)
        : autoLabelPosition(object, layout);
      labelsOut.push(equationLabelMarkup(equationForObject(object), position.x, position.y));
    }
  }
  const straightObjects = (answerOnly: boolean) =>
    document.objects.filter((o): o is StraightObject => o.kind === "straight" && !!o.answerOnly === answerOnly);
  const pupilLabels = pointLabelsMarkup(document, layout, straightObjects(false));
  const answerPointLabels = pointLabelsMarkup(document, layout, straightObjects(true));
  const lines = `
    <g stroke="#202224" stroke-width="${n(GRID_STROKE_WIDTH)}" stroke-linecap="round" fill="none" clip-path="url(#plot-clip)">${shapes.join("")}${straight.join("")}</g>${
      answerStraight.length || answerShapes.length
        ? `
    <g class="graph-answers" stroke="${GRAPH_ANSWER_COLOUR}" stroke-width="${n(GRID_STROKE_WIDTH)}" stroke-linecap="round" fill="none" clip-path="url(#plot-clip)">${answerShapes.join("")}${answerStraight.join("")}</g>`
        : ""
    }`;
  const marks = `
    <g stroke="#202224" stroke-width="${n(GRID_STROKE_WIDTH)}" stroke-linecap="round" fill="none">${points.join("")}</g>
    <g fill="#202224" font-family="${svgFontFamily(document)}" font-size="${n(EQUATION_FONT_SIZE)}" font-style="italic">${labels.join("")}</g>${
      pupilLabels
        ? `
    <g class="point-labels" fill="#202224" font-family="${svgFontFamily(document)}" font-size="${n(AXIS_LABEL_FONT_SIZE)}">${pupilLabels}</g>`
        : ""
    }${
      triangleLabels.join("")
        ? `
    <g class="gradient-labels" fill="#202224" font-family="${svgFontFamily(document)}" font-size="${n(AXIS_LABEL_FONT_SIZE)}">${triangleLabels.join("")}</g>`
        : ""
    }${
      answerTriangleLabels.join("")
        ? `
    <g class="gradient-labels gradient-labels-answer" fill="${GRAPH_ANSWER_COLOUR}" font-family="${svgFontFamily(document)}" font-size="${n(AXIS_LABEL_FONT_SIZE)}">${answerTriangleLabels.join("")}</g>`
        : ""
    }${answerMarkup(document, answerPoints, answerLabels, answerPointLabels)}${namesMarkup(document, layout)}`;
  const shaded = fills.length ? `
    <g class="graph-polygon-fills" stroke="none" clip-path="url(#plot-fill-clip)">${fills.join("")}</g>` : "";
  return { fills: shaded, lines, marks };
}

/**
 * Region shading, drawn under the grid so its lines stay visible. "wanted" fills the region;
 * "unwanted" fills the grid outside it (even-odd), leaving the answer region clear.
 */
function regionsMarkup(document: DiagramDocumentV1, layout: SvgLayout): string {
  const fills = document.objects.flatMap((object) => {
    if (object.kind !== "region") return [];
    const polygon = regionPolygon(regionHalfPlanes(object), layout.bounds).map((p) => coordinateToSvg(p, layout));
    const ring = (points: Coordinate[]) =>
      points.length ? `M ${points.map((p) => `${n(p.x)} ${n(p.y)}`).join(" L ")} Z` : "";
    const plot = ring([
      { x: layout.plotLeft, y: layout.plotTop },
      { x: layout.plotRight, y: layout.plotTop },
      { x: layout.plotRight, y: layout.plotBottom },
      { x: layout.plotLeft, y: layout.plotBottom },
    ]);
    const d = object.shade === "wanted" ? ring(polygon) : `${plot} ${ring(polygon)}`.trim();
    if (!d) return [];
    const fill = object.answerOnly
      ? `fill="${GRAPH_ANSWER_COLOUR}" fill-opacity="${REGION_ANSWER_OPACITY}"`
      : `fill="${REGION_SHADE}"`;
    return [
      `<path class="graph-region${object.answerOnly ? " graph-region-answer" : ""}" data-object-id="${escapeXml(object.id)}" d="${d}" fill-rule="evenodd" ${fill}/>`,
    ];
  });
  return fills.length ? `<g class="graph-regions" stroke="none">${fills.join("")}</g>` : "";
}

/**
 * Axis numbers sit on small white boxes that hide the grid lines behind them. Over a shaded
 * region a plain white box would stand out, so the shading is repainted inside each box that
 * touches the plot (clipped to the box), keeping the grid hidden and the shade continuous.
 */
function shadeLabelKnockouts(labels: string, document: DiagramDocumentV1, layout: SvgLayout): string {
  const fills = regionsMarkup(document, layout)
    .replace(/ class="graph-region[^"]*"/g, "")
    .replace(/ data-object-id="[^"]*"/g, "")
    .replace(/^<g class="graph-regions"/, '<g aria-hidden="true"');
  if (!fills) return labels;
  let count = 0;
  return labels.replace(
    /(<g class="axis-number[^"]*">)(<rect x="([-\d.]+)" y="([-\d.]+)" width="([\d.]+)" height="([\d.]+)"[^>]*\/>)/g,
    (whole, open: string, rect: string, x: string, y: string, w: string, h: string) => {
      const [left, top, width, height] = [x, y, w, h].map(Number);
      if (left > layout.plotRight || left + width < layout.plotLeft || top > layout.plotBottom || top + height < layout.plotTop) return whole;
      const id = `region-knockout-${++count}`;
      return `${open}${rect}<clipPath id="${id}"><rect x="${x}" y="${y}" width="${w}" height="${h}"/></clipPath><g clip-path="url(#${id})">${fills}</g>`;
    },
  );
}

/** Hidden answers' crosses and labels, drawn only on the answers copy, in the answer colour. */
function answerMarkup(document: DiagramDocumentV1, points: string[], labels: string[], pointLabels: string): string {
  if (!points.length && !labels.length && !pointLabels) return "";
  return `
    <g class="graph-answers" stroke="${GRAPH_ANSWER_COLOUR}" stroke-width="${n(GRID_STROKE_WIDTH)}" stroke-linecap="round" fill="none">${points.join("")}
      <g fill="${GRAPH_ANSWER_COLOUR}" stroke="none" font-family="${svgFontFamily(document)}" font-size="${n(EQUATION_FONT_SIZE)}" font-style="italic">${labels.join("")}</g>${
        pointLabels
          ? `
      <g class="point-labels point-labels-answer" fill="${GRAPH_ANSWER_COLOUR}" stroke="none" font-family="${svgFontFamily(document)}" font-size="${n(AXIS_LABEL_FONT_SIZE)}">${pointLabels}</g>`
          : ""
      }
    </g>`;
}

function gridDescription(document: DiagramDocumentV1): string {
  if (document.grid === "5mm") return "A 5 mm fine grid with heavier 1 cm lines";
  if (document.grid === "2mm") return "A 2 mm fine grid with heavier 1 cm lines";
  if (document.grid === "none") return "Sketch axes with no grid or numbers";
  return "A one centimetre square grid";
}

/**
 * Bold lines (U111): the axes and plotted strokes are 1.5 times as heavy. The grid is drawn
 * separately and keeps its weight; text halos keep theirs, so letters print the same.
 */
function boldInk(markup: string, lines: DiagramDocumentV1["lines"]): string {
  if (lines !== "bold") return markup;
  return markup
    .split(/(<text\b[^>]*>)/)
    .map((part) => (part.startsWith("<text") ? part : boldLines(part, "bold")))
    .join("");
}

export function renderDiagramSvg(document: DiagramDocumentV1, view: GraphView = "pupil"): string {
  document = documentForView(document, view);
  const metrics = getExportMetrics(document);
  const { layout } = metrics;
  const axes = axesMarkup(document, layout);
  const objects = objectsMarkup(document, layout, view);
  const bleed = plotClipBleed(document.lines);
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${n(metrics.widthCm)}cm" height="${n(metrics.heightCm)}cm" viewBox="0 0 ${n(metrics.width)} ${n(metrics.height)}" role="img" aria-labelledby="diagram-title diagram-desc">
  <title id="diagram-title">Coordinate graph</title>
  <desc id="diagram-desc">${gridDescription(document)} containing ${document.objects.length} plotted object${document.objects.length === 1 ? "" : "s"}.</desc>
  <rect width="100%" height="100%" fill="#ffffff"/>
  <defs><clipPath id="plot-clip"><rect x="${n(layout.plotLeft - bleed)}" y="${n(layout.plotTop - bleed)}" width="${n(layout.plotRight - layout.plotLeft + 2 * bleed)}" height="${n(layout.plotBottom - layout.plotTop + 2 * bleed)}"/></clipPath><clipPath id="plot-fill-clip"><rect x="${n(layout.plotLeft)}" y="${n(layout.plotTop)}" width="${n(layout.plotRight - layout.plotLeft)}" height="${n(layout.plotBottom - layout.plotTop)}"/></clipPath></defs>
  ${regionsMarkup(document, layout)}${objects.fills}${gridMarkup(document, layout)}
  ${boldInk(axes.lines, document.lines)}
  ${shadeLabelKnockouts(axes.labels, document, layout)}
  ${boldInk(objects.lines, document.lines)}
  ${boldInk(objects.marks, document.lines)}${coordinatesMarkup(document, layout, view)}
</svg>`;
}

/** Gradient-triangle labels that would print on the axis numbers wherever they go (U76). */
export function gradientLabelClashes(document: DiagramDocumentV1): string[] {
  const { layout } = getExportMetrics(document);
  const bands = axisNumberBands(document, layout, AXIS_LABEL_FONT_SIZE);
  return document.objects.flatMap((object) => {
    if (object.kind !== "straight" || !object.gradientTriangle?.labels) return [];
    const c = gradientTriangleCorners(object);
    if (!c || Math.abs(c.end.y - c.corner.y) < 1e-12 || ![c.start, c.corner, c.end].every((p) => pointInBounds(p, layout.bounds))) return [];
    const [a, b, e] = [c.start, c.corner, c.end].map((p) => coordinateToSvg(p, layout));
    const values = gradientTriangleValues(object)!;
    const blank = object.gradientTriangle.labels === "blank";
    const place = gradientLabelPlacement(a, b, e, layout, AXIS_LABEL_FONT_SIZE, blank ? GRADIENT_BLANK : values.run, blank ? GRADIENT_BLANK : values.rise, bands);
    return place.clash ? [`${object.id}: the gradient triangle's labels sit on the axis numbers. Start the triangle at another x, or use a different run.`] : [];
  });
}
