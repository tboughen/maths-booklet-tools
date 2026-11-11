// @vitest-environment node
import { describe, expect, it } from "vitest";
import { exampleLessonSource } from "./booklet-fixtures";
import { createRatioTable, ratioWarnings } from "../../ratio-table-core/src/interchange";

// The A7.03 model lesson's movement tables are ratio tables: their saved and hidden values must
// agree with the ratio and with the line they describe.
type Diagram = { type: "diagram"; diagram: { tool: string; spec: { table?: string[][]; objects?: { kind: string; start: { x: number; y: number }; end: { x: number; y: number } }[] } } };
const diagrams = (items: unknown[]) => items.filter((i): i is Diagram => (i as Diagram).type === "diagram");

describe("A7.03 model lesson ratio tables", () => {
  const cards = exampleLessonSource.sections.flatMap((s) => s.cards);
  it("every ratio table is consistent with its own ratio", () => {
    const tables = cards.flatMap((c) => diagrams(c.items)).filter((d) => d.diagram.tool === "ratio-table");
    expect(tables.length).toBeGreaterThan(8);
    for (const t of tables) expect(ratioWarnings(createRatioTable(t.diagram.spec))).toEqual([]);
  });
  it("the worked example and Our turn tables read movements between perfect points on their own lines", () => {
    for (const title of ["Worked example", "Our turn"]) {
      const card = cards.find((c) => c.title === title)!;
      const [graph, table] = [diagrams(card.items).find((d) => d.diagram.tool === "graph")!, diagrams(card.items).find((d) => d.diagram.tool === "ratio-table")!];
      const line = graph.diagram.spec.objects!.find((o) => o.kind === "line")!;
      const [right, up] = table.diagram.spec.table![0].map((v) => Number(v.replace(/[[\]_]/g, "")));
      expect(up / right).toBe((line.end.y - line.start.y) / (line.end.x - line.start.x));
      // Both ends are grid intersections inside the drawn axes (x from -1 to 5, y from -1 to 6).
      for (const p of [line.start, line.end]) {
        expect(Number.isInteger(p.x) && p.x >= -1 && p.x <= 5).toBe(true);
        expect(Number.isInteger(p.y) && p.y >= -1 && p.y <= 6).toBe(true);
      }
    }
  });
});
