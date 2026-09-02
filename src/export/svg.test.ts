import { describe, expect, it } from "vitest";
import { cloneDefaultDocument } from "../domain/diagram";
import type { DiagramDocumentV1 } from "../domain/types";
import { getExportMetrics, renderDiagramSvg } from "./svg";

function populatedDocument(): DiagramDocumentV1 {
  return {
    ...cloneDefaultDocument(),
    objects: [
      { id: "point-1", kind: "point", position: { x: 2, y: -1 } },
      {
        id: "straight-1",
        kind: "straight",
        display: "line",
        start: { x: -5, y: -4 },
        end: { x: 4, y: 5 },
        equationVisible: true,
      },
      {
        id: "straight-2",
        kind: "straight",
        display: "segment",
        strokeStyle: "dashed",
        start: { x: -3, y: 2 },
        end: { x: 3, y: 2 },
        equationVisible: false,
      },
    ],
    selectedObjectId: "straight-1",
  };
}

describe("print SVG export", () => {
  it("uses one centimetre of physical width for every grid square", () => {
    const metrics = getExportMetrics(cloneDefaultDocument());
    expect(metrics.layout.square).toBe(100);
    expect(metrics.widthCm).toBe(11.7);
    expect(metrics.heightCm).toBe(11.55);
    expect(metrics.layout.plotRight - metrics.layout.plotLeft).toBe(1000);
  });

  it("exports every object but none of the blue editing guides", () => {
    const svg = renderDiagramSvg(populatedDocument());

    expect(svg).toContain('width="11.7cm"');
    expect(svg).toContain('height="11.55cm"');
    expect(svg).toContain("containing 3 plotted objects");
    expect(svg).toContain("y = x + 1");
    expect(svg.match(/<g stroke="#202224"/g)).toHaveLength(2);
    expect(svg.match(/stroke-dasharray="18 12"/g)).toHaveLength(1);
    expect(svg).not.toMatch(/selected|handle|#2563eb|#2f6fed/i);
  });

  it("updates its physical size as grid squares are added", () => {
    const document = cloneDefaultDocument();
    document.axes.x.positiveSquares += 2;
    document.axes.y.negativeSquares += 1;
    const metrics = getExportMetrics(document);

    expect(metrics.widthCm).toBe(13.7);
    expect(metrics.heightCm).toBe(12.55);
  });

  it("uses the measured exam-style type, label knockouts, and physical line weights", () => {
    const svg = renderDiagramSvg(cloneDefaultDocument());
    const metrics = getExportMetrics(cloneDefaultDocument());
    const axisLines = [...svg.matchAll(/<line x1="([^"]+)" y1="([^"]+)" x2="([^"]+)" y2="([^"]+)" marker-end="url\(#axis-arrow\)"\/>/g)];

    expect(svg).toContain('class="grid-lines" stroke="#a9abaa" stroke-width="5.292"');
    expect(svg).toContain('class="graph-axes" stroke="#1f2224" stroke-width="7.056"');
    expect(svg).toContain("font-family=\"'Cambria Math', Cambria, 'Times New Roman', serif\"");
    expect(svg).toContain('font-size="42.333"');
    expect(svg.match(/class="axis-number/g)).toHaveLength(21);
    expect(svg).toContain('class="axis-number axis-number-origin"');
    expect(svg).toMatch(/axis-number-origin[^]*?<text[^>]*transform="[^"]*skewX\(-12\)[^"]*"[^>]*>0<\/text>/);
    expect(svg.match(/class="axis-number[^]*?<rect[^>]*fill="#ffffff"/g)).toHaveLength(21);
    expect(svg).toContain(">−5</text>");
    expect(Number(axisLines[0]?.[3]) - metrics.layout.plotRight).toBeCloseTo(23.333, 3);
    expect(metrics.layout.plotTop - Number(axisLines[1]?.[4])).toBeCloseTo(23.333, 3);
  });

  it("aligns the y axis name with the y-axis numbers", () => {
    const svg = renderDiagramSvg(cloneDefaultDocument());
    const yNameX = svg.match(/class="axis-name axis-name-y" x="([^"]+)"/)?.[1];
    const yNumberXs = [...svg.matchAll(/class="axis-number"><rect[^>]*\/><text x="([^"]+)"[^>]*text-anchor="end"/g)]
      .map((match) => match[1]);

    expect(yNameX).toBeDefined();
    expect(yNumberXs).toHaveLength(10);
    expect(new Set(yNumberXs)).toEqual(new Set([yNameX as string]));
    expect(595 - Number(yNameX)).toBe(12);
  });

  it("aligns the Cambria Math x name with the x-axis numbers", () => {
    const svg = renderDiagramSvg(cloneDefaultDocument());
    const xNameBaseline = svg.match(/class="axis-name axis-name-x"[^>]* y="([^"]+)"/)?.[1];
    const firstXNumberBaseline = svg.match(/class="axis-number"><rect[^>]*\/><text[^>]* y="([^"]+)" text-anchor="middle"/)?.[1];

    expect(xNameBaseline).toBeDefined();
    expect(xNameBaseline).toBe(firstXNumberBaseline);
    expect(svg).toMatch(/class="axis-name axis-name-x"[^>]*font-family="'Cambria Math'[^>]*>𝑥<\/text>/);
    expect(svg).toMatch(/class="axis-name axis-name-y"[^>]*font-family="'Cambria Math'[^>]*>𝑦<\/text>/);
  });
});
