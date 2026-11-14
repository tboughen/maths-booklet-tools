import { describe, expect, it } from "vitest";
import { createGraph, documentFromEnvelope, graphHash, reviseGraph } from "./interchange";
import { renderDiagramSvg } from "./svg";

const spec = {
  axes: { x: { negativeSquares: 4, positiveSquares: 4, unitsPerSquare: 1 }, y: { negativeSquares: 4, positiveSquares: 4, unitsPerSquare: 1 } },
  grid: "5mm",
  objects: [
    { kind: "line", equation: { kind: "slope", slope: 2, intercept: 1 }, name: "L" },
    { kind: "point", position: { x: 1, y: 2 }, name: "A" },
    { kind: "polygon", vertices: [{ x: -3, y: -3 }, { x: -1, y: -3 }, { x: -1, y: -1 }], answerOnly: true },
  ],
};
const groupWidth = (svg: string, cls: RegExp) => [...svg.matchAll(cls)].map((m) => Number(m[1]));
const grid = /class="grid-lines[^"]*" stroke="#a9abaa" stroke-width="([\d.]+)"/g;
const halo = /<text aria-hidden="true" fill="#ffffff" stroke="#ffffff" stroke-width="([\d.]+)"/g;
const ink = (svg: string) =>
  groupWidth(svg.replace(grid, "").split(/<text\b[^>]*>/).join(""), /stroke-width="([\d.]+)"/g);

describe("coordinate graph line weight (U111)", () => {
  it("bold lines make the axes and everything plotted 1.5 times as heavy; the grid and text halos keep theirs", () => {
    const normal = documentFromEnvelope(createGraph(spec));
    const bold = { ...normal, lines: "bold" as const };
    for (const view of ["pupil", "answer"] as const) {
      const a = renderDiagramSvg(normal, view),
        b = renderDiagramSvg(bold, view);
      expect(groupWidth(b, grid)).toEqual(groupWidth(a, grid));
      expect(groupWidth(b, halo)).toEqual(groupWidth(a, halo));
      expect(ink(a).length).toBeGreaterThan(2);
      expect(ink(b)).toEqual(ink(a).map((w) => +(w * 1.5).toFixed(4)));
      expect(b).toContain('markerWidth="37.5"');
      expect(a).toContain('markerWidth="25"');
      expect(b.match(/viewBox="[^"]+"/)?.[0]).toBe(a.match(/viewBox="[^"]+"/)?.[0]);
    }
  });
  it("the connector takes lines on create and set_lines; normal is never saved", async () => {
    const e = createGraph({ ...spec, lines: "bold" });
    expect(e.document.lines).toBe("bold");
    const back = await reviseGraph({ envelope: e, baseHash: await graphHash(e), operations: [{ op: "set_lines", lines: "normal" }] });
    expect(JSON.stringify(back)).not.toContain('"lines"');
    expect(await graphHash(back)).toBe(await graphHash(createGraph(spec)));
    expect(await graphHash(e)).not.toBe(await graphHash(back));
    expect(() => createGraph({ ...spec, lines: "heavy" })).toThrow();
  });
});
