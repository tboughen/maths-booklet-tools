// @vitest-environment node
// Gradient triangles on straight lines (U76).
import { describe, expect, it } from "vitest";
import { createGraph, documentFromEnvelope, graphHash, graphWarnings, parseGraphFile, reviseGraph } from "./interchange";
import { isDiagramDocument } from "./legacy-validation";
import { gradientTriangleCorners, gradientTriangleValues } from "./gradient-triangle";
import { renderDiagramSvg } from "./svg";

const axes = {
  x: { negativeSquares: 2, positiveSquares: 8, unitsPerSquare: 1 },
  y: { negativeSquares: 2, positiveSquares: 10, unitsPerSquare: 1 },
};
const line = (gradientTriangle?: object) =>
  createGraph({ axes, objects: [{ kind: "line", id: "L", equation: { kind: "slope", slope: 2, intercept: 1 }, ...(gradientTriangle ? { gradientTriangle } : {}) }] });

describe("gradient triangles (U76)", () => {
  it("places the right angle under the end and prints run and rise", () => {
    const object = documentFromEnvelope(line({ x: 1, run: 3, labels: "values" })).objects[0];
    if (object.kind !== "straight") throw Error("line expected");
    expect(gradientTriangleCorners(object)).toEqual({ start: { x: 1, y: 3 }, corner: { x: 4, y: 3 }, end: { x: 4, y: 9 } });
    expect(gradientTriangleValues(object)).toEqual({ run: "3", rise: "6" });
    const svg = renderDiagramSvg(documentFromEnvelope(line({ x: 1, run: 3, labels: "values" })));
    expect(svg).toContain('class="gradient-triangle"');
    expect(svg).toContain(">3</text>");
    expect(svg).toContain(">6</text>");
  });

  it("keeps blank labels blank on the pupil copy and prints them in pink on the answers copy", () => {
    const document = documentFromEnvelope(line({ x: 1, run: 3, labels: "blank" }));
    const pupil = renderDiagramSvg(document, "pupil");
    const answer = renderDiagramSvg(document, "answer");
    const pupilLabels = pupil.match(/<g class="gradient-labels"[\s\S]*?<\/g>\s*<\/g>/)?.[0] ?? "";
    expect(pupilLabels).toContain(">………</text>");
    expect(pupilLabels).not.toMatch(/>[36]</);
    expect(pupil).not.toContain("gradient-labels-answer");
    expect(answer).toMatch(/gradient-labels-answer[^>]*fill="#b0125b"[\s\S]*>6<\/text>/);
  });

  it("draws no labels unless asked and leaves files without a triangle unchanged", async () => {
    const svg = renderDiagramSvg(documentFromEnvelope(line({ x: 1, run: -2 })));
    expect(svg).toContain('class="gradient-triangle"');
    expect(svg).not.toContain("gradient-labels");
    const plain = line();
    expect(JSON.stringify(plain)).not.toContain("gradientTriangle");
    expect(renderDiagramSvg(documentFromEnvelope(plain))).not.toContain("gradient");
  });

  it("refuses a zero run, warns when off the grid, round-trips and revises", async () => {
    expect(() => line({ x: 1, run: 0 })).toThrow(/run that is not zero/);
    expect(graphWarnings(line({ x: 4, run: 3 }))).toContain("L: the gradient triangle runs off the grid. Start it elsewhere or shorten the run.");
    const e = line({ x: 1, run: 3, labels: "values" });
    expect(parseGraphFile(JSON.stringify(e))).toEqual(e);
    expect(isDiagramDocument(documentFromEnvelope(e))).toBe(true);
    const revised = await reviseGraph({
      envelope: e,
      baseHash: await graphHash(e),
      operations: [{ op: "replace_object", id: "L", object: { kind: "line", equation: { kind: "slope", slope: -1, intercept: 8 }, gradientTriangle: { x: 2, run: 2, labels: "blank" } } }],
    });
    const object = documentFromEnvelope(revised).objects[0];
    expect(object).toMatchObject({ gradientTriangle: { x: 2, run: 2, labels: "blank" } });
    if (object.kind === "straight") expect(gradientTriangleValues(object)).toEqual({ run: "2", rise: "−2" });
  });
});
