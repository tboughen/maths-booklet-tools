// @vitest-environment node
// A long y-axis title above the axis, as many Edexcel graphs print it, so a titled graph stays
// narrow enough to sit beside a ratio table in a third-width column (A3 worksheets, 16 Nov 2026).
import { describe, expect, it } from "vitest";
import { createGraph, documentFromEnvelope } from "./interchange";
import { axisTextPlacement, getExportMetrics, renderDiagramSvg } from "./svg";

const graph = (y: Record<string, unknown>) =>
  documentFromEnvelope(
    createGraph({
      axes: {
        x: { negativeSquares: 0, positiveSquares: 6, unitsPerSquare: 10, title: "Time (min)" },
        y: { negativeSquares: 0, positiveSquares: 6, unitsPerSquare: 5, labelEvery: 2, title: "Distance from home (km)", ...y },
      },
      objects: [{ kind: "segment", id: "a", start: { x: 0, y: 0 }, end: { x: 30, y: 25 } }],
    }),
  );

describe("y-axis title above the axis", () => {
  it("keeps the graph narrow and adds room above instead", () => {
    const beside = getExportMetrics(graph({})),
      above = getExportMetrics(graph({ titleAbove: true }));
    expect(above.layout.plotLeft).toBeLessThan(beside.layout.plotLeft - 150);
    expect(above.widthCm).toBeLessThan(beside.widthCm - 1.5);
    expect(above.layout.plotTop).toBeGreaterThan(beside.layout.plotTop);
    // The title fits on one line above a 6 cm graph and its left edge stays in the picture.
    const placement = axisTextPlacement(graph({ titleAbove: true }));
    expect(placement.yTitle?.lines).toEqual(["Distance from home (km)"]);
    expect(above.layout.plotLeft + placement.yTitle!.leftFromPlotLeft).toBeGreaterThan(0);
    const first = above.layout.plotTop + placement.yTitle!.firstBaselineFromPlotTop!;
    expect(first).toBeGreaterThan(20);
    const svg = renderDiagramSvg(graph({ titleAbove: true }));
    expect(svg).toContain(">Distance from home (km)</tspan>");
  });
  it("keeps a title above an axis at the plot's right edge inside the picture", () => {
    const d = documentFromEnvelope(
      createGraph({
        axes: {
          x: { negativeSquares: 6, positiveSquares: 0, unitsPerSquare: 1 },
          y: { negativeSquares: 0, positiveSquares: 6, unitsPerSquare: 1, title: "Distance from home (km)", titleAbove: true },
        },
        objects: [],
      }),
    );
    // The axis is at the plot's right edge; the title starts just left of it and runs past it,
    // so the picture widens to keep the whole of "Distance from" in it.
    const m = getExportMetrics(d), y = axisTextPlacement(d).yTitle!;
    expect(y.lines[0]).toBe("Distance from");
    expect(m.width).toBeGreaterThan(m.layout.plotLeft + y.leftFromPlotLeft + 280);
  });
  it("leaves graphs without it exactly as before", () => {
    expect(getExportMetrics(graph({})).layout.plotTop).toBe(70);
    expect(axisTextPlacement(graph({})).yTitle).not.toHaveProperty("firstBaselineFromPlotTop");
  });
  it("is y-only, needs a title, and is saved", () => {
    expect(() => graph({ title: undefined, titleAbove: true })).toThrow(/title to print above/);
    expect(() =>
      createGraph({
        axes: {
          x: { negativeSquares: 0, positiveSquares: 6, unitsPerSquare: 1, title: "Time", titleAbove: true },
          y: { negativeSquares: 0, positiveSquares: 6, unitsPerSquare: 1 },
        },
        objects: [],
      }),
    ).toThrow(/Only the y-axis/);
    const env = createGraph({
      axes: {
        x: { negativeSquares: 0, positiveSquares: 6, unitsPerSquare: 1 },
        y: { negativeSquares: 0, positiveSquares: 6, unitsPerSquare: 1, title: "Speed (m/s)", titleAbove: true },
      },
      objects: [],
    });
    expect(documentFromEnvelope(env).axes.y.titleAbove).toBe(true);
  });
});
