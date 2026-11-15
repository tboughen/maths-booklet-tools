import { describe, expect, it } from "vitest";
import { canonical, create, forView, hasHidden, layout, parseFile, renderSvg, setAllShown, type Envelope } from "./index";
import { scatterLayout } from "./scatter";
import { SCATTER_DEFAULTS, type ScatterSettings } from "./shared";
import { examples } from "./examples";
import * as io from "./interchange";

const PINK = "#b0125b";
function scatter(change: (s: ScatterSettings) => void = () => {}): Envelope {
  const e = create();
  e.document.kind = "scatter";
  e.document.scatter = structuredClone(SCATTER_DEFAULTS);
  e.document.scatter.points = [
    ["1", "2"], ["2", "3"], ["3", "3"], ["4", "5"], ["5", "4"], ["6", "6"], ["7", "7"], ["8", "7"],
  ].map(([x, y]) => ({ x, y, show: "show" as const, ring: false }));
  change(e.document.scatter);
  return e;
}
const crosses = (svg: string, ink = "black") => (svg.match(new RegExp(`l2.4,-2.4" stroke="${ink}"`, "g")) ?? []).length;

describe("scatter graphs", () => {
  it("plots crosses at true scale on arrowed axes and ignores the bar data", () => {
    const e = scatter();
    e.document.axis = { min: "3", max: "1", step: "x", minor: 1 };
    const g = scatterLayout(e);
    expect(g.issues).toEqual([]);
    expect(g.points[0]).toMatchObject({ x: g.plot.x + 10, y: g.plot.y + 100 - 20 });
    const svg = renderSvg(e);
    expect(crosses(svg)).toBe(8);
    expect(svg).toContain('fill="black" stroke="none"');
  });

  it("hidden points, the line and readings are answers drawn in pink at the same size", () => {
    const e = scatter((s) => {
      s.points[0].show = "hidden";
      s.points[0].ring = true;
      s.bestFit = { from: { x: "0", y: "1" }, to: { x: "8", y: "8" }, show: "hidden" };
      s.readings = [{ axis: "x", value: "4", show: "hidden" }];
    });
    const pupil = renderSvg(e);
    expect(crosses(pupil)).toBe(7);
    expect(pupil).not.toContain(PINK);
    expect(pupil).not.toContain("<circle");
    expect(hasHidden(e)).toBe(true);
    const answer = renderSvg(forView(e, "answer", true));
    expect(crosses(answer, PINK)).toBe(1);
    expect(answer).toContain(`<line x1=`);
    expect(answer).toMatch(new RegExp(`stroke="${PINK}" stroke-width="0.3" stroke-dasharray`));
    expect(answer).toContain(`<circle`);
    expect(layout(forView(e, "answer", true)).width).toBe(layout(e).width);
    expect(e.document.scatter!.points[0].show).toBe("hidden");
  });

  it("the line of best fit is the teacher's line, drawn across the grid, and a reading follows it", () => {
    const g = scatterLayout(scatter((s) => {
      s.bestFit = { from: { x: "2", y: "2" }, to: { x: "4", y: "4" }, show: "show" };
      s.readings = [{ axis: "y", value: "6", show: "show" }];
    }));
    const near = (a: number, b: number) => expect(a).toBeCloseTo(b, 6);
    near(g.line!.x1, g.plot.x);
    near(g.line!.y1, g.plot.y + 100);
    near(g.line!.x2, g.plot.x + 100);
    near(g.line!.y2, g.plot.y);
    near(g.readings[0].x, g.plot.x + 60);
    near(g.readings[0].y, g.plot.y + 40);
  });

  it("names specific errors", () => {
    const issues = (f: (s: ScatterSettings) => void) => scatterLayout(scatter(f)).issues;
    expect(issues((s) => (s.points[0].x = "a"))).toEqual(["Point 1: enter a number for both x and y."]);
    expect(issues((s) => (s.points[0].x = "11"))).toEqual(["Point 1: (11, 2) is outside the axes."]);
    expect(issues((s) => (s.xAxis.step = "3"))).toEqual(["The horizontal axis step must divide its range exactly."]);
    expect(issues((s) => (s.yAxis.max = "0"))[0]).toBe("The vertical axis end must be greater than its start.");
    expect(issues((s) => (s.readings = [{ axis: "x", value: "3", show: "show" }]))).toEqual(["Reading 1: add a line of best fit to read from."]);
    expect(issues((s) => (s.bestFit = { from: { x: "1", y: "1" }, to: { x: "1", y: "1" }, show: "show" }))).toEqual(["Line of best fit: the two points must be different."]);
    expect(issues((s) => {
      s.bestFit = { from: { x: "0", y: "9" }, to: { x: "10", y: "9" }, show: "show" };
      s.readings = [{ axis: "y", value: "4", show: "show" }];
    })).toEqual(["Reading 1: a horizontal line cannot be read from the vertical axis."]);
    // Axes may start away from zero.
    expect(issues((s) => {
      s.xAxis.min = "-2";
      s.yAxis.min = "-10";
    })).toEqual([]);
  });

  it("show all shows everything; hide all hides only the points", () => {
    const e = scatter((s) => {
      s.bestFit = { from: { x: "0", y: "1" }, to: { x: "8", y: "8" }, show: "hidden" };
    });
    const hidden = setAllShown(e, "hidden");
    expect(hidden.document.scatter!.points.every((p) => p.show === "hidden")).toBe(true);
    const shown = setAllShown(hidden, "show");
    expect(hasHidden(shown)).toBe(false);
  });

  it("examples round-trip and the connector merges scatter settings", async () => {
    for (const id of ["scatter-judges", "scatter-plot"])
      for (const worked of [false, true]) {
        const e = examples.find((x) => x.id === id)!.make(worked);
        expect(parseFile(canonical(e))).toEqual(e);
        expect(layout(e).issues).toEqual([]);
      }
    const e = io.create({ spec: { example: "scatter-judges" } });
    const r = await io.revise({ envelope: e, baseHash: await io.hash(e), operations: [{ op: "set_presentation", presentation: { scatter: { grid: "major" } } }] });
    expect(r.document.scatter!.grid).toBe("major");
    expect(r.document.scatter!.points).toHaveLength(12);
    expect(io.printFacts(r).referenceFeatures.gridPitchMm).toEqual([20]);
    expect(() => parseFile(canonical({ ...r, document: { ...r.document, scatter: { ...r.document.scatter!, xAxis: { ...r.document.scatter!.xAxis, mm: 200 } } } }))).toThrow(/axis lengths from 40 to 160 mm/);
  });

  it("review fixes: no invented points, hidden lines stay hidden, long titles, invalid axes and connector edits", async () => {
    // A chart switched to scatter has no points of its own.
    const e = create();
    e.document.kind = "scatter";
    expect(scatterLayout(e).points).toEqual([]);
    expect(layout(e).notes.join(" ")).toMatch(/no points/);
    // A shown reading on a hidden line is not drawn on the pupil copy.
    const hiddenLine = scatter((s) => {
      s.bestFit = { from: { x: "0", y: "1" }, to: { x: "8", y: "8" }, show: "hidden" };
      s.readings = [{ axis: "x", value: "4", show: "show" }];
    });
    expect(renderSvg(hiddenLine)).not.toContain("stroke-dasharray");
    expect(layout(hiddenLine).notes.join(" ")).toMatch(/Reading 1 is hidden while the line of best fit is hidden/);
    expect(renderSvg(forView(hiddenLine, "answer", true))).toMatch(/stroke="#b0125b" stroke-width="0.3" stroke-dasharray/);
    // A long horizontal title wraps and widens the drawing instead of being cut off.
    const long = scatter((s) => {
      s.xAxis.mm = 40;
      s.minor = 2;
      s.xAxis.title = "Number of hours spent revising per week";
    });
    const g = scatterLayout(long);
    expect(g.xTitle.length).toBeGreaterThan(1);
    expect(g.issues).toEqual([]);
    // An axis that cannot be drawn does not also flag every point.
    expect(scatterLayout(scatter((s) => (s.xAxis.step = ""))).issues).toEqual(["Enter a positive number for the horizontal axis step."]);
    // Hiding all on another kind leaves saved scatter points alone.
    const bar = scatter();
    bar.document.kind = "bar";
    expect(setAllShown(bar, "hidden").document.scatter!.points.every((p) => p.show === "show")).toBe(true);
    // The connector can merge one axis field and remove the line.
    const withLine = scatter((s) => (s.bestFit = { from: { x: "0", y: "1" }, to: { x: "8", y: "8" }, show: "show" }));
    const r = await io.revise({
      envelope: withLine,
      baseHash: await io.hash(withLine),
      operations: [{ op: "set_presentation", presentation: { scatter: { xAxis: { title: "Mass" }, bestFit: null } } }],
    });
    expect(r.document.scatter!.xAxis).toEqual({ ...SCATTER_DEFAULTS.xAxis, title: "Mass" });
    expect(r.document.scatter!.bestFit).toBeUndefined();
  });
});
