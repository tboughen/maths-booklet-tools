// Property tests for the exact numbers behind ratio tables and plotting quadratics (L18). Pupils'
// fractions are never turned into decimals or rounded: every value here is checked against plain
// bigint arithmetic, over seeded random inputs (src/testing/random.ts).
import { describe, expect, it } from "vitest";
import {
  NUMBER_LIMITS,
  canonicalNumber,
  fractionString,
  parseNumber,
  rational,
  sameNumber,
  scaleNumber,
  type Rational,
} from "../../packages/ratio-table-core/src/numbers";
import {
  evaluate,
  rangeColumns,
} from "../../packages/value-graph-core/src/model";
import { forAll, random, type Random } from "./random";

const gcd = (a: bigint, b: bigint): bigint => {
  a = a < 0n ? -a : a;
  b = b < 0n ? -b : b;
  while (b) [a, b] = [b, a % b];
  return a;
};
/** A fraction within the supported limits, not necessarily in lowest terms. */
function fraction(r: Random, max = 1000n): [bigint, bigint] {
  const d = r.big(1n, max),
    n = r.big(-max * d, max * d);
  return [n, d];
}
const value = (r: Random, max = 1000n) => {
  const [n, d] = fraction(r, max);
  return rational(n, d);
};
/** A string a teacher might type within the input limits: an integer, a decimal of up to 6 places or a fraction. */
function typed(r: Random): string {
  const sign = r.pick(["", "", "-", "+", "−"]);
  switch (r.int(0, 2)) {
    case 0:
      return sign + r.int(0, 99999);
    case 1:
      return (
        sign +
        r.int(0, 999) +
        "." +
        String(r.int(0, 999999)).padStart(r.int(1, 6), "0").slice(0, 6)
      );
    default:
      return `${sign}${r.int(0, 9999)}${r.pick(["/", " / "])}${r.int(1, 999)}`;
  }
}

describe("exact numbers", () => {
  it("the generator is reproducible", () => {
    const a = random(7),
      b = random(7);
    expect([a.next(), a.int(1, 6), a.big(0n, 10n ** 12n)]).toEqual([
      b.next(),
      b.int(1, 6),
      b.big(0n, 10n ** 12n),
    ]);
  });

  it("every fraction is stored in lowest terms with a positive denominator", () =>
    forAll(500, (r) => {
      const [n, d] = fraction(r),
        sign = r.bool() ? -1n : 1n;
      const v = rational(n * sign, d * sign);
      expect(v.d > 0n).toBe(true);
      expect(gcd(v.n, v.d)).toBe(v.n === 0n ? v.d : 1n);
      expect(v.n * d * sign).toBe(n * sign * v.d);
    }));

  it("a saved fraction reads back as the same fraction", () =>
    forAll(500, (r) => {
      const v = value(r);
      expect(parseNumber(fractionString(v))).toEqual(v);
    }));

  it("typed numbers keep their exact value, and tidying them is idempotent and loses nothing", () =>
    forAll(500, (r) => {
      const input = typed(r),
        v = parseNumber(input),
        tidy = canonicalNumber(input);
      expect(sameNumber(parseNumber(tidy), v), `${input} -> ${tidy}`).toBe(
        true,
      );
      expect(canonicalNumber(tidy)).toBe(tidy);
      // A fraction stays a fraction and a decimal stays a decimal: tidying never converts.
      if (input.includes("/")) expect(tidy).not.toContain(".");
    }));

  it("decimals are read exactly, never through floating point", () =>
    forAll(500, (r) => {
      const places = r.int(1, NUMBER_LIMITS.decimalPlaces),
        digits = r.big(0n, 10n ** BigInt(places + 3) - 1n); // up to 999.999999, inside the numerator limit
      const text = digits.toString().padStart(places + 1, "0");
      const input = `${text.slice(0, -places)}.${text.slice(-places)}`;
      expect(
        sameNumber(parseNumber(input), { n: digits, d: 10n ** BigInt(places) }),
      ).toBe(true);
    }));

  it("scaling by a factor and back returns the original value", () =>
    forAll(500, (r) => {
      const v = value(r, 100n),
        f = value(r, 100n);
      if (!f.n)
        return expect(() => scaleNumber(v, "divide", f)).toThrow(
          /divide by zero/,
        );
      let back: Rational;
      try {
        back = scaleNumber(scaleNumber(v, "multiply", f), "divide", f);
      } catch (error) {
        // Too big for the exact-number limits: refused, never rounded.
        return expect((error as Error).message).toMatch(
          /exceeds the supported exact-number limits/,
        );
      }
      expect(back).toEqual(v);
    }));

  it("quadratic table values are exact", () =>
    forAll(500, (r) => {
      const [an, ad] = fraction(r, 12n),
        [bn, bd] = fraction(r, 12n),
        [cn, cd] = fraction(r, 12n),
        [xn, xd] = fraction(r, 12n);
      const a = fractionString(rational(an, ad)),
        b = fractionString(rational(bn, bd)),
        c = fractionString(rational(cn, cd)),
        x = fractionString(rational(xn, xd));
      let got: string;
      try {
        got = evaluate({ a, b, c } as never, x);
      } catch (error) {
        return expect((error as Error).message).toMatch(
          /exceeds the supported exact-number limits/,
        );
      }
      // a x² + b x + c over the common denominator ad·bd·cd·xd².
      const num =
          an * xn * xn * bd * cd +
          bn * xn * xd * ad * cd +
          cn * xd * xd * ad * bd,
        den = ad * bd * cd * xd * xd;
      expect(
        sameNumber(parseNumber(got), { n: num, d: den }),
        `${a}x² + ${b}x + ${c} at x = ${x}`,
      ).toBe(true);
    }));

  it("a range of x values steps exactly from the start without passing the end", () =>
    forAll(300, (r) => {
      const start = value(r, 10n),
        step = rational(r.big(1n, 20n), r.big(1n, 6n)),
        count = r.int(2, 13);
      const end = rational(
        start.n * step.d + BigInt(count - 1) * step.n * start.d,
        start.d * step.d,
      );
      const columns = rangeColumns(
        fractionString(start),
        fractionString(end),
        fractionString(step),
      );
      expect(columns).toHaveLength(count);
      columns.forEach((col, i) =>
        expect(
          sameNumber(
            parseNumber(col.x),
            rational(
              start.n * step.d + BigInt(i) * step.n * start.d,
              start.d * step.d,
            ),
          ),
        ).toBe(true),
      );
      expect(columns.every((col) => col.y.kind === "blank")).toBe(true);
    }));
});
