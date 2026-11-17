import { describe, expect, it } from "vitest";
import { create, forView, hasHidden, layout, parseFile, canonical, renderSvg, setAllShown, type Envelope, type Kind } from "./index";
import { groupedLayout, paperGrid } from "./grouped";
import { GROUPED_DEFAULTS, blankGroupedClass, n, type GroupedSettings } from "./shared";
import { examples } from "./examples";
import * as io from "./interchange";

const PINK = "#b0125b";
function grouped(kind: Kind, change: (g: GroupedSettings) => void = () => {}): Envelope {
  const e = create();
  e.document.kind = kind;
  const g = structuredClone(GROUPED_DEFAULTS);
  g.variable = "t";
  g.classes = [
    ["0", "10", "11"],
    ["10", "20", "28"],
    ["20", "40", "46"],
    ["40", "60", "28"],
    ["60", "90", "21"],
  ].map(([lower, upper, frequency]) => ({ ...blankGroupedClass(), lower, upper, frequency }));
  g.histogram.yAxis = { min: "0", max: "3", step: "0.5", stepMm: 20, title: "Frequency density" };
  g.polygon.yAxis = { min: "0", max: "50", step: "10", stepMm: 10, title: "Frequency" };
  g.cumulative.yAxis = { min: "0", max: "140", step: "20", stepMm: 10, title: "Cumulative frequency" };
  change(g);
  e.document.grouped = g;
  return e;
}

describe("histograms", () => {
  it("draws bars at frequency ÷ class width on true-size graph paper", () => {
    const g = groupedLayout(grouped("histogram"));
    expect(g.issues).toEqual([]);
    expect(g.plot).toMatchObject({ width: 100, height: 120 });
    // 0–10 with frequency 11: density 1.1 → 1.1 ÷ 0.5 × 20 mm = 44 mm tall, 10 mm wide.
    expect(g.bars[0].width).toBeCloseTo(10, 9);
    expect(g.bars[0].height).toBeCloseTo(44, 9);
    expect(g.bars[4].width).toBeCloseTo(30, 9);
    expect(g.bars[4].height).toBeCloseTo(28, 9);
  });

  it("uses Edexcel's measured weights: 1.5 pt axes and bars, 0.51/1.02/1.417 pt graph paper", () => {
    const svg = renderSvg(grouped("histogram"));
    const pt = (v: number) => String(Math.round(v * (25.4 / 72) * 1000) / 1000);
    expect(svg).toContain(`stroke-width="${pt(1.5)}"`);
    expect(svg).toContain(`stroke-width="${pt(1.474)}"`);
    for (const w of [0.51, 1.02, 1.417]) expect(svg).toContain(`stroke-width="${pt(w)}"`);
    expect(svg).toContain('fill="#bfbfbf"');
    // Heavier lines every 1 cm and 2 cm, measured from the corner.
    const grid = paperGrid(0, 0, 40, 4);
    expect(grid.match(/M\d+,0V4/g)?.length).toBe(20);
  });

  it("a hidden bar is left for pupils and drawn as a pink outline on answers copies", () => {
    const e = grouped("histogram", (g) => void (g.classes[2].graph = "hidden"));
    const pupil = renderSvg(e);
    expect(groupedLayout(e).bars.filter((b) => b.drawn)).toHaveLength(4);
    expect(pupil).not.toContain(PINK);
    expect(hasHidden(e)).toBe(true);
    const answer = renderSvg(forView(e, "answer", true));
    expect(answer).toContain(`fill="none" stroke="${PINK}"`);
    expect(layout(forView(e, "answer", true)).width).toBe(layout(e).width);
    expect(e.document.grouped!.classes[2].graph).toBe("hidden");
  });

  it("a table cell can be hidden separately from the bar", () => {
    const e = grouped("histogram", (g) => {
      g.table = "frequency";
      g.classes[1].table = "hidden";
    });
    const pupil = renderSvg(e);
    expect(pupil.match(/>28</g)).toHaveLength(1); // only class 4's 28 prints; class 2's is hidden
    expect(groupedLayout(e).bars.every((b) => b.drawn)).toBe(true);
    const answer = renderSvg(forView(e, "answer", true));
    expect(answer).toContain(`fill="${PINK}">28<`);
    expect(pupil).toContain('font-style="italic"');
  });

  it("reports specific errors that block export", () => {
    const issues = (change: (g: GroupedSettings) => void) => layout(grouped("histogram", change)).issues;
    expect(issues((g) => void (g.classes[0].frequency = "ten"))).toContain("Class 1: enter a number for the frequency, or leave it blank.");
    expect(issues((g) => void (g.classes[1].upper = "5"))).toContain("Class 2: the upper boundary must be greater than the lower one.");
    expect(issues((g) => void (g.classes[0].frequency = "40"))).toContain("Class 1: the frequency density 4 is above the vertical axis.");
    expect(issues((g) => void (g.xAxis.max = "95"))).toContain("The horizontal axis end must fall on a 2 mm grid line. Change the end, the step or the length of a step.");
    expect(issues((g) => void (g.xAxis.max = "80"))).toContain("Class 5: 60 to 90 is outside the horizontal axis.");
    expect(issues((g) => void (g.classes[2].lower = "15"))).toContain("Class 3: classes must be in order and must not overlap.");
    expect(issues((g) => void (g.histogram.yAxis.min = "1"))).toContain("A histogram's vertical axis starts at 0. Change the vertical axis start to 0.");
  });

  it("a blank frequency is no data, not zero", () => {
    const g = groupedLayout(grouped("histogram", (s) => void (s.classes[1].frequency = "")));
    expect(g.issues).toEqual([]);
    expect(g.bars.map((b) => b.index)).toEqual([0, 2, 3, 4]);
    const zero = groupedLayout(grouped("histogram", (s) => void (s.classes[1].frequency = "0")));
    expect(zero.bars.map((b) => b.index)).toEqual([0, 1, 2, 3, 4]);
    expect(zero.bars[1].height).toBe(0);
  });
});

describe("frequency polygons", () => {
  it("plots crosses at class midpoints joined by straight lines, not closed to the axis", () => {
    const g = groupedLayout(grouped("polygon"));
    expect(g.issues).toEqual([]);
    expect(g.points.map((p) => p.x - g.plot.x)).toEqual([5, 15, 30, 50, 75]);
    expect(g.curve).toHaveLength(4);
    expect(g.curve.every((c) => c.path.includes("L"))).toBe(true);
  });

  it("a hidden point hides the lines that reach it", () => {
    const g = groupedLayout(grouped("polygon", (s) => void (s.classes[0].graph = "hidden")));
    expect(g.points[0].drawn).toBe(false);
    expect(g.curve.map((c) => c.drawn)).toEqual([false, true, true, true]);
    const h = groupedLayout(grouped("polygon", (s) => void (s.classes[2].graph = "hidden")));
    expect(h.curve.map((c) => c.drawn)).toEqual([true, false, false, true]);
    const answer = groupedLayout(forView(grouped("polygon", (s) => void (s.classes[2].graph = "hidden")), "answer", true));
    expect(answer.curve.map((c) => c.revealed)).toEqual([false, true, true, false]);
  });
});

describe("cumulative frequency graphs", () => {
  it("plots running totals at upper boundaries from 0 at the lowest boundary", () => {
    const g = groupedLayout(grouped("cumulative"));
    expect(g.issues).toEqual([]);
    expect(g.points.map((p) => Math.round(g.plot.y + g.plot.height - p.y))).toEqual([6, 20, 43, 57, 67]);
    expect(g.curve).toHaveLength(5);
    expect(g.curve[0].path.startsWith(`M${n(g.plot.x)},${n(g.plot.y + g.plot.height)}`)).toBe(true);
    expect(g.curve.every((c) => c.path.includes("C"))).toBe(true);
    const straight = groupedLayout(grouped("cumulative", (s) => void (s.cumulative.curve = "straight")));
    expect(straight.curve.every((c) => c.path.includes("L"))).toBe(true);
  });

  it("the smooth curve never decreases between points", () => {
    const svg = renderSvg(grouped("cumulative", (s) => void (s.cumulative.curve = "smooth")));
    const ys = [...svg.matchAll(/C([\d.]+),([\d.]+) ([\d.]+),([\d.]+) ([\d.]+),([\d.]+)/g)].flatMap((m) => [Number(m[2]), Number(m[4]), Number(m[6])]);
    // Control points of a monotone Hermite curve stay between their end points (y grows upwards, so smaller SVG y).
    for (let i = 3; i < ys.length; i += 3) expect(ys[i + 2]).toBeLessThanOrEqual(ys[i - 1] + 1e-9);
  });

  it("readings follow the curve, hide with it and print in pink when hidden", () => {
    const e = grouped("cumulative", (s) => {
      s.cumulative.curve = "straight";
      s.cumulative.readings = [{ axis: "y", value: "62", show: "show" }, { axis: "x", value: "30", show: "hidden" }];
    });
    const g = groupedLayout(e);
    expect(g.issues).toEqual([]);
    // 62 is half way between 39 (at 20) and 85 (at 40), so t = 30 on a straight-line graph.
    expect(g.readings[0].x - g.plot.x).toBeCloseTo(30, 6);
    expect(g.readings[1].drawn).toBe(false);
    expect(renderSvg(forView(e, "answer", true))).toMatch(new RegExp(`stroke="${PINK}" stroke-width="0.3" stroke-dasharray`));
    const hiddenCurve = grouped("cumulative", (s) => {
      s.classes.forEach((c) => (c.graph = "hidden"));
      s.cumulative.readings = [{ axis: "y", value: "67", show: "show" }];
    });
    const h = groupedLayout(hiddenCurve);
    expect(h.readings[0].drawn).toBe(false);
    expect(h.notes.some((x) => x.startsWith("Reading 1 is hidden"))).toBe(true);
  });

  it("needs every frequency, and prints the cumulative table", () => {
    expect(layout(grouped("cumulative", (s) => void (s.classes[2].frequency = ""))).issues).toContain(
      "Cumulative frequency needs a frequency for every class. Hide a frequency rather than leaving it blank.",
    );
    const svg = renderSvg(grouped("cumulative", (s) => void (s.table = "cumulative")));
    for (const v of ["11", "39", "85", "113", "134"]) expect(svg).toContain(`>${v}<`);
    expect(svg).toContain(">Cumulative<");
    expect(svg).toMatch(/>0 &lt; <\/text><text[^>]*font-style="italic"[^>]*>t<\/text><text[^>]*> ⩽ 90<\/text>/);
  });
});

describe("grouped kinds share one document", () => {
  it("switching kind keeps the classes and each kind keeps its own vertical axis", () => {
    const e = grouped("histogram");
    for (const kind of ["polygon", "cumulative", "histogram"] as const) {
      e.document.kind = kind;
      expect(layout(e).issues).toEqual([]);
    }
    expect(e.document.grouped!.classes).toHaveLength(5);
  });

  it("a new grouped chart starts with no data rather than made-up numbers", () => {
    const e = create();
    e.document.kind = "histogram";
    const g = layout(e);
    expect(g.issues.length).toBeGreaterThan(0); // the one empty class needs boundaries
    expect(renderSvg(e)).not.toContain("<rect x=\"");
  });

  it("hide all hides the graph; show all shows everything", () => {
    const e = setAllShown(grouped("cumulative", (s) => (s.classes[0].table = "hidden")), "hidden");
    expect(e.document.grouped!.classes.every((c) => c.graph === "hidden")).toBe(true);
    expect(e.document.grouped!.classes[0].table).toBe("hidden");
    const shown = setAllShown(e, "show");
    expect(shown.document.grouped!.classes.every((c) => c.graph === "show" && c.table === "show")).toBe(true);
  });

  it("files round-trip and reject bad grouped settings", () => {
    const e = grouped("polygon");
    expect(canonical(parseFile(JSON.stringify(e)))).toBe(canonical(e));
    const bad = structuredClone(e);
    bad.document.grouped!.xAxis.stepMm = 15;
    expect(() => parseFile(JSON.stringify(bad))).toThrow(/even numbers/);
  });

  it("the examples draw cleanly in both copies", () => {
    for (const x of examples.filter((x) => /^(histogram|polygon|cumulative)-/.test(x.id))) {
      for (const worked of [false, true]) expect(layout(x.make(worked)).issues, x.id).toEqual([]);
      if (x.worked) expect(hasHidden(x.make(false)), x.id).toBe(true);
    }
  });

  it("the connector merges grouped settings field by field", async () => {
    const e = io.create({ spec: { example: "histogram-puzzle" } });
    const next = await io.revise({
      envelope: e,
      baseHash: await io.hash(e),
      operations: [
        { op: "set_kind", kind: "polygon" },
        { op: "set_presentation", presentation: { grouped: { xAxis: { title: "Time" }, polygon: { yAxis: { max: "8", step: "2" } } } } },
      ],
    });
    const g = next.document.grouped!;
    expect(g.xAxis).toMatchObject({ min: "0", max: "60", title: "Time" });
    expect(g.polygon.yAxis).toMatchObject({ min: "0", max: "8", step: "2", title: "Frequency" });
    expect(g.classes).toHaveLength(5);
    expect(layout(next).issues).toEqual([]);
  });
});

describe("review fixes", () => {
  it("a frequency polygon breaks at a blank class instead of joining across it", () => {
    const g = groupedLayout(grouped("polygon", (s) => void (s.classes[1].frequency = "")));
    expect(g.curve.map((c) => c.index)).toEqual([3, 4]);
    expect(g.notes).toContain("The frequency polygon is broken between class 1 and class 3, where a frequency is blank.");
  });

  it("the visible smooth curve does not depend on a hidden value", () => {
    const visible = (hidden: string) => {
      const e = grouped("cumulative", (s) => {
        s.cumulative.curve = "smooth";
        s.classes[2].graph = "hidden";
        s.classes[2].frequency = hidden;
        s.cumulative.yAxis.max = "200";
      });
      return groupedLayout(e).curve.filter((c) => c.drawn).map((c) => c.path).slice(0, 2);
    };
    expect(visible("46")).toEqual(visible("10"));
    // Pupil and answers copies draw the visible parts identically.
    const e = grouped("cumulative", (s) => void (s.classes[2].graph = "hidden"));
    const pupil = groupedLayout(e).curve.filter((c) => c.drawn).map((c) => c.path);
    const answer = groupedLayout(forView(e, "answer", true)).curve.filter((c) => !c.revealed).map((c) => c.path);
    expect(answer).toEqual(pupil);
  });

  it("overlapping classes draw no line (and no NaN)", () => {
    const e = grouped("cumulative", (s) => void (s.classes[1].lower = "5"));
    expect(layout(e).issues).toContain("Class 2: classes must be in order and must not overlap.");
    expect(renderSvg(e)).not.toContain("NaN");
  });
});

it("a curve hidden for pupils to draw is one smooth curve on the answers copy", () => {
  const e = grouped("cumulative", (s) => s.classes.forEach((c) => (c.graph = "hidden")));
  const shown = groupedLayout(grouped("cumulative")).curve.map((c) => c.path);
  expect(groupedLayout(forView(e, "answer", true)).curve.map((c) => c.path)).toEqual(shown);
});

describe("frequency polygon mistakes and a second polygon", () => {
  const xs = (e: Envelope) => groupedLayout(e).points.map((p) => p.x);
  it("plots at a class bound only as a named mistake, and can close the polygon", () => {
    const mid = groupedLayout(grouped("polygon"));
    const upper = grouped("polygon", (g) => void (g.polygon.plotAt = "upper"));
    const lower = grouped("polygon", (g) => void (g.polygon.plotAt = "lower"));
    expect(xs(upper)).toEqual([10, 20, 40, 60, 90].map(mid.X));
    expect(xs(lower)).toEqual([0, 10, 20, 40, 60].map(mid.X));
    expect(groupedLayout(upper).notes).toContain("The points are plotted at the upper class bounds, not the midpoints: a mistake for pupils to find.");
    expect(mid.notes).toEqual([]);
    const closed = groupedLayout(grouped("polygon", (g) => void (g.polygon.close = true)));
    expect(closed.curve).toHaveLength(mid.curve.length + 1);
    const [first, last] = [closed.points[0], closed.points[4]];
    expect(closed.curve[closed.curve.length - 1].path).toBe(`M${n(last.x)},${n(last.y)}L${n(first.x)},${n(first.y)}`);
    expect(closed.notes).toContain("The last point is joined to the first: a mistake for pupils to find.");
  });

  it("a broken polygon is left open", () => {
    const g = groupedLayout(grouped("polygon", (g) => ((g.polygon.close = true), (g.classes[2].frequency = ""))));
    expect(g.curve).toHaveLength(2);
  });

  it("a hidden point also hides the closing line on the pupil copy", () => {
    const e = grouped("polygon", (g) => ((g.polygon.close = true), (g.classes[0].graph = "hidden")));
    const g = groupedLayout(e);
    expect(g.curve.filter((c) => c.drawn)).toHaveLength(3);
    expect(groupedLayout(forView(e, "answer", true)).curve.filter((c) => c.drawn && c.revealed)).toHaveLength(2);
  });

  it("draws a second polygon dashed with a key, and hides its points separately", () => {
    const e = grouped("polygon", (g) => {
      g.polygon.second = true;
      g.polygon.names = ["Boys", "Girls"];
      ["5", "20", "40", "30", "10"].forEach((f, i) => (g.classes[i].frequency2 = f));
      g.classes[2].graph2 = "hidden";
    });
    const g = groupedLayout(e);
    expect(g.issues).toEqual([]);
    expect(g.points2).toHaveLength(5);
    expect(g.curve2.filter((c) => c.drawn)).toHaveLength(2);
    expect(g.key).not.toBeNull();
    expect(g.width).toBeGreaterThan(groupedLayout(grouped("polygon")).width);
    expect(hasHidden(e)).toBe(true);
    const pupil = renderSvg(e);
    expect(pupil).toContain('stroke-dasharray="2.2 1.2"');
    expect(pupil).toContain(">Girls</text>");
    expect(pupil).not.toContain(PINK);
    const answer = forView(e, "answer", true);
    expect(renderSvg(answer)).toContain(PINK);
    expect(layout(answer).width).toBe(g.width);
    expect(setAllShown(e, "show").document.grouped!.classes.every((c) => c.graph2 === "show")).toBe(true);
  });

  it("names a missing key name, a bad second frequency and a table that cannot show both", () => {
    const issues = (change: (g: GroupedSettings) => void) => groupedLayout(grouped("polygon", (g) => ((g.polygon.second = true), (g.polygon.names = ["A", "B"]), change(g)))).issues;
    expect(issues((g) => void (g.polygon.names[1] = ""))).toEqual(["Name both frequency polygons for the key."]);
    expect(issues((g) => void (g.classes[0].frequency2 = "x"))).toEqual(["Class 1: enter a number of 0 or more for the second frequency, or leave it blank."]);
    expect(issues((g) => void (g.table = "frequency"))).toEqual(["A table shows one set of frequencies. Choose no table for two frequency polygons."]);
    // Second frequencies are ignored with only one polygon.
    expect(groupedLayout(grouped("polygon", (g) => void (g.classes[0].frequency2 = "x"))).issues).toEqual([]);
  });

  it("the connector takes classes without second frequencies", async () => {
    const e = io.create({ spec: { example: "polygon-plants" } });
    const next = await io.revise({
      envelope: e,
      baseHash: await io.hash(e),
      operations: [{ op: "set_presentation", presentation: { grouped: { polygon: { close: true }, classes: [{ lower: "0", upper: "10", frequency: "3", table: "show", graph: "show" }] } } }],
    });
    expect(next.document.grouped!.classes[0]).toMatchObject({ frequency2: "", graph2: "show" });
    expect(next.document.grouped!.polygon).toMatchObject({ close: true, plotAt: "midpoint" });
  });
});

describe("a table beside the graph", () => {
  const plants = (beside: boolean, xStep = 20, yStep = 10) => {
    const e = structuredClone(examples.find((x) => x.id === "polygon-plants")!.make(true)) as Envelope;
    const g = e.document.grouped!;
    g.tableBeside = beside;
    g.xAxis.stepMm = xStep;
    g.polygon.yAxis.stepMm = yStep;
    return groupedLayout(e);
  };
  it("puts the table level with the top of the grid, to its right, and saves the table's height", () => {
    const above = plants(false, 10),
      beside = plants(true, 10);
    expect(beside.issues).toEqual([]);
    const t = beside.table!;
    expect(t.y).toBeCloseTo(beside.plot.y);
    expect(t.x).toBeGreaterThan(beside.plot.x + beside.plot.width);
    expect(above.table!.y + 1).toBeLessThan(above.plot.y);
    expect(beside.height).toBeLessThan(above.height - 40);
    expect(beside.height).toBeLessThan(85);
    expect(beside.width).toBeLessThanOrEqual(180);
  });
  it("grows the drawing to fit a table taller than the grid, and says when the pair is too wide", () => {
    const short = plants(true, 10, 4);
    expect(short.height).toBeGreaterThanOrEqual(short.table!.y + short.table!.headH + short.table!.rows.length * 7.6);
    expect(plants(true, 20).issues).toContain("The graph and the table beside it are wider than 18 cm. Put the table above the graph, or use fewer or shorter steps on the horizontal axis.");
  });
  it("draws the table in the same place in the SVG", () => {
    const e = structuredClone(examples.find((x) => x.id === "polygon-plants")!.make(true)) as Envelope;
    e.document.grouped!.tableBeside = true;
    e.document.grouped!.xAxis.stepMm = 10;
    const t = groupedLayout(e).table!;
    expect(renderSvg(e)).toContain(`<rect x="${n(t.x)}" y="${n(t.y)}"`);
  });
});
