// Teaching-rule gate (docs/AUTONOMOUS-LOOP-POLICY.md, gate 5): exact fractions stay exact. A value a
// teacher types as a fraction must survive validation, save and reload, and links as that same
// fraction, and must never be drawn as a rounded decimal.
import { describe, expect, it } from "vitest";
import * as numberLine from "../../packages/number-line-core/src/index";
import { createRatioTable, decodeRatio, encodeRatio, parseRatioFile, validateRatioEnvelope } from "../../packages/ratio-table-core/src/interchange";
import { renderRatioSvg } from "../../packages/ratio-table-core/src/svg";

// A rounded decimal for any of the thirds, sixths or sevenths used below.
const roundedDecimal = /\b0?\.(?:33|66|67|16|83|14|28|42|57|71|85)\d*/;
const drawn = (svg: string) => [...svg.matchAll(/<text\b[^>]*>([^<]*)<\/text>/g)].map(m => m[1]).join(" ");

describe("exact fractions stay exact", () => {
  it("number line: fraction ticks and endpoints", () => {
    const e = numberLine.create({
      axis: { minimum: "-1", maximum: "1", step: "1/3", numberFormat: "fraction" },
      solution: { kind: "interval", id: "set", lower: "-2/3", upper: "1/3", lowerIncluded: true, upperIncluded: false },
    });
    expect(numberLine.ticks(e.document)).toContain("1/3");
    expect(e.document.solution).toMatchObject({ lower: "-2/3", upper: "1/3" });
    for (const copy of [numberLine.decode(numberLine.encode(e)), numberLine.parseFile(JSON.stringify(e))]) expect(copy).toEqual(e);
    const text = drawn(numberLine.renderSvg(e));
    expect(text).not.toMatch(roundedDecimal);
    // Drawn as stacked fractions: four tick labels with denominator 3.
    expect(text.split(" ").filter(t => t === "3").length).toBeGreaterThanOrEqual(4);
  });

  it("ratio table: fraction cells", () => {
    const e = createRatioTable({ schemaVersion: 2, rows: [{ cells: [{ kind: "number", value: "2/3" }, { kind: "number", value: "5/7" }] }, { cells: [{ kind: "number", value: "4/3" }, { kind: "number", value: "10/7" }] }] });
    const values = e.document.rows.flatMap(r => r.cells.map(c => (c.kind === "number" ? c.value : null)));
    expect(values).toEqual(["2/3", "5/7", "4/3", "10/7"]);
    for (const copy of [decodeRatio(encodeRatio(e)), parseRatioFile(JSON.stringify(e)), validateRatioEnvelope(structuredClone(e))]) expect(copy).toEqual(e);
    const text = drawn(renderRatioSvg(e.document));
    expect(text).not.toMatch(roundedDecimal);
    expect(text).toMatch(/\b7\b/); // the sevenths are drawn as fractions, not dropped
  });
});
