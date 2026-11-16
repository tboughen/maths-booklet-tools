import { regionProblem } from "./region";
import { curveProblem } from "./curve";
import { functionProblem } from "./function";
import { LABEL_SIDES, MAX_LABEL_TEXT_LENGTH, OBJECT_NAME_PATTERN } from "./axes";
import { AXIS_LIMITS, isAxisConfig } from "./diagram";
import type { Coordinate, DiagramDocumentV1, FunctionEquation, GraphObject } from "./types";

function isGradientTriangle(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const t = value as Record<string, unknown>;
  return (
    Object.keys(t).every((key) => key === "x" || key === "run" || key === "labels") &&
    typeof t.x === "number" && Number.isFinite(t.x) &&
    typeof t.run === "number" && Number.isFinite(t.run) && t.run !== 0 &&
    (t.labels === undefined || t.labels === "values" || t.labels === "blank")
  );
}

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

/** The saved equation of an equation curve: exactly its family's keys, all finite numbers. */
function isFunctionEquation(value: unknown): value is FunctionEquation {
  if (!value || typeof value !== "object") return false;
  const e = value as Record<string, unknown>;
  const keys: Record<string, string[]> = {
    polynomial: ["a", "b", "c"],
    reciprocal: ["k", "c"],
    exponential: ["coefficient", "base", "c"],
    trig: ["amplitude", "multiplier", "shift", "c"],
  };
  const required = typeof e.family === "string" && Object.hasOwn(keys, e.family) ? keys[e.family] : undefined;
  if (!required) return false;
  const optional = e.family === "polynomial" ? ["cubic"] : e.family === "trig" ? ["fn"] : [];
  if (e.family === "trig" && e.fn !== "sin" && e.fn !== "cos" && e.fn !== "tan") return false;
  if (!Object.keys(e).every((k) => k === "family" || required.includes(k) || optional.includes(k))) return false;
  const numbers = [...required, ...(e.cubic !== undefined ? ["cubic"] : [])];
  if (!numbers.every((k) => typeof e[k] === "number" && Number.isFinite(e[k]))) return false;
  return functionProblem(e as unknown as FunctionEquation) === null;
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
  if (candidate.kind === "curve")
    return (
      Array.isArray(candidate.points) &&
      candidate.points.length >= 2 &&
      candidate.points.length <= 40 &&
      candidate.points.every(isCoordinate) &&
      (candidate.smooth === undefined || candidate.smooth === true) &&
      (candidate.strokeStyle === undefined || candidate.strokeStyle === "dashed") &&
      curveProblem(candidate.points) === null
    );
  if (candidate.kind === "function")
    return (
      Object.keys(candidate).every((key) => ["id", "kind", "equation", "from", "to", "strokeStyle", "name", "namePosition", "answerOnly"].includes(key)) &&
      isFunctionEquation(candidate.equation) &&
      (candidate.from === undefined || (typeof candidate.from === "number" && Number.isFinite(candidate.from))) &&
      (candidate.to === undefined || (typeof candidate.to === "number" && Number.isFinite(candidate.to))) &&
      (candidate.from === undefined || candidate.to === undefined || candidate.to > candidate.from) &&
      (candidate.strokeStyle === undefined || candidate.strokeStyle === "dashed")
    );
  if (candidate.kind === "circle")
    return (
      Object.keys(candidate).every((key) => ["id", "kind", "centre", "radius", "strokeStyle", "name", "namePosition", "answerOnly"].includes(key)) &&
      isCoordinate(candidate.centre) &&
      typeof candidate.radius === "number" && Number.isFinite(candidate.radius) && candidate.radius > 0 &&
      (candidate.strokeStyle === undefined || candidate.strokeStyle === "dashed")
    );
  if (candidate.kind === "reading")
    return (
      Object.keys(candidate).every((key) => ["id", "kind", "at", "read", "answerOnly"].includes(key)) &&
      isCoordinate(candidate.at) &&
      (candidate.read === "x" || candidate.read === "y" || candidate.read === "both")
    );
  if (candidate.kind === "point")
    return (
      isCoordinate(candidate.position) &&
      (candidate.coordinates === undefined || candidate.coordinates === "show" || candidate.coordinates === "blank")
    );
  if (candidate.kind === "polygon")
    return (
      Object.keys(candidate).every((key) => ["id", "kind", "vertices", "shaded", "name", "namePosition", "answerOnly"].includes(key)) &&
      Array.isArray(candidate.vertices) &&
      candidate.vertices.length >= 3 &&
      candidate.vertices.length <= 12 &&
      candidate.vertices.every(isCoordinate) &&
      (candidate.shaded === undefined || candidate.shaded === true)
    );
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
      (Array.isArray(candidate.labels) && candidate.labels.every(isPointLabel))) &&
    (candidate.gradientTriangle === undefined || isGradientTriangle(candidate.gradientTriangle)) &&
    (candidate.arrow === undefined ||
      (candidate.display === "segment" && (candidate.arrow === "end" || candidate.arrow === "middle")))
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
    (candidate.lines !== undefined && candidate.lines !== "bold") ||
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
  return candidate.objects.every(isGraphObject);
}
