import { tangentSegment, trapeziumStrips } from "./curve";
import { cleanCoordinate } from "./transform";
import type { CurveObject, GradientTriangle, PolygonObject, StraightObject } from "./types";

const clean = (p: { x: number; y: number }) => ({ x: cleanCoordinate(p.x), y: cleanCoordinate(p.y) });

/**
 * A tangent to a graph through points, saved as an ordinary segment (so it can carry a gradient
 * triangle). Drawn only when asked: it shows a pupil's working. Throws a teacher-readable reason
 * when the graph does not reach x or is vertical there.
 */
export function tangentObject(curve: CurveObject, x: number, run: number, options: { id: string; answerOnly?: boolean; gradientTriangle?: GradientTriangle }): StraightObject {
  const t = tangentSegment(curve.points, !!curve.smooth, x, run);
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
export function stripObjects(curve: CurveObject, from: number, to: number, count: number, base: number, options: { id: (i: number) => string; shaded?: boolean; answerOnly?: boolean }): PolygonObject[] {
  const strips = trapeziumStrips(curve.points, !!curve.smooth, from, to, count, base);
  if (!strips) throw Error(`the graph must reach every strip edge from x = ${from} to x = ${to}.`);
  return strips.map((vertices, i) => ({
    id: options.id(i),
    kind: "polygon" as const,
    vertices: vertices.map(clean),
    ...(options.shaded ? { shaded: true as const } : {}),
    ...(options.answerOnly ? { answerOnly: true as const } : {}),
  }));
}
