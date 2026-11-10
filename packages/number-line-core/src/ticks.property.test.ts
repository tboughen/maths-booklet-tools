// Property tests for number-line tick and interval arithmetic (improvement list L19): every tick is an
// exact multiple of the step, checked against plain bigint arithmetic over seeded random axes.
import { describe, expect, it } from "vitest";
import { fractionString, rational } from "../../ratio-table-core/src/numbers";
import { forAll, type Random } from "../../../src/testing/random";
import { add, compare, documentSchema, labelKey, labelled, metrics, position, ticks } from "./index";

/** 2–32 whole intervals of a step such as 1, 5, 1/2 or 2/3, starting on a multiple of the step. */
function axis(r: Random) {
  const sn = r.big(1n, 12n), sd = r.pick([1n, 2n, 3n, 4n, 5n, 10n]), start = r.big(-40n, 40n), n = r.big(2n, 32n);
  const at = (k: bigint) => fractionString(rational(k * sn, sd)), labelEvery = r.int(1, 4);
  // The parsed document, not validate(): that also refuses labels that would overlap when printed.
  const d = documentSchema.parse({ axis: { minimum: at(start), maximum: at(start + n), step: at(1n), labelEvery, numberFormat: "fraction" } });
  return { d, at, start, n: Number(n), step: at(1n), labelEvery };
}

describe("number line tick arithmetic", () => {
  it("ticks run exactly from the first tick to the last in whole steps, in canonical form", () => {
    forAll(300, (r) => {
      const a = axis(r), values = ticks(a.d);
      expect(values).toEqual(Array.from({ length: a.n + 1 }, (_, i) => a.at(a.start + BigInt(i))));
      values.forEach((v, i) => {
        expect(labelKey(v)).toBe(v);
        expect(labelled(a.d, v)).toBe((a.start + BigInt(i)) % BigInt(a.labelEvery) === 0n);
        if (i) expect([add(values[i - 1], a.step), compare(values[i - 1], v)]).toEqual([v, -1]);
      });
    });
  });

  it("tick positions run evenly from the left end to the right end", () => {
    forAll(200, (r) => {
      const { d } = axis(r), m = metrics(d), xs = ticks(d).map((v) => position(d, v));
      xs.forEach((x, i) => expect(x).toBeCloseTo(m.left + (i * (m.right - m.left)) / (xs.length - 1), 9));
    });
  });

  it("adding then subtracting returns the original value exactly", () => {
    forAll(300, (r) => {
      const v = () => fractionString(rational(r.big(-9999n, 9999n), r.big(1n, 999n))), x = v(), y = v();
      expect(add(add(x, y), y, -1)).toBe(x);
      expect(add(x, y)).toBe(add(y, x));
      expect(compare(x, y)).toBe(-compare(y, x));
    });
  });
});
