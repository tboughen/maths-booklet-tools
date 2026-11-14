// @vitest-environment node
// Faults found by building six two-sided A3 worksheets across the diagram families (14 November
// 2026): each test pins the fix so a teacher does not meet the fault again.
import { describe, expect, it } from "vitest";
import { FAMILIES } from "../../diagram-core/src/registry";
import { familyCapabilities } from "../../diagram-core/src/guides";
import { create as createTriangle } from "../../triangle-core/src/interchange";
import { renderDiagramSvg } from "../../graph-core/src/svg";
import { documentFromEnvelope, createGraph } from "../../graph-core/src/interchange";
import { renderSvg as numberLineSvg, create as createNumberLine } from "../../number-line-core/src/index";
import { treeDiagrams } from "./fixtures";
import { renderResource, validate, type Resource } from "./index";
import { missingGlyphIssues, tooWideMessage } from "./render";

const texts = (svg: string) => [...svg.matchAll(/<text\b[^>]*>([^<]*)</g)].map((m) => m[1]);

const sheetWith = (items: unknown[]): Resource => {
  const doc = structuredClone(treeDiagrams) as unknown as { document: { sides: { columns: { cards: { items: unknown[] }[] }[] }[] } };
  doc.document.sides[0].columns[0].cards[0].items = items;
  return validate(doc);
};

describe("worksheet stress-test faults", () => {
  it("prints a triangle label typed with its unit (71°, 5 cm) once, and still reads it as a given", () => {
    const e = createTriangle({
      spec: {
        shape: "right",
        widthCm: 8,
        labels: [
          { ref: "e:AB", label: { state: "value", text: "5 cm" } },
          { ref: "a:T1-B", label: { state: "value", text: "37°" } },
        ],
      },
    });
    const shown = texts(FAMILIES.triangle.svg(e, "pupil"));
    expect(shown).toContain("5 cm");
    expect(shown).toContain("37°");
    expect(shown.join(" ")).not.toMatch(/cm cm|°°/);
  });

  it("stacks fractions in a graph's printed equation", () => {
    const e = createGraph({
      axes: { x: { negativeSquares: 2, positiveSquares: 6, unitsPerSquare: 1 }, y: { negativeSquares: 2, positiveSquares: 6, unitsPerSquare: 1 } },
      objects: [{ kind: "line", id: "l1", start: { x: 0, y: 2 }, end: { x: 4, y: 4 }, strokeStyle: "solid", equationVisible: true }],
    });
    const svg = renderDiagramSvg(documentFromEnvelope(e));
    expect(svg).toContain('class="equation-label"');
    expect(texts(svg)).toEqual(expect.arrayContaining(["y = ", "1", "2", "x + 2"]));
    expect(svg).not.toContain("1/2");
  });

  it("prints number-line fractions at 10 pt with a negative sign before the bar", () => {
    const e = createNumberLine({ axis: { minimum: "-1", maximum: "1", step: "1/2", numberFormat: "fraction" } });
    const svg = numberLineSvg(e);
    const size = Number(svg.match(/<g font-size="([\d.]+)"/)![1]);
    expect(size).toBeCloseTo((10 * 25.4) / 72, 3);
    expect(texts(svg)).toContain("−");
    expect(svg).not.toMatch(/<g font-size="[\d.]+"><text[^>]*>−/);
  });

  it("fits a two-level frequency tree in a three-column card at the branch length the issue suggests", () => {
    const e = FAMILIES["frequency-tree"].create({
      spec: { total: "60", groups: [
        { name: "Year 7", count: "35", children: [{ name: "walk", count: "20" }, { name: "bus", count: "15" }] },
        { name: "Year 8", count: "25", children: [{ name: "walk", count: "10" }, { name: "bus", count: "15" }] },
      ], settings: { branchMm: 30 } },
    });
    const width = Number(FAMILIES["frequency-tree"].svg(e, "pupil").match(/width="([\d.]+)mm"/)![1]);
    expect(width).toBeLessThanOrEqual(130);
  });

  it("names the setting that makes a too-wide diagram fit", () => {
    expect(tooWideMessage("number-line", 140, 130.13)).toMatch(/widthCm to 13 or less/);
    expect(tooWideMessage("frequency-tree", 132, 130.13)).toMatch(/branchMm \(30 fits/);
    expect(tooWideMessage("charts", 140, 130.13)).toMatch(/wider column layout/);
  });

  it("lists single later branches in the probability-tree capabilities", () => {
    expect(familyCapabilities("probability-tree").branchesPerPoint).toMatchObject({ minimum: 1, firstStageMinimum: 2 });
  });

  it("prints inequality signs and open and filled circles, and reports characters the font lacks", () => {
    const sheet = sheetWith([
      { type: "info", text: "An open circle ○ means < or >. A filled circle ● means ≤ or ≥." },
      { type: "text", text: "List A ∩ B." },
    ]);
    const issues = missingGlyphIssues(sheet);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ side: 1, column: 1, question: 1 });
    expect(issues[0].message).toMatch(/"∩" \(U\+2229\)/);
    expect(renderResource(sheet).issues.map((i) => i.message)).toContain(issues[0].message);
    // Hidden worked solutions are never printed, so they are not checked.
    expect(missingGlyphIssues(sheetWith([{ type: "text", text: "x < 3" }]))).toEqual([]);
  });
});
