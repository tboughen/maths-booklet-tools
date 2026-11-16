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

describe("review fixes", () => {
  it("places a vector's head on the part of the segment that prints, and warns when an end head is lost", async () => {
    const { graphWarnings } = await import("./interchange");
    const e = createGraph({ objects: [
      { kind: "segment", start: { x: -10, y: 1 }, end: { x: 2, y: 1 }, arrow: "middle" },
      { kind: "segment", start: { x: 0, y: 0 }, end: { x: 10, y: 0 }, arrow: "end" },
    ] });
    const svg = renderDiagramSvg(documentFromEnvelope(e), "pupil");
    expect((svg.match(/class="vector-arrow"/g) ?? []).length).toBe(1);
    expect(graphWarnings(e).some((w) => w.includes("object-2: the end of this vector is off the grid"))).toBe(true);
  });
  it("replacing an enlargement image drops its old rays", async () => {
    const e = createGraph({ objects: [shapeA, { id: "b", kind: "image", of: "a", transformation: { kind: "enlarge", centre: { x: 0, y: 0 }, scaleFactor: 2 }, rays: true }] });
    expect(e.document.objects).toHaveLength(5);
    const r = await reviseGraph({ envelope: e, baseHash: await graphHash(e), operations: [{ op: "replace_object", id: "b", object: { kind: "image", of: "a", transformation: { kind: "translate", vector: { x: 1, y: 0 } } } }] });
    expect(r.document.objects.map((o) => o.id)).toEqual(["a", "b"]);
  });
});

describe("real-life and travel graphs", () => {
  const travel = {
    axes: {
      x: { negativeSquares: 0, positiveSquares: 14, unitsPerSquare: 10, origin: 780, labelEvery: 1, format: "time", title: "Time" },
      y: { negativeSquares: 0, positiveSquares: 4, unitsPerSquare: 1, title: "Distance from home (km)" },
    },
    grid: "2mm",
    objects: [
      { id: "trip", kind: "curve", points: [{ x: 780, y: 0 }, { x: 785, y: 0.6 }, { x: 790, y: 0.6 }, { x: 798, y: 2 }, { x: 805, y: 2 }, { x: 820, y: 3.5 }] },
      { kind: "curve", points: [{ x: 820, y: 3.5 }, { x: 830, y: 3.5 }, { x: 855, y: 0 }], answerOnly: true },
      { kind: "reading", at: { x: 798, y: 2 }, read: "x", answerOnly: true },
    ],
  } as const;
  it("draws a travel graph as joined pieces, its hidden completion only on the answers copy", () => {
    const e = createGraph(travel);
    const pupil = renderDiagramSvg(documentFromEnvelope(e), "pupil");
    const answer = renderDiagramSvg(documentFromEnvelope(e), "answer");
    expect((pupil.match(/class="graph-curve"/g) ?? []).length).toBe(1);
    expect((answer.match(/class="graph-curve"/g) ?? []).length).toBe(2);
    expect(pupil).not.toContain("graph-reading");
    expect(answer).toMatch(/class="graph-reading"[^]*?fill="#b0125b"/);
    expect(pupil).toMatch(/d="M [\d.]+ [\d.]+ L /);
  });
  it("draws smooth curves through every point and reading legs that end on the axes", async () => {
    const { readingLegs, axesCrossing } = await import("./curve");
    const e = createGraph({ objects: [{ kind: "curve", smooth: true, points: [{ x: 0, y: 5 }, { x: 2, y: 1.6 }, { x: 4, y: 0.9 }] }] });
    expect(renderDiagramSvg(documentFromEnvelope(e), "pupil")).toMatch(/class="graph-curve"[^>]* d="M [\d.]+ [\d.]+ C /);
    const legs = readingLegs({ id: "r", kind: "reading", at: { x: 3, y: 2 }, read: "y" }, axesCrossing({ x: { origin: 780 }, y: {} }));
    expect(legs).toEqual([
      { start: { x: 3, y: 0 }, end: { x: 3, y: 2 }, head: false },
      { start: { x: 3, y: 2 }, end: { x: 780, y: 2 }, head: true },
    ]);
  });
  it("prints an axis letter such as t, with the title", () => {
    const e = createGraph({ axes: { x: { negativeSquares: 0, positiveSquares: 10, unitsPerSquare: 1, name: "t", title: "Time (t seconds)" }, y: { negativeSquares: 0, positiveSquares: 6, unitsPerSquare: 5, title: "Velocity (m/s)" } }, objects: [] });
    const svg = renderDiagramSvg(documentFromEnvelope(e), "pupil");
    expect(svg).toContain(">𝑡</text>");
    expect(svg).toContain("Time (t seconds)");
    expect(svg).not.toContain(">𝑦</text>");
  });
  it("refuses repeated points and a name on a reading", () => {
    expect(() => createGraph({ objects: [{ kind: "curve", points: [{ x: 1, y: 1 }, { x: 1, y: 1 }] }] })).toThrow(/repeats/);
    expect(() => createGraph({ objects: [{ kind: "reading", at: { x: 1, y: 1 }, read: "y", name: "A" }] })).toThrow();
  });
});

describe("real-life graph review fixes", () => {
  it("refuses a saved curve with a repeated point, in both validators", async () => {
    const { isDiagramDocument } = await import("./legacy-validation");
    const e = createGraph({ objects: [{ kind: "curve", points: [{ x: 0, y: 0 }, { x: 2, y: 2 }] }] });
    const bad = structuredClone(e);
    (bad.document.objects[0] as { points: unknown[] }).points = [{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 2, y: 2 }];
    expect(() => validateEnvelope(bad)).toThrow(/repeats/);
    expect(isDiagramDocument(bad.document)).toBe(false);
  });
  it("warns about a reading on the axis it reads and rejects extra keys on a saved reading", async () => {
    const { graphWarnings } = await import("./interchange");
    const { isDiagramDocument } = await import("./legacy-validation");
    const e = createGraph({ objects: [{ kind: "reading", at: { x: 0, y: 4 }, read: "y" }] });
    expect(graphWarnings(e).some((w) => w.includes("sits on the axis it reads"))).toBe(true);
    const bad = structuredClone(e.document) as unknown as { objects: Record<string, unknown>[] };
    bad.objects[0].namePosition = { x: 1, y: 1 };
    expect(isDiagramDocument(bad)).toBe(false);
  });
});

describe("curve working and circles", () => {
  const curve = { id: "c", kind: "curve", smooth: true, points: [{ x: -2, y: 4 }, { x: -1, y: 1 }, { x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 4 }] } as const;
  it("draws a tangent as an answer-only segment touching the curve", () => {
    const e = createGraph({ objects: [curve, { kind: "tangent", of: "c", x: 1, answerOnly: true }] });
    const t = e.document.objects[1] as { kind: string; display: string; answerOnly?: boolean; start: { x: number; y: number }; end: { x: number; y: number } };
    expect(t).toMatchObject({ kind: "straight", display: "segment", answerOnly: true });
    expect((t.start.x + t.end.x) / 2).toBeCloseTo(1, 6);
    expect((t.start.y + t.end.y) / 2).toBeCloseTo(1, 1);
    const pupil = renderDiagramSvg(documentFromEnvelope(e), "pupil");
    const answer = renderDiagramSvg(documentFromEnvelope(e), "answer");
    expect(answer.length).toBeGreaterThan(pupil.length);
  });
  it("splits the area under a curve into trapezium strips", () => {
    const e = createGraph({ objects: [curve, { kind: "strips", of: "c", from: 0, to: 2, count: 4, shaded: true }] });
    const strips = e.document.objects.slice(1);
    expect(strips).toHaveLength(4);
    expect(strips.every((s) => s.kind === "polygon")).toBe(true);
    expect(strips.map((s) => s.id)).toEqual(["object-2-strip-1", "object-2-strip-2", "object-2-strip-3", "object-2-strip-4"]);
  });
  it("refuses a tangent or strips outside the curve, or of a shape that is not a curve", () => {
    expect(() => createGraph({ objects: [curve, { kind: "tangent", of: "c", x: 5 }] })).toThrow();
    expect(() => createGraph({ objects: [curve, { kind: "strips", of: "c", from: 1, to: 1, count: 2 }] })).toThrow();
    expect(() => createGraph({ objects: [shapeA, { kind: "tangent", of: "a", x: 1 }] })).toThrow();
  });
  it("draws a circle, refuses a bad radius and round-trips both validators", async () => {
    const { isDiagramDocument } = await import("./legacy-validation");
    const e = createGraph({ objects: [{ kind: "circle", centre: { x: 0, y: 0 }, radius: 3, strokeStyle: "dashed" }] });
    expect(renderDiagramSvg(documentFromEnvelope(e), "pupil")).toMatch(/<ellipse[^>]*class="graph-circle"/);
    expect(isDiagramDocument(e.document)).toBe(true);
    expect((await validateEnvelope(structuredClone(e))).document).toEqual(e.document);
    expect(() => createGraph({ objects: [{ kind: "circle", centre: { x: 0, y: 0 }, radius: 0 }] })).toThrow();
  });
  it("adds a tangent by revision", async () => {
    const e = createGraph({ objects: [curve] });
    const r = await reviseGraph({ envelope: e, baseHash: await graphHash(e), operations: [{ op: "add_object", object: { kind: "tangent", of: "c", x: -1 } }] });
    expect(r.document.objects).toHaveLength(2);
  });
});

describe("curve working review fixes", () => {
  const line = { id: "c", kind: "curve", points: [{ x: -2, y: -2 }, { x: 0, y: 0 }, { x: 3, y: 3 }] } as const;
  it("refuses strips that cross the x-axis or lie on it", () => {
    expect(() => createGraph({ objects: [line, { kind: "strips", of: "c", from: -1, to: 2, count: 1 }] })).toThrow(/crosses the x-axis/);
    const flat = { id: "f", kind: "curve", points: [{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 2 }] } as const;
    expect(() => createGraph({ objects: [flat, { kind: "strips", of: "f", from: 0, to: 2, count: 1 }] })).toThrow(/no area/);
  });
  it("gives repeated strips by revision fresh ids and refuses strips in replace_object", async () => {
    let e = createGraph({ objects: [line] });
    for (let k = 0; k < 2; k++)
      e = await reviseGraph({ envelope: e, baseHash: await graphHash(e), operations: [{ op: "add_object", object: { kind: "strips", of: "c", from: 0, to: 2, count: 2 } }] });
    const ids = e.document.objects.map((o) => o.id);
    expect(new Set(ids).size).toBe(ids.length);
    await expect(reviseGraph({ envelope: e, baseHash: await graphHash(e), operations: [{ op: "replace_object", id: "c", object: { kind: "strips", of: "c", from: 0, to: 2, count: 1 } }] })).rejects.toThrow(/add_object/);
  });
  it("warns about a circle partly off the grid, and the legacy validator refuses extra circle keys", async () => {
    const { graphWarnings } = await import("./interchange");
    const { isDiagramDocument } = await import("./legacy-validation");
    const e = createGraph({ axes: { x: { negativeSquares: 4, positiveSquares: 4, unitsPerSquare: 1 }, y: { negativeSquares: 4, positiveSquares: 4, unitsPerSquare: 1 } }, objects: [{ kind: "circle", centre: { x: 0, y: 0 }, radius: 5 }] });
    expect(graphWarnings(e).some((w) => w.includes("part of this circle is off the grid"))).toBe(true);
    const bad = structuredClone(e.document) as unknown as { objects: Record<string, unknown>[] };
    bad.objects[0].smooth = true;
    expect(isDiagramDocument(bad)).toBe(false);
  });
});
