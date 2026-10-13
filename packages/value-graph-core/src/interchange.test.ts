import { describe, expect, it } from "vitest";
import {
  apply,
  contentHash,
  defaultEnvelope,
  editorLink,
  decode,
  evaluate,
  labels,
  metrics,
  parseFile,
  preset,
  PRESETS,
  rangeColumns,
  renderSvg,
  revise,
  validate,
  warnings,
} from "./interchange";

describe("exam-style tables and quadratic graphs", () => {
  it("preserves all five source scaffolds and evaluates their values exactly", () => {
    const expected = [
      [6, 0, -4, -6, -6, -4, 0],
      [2, -2, -4, -4, -2, 2, 8],
      [10, 5, 2, 1, 2, 5, 10],
      [10, 5, 2, 1, 2, 5, 10],
      [7, 1, -1, 1, 7, 17],
    ];
    PRESETS.slice(0, 5).forEach((name, i) => {
      const e = preset(name);
      expect(
        e.document.columns.map((c) =>
          Number(evaluate(e.document.equation, c.x)),
        ),
      ).toEqual(expected[i]);
      expect(() => renderSvg(e)).not.toThrow();
    });
    expect(
      defaultEnvelope().document.columns.filter((c) => c.y.kind === "blank"),
    ).toHaveLength(5);
    expect(evaluate(preset("Fractions").document.equation, "-2")).toBe("5/2");
  });
  it("does not fill blanks or overwrite plotted work when equation, visibility or axes change", () => {
    const initial = apply(defaultEnvelope(), [
      {
        op: "plot_series",
        id: "points",
        source: "equation",
        columnIds: ["c1", "c2", "c3"],
        connection: "straight-joins",
      },
    ]);
    const next = apply(initial, [
      { op: "set_equation", equation: { a: "2", b: "1", c: "0" } },
      { op: "set_presentation", settings: { showMarkers: false } },
      { op: "set_graph", settings: { xLabelEvery: "2" } },
    ]);
    expect(next.document.columns).toEqual(initial.document.columns);
    expect(next.document.graph.series).toEqual(initial.document.graph.series);
    expect(warnings(next).join()).toContain("disagree");
  });
  it("plots zero, skips blanks, and requires explicit overwrite for calculations", () => {
    const initial = apply(defaultEnvelope(), [
      { op: "set_cell", columnId: "c2", y: { kind: "value", value: "0" } },
    ]);
    const next = apply(initial, [
      {
        op: "plot_series",
        id: "p",
        source: "table",
        columnIds: initial.document.columns.map((c) => c.id),
        connection: "none",
      },
    ]);
    expect(next.document.graph.series[0].points).toHaveLength(3);
    expect(next.document.graph.series[0].points[1].y).toBe("0");
    expect(() =>
      apply(initial, [
        { op: "calculate_cells", columnIds: ["c1"], overwrite: false },
      ]),
    ).toThrow("overwrite");
    expect(
      apply(initial, [
        { op: "calculate_cells", columnIds: ["c2"], overwrite: true },
      ]).document.columns[1].y,
    ).toEqual({ kind: "value", value: "0" });
  });
  it("retains linked editing and allows detaching a deliberate misplaced point", () => {
    const initial = apply(defaultEnvelope(), [
      {
        op: "plot_series",
        id: "p",
        source: "table",
        columnIds: ["c1", "c4"],
        connection: "straight-joins",
      },
    ]);
    const next = apply(initial, [
      { op: "set_cell", columnId: "c1", y: { kind: "value", value: "5" } },
    ]);
    expect(next.document.graph.series[0].points[0].y).toBe("5");
    const detached = apply(next, [
      {
        op: "move_point",
        seriesId: "p",
        pointId: "p-c1",
        x: "-3",
        y: "4",
        linked: "detach",
      },
    ]);
    expect(detached.document.columns).toEqual(next.document.columns);
    expect(
      detached.document.graph.series[0].points[0].columnId,
    ).toBeUndefined();
    const removed = apply(next, [{ op: "remove_column", columnId: "c1" }]);
    expect(removed.document.graph.series[0].points).toHaveLength(1);
  });
  it("preserves a straight-join error as straight work and draws an exact quadratic separately", () => {
    const wrong = preset("November 2017 error"),
      svg = renderSvg(wrong);
    expect(svg).toContain("<polyline");
    expect(svg).not.toContain("data-curve");
    expect(svg).not.toContain("mistake");
    const e = apply(defaultEnvelope(), [
      {
        op: "set_curve",
        curve: {
          id: "q",
          equation: { a: "1", b: "-1", c: "-6" },
          min: "-3",
          max: "3",
        },
      },
    ]);
    expect(renderSvg(e)).toContain('data-curve="q"');
    expect(renderSvg(e)).toMatch(/Q[\d.]+ [\d.-]+/);
  });
  it("retains all three physical grid tiers and exact exam-size typography", () => {
    const e = defaultEnvelope(),
      m = metrics(e),
      svg = renderSvg(e);
    expect(m.graphWidth).toBe(120);
    expect(m.graphHeight).toBe(140);
    const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
    expect(doc.querySelectorAll("[data-grid-tier]")).toHaveLength(3);
    expect(
      Number(
        doc
          .querySelector('[data-grid-tier="fine"]')
          ?.getAttribute("stroke-width"),
      ),
    ).toBeCloseTo((0.51 * 25.4) / 72);
    const values = doc.querySelector('[data-layer="axis-values"]')!;
    expect(values.getAttribute("data-font-points")).toBe("12");
    expect(
      Number(values.querySelector("text")?.getAttribute("font-size")),
    ).toBeCloseTo((12 * 25.4) / 72);
    expect(svg).toContain(`width="${m.width}mm"`);
  });
  it("anchors labels at zero with mixed scales and half-unit borders", () => {
    expect(labels(-3.5, 3.5, 1)).toEqual([-3, -2, -1, 1, 2, 3]);
    expect(labels(-10, 15, 5)).toEqual([-10, -5, 5, 10, 15]);
    expect(metrics(preset("November 2018"))).toMatchObject({
      graphWidth: 140,
      graphHeight: 100,
    });
  });
  it("retains blank, answer-line and zero states through files and editor links", () => {
    const e = apply(defaultEnvelope(), [
      { op: "set_cell", columnId: "c2", y: { kind: "answer-line" } },
      { op: "set_cell", columnId: "c3", y: { kind: "value", value: "0" } },
    ]);
    expect(parseFile(JSON.stringify(e))).toEqual(e);
    expect(
      decode(new URL(editorLink(e, "https://example.com/")).hash.slice(8)),
    ).toEqual(e);
  });
  it("rejects stale hashes and applies failed batches atomically", async () => {
    const e = defaultEnvelope(),
      hash = await contentHash(e);
    await expect(
      revise({ envelope: e, baseHash: "0".repeat(64), operations: [] }),
    ).rejects.toThrow("stale");
    expect(
      await revise({ envelope: e, baseHash: hash, operations: [] }),
    ).toEqual(e);
    expect(() =>
      apply(e, [
        { op: "set_cell", columnId: "c1", y: { kind: "value", value: "4" } },
        { op: "remove_column", columnId: "absent" },
      ]),
    ).toThrow();
    expect(e.document.columns[0].y).toEqual({ kind: "value", value: "6" });
  });
  it("keeps generated fractional x values exact and rejects invalid structural input", () => {
    expect(rangeColumns("0", "1", "1/3").map((c) => c.x)).toEqual([
      "0",
      "1/3",
      "2/3",
      "1",
    ]);
    expect(() => rangeColumns("0", "20", "1")).toThrow();
    const e = defaultEnvelope();
    expect(() =>
      apply(e, [{ op: "set_cell", columnId: "c2", x: "-3" }]),
    ).toThrow("different x");
    expect(() =>
      apply(e, [
        { op: "set_cell", columnId: "c1", y: { kind: "value", value: "1/0" } },
      ]),
    ).toThrow();
    const bad = structuredClone(e);
    bad.document.graph.bounds.xMin = "-3.03";
    expect(() => validate(bad)).toThrow("spacing");
  });
  it("exports table-only/graph-only without hidden pupil answers or editor furniture", () => {
    const e = defaultEnvelope(),
      table = apply(e, [
        { op: "set_presentation", settings: { composition: "table" } },
      ]),
      graph = apply(e, [
        { op: "set_presentation", settings: { composition: "graph" } },
      ]);
    expect(renderSvg(table)).not.toContain('data-layer="grid"');
    expect(renderSvg(graph)).toContain('data-layer="grid"');
    expect(renderSvg(e)).not.toMatch(
      /warning|selected|button|c2|pupil answer|aria-label="[^"]*-4/,
    );
  });
  it("does not shrink long values silently and validates the largest supported scaffold", () => {
    const e = defaultEnvelope();
    e.document.columns = rangeColumns("-3", "3", "1/2");
    e.document.print.tableWidthMm = 180;
    expect(() => renderSvg(e)).not.toThrow();
    const tooLong = apply(defaultEnvelope(), [
      {
        op: "set_cell",
        columnId: "c2",
        y: { kind: "value", value: "-999999" },
      },
    ]);
    expect(() => renderSvg(tooLong)).toThrow("fit");
  });
});
