import { fractionString, parseNumber, rational } from "../../ratio-table-core/src/numbers";
import type { Rational } from "../../ratio-table-core/src/numbers";
import type { Equation } from "./schema";

/** Which kind of graph an equation draws (U84). Saved quadratics carry only a, b and c. */
export type EquationFamily = "quadratic" | "cubic" | "reciprocal" | "exponential";

const value = (v: string | undefined) => (v === undefined ? 0 : Number(parseNumber(v).n) / Number(parseNumber(v).d));
const nonzero = (v: string | undefined) => v !== undefined && parseNumber(v).n !== 0n;

export function equationFamily(e: Equation): EquationFamily {
  if (e.exponential) return "exponential";
  if (nonzero(e.reciprocal)) return "reciprocal";
  if (nonzero(e.cubic)) return "cubic";
  return "quadratic";
}

/** Why an equation cannot be tabulated or drawn, or null when it can. */
export function equationProblem(e: Equation): string | null {
  if (e.exponential) {
    const base = parseNumber(e.exponential.base);
    if (base.n <= 0n || base.n === base.d) return "Use a positive base other than 1, such as 2, 3 or 1/2.";
    if (!nonzero(e.exponential.coefficient)) return "Use a nonzero number in front of the power, such as 1 or 3.";
    if (nonzero(e.a) || nonzero(e.b) || nonzero(e.cubic) || nonzero(e.reciprocal))
      return "An exponential graph takes only a number in front, the base and a constant, such as y = 3 × 2ˣ + 1.";
    return null;
  }
  if (nonzero(e.reciprocal)) {
    if (nonzero(e.a) || nonzero(e.b) || nonzero(e.cubic))
      return "A reciprocal graph takes only k/x and a constant, such as y = 3/x + 1.";
    return null;
  }
  if (!nonzero(e.a) && !nonzero(e.cubic)) return "Use a nonzero coefficient a for a quadratic.";
  return null;
}

function add(a: Rational, b: Rational) {
  return rational(a.n * b.d + b.n * a.d, a.d * b.d);
}
function multiply(a: Rational, b: Rational) {
  return rational(a.n * b.n, a.d * b.d);
}
function power(base: Rational, exponent: bigint): Rational {
  const n = exponent < 0n ? -exponent : exponent;
  const r = rational(base.n ** n, base.d ** n);
  return exponent < 0n ? rational(r.d, r.n) : r;
}

/** The exact y value at x, as a fraction string. Throws a specific message where there is none. */
export function evaluateExact(e: Equation, x: string): string {
  const v = parseNumber(x);
  const c = parseNumber(e.c);
  if (e.exponential) {
    if (v.d !== 1n) throw Error(`y = ${e.exponential.base}ˣ has an exact value only at whole-number x; x = ${x} is not one.`);
    return fractionString(add(multiply(parseNumber(e.exponential.coefficient), power(parseNumber(e.exponential.base), v.n)), c));
  }
  if (nonzero(e.reciprocal)) {
    if (v.n === 0n) throw Error("Remove the x = 0 column: a reciprocal graph has no value at x = 0.");
    return fractionString(add(multiply(parseNumber(e.reciprocal!), rational(v.d, v.n)), c));
  }
  let y = add(add(multiply(multiply(parseNumber(e.a), v), v), multiply(parseNumber(e.b), v)), c);
  if (nonzero(e.cubic)) y = add(y, multiply(parseNumber(e.cubic!), multiply(multiply(v, v), v)));
  return fractionString(y);
}

/** y and dy/dx at x, as decimals, for drawing the curve. */
export function evaluateCurve(e: Equation, x: number): { y: number; slope: number } {
  const c = value(e.c);
  if (e.exponential) {
    const k = value(e.exponential.coefficient), base = value(e.exponential.base);
    const p = k * base ** x;
    return { y: p + c, slope: p * Math.log(base) };
  }
  if (nonzero(e.reciprocal)) {
    const r = value(e.reciprocal);
    return { y: r / x + c, slope: -r / (x * x) };
  }
  const a = value(e.a), b = value(e.b), d = value(e.cubic);
  return { y: d * x ** 3 + a * x * x + b * x + c, slope: 3 * d * x * x + 2 * a * x + b };
}

/**
 * The curve between min and max as SVG path data in drawing units. Quadratics keep their single
 * exact quadratic Bézier, so saved quadratic graphs keep their artwork byte for byte. A cubic is
 * one exact cubic Bézier. Reciprocal and exponential graphs are joined cubic Bézier pieces that
 * match the curve's value and gradient at each joint; a reciprocal graph is two branches.
 */
export function curvePathData(
  e: Equation,
  min: number,
  max: number,
  px: (x: number) => number,
  py: (y: number) => number,
  yRange: { min: number; max: number },
): string {
  const family = equationFamily(e);
  if (family === "quadratic") {
    const a = value(e.a), bb = value(e.b), cc = value(e.c);
    const y0 = a * min * min + bb * min + cc,
      y1 = a * max * max + bb * max + cc;
    const controlY = y0 + ((2 * a * min + bb) * (max - min)) / 2;
    return `M${px(min)} ${py(y0)}Q${px((min + max) / 2)} ${py(controlY)} ${px(max)} ${py(y1)}`;
  }
  const piece = (x0: number, x1: number) => {
    const p0 = evaluateCurve(e, x0), p1 = evaluateCurve(e, x1), h = (x1 - x0) / 3;
    return `C${px(x0 + h)} ${py(p0.y + p0.slope * h)} ${px(x1 - h)} ${py(p1.y - p1.slope * h)} ${px(x1)} ${py(p1.y)}`;
  };
  const branch = (x0: number, x1: number, pieces: number) => {
    if (x1 - x0 <= 1e-9) return "";
    let d = `M${px(x0)} ${py(evaluateCurve(e, x0).y)}`;
    // Pieces are spaced evenly in x, or geometrically towards a reciprocal's asymptote.
    const near = family === "reciprocal" ? (Math.abs(x0) < Math.abs(x1) ? "start" : "end") : null;
    const at = (i: number) => {
      const t = i / pieces;
      if (!near) return x0 + (x1 - x0) * t;
      const [a, b] = near === "start" ? [x0, x1] : [x1, x0];
      const ratio = b / a, s = near === "start" ? t : 1 - t;
      return a * ratio ** s;
    };
    for (let i = 0; i < pieces; i++) d += piece(at(i), at(i + 1));
    return d;
  };
  if (family === "cubic") return branch(min, max, 1);
  if (family === "exponential") return branch(min, max, 16);
  // Reciprocal: stop each branch where it leaves the grid, with a margin, on either side of 0.
  const r = value(e.reciprocal), c = value(e.c);
  const reach = Math.max(Math.abs(yRange.max - c), Math.abs(yRange.min - c)) * 1.1 || 1;
  const limit = Math.abs(r) / reach;
  const parts: string[] = [];
  if (min < -limit) parts.push(branch(min, Math.min(max, -limit), 24));
  if (max > limit) parts.push(branch(Math.max(min, limit), max, 24));
  return parts.join("");
}
