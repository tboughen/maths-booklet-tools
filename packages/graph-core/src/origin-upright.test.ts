// @vitest-environment node
// A numeric origin label prints upright like the other axis numbers (A7.11, 16 Nov 2026).
import { expect, it } from "vitest";
import { createGraph, documentFromEnvelope } from "./interchange";
import { renderDiagramSvg } from "./svg";

it("prints an origin label of 0 upright, never slanted like the italic O", () => {
  const svg = renderDiagramSvg(
    documentFromEnvelope(
      createGraph({
        originLabel: "0",
        axes: {
          x: { negativeSquares: 0, positiveSquares: 6, unitsPerSquare: 10, title: "Time (min)" },
          y: { negativeSquares: 0, positiveSquares: 6, unitsPerSquare: 5, title: "Distance (km)" },
        },
        objects: [],
      }),
    ),
  );
  expect(svg).toContain("axis-number-origin");
  expect(svg).not.toContain("skewX");
});
