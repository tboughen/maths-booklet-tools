import { describe, expect, it } from "vitest";
import { create, forView, hasHidden, layout, renderSvg, setAllShown, type Envelope } from "./index";
import { timeseriesLayout } from "./timeseries";
import { TIMESERIES_DEFAULTS, blankTimePoint, type TimeseriesSettings } from "./shared";
import { examples } from "./examples";
import * as io from "./interchange";

const PINK = "#b0125b";
function times(values: string[] = ["20", "35", "30", "45"], change: (s: TimeseriesSettings) => void = () => {}): Envelope {
  const e = create();
  e.document.kind = "timeseries";
  const s = structuredClone(TIMESERIES_DEFAULTS);
  s.points = values.map((value, i) => ({ ...blankTimePoint(), label: ["Jan", "Feb", "Mar", "Apr", "May", "Jun"][i] ?? "", group: "", value, show: "show" as const }));
  change(s);
  e.document.timeseries = s;
  return e;
}
/** The 1 pt (0.353 mm) data paths: straight lines and crosses. */
const data = (svg: string, colour: string) => [...svg.matchAll(new RegExp(`<path d="([^"]+)" stroke="${colour}" stroke-width="0.353"`, "g"))].map((m) => m[1]);
const lines = (svg: string, colour: string) => data(svg, colour).filter((d) => /^M[\d.]+,[\d.]+L/.test(d));
const crosses = (svg: string, colour: string) => data(svg, colour).filter((d) => !/^M[\d.]+,[\d.]+L/.test(d));

describe("time series graphs", () => {
  it("spaces the times equally from the vertical axis on true-size graph paper", () => {
    const e = times();
    const g = timeseriesLayout(e);
    expect(g.issues).toEqual([]);
    expect(g.notes).toEqual([]);
    expect(g.plot).toMatchObject({ width: 40, height: 60 });
    expect(g.X(0)).toBe(g.plot.x);
    expect(g.X(3) - g.X(0)).toBeCloseTo(30, 9);
    // 0–60 in steps of 10 at 10 mm a step: 1 mm a unit.
    expect(g.Y(0) - g.Y(45)).toBeCloseTo(45, 9);
    const svg = renderSvg(e);
    expect(crosses(svg, "black")).toHaveLength(4);
    expect(lines(svg, "black")).toHaveLength(3);
  });

  it("a hidden value leaves its cross and both lines to it, and answers show them in pink at the same size", () => {
    const e = times(undefined, (s) => void (s.points[1].show = "hidden"));
    expect(hasHidden(e)).toBe(true);
    const pupil = renderSvg(e);
    expect(crosses(pupil, "black")).toHaveLength(3);
    expect(lines(pupil, "black")).toHaveLength(1);
    expect(pupil).not.toContain(PINK);
    const answer = forView(e, "answer", true);
    const a = renderSvg(answer);
    expect(crosses(a, PINK)).toHaveLength(1);
    expect(lines(a, PINK)).toHaveLength(2);
    expect(lines(a, "black")).toHaveLength(1);
    expect(layout(answer).width).toBe(layout(e).width);
    expect(layout(answer).height).toBe(layout(e).height);
  });

  it("a blank value is no point and breaks the line; zero is a value", () => {
    const blank = timeseriesLayout(times(["20", "", "30", "45"]));
    expect(blank.issues).toEqual([]);
    expect(blank.points[1]).toBeNull();
    expect(blank.lines.map((l) => l.from)).toEqual([2]);
    expect(blank.notes).toEqual(["A blank value breaks the line between the times either side of it."]);
    const zero = timeseriesLayout(times(["20", "0", "30", "45"]));
    expect(zero.points[1]).toMatchObject({ y: zero.Y(0) });
    expect(zero.lines).toHaveLength(3);
    expect(zero.notes).toEqual([]);
  });

  it("an empty graph is a blank grid for pupils to plot on", () => {
    const e = create();
    e.document.kind = "timeseries";
    const g = timeseriesLayout(e);
    expect(g.issues).toEqual([]);
    expect(g.notes).toEqual(["There are no values yet: the graph is a blank grid for pupils to plot on."]);
    expect(g.points.every((p) => p === null)).toBe(true);
    expect(hasHidden(e)).toBe(false);
  });

  it("prints each group once under its run of times", () => {
    const g = timeseriesLayout(
      times(["1", "2", "3", "4", "5", "6"], (s) => s.points.forEach((p, i) => ((p.label = String((i % 4) + 1)), (p.group = i < 4 ? "2024" : "2025")))),
    );
    expect(g.issues).toEqual([]);
    expect(g.groups.map(({ text, from, to }) => ({ text, from, to }))).toEqual([
      { text: "2024", from: 0, to: 3 },
      { text: "2025", from: 4, to: 5 },
    ]);
    expect(g.groupY).toBeGreaterThan(g.labelY);
    expect(timeseriesLayout(times()).groups).toEqual([]);
  });

  it("names a value that is not a number or off the axis, and a graph too wide or a label too long", () => {
    expect(timeseriesLayout(times(["20", "lots"])).issues).toEqual(["Time 2 (Feb): enter a number for the value, or leave it blank."]);
    expect(timeseriesLayout(times(["20", "75"])).issues).toEqual(["Time 2 (Feb): the value 75 is outside the vertical axis."]);
    expect(timeseriesLayout(times(["20", "-5"], (s) => void (s.points[1].label = ""))).issues).toEqual(["Time 2: the value −5 is outside the vertical axis."]);
    expect(timeseriesLayout(times(["20"], (s) => void (s.points[0].label = "September")))).toMatchObject({
      issues: ["A time label is wider than the space between times. Use shorter labels or a longer space."],
    });
    const wide = timeseriesLayout(
      times(Array(24).fill("10"), (s) => {
        s.slotMm = 20;
        s.points.forEach((p) => (p.label = ""));
      }),
    );
    expect(wide.issues).toContain("The graph is wider than 18 cm. Use fewer times or a shorter space between them.");
  });

  it("keeps long first labels, groups and titles inside the graph, and names groups that run together", () => {
    const fits = (g: ReturnType<typeof timeseriesLayout>, w: number) => g.X(0) - w / 2 >= 0;
    const long = timeseriesLayout(times(["20"], (s) => ((s.slotMm = 40), (s.points[0].label = "Wednesday 12"))));
    expect(long.issues).toEqual([]);
    expect(fits(long, 23.7)).toBe(true);
    const title = timeseriesLayout(times(["20", "30"], (s) => void (s.xTitle = "Number of visitors each week of the year")));
    expect(title.plot.x + title.plot.width / 2 - 39.1 / 2).toBeGreaterThanOrEqual(0);
    const plain = timeseriesLayout(times());
    expect(plain.plot.x).toBe(timeseriesLayout(times(undefined, (s) => void (s.xTitle = ""))).plot.x);
    const crowded = timeseriesLayout(times(["1", "2", "3"], (s) => s.points.forEach((p, i) => ((p.label = ""), (p.group = String(2016 + i)), (s.slotMm = 4)))));
    expect(crowded.issues).toEqual(["Two group labels run into each other. Use shorter groups or a longer space between times."]);
  });

  it("hide every value, then show all", () => {
    const hidden = setAllShown(times(), "hidden");
    expect(hidden.document.timeseries!.points.every((p) => p.show === "hidden")).toBe(true);
    expect(crosses(renderSvg(hidden), "black")).toHaveLength(0);
    expect(hasHidden(setAllShown(hidden, "show"))).toBe(false);
  });

  it("the examples draw cleanly in both copies", () => {
    const xs = examples.filter((x) => x.id.startsWith("timeseries-"));
    expect(xs.map((x) => x.id)).toEqual(["timeseries-gas", "timeseries-quarters", "timeseries-two", "timeseries-misleading"]);
    for (const x of xs) for (const worked of [false, true]) expect(layout(x.make(worked)).issues, x.id).toEqual([]);
    // The construct task leaves every value for pupils; its answers copy plots them in pink.
    const task = examples.find((x) => x.id === "timeseries-quarters")!;
    expect(hasHidden(task.make(false))).toBe(true);
    expect(crosses(renderSvg(task.make(false)), "black")).toHaveLength(0);
    expect(crosses(renderSvg(forView(task.make(false), "answer", true)), PINK)).toHaveLength(12);
    expect(crosses(renderSvg(task.make(true)), "black")).toHaveLength(12);
  });

  it("the connector merges the vertical axis field by field and replaces points", async () => {
    const e = io.create({ spec: { example: "timeseries-gas" } });
    const next = await io.revise({
      envelope: e,
      baseHash: await io.hash(e),
      operations: [{ op: "set_presentation", presentation: { timeseries: { yAxis: { title: "Gas used (units)" }, points: [{ label: "Q1", group: "2025", value: "12", show: "hidden" }] } } }],
    });
    const s = next.document.timeseries!;
    expect(s.yAxis).toMatchObject({ min: "0", max: "60", step: "10", title: "Gas used (units)" });
    expect(s.points).toHaveLength(1);
    expect(s.slotMm).toBe(10);
    expect(layout(next).issues).toEqual([]);
    expect(hasHidden(next)).toBe(true);
  });

  it("a second series is dashed with a key, and its values hide separately", () => {
    const e = times(undefined, (s) => {
      s.second = true;
      s.names = ["Shop A", "Shop B"];
      ["10", "15", "25", "20"].forEach((v, i) => (s.points[i].value2 = v));
      s.points[3].show2 = "hidden";
    });
    const g = timeseriesLayout(e);
    expect(g.issues).toEqual([]);
    expect(g.points2.filter(Boolean)).toHaveLength(4);
    expect(g.lines2.filter((l) => l.drawn)).toHaveLength(2);
    expect(hasHidden(e)).toBe(true);
    const pupil = renderSvg(e);
    expect(pupil).toContain('stroke-dasharray="2.2 1.2"');
    expect(pupil).toContain(">Shop B</text>");
    expect(pupil).not.toContain(PINK);
    const answer = forView(e, "answer", true);
    expect(timeseriesLayout(answer).lines2.filter((l) => l.revealed)).toHaveLength(1);
    expect(layout(answer).width).toBe(g.width);
    expect(timeseriesLayout(times(undefined, (s) => ((s.second = true), (s.names = ["A", ""])))).issues).toEqual(["Name both time series for the key."]);
    expect(timeseriesLayout(times(undefined, (s) => ((s.second = true), (s.names = ["A", "B"]), (s.points[0].value2 = "x")))).issues).toEqual([
      "Time 1 (Jan): enter a number for the second value, or leave it blank.",
    ]);
    // A second value is ignored with only one series.
    expect(timeseriesLayout(times(undefined, (s) => void (s.points[0].value2 = "x"))).issues).toEqual([]);
  });

  it("a hidden label is left for pupils to write and printed pink on answers", () => {
    const e = times(undefined, (s) => void (s.points[2].labelShow = "hidden"));
    expect(hasHidden(e)).toBe(true);
    expect(renderSvg(e)).not.toContain(">Mar</text>");
    const answer = renderSvg(forView(e, "answer", true));
    expect(answer).toMatch(new RegExp(`fill="${PINK}"[^>]*>Mar</text>`));
    expect(layout(forView(e, "answer", true)).height).toBe(layout(e).height);
    // Hiding every value leaves the labels; show all shows them.
    expect(setAllShown(e, "hidden").document.timeseries!.points[2].labelShow).toBe("hidden");
    expect(setAllShown(e, "show").document.timeseries!.points[2].labelShow).toBe("show");
  });

  it("misleading graphs: an axis above 0 without a zig-zag, a curve, and a line across a missing time", () => {
    const plainE = times(["32", "35", "", "40"], (s) => (s.yAxis = { min: "30", max: "45", step: "5", stepMm: 10, title: "" }));
    const g = timeseriesLayout(plainE);
    expect(g.notes).toContain("The vertical axis starts at 30, not 0, with no zig-zag: misleading, for pupils to spot.");
    expect(g.lines).toHaveLength(1);
    const broken = timeseriesLayout(times(["32"], (s) => ((s.yAxis = { min: "30", max: "45", step: "5", stepMm: 10, title: "" }), (s.yBreak = true))));
    expect(broken.notes).toEqual([]);
    expect(broken.corner - (broken.plot.y + broken.plot.height)).toBe(6);
    expect(renderSvg(times(["32"], (s) => ((s.yAxis = { min: "30", max: "45", step: "5", stepMm: 10, title: "" }), (s.yBreak = true))))).toContain(">0</text>");
    expect(timeseriesLayout(times(undefined, (s) => void (s.yBreak = true))).notes).toContain("The vertical axis starts at 0, so its zig-zag is not needed.");
    const curved = timeseriesLayout(times(undefined, (s) => void (s.join = "curve")));
    expect(curved.lines.every((l) => l.path.includes("C"))).toBe(true);
    expect(curved.notes).toContain("The points are joined with a curve, not straight lines: misleading, for pupils to spot.");
    const bridged = timeseriesLayout(times(["20", "", "30", "45"], (s) => void (s.bridge = true)));
    expect(bridged.lines.map((l) => l.from)).toEqual([0, 2]);
    expect(bridged.notes).toEqual(["The line is joined across a time with no value: misleading, for pupils to spot."]);
  });

  it("a curve never bends towards a hidden value, and the answers copy keeps the same curve", () => {
    const curve = (hidden: string) => times(["10", "20", hidden, "30"], (s) => ((s.join = "curve"), (s.points[2].show = "hidden")));
    expect(renderSvg(curve("50"))).toBe(renderSvg(curve("0")));
    const pupil = timeseriesLayout(curve("50")).lines.filter((l) => l.drawn).map((l) => l.path);
    const answer = timeseriesLayout(forView(curve("50"), "answer", true)).lines.filter((l) => !l.revealed).map((l) => l.path);
    expect(answer).toEqual(pupil);
  });
});
