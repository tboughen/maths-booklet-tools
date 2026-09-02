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
});
