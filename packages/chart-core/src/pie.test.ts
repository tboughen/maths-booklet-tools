import { describe, expect, it } from "vitest";
import { create, forView, layout, parseFile, canonical, renderSvg, type Envelope } from "./index";
import { pieLayout } from "./pie";
import * as io from "./interchange";

function pie(values: [string, "show" | "hidden"][], categories = values.map((_, i) => `c${i + 1}`)): Envelope {
  const e = create();
  e.document.kind = "pie";
  e.document.categories = categories;
  e.document.series = [{ name: "f", fill: "white", values: values.map(([value, show]) => ({ value, show })) }];
  return e;
}
const PINK = "#b0125b";

describe("pie charts", () => {
  it("draws exact sectors clockwise from the upward radius in category order", () => {
    const g = pieLayout(pie([["11", "show"], ["17", "show"], ["8", "show"]]));
    expect(g.issues).toEqual([]);
    expect(g.sectors.map((s) => [s.start, s.end])).toEqual([[0, 110], [110, 280], [280, 360]]);
    expect(g.edges.map((x) => x.angle)).toEqual([0, 110, 280]);
    expect(g.notes).toEqual([]);
  });

  it("a fully hidden pie prints only the circle and starting radius; the answers copy draws the rest in pink", () => {
    const e = pie([["11", "hidden"], ["17", "hidden"], ["8", "hidden"]], ["burger", "pie", "hot dog"]);
    const pupil = renderSvg(e);
    expect(pupil).toContain("<circle");
    expect((pupil.match(/L/g) ?? []).length).toBe(1);
    expect(pupil).not.toContain(">burger<");
    expect(pupil).not.toContain(PINK);
    const answer = renderSvg(forView(e, "answer", true));
    expect(answer).toContain(`stroke="${PINK}"`);
    expect(answer).toContain(`fill="${PINK}">burger`);
    // The starting radius stays black.
    expect(answer).toMatch(/<path d="M[\d.]+,[\d.]+L[\d.]+,[\d.]+" stroke="black"/);
    // Pupil and answers copies are the same size.
    expect(layout(forView(e, "answer", true))).toMatchObject({ width: layout(e).width, height: layout(e).height });
    // The answer view never changes the saved document.
    expect(e.document.series[0].values.every((c) => c.show === "hidden")).toBe(true);
  });

  it("an edge next to a drawn sector prints in black; edges between hidden sectors print only on answers", () => {
    const e = pie([["24", "show"], ["15", "show"], ["12", "hidden"], ["9", "hidden"]]);
    const answer = pieLayout(forView(e, "answer", true));
    expect(answer.edges.map((x) => [x.angle, x.revealed])).toEqual([[0, false], [144, false], [234, false], [306, true]]);
    expect(pieLayout(e).edges.map((x) => x.angle)).toEqual([0, 144, 234]);
  });

  it("blank, non-numeric and negative values are specific errors; zero is a value", () => {
    expect(pieLayout(pie([["", "show"], ["3", "show"]])).issues[0]).toMatch(/c1: enter a number\. A pie chart needs every value/);
    expect(pieLayout(pie([["x", "show"], ["3", "show"]])).issues).toEqual(["c1: enter a number."]);
    expect(pieLayout(pie([["-1", "show"], ["3", "show"]])).issues).toEqual(["c1: values cannot be negative."]);
    expect(pieLayout(pie([["0", "show"], ["0", "show"]])).issues).toEqual(["The values must add up to more than 0."]);
    const zero = pieLayout(pie([["0", "show"], ["3", "show"]]));
    expect(zero.issues).toEqual([]);
    expect(zero.labels.map((l) => l.category)).toEqual([1]);
  });

  it("ignores the bar-chart axis and notes angles that are not whole numbers", () => {
    const e = pie([["1", "show"], ["2", "show"], ["4", "show"]]);
    e.document.axis = { min: "5", max: "1", step: "0", minor: 1 };
    const g = layout(e);
    expect(g.issues).toEqual([]);
    expect(g.notes.join(" ")).toMatch(/not whole numbers/);
  });

  it("labels print the name, angle or percentage, inside when they fit and outside otherwise", () => {
    const e = pie([["35", "show"], ["1", "show"]], ["football", "a very long name"]);
    e.document.pie = { radiusMm: 40, labels: "name-angle" };
    const g = pieLayout(e);
    expect(g.labels[0].lines).toEqual(["football", "350°"]);
    const inside = (l: (typeof g.labels)[number]) => Math.hypot(l.x - g.cx, l.y - g.cy) < g.r && Math.hypot(l.x + l.width - g.cx, l.y + l.height - g.cy) < g.r;
    expect(inside(g.labels[0])).toBe(true);
    expect(inside(g.labels[1])).toBe(false);
    e.document.pie.labels = "name-percent";
    expect(pieLayout(e).labels[1].lines).toEqual(["a very long name", "2.8%"]);
    e.document.pie.labels = "none";
    expect(renderSvg(e)).not.toContain("<text");
  });

  it("the radius is true size and saved settings round-trip", () => {
    const e = pie([["1", "show"], ["1", "show"]]);
    e.document.pie = { radiusMm: 60, labels: "none" };
    const g = pieLayout(e);
    expect(g.r).toBe(60);
    expect(g.width).toBeCloseTo(124, 1);
    expect(parseFile(canonical(e))).toEqual(e);
    expect(() => parseFile(canonical({ ...e, document: { ...e.document, pie: { radiusMm: 80, labels: "none" } } }))).toThrow(/radius from 25 to 70/);
  });

  it("the connector merges pie settings and keeps hidden sectors", async () => {
    const e = io.create({ spec: { example: "pie-snacks" } });
    expect(e.document.kind).toBe("pie");
    expect(e.document.series[0].values.every((c) => c.show === "hidden")).toBe(true);
    const r = await io.revise({ envelope: e, baseHash: await io.hash(e), operations: [{ op: "set_presentation", presentation: { pie: { labels: "name-angle" } } }] });
    expect(r.document.pie).toEqual({ radiusMm: 50, labels: "name-angle" });
    expect(io.printFacts(r).referenceFeatures.gridPitchMm).toEqual([]);
  });
});
