import {
  fractionString,
  parseNumber,
  rational,
} from "../../packages/ratio-table-core/src/numbers";
import type { ValueDocument } from "../../packages/value-graph-core/src/interchange";

// Deliberately bounded expanded-polynomial grammar. Never execute teacher input.
export function parseEquation(input: string): ValueDocument["equation"] {
  if (input.length > 180)
    throw Error("Use an expanded quadratic of at most 180 characters.");
  const text = input
    .toLowerCase()
    .replaceAll("−", "-")
    .replaceAll("²", "^2")
    .replace(/\s/g, "")
    .replace(/^y=/, "");
  const term =
    /([+-]?)(?:(\d+(?:\.\d{0,6})?|\.\d{1,6})(?:\/(\d+))?)?(x(?:\^2)?)?/y;
  const sums = { a: rational(0n), b: rational(0n), c: rational(0n) };
  let pos = 0,
    count = 0;
  while (pos < text.length) {
    term.lastIndex = pos;
    const match = term.exec(text);
    if (
      !match ||
      !match[0] ||
      (!match[2] && !match[4]) ||
      (pos > 0 && !match[1]) ||
      ++count > 12
    )
      throw Error(
        "Use expanded form, for example y = 2x² − 3x + 1, with numbers or fractions.",
      );
    const coefficient = parseNumber(
      `${match[1]}${match[2] ?? "1"}${match[3] ? `/${match[3]}` : ""}`,
    );
    const key = match[4] === "x^2" ? "a" : match[4] === "x" ? "b" : "c";
    const previous = sums[key];
    sums[key] = rational(
      previous.n * coefficient.d + coefficient.n * previous.d,
      previous.d * coefficient.d,
    );
    pos = term.lastIndex;
  }
  if (!count || !sums.a.n)
    throw Error("Include a non-zero x² term to make a quadratic.");
  return {
    a: fractionString(sums.a),
    b: fractionString(sums.b),
    c: fractionString(sums.c),
  };
}
