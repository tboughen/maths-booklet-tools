import { describe, expect, it } from "vitest";
import * as c from "./index";
import * as io from "./interchange";
import { examples, plainShapes } from "./examples";

const at = (x: number, y: number, z: number) => ({ x, y, z });
const shapesDoc = (shapes: c.Shape[], extra: Partial<c.ElevationDocument> = {}) => {
  const e = c.blank();
  delete e.document.heights;
  e.document = { ...e.document, shapes, ...extra };
  return c.validate(e);
};
const lines = (shapes: c.Shape[], view: c.ViewName) => c.viewLines(c.buildMesh(shapes), view);
const visible = (l: c.Lines) => l.strokes.filter((s) => !s.hidden);
const hidden = (l: c.Lines) => l.strokes.filter((s) => s.hidden);
/** Total drawn length of some strokes. */
const length = (ss: c.Stroke[]) => ss.reduce((t, s) => t + s.pts.slice(1).reduce((u, p, i) => u + Math.hypot(p.x - s.pts[i].x, p.y - s.pts[i].y), 0), 0);
const near = (a: number, b: number, tol = 1e-6) => Math.abs(a - b) < tol;

const triPrism: c.Shape = { type: "prism", at: at(0, 0, 0), section: [[0, 0], [4, 0], [2, 3]], axis: "y", length: 5 };
const lPrism: c.Shape = { type: "prism", at: at(0, 0, 0), section: [[0, 0], [5, 0], [5, 2], [2, 2], [2, 4], [0, 4]], axis: "y", length: 3 };
const cylinder: c.Shape = { type: "cylinder", at: at(2, 2, 0), r: 2, h: 5, axis: "z" };
const cone: c.Shape = { type: "cone", at: at(2, 2, 0), r: 2, h: 4, axis: "z" };
const pyramid: c.Shape = { type: "pyramid", at: at(0, 0, 0), base: [[0, 0], [4, 0], [4, 4], [0, 4]], apex: at(2, 2, 3) };

describe("solids made of shapes: the mesh", () => {
  it("closes every solid: each edge belongs to exactly two faces", () => {
    for (const s of [triPrism, lPrism, cylinder, cone, pyramid, { type: "sphere", at: at(3, 3, 3), r: 2 } as c.Shape, { type: "hemisphere", at: at(3, 3, 0), r: 2, flat: "down" } as c.Shape]) {
      const m = c.buildMesh([s]);
      expect(m.edges.every((e) => e.faces.length === 2), s.type).toBe(true);
    }
  });
  it("gives a triangular prism 5 faces and 9 sharp edges", () => {
    const m = c.buildMesh([triPrism]);
    expect(m.faces.length).toBe(5);
    expect(m.edges.filter((e) => !e.smooth).length).toBe(9);
  });
  it("points every face outwards", () => {
    for (const s of [lPrism, cylinder, cone, pyramid]) {
      const m = c.buildMesh([s]);
      const b = c.bounds(m);
      const centre = at((b.min.x + b.max.x) / 2, (b.min.y + b.max.y) / 2, (b.min.z + b.max.z) / 2);
      // A convex solid's faces all face away from its centre; the L-prism is checked on its convex end faces only.
      for (const f of m.faces) {
        const p = m.points[f.ids[0]];
        const out = f.normal.x * (p.x - centre.x) + f.normal.y * (p.y - centre.y) + f.normal.z * (p.z - centre.z);
        if (s !== lPrism || Math.abs(f.normal.y) > 0.9) expect(out, s.type).toBeGreaterThan(0);
      }
    }
  });
  it("refuses a cross-section that crosses itself or has no area", () => {
    expect(() => c.buildMesh([{ ...triPrism, section: [[0, 0], [4, 4], [4, 0], [0, 4]] } as c.Shape])).toThrow();
    expect(() => c.buildMesh([{ ...triPrism, section: [[0, 0], [2, 0], [4, 0]] } as c.Shape])).toThrow();
  });
});

describe("solids made of shapes: the views", () => {
  it("draws a triangular prism's front elevation as its triangle and its plan as a rectangle with a ridge", () => {
    const front = lines([triPrism], "front");
    expect(near(length(visible(front)), 4 + 2 * Math.hypot(2, 3))).toBe(true);
    expect(hidden(front)).toEqual([]);
    const plan = lines([triPrism], "plan");
    expect(near(length(visible(plan)), 2 * (4 + 5) + 5)).toBe(true);
  });
  it("draws the L of an L-prism on its front elevation, and a plain rectangle from the side", () => {
    expect(near(length(visible(lines([lPrism], "front"))), 2 * (5 + 4))).toBe(true);
    const side = lines([lPrism], "side");
    // The step at height 2 is behind the tall part, so the side elevation is the 3 by 4 end alone.
    expect(near(length(visible(side)), 2 * (3 + 4))).toBe(true);
    expect(hidden(side).length).toBeGreaterThan(0);
    // The plan shows where the top steps down: outline 5 by 3 and the line across at x = 2.
    expect(near(length(visible(lines([lPrism], "plan"))), 2 * (5 + 3) + 3)).toBe(true);
    expect([side.min, side.max]).toEqual([{ x: -3, y: 0 }, { x: 0, y: 4 }]);
  });
  it("draws a cylinder's plan as a circle and its elevation as a rectangle", () => {
    const plan = lines([cylinder], "plan");
    expect(near(length(visible(plan)), c.STRIPS * 2 * 2 * Math.sin(Math.PI / c.STRIPS))).toBe(true);
    const front = lines([cylinder], "front");
    expect(near(length(visible(front)), 2 * (4 + 5))).toBe(true);
  });
  it("marks a cone's apex with a dot on its plan, and draws its front elevation as a triangle", () => {
    expect(lines([cone], "plan").dots).toEqual([{ x: 2, y: 2 }]);
    expect(lines([cone], "front").dots).toEqual([]);
    expect(near(length(visible(lines([cone], "front"))), 4 + 2 * Math.hypot(2, 4))).toBe(true);
  });
  it("draws a square pyramid's plan as a square with both diagonals", () => {
    expect(near(length(visible(lines([pyramid], "plan"))), 16 + 2 * Math.hypot(4, 4))).toBe(true);
  });
  it("leaves out the seam where a pyramid roof sits on a cube, on the plan and elevations", () => {
    const house: c.Shape[] = [
      { type: "prism", at: at(0, 0, 0), section: [[0, 0], [4, 0], [4, 4], [0, 4]], axis: "y", length: 4 },
      { type: "pyramid", at: at(0, 0, 4), base: [[0, 0], [4, 0], [4, 4], [0, 4]], apex: at(2, 2, 2) },
    ];
    // The plan is the roof alone: square and diagonals, no hidden lines left over on top of them.
    const plan = lines(house, "plan");
    expect(near(length(visible(plan)), 16 + 2 * Math.hypot(4, 4))).toBe(true);
    expect(hidden(plan)).toEqual([]);
    // The front elevation keeps the line where the roof meets the walls (a real edge of the outline there).
    const front = lines(house, "front");
    expect(near(length(visible(front)), 4 * 3 + 4 + 2 * Math.hypot(2, 2))).toBe(true);
  });
  it("hides the back edges of a prism in the isometric drawing", () => {
    const iso = lines([triPrism], "isometric");
    expect(hidden(iso).length).toBeGreaterThan(0);
    expect(visible(iso).length).toBeGreaterThan(0);
  });
});

describe("solids made of shapes: the document", () => {
  it("needs cubes or shapes, never both, and lengths only on shapes", () => {
    const e = c.blank();
    e.document.shapes = [triPrism];
    expect(() => c.validate(e)).toThrow(/not both/);
    delete e.document.shapes;
    e.document.lengths = [{ a: at(0, 0, 0), b: at(1, 0, 0), text: "1 cm", show: "show" }];
    expect(() => c.validate(e)).toThrow(/Lengths go on a solid made of shapes/);
    delete e.document.heights;
    delete e.document.lengths;
    expect(() => c.validate(e)).toThrow(/needs cubes/);
  });
  it("keeps the solid inside 0 to 12 squares and names the shape at fault", () => {
    expect(() => shapesDoc([{ ...cylinder, at: at(1, 2, 0) } as c.Shape])).toThrow(/must fit/);
    expect(() => shapesDoc([{ ...cylinder, r: 2.3 } as c.Shape])).toThrow(/Shape 1 radius: Use whole or half squares/);
    expect(() => shapesDoc([triPrism, { ...cone, h: 0 } as c.Shape])).toThrow(/Shape 2 size along its axis/);
  });
  it("saves dashed hidden lines only when asked", () => {
    expect(c.canonical(shapesDoc([triPrism], { hiddenLines: "none" as never }))).not.toContain("hiddenLines");
    const dashed = shapesDoc([triPrism], { hiddenLines: "dashed" });
    expect(dashed.document.hiddenLines).toBe("dashed");
    expect(c.renderSvg(dashed)).toMatch(/stroke-dasharray/);
    expect(c.renderSvg(shapesDoc([triPrism]))).not.toMatch(/stroke-dasharray/);
  });
  it("hides a length from pupils and shows it on the answers copy", () => {
    const e = shapesDoc([triPrism], { lengths: [{ a: at(0, 0, 0), b: at(4, 0, 0), text: "4 cm", show: "hidden" }] });
    expect(c.hasHidden(e)).toBe(true);
    expect(c.renderSvg(e, "pupil")).not.toContain("4 cm");
    expect(c.renderSvg(e, "answer")).toContain("4 cm");
    expect(c.forView(e, "answer").document.lengths![0].show).toBe("show");
  });
  it("describes the solid for screen readers", () => {
    expect(c.solidDescription(shapesDoc([triPrism, cone]).document)).toBe("Solid made of a prism and a cone");
  });
  it("round-trips every shapes example through files and links, at one size on both copies", () => {
    const all = [...examples.map((x) => () => x.make(false)), ...examples.map((x) => () => x.make(true)), ...plainShapes.map((x) => x.make)];
    for (const make of all) {
      const e = make();
      expect(c.parseFile(JSON.stringify(e))).toEqual(e);
      expect(c.decodeLinkHash(c.linkHash(e))).toEqual(e);
      expect(c.exportIssue(e)).toBeNull();
      const [p, a] = [c.layout(e, "pupil"), c.layout(e, "answer")];
      expect([p.width, p.height]).toEqual([a.width, a.height]);
    }
  });
  it("prints grids for a shapes view with a spare square and draws on grid lines", () => {
    const e = shapesDoc([cylinder], { panels: [c.panel("plan", "drawn"), c.panel("front", "answer")] });
    expect(c.viewSpan(e.document, "plan")).toEqual({ x0: 0, y0: 0, across: 4, up: 4 });
    expect(c.viewSpan(e.document, "front")).toEqual({ x0: 0, y0: 0, across: 4, up: 5 });
    expect(c.renderSvg(e, "pupil")).toContain("<svg");
  });
});

describe("solids made of shapes: the connector", () => {
  it("creates a shapes solid with lengths, and refuses cubes and shapes together", () => {
    const e = io.create({ spec: { shapes: [triPrism], lengths: [{ a: at(0, 0, 0), b: at(4, 0, 0), text: "4 cm", hidden: true }], panels: [{ view: "isometric" }, { view: "front", state: "answer" }] } });
    expect(e.document.heights).toBeUndefined();
    expect(e.document.lengths).toEqual([{ a: at(0, 0, 0), b: at(4, 0, 0), text: "4 cm", show: "hidden" }]);
    expect(() => io.create({ spec: { heights: [[1]], shapes: [triPrism] } })).toThrow(/not both/);
  });
  it("switches between cubes and shapes and refuses set_height on shapes", async () => {
    const cubes = io.create({ spec: { heights: [[1, 2]] } });
    const shaped = await io.revise({ envelope: cubes, baseHash: await c.hash(cubes), operations: [{ op: "set_shapes", shapes: [cone] }, { op: "set_settings", settings: { hiddenLines: "dashed" } }] });
    expect(shaped.document.heights).toBeUndefined();
    expect(shaped.document.shapes).toEqual([cone]);
    expect(shaped.document.hiddenLines).toBe("dashed");
    await expect(io.revise({ envelope: shaped, baseHash: await c.hash(shaped), operations: [{ op: "set_height", row: 0, column: 0, height: 1 }] })).rejects.toThrow(/made of shapes/);
    const withLengths = await io.revise({ envelope: shaped, baseHash: await c.hash(shaped), operations: [{ op: "set_lengths", lengths: [{ a: at(2, 2, 0), b: at(2, 2, 4), text: "4 cm" }] }] });
    const back = await io.revise({ envelope: withLengths, baseHash: await c.hash(withLengths), operations: [{ op: "set_heights", heights: [[1]] }] });
    expect(back.document.shapes).toBeUndefined();
    expect(back.document.lengths).toBeUndefined();
  });
});
