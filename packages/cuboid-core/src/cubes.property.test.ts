// Property tests for cuboid cube counts (improvement list L19): cube view shows exactly
// length x width x height unit cubes in any unit, checked with plain bigints over seeded random cuboids.
import { describe, expect, it } from "vitest";
import { fractionString, parseNumber, rational } from "../../ratio-table-core/src/numbers";
import { forAll, type Random } from "../../../src/testing/random";
import { axes, decomposition, fromCm, newShape, setUnit, type Shape } from "./index";

const units = ["cm", "mm", "m"] as const;
function cuboid(r: Random) {
  let counts: number[];
  do counts = axes.map(() => r.int(1, 40));
  while (counts[0] * counts[1] * counts[2] > 10000);
  const side = rational(r.big(1n, 20n), r.pick([1n, 2n, 4n, 5n, 10n])), unit = r.pick(units);
  const dimensions = Object.fromEntries(axes.map((a, i) => [a, fromCm(rational(side.n * BigInt(counts[i]), side.d), unit)]));
  const shape: Shape = { ...newShape(), unit, view: "cubes", cubeSideCm: fractionString(side), dimensions: dimensions as Shape["dimensions"] };
  return { shape, counts, side };
}

describe("cuboid unit cubes", () => {
  it("counts exactly the cubes along each edge, and length x width x height in total", () => {
    forAll(300, (r) => {
      const { shape, counts } = cuboid(r), c = decomposition(shape);
      expect([c.width, c.depth, c.height, c.total]).toEqual([...counts, counts[0] * counts[1] * counts[2]]);
    });
  });

  it("the cubes fill the cuboid's volume exactly", () => {
    forAll(300, (r) => {
      const { shape, side } = cuboid(r), { total } = decomposition(shape);
      const [w, d, h] = axes.map((a) => parseNumber(shape.dimensions[a])), s = parseNumber(fromCm(side, shape.unit));
      expect(w.n * d.n * h.n * s.d ** 3n).toBe(BigInt(total) * s.n ** 3n * w.d * d.d * h.d);
    });
  });

  it("changing the unit never changes the cube counts", () => {
    forAll(200, (r) => {
      const { shape } = cuboid(r), before = decomposition(shape);
      for (const unit of units) expect(decomposition(setUnit(shape, unit))).toEqual(before);
    });
  });
});
