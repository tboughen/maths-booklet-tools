// Property tests for plotting quadratics (improvement list L19): table values agree with plotted
// points. A table series plots exactly the filled table pairs and never a blank or answer line; an
// equation series is exactly y = ax² + bx + c; markers are drawn at their pair. Seeded random tables.
import { describe, expect, it } from "vitest";
import { fractionString, parseNumber, rational } from "../../ratio-table-core/src/numbers";
import { forAll, type Random } from "../../../src/testing/random";
import { apply, defaultEnvelope, evaluate, number, rangeColumns } from "./model";
import type { ValueEnvelope } from "./schema";
import { metrics, renderSvg } from "./svg";

type Cell = ValueEnvelope["document"]["columns"][number]["y"];
const coefficient = (r: Random, nonzero = false): string => {
  const n = r.big(-6n, 6n);
  return nonzero && !n ? coefficient(r, true) : fractionString(rational(n, r.pick([1n, 2n, 4n])));
};
const same = (a: string, b: string) => fractionString(parseNumber(a)) === fractionString(parseNumber(b));
/** A random quadratic and a table of 2–7 x values whose cells are values, zeros, blanks or answer lines. */
function table(r: Random) {
  const half = r.bool(), start = r.int(-3, 0), count = r.int(2, 7), equation = { a: coefficient(r, true), b: coefficient(r), c: coefficient(r) };
  const end = fractionString(rational(BigInt(start * (half ? 2 : 1) + count - 1), half ? 2n : 1n));
  const columns = rangeColumns(`${start}`, end, half ? "1/2" : "1").map((c) => ({
    ...c, y: r.pick<Cell>([{ kind: "value", value: evaluate(equation, c.x) }, { kind: "value", value: "0" }, { kind: "blank" }, { kind: "answer-line" }]),
  }));
  return apply(defaultEnvelope(), [{ op: "set_equation", equation }, { op: "replace_columns", columns }]);
}
const plot = (e: ValueEnvelope, source: "table" | "equation") => {
  const out = apply(e, [{ op: "plot_series", id: "s", source, columnIds: e.document.columns.map((c) => c.id), connection: "none" }]);
  return { out, points: out.document.graph.series.find((s) => s.id === "s")!.points };
};

describe("plotting quadratics", () => {
  it("a table series plots exactly the filled table pairs, and nothing for blanks or answer lines", () => {
    forAll(300, (r) => {
      const t = table(r), { points } = plot(t, "table"), filled = t.document.columns.filter((c) => c.y.kind === "value");
      expect(points.map((p) => p.columnId)).toEqual(filled.map((c) => c.id));
      points.forEach((p, i) => expect(same(p.x, filled[i].x) && filled[i].y.kind === "value" && same(p.y, filled[i].y.value)).toBe(true));
    });
  });

  it("an equation series is exactly ax² + bx + c at every table x and leaves the table unchanged", () => {
    forAll(300, (r) => {
      const t = table(r), { out, points } = plot(t, "equation"), [a, b, c] = ["a", "b", "c"] as const;
      const [qa, qb, qc] = [a, b, c].map((k) => parseNumber(t.document.equation[k]));
      expect(out.document.columns).toEqual(t.document.columns);
      expect(points).toHaveLength(t.document.columns.length);
      for (const p of points) {
        const x = parseNumber(p.x), d = qa.d * qb.d * qc.d * x.d * x.d;
        const n = qa.n * x.n * x.n * qb.d * qc.d + qb.n * x.n * x.d * qa.d * qc.d + qc.n * x.d * x.d * qa.d * qb.d;
        expect(p.y).toBe(fractionString(rational(n, d)));
      }
    });
  });

  it("editing a table cell moves or removes its linked point, never leaves it stale", () => {
    forAll(200, (r) => {
      const t = table(r), id = r.pick(t.document.columns).id, y = r.pick<Cell>([{ kind: "value", value: coefficient(r) }, { kind: "blank" }, { kind: "answer-line" }]);
      const filled = plot(apply(t, [{ op: "calculate_cells", columnIds: t.document.columns.map((c) => c.id), overwrite: true }]), "table").out;
      const point = apply(filled, [{ op: "set_cell", columnId: id, y }]).document.graph.series[0].points.find((p) => p.columnId === id);
      expect(y.kind === "value" ? point !== undefined && same(point.y, y.value) : point === undefined).toBe(true);
    });
  });

  it("every plotted point inside the grid has its marker drawn at that pair's place", () => {
    forAll(150, (r) => {
      const { out, points } = plot(table(r), "equation"), g = out.document.graph, p = metrics(out).plot, svg = renderSvg(out);
      const [x0, x1, y0, y1] = [g.bounds.xMin, g.bounds.xMax, g.bounds.yMin, g.bounds.yMax].map(number);
      for (const point of points) {
        const x = number(point.x), y = number(point.y), inside = x >= x0 && x <= x1 && y >= y0 && y <= y1;
        const marker = svg.match(new RegExp(`data-point-id="${point.id}" data-series-id="s" d="M([-0-9.e]+) ([-0-9.e]+)l`));
        expect(Boolean(marker)).toBe(inside);
        if (marker) expect(+marker[1] + 1).toBeCloseTo(p.left + ((x - x0) * 10) / number(g.xUnitsPer10mm), 6);
        if (marker) expect(+marker[2] + 1).toBeCloseTo(p.top + ((y1 - y) * 10) / number(g.yUnitsPer10mm), 6);
      }
    });
  });
});
