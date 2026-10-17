import { describe, it, expect } from "vitest";
import {
  addTriangle,
  addHeight,
  create,
  canonical,
  validate,
  layout,
  getLabel,
  editLabel,
  moveVertex,
  calculate,
  saveAnswer,
  workedCopy,
  removeSecond,
} from "../../packages/triangle-core/src";
import { labelDraft, applyLabelDraft } from "./labelDraft";
import {
  angleWedge,
  wedgePoints,
  geometryHits,
  owningTriangles,
  triangleCentre,
} from "./interaction";
import { calculationContexts } from "./calculationContext";
const area = (e: ReturnType<typeof create>, id = "T1", text = "24") => {
  const draft = labelDraft(e, "r:" + id);
  draft.text = text;
  draft.value.state = "value";
  return applyLabelDraft(e, draft);
};
describe("triangle wedge and centre-area interaction", () => {
  it("never loads incompatible square units as though a conversion occurred", () => {
    let n = area(create());
    n = editLabel(n, "e:AB", { state: "value", text: "6", unit: "cm" });
    n = editLabel(n, "r:T1", { unit: "m²" });
    expect(
      calculationContexts(n, "a:T1-B", "T1").some(
        (c) => c.method === "area-angle",
      ),
    ).toBe(false);
    const withHeight = addHeight(n, "T1", "B");
    expect(
      calculationContexts(withHeight, "h:H1", "T1").find(
        (c) => c.method === "height-area",
      )?.raw.area,
    ).toBe("");
    const matching = editLabel(n, "r:T1", { unit: "cm²" });
    expect(
      calculationContexts(matching, "a:T1-B", "T1").find(
        (c) => c.method === "area-angle",
      )?.raw.area,
    ).toBe("24");
  });
  it("uses the visible wedge for blank and hidden unmarked angles without changing content", () => {
    const e = create("scalene"),
      g = layout(e),
      before = canonical(e);
    for (const a of e.document.angles) {
      const ref = "a:" + a.id,
        points = wedgePoints(e, g, ref)!;
      const p = points.reduce(
        (s, p) => ({ x: s.x + p.x / 3, y: s.y + p.y / 3 }),
        { x: 0, y: 0 },
      );
      expect(geometryHits(e, g, p, 0.01)).toContain(ref);
      expect(angleWedge(e, g, ref)).toContain(",");
    }
    expect(canonical(e)).toBe(before);
    const hidden = editLabel(e, "a:T1-B", { state: "hidden" }),
      p = wedgePoints(hidden, g, "a:T1-B")!;
    expect(
      geometryHits(
        hidden,
        g,
        {
          x: (p[0].x + p[1].x + p[2].x) / 3,
          y: (p[0].y + p[1].y + p[2].y) / 3,
        },
        0.01,
      ),
    ).toContain("a:T1-B");
  });
  it("opening an absent area is a draft only; applying upgrades the saved format explicitly", () => {
    const e = create(),
      before = canonical(e),
      d = labelDraft(e, "r:T1");
    expect(d.value.unit).toBe("cm²");
    expect(canonical(e)).toBe(before);
    const n = area(e);
    expect(n.schemaVersion).toBe(2);
    expect(n.rendererVersion).toBe("triangle-2");
    expect(getLabel(n, "r:T1").text).toBe("24");
    expect(n.document.captions).toEqual([]);
    expect(canonical(validate(JSON.parse(canonical(n))))).toBe(canonical(n));
    expect(() =>
      validate({ ...n, schemaVersion: 1, rendererVersion: "triangle-1" }),
    ).toThrow(/schema 2/);
    expect(() => editLabel(n, "r:T1", { unit: "cm" })).toThrow(/square units/);
    expect(() => editLabel(n, "r:T1", { text: "0" })).toThrow(/positive area/);
  });
  it("keeps legacy envelopes exact and centres area labels on their triangle after reshape", () => {
    const e = create(),
      before = canonical(e);
    expect(validate(e)).toEqual(e);
    expect(canonical(e)).toBe(before);
    const n = area(e),
      g = layout(n),
      a = g.anchors.find((a) => a.ref === "r:T1")!;
    expect(a.x).toBeCloseTo(triangleCentre(n, g, "T1").x);
    expect(a.y).toBeCloseTo(triangleCentre(n, g, "T1").y);
    const moved = moveVertex(n, "C", { x: 140, y: 50 }),
      gm = layout(moved),
      am = gm.anchors.find((a) => a.ref === "r:T1")!;
    expect(am.x).toBeCloseTo(triangleCentre(moved, gm, "T1").x);
    expect(am.y).toBeCloseTo(triangleCentre(moved, gm, "T1").y);
    expect(getLabel(moved, "r:T1").text).toBe("24");
    expect(gm.svg).toContain('data-triangle-label="r:T1"');
  });
  it("keeps connected areas independent, supplies only the matching triangle given and removes dependants", () => {
    let n = addTriangle(create(), "joined", "BC");
    n = area(area(n), "T2", "30");
    expect(owningTriangles(n, "r:T2").map((t) => t.id)).toEqual(["T2"]);
    for (const [id, value] of [
      ["T1", "24"],
      ["T2", "30"],
    ]) {
      const target =
        "a:" +
        id +
        "-" +
        n.document.triangles.find((t) => t.id === id)!.vertices[0];
      const context = calculationContexts(n, target, id).find(
        (c) => c.method === "area-angle",
      )!;
      expect(context.raw.area).toBe(value);
    }
    const contexts = calculationContexts(n, "r:T2", "T2");
    expect(contexts.some((c) => c.method === "area-sine")).toBe(true);
    expect(calculationContexts(n, "r:T2", "T1")).toEqual([]);
    const removed = removeSecond(n);
    expect(removed.document.triangles[0].area?.text).toBe("24");
    expect(() => getLabel(removed, "r:T2")).toThrow();
  });
  it("preserves an original area on the outer split triangle and restores it on remove split", () => {
    const n = addTriangle(area(create()), "split", "BC");
    expect(n.schemaVersion).toBe(2);
    expect(
      n.document.triangles.find((t) => t.role === "outer")?.area?.text,
    ).toBe("24");
    expect(removeSecond(n).document.triangles[0].area?.text).toBe("24");
  });
  it("keeps calculated answers hidden until explicitly shown and detects changed area givens", () => {
    const n = area(create()),
      r = calculate("area-height", { base: "6", height: "8" })[0];
    const saved = saveAnswer(
      n,
      "r:T1",
      r,
      { kind: "dp", digits: 1 },
      "cm²",
      true,
    );
    expect(getLabel(saved, "r:T1").answerVisible).toBe(false);
    expect(getLabel(workedCopy(saved), "r:T1").answerVisible).toBe(true);
    expect(() =>
      saveAnswer(
        n,
        "r:T1",
        calculate("pythagoras-hypotenuse", { p: "3", q: "4" })[0],
        { kind: "dp", digits: 1 },
        "cm",
        true,
      ),
    ).toThrow(/same kind/);
  });
});
