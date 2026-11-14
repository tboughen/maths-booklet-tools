import { regionProblem } from "./region";
import { LABEL_SIDES, MAX_LABEL_TEXT_LENGTH, OBJECT_NAME_PATTERN } from "./axes";
import { AXIS_LIMITS, isAxisConfig } from "./diagram";
import type { Coordinate, DiagramDocumentV1, GraphObject } from "./types";

function isCoordinate(value: unknown): value is Coordinate {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<Coordinate>;
  return (
    typeof candidate.x === "number" &&
    Number.isFinite(candidate.x) &&
    typeof candidate.y === "number" &&
    Number.isFinite(candidate.y)
  );
}

function isPointLabel(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    Object.keys(candidate).every((key) => key === "at" || key === "text" || key === "side") &&
    isCoordinate(candidate.at) &&
    typeof candidate.text === "string" &&
    candidate.text.length > 0 &&
    candidate.text.length <= MAX_LABEL_TEXT_LENGTH &&
    (candidate.side === undefined || (LABEL_SIDES as readonly unknown[]).includes(candidate.side))
  );
}

function isGraphObject(value: unknown): value is GraphObject {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<GraphObject> & Record<string, unknown>;
  if (typeof candidate.id !== "string") return false;
  if (
    (candidate.name !== undefined &&
      (typeof candidate.name !== "string" || !OBJECT_NAME_PATTERN.test(candidate.name))) ||
    (candidate.namePosition !== undefined && !isCoordinate(candidate.namePosition)) ||
    (candidate.answerOnly !== undefined && candidate.answerOnly !== true)
  )
    return false;
  if (candidate.kind === "point") return isCoordinate(candidate.position);
  if (candidate.kind === "region")
    return (
      Array.isArray(candidate.inequalities) &&
      candidate.inequalities.every((t) => typeof t === "string") &&
      (candidate.shade === "wanted" || candidate.shade === "unwanted") &&
      typeof candidate.boundaries === "boolean" &&
      regionProblem({ inequalities: candidate.inequalities }) === null
    );
  if (candidate.kind !== "straight") return false;
  return (
    (candidate.display === "segment" || candidate.display === "line") &&
    (candidate.strokeStyle === undefined ||
      candidate.strokeStyle === "solid" ||
      candidate.strokeStyle === "dashed") &&
    isCoordinate(candidate.start) &&
    isCoordinate(candidate.end) &&
    typeof candidate.equationVisible === "boolean" &&
    (candidate.equationLabelPosition === undefined ||
      isCoordinate(candidate.equationLabelPosition)) &&
    (candidate.labels === undefined ||
      (Array.isArray(candidate.labels) && candidate.labels.every(isPointLabel)))
  );
}

export function isDiagramDocument(value: unknown): value is DiagramDocumentV1 {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<DiagramDocumentV1>;
  if (
    candidate.version !== 1 ||
    (candidate.styleProfile !== undefined &&
      candidate.styleProfile !== "legacy" &&
      candidate.styleProfile !== "portable-v1") ||
    (candidate.grid !== undefined &&
      candidate.grid !== "1cm" &&
      candidate.grid !== "5mm" &&
      candidate.grid !== "2mm" &&
      candidate.grid !== "none") ||
    (candidate.originLabel !== undefined &&
      candidate.originLabel !== "0" &&
      candidate.originLabel !== "O") ||
    !candidate.axes ||
    !Array.isArray(candidate.objects)
  )
    return false;
  if (!isAxisConfig(candidate.axes.x) || !isAxisConfig(candidate.axes.y))
    return false;
  const xTotal =
    candidate.axes.x.negativeSquares + candidate.axes.x.positiveSquares;
  const yTotal =
    candidate.axes.y.negativeSquares + candidate.axes.y.positiveSquares;
  if (
    candidate.axes.x.negativeSquares < 0 ||
    candidate.axes.x.positiveSquares < 0 ||
    xTotal < AXIS_LIMITS.x.minTotal ||
    xTotal > AXIS_LIMITS.x.maxTotal
  )
    return false;
  if (
    candidate.axes.y.negativeSquares < 0 ||
    candidate.axes.y.positiveSquares < 0 ||
    yTotal < AXIS_LIMITS.y.minTotal ||
    yTotal > AXIS_LIMITS.y.maxTotal
  )
    return false;
  if (!candidate.objects.every(isGraphObject)) return false;
  return (
    candidate.selectedObjectId === null ||
    (typeof candidate.selectedObjectId === "string" &&
      candidate.objects.some(
        (object) => object.id === candidate.selectedObjectId,
      ))
  );
}
