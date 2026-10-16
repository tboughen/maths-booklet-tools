import { describe, expect, it } from "vitest";
import {
  addHeight,
  addTriangle,
  allLabels,
  calculate,
  canonical,
  caption,
  construct,
  create,
  distance,
  editLabel,
  exportIssue,
  formatResult,
  getLabel,
  heightFoot,
  isStale,
  label,
  layout,
  moveVertex,
  parseFile,
  point,
  removeSecond,
  renderSvg,
  saveAnswer,
  setConstraint,
  textOf,
  transform,
  validate,
  warnings,
  workedCopy,
} from "./index";
import { examples, example, sourceExamples } from "./examples";

describe("triangle source and output contract", () => {
  for (const ex of examples)
    it(`${ex.key}: preserves the scaffold and reopens exact editable content`, () => {
      const e = ex.build();
      expect(canonical(parseFile(canonical(e)))).toBe(canonical(e));
      expect(layout(e).issues).toEqual([]);
      expect(layout(workedCopy(e)).issues).toEqual([]);
      expect(renderSvg(e)).toContain(`width="${e.document.widthCm}cm"`);
      expect(renderSvg(e)).not.toMatch(
        /button|data-tr-anchor|selection|<image\b|https?:\/\/(?!www.w3)/,
      );
      if (ex.sourceId) expect(e.document.sourceId).toBe(ex.sourceId);
    });
  it("exports only saved pupil visibility, including unknown and blank states", () => {
    const e = example("right-trig");
    expect(renderSvg(e)).not.toContain("33.6");
    expect(layout(e, true).svg).toContain("33.6");
    expect(renderSvg(e)).not.toContain("17.8");
    expect(renderSvg(workedCopy(e))).toContain("17.8");
    expect(getLabel(e, "e:BC").state).toBe("blank");
  });
  it("angle identities and a shared symbol survive transformations", () => {
    let e = example("bisector");
    const labels = e.document.angles.filter((a) => a.label.shared);
    e = editLabel(e, `a:${labels[0].id}`, { text: "θ" });
    expect(labels).toHaveLength(2);
    expect(
      e.document.angles
        .filter((a) => a.label.shared)
        .map((a) => textOf(e, a.label)),
    ).toEqual(["θ", "θ"]);
    const after = transform(transform(e, "right"), "reflect");
    expect(after.document.angles.map((a) => [a.from, a.vertex, a.to])).toEqual(
      e.document.angles.map((a) => [a.from, a.vertex, a.to]),
    );
    expect(after.document.sharedLabels).toEqual(e.document.sharedLabels);
  });
  it("keeps one shared edge in a concave pair", () => {
    const e = example("joined-rules");
    expect(e.document.edges.filter((v) => v.id === "BD")).toHaveLength(1);
    expect(
      e.document.angles
        .filter((a) => a.vertex === "B")
        .map((a) => a.label.text),
    ).toEqual(["86", "109"]);
    expect(layout(transform(e, "left")).issues).toEqual([]);
  });
  it("renders stacked fractions with a visible vector bar and retains complete crops", () => {
    const m = layout(example("fractions"));
    expect(m.svg).toContain('stroke-width=".2" stroke="#111"');
    expect(m.svg).not.toContain("5/2");
    for (const a of m.anchors.filter((a) => a.ref.startsWith("v:")))
      expect(a.x).toBeGreaterThan(0);
  });
  it("warns about a deliberate disagreement without rewriting it", () => {
    const e = example("deliberate-error");
    expect(warnings(e).join(" ")).toContain("cannot form");
    expect(getLabel(e, "e:BC").text).toBe("9");
    expect(exportIssue(e)).toBe("");
  });
  it("rejects malformed references, degenerate shapes and oversized files", () => {
    const e = create();
    e.document.edges[0].to = "MISSING";
    expect(() => validate(e)).toThrow();
    const n = create("scalene");
    n.document.vertices[0].y = 65;
    expect(() => validate(n)).toThrow(/flat/);
    expect(() => parseFile(" ".repeat(64001))).toThrow(/64/);
    const q = create();
    q.document.angles[1].mark = "right";
    expect(() => validate(q)).toThrow(/perpendicular/);
  });
  it("keeps intentional zero distinct while rejecting zero triangle measurements", () => {
    expect(label("0").state).toBe("value");
    expect(() =>
      editLabel(create(), "e:AB", { state: "value", text: "0" }),
    ).toThrow(/positive/);
    expect(() =>
      editLabel(create(), "a:T1-B", { state: "value", text: "180" }),
    ).toThrow(/180/);
    expect(
      getLabel(
        editLabel(create(), "e:AB", { state: "blank", text: "0" }),
        "e:AB",
      ).state,
    ).toBe("blank");
  });
  it("blocks misleading overlapping output but retains the editable document", () => {
    const e = editLabel(example("missing-side"), "e:AB", {
      text: "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    });
    expect(exportIssue(e)).not.toBe("");
    expect(parseFile(canonical(e)).document.edges[0].label.text).toHaveLength(
      40,
    );
  });
  it("retains every source identity independently of the display name", () => {
    expect(sourceExamples).toHaveLength(10);
    expect(new Set(sourceExamples.map((e) => e.sourceId)).size).toBe(10);
  });
});

describe("triangle geometry and bounded editing", () => {
  for (const shape of ["right", "scalene", "isosceles", "equilateral"] as const)
    it(`keeps ${shape} locks during vertex movement`, () => {
      const e = create(shape),
        p = point(e, "C"),
        n = moveVertex(e, "C", { x: p.x + 15, y: p.y + 8 });
      expect(() => validate(n)).not.toThrow();
      expect(n.document.edges.map((v) => v.label)).toEqual(
        e.document.edges.map((v) => v.label),
      );
    });
  for (const kind of ["joined", "separate", "split"] as const)
    it(`adds and removes ${kind} structure without changing the retained labels`, () => {
      const e = example("missing-side"),
        n = addTriangle(e, kind, "BC");
      expect(
        n.document.triangles.filter((t) => t.role === "component"),
      ).toHaveLength(2);
      expect(() => addTriangle(n, kind)).toThrow(/already/);
      const one = removeSecond(n);
      expect(one.document.layout).toBe("single");
      expect(one.document.vertices.map((v) => v.label)).toEqual(
        e.document.vertices.map((v) => v.label),
      );
      expect(one.document.edges.map((v) => v.label)).toEqual(
        e.document.edges.map((v) => v.label),
      );
    });
  it("maintains the split point on the parent line and rejects endpoint crossing", () => {
    let e = example("bisector");
    e = moveVertex(e, "D", { x: 90, y: 120 });
    expect(point(e, "D").y).toBeCloseTo(90);
    expect(() => moveVertex(e, "D", point(e, "B"))).toThrow(/inside/);
    e = moveVertex(e, "C", { x: 150, y: 100 });
    expect(() => validate(e)).not.toThrow();
  });
  it("rejects overlapping joined halves and cannot move object identity with coordinates", () => {
    const e = addTriangle(create(), "joined", "BC"),
      other = e.document.vertices.find((v) => !["A", "B", "C"].includes(v.id))!;
    expect(() => moveVertex(e, other.id, point(e, "A"))).toThrow(/opposite/);
    const n = moveVertex(create(), "C", {
      ...point(create(), "B"),
      x: 95,
      y: 60,
    });
    expect(point(n, "C").id).toBe("C");
  });
  it("lets the equilateral apex change size and orientation while keeping equal sides", () => {
    const e = create("equilateral"),
      n = moveVertex(e, "A", { x: 65, y: -20 });
    expect(distance(point(n, "A"), point(n, "B"))).toBeCloseTo(
      distance(point(n, "B"), point(n, "C")),
      6,
    );
    expect(point(n, "A").x).toBeCloseTo(65);
  });
  it("constructs an external perpendicular height rather than using a sloping edge", () => {
    const e = example("external-height"),
      h = heightFoot(e, "H1");
    expect(h.t).toBeGreaterThan(1);
    expect(h.point.y).toBe(65);
    expect(layout(e).issues).toEqual([]);
    expect(renderSvg(e)).toContain('stroke-dasharray="1.6 1.3"');
  });
  it("bounds heights and retains them through reflection", () => {
    const e = addHeight(create(), "T1", "B");
    expect(() => addHeight(e, "T1", "C")).toThrow(/one height/);
    expect(() => validate(transform(e, "reflect"))).not.toThrow();
  });
  it("constrains a right angle explicitly and can release that lock", () => {
    const e = setConstraint(create("scalene"), "T1", "right", "B");
    expect(e.document.triangles[0].rightAt).toBe("B");
    expect(e.document.angles.find((a) => a.vertex === "B")?.mark).toBe("right");
    expect(
      setConstraint(e, "T1", "none", "A").document.triangles[0].rightAt,
    ).toBe(null);
  });
  it("constructs SSS/SAS/ASA from real measurements without filling a pupil blank", () => {
    const e = create("scalene");
    const n = construct(e, "T1", "SSS", { a: "5", b: "4", c: "3" });
    expect(
      distance(point(n, "A"), point(n, "B")) /
        distance(point(n, "A"), point(n, "C")),
    ).toBeCloseTo(3 / 4);
    expect(n.document.edges.map((v) => v.label)).toEqual(
      e.document.edges.map((v) => v.label),
    );
    expect(() => construct(e, "T1", "SSS", { a: "3", b: "4", c: "9" })).toThrow(
      /cannot/,
    );
    expect(() =>
      construct(e, "T1", "ASA", { A: "90", B: "90", c: "5" }),
    ).toThrow(/less/);
    expect(() =>
      validate(construct(e, "T1", "SAS", { b: "8", c: "11", A: "72" })),
    ).not.toThrow();
    expect(() =>
      validate(construct(e, "T1", "right", { b: "4", c: "3" })),
    ).not.toThrow();
    const aas = construct(e, "T1", "AAS", { A: "34", C: "120", c: "23.8" });
    expect(() => validate(aas)).not.toThrow();
  });
});

describe("explicit numerical calculations", () => {
  const cases: [
    Parameters<typeof calculate>[0],
    Record<string, string>,
    number,
  ][] = [
    ["pythagoras-hypotenuse", { p: "3", q: "4" }, 5],
    ["pythagoras-leg", { h: "8", p: "6" }, Math.sqrt(28)],
    [
      "right-side",
      { angle: "56", known: "12", knownSide: "A", targetSide: "O" },
      17.79073162,
    ],
    [
      "right-angle",
      { ratio: "cos", numerator: "15", denominator: "18" },
      33.55730976,
    ],
    ["sine-side", { a: "23.8", A: "120", B: "34" }, 15.367901],
    ["sine-angle", { a: "12", A: "130", b: "8" }, 30.71022077],
    ["cosine-side", { b: "8", c: "11", A: "72" }, 11.428605],
    ["cosine-angle", { a: "5", b: "4", c: "3" }, 90],
    ["area-height", { base: "8", height: "9" }, 36],
    ["area-sine", { b: "5.6", c: "12.3", A: "114" }, 31.462505561],
    ["angle-sum", { A: "26", B: "34" }, 120],
  ];
  for (const [method, input, expected] of cases)
    it(`${method}: independently checked numerical result`, () =>
      expect(calculate(method, input)[0].value).toBeCloseTo(expected, 3));
  it("offers both SSA branches, while filtering impossible supplementary candidates", () => {
    const r = calculate("sine-angle", { a: "8", b: "12", A: "30" });
    expect(r).toHaveLength(2);
    expect(r[0].value).toBeCloseTo(48.5903779);
    expect(r[1].value).toBeCloseTo(131.4096221);
    expect(calculate("sine-angle", { a: "12", b: "8", A: "130" })).toHaveLength(
      1,
    );
    expect(() =>
      calculate("sine-angle", { a: "2", b: "12", A: "30" }),
    ).toThrow();
  });
  it("offers supplementary area branches, including the reviewed acute-apex source", () => {
    const r = calculate("area-angle", { b: "11", c: "11", area: "42.5" });
    expect(r).toHaveLength(2);
    expect((180 - r[0].value) / 2).toBeCloseTo(67.68686914, 3);
    expect((180 - r[1].value) / 2).toBeCloseTo(22.31313086, 3);
    expect(calculate("area-angle", { b: "3", c: "4", area: "6" })).toHaveLength(
      1,
    );
  });
  it("keeps exact fractional and surd Pythagoras answers", () => {
    expect(calculate("pythagoras-leg", { h: "8", p: "6" })[0].exact).toBe(
      "2√7",
    );
    expect(
      calculate("pythagoras-hypotenuse", { p: "3/2", q: "2" })[0].exact,
    ).toBe("5/2");
  });
  it("refuses invalid domains, zero divisors, impossible triangles and bad rounding", () => {
    expect(() =>
      calculate("right-angle", {
        ratio: "cos",
        numerator: "2",
        denominator: "1",
      }),
    ).toThrow();
    expect(() => calculate("pythagoras-leg", { h: "3", p: "4" })).toThrow();
    expect(() =>
      calculate("area-sine", { b: "4", c: "5", A: "180" }),
    ).toThrow();
    expect(() =>
      calculate("sine-side", { a: "3", A: "100", B: "80" }),
    ).toThrow();
    expect(() =>
      calculate("cosine-angle", { a: "9", b: "3", c: "4" }),
    ).toThrow();
    expect(() =>
      formatResult(calculate("area-height", { base: "4", height: "5" })[0], {
        kind: "dp",
        digits: 10,
      }),
    ).toThrow();
  });
  it("saves a hidden result only to a matching target and requires explicit overwrite", () => {
    const e = create(),
      r = calculate("pythagoras-hypotenuse", { p: "3", q: "4" })[0],
      n = saveAnswer(e, "e:BC", r, { kind: "exact", digits: 1 }, "cm");
    expect(getLabel(n, "e:BC").answer).toBe("5");
    expect(getLabel(n, "e:BC").state).toBe("blank");
    expect(renderSvg(n)).not.toContain(">5 cm<");
    expect(() =>
      saveAnswer(n, "e:BC", r, { kind: "exact", digits: 1 }, "cm"),
    ).toThrow(/already/);
    expect(() =>
      saveAnswer(e, "a:T1-B", r, { kind: "exact", digits: 1 }, "cm"),
    ).toThrow(/same kind/);
  });
  it("invalidates a derived result after a mathematical edit, without rewriting it", () => {
    const r = calculate("pythagoras-hypotenuse", { p: "3", q: "4" })[0];
    let e = saveAnswer(create(), "e:BC", r, { kind: "exact", digits: 1 }, "cm");
    expect(isStale(e, getLabel(e, "e:BC"))).toBe(false);
    e = transform(e, "right");
    expect(isStale(e, getLabel(e, "e:BC"))).toBe(false);
    e = editLabel(e, "e:AB", { text: "7", state: "value" });
    expect(isStale(e, getLabel(e, "e:BC"))).toBe(true);
    expect(getLabel(e, "e:BC").answer).toBe("5");
    expect(exportIssue(e)).not.toContain("out-of-date");
    expect(exportIssue(workedCopy(e))).toContain("out-of-date");
  });
  it("retains a fresh derived answer when only pupil visibility changes", () => {
    const r = calculate("pythagoras-hypotenuse", { p: "3", q: "4" })[0];
    let e = editLabel(create(), "e:AB", { text: "3", state: "value" });
    e = saveAnswer(e, "e:BC", r, { kind: "exact", digits: 1 }, "cm");
    e = editLabel(e, "e:AB", { state: "hidden" });
    expect(isStale(e, getLabel(e, "e:BC"))).toBe(false);
  });
  it("retains bounded captions with explicit blank and answer-line states", () => {
    let e = caption(create(), "A teaching caption", "value");
    e = caption(e, "", "answer-line");
    expect(e.document.captions).toHaveLength(2);
    expect(() => caption(e)).toThrow(/two/);
    expect(allLabels(e).filter((v) => v.kind === "caption")).toHaveLength(2);
  });
});
