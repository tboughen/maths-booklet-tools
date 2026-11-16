import { parseNumber } from "../../packages/ratio-table-core/src/numbers";
import { functionProblem } from "../../packages/graph-core/src/function";
import type { FunctionEquation } from "../../packages/graph-core/src/types";
import { parseEquation } from "../value-graph/equation";

const value = (text: string) => {
  const r = parseNumber(text);
  return Number(r.n) / Number(r.d);
};
const NUMBER = String.raw`(?:\d+(?:\.\d{0,6})?|\.\d{1,6})(?:\/\d+)?`;

/**
 * A typed equation curve: anything Plotting quadratics reads (y = 2x² − 3x + 1, y = x³ − 4x,
 * y = 3/x + 1, y = 2ˣ) or a trig graph in degrees such as y = sin x, y = 2cos(x + 30) − 1 or
 * y = tan 2x. Never executes the text.
 */
export function parseFunctionText(input: string): FunctionEquation {
  const text = input.toLowerCase().replaceAll("−", "-").replaceAll("°", "").replace(/\s/g, "").replace(/^y=/, "");
  const trig = new RegExp(
    String.raw`^(-?)(${NUMBER})?(sin|cos|tan)(?:\((-?)(${NUMBER})?x(?:([+-])(${NUMBER}))?\)|(${NUMBER})?x)(?:([+-])(${NUMBER}))?$`,
  ).exec(text);
  if (trig) {
    const [, sign, amp, fn, innerSign, innerK, shiftSign, shift, bareK, cSign, c] = trig;
    const equation: FunctionEquation = {
      family: "trig",
      fn: fn as "sin" | "cos" | "tan",
      amplitude: (sign ? -1 : 1) * (amp ? value(amp) : 1),
      multiplier: (innerSign ? -1 : 1) * (innerK ? value(innerK) : bareK ? value(bareK) : 1),
      shift: shift ? (shiftSign === "-" ? -1 : 1) * value(shift) : 0,
      c: c ? (cSign === "-" ? -1 : 1) * value(c) : 0,
    };
    const problem = functionProblem(equation);
    if (problem) throw Error(problem[0].toUpperCase() + problem.slice(1));
    return equation;
  }
  // k/x + c read directly, so a decimal k such as 0.5 is accepted as well as a fraction.
  const reciprocal = new RegExp(String.raw`^(-?)(${NUMBER})\/x(?:([+-])(${NUMBER}))?$`).exec(text);
  if (reciprocal) {
    const [, sign, k, cSign, c] = reciprocal;
    const equation: FunctionEquation = { family: "reciprocal", k: (sign ? -1 : 1) * value(k), c: c ? (cSign === "-" ? -1 : 1) * value(c) : 0 };
    const problem = functionProblem(equation);
    if (problem) throw Error(problem[0].toUpperCase() + problem.slice(1));
    return equation;
  }
  if (/sin|cos|tan/.test(text)) throw Error("Write a trig graph such as y = sin x, y = 2cos(x + 30) − 1 or y = tan 2x (x in degrees).");
  const e = parseEquation(input);
  if (e.exponential) return { family: "exponential", coefficient: value(e.exponential.coefficient), base: value(e.exponential.base), c: value(e.c) };
  if (e.reciprocal && value(e.reciprocal)) return { family: "reciprocal", k: value(e.reciprocal), c: value(e.c) };
  return { family: "polynomial", a: value(e.a), b: value(e.b), c: value(e.c), ...(e.cubic && value(e.cubic) ? { cubic: value(e.cubic) } : {}) };
}
