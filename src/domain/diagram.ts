import type {
  AxisConfig,
  Bounds,
  Coordinate,
  DiagramDocumentV1,
  GraphObject,
  StraightObject,
  SvgLayout,
  UnitsPerSquare,
} from "./types";

export const DEFAULT_DOCUMENT: DiagramDocumentV1 = {
  version: 1,
  axes: {
    x: { negativeSquares: 5, positiveSquares: 5, unitsPerSquare: 1 },
    y: { negativeSquares: 5, positiveSquares: 5, unitsPerSquare: 1 },
  },
  objects: [],
  selectedObjectId: null,
};

export const AXIS_LIMITS = {
  x: { minTotal: 2, maxTotal: 18 },
  y: { minTotal: 2, maxTotal: 26 },
} as const;

export const STORAGE_KEY = "maths-booklet-tools:graph-1cm:v1";
export const HISTORY_LIMIT = 50;

export function cloneDefaultDocument(): DiagramDocumentV1 {
  return structuredClone(DEFAULT_DOCUMENT);
}

export function makeId(prefix: "point" | "straight" = "straight"): string {
  const suffix = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${suffix}`;
}

export function getBounds(document: DiagramDocumentV1): Bounds {
  return {
    xMin: -document.axes.x.negativeSquares * document.axes.x.unitsPerSquare,
    xMax: document.axes.x.positiveSquares * document.axes.x.unitsPerSquare,
    yMin: -document.axes.y.negativeSquares * document.axes.y.unitsPerSquare,
    yMax: document.axes.y.positiveSquares * document.axes.y.unitsPerSquare,
  };
}

export function createEditorLayout(document: DiagramDocumentV1): SvgLayout {
  const square = 60;
  const horizontalSquares = document.axes.x.negativeSquares + document.axes.x.positiveSquares;
  const verticalSquares = document.axes.y.negativeSquares + document.axes.y.positiveSquares;
  const plotLeft = 148;
  const plotTop = 120;
  const plotRight = plotLeft + horizontalSquares * square;
  const plotBottom = plotTop + verticalSquares * square;
  return {
    width: plotRight + 172,
    height: plotBottom + 112,
    plotLeft,
    plotTop,
    plotRight,
    plotBottom,
    square,
    bounds: getBounds(document),
  };
}

export function coordinateToSvg(point: Coordinate, layout: SvgLayout): Coordinate {
  const { bounds } = layout;
  return {
    x: layout.plotLeft + ((point.x - bounds.xMin) / (bounds.xMax - bounds.xMin)) * (layout.plotRight - layout.plotLeft),
    y: layout.plotTop + ((bounds.yMax - point.y) / (bounds.yMax - bounds.yMin)) * (layout.plotBottom - layout.plotTop),
  };
}

export function svgToCoordinate(point: Coordinate, layout: SvgLayout): Coordinate {
  const { bounds } = layout;
  return {
    x: bounds.xMin + ((point.x - layout.plotLeft) / (layout.plotRight - layout.plotLeft)) * (bounds.xMax - bounds.xMin),
    y: bounds.yMax - ((point.y - layout.plotTop) / (layout.plotBottom - layout.plotTop)) * (bounds.yMax - bounds.yMin),
  };
}

export function clampToBounds(point: Coordinate, bounds: Bounds): Coordinate {
  return {
    x: Math.min(bounds.xMax, Math.max(bounds.xMin, point.x)),
    y: Math.min(bounds.yMax, Math.max(bounds.yMin, point.y)),
  };
}

export function snapCoordinate(
  point: Coordinate,
  xScale: UnitsPerSquare,
  yScale: UnitsPerSquare,
): Coordinate {
  const xStep = xScale / 2;
  const yStep = yScale / 2;
  return {
    x: cleanNumber(Math.round(point.x / xStep) * xStep),
    y: cleanNumber(Math.round(point.y / yStep) * yStep),
  };
}

export function cleanNumber(value: number): number {
  if (Math.abs(value) < 1e-10) return 0;
  return Number(value.toFixed(10));
}

export function adjustAxis(
  document: DiagramDocumentV1,
  axis: "x" | "y",
  end: "negative" | "positive",
  delta: -1 | 1,
): DiagramDocumentV1 {
  const current = document.axes[axis];
  const total = current.negativeSquares + current.positiveSquares;
  const limits = AXIS_LIMITS[axis];
  if ((delta < 0 && total <= limits.minTotal) || (delta > 0 && total >= limits.maxTotal)) {
    return document;
  }
  const key = end === "negative" ? "negativeSquares" : "positiveSquares";
  if (delta < 0 && current[key] === 0) return document;
  return {
    ...document,
    axes: {
      ...document.axes,
      [axis]: { ...current, [key]: current[key] + delta },
    },
  };
}

export function setAxisScale(
  document: DiagramDocumentV1,
  axis: "x" | "y",
  unitsPerSquare: UnitsPerSquare,
): DiagramDocumentV1 {
  return {
    ...document,
    axes: {
      ...document.axes,
      [axis]: { ...document.axes[axis], unitsPerSquare },
    },
  };
}

export function updateObject(document: DiagramDocumentV1, object: GraphObject): DiagramDocumentV1 {
  return {
    ...document,
    objects: document.objects.map((candidate) => candidate.id === object.id ? object : candidate),
  };
}

export function deleteSelectedObject(document: DiagramDocumentV1): DiagramDocumentV1 {
  if (!document.selectedObjectId) return document;
  return {
    ...document,
    objects: document.objects.filter((object) => object.id !== document.selectedObjectId),
    selectedObjectId: null,
  };
}

export function getSelectedObject(document: DiagramDocumentV1): GraphObject | undefined {
  return document.objects.find((object) => object.id === document.selectedObjectId);
}

export function getObjectById(document: DiagramDocumentV1, id: string): GraphObject | undefined {
  return document.objects.find((object) => object.id === id);
}

export function pointInBounds(point: Coordinate, bounds: Bounds): boolean {
  const epsilon = 1e-8;
  return point.x >= bounds.xMin - epsilon && point.x <= bounds.xMax + epsilon
    && point.y >= bounds.yMin - epsilon && point.y <= bounds.yMax + epsilon;
}

function deduplicatePoints(points: Coordinate[]): Coordinate[] {
  return points.filter((point, index) => points.findIndex((candidate) => (
    Math.abs(candidate.x - point.x) < 1e-8 && Math.abs(candidate.y - point.y) < 1e-8
  )) === index);
}

export function clipInfiniteLine(start: Coordinate, end: Coordinate, bounds: Bounds): [Coordinate, Coordinate] | null {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (Math.abs(dx) < 1e-10 && Math.abs(dy) < 1e-10) return null;
  const candidates: Coordinate[] = [];

  if (Math.abs(dx) > 1e-10) {
    for (const x of [bounds.xMin, bounds.xMax]) {
      const t = (x - start.x) / dx;
      const y = start.y + t * dy;
      if (y >= bounds.yMin - 1e-8 && y <= bounds.yMax + 1e-8) candidates.push({ x, y: cleanNumber(y) });
    }
  }
  if (Math.abs(dy) > 1e-10) {
    for (const y of [bounds.yMin, bounds.yMax]) {
      const t = (y - start.y) / dy;
      const x = start.x + t * dx;
      if (x >= bounds.xMin - 1e-8 && x <= bounds.xMax + 1e-8) candidates.push({ x: cleanNumber(x), y });
    }
  }

  const unique = deduplicatePoints(candidates);
  if (unique.length < 2) return null;
  let pair: [Coordinate, Coordinate] = [unique[0], unique[1]];
  let maximum = -1;
  for (let first = 0; first < unique.length; first += 1) {
    for (let second = first + 1; second < unique.length; second += 1) {
      const distance = squaredDistance(unique[first], unique[second]);
      if (distance > maximum) {
        maximum = distance;
        pair = [unique[first], unique[second]];
      }
    }
  }
  return pair;
}

export function clipSegment(start: Coordinate, end: Coordinate, bounds: Bounds): [Coordinate, Coordinate] | null {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const p = [-dx, dx, -dy, dy];
  const q = [start.x - bounds.xMin, bounds.xMax - start.x, start.y - bounds.yMin, bounds.yMax - start.y];
  let lower = 0;
  let upper = 1;
  for (let index = 0; index < 4; index += 1) {
    if (Math.abs(p[index]) < 1e-10) {
      if (q[index] < 0) return null;
      continue;
    }
    const ratio = q[index] / p[index];
    if (p[index] < 0) lower = Math.max(lower, ratio);
    else upper = Math.min(upper, ratio);
    if (lower > upper) return null;
  }
  return [
    { x: cleanNumber(start.x + lower * dx), y: cleanNumber(start.y + lower * dy) },
    { x: cleanNumber(start.x + upper * dx), y: cleanNumber(start.y + upper * dy) },
  ];
}

export function visibleStraightPoints(object: StraightObject, bounds: Bounds): [Coordinate, Coordinate] | null {
  return object.display === "line"
    ? clipInfiniteLine(object.start, object.end, bounds)
    : clipSegment(object.start, object.end, bounds);
}

export function squaredDistance(first: Coordinate, second: Coordinate): number {
  return (first.x - second.x) ** 2 + (first.y - second.y) ** 2;
}

export function pointToSegmentDistance(point: Coordinate, start: Coordinate, end: Coordinate): number {
  const lengthSquared = squaredDistance(start, end);
  if (lengthSquared === 0) return Math.sqrt(squaredDistance(point, start));
  const t = Math.max(0, Math.min(1,
    ((point.x - start.x) * (end.x - start.x) + (point.y - start.y) * (end.y - start.y)) / lengthSquared,
  ));
  const projection = { x: start.x + t * (end.x - start.x), y: start.y + t * (end.y - start.y) };
  return Math.sqrt(squaredDistance(point, projection));
}

export function tickLabelEvery(scale: UnitsPerSquare): number {
  return scale === 0.5 ? 2 : 1;
}

export function isAxisConfig(value: unknown): value is AxisConfig {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<AxisConfig>;
  return Number.isInteger(candidate.negativeSquares)
    && Number.isInteger(candidate.positiveSquares)
    && (candidate.unitsPerSquare === 0.5 || candidate.unitsPerSquare === 1 || candidate.unitsPerSquare === 2);
}
