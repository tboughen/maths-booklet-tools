// @vitest-environment node
// Shapes for transformation questions (U72).
import { describe, expect, it } from "vitest";
import { createGraph, describeGraph, documentFromEnvelope, graphHash, graphWarnings, parseGraphFile, reviseGraph } from "./interchange";
import { isDiagramDocument } from "./legacy-validation";
import { polygonCentroid, polygonProblem } from "./polygon";
import { renderDiagramSvg } from "./svg";

const axes = {
  x: { negativeSquares: 6, positiveSquares: 6, unitsPerSquare: 1 },
  y: { negativeSquares: 6, positiveSquares: 6, unitsPerSquare: 1 },
};
const reflection = () =>
  createGraph({
    axes,
    objects: [
      { kind: "polygon", id: "A", vertices: [{ x: 1, y: 1 }, { x: 4, y: 1 }, { x: 1, y: 3 }], name: "A", shaded: true },
      { kind: "polygon", id: "B", vertices: [{ x: -1, y: 1 }, { x: -4, y: 1 }, { x: -1, y: 3 }], name: "B", answerOnly: true },
    ],
  });

describe("shapes for transformations (U72)", () => {
  it("draws the object on the pupil copy and the image only on the answers copy", () => {
    const document = documentFromEnvelope(reflection());
    const pupil = renderDiagramSvg(document, "pupil");
    const answer = renderDiagramSvg(document, "answer");
    expect(pupil.match(/<polygon /g)).toHaveLength(1);
    expect(pupil).toContain('fill="#d4d4d4"');
    expect(pupil).toMatch(/object-name-polygon[^>]*>.*>A</);
    expect(pupil).not.toMatch(/>B</);
    expect(answer.match(/<polygon /g)).toHaveLength(2);
    expect(answer).toMatch(/object-name-polygon object-name-answer/);
  });

  it("prints the name upright at the centre of the shape", () => {
    expect(polygonCentroid([{ x: 1, y: 1 }, { x: 4, y: 1 }, { x: 1, y: 3 }])).toEqual({ x: 2, y: 5 / 3 });
    const svg = renderDiagramSvg(documentFromEnvelope(reflection()));
    expect(svg).toContain(">A</text>");
    expect(svg).not.toContain("𝐴");
  });

  it("refuses repeated corners and flat shapes with a specific message", () => {
    expect(polygonProblem([{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 1 }])).toMatch(/corner 1 repeats/);
    expect(polygonProblem([{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 2 }])).toMatch(/no area/);
    expect(() => createGraph({ axes, objects: [{ kind: "polygon", vertices: [{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 2 }] }] })).toThrow(/no area/);
    expect(() => createGraph({ axes, objects: [{ kind: "polygon", vertices: [{ x: 0, y: 0 }, { x: 1, y: 1 }] }] })).toThrow();
  });

  it("round-trips through the saved file, revises by ID and warns when clipped", async () => {
    const e = reflection();
    expect(parseGraphFile(JSON.stringify(e))).toEqual(e);
    expect(isDiagramDocument(documentFromEnvelope(e))).toBe(true);
    expect(describeGraph(e)).toContain("A: shaded shape with corners (1, 1) (4, 1) (1, 3) named A");
    const moved = await reviseGraph({
      envelope: e,
      baseHash: await graphHash(e),
      operations: [{ op: "replace_object", id: "A", object: { kind: "polygon", vertices: [{ x: 1, y: 1 }, { x: 9, y: 1 }, { x: 1, y: 3 }], name: "A" } }],
    });
    const shape = documentFromEnvelope(moved).objects[0];
    expect(shape).toEqual({ id: "A", kind: "polygon", vertices: [{ x: 1, y: 1 }, { x: 9, y: 1 }, { x: 1, y: 3 }], name: "A" });
    expect(graphWarnings(moved)).toContain("A is outside the visible grid.");
  });
});
