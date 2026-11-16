import { tangentSegment, trapeziumStrips } from "./curve";
import { cleanCoordinate } from "./transform";
import { asymptotes, functionValueOn } from "./function";
import type { CurveObject, FunctionObject, GradientTriangle, PolygonObject, StraightObject } from "./types";

/** The points of a graph through points, or the exact value of an equation curve. */
const source = (curve: CurveObject | FunctionObject) => (curve.kind === "function" ? (x: number) => functionValueOn(curve, x) : curve.points);
const smooth = (curve: CurveObject | FunctionObject) => curve.kind === "curve" && !!curve.smooth;

const clean = (p: { x: number; y: number }) => ({ x: cleanCoordinate(p.x), y: cleanCoordinate(p.y) });

/**
 * A tangent to a graph through points, saved as an ordinary segment (so it can carry a gradient
 * triangle). Drawn only when asked: it shows a pupil's working. Throws a teacher-readable reason
 * when the graph does not reach x or is vertical there.
 */
export function tangentObject(curve: CurveObject | FunctionObject, x: number, run: number, options: { id: string; answerOnly?: boolean; gradientTriangle?: GradientTriangle }): StraightObject {
  const t = tangentSegment(source(curve), smooth(curve), x, run);
  if (!t) throw Error(`the graph does not reach x = ${x}, or is vertical there.`);
  return {
    id: options.id,
    kind: "straight",
    display: "segment",
    strokeStyle: "solid",
    start: clean(t.start),
    end: clean(t.end),
    equationVisible: false,
    ...(options.answerOnly ? { answerOnly: true as const } : {}),
    ...(options.gradientTriangle ? { gradientTriangle: options.gradientTriangle } : {}),
  };
}

/** Equal trapezium strips under a graph through points, down to the x-axis, as ordinary shapes. */
export function stripObjects(curve: CurveObject | FunctionObject, from: number, to: number, count: number, base: number, options: { id: (i: number) => string; shaded?: boolean; answerOnly?: boolean }): PolygonObject[] {
  if (curve.kind === "function" && asymptotes(curve.equation, from, to).length)
    throw Error(`the graph has an asymptote between x = ${from} and x = ${to}, so strips cannot cross it.`);
  const strips = trapeziumStrips(source(curve), smooth(curve), from, to, count, base);
  if (!strips) throw Error(`the graph must reach every strip edge from x = ${from} to x = ${to}.`);
  return strips.map((vertices, i) => ({
    id: options.id(i),
    kind: "polygon" as const,
    vertices: vertices.map(clean),
    ...(options.shaded ? { shaded: true as const } : {}),
    ...(options.answerOnly ? { answerOnly: true as const } : {}),
  }));
}
