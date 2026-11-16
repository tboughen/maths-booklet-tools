import { describe, expect, it } from "vitest";
import { createGraph, documentFromEnvelope, graphHash, reviseGraph, validateEnvelope } from "./interchange";
import { renderDiagramSvg } from "./svg";

const shapeA = { id: "a", kind: "polygon", vertices: [{ x: 1, y: 1 }, { x: 3, y: 1 }, { x: 1, y: 2 }], name: "A", shaded: true } as const;

describe("graph images and vectors", () => {
  it("creates an exact image from an earlier shape, hidden on the pupil copy", () => {
    const e = createGraph({
      objects: [shapeA, { kind: "image", of: "a", transformation: { kind: "reflect", mirror: { kind: "slope", slope: 1, intercept: 0 } }, name: "B", shaded: true, answerOnly: true }],
    });
    const b = e.document.objects[1];
    expect(b).toMatchObject({ id: "object-2", kind: "polygon", name: "B", answerOnly: true, vertices: [{ x: 1, y: 1 }, { x: 1, y: 3 }, { x: 2, y: 1 }] });
    const pupil = renderDiagramSvg(documentFromEnvelope(e), "pupil");
    const answer = renderDiagramSvg(documentFromEnvelope(e), "answer");
    expect((pupil.match(/class="graph-polygon"/g) ?? []).length).toBe(1);
    expect((answer.match(/class="graph-polygon"/g) ?? []).length).toBe(2);
  });
  it("adds enlargement rays and accepts fractional and negative scale factors", () => {
    const e = createGraph({ objects: [shapeA, { kind: "image", of: "a", transformation: { kind: "enlarge", centre: { x: 0, y: 0 }, scaleFactor: "-1/2" }, rays: true }] });
    expect(e.document.objects).toHaveLength(5);
    expect(e.document.objects[1]).toMatchObject({ vertices: [{ x: -0.5, y: -0.5 }, { x: -1.5, y: -0.5 }, { x: -0.5, y: -1 }] });
    expect(e.document.objects[2]).toMatchObject({ kind: "straight", display: "segment", strokeStyle: "dashed", start: { x: -0.5, y: -0.5 }, end: { x: 1, y: 1 } });
  });
  it("refuses an image of a missing shape, rays on a reflection and a zero scale factor", () => {
    expect(() => createGraph({ objects: [{ kind: "image", of: "a", transformation: { kind: "translate", vector: { x: 1, y: 0 } } }] })).toThrow(/no earlier shape/);
    expect(() => createGraph({ objects: [shapeA, { kind: "image", of: "a", rays: true, transformation: { kind: "reflect", mirror: { kind: "vertical", x: 0 } } }] })).toThrow(/enlargement only/);
    expect(() => createGraph({ objects: [shapeA, { kind: "image", of: "a", transformation: { kind: "enlarge", centre: { x: 0, y: 0 }, scaleFactor: 0 } }] })).toThrow(/not 0/);
  });
  it("adds an image by revision", async () => {
    const e = createGraph({ objects: [shapeA] });
    const r = await reviseGraph({
      envelope: e,
      baseHash: await graphHash(e),
      operations: [{ op: "add_object", object: { kind: "image", of: "a", transformation: { kind: "rotate", centre: { x: 0, y: 0 }, angle: 180 } } }],
    });
    expect(r.document.objects[1]).toMatchObject({ id: "object-1", vertices: [{ x: -1, y: -1 }, { x: -3, y: -1 }, { x: -1, y: -2 }] });
  });
  it("draws vector arrowheads on segments only, in the answer colour when hidden", () => {
    const e = createGraph({
      objects: [
        { kind: "segment", start: { x: 0, y: 0 }, end: { x: 3, y: 2 }, arrow: "middle" },
        { kind: "segment", start: { x: 0, y: 0 }, end: { x: -2, y: 1 }, arrow: "end", answerOnly: true },
      ],
    });
    expect(e.document.objects[0]).toMatchObject({ arrow: "middle" });
    expect((renderDiagramSvg(documentFromEnvelope(e), "pupil").match(/class="vector-arrow"/g) ?? []).length).toBe(1);
    expect(renderDiagramSvg(documentFromEnvelope(e), "answer")).toMatch(/class="vector-arrow"[^>]*fill="#b0125b"/);
    expect(() => createGraph({ objects: [{ kind: "line", start: { x: 0, y: 0 }, end: { x: 1, y: 1 }, arrow: "end" }] })).toThrow(/only a segment/);
    const bad = structuredClone(e);
    (bad.document.objects[0] as { display: string }).display = "line";
    expect(() => validateEnvelope(bad)).toThrow(/only a segment/);
  });
});
