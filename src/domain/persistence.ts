import { AXIS_LIMITS, cloneDefaultDocument, isAxisConfig, STORAGE_KEY } from "./diagram";
import type { Coordinate, DiagramDocumentV1, GraphObject } from "./types";

function isCoordinate(value: unknown): value is Coordinate {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<Coordinate>;
  return typeof candidate.x === "number" && Number.isFinite(candidate.x)
    && typeof candidate.y === "number" && Number.isFinite(candidate.y);
}

function isGraphObject(value: unknown): value is GraphObject {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<GraphObject> & Record<string, unknown>;
  if (typeof candidate.id !== "string") return false;
  if (candidate.kind === "point") return isCoordinate(candidate.position);
  if (candidate.kind !== "straight") return false;
  return (candidate.display === "segment" || candidate.display === "line")
    && isCoordinate(candidate.start)
    && isCoordinate(candidate.end)
    && typeof candidate.equationVisible === "boolean"
    && (candidate.equationLabelPosition === undefined || isCoordinate(candidate.equationLabelPosition));
}

export function isDiagramDocument(value: unknown): value is DiagramDocumentV1 {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<DiagramDocumentV1>;
  if (candidate.version !== 1 || !candidate.axes || !Array.isArray(candidate.objects)) return false;
  if (!isAxisConfig(candidate.axes.x) || !isAxisConfig(candidate.axes.y)) return false;
  const xTotal = candidate.axes.x.negativeSquares + candidate.axes.x.positiveSquares;
  const yTotal = candidate.axes.y.negativeSquares + candidate.axes.y.positiveSquares;
  if (candidate.axes.x.negativeSquares < 0 || candidate.axes.x.positiveSquares < 0
      || xTotal < AXIS_LIMITS.x.minTotal || xTotal > AXIS_LIMITS.x.maxTotal) return false;
  if (candidate.axes.y.negativeSquares < 0 || candidate.axes.y.positiveSquares < 0
      || yTotal < AXIS_LIMITS.y.minTotal || yTotal > AXIS_LIMITS.y.maxTotal) return false;
  if (!candidate.objects.every(isGraphObject)) return false;
  return candidate.selectedObjectId === null
    || (typeof candidate.selectedObjectId === "string" && candidate.objects.some((object) => object.id === candidate.selectedObjectId));
}

export function loadDiagram(): DiagramDocumentV1 {
  if (typeof localStorage === "undefined") return cloneDefaultDocument();
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return cloneDefaultDocument();
    const parsed: unknown = JSON.parse(saved);
    return isDiagramDocument(parsed) ? parsed : cloneDefaultDocument();
  } catch {
    return cloneDefaultDocument();
  }
}

export function saveDiagram(document: DiagramDocumentV1): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(document));
}

export function clearSavedDiagram(): void {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}
