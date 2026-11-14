import { glyphAdvance } from "../../ratio-table-core/src/font-metrics";
import {
  axisOrigin,
  coordinateToSvg,
  getBounds,
  gridDivisions,
  isSketch,
  visibleStraightPoints,
} from "./diagram";
import {
  axisTicks,
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
  AXIS_X_NAME,
  AXIS_Y_NAME,
  EQUATION_FONT_POINTS,
  GRID_STROKE_POINTS,
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
  Coordinate,
  DiagramDocumentV1,
  LabelSide,
  PointLabel,
  GraphObject,
  GraphView,
  StraightObject,
  SvgLayout,
} from "./types";
import { guidance } from "./print-guidance";
import { polygonCentroid, polygonVisible } from "./polygon";

/** Grey inside a shaded shape: light enough for black lines and names to stay clear in print. */
export const POLYGON_SHADE = "#d4d4d4";
/** Shading opacity for a hidden-answer shape, in the answer colour. */
export const POLYGON_ANSWER_SHADE_OPACITY = 0.18;

/** Exam papers print shape names upright, point names italic and line names bold. */
export function nameStyle(object: GraphObject): "bold" | "italic" | "upright" {
  return object.kind === "point" ? "italic" : object.kind === "polygon" ? "upright" : "bold";
}

const UNITS_PER_CM = 100;
const FIXED_PADDING = { right: 75, top: 70 };
const EXPORT_CONTENT_MARGIN = 18;
const POINT_MARK_HALF_SIZE = 14;
/** The answers copy's colour for hidden answers, shared with ratio tables. */
export const GRAPH_ANSWER_COLOUR = "#b0125b";

/** The objects one copy draws: the pupil copy leaves out answer-only objects. */
export function documentForView(document: DiagramDocumentV1, view: GraphView = "pupil"): DiagramDocumentV1 {
  if (view === "answer" || !document.objects.some((o) => o.answerOnly)) return document;
  const objects = document.objects.filter((o) => !o.answerOnly);
  return {
    ...document,
    objects,
    selectedObjectId: objects.some((o) => o.id === document.selectedObjectId) ? document.selectedObjectId : null,
  };
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
const MINOR_GRID_STROKE_POINTS = 0.6;
const MINOR_GRID_STROKE_WIDTH = pointsToDiagramUnits(
  MINOR_GRID_STROKE_POINTS,
  UNITS_PER_CM,
);
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
  const title = document.axes.y.title
    ? wrapTitle(document.axes.y.title, Y_TITLE_MAX_WIDTH)
    : [];
  const titleWidth = Math.max(0, ...title.map((l) => proseWidth(l, AXIS_LABEL_FONT_SIZE)));
  const titleLeft = Math.min(numbersLeft, 0) - TITLE_GAP - titleWidth;
  return { originFromPlotLeft, yNumberFromPlotLeft, title, titleLeft };
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
    yTitle: y.title.length ? { lines: y.title, leftFromPlotLeft: y.titleLeft } : null,
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
  const plotBottom = FIXED_PADDING.top + verticalSquares * UNITS_PER_CM;
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
      plotTop: FIXED_PADDING.top,
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
  const horizontalSquares =
    document.axes.x.negativeSquares + document.axes.x.positiveSquares;
  const verticalSquares =
    document.axes.y.negativeSquares + document.axes.y.positiveSquares;
  const lines: string[] = [];
  for (let index = 0; index <= horizontalSquares; index += 1) {
    const x = layout.plotLeft + index * layout.square;
    lines.push(
      `<line x1="${n(x)}" y1="${n(layout.plotTop)}" x2="${n(x)}" y2="${n(layout.plotBottom)}"/>`,
    );
  }
  for (let index = 0; index <= verticalSquares; index += 1) {
    const y = layout.plotTop + index * layout.square;
    lines.push(
      `<line x1="${n(layout.plotLeft)}" y1="${n(y)}" x2="${n(layout.plotRight)}" y2="${n(y)}"/>`,
    );
  }
  const major = `<g class="grid-lines" stroke="#a9abaa" stroke-width="${n(GRID_STROKE_WIDTH)}" fill="none">${lines.join("")}</g>`;
  const divisions = gridDivisions(document);
  if (divisions === 1) return major;
  // A fine grid: thin lines between the 1 cm lines, drawn first so the 1 cm lines sit on top.
  const minor: string[] = [];
  const step = layout.square / divisions;
  for (let index = 0; index < horizontalSquares * divisions; index += 1) {
    if (index % divisions === 0) continue;
    const x = layout.plotLeft + index * step;
    minor.push(`<line x1="${n(x)}" y1="${n(layout.plotTop)}" x2="${n(x)}" y2="${n(layout.plotBottom)}"/>`);
  }
  for (let index = 0; index < verticalSquares * divisions; index += 1) {
    if (index % divisions === 0) continue;
    const y = layout.plotTop + index * step;
    minor.push(`<line x1="${n(layout.plotLeft)}" y1="${n(y)}" x2="${n(layout.plotRight)}" y2="${n(y)}"/>`);
  }
  return `<g class="grid-lines grid-lines-fine" stroke="#a9abaa" stroke-width="${n(MINOR_GRID_STROKE_WIDTH)}" fill="none">${minor.join("")}</g>
  ${major}`;
}

function originMarkup(document: DiagramDocumentV1, x: number, baseline: number): string {
  if (!sharedOriginLabel(document)) return "";
  if (document.originLabel !== "O")
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
    const first =
      middle - ((y.title.length - 1) * TITLE_LINE_HEIGHT) / 2 + AXIS_LABEL_FONT_SIZE * 0.34;
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
 * The axes in two layers: the axis lines, drawn under every plotted line, and the numbers, names
 * and titles, drawn over plotted lines so a line never runs through a number (its white box
 * breaks the line, as exam papers print them). Points and names are drawn over both.
 */
function axesMarkup(document: DiagramDocumentV1, layout: SvgLayout): { lines: string; labels: string } {
  const origin = coordinateToSvg(axisOrigin(document), layout);
  const xLabels: string[] = [];
  const yLabels: string[] = [];
  const xNumberBaseline = origin.y + xNumberDrop(document);
  const yNumberX = origin.x - UNITS_PER_CM * Y_AXIS_LABEL_GAP_CENTIMETRES;
  const tight = gridDivisions(document) > 1;

  for (const tick of axisTicks(document, "x")) {
    const x = layout.plotLeft + tick.index * layout.square;
    xLabels.push(axisTickLabelMarkup(tick.label, x, xNumberBaseline, "middle", false, tight));
  }
  // Top to bottom, as the y numbers have always been written.
  for (const tick of axisTicks(document, "y").reverse()) {
    const y =
      layout.plotBottom - tick.index * layout.square + AXIS_LABEL_FONT_SIZE * 0.34;
    yLabels.push(axisTickLabelMarkup(tick.label, yNumberX, y, "end", false, tight));
  }

  const originX = origin.x - AXIS_LABEL_FONT_SIZE * 0.38;
  const xName = document.axes.x.title
    ? ""
    : `
      <text class="axis-name axis-name-x" x="${n(layout.plotRight + 48)}" y="${n(xNumberBaseline)}" font-family="${svgFontFamily(document)}">${AXIS_X_NAME}</text>`;
  const yName = document.axes.y.title
    ? ""
    : `
      <text class="axis-name axis-name-y" x="${n(origin.x - UNITS_PER_CM * axisNameYGapCentimetres(document))}" y="${n(layout.plotTop - 30)}" text-anchor="end" font-family="${svgFontFamily(document)}">${AXIS_Y_NAME}</text>`;
  const originLabel = originMarkup(document, originX, xNumberBaseline);
  const lines = `
    <defs>
      <marker id="axis-arrow" viewBox="0 0 10 10" refX="8.5" refY="5" markerUnits="userSpaceOnUse" markerWidth="25" markerHeight="25" orient="auto">
        <path d="M 0 0 L 10 5 L 0 10 z" fill="#1f2224"/>
      </marker>
    </defs>
    <g class="graph-axes" stroke="#1f2224" stroke-width="${n(AXIS_STROKE_WIDTH)}" fill="none">
      <line x1="${n(layout.plotLeft)}" y1="${n(origin.y)}" x2="${n(layout.plotRight + AXIS_ARROW_EXTENSION)}" y2="${n(origin.y)}" marker-end="url(#axis-arrow)"/>
      <line x1="${n(origin.x)}" y1="${n(layout.plotBottom)}" x2="${n(origin.x)}" y2="${n(layout.plotTop - AXIS_ARROW_EXTENSION)}" marker-end="url(#axis-arrow)"/>
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

/**
 * Where a name sits automatically, as the centre of its box in SVG units. Points: up and to the
 * right of the cross. Lines: near the upper end, on the right of the line (above a horizontal
 * one). The box is kept inside the plot.
 */
function autoNameCentre(object: Named, layout: SvgLayout, unitsPerCm: number): Coordinate {
  const box = nameBox(object.name, AXIS_LABEL_FONT_SIZE * (unitsPerCm / UNITS_PER_CM));
  let centre: Coordinate;
  if (object.kind === "point") {
    const p = coordinateToSvg(object.position, layout);
    const dx = 0.18 * unitsPerCm + box.width / 2;
    const dy = 0.16 * unitsPerCm + box.height / 2;
    const right = p.x + dx + box.width / 2 <= layout.plotRight;
    const up = p.y - dy - box.height / 2 >= layout.plotTop;
    centre = { x: right ? p.x + dx : p.x - dx, y: up ? p.y - dy : p.y + dy };
  } else if (object.kind === "polygon") {
    centre = coordinateToSvg(polygonCentroid(object.vertices), layout);
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
export function nameCentre(object: GraphObject, layout: SvgLayout, unitsPerCm = UNITS_PER_CM): Coordinate | null {
  if (!object.name) return null;
  const box = nameBox(object.name, AXIS_LABEL_FONT_SIZE * (unitsPerCm / UNITS_PER_CM));
  const centre = object.namePosition
    ? coordinateToSvg(object.namePosition, layout)
    : autoNameCentre(object as Named, layout, unitsPerCm);
  return {
    x: Math.min(layout.plotRight - box.width / 2, Math.max(layout.plotLeft + box.width / 2, centre.x)),
    y: Math.min(layout.plotBottom - box.height / 2, Math.max(layout.plotTop + box.height / 2, centre.y)),
  };
}

function namesMarkup(document: DiagramDocumentV1, layout: SvgLayout): string {
  const names = visibleNames(document, layout);
  if (!names.length) return "";
  const marks = names.map((object) => {
    const style = nameStyle(object);
    const parts = nameParts(object.name);
    const box = nameBox(object.name);
    const centre = nameCentre(object, layout)!;
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

function objectsMarkup(document: DiagramDocumentV1, layout: SvgLayout): { lines: string; marks: string } {
  const straight: string[] = [];
  const points: string[] = [];
  const labels: string[] = [];
  const answerStraight: string[] = [];
  const answerPoints: string[] = [];
  const answerLabels: string[] = [];
  for (const object of document.objects) {
    const [straightOut, pointsOut, labelsOut] = object.answerOnly
      ? [answerStraight, answerPoints, answerLabels]
      : [straight, points, labels];
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
      const fill = !object.shaded
        ? ""
        : object.answerOnly
          ? ` fill="${GRAPH_ANSWER_COLOUR}" fill-opacity="${POLYGON_ANSWER_SHADE_OPACITY}"`
          : ` fill="${POLYGON_SHADE}"`;
      straightOut.push(`<polygon class="graph-polygon" data-object-id="${escapeXml(object.id)}" points="${points}" stroke-linejoin="round"${fill}/>`);
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
    <g stroke="#202224" stroke-width="${n(GRID_STROKE_WIDTH)}" stroke-linecap="round" fill="none" clip-path="url(#plot-clip)">${straight.join("")}</g>${
      answerStraight.length
        ? `
    <g class="graph-answers" stroke="${GRAPH_ANSWER_COLOUR}" stroke-width="${n(GRID_STROKE_WIDTH)}" stroke-linecap="round" fill="none" clip-path="url(#plot-clip)">${answerStraight.join("")}</g>`
        : ""
    }`;
  const marks = `
    <g stroke="#202224" stroke-width="${n(GRID_STROKE_WIDTH)}" stroke-linecap="round" fill="none">${points.join("")}</g>
    <g fill="#202224" font-family="${svgFontFamily(document)}" font-size="${n(EQUATION_FONT_SIZE)}" font-style="italic">${labels.join("")}</g>${
      pupilLabels
        ? `
    <g class="point-labels" fill="#202224" font-family="${svgFontFamily(document)}" font-size="${n(AXIS_LABEL_FONT_SIZE)}">${pupilLabels}</g>`
        : ""
    }${answerMarkup(document, answerPoints, answerLabels, answerPointLabels)}${namesMarkup(document, layout)}`;
  return { lines, marks };
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

export function renderDiagramSvg(document: DiagramDocumentV1, view: GraphView = "pupil"): string {
  document = documentForView(document, view);
  const metrics = getExportMetrics(document);
  const { layout } = metrics;
  const axes = axesMarkup(document, layout);
  const objects = objectsMarkup(document, layout);
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${n(metrics.widthCm)}cm" height="${n(metrics.heightCm)}cm" viewBox="0 0 ${n(metrics.width)} ${n(metrics.height)}" role="img" aria-labelledby="diagram-title diagram-desc">
  <title id="diagram-title">Coordinate graph</title>
  <desc id="diagram-desc">${gridDescription(document)} containing ${document.objects.length} plotted object${document.objects.length === 1 ? "" : "s"}.</desc>
  <rect width="100%" height="100%" fill="#ffffff"/>
  <defs><clipPath id="plot-clip"><rect x="${n(layout.plotLeft)}" y="${n(layout.plotTop)}" width="${n(layout.plotRight - layout.plotLeft)}" height="${n(layout.plotBottom - layout.plotTop)}"/></clipPath></defs>
  ${gridMarkup(document, layout)}
  ${axes.lines}
  ${objects.lines}
  ${axes.labels}
  ${objects.marks}
</svg>`;
}
