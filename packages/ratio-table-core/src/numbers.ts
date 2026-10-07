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
