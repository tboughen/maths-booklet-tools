import {
  coordinateToSvg,
  getBounds,
  tickLabelEvery,
  visibleStraightPoints,
} from "../domain/diagram";
import { equationForObject, formatNumber } from "../domain/equations";
import type { Coordinate, DiagramDocumentV1, StraightObject, SvgLayout } from "../domain/types";

const UNITS_PER_CM = 100;
const PADDING = { left: 95, right: 75, top: 70, bottom: 85 };

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
  return `<g stroke="#bfc1c0" stroke-width="1.4" fill="none">${lines.join("")}</g>`;
}

function axesMarkup(document: DiagramDocumentV1, layout: SvgLayout): string {
  const origin = coordinateToSvg({ x: 0, y: 0 }, layout);
  const xLabels: string[] = [];
  const yLabels: string[] = [];
  const xTotal = document.axes.x.negativeSquares + document.axes.x.positiveSquares;
  const yTotal = document.axes.y.negativeSquares + document.axes.y.positiveSquares;
  const xEvery = tickLabelEvery(document.axes.x.unitsPerSquare);
  const yEvery = tickLabelEvery(document.axes.y.unitsPerSquare);

  for (let index = 0; index <= xTotal; index += 1) {
    if (index % xEvery !== 0) continue;
    const value = (index - document.axes.x.negativeSquares) * document.axes.x.unitsPerSquare;
    if (Math.abs(value) < 1e-9) continue;
    const x = layout.plotLeft + index * layout.square;
    const y = Math.min(layout.plotBottom + 34, Math.max(layout.plotTop + 30, origin.y + 34));
    xLabels.push(`<text x="${n(x)}" y="${n(y)}" text-anchor="middle">${escapeXml(formatNumber(value))}</text>`);
  }
  for (let index = 0; index <= yTotal; index += 1) {
    if (index % yEvery !== 0) continue;
    const value = (document.axes.y.positiveSquares - index) * document.axes.y.unitsPerSquare;
    if (Math.abs(value) < 1e-9) continue;
    const x = Math.min(layout.plotRight - 14, Math.max(layout.plotLeft + 14, origin.x - 16));
    const y = layout.plotTop + index * layout.square + 9;
    yLabels.push(`<text x="${n(x)}" y="${n(y)}" text-anchor="end">${escapeXml(formatNumber(value))}</text>`);
  }

  const originX = Math.min(layout.plotRight - 14, Math.max(layout.plotLeft + 14, origin.x - 13));
  const originY = Math.min(layout.plotBottom - 10, Math.max(layout.plotTop + 27, origin.y + 28));
  return `
    <defs>
      <marker id="axis-arrow" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
        <path d="M 0 0 L 10 5 L 0 10 z" fill="#1f2224"/>
      </marker>
    </defs>
    <g stroke="#1f2224" stroke-width="2.7" fill="none">
      <line x1="${n(layout.plotLeft)}" y1="${n(origin.y)}" x2="${n(layout.plotRight + 15)}" y2="${n(origin.y)}" marker-end="url(#axis-arrow)"/>
      <line x1="${n(origin.x)}" y1="${n(layout.plotBottom)}" x2="${n(origin.x)}" y2="${n(layout.plotTop - 15)}" marker-end="url(#axis-arrow)"/>
    </g>
    <g fill="#242628" font-family="Arial, Helvetica, sans-serif" font-size="27">
      ${xLabels.join("")}${yLabels.join("")}
      <text x="${n(originX)}" y="${n(originY)}" text-anchor="end">0</text>
      <text x="${n(layout.plotRight + 35)}" y="${n(origin.y + 10)}" font-style="italic" font-size="31">x</text>
      <text x="${n(origin.x + 13)}" y="${n(layout.plotTop - 28)}" font-style="italic" font-size="31">y</text>
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
    <g stroke="#202224" stroke-width="3.2" stroke-linecap="round" fill="none" clip-path="url(#plot-clip)">${straight.join("")}</g>
    <g stroke="#202224" stroke-width="3" stroke-linecap="round" fill="none">${points.join("")}</g>
    <g fill="#202224" font-family="Arial, Helvetica, sans-serif" font-size="31" font-style="italic">${labels.join("")}</g>`;
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
