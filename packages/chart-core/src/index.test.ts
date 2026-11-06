import { describe, expect, it } from "vitest";
import {
  addCategory,
  addSeries,
  canonical,
  create,
  forView,
  layout,
  parseFile,
  removeCategory,
  removeSeries,
  renderSvg,
  setAllShown,
  validate,
} from "./index";
import { examples } from "./examples";

describe("chart core", () => {
  it("round-trips every example through the editable file format", () => {
    for (const example of examples)
      for (const worked of [false, true]) {
        const e = example.make(worked);
        expect(parseFile(canonical(e))).toEqual(e);
        expect(layout(e).issues).toEqual([]);
      }
  });

  it("keeps blank, zero and hidden values distinct", () => {
    const e = create();
    e.document.kind = "bar";
    e.document.series[0].values[0] = { value: "", show: "show" };
    e.document.series[0].values[1] = { value: "0", show: "show" };
    e.document.series[0].values[2] = { value: "8", show: "hidden" };
    const g = layout(e);
    expect(g.bars.find((b) => b.category === 0)).toBeUndefined();
    expect(g.bars.find((b) => b.category === 1)).toMatchObject({ height: 0, drawn: true });
    expect(g.bars.find((b) => b.category === 2)?.drawn).toBe(false);
    expect(layout(forView(e, "answer")).bars.find((b) => b.category === 2)?.drawn).toBe(true);
    // The answer view never changes the saved document.
    expect(e.document.series[0].values[2].show).toBe("hidden");
  });

  it("keeps other data sets when a dual chart becomes a single bar chart", () => {
    const e = create();
    e.document.kind = "bar";
    const v = validate(e);
    expect(v.document.series).toHaveLength(2);
    expect(layout(v).bars.every((b) => b.series === 0)).toBe(true);
    expect(layout(v).notes[0]).toMatch(/first data set/);
  });

  it("stacks composite bars from the axis", () => {
    const g = layout(examples[1].make(false));
    const year = g.bars.filter((b) => b.category === 0);
    expect(year[0].y + 1e-9).toBeGreaterThanOrEqual(year[1].y + year[1].height - 1e-6);
    expect(year[1].y).toBeCloseTo(year[2].y + year[2].height, 6);
  });

  it("reports invalid drafts instead of drawing a different value", () => {
    const e = create();
    e.document.series[0].values[0].value = "five";
    e.document.axis.step = "3";
    const issues = layout(e).issues.join(" ");
    expect(issues).toMatch(/Car, boys: enter a number/);
    expect(issues).toMatch(/divide the axis range/);
    e.document.axis.step = "1";
    e.document.series[0].values[0].value = "12";
    expect(layout(e).issues.join(" ")).toMatch(/outside the axis/);
  });

  it("draws a vertical line chart as single lines, leaving hidden lines for pupils", () => {
    const pupil = renderSvg(examples[2].make(false));
    const worked = renderSvg(examples[2].make(true));
    expect(pupil.match(/stroke-width="0.6"/g)).toHaveLength(3);
    expect(worked.match(/stroke-width="0.6"/g)).toHaveLength(4);
    expect(worked).not.toMatch(/<rect x="[^"]*" y="[^"]*" width="0"/);
  });

  it("draws a vertical line chart on square grid cells with each line on a grid line", () => {
    const e = examples[2].make(true),
      g = layout(e);
    expect(g.slot).toBeCloseTo(g.major, 9);
    expect(g.plot.width / g.major).toBeCloseTo(e.document.categories.length + 1, 9);
    for (const x of g.centres) expect(((x - g.plot.x) / g.major) % 1).toBeCloseTo(0, 9);
  });

  it("adds and removes categories and data sets within the limits", () => {
    let e = create();
    e = addCategory(e);
    expect(e.document.categories).toHaveLength(5);
    expect(e.document.series.every((s) => s.values.length === 5 && s.values[4].value === "")).toBe(true);
    e = removeCategory(e, 0);
    expect(e.document.categories[0]).toBe("Bus");
    e = addSeries(e);
    expect(e.document.series[2].fill).toBe("white");
    e = removeSeries(removeSeries(removeSeries(e)));
    expect(e.document.series).toHaveLength(1);
    expect(setAllShown(e, "hidden").document.series[0].values.every((c) => c.show === "hidden")).toBe(true);
  });

  it("exports physical millimetre dimensions without editor furniture", () => {
    const e = create(),
      g = layout(e),
      svg = renderSvg(e);
    expect(svg).toContain(`width="${g.width}mm"`);
    expect(svg).not.toMatch(/button|data-|class=/);
  });

  it("rejects unsupported files with a specific message", () => {
    expect(() => parseFile("{}")).toThrow(/not a supported chart file/);
    const e = create() as unknown as { document: { categories: string[] } };
    e.document.categories[0] = "<b>";
    expect(() => validate(e)).toThrow(/category labels/);
  });
});
