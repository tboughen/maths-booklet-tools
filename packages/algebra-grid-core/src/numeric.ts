/**
 * Exact decimal arithmetic for the numeric grid method (U105). A number is a
 * scaled bigint, value = units / 10^scale, so 0.1 + 0.2 is exactly 0.3 and
 * nothing is rounded.
 */
export type Decimal = { units: bigint; scale: number };

const MAX_DIGITS = 12;
const MAX_PLACES = 6;

function tidy(d: Decimal): Decimal {
  let { units, scale } = d;
  while (scale > 0 && units % 10n === 0n) {
    units /= 10n;
    scale--;
  }
  return { units, scale: units === 0n ? 0 : scale };
}
function align(a: Decimal, b: Decimal): [bigint, bigint, number] {
  const scale = Math.max(a.scale, b.scale);
  return [
    a.units * 10n ** BigInt(scale - a.scale),
    b.units * 10n ** BigInt(scale - b.scale),
    scale,
  ];
}
function checked(d: Decimal): Decimal {
  const t = tidy(d),
    digits = String(t.units < 0n ? -t.units : t.units).length;
  if (digits > MAX_DIGITS || t.scale > MAX_PLACES)
    throw Error(
      `Use numbers with at most ${MAX_DIGITS} digits and ${MAX_PLACES} decimal places.`,
    );
  return t;
}

/** Reads 23, -4, 0.4, .5 or 1,200 (commas group thousands). */
export function parseNumber(raw: string): Decimal {
  const s = raw.replaceAll(/\s/g, "").replaceAll("−", "-").replaceAll(",", "");
  const match = s.match(/^([+-]?)(\d*)(?:\.(\d+))?$/);
  if (!match || (!match[2] && !match[3]))
    throw Error(
      "Enter a number such as 40, 7 or 0.3. Leave empty for a blank cell.",
    );
  const places = match[3] ?? "";
  return checked({
    units: BigInt((match[1] === "-" ? "-" : "") + ((match[2] || "0") + places)),
    scale: places.length,
  });
}
export function numberText(d: Decimal): string {
  const t = tidy(d),
    negative = t.units < 0n,
    digits = String(negative ? -t.units : t.units).padStart(t.scale + 1, "0"),
    whole = digits.slice(0, digits.length - t.scale),
    places = digits.slice(digits.length - t.scale);
  return (negative ? "-" : "") + whole + (places ? "." + places : "");
}
export const normalNumber = (s: string) => numberText(parseNumber(s));
export function add(a: Decimal, b: Decimal): Decimal {
  const [x, y, scale] = align(a, b);
  return checked({ units: x + y, scale });
}
export function times(a: Decimal, b: Decimal): Decimal {
  return checked({ units: a.units * b.units, scale: a.scale + b.scale });
}
export const same = (a: Decimal, b: Decimal) => {
  const [x, y] = align(a, b);
  return x === y;
};
export function sum(values: string[]): Decimal {
  return values.reduce<Decimal>((t, v) => add(t, parseNumber(v)), {
    units: 0n,
    scale: 0,
  });
}

/** "23 × 47", "23 x 47" or "23*47": exactly two numbers to multiply. */
export function numericFactors(raw: string): [Decimal, Decimal] {
  const parts = raw.split(/[×x*]/i);
  if (parts.length !== 2 || parts.some((p) => !p.trim()))
    throw Error("Enter a multiplication of two numbers, for example 23 × 47.");
  return [parseNumber(parts[0]), parseNumber(parts[1])];
}
export function numericExpressionText(raw: string) {
  const [a, b] = numericFactors(raw);
  return `${numberText(a)} × ${numberText(b)}`;
}

/** Splits a number by place value: 47 → 40, 7; 2.35 → 2, 0.3, 0.05. */
export function placeValueParts(d: Decimal): string[] {
  const t = tidy(d),
    negative = t.units < 0n,
    digits = String(negative ? -t.units : t.units);
  return Array.from(digits)
    .map((digit, i) => ({ digit: BigInt(digit), power: digits.length - 1 - i }))
    .filter((p) => p.digit !== 0n)
    .map((p) =>
      numberText(
        p.power >= t.scale
          ? {
              units:
                (negative ? -1n : 1n) *
                p.digit *
                10n ** BigInt(p.power - t.scale),
              scale: 0,
            }
          : {
              units: (negative ? -1n : 1n) * p.digit,
              scale: t.scale - p.power,
            },
      ),
    );
}
