// @vitest-environment node
import { expect, it } from "vitest";
import * as c from "./index";
import * as i from "./interchange";
it("blocks overflowing answer spaces, short fraction cells and invalid SVG controls", () => {
  const e = c.fresh();
  const narrow = i.apply(e, [
    { op: "set_print", presentation: { unitMm: 4 } },
    {
      op: "set_label",
      target: { barId: "b1", partId: "b1p1" },
      label: c.label("", "line"),
    },
  ]);
  expect(c.exportIssue(narrow)).toContain("does not fit");
  const short = i.apply(c.example("BM08"), [
    { op: "set_print", presentation: { barHeightMm: 8, fontPt: 14 } },
  ]);
  expect(c.exportIssue(short)).toContain("taller bar");
  expect(() =>
    i.apply(e, [
      {
        op: "set_label",
        target: { barId: "b1" },
        label: c.label("bad\u0000label"),
      },
    ]),
  ).toThrow();
  expect(c.printFacts(c.example("BM08")).referenceFeatures.textSizesPt).toEqual(
    [9.6, 12],
  );
});
it.each(c.exampleNames)(
  "%s has printable scaffold/worked artwork and stable roundtrip",
  (name) => {
    for (const worked of [false, true]) {
      const e = c.example(name, worked);
      expect(c.exportIssue(e)).toBe("");
      expect(c.parseFile(c.canonical(e))).toEqual(e);
      expect(i.parseLink(i.editorLink(e, "https://mathsdock.co.uk/"))).toEqual(
        e,
      );
      expect(c.renderSvg(e)).not.toMatch(/NaN|Infinity|undefined/);
    }
  },
);
it("independently verifies sharing/fraction/algebra fixture spans", () => {
  const labels = (name: string) =>
    Object.fromEntries(
      c.example(name, true).document.spans.map((s) => [s.id, s.label.text]),
    );
  expect((64 / (3 + 5)) * 3).toBe(24);
  expect((24 / 3) * 5).toBe(40);
  expect((16 / (5 - 3)) * 5).toBe(40);
  expect(labels("BM01")).toEqual({ whole: "64", first: "24", second: "40" });
  expect(labels("BM02").second).toBe("40");
  expect(labels("BM03")).toEqual({
    difference: "16",
    larger: "40",
    smaller: "24",
  });
  expect(labels("BM04")).toEqual({
    whole: "72",
    first: "16",
    second: "24",
    third: "32",
  });
  expect([2, 3, 4].map((n) => (72 / 9) * n)).toEqual([16, 24, 32]);
  expect((400 * 3) / 8).toBe(150);
  expect(labels("BM05").selected).toBe("150");
  expect(labels("BM07")).toEqual({ whole: "8x/3", first: "x", second: "5x/3" });
  expect(labels("H07")).toEqual({
    empty: "150",
    small: "30",
    medium: "40",
    large: "80",
  });
  const h = c.example("H07");
  expect(h.document.bars[0].parts).toHaveLength(15);
});
it("uses equal shared units and exactly anchors difference and whole spans", () => {
  const e = c.example("BM03"),
    g = c.layout(e),
    diff = g.spans.find((s) => s.span.id === "difference")!;
  expect(g.rows.flatMap((r) => r.parts.map((p) => p.width))).toEqual(
    Array(8).fill(10),
  );
  expect(diff.x1).toBe(g.rows[1].x + 30);
  expect(diff.x2).toBe(g.rows[0].x + 50);
  expect(diff.x2 - diff.x1).toBe(20);
  const h = c.example("BM05"),
    span = h.document.spans[0];
  expect(c.boundary(h, span.from)).toEqual({ n: 0n, d: 1n });
  expect(c.boundary(h, span.to)).toEqual({ n: 8n, d: 1n });
});
it("keeps zero, blanks, question marks, lines and saved answers distinct", () => {
  const e = c.example("BM08"),
    before = c.canonical(e);
  expect(e.document.bars[0].parts.map((p) => p.label.state)).toEqual([
    "value",
    "value",
    "value",
    "hidden",
    "line",
    "blank",
  ]);
  expect(c.renderSvg(e)).toContain(">0</text>");
  expect(c.renderSvg(e)).not.toContain(">18</text>");
  const n = i.apply(e, [{ op: "set_print", presentation: { unitMm: 15 } }]);
  expect(n.document.bars).toEqual(e.document.bars);
  expect(c.canonical(e)).toBe(before);
  expect(
    i.apply(e, [{ op: "reveal_saved_answers" }]).document.bars[0].parts[3]
      .label,
  ).toEqual(c.label("18"));
});
it("never evaluates original algebra variables into widths", () => {
  const e = c.example("BM07");
  const n = i.apply(e, [
    { op: "set_label", target: { spanId: "first" }, label: c.label("t") },
  ]);
  expect(c.layout(n).rows).toEqual(c.layout(e).rows);
  expect(n.document.spans[0]).toEqual(e.document.spans[0]);
});
it("rejects orphaning deletion and restores nothing by silently reattaching", () => {
  const e = c.example("BM01"),
    before = c.canonical(e);
  expect(() =>
    i.apply(e, [{ op: "remove_part", barId: "b1", partId: "b1p1" }]),
  ).toThrow("discardSpans");
  const n = i.apply(e, [
    { op: "remove_part", barId: "b1", partId: "b1p1", discardSpans: true },
  ]);
  expect(n.document.spans.map((s) => s.id)).toEqual(["second"]);
  expect(c.canonical(e)).toBe(before);
});
it("rejects stale hashes and applies bounded operations atomically", async () => {
  const e = c.fresh(),
    before = c.canonical(e);
  await expect(
    i.revise({ envelope: e, baseHash: "0".repeat(64), operations: [] }),
  ).rejects.toThrow("stale_hash");
  expect(() =>
    i.apply(e, [
      { op: "set_label", target: { spanId: "first" }, label: c.label("a") },
      { op: "remove_bar", barId: "unknown" },
    ]),
  ).toThrow();
  expect(c.canonical(e)).toBe(before);
  expect(() =>
    i.apply(e, Array(31).fill({ op: "reveal_saved_answers" })),
  ).toThrow();
  expect(
    await i.revise({ envelope: e, baseHash: await c.hash(e), operations: [] }),
  ).toEqual(e);
});
it.each(["0", "-1", "1/0", "1e5", "x", "0.00001", "1000001"])(
  "rejects invalid weight %s",
  (weight) => {
    const e = c.fresh();
    expect(() =>
      i.apply(e, [{ op: "set_part", barId: "b1", partId: "b1p1", weight }]),
    ).toThrow();
  },
);
it("normalises exact rational geometry without changing symbolic labels", () => {
  const e = c.fresh(),
    n = i.apply(e, [
      { op: "set_part", barId: "b1", partId: "b1p1", weight: "0.50" },
    ]);
  expect(n.document.bars[0].parts[0].weight).toBe("1/2");
  expect(c.boundary(n, { barId: "b1", partId: "b1p2", edge: "end" })).toEqual({
    n: 3n,
    d: 2n,
  });
});
it("rejects invalid anchors, IDs, structure and ambiguous create input", () => {
  const e = c.fresh();
  expect(() => i.create({ envelope: e, spec: {} })).toThrow();
  expect(() =>
    i.create({ spec: { example: "BM01", bars: e.document.bars } }),
  ).toThrow();
  expect(() =>
    i.apply(e, [{ op: "add_bar", bar: e.document.bars[0] }]),
  ).toThrow("Duplicate");
  const s = structuredClone(e.document.spans[0]);
  s.to.partId = "missing";
  expect(() => i.apply(e, [{ op: "set_span", span: s }])).toThrow(
    "Unknown part",
  );
});
it("supports maximum useful parts but blocks overflowing exports with explanations", () => {
  const e = c.example("BM09");
  expect(e.document.bars.flatMap((b) => b.parts)).toHaveLength(96);
  expect(c.exportIssue(e)).toBe("");
  expect(c.layout(e).width).toBeLessThanOrEqual(280);
  const n = i.apply(e, [{ op: "set_print", presentation: { unitMm: 16 } }]);
  expect(c.exportIssue(n)).toContain("exceeds");
  const p = i.apply(c.fresh(), [
    {
      op: "set_label",
      target: { barId: "b1", partId: "b1p1" },
      label: c.label("A very long overflowing label"),
    },
  ]);
  expect(c.exportIssue(p)).toContain("does not fit");
});
it("preserves exact saved Unicode and hidden answers through links", async () => {
  const e = i.apply(c.fresh(), [
    {
      op: "set_label",
      target: { spanId: "first" },
      label: c.label("λ ≤ 24", "hidden"),
    },
  ]);
  expect(
    await c.hash(i.parseLink(i.editorLink(e, "https://mathsdock.co.uk/"))),
  ).toBe(await c.hash(e));
});
