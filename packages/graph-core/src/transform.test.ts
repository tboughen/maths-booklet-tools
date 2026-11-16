import { describe, expect, it } from "vitest";
import {
  describeTransformation,
  enlargementRays,
  imageName,
  imageObjects,
  parseMirrorLine,
  transformPoint,
  transformVertices,
} from "./transform";
import { smoothCurvePath, smoothCurveSegments } from "./curve";
import { arrowTip, arrowheadCorners } from "./arrow";
import type { PolygonObject } from "./types";

const A = [{ x: 1, y: 2 }, { x: 2, y: 5 }, { x: 5, y: 5 }, { x: 2, y: 1 }];

describe("transformations (U196, U799, U696, U519, U134)", () => {
  it("translates by a column vector", () => {
    expect(transformVertices(A, { kind: "translate", vector: { x: -3, y: 2 } })[0]).toEqual({ x: -2, y: 4 });
  });
  it("reflects in vertical, horizontal and sloping mirror lines", () => {
    expect(transformPoint({ x: 1, y: 2 }, { kind: "reflect", mirror: { kind: "vertical", x: 3 } })).toEqual({ x: 5, y: 2 });
    expect(transformPoint({ x: 1, y: 2 }, { kind: "reflect", mirror: { kind: "slope", slope: 0, intercept: -1 } })).toEqual({ x: 1, y: -4 });
    expect(transformPoint({ x: 1, y: 2 }, { kind: "reflect", mirror: { kind: "slope", slope: 1, intercept: 0 } })).toEqual({ x: 2, y: 1 });
    expect(transformPoint({ x: 1, y: 2 }, { kind: "reflect", mirror: { kind: "slope", slope: -1, intercept: 0 } })).toEqual({ x: -2, y: -1 });
    // y = x + 1: (3, 0) ↔ (−1, 4)
    expect(transformPoint({ x: 3, y: 0 }, { kind: "reflect", mirror: { kind: "slope", slope: 1, intercept: 1 } })).toEqual({ x: -1, y: 4 });
  });
  it("rotates quarter and half turns both ways about any centre", () => {
    const o = { x: 0, y: 0 };
    expect(transformPoint({ x: 2, y: 1 }, { kind: "rotate", centre: o, angle: 90, direction: "clockwise" })).toEqual({ x: 1, y: -2 });
    expect(transformPoint({ x: 2, y: 1 }, { kind: "rotate", centre: o, angle: 90, direction: "anticlockwise" })).toEqual({ x: -1, y: 2 });
    expect(transformPoint({ x: 2, y: 1 }, { kind: "rotate", centre: o, angle: 270, direction: "clockwise" })).toEqual({ x: -1, y: 2 });
    expect(transformPoint({ x: 2, y: 1 }, { kind: "rotate", centre: o, angle: 180, direction: "anticlockwise" })).toEqual({ x: -2, y: -1 });
    expect(transformPoint({ x: 3, y: 1 }, { kind: "rotate", centre: { x: 1, y: 1 }, angle: 90, direction: "anticlockwise" })).toEqual({ x: 1, y: 3 });
  });
  it("rotates every corner of a shape, keeping corner order", () => {
    const B = transformVertices(A, { kind: "rotate", centre: { x: 0, y: 0 }, angle: 90, direction: "anticlockwise" });
    expect(B).toEqual([{ x: -2, y: 1 }, { x: -5, y: 2 }, { x: -5, y: 5 }, { x: -1, y: 2 }]);
  });
  it("enlarges by fractional and negative scale factors exactly", () => {
    const c = { x: 1, y: 1 };
    expect(transformPoint({ x: 4, y: 7 }, { kind: "enlarge", centre: c, scaleFactor: 1 / 3 })).toEqual({ x: 2, y: 3 });
    expect(transformPoint({ x: 3, y: 2 }, { kind: "enlarge", centre: c, scaleFactor: -2 })).toEqual({ x: -3, y: -1 });
    expect(transformPoint({ x: 0.1, y: 0.2 }, { kind: "translate", vector: { x: 0.2, y: 0.1 } })).toEqual({ x: 0.3, y: 0.3 });
  });
  it("draws enlargement rays through the centre, the corner and the image", () => {
    expect(enlargementRays([{ x: 2, y: 1 }], { x: 0, y: 0 }, 3)).toEqual([{ start: { x: 0, y: 0 }, end: { x: 6, y: 3 } }]);
    expect(enlargementRays([{ x: 2, y: 1 }], { x: 0, y: 0 }, -2)).toEqual([{ start: { x: -4, y: -2 }, end: { x: 2, y: 1 } }]);
    expect(enlargementRays([{ x: 4, y: 2 }], { x: 0, y: 0 }, 0.5)).toEqual([{ start: { x: 0, y: 0 }, end: { x: 4, y: 2 } }]);
    expect(enlargementRays([{ x: 0, y: 0 }], { x: 0, y: 0 }, 2)).toEqual([]);
  });
  it("makes the image as plain objects, hidden when asked, with rays only for enlargements", () => {
    const shape: PolygonObject = { id: "a", kind: "polygon", vertices: A, name: "A", shaded: true };
    const out = imageObjects(shape, { kind: "enlarge", centre: { x: 0, y: 0 }, scaleFactor: 2 }, { id: "b", name: "B", shaded: true, answerOnly: true, rays: true });
    expect(out).toHaveLength(5);
    expect(out[0]).toMatchObject({ id: "b", kind: "polygon", name: "B", shaded: true, answerOnly: true });
    expect(out.slice(1).every((o) => o.kind === "straight" && o.strokeStyle === "dashed" && o.answerOnly)).toBe(true);
    expect(imageObjects(shape, { kind: "translate", vector: { x: 1, y: 1 } }, { id: "c", rays: true })).toHaveLength(1);
    expect(() => imageObjects(shape, { kind: "enlarge", centre: { x: 0, y: 0 }, scaleFactor: 0 }, { id: "d" })).toThrow(/not 0/);
  });
  it("names images as exam papers do", () => {
    expect(imageName("A", new Set(["A"]))).toBe("A′");
    expect(imageName("A′", new Set(["A", "A′"]))).toBe("B");
    expect(imageName(undefined, new Set(["A"]))).toBe("B");
  });
  it("reads mirror lines as printed", () => {
    expect(parseMirrorLine("x = 2")).toEqual({ kind: "vertical", x: 2 });
    expect(parseMirrorLine("y = −1")).toEqual({ kind: "slope", slope: 0, intercept: -1 });
    expect(parseMirrorLine("y = x")).toEqual({ kind: "slope", slope: 1, intercept: 0 });
    expect(parseMirrorLine("y=-x")).toEqual({ kind: "slope", slope: -1, intercept: 0 });
    expect(parseMirrorLine("y = 2x − 3")).toEqual({ kind: "slope", slope: 2, intercept: -3 });
    expect(parseMirrorLine("y = 1/2x + 1")).toEqual({ kind: "slope", slope: 0.5, intercept: 1 });
    expect(parseMirrorLine("y = 0x")).toBeNull();
    expect(parseMirrorLine("y = x²")).toBeNull();
  });
  it("describes a transformation as a mark scheme would", () => {
    expect(describeTransformation({ kind: "rotate", centre: { x: 0, y: 0 }, angle: 90, direction: "anticlockwise" })).toBe("rotation 90° anticlockwise about (0, 0)");
    expect(describeTransformation({ kind: "reflect", mirror: { kind: "slope", slope: -1, intercept: 2 } })).toBe("reflection in the line y = −x + 2");
    expect(describeTransformation({ kind: "enlarge", centre: { x: 1, y: 2 }, scaleFactor: -2 })).toBe("enlargement, scale factor -2, centre (1, 2)");
  });
});

describe("shared curve and arrow helpers", () => {
  it("passes through every point and is straight for collinear points", () => {
    const pts = [{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 2 }];
    const segs = smoothCurveSegments(pts);
    expect(segs.map((s) => s.end)).toEqual([{ x: 1, y: 1 }, { x: 2, y: 2 }]);
    for (const s of segs) {
      expect(s.c1.x).toBeCloseTo(s.c1.y);
      expect(s.c2.x).toBeCloseTo(s.c2.y);
    }
    expect(smoothCurvePath(pts)).toMatch(/^M 0 0 C .* 2 2$/);
    expect(smoothCurvePath([])).toBe("");
  });
  it("puts a middle arrowhead's centre on the segment's middle", () => {
    const tip = arrowTip({ x: 0, y: 0 }, { x: 10, y: 0 }, "middle", 2);
    expect(tip).toEqual({ x: 6, y: 0 });
    const [t, b, c] = arrowheadCorners({ x: 0, y: 0 }, { x: 10, y: 0 }, tip, 2, 1);
    expect(t).toEqual(tip);
    expect([b, c]).toEqual([{ x: 4, y: 1 }, { x: 4, y: -1 }]);
  });
});

describe("tangents and strips on graphs through points", async () => {
  const { curveValueAt, tangentSegment, trapeziumStrips } = await import("./curve");
  const line = [{ x: 0, y: 0 }, { x: 2, y: 4 }, { x: 4, y: 4 }];
  it("reads straight pieces exactly, taking the piece to the right at a corner", () => {
    expect(curveValueAt(line, false, 1)).toEqual({ y: 2, slope: 2 });
    expect(curveValueAt(line, false, 2)).toEqual({ y: 4, slope: 0 });
    expect(curveValueAt(line, false, 5)).toBeNull();
  });
  it("follows a smooth curve through its points, with a sensible gradient", () => {
    // Points on y = x²: the smooth curve passes through them and is close between them.
    const pts = [-3, -2, -1, 0, 1, 2, 3].map((x) => ({ x, y: x * x }));
    expect(curveValueAt(pts, true, 1)!.y).toBeCloseTo(1, 6);
    expect(curveValueAt(pts, true, 1.5)!.y).toBeCloseTo(2.25, 1);
    expect(curveValueAt(pts, true, 1)!.slope).toBeCloseTo(2, 1);
    const t = tangentSegment(pts, true, 1, 1)!;
    expect(t.touch.y).toBeCloseTo(1, 6);
    expect(t.end.x).toBe(2);
  });
  it("splits the area under a graph into equal trapezium strips", () => {
    const strips = trapeziumStrips(line, false, 0, 4, 2)!;
    expect(strips).toEqual([
      [{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 4 }],
      [{ x: 2, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 4 }, { x: 2, y: 4 }],
    ]);
    expect(trapeziumStrips(line, false, 0, 6, 3)).toBeNull();
  });
});
