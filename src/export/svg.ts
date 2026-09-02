import {
  coordinateToSvg,
  getBounds,
  tickLabelEvery,
  visibleStraightPoints,
} from "../domain/diagram";
import { equationForObject, formatNumber } from "../domain/equations";
import {
  AXIS_LABEL_FONT_POINTS,
  AXIS_STROKE_POINTS,
  AXIS_X_NAME,
  AXIS_Y_NAME,
  EQUATION_FONT_POINTS,
  GRID_STROKE_POINTS,
  SVG_MATHS_FONT_FAMILY,
  Y_AXIS_LABEL_GAP_CENTIMETRES,
  axisLabelBoxHeight,
  axisLabelBoxWidth,
  pointsToDiagramUnits,
} from "../domain/graphStyle";
import type { Coordinate, DiagramDocumentV1, StraightObject, SvgLayout } from "../domain/types";

const UNITS_PER_CM = 100;
const PADDING = { left: 95, right: 75, top: 70, bottom: 85 };
const GRID_STROKE_WIDTH = pointsToDiagramUnits(GRID_STROKE_POINTS, UNITS_PER_CM);
const AXIS_STROKE_WIDTH = pointsToDiagramUnits(AXIS_STROKE_POINTS, UNITS_PER_CM);
const AXIS_LABEL_FONT_SIZE = pointsToDiagramUnits(AXIS_LABEL_FONT_POINTS, UNITS_PER_CM);
const EQUATION_FONT_SIZE = pointsToDiagramUnits(EQUATION_FONT_POINTS, UNITS_PER_CM);

export interface ExportMetrics {
  widthCm: number;
  heightCm: number;
  width: number;
  height: number;
  layout: SvgLayout;
}

export function getExportMetrics(document: DiagramDocumentV1): ExportMetrics {
  const horizontalSquares = document.axes.x.negativeSquares + document.axes.x.positiveSquares;
  const verticalSquares = document.axes.y.negativeSquares + document.axes.y.positiveSquares;
  const plotRight = PADDING.left + horizontalSquares * UNITS_PER_CM;
  const plotBottom = PADDING.top + verticalSquares * UNITS_PER_CM;
  const width = plotRight + PADDING.right;
  const height = plotBottom + PADDING.bottom;
  return {
    widthCm: width / UNITS_PER_CM,
    heightCm: height / UNITS_PER_CM,
    width,
    height,
    layout: {
      width,
      height,
      plotLeft: PADDING.left,
      plotTop: PADDING.top,
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
): string {
  const width = axisLabelBoxWidth(label, AXIS_LABEL_FONT_SIZE);
  const height = axisLabelBoxHeight(AXIS_LABEL_FONT_SIZE);
  const rectX = textAnchor === "middle" ? x - width / 2 : textAnchor === "end" ? x - width : x;
  const rectY = baseline - AXIS_LABEL_FONT_SIZE * 0.82;
  const className = origin ? "axis-number axis-number-origin" : "axis-number";
  const originTransform = origin
    ? ` transform="translate(${n(x)} ${n(baseline)}) skewX(-12) translate(${n(-x)} ${n(-baseline)})"`
    : "";
  return `<g class="${className}"><rect x="${n(rectX)}" y="${n(rectY)}" width="${n(width)}" height="${n(height)}" rx="${n(AXIS_LABEL_FONT_SIZE * 0.05)}" fill="#ffffff"/><text x="${n(x)}" y="${n(baseline)}" text-anchor="${textAnchor}"${originTransform}>${escapeXml(label)}</text></g>`;
}

function autoLabelPosition(object: StraightObject, layout: SvgLayout): Coordinate {
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
  const horizontalSquares = document.axes.x.negativeSquares + document.axes.x.positiveSquares;
  const verticalSquares = document.axes.y.negativeSquares + document.axes.y.positiveSquares;
  const lines: string[] = [];
  for (let index = 0; index <= horizontalSquares; index += 1) {
    const x = layout.plotLeft + index * layout.square;
    lines.push(`<line x1="${n(x)}" y1="${n(layout.plotTop)}" x2="${n(x)}" y2="${n(layout.plotBottom)}"/>`);
  }
  for (let index = 0; index <= verticalSquares; index += 1) {
    const y = layout.plotTop + index * layout.square;
    lines.push(`<line x1="${n(layout.plotLeft)}" y1="${n(y)}" x2="${n(layout.plotRight)}" y2="${n(y)}"/>`);
  }
  return `<g class="grid-lines" stroke="#a9abaa" stroke-width="${n(GRID_STROKE_WIDTH)}" fill="none">${lines.join("")}</g>`;
}

function axesMarkup(document: DiagramDocumentV1, layout: SvgLayout): string {
  const origin = coordinateToSvg({ x: 0, y: 0 }, layout);
  const xLabels: string[] = [];
  const yLabels: string[] = [];
  const xTotal = document.axes.x.negativeSquares + document.axes.x.positiveSquares;
  const yTotal = document.axes.y.negativeSquares + document.axes.y.positiveSquares;
  const xEvery = tickLabelEvery(document.axes.x.unitsPerSquare);
  const yEvery = tickLabelEvery(document.axes.y.unitsPerSquare);
  const xNumberBaseline = origin.y + AXIS_LABEL_FONT_SIZE * 1.08;
  const yNumberX = origin.x - UNITS_PER_CM * Y_AXIS_LABEL_GAP_CENTIMETRES;

  for (let index = 0; index <= xTotal; index += 1) {
    if (index % xEvery !== 0) continue;
    const value = (index - document.axes.x.negativeSquares) * document.axes.x.unitsPerSquare;
    if (Math.abs(value) < 1e-9) continue;
    const x = layout.plotLeft + index * layout.square;
    xLabels.push(axisTickLabelMarkup(formatNumber(value), x, xNumberBaseline));
  }
  for (let index = 0; index <= yTotal; index += 1) {
    if (index % yEvery !== 0) continue;
    const value = (document.axes.y.positiveSquares - index) * document.axes.y.unitsPerSquare;
    if (Math.abs(value) < 1e-9) continue;
    const y = layout.plotTop + index * layout.square + AXIS_LABEL_FONT_SIZE * 0.34;
    yLabels.push(axisTickLabelMarkup(formatNumber(value), yNumberX, y, "end"));
  }

  const originX = origin.x - AXIS_LABEL_FONT_SIZE * 0.38;
  return `
    <defs>
      <marker id="axis-arrow" viewBox="0 0 10 10" refX="8.5" refY="5" markerUnits="userSpaceOnUse" markerWidth="25" markerHeight="25" orient="auto-start-reverse">
        <path d="M 0 0 L 10 5 L 0 10 z" fill="#1f2224"/>
      </marker>
    </defs>
    <g class="graph-axes" stroke="#1f2224" stroke-width="${n(AXIS_STROKE_WIDTH)}" fill="none">
      <line x1="${n(layout.plotLeft)}" y1="${n(origin.y)}" x2="${n(layout.plotRight + 15)}" y2="${n(origin.y)}" marker-end="url(#axis-arrow)"/>
      <line x1="${n(origin.x)}" y1="${n(layout.plotBottom)}" x2="${n(origin.x)}" y2="${n(layout.plotTop - 15)}" marker-end="url(#axis-arrow)"/>
    </g>
    <g class="axis-labels" fill="#242628" font-family="${SVG_MATHS_FONT_FAMILY}" font-size="${n(AXIS_LABEL_FONT_SIZE)}">
      ${xLabels.join("")}${yLabels.join("")}
      ${axisTickLabelMarkup("0", originX, xNumberBaseline, "end", true)}
      <text class="axis-name axis-name-x" x="${n(layout.plotRight + 48)}" y="${n(xNumberBaseline)}" font-family="${SVG_MATHS_FONT_FAMILY}">${AXIS_X_NAME}</text>
      <text class="axis-name axis-name-y" x="${n(yNumberX)}" y="${n(layout.plotTop - 30)}" text-anchor="end" font-family="${SVG_MATHS_FONT_FAMILY}">${AXIS_Y_NAME}</text>
    </g>`;
}

function objectsMarkup(document: DiagramDocumentV1, layout: SvgLayout): string {
  const straight: string[] = [];
  const points: string[] = [];
  const labels: string[] = [];
  for (const object of document.objects) {
    if (object.kind === "point") {
      const point = coordinateToSvg(object.position, layout);
      if (object.position.x < layout.bounds.xMin || object.position.x > layout.bounds.xMax
          || object.position.y < layout.bounds.yMin || object.position.y > layout.bounds.yMax) continue;
      const size = 14;
      points.push(`<path d="M ${n(point.x - size)} ${n(point.y - size)} L ${n(point.x + size)} ${n(point.y + size)} M ${n(point.x - size)} ${n(point.y + size)} L ${n(point.x + size)} ${n(point.y - size)}"/>`);
      continue;
    }
    const visible = visibleStraightPoints(object, layout.bounds);
    if (visible) {
      const start = coordinateToSvg(visible[0], layout);
      const end = coordinateToSvg(visible[1], layout);
      straight.push(`<line x1="${n(start.x)}" y1="${n(start.y)}" x2="${n(end.x)}" y2="${n(end.y)}"/>`);
    }
    if (object.equationVisible && visible) {
      const position = object.equationLabelPosition
        ? coordinateToSvg(object.equationLabelPosition, layout)
        : autoLabelPosition(object, layout);
      labels.push(`<text x="${n(position.x)}" y="${n(position.y)}">${escapeXml(equationForObject(object))}</text>`);
    }
  }
  return `
    <g stroke="#202224" stroke-width="${n(GRID_STROKE_WIDTH)}" stroke-linecap="round" fill="none" clip-path="url(#plot-clip)">${straight.join("")}</g>
    <g stroke="#202224" stroke-width="${n(GRID_STROKE_WIDTH)}" stroke-linecap="round" fill="none">${points.join("")}</g>
    <g fill="#202224" font-family="${SVG_MATHS_FONT_FAMILY}" font-size="${n(EQUATION_FONT_SIZE)}" font-style="italic">${labels.join("")}</g>`;
}

export function renderDiagramSvg(document: DiagramDocumentV1): string {
  const metrics = getExportMetrics(document);
  const { layout } = metrics;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${n(metrics.widthCm)}cm" height="${n(metrics.heightCm)}cm" viewBox="0 0 ${n(metrics.width)} ${n(metrics.height)}" role="img" aria-labelledby="diagram-title diagram-desc">
  <title id="diagram-title">Coordinate graph</title>
  <desc id="diagram-desc">A one centimetre square grid containing ${document.objects.length} plotted object${document.objects.length === 1 ? "" : "s"}.</desc>
  <rect width="100%" height="100%" fill="#ffffff"/>
  <defs><clipPath id="plot-clip"><rect x="${n(layout.plotLeft)}" y="${n(layout.plotTop)}" width="${n(layout.plotRight - layout.plotLeft)}" height="${n(layout.plotBottom - layout.plotTop)}"/></clipPath></defs>
  ${gridMarkup(document, layout)}
  ${axesMarkup(document, layout)}
  ${objectsMarkup(document, layout)}
</svg>`;
}
