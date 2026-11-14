export class RatioError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "RatioError";
  }
}

export interface Rational {
  n: bigint;
  d: bigint;
}
export const NUMBER_LIMITS = {
  inputCharacters: 32,
  decimalPlaces: 6,
  numerator: 1_000_000_000,
  denominator: 1_000_000,
  absoluteValue: 1_000_000,
} as const;

function gcd(a: bigint, b: bigint): bigint {
  a = a < 0n ? -a : a;
  while (b) [a, b] = [b, a % b];
  return a;
}
export function rational(n: bigint, d = 1n): Rational {
  if (!d)
    throw new RatioError(
      "invalid_number",
      "A fraction cannot have a zero denominator.",
    );
  if (d < 0n) {
    n = -n;
    d = -d;
  }
  const divisor = gcd(n, d);
  n /= divisor;
  d /= divisor;
  const absolute = n < 0n ? -n : n;
  if (
    absolute > BigInt(NUMBER_LIMITS.numerator) ||
    d > BigInt(NUMBER_LIMITS.denominator) ||
    absolute > BigInt(NUMBER_LIMITS.absoluteValue) * d
  )
    throw new RatioError(
      "size_limit",
      "This number exceeds the supported exact-number limits.",
    );
  return { n, d };
}
export function parseNumber(value: string): Rational {
  if (typeof value !== "string" || value.length > NUMBER_LIMITS.inputCharacters)
    throw new RatioError(
      "invalid_number",
      "Use a number or fraction of at most 32 characters.",
    );
  const input = value.trim().replaceAll("−", "-");
  if (/^[+-]?\d+\s*\/\s*[+-]?\d+$/.test(input)) {
    const [n, d] = input.split("/").map((v) => BigInt(v.trim()));
    return rational(n, d);
  }
  if (!/^[+-]?(?:\d+(?:\.\d{0,6})?|\.\d{1,6})$/.test(input))
    throw new RatioError(
      "invalid_number",
      "Use an integer, a decimal with up to 6 places, or a fraction such as 2/3.",
    );
  const negative = input.startsWith("-"),
    unsigned = input.replace(/^[+-]/, "");
  const [whole, decimal = ""] = unsigned.split(".");
  return rational(
    BigInt((whole || "0") + decimal) * (negative ? -1n : 1n),
    10n ** BigInt(decimal.length),
  );
}
export function fractionString(value: Rational): string {
  return value.d === 1n ? String(value.n) : `${value.n}/${value.d}`;
}
export function canonicalNumber(input: string): string {
  const value = parseNumber(input);
  if (input.includes("/") || value.d === 1n) return fractionString(value);
  let decimal = input.trim().replaceAll("−", "-").replace(/^\+/, "");
  const negative = decimal.startsWith("-");
  decimal = decimal.replace(/^-/, "");
  const [whole, places = ""] = decimal.split(".");
  return (
    (negative ? "-" : "") +
    (whole.replace(/^0+(?=\d)/, "") || "0") +
    "." +
    places.replace(/0+$/, "")
  );
}
/** Unicode fraction characters a teacher may type: "2½" is read as "2 1/2". */
const VULGAR: Record<string, string> = {
  "½": "1/2", "⅓": "1/3", "⅔": "2/3", "¼": "1/4", "¾": "3/4", "⅕": "1/5", "⅖": "2/5", "⅗": "3/5",
  "⅘": "4/5", "⅙": "1/6", "⅚": "5/6", "⅐": "1/7", "⅛": "1/8", "⅜": "3/8", "⅝": "5/8", "⅞": "7/8",
  "⅑": "1/9", "⅒": "1/10",
};
const MIXED = /^([+-]?)(\d+)\s+(\d+)\s*\/\s*(\d+)$/;
/** Typed text with fraction characters spelt out: "−2½" becomes "-2 1/2", "⅔" becomes "2/3". */
function spellFractions(value: string) {
  return value
    .trim()
    .replaceAll("−", "-")
    .replaceAll("⁄", "/")
    .replace(/(\d?)\s*([½⅓⅔¼¾⅕⅖⅗⅘⅙⅚⅐⅛⅜⅝⅞⅑⅒])$/u, (_, whole: string, c: string) =>
      (whole ? `${whole} ` : "") + VULGAR[c],
    );
}
/**
 * Ratio-table numbers also accept mixed numbers, as the school writes gradients: "2 1/2", "2½",
 * "-1 3/4". The fraction part must be proper (less than 1); the sign belongs to the whole number.
 * Other tools keep parseNumber, which does not read mixed numbers.
 */
export function parseRatioNumber(value: string): Rational {
  if (typeof value !== "string" || value.length > NUMBER_LIMITS.inputCharacters)
    throw new RatioError(
      "invalid_number",
      "Use a number, fraction or mixed number of at most 32 characters.",
    );
  const input = spellFractions(value),
    mixed = input.match(MIXED);
  if (!mixed) {
    try {
      return parseNumber(input);
    } catch (failure) {
      if (failure instanceof RatioError && failure.code === "invalid_number")
        throw new RatioError(
          "invalid_number",
          "Use an integer, a decimal with up to 6 places, a fraction such as 2/3 or a mixed number such as 2 1/2.",
        );
      throw failure;
    }
  }
  const [, sign, whole, top, bottom] = mixed,
    w = BigInt(whole),
    n = BigInt(top),
    d = BigInt(bottom);
  if (!d)
    throw new RatioError(
      "invalid_number",
      "A fraction cannot have a zero denominator.",
    );
  if (!n || n >= d)
    throw new RatioError(
      "invalid_number",
      `In a mixed number the fraction must be less than 1: write ${value.trim()} as a fraction, or as a whole number and a proper fraction.`,
    );
  return rational((w * d + n) * (sign === "-" ? -1n : 1n), d);
}
/** True when the text is a mixed number such as "2 1/2" or "2½" (after spelling out ½). */
export function isMixedNumber(value: string): boolean {
  return MIXED.test(spellFractions(value));
}
/** A value as a mixed number: "5/2" becomes "2 1/2"; whole numbers and proper fractions are unchanged. */
export function mixedString(value: Rational): string {
  const negative = value.n < 0n,
    n = negative ? -value.n : value.n;
  if (value.d === 1n || n < value.d) return fractionString(value);
  return `${negative ? "-" : ""}${n / value.d} ${n % value.d}/${value.d}`;
}
/**
 * The saved form of a ratio-table number. Mixed numbers stay mixed ("2½" saves as "2 1/2", the
 * fraction part in lowest terms); every other input saves exactly as canonicalNumber does, so
 * existing files are unchanged.
 */
export function canonicalRatioNumber(input: string): string {
  const value = parseRatioNumber(input);
  if (isMixedNumber(input)) return mixedString(value);
  const spelt = spellFractions(input);
  return canonicalNumber(spelt);
}
/** A saved ratio number split for printing: whole part (if any) and stacked fraction (if any). */
export function numberParts(value: string): { whole: string; top?: string; bottom?: string } {
  const mixed = value.match(/^([-−]?\d+) (\d+)\/(\d+)$/);
  if (mixed) return { whole: mixed[1], top: mixed[2], bottom: mixed[3] };
  const [top, bottom] = value.split("/");
  return bottom ? { whole: "", top, bottom } : { whole: top };
}
export function sameNumber(a: Rational, b: Rational): boolean {
  return a.n * b.d === b.n * a.d;
}
export function scaleNumber(
  value: Rational,
  operation: "multiply" | "divide",
  factor: Rational,
): Rational {
  if (operation === "divide" && !factor.n)
    throw new RatioError("invalid_operation", "Cannot divide by zero.");
  return operation === "multiply"
    ? rational(value.n * factor.n, value.d * factor.d)
    : rational(value.n * factor.d, value.d * factor.n);
}
