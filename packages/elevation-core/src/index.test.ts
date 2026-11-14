import { describe, expect, it } from "vitest";
import * as c from "./index";
import * as io from "./interchange";
import { examples } from "./examples";

const doc = (heights: number[][]) => {
  const e = c.blank();
  e.document.heights = heights;
  return c.validate(e).document;
};
const filledCount = (f: c.Flat) => f.filled.flat().filter(Boolean).length;

describe("plans and elevations", () => {
  it("reads the plan, front and side views from the height map", () => {
    const d = doc([[2, 1, 1], [3, 0, 0]]); // row 0 is the front
    const plan = c.flatView(d, "plan"),
      front = c.flatView(d, "front"),
      side = c.flatView(d, "side");
    expect([plan.across, plan.up, filledCount(plan)]).toEqual([3, 2, 4]);
    expect([front.across, front.up, filledCount(front)]).toEqual([3, 3, 5]);
    // From the left the back row (height 3) is on the left, the front row (2) on the right.
    expect(side.filled.map((col) => col.filter(Boolean).length)).toEqual([3, 2]);
  });

  it("draws a line where the surface steps, and none between level squares", () => {
    const plan = c.flatView(doc([[1, 1]]), "plan");
    expect(plan.edges.some((e) => e.x1 === 1 && e.x2 === 1)).toBe(false);
    const stepped = c.flatView(doc([[2, 1]]), "plan");
    expect(stepped.edges.some((e) => e.x1 === 1 && e.x2 === 1)).toBe(true);
    // The front elevation of a front cube and a taller one behind it shows the step back.
    const front = c.flatView(doc([[1], [2]]), "front");
    expect(front.edges.some((e) => e.y1 === 1 && e.y2 === 1)).toBe(true);
  });

  it("paints only visible isometric faces, far ones first", () => {
    const faces = c.isoFaces(doc([[1, 1]]));
    expect(faces).toHaveLength(5); // two tops, two fronts, one left side
    for (let i = 1; i < faces.length; i++) expect(faces[i - 1].key).toBeGreaterThanOrEqual(faces[i].key);
  });

  it("prints grids at the cube edge size and keeps answers off the pupil copy", () => {
    const e = c.create();
    const pupil = c.renderSvg(e),
      answer = c.renderSvg(c.forView(e, "answer"));
    expect(pupil).not.toContain('stroke-width="0.5"');
    expect(answer).toContain('stroke-width="0.5"');
    const two = c.validate({ ...e, document: { ...e.document, unitCm: 2, panels: [c.panel("front", "blank")] } });
    expect(c.layout(two).placed[0].b.width).toBe(2 * 10 * (3 + 2)); // 3 columns plus a spare square each side, 2 cm each
  });

  it("refuses ragged or empty solids", () => {
    const e = c.blank();
    e.document.heights = [[1, 2], [1]];
    expect(() => c.validate(e)).toThrow(/same number/);
    e.document.heights = [[0]];
    expect(() => c.validate(e)).toThrow(/at least one/);
  });

  it("round-trips examples through files and links", () => {
    for (const x of examples)
      for (const worked of [false, true]) {
        const e = x.make(worked);
        expect(c.parseFile(JSON.stringify(e))).toEqual(e);
        expect(c.decodeLinkHash(c.linkHash(e))).toEqual(e);
        expect(c.exportIssue(e), x.id).toBeNull();
      }
    expect(c.editorLink(c.create(), "https://mathsdock.co.uk/")).toBeNull();
  });

  it("builds and revises through the connector adapter", async () => {
    const e = io.create({ spec: { heights: [[1, 2]], panels: [{ view: "isometric" }, { view: "plan", state: "answer" }], settings: { unitCm: 2 } } });
    expect(e.document.panels[1]).toMatchObject({ view: "plan", state: "answer", label: { text: "Plan" } });
    const out = await io.revise({
      envelope: e,
      baseHash: await c.hash(e),
      operations: [{ op: "set_height", row: 0, column: 0, height: 3 }, { op: "set_panel", index: 1, panel: { state: "drawn" } }],
    });
    expect(out.document.heights[0][0]).toBe(3);
    expect(out.document.panels[1].state).toBe("drawn");
    await expect(io.revise({ envelope: e, baseHash: await c.hash(e), operations: [{ op: "set_height", row: 4, column: 0, height: 1 }] })).rejects.toThrow(/rows/);
    for (const example of io.exampleIds) expect(c.exportIssue(io.create({ spec: { example } }))).toBeNull();
  });
});
