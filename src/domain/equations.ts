import { cleanNumber, clipInfiniteLine } from "./diagram";
import type { Bounds, Coordinate, StraightObject } from "./types";

interface SlopeEquation {
  kind: "slope";
  slope: number;
  intercept: number;
}

interface VerticalEquation {
  kind: "vertical";
  x: number;
}

export type LineEquation = SlopeEquation | VerticalEquation;

export function equationFromPoints(start: Coordinate, end: Coordinate): LineEquation | null {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (Math.abs(dx) < 1e-10 && Math.abs(dy) < 1e-10) return null;
  if (Math.abs(dx) < 1e-10) return { kind: "vertical", x: cleanNumber(start.x) };
  const slope = cleanNumber(dy / dx);
  const intercept = cleanNumber(start.y - slope * start.x);
  return { kind: "slope", slope, intercept };
}

function greatestCommonDivisor(first: number, second: number): number {
  let a = Math.abs(first);
  let b = Math.abs(second);
  while (b) [a, b] = [b, a % b];
  return a || 1;
}

export function approximateFraction(value: number, maximumDenominator = 12): [number, number] | null {
  if (!Number.isFinite(value)) return null;
  let best: [number, number] = [Math.round(value), 1];
  let bestError = Math.abs(value - best[0]);
  for (let denominator = 1; denominator <= maximumDenominator; denominator += 1) {
    const numerator = Math.round(value * denominator);
    const error = Math.abs(value - numerator / denominator);
    if (error < bestError) {
      best = [numerator, denominator];
      bestError = error;
    }
  }
  if (bestError > 1e-7) return null;
  const divisor = greatestCommonDivisor(best[0], best[1]);
  return [best[0] / divisor, best[1] / divisor];
}

export function formatNumber(value: number): string {
  const clean = cleanNumber(value);
  const fraction = approximateFraction(clean);
  const formatted = fraction && fraction[1] !== 1
    ? `${fraction[0]}/${fraction[1]}`
    : fraction
      ? String(fraction[0])
      : Number(clean.toFixed(3)).toString();
  return formatted.startsWith("-") ? `−${formatted.slice(1)}` : formatted;
}

function formatSlopeTerm(slope: number): string {
  if (slope === 1) return "x";
  if (slope === -1) return "−x";
  return `${formatNumber(slope)}x`;
}

export function formatEquation(equation: LineEquation | null): string {
  if (!equation) return "Undefined";
  if (equation.kind === "vertical") return `x = ${formatNumber(equation.x)}`;
  const slopeTerm = formatSlopeTerm(equation.slope);
  if (equation.intercept === 0) return `y = ${slopeTerm}`;
  const operator = equation.intercept > 0 ? "+" : "−";
  return `y = ${slopeTerm} ${operator} ${formatNumber(Math.abs(equation.intercept))}`;
}

export function equationForObject(object: StraightObject): string {
  return formatEquation(equationFromPoints(object.start, object.end));
}

export function parseNumericInput(value: string): number | null {
  const trimmed = value.trim().replaceAll("−", "-");
  if (!trimmed) return null;
  const fractionMatch = trimmed.match(/^([+-]?(?:\d+(?:\.\d*)?|\.\d+))\s*\/\s*([+-]?(?:\d+(?:\.\d*)?|\.\d+))$/);
  if (fractionMatch) {
    const numerator = Number(fractionMatch[1]);
    const denominator = Number(fractionMatch[2]);
    if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) return null;
    return cleanNumber(numerator / denominator);
  }
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? cleanNumber(parsed) : null;
}

export function pointsForEquation(equation: LineEquation, bounds: Bounds): [Coordinate, Coordinate] {
  const anchors: [Coordinate, Coordinate] = equation.kind === "vertical"
    ? [{ x: equation.x, y: bounds.yMin }, { x: equation.x, y: bounds.yMax }]
    : [{ x: bounds.xMin, y: equation.slope * bounds.xMin + equation.intercept }, { x: bounds.xMax, y: equation.slope * bounds.xMax + equation.intercept }];
  return clipInfiniteLine(anchors[0], anchors[1], bounds) ?? anchors;
}
