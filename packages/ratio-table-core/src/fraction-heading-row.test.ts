import { describe, expect, it } from "vitest";
import { createRatioTable } from "./interchange";
import { ratioMetrics, renderRatioSvg } from "./svg";

// A stacked fraction heading (1/x, 1/x^2) used to sit on the heading rule. The heading row now
// grows to fit it, as worked solutions for inverse proportion need (June 2017 1H Q13, NP17).
const table = (columns: string[]) =>
  createRatioTable({ columns, table: [["2", "5"], ["4", "[1.25]"]], steps: ["× 2"] }).document;

describe("heading row for a stacked fraction heading", () => {
  it("grows the heading row by 3 mm and moves the rows down with it", () => {
    const plain = ratioMetrics(table(["x", "y"])), stacked = ratioMetrics(table(["1/x^2", "y"]));
    expect(plain.headHeight).toBe(100);
    expect(stacked.headHeight).toBe(130);
    expect(stacked.height - plain.height).toBe(30);
    expect(stacked.bodyTop).toBe(stacked.tableTop + 130);
  });
  it("keeps the fraction's denominator clear above the heading rule", () => {
    const d = table(["1/x^2", "y"]), m = ratioMetrics(d), svg = renderRatioSvg(d);
    const rule = Number(svg.match(/class="ratio-rules" d="[^"]*M[\d.]+ ([\d.]+)H/)![1]);
    expect(rule).toBe(m.bodyTop);
    // The lowest heading baseline (the x of x^2) sits at least 1.2 mm above the rule.
    const head = svg.slice(0, svg.indexOf('class="ratio-cell"'));
    const baselines = [...head.matchAll(/<text[^>]* y="([\d.]+)"/g)].map((t) => Number(t[1]));
    expect(rule - Math.max(...baselines)).toBeGreaterThan(12);
    // The first row's value is centred in its row below the rule.
    expect(svg).toMatch(new RegExp(`data-row="row-1" data-column="0"[^>]*><text[^>]* y="${m.bodyTop + 50 + 42.333333333333336 * 0.31}"`));
  });
  it("leaves tables without a stacked heading exactly as they were", () => {
    for (const columns of [["x", "y"], ["x^2 →", "y ↑"], ["Time (min)", "Cost (£)"], ["m/s", "60/min"]])
      expect(ratioMetrics(table(columns)).headHeight).toBe(100);
  });
});
