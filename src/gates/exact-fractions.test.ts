// Teaching-rule gate (docs/AUTONOMOUS-LOOP-POLICY.md, gate 5): exact fractions stay exact. A value a
// teacher types as a fraction must survive validation, save and reload, and links as that same
// fraction, and must never be drawn as a rounded decimal.
import { describe, expect, it } from "vitest";
import * as numberLine from "../../packages/number-line-core/src/index";
import { createRatioTable, decodeRatio, encodeRatio, parseRatioFile, validateRatioEnvelope } from "../../packages/ratio-table-core/src/interchange";
import { renderRatioSvg } from "../../packages/ratio-table-core/src/svg";

// None of the values below is a terminating decimal, so any decimal point in drawn text is a rounding.
const roundedDecimal = /\d?\.\d/;
// Every piece of drawn text, including <tspan> children: the markup minus its tags and attributes.
const drawn = (svg: string) => svg.replace(/<[^>]*>/g, " ").split(/\s+/).filter(Boolean);
// Stacked fractions: each numerator and denominator is its own text node, never "a/b" on one line.
const stacked = (svg: string, [n, d]: [string, string]) => {
  const nodes = [...svg.matchAll(/<text\b[^>]*\sx="([\d.]+)"[^>]*>([^<]*)<\/text>/g)].map(m => ({ x: m[1], text: m[2] }));
  return nodes.some(a => a.text === n && nodes.some(b => b !== a && b.x === a.x && b.text === d));
};

describe("exact fractions stay exact", () => {
  it("number line: fraction ticks and endpoints", () => {
    const e = numberLine.create({
      axis: { minimum: "-1", maximum: "1", step: "1/3", numberFormat: "fraction" },
      solution: { kind: "interval", id: "set", lower: "-2/3", upper: "1/3", lowerIncluded: true, upperIncluded: false },
    });
    expect(numberLine.ticks(e.document)).toContain("1/3");
    expect(e.document.solution).toMatchObject({ lower: "-2/3", upper: "1/3" });
    for (const copy of [numberLine.decode(numberLine.encode(e)), numberLine.parseFile(JSON.stringify(e))]) expect(copy).toEqual(e);
    const svg = numberLine.renderSvg(e);
    expect(drawn(svg).filter(t => roundedDecimal.test(t) || t.includes("/"))).toEqual([]);
    for (const f of [["−2", "3"], ["−1", "3"], ["1", "3"], ["2", "3"]] as [string, string][]) expect(stacked(svg, f), f.join("/")).toBe(true);
  });

  it("ratio table: fraction cells", () => {
    const e = createRatioTable({ schemaVersion: 2, rows: [{ cells: [{ kind: "number", value: "2/3" }, { kind: "number", value: "5/7" }] }, { cells: [{ kind: "number", value: "4/3" }, { kind: "number", value: "10/7" }] }] });
    const values = e.document.rows.flatMap(r => r.cells.map(c => (c.kind === "number" ? c.value : null)));
    expect(values).toEqual(["2/3", "5/7", "4/3", "10/7"]);
    for (const copy of [decodeRatio(encodeRatio(e)), parseRatioFile(JSON.stringify(e)), validateRatioEnvelope(structuredClone(e))]) expect(copy).toEqual(e);
    const svg = renderRatioSvg(e.document);
    expect(drawn(svg).filter(t => roundedDecimal.test(t) || t.includes("/"))).toEqual([]);
    for (const f of [["2", "3"], ["5", "7"], ["4", "3"], ["10", "7"]] as [string, string][]) expect(stacked(svg, f), f.join("/")).toBe(true);
  });
});
