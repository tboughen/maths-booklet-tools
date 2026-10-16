import { describe, it, expect } from "vitest";
import {
  addTriangle,
  addHeight,
  calculate,
  caption,
  create,
  editLabel,
  layout,
  moveVertex,
  setConstraint,
  canonical,
  type Envelope,
} from "../../packages/triangle-core/src";
import { example } from "../../packages/triangle-core/src/examples";
import { geometryHits, oppositeEdge, owningTriangles } from "./interaction";
import { calculationContexts } from "./calculationContext";

describe("triangle direct interaction contracts", () => {
  for (const apex of ["A", "B", "C"])
    it(`splits from ${apex} to its opposite edge without mutating the source`, () => {
      const e = create(),
        before = canonical(e),
        edge = oppositeEdge(e, apex),
        n = addTriangle(e, "split", edge);
      expect([n.document.split!.from, n.document.split!.to]).not.toContain(
        apex,
      );
      expect(
        n.document.triangles
          .filter((t) => t.role === "component")
          .every((t) => t.vertices.includes(apex)),
      ).toBe(true);
      expect(canonical(e)).toBe(before);
    });
  it("resolves one shared edge and both named triangle contexts", () => {
    const e = addTriangle(create(), "joined", "BC"),
      g = layout(e),
      a = g.vertices.B,
      b = g.vertices.C;
    const refs = geometryHits(
      e,
      g,
      { x: a.x * 0.65 + b.x * 0.35, y: a.y * 0.65 + b.y * 0.35 },
      0.1,
    );
    expect(refs).toEqual(["e:BC", "t:T1", "t:T2"]);
    expect(owningTriangles(e, "e:BC").map((t) => t.id)).toEqual(["T1", "T2"]);
  });
  it("distinguishes the outer split triangle from its components", () => {
    const e = addTriangle(create(), "split", "BC");
    const inside = e.document.edges.find(
      (a) =>
        (a.from === "A" && a.to === "D") || (a.from === "D" && a.to === "A"),
    )!;
    expect(owningTriangles(e, `e:${inside.id}`).map((t) => t.id)).toEqual([
      "T2",
      "T3",
    ]);
    expect(owningTriangles(e, "a:T1-A").map((t) => t.id)).toEqual(["T1"]);
    expect(owningTriangles(e, "a:T2-A").map((t) => t.id)).toEqual(["T2"]);
  });
  it("does not select geometry in empty white space", () => {
    const e = create(),
      g = layout(e);
    expect(geometryHits(e, g, { x: -20, y: -20 }, 0.1)).toEqual([]);
  });
  it("selects the actual rendered right-angle corner before its adjacent sides", () => {
    const e = create(),
      g = layout(e),
      v = g.vertices.A,
      b = g.vertices.B,
      c = g.vertices.C;
    const unit = (p: { x: number; y: number }) => {
      const m = Math.hypot(p.x - v.x, p.y - v.y);
      return { x: (p.x - v.x) / m, y: (p.y - v.y) / m };
    };
    const u = unit(b),
      w = unit(c),
      p = { x: v.x + (u.x + w.x) * 2.5, y: v.y + (u.y + w.y) * 2.5 };
    expect(geometryHits(e, g, p, 0.15)).toContain("a:T1-A");
  });
});
describe("explicit calculation context", () => {
  it("maps hypotenuse and each leg by actual edge identity", () => {
    const e = example("missing-side");
    const h = calculationContexts(e, "e:BC", "T1").find(
      (c) => c.method === "pythagoras-hypotenuse",
    )!;
    expect(calculate(h.method, h.raw)[0].value).toBe(10);
    const given = editLabel(
      editLabel(e, "e:BC", { state: "value", text: "10" }),
      "e:AB",
      { state: "symbol", text: "x" },
    );
    const leg = calculationContexts(given, "e:AB", "T1").find(
      (c) => c.method === "pythagoras-leg",
    )!;
    expect(calculate(leg.method, leg.raw)[0].value).toBe(6);
  });
  it("uses no inferred measurements when a schematic triangle is resized", () => {
    const e = example("missing-side"),
      before = calculationContexts(e, "e:BC", "T1");
    const changed = moveVertex(e, "C", { x: 140, y: 60 });
    expect(calculationContexts(changed, "e:BC", "T1")).toEqual(before);
  });
  it("does not read hidden saved answers or symbolic strings", () => {
    const e = editLabel(example("missing-side"), "e:AB", {
      state: "symbol",
      text: "a",
      answer: "6",
    });
    const c = calculationContexts(e, "e:BC", "T1").find(
      (c) => c.method === "pythagoras-hypotenuse",
    )!;
    expect(c.missing).toContain("q");
    expect(Object.values(c.raw)).not.toContain("6");
  });
  it("requires an actual right lock for right-triangle recommendations", () => {
    const e = setConstraint(example("missing-side"), "T1", "none", "A");
    expect(
      calculationContexts(e, "e:BC", "T1").some(
        (c) =>
          c.method.startsWith("pythagoras") || c.method.startsWith("right-"),
      ),
    ).toBe(false);
  });
  it("maps cosine side and angle inputs relative to the selected target", () => {
    let e: Envelope = create("scalene");
    e = editLabel(
      editLabel(editLabel(e, "e:AB", { state: "value", text: "3" }), "e:AC", {
        state: "value",
        text: "4",
      }),
      "a:T1-A",
      { state: "value", text: "60" },
    );
    const side = calculationContexts(e, "e:BC", "T1").find(
      (c) => c.method === "cosine-side",
    )!;
    expect(calculate(side.method, side.raw)[0].value).toBeCloseTo(
      Math.sqrt(13),
    );
    e = editLabel(e, "e:BC", {
      state: "value",
      text: Math.sqrt(13).toFixed(6),
    });
    const angle = calculationContexts(e, "a:T1-A", "T1").find(
      (c) => c.method === "cosine-angle",
    )!;
    expect(calculate(angle.method, angle.raw)[0].value).toBeCloseTo(60);
  });
  it("maps sine inverse inputs and preserves both valid branches", () => {
    let e = create("scalene");
    e = editLabel(
      editLabel(editLabel(e, "e:BC", { state: "value", text: "8" }), "e:AC", {
        state: "value",
        text: "10",
      }),
      "a:T1-A",
      { state: "value", text: "30" },
    );
    const c = calculationContexts(e, "a:T1-B", "T1").find(
      (c) => c.method === "sine-angle",
    )!;
    expect(calculate(c.method, c.raw)).toHaveLength(2);
  });
  it("rejects an unrelated triangle instead of borrowing its givens", () => {
    const e = addTriangle(create(), "separate");
    expect(calculationContexts(e, "e:AB", "T2")).toEqual([]);
  });
  it("does not treat a height as an unrecorded auxiliary triangle", () => {
    expect(calculationContexts(create(), "h:missing", "T1")).toEqual([]);
  });
  it("maps a height to its explicit base and stated area, without a right-triangle inference", () => {
    let e = caption(
      addHeight(example("missing-side"), "T1", "B"),
      "24",
      "value",
      "cm²",
    );
    const c = calculationContexts(e, "h:H1", "T1")[0];
    expect(c.method).toBe("height-area");
    expect(c.raw).toEqual({ area: "24", base: "8" });
    expect(calculate(c.method, c.raw)[0].value).toBe(6);
    e = caption(e, "30", "value", "cm²");
    expect(calculationContexts(e, "h:H1", "T1")[0].raw.area).toBe("");
    expect(() => calculate("height-area", { area: "24", base: "0" })).toThrow();
  });
  it("offers area methods only with an explicitly created caption target", () => {
    const e = caption(example("missing-side"), "", "answer-line");
    const c = calculationContexts(e, "c:C1", "T1").find(
      (c) => c.method === "area-sine",
    )!;
    expect(calculate(c.method, c.raw)[0].value).toBeCloseTo(24);
  });
});
