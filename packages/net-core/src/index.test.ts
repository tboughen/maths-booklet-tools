import { describe, expect, it } from "vitest";
import * as core from "./index";
import { examples } from "./examples";

const faceCount = (svg: string) => (svg.match(/<path d="M[^"]*Z"/g) ?? []).length;

describe("folding", () => {
  it("folds all 11 cube nets into a cube with three opposite pairs", () => {
    expect(core.CUBE_NETS).toHaveLength(11);
    core.CUBE_NETS.forEach((_, i) => {
      const r = core.foldBox(core.cubeNet(i, 2));
      expect(r?.ok, `net ${i + 1}`).toBe(true);
      if (!r?.ok) return;
      expect(r.solid).toBe("cube");
      expect(r.opposite.every((j, k) => r.opposite[j] === k && j !== k)).toBe(true);
    });
  });
  it("finds the opposite faces of the cross", () => {
    // 1-4-1 cross: top square above the second square of the strip, bottom below it.
    const r = core.foldBox(core.cubeNet(4, 1));
    if (!r?.ok) throw Error("should fold");
    // Order: top, strip 1-4, bottom. Top is opposite bottom; strip faces 1 and 3, 2 and 4.
    expect(r.opposite).toEqual([5, 3, 4, 1, 2, 0]);
  });
  it("refuses arrangements that are not nets", () => {
    const block = core.squaresNet([
      [0, 0],
      [1, 0],
      [0, 1],
      [1, 1],
      [2, 1],
      [3, 1],
    ]);
    expect(core.foldBox(block)).toMatchObject({ ok: false });
    const row = core.squaresNet([
      [0, 0],
      [1, 0],
      [2, 0],
      [3, 0],
      [4, 0],
      [5, 0],
    ]);
    expect(core.foldBox(row)).toMatchObject({ ok: false, reason: "two faces would land on the same side" });
    expect(core.foldBox(core.squaresNet([[0, 0]]))).toMatchObject({ ok: false, reason: "it has 1 face, not 6" });
  });
  it("folds the cuboid preset and catches edges that do not match", () => {
    const r = core.foldBox(core.cuboidNet(4, 2, 3));
    expect(r).toMatchObject({ ok: true, solid: "cuboid" });
    const wrong = core.cuboidNet(4, 2, 3);
    wrong[5] = [
      [1, 6],
      [5, 6],
      [5, 9],
      [1, 9],
    ];
    expect(core.foldBox(wrong)?.ok).toBe(false);
  });
  it("does not fold prisms and pyramids", () => {
    expect(core.foldBox(core.squarePyramidNet(3, 3))).toBeNull();
    expect(core.foldBox(core.triangularPrismNet(3, 4, 5))).toBeNull();
  });
});

describe("documents", () => {
  it("keeps every example valid, the same size on both copies, and answers pink only on the answers copy", () => {
    for (const x of examples) {
      const e = x.make(false);
      expect(core.parseFile(core.canonical(e))).toEqual(e);
      const pupil = core.renderSvg(e),
        answers = core.renderSvg(core.forView(e, "answer", true));
      expect(pupil, x.id).not.toContain(core.ANSWER_COLOUR);
      expect(core.layout(e).width).toBe(core.layout(core.forView(e, "answer")).width);
      expect(core.layout(e).height).toBe(core.layout(core.forView(e, "answer")).height);
      if (core.hasHidden(e)) expect(answers, x.id).toContain(core.ANSWER_COLOUR);
      expect(core.exportIssue(e)).toBeNull();
    }
  });
  it("prints nothing of a hidden face for pupils", () => {
    const e = examples.find((x) => x.id === "complete-cube-net")!.make(false);
    expect(faceCount(core.renderSvg(e))).toBe(4);
    expect(faceCount(core.renderSvg(core.forView(e, "answer", true)))).toBe(6);
    const blank = examples.find((x) => x.id === "draw-cuboid-net")!.make(false);
    expect(faceCount(core.renderSvg(blank))).toBe(0);
  });
  it("refuses a hidden label with no answer", () => {
    const e = core.create();
    const bad = structuredClone(e);
    bad.document.nets[0].faces[0].label = { text: "", show: "hidden" };
    expect(() => core.validate(bad)).toThrow(/needs its answer/);
  });
  it("prints a 1 cm grid at actual size", () => {
    const e = core.create({ type: "cuboid", length: 4, width: 2, height: 3 });
    const g = core.layout(e);
    // 12 squares across (2 × 4 + 2 × 2) and 7 down (3 + 2 × 2), with one to spare on each side.
    expect([g.width, g.height]).toEqual([140, 90]);
    expect(core.renderSvg(e)).toContain('width="140mm" height="90mm"');
  });
});

describe("teacher notes and explicit marking", () => {
  it("names opposite faces and meeting corners", () => {
    const notes = core.warnings(examples.find((x) => x.id === "opposite-letters")!.make(false));
    expect(notes).toHaveLength(1);
    expect(notes[0]).toMatch(/^When folded, the net: A is opposite [B-F]/);
    const corners = core.warnings(examples.find((x) => x.id === "corners-meet")!.make(false));
    expect(corners.join(" ")).toBe("When folded, the net: P and Q meet; R and S meet.");
  });
  it("says which arrangement does not fold", () => {
    const notes = core.warnings(examples.find((x) => x.id === "which-are-nets")!.make(false));
    expect(notes).toEqual(["Net C does not fold into a cube: the faces go all the way round a corner, so they cannot fold."]);
  });
  it("marks the opposite face only when asked, as a hidden answer", () => {
    let e = core.create({ type: "cube", net: 5, side: 2 });
    e = core.setFace(e, "n1", "f1", { mark: { kind: "dot", show: "show" } });
    expect(e.document.nets[0].faces[5].mark.kind).toBe("none");
    e = core.markOpposite(e, "n1", "f1");
    expect(e.document.nets[0].faces[5].mark).toEqual({ kind: "dot", show: "hidden" });
    expect(() => core.markOpposite(core.create({ type: "square-pyramid", base: 3, slant: 3 }), "n1", "f1")).toThrow(/cubes and cuboids/);
  });
  it("builds and edits nets square by square", () => {
    let e = core.create({ type: "cube", net: 1, side: 1 });
    e = core.removeFace(e, "n1", "f6");
    expect(core.warnings(e)[0]).toContain("it has 5 faces, not 6");
    e = core.addSquare(e, "n1", 2, 3);
    expect(core.warnings(e)).toEqual([]);
    expect(() => core.addSquare(e, "n1", 2, 3)).toThrow(/already a face/);
    e = core.moveNet(e, "n1", 1, 0);
    expect(e.document.nets[0].faces[0].points[0]).toEqual([2, 1]);
    expect(() => core.moveNet(e, "n1", -5, 0)).toThrow(/edge/);
  });
  it("round-trips through its link hash", () => {
    const e = examples[0].make(false);
    expect(core.decodeLinkHash(core.linkHash(e))).toEqual(e);
  });
  it("never names a hidden answer in the pupil artwork's label", () => {
    const e = examples.find((x) => x.id === "name-the-shape")!.make(false);
    const svg = core.renderSvg(e);
    expect(svg).not.toMatch(/prism|pyramid/);
  });
  it("places a face's letter in the same spot on both copies when its mark is hidden", () => {
    let e = core.create({ type: "cube", net: 5, side: 2 });
    e = core.setFace(e, "n1", "f1", { label: { text: "A" }, mark: { kind: "dot", show: "hidden" } });
    const y = (svg: string) => svg.match(/<text x="[\d.]+" y="([\d.]+)"/)![1];
    expect(y(core.renderSvg(core.forView(e, "answer", true)))).toBe(y(core.renderSvg(e)));
  });
  it("removes a hidden letter when its text is emptied, and refuses overlapping squares", () => {
    let e = core.setVertex(core.create(), "n1", [1, 1], { text: "P", show: "hidden" });
    e = core.setVertex(e, "n1", [1, 1], { text: "" });
    expect(e.document.nets[0].vertices).toEqual([]);
    expect(() => core.addSquare(core.create(), "n1", 2, 0, 2)).toThrow(/already a face/);
  });
});


describe("left out (omit)", () => {
  it("prints a left-out face, letter or mark on neither copy, and keeps it saved", () => {
    let e = core.create({ type: "cube", net: 1, side: 1 });
    const net = e.document.nets[0];
    e = core.setFace(e, net.id, "f1", { label: { text: "A", show: "omit" }, mark: { kind: "dot", show: "omit" } });
    e = core.setFace(e, net.id, "f2", { show: "omit" });
    for (const view of ["pupil", "answer"] as const) {
      const svg = core.renderSvg(core.forView(e, view, true));
      expect(faceCount(svg)).toBe(5);
      expect(svg).not.toMatch(/>A</);
      expect(svg).not.toMatch(/<circle/);
    }
    expect(e.document.nets[0].faces[0].label).toEqual({ text: "A", show: "omit" });
  });
});
