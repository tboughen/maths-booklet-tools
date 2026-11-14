// @vitest-environment node
// Every registered diagram family can be placed in a worksheet and printed to the vector PDF.
import { describe, expect, it } from "vitest";
import { resolve } from "node:path";
import { PDFDocument } from "pdf-lib";
import { DIAGRAM_KINDS, FAMILIES, drawDiagram } from "../../packages/diagram-core/src/registry";
import { renderResource, validate, type Resource } from "../../packages/resource-core/src/index";
import { treeDiagrams } from "../../packages/resource-core/src/fixtures";
import { worksheetPdf } from "./worksheet-pdf";

/** Small, card-sized settings for each family. */
const SPECS: Record<(typeof DIAGRAM_KINDS)[number], Record<string, unknown> | undefined> = {
  graph: { axes: { x: { negativeSquares: 3, positiveSquares: 3, unitsPerSquare: 1 }, y: { negativeSquares: 3, positiveSquares: 3, unitsPerSquare: 1 } }, objects: [{ kind: "point", id: "p", position: { x: 1, y: 2 } }] },
  "ratio-table": undefined,
  "value-graph": undefined,
  cuboids: undefined,
  "number-line": { widthCm: 10 },
  venn: { widthCm: 10 },
  "algebra-grid": undefined,
  "bar-model": undefined,
  charts: { example: undefined, kind: "bar", categories: ["A", "B", "C"], series: [{ name: "Pupils", values: ["3", "5", null] }] },
  "probability-tree": undefined,
  construction: { widthCm: 9, heightCm: 7, points: [{ id: "A", x: 1.5, y: 3.5 }, { id: "B", x: 7.5, y: 3.5 }], objects: [{ type: "segment", from: "A", to: "B" }], constructions: [{ type: "perpendicular-bisector", a: "A", b: "B" }] },
  "frequency-tree": { total: "60", groups: [{ name: "boys", count: "32", children: [{ name: "school lunch", count: "24" }, { name: "packed lunch", count: "8", countHidden: true }] }, { name: "girls", count: "28", countHidden: true }] },
  triangle: { widthCm: 8 },
};
const clean = (spec: Record<string, unknown> | undefined) => spec && Object.fromEntries(Object.entries(spec).filter(([, v]) => v !== undefined));

function withDiagram(diagram: { tool: string; spec?: unknown; envelope?: unknown }): unknown {
  const r = structuredClone(treeDiagrams) as Resource;
  // Replace the first card's items with this one diagram, on the first side.
  r.document.sides[0].columns[0].cards[0].items = [{ type: "text", text: "Use the diagram." }, { type: "diagram", diagram } as never];
  return r;
}
const roots = { text: resolve("assets/resource-fonts"), diagrams: resolve("assets/graph-fonts") };

describe("worksheet diagrams from every family", () => {
  it.each([...DIAGRAM_KINDS])("places a %s from its spec, saves its envelope and prints both copies", async (kind) => {
    const spec = clean(SPECS[kind]);
    const resource = validate(withDiagram({ tool: kind, ...(spec ? { spec } : { spec: {} }) }));
    const item = resource.document.sides[0].columns[0].cards[0].items[1] as { diagram: { tool: string; envelope?: unknown; spec?: unknown } };
    // A saved worksheet holds the built envelope, never the spec.
    expect(item.diagram.spec).toBeUndefined();
    expect(item.diagram.envelope).toEqual(FAMILIES[kind].create(spec ? { spec } : { spec: {} }));
    // The same envelope can be given back unchanged.
    expect(validate(withDiagram({ tool: kind, envelope: item.diagram.envelope }))).toEqual(resource);
    const size = drawDiagram(kind, item.diagram.envelope, "pupil");
    for (const view of ["pupil", "answers"] as const) {
      const rendered = renderResource(resource, { view });
      const problems = rendered.issues.map((i) => i.message).filter((m) => !/mm wide; the card has|too full|needs .* mm/.test(m));
      expect(problems, `${kind} ${view}`).toEqual([]);
      // The diagram is embedded at its own printed size in millimetres.
      expect(rendered.pages[0]).toContain(`width="${+size.widthMm.toFixed(2)}"`);
      const pdf = await worksheetPdf(rendered.pages, `${kind} test`, roots);
      const doc = await PDFDocument.load(pdf);
      expect(doc.getPageCount()).toBe(2);
    }
  }, 60000);
  it("prints an Edexcel-style graph (names, axis titles, fine grid, italic O) in the worksheet PDF", async () => {
    const spec = {
      originLabel: "O",
      grid: "2mm",
      axes: {
        x: { negativeSquares: 0, positiveSquares: 6, unitsPerSquare: 30, origin: 720, labelEvery: 2, format: "time", title: "Time of day" },
        y: { negativeSquares: 0, positiveSquares: 5, unitsPerSquare: 5, title: "Distance (km)" },
      },
      objects: [
        { kind: "segment", id: "l", start: { x: 720, y: 0 }, end: { x: 810, y: 20 }, name: "L1" },
        { kind: "point", id: "a", position: { x: 810, y: 20 }, name: "A" },
      ],
    };
    const resource = validate(withDiagram({ tool: "graph", spec }));
    const rendered = renderResource(resource, { view: "pupil" });
    expect(rendered.pages[0]).toContain("Distance (km)");
    expect(rendered.pages[0]).toContain("𝐋");
    const pdf = await worksheetPdf(rendered.pages, "edexcel graph test", roots);
    expect((await PDFDocument.load(pdf)).getPageCount()).toBe(2);
  }, 60000);
  it("refuses a diagram with both or neither of spec and envelope, and names a bad spec field", () => {
    expect(() => validate(withDiagram({ tool: "venn" }))).toThrow(/envelope or its spec/);
    expect(() => validate(withDiagram({ tool: "venn", spec: {}, envelope: {} }))).toThrow(/envelope or its spec/);
    expect(() => validate(withDiagram({ tool: "charts", spec: { categories: "A" } }))).toThrow(/bar or line chart: spec\.categories/);
    expect(() => validate(withDiagram({ tool: "spirograph", spec: {} }))).toThrow();
  });
});
