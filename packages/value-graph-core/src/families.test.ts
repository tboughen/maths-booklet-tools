import { describe, expect, it } from "vitest";
import { apply, defaultEnvelope, evaluate, rangeColumns, renderSvg, warnings } from "./interchange";
import { equationText } from "./svg";
import { curvePathData, equationProblem } from "./families";

const withEquation = (equation: object, columns = rangeColumns("-3", "3", "1"), curve = true) => {
  const e = defaultEnvelope();
  return apply(e, [
    { op: "set_equation", equation },
    { op: "replace_columns", columns },
    ...(curve ? [{ op: "set_curve", curve: { id: "quadratic", equation, min: columns[0].x, max: columns[columns.length - 1].x } }] : []),
  ] as never);
};

describe("cubic, reciprocal and exponential tables (U84)", () => {
  it("evaluates exactly, with fractions where the values are fractions", () => {
    expect(evaluate({ a: "0", b: "-4", c: "0", cubic: "1" }, "-3")).toBe("-15");
    expect(evaluate({ a: "0", b: "0", c: "1", reciprocal: "3" }, "2")).toBe("5/2");
    expect(evaluate({ a: "0", b: "0", c: "0", exponential: { coefficient: "3", base: "2" } }, "-2")).toBe("3/4");
    expect(evaluate({ a: "0", b: "0", c: "0", exponential: { coefficient: "1", base: "1/2" } }, "3")).toBe("1/8");
  });

  it("refuses x = 0 for a reciprocal and non-whole x for an exponential, with what to do", () => {
    expect(() => withEquation({ a: "0", b: "0", c: "0", reciprocal: "6" })).toThrow(/Remove the x = 0 column/);
    expect(() => withEquation({ a: "0", b: "0", c: "0", exponential: { coefficient: "1", base: "2" } }, rangeColumns("0", "2", "1/2"))).toThrow(/whole-number x/);
    expect(equationProblem({ a: "1", b: "0", c: "0", reciprocal: "2" })).toMatch(/only k\/x and a constant/);
    expect(equationProblem({ a: "0", b: "0", c: "0", exponential: { coefficient: "1", base: "1" } })).toMatch(/other than 1/);
    expect(equationProblem({ a: "0", b: "0", c: "0" })).toMatch(/nonzero coefficient a/);
  });

  it("prints exam notation", () => {
    expect(equationText({ a: "0", b: "-4", c: "1", cubic: "1" })).toBe("y = x³ − 4x + 1");
    expect(equationText({ a: "0", b: "0", c: "1", reciprocal: "3" })).toBe("y = 3/x + 1");
    expect(equationText({ a: "0", b: "0", c: "0", reciprocal: "-1" })).toBe("y = −1/x");
    expect(equationText({ a: "0", b: "0", c: "-1", exponential: { coefficient: "3", base: "2" } })).toBe("y = 3 × 2ˣ − 1");
    expect(equationText({ a: "0", b: "0", c: "0", exponential: { coefficient: "1", base: "1/2" } })).toBe("y = (1/2)ˣ");
  });

  it("draws a cubic as one exact cubic Bézier and a reciprocal as two branches that stop at the grid", () => {
    const id = (v: number) => v;
    expect(curvePathData({ a: "0", b: "-4", c: "0", cubic: "1" }, -3, 3, id, id, { min: -20, max: 20 })).toMatch(/^M-3 -15C[^C]+$/);
    const reciprocal = curvePathData({ a: "0", b: "0", c: "0", reciprocal: "6" }, -6, 6, id, id, { min: -6, max: 6 });
    expect(reciprocal.match(/M/g)).toHaveLength(2);
    expect(reciprocal).not.toContain("NaN");
    expect(reciprocal).not.toContain("Infinity");
    const svg = renderSvg(withEquation({ a: "0", b: "0", c: "0", reciprocal: "6" }, rangeColumns("1", "6", "1")));
    expect(svg).toContain("data-curve=");
  });

  it("keeps quadratic files unchanged and warns about straight joins by family", () => {
    expect(JSON.stringify(defaultEnvelope())).not.toMatch(/cubic|reciprocal|exponential/);
    const cubic = withEquation({ a: "0", b: "-4", c: "0", cubic: "1" }, rangeColumns("-3", "3", "1"), false);
    const joined = apply(cubic, [{ op: "plot_series", id: "s", source: "equation", columnIds: cubic.document.columns.map((c) => c.id), connection: "straight-joins" }] as never);
    expect(warnings(joined).join(" ")).toContain("cubic graph's points");
  });
});
