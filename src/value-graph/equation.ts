import {
  fractionString,
  parseNumber,
  rational,
} from "../../packages/ratio-table-core/src/numbers";
import type { ValueDocument } from "../../packages/value-graph-core/src/interchange";
import { equationProblem } from "../../packages/value-graph-core/src/families";

type Equation = ValueDocument["equation"];
const NUMBER = String.raw`(?:\d+(?:\.\d{0,6})?|\.\d{1,6})(?:\/\d+)?`;

/** y = k × bˣ + c, typed as 2^x, 3*2^x, 3×2ˣ, (1/2)^x or 0.5^x - 1 (U84). */
function parseExponential(text: string): Equation | null {
  const match = new RegExp(
    String.raw`^(-?)(?:(${NUMBER})(?:\*|×))?(?:\((${NUMBER})\)|(${NUMBER}))\^x(?:([+-])(${NUMBER}))?$`,
  ).exec(text);
  if (!match) return null;
  const coefficient = fractionString(parseNumber(`${match[1]}${match[2] ?? "1"}`));
  const base = fractionString(parseNumber(match[3] ?? match[4]));
  const c = match[6] ? fractionString(parseNumber(`${match[5]}${match[6]}`)) : "0";
  return { a: "0", b: "0", c, exponential: { coefficient, base } };
}

// Deliberately bounded expanded-polynomial grammar. Never execute teacher input.
export function parseEquation(input: string): Equation {
  if (input.length > 180)
    throw Error("Use an expanded equation of at most 180 characters.");
  const text = input
    .toLowerCase()
    .replaceAll("−", "-")
    .replaceAll("²", "^2")
    .replaceAll("³", "^3")
    .replaceAll("ˣ", "^x")
    .replace(/\s/g, "")
    .replace(/^y=/, "");
  const exponential = parseExponential(text);
  if (exponential) {
    const problem = equationProblem(exponential);
    if (problem) throw Error(problem);
    return exponential;
  }
  const term =
    /([+-]?)(?:(\d+(?:\.\d{0,6})?|\.\d{1,6})(?:\/(\d+))?)?(x\^3|x\^2|\/x|x)?/y;
  const zero = () => rational(0n);
  const sums = { cubic: zero(), a: zero(), b: zero(), reciprocal: zero(), c: zero() };
  let pos = 0,
    count = 0;
  while (pos < text.length) {
    term.lastIndex = pos;
    const match = term.exec(text);
    if (
      !match ||
      !match[0] ||
      (!match[2] && !match[4]) ||
      (match[4] === "/x" && !match[2]) ||
      (pos > 0 && !match[1]) ||
      ++count > 12
    )
      throw Error(
        "Use expanded form, for example y = 2x² − 3x + 1, y = x³ − 4x, y = 3/x or y = 2ˣ, with numbers or fractions.",
      );
    const coefficient = parseNumber(
      `${match[1]}${match[2] ?? "1"}${match[3] ? `/${match[3]}` : ""}`,
    );
    const key =
      match[4] === "x^3"
        ? "cubic"
        : match[4] === "x^2"
          ? "a"
          : match[4] === "x"
            ? "b"
            : match[4] === "/x"
              ? "reciprocal"
              : "c";
    const previous = sums[key];
    sums[key] = rational(
      previous.n * coefficient.d + coefficient.n * previous.d,
      previous.d * coefficient.d,
    );
    pos = term.lastIndex;
  }
  if (!count || (!sums.a.n && !sums.cubic.n && !sums.reciprocal.n))
    throw Error(
      "Include an x², x³ or k/x term, or write an exponential such as y = 2ˣ.",
    );
  const equation: Equation = {
    a: fractionString(sums.a),
    b: fractionString(sums.b),
    c: fractionString(sums.c),
    ...(sums.cubic.n ? { cubic: fractionString(sums.cubic) } : {}),
    ...(sums.reciprocal.n ? { reciprocal: fractionString(sums.reciprocal) } : {}),
  };
  const problem = equationProblem(equation);
  if (problem) throw Error(problem);
  return equation;
}
