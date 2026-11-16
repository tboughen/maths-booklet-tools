import { describe, expect, it } from "vitest";
import { create, forView, hasHidden, layout, renderSvg, setAllShown, type Envelope } from "./index";
import { boxplotLayout } from "./boxplot";
import { BOXPLOT_DEFAULTS, boxValueNames, type BoxplotSettings } from "./shared";
import { examples } from "./examples";
import * as io from "./interchange";

const PINK = "#b0125b";
function box(change: (b: BoxplotSettings) => void = () => {}): Envelope {
  const e = create();
  e.document.kind = "boxplot";
  const b = structuredClone(BOXPLOT_DEFAULTS);
  const values = ["12", "30", "45", "60", "92"];
  b.rows = [{ label: "Class A", ...Object.fromEntries(boxValueNames.map((k, i) => [k, { value: values[i], show: "show" as const }])) } as BoxplotSettings["rows"][number]];
  change(b);
  e.document.boxplot = b;
  return e;
}
const paths = (svg: string, colour: string) => [...svg.matchAll(new RegExp(`<path d="([^"]+)" stroke="${colour}" stroke-width="0.52"`, "g"))].map((m) => m[1]);

describe("box plots", () => {
  it("draws five 1 cm lines, two whiskers and the box on a true-size scale", () => {
    const e = box();
    const g = boxplotLayout(e);
    expect(g.issues).toEqual([]);
    expect(g.plot).toMatchObject({ width: 100, height: 30 });
    // 0–100 in steps of 10 at 10 mm a step: 1 mm a unit.
    expect(g.X(45) - g.X(0)).toBeCloseTo(45, 9);
    const drawn = paths(renderSvg(e), "black");
    expect(drawn.filter((d) => /v10$/.test(d))).toHaveLength(5);
    expect(drawn).toHaveLength(8);
  });

  it("a hidden value leaves its line and the parts that need it, and answers show them in pink at the same size", () => {
    const e = box((b) => void (b.rows[0].median.show = "hidden"));
    const pupil = renderSvg(e);
    expect(paths(pupil, "black").filter((d) => /v10$/.test(d))).toHaveLength(4);
    expect(pupil).not.toContain(PINK);
    expect(hasHidden(e)).toBe(true);
    const answer = forView(e, "answer", true);
    expect(paths(renderSvg(answer), PINK)).toHaveLength(1);
    expect(layout(answer).width).toBe(layout(e).width);
    expect(layout(answer).height).toBe(layout(e).height);
  });

  it("hiding a quartile also leaves the box and its whisker for pupils", () => {
    const e = box((b) => void (b.rows[0].lq.show = "hidden"));
    const black = paths(renderSvg(e), "black");
    expect(black.filter((d) => /v10$/.test(d))).toHaveLength(4);
    // Only the upper whisker remains of the joining lines.
    expect(black.filter((d) => !/v10$/.test(d))).toHaveLength(1);
    const pink = paths(renderSvg(forView(e, "answer", true)), PINK);
    expect(pink).toHaveLength(3);
  });

  it("an empty band is left for pupils to draw a whole plot", () => {
    const e = box((b) => b.rows.push({ ...structuredClone(b.rows[0]), label: "Class B", ...Object.fromEntries(boxValueNames.map((k) => [k, { value: "", show: "show" as const }])) }));
    const g = boxplotLayout(e);
    expect(g.issues).toEqual([]);
    expect(g.notes).toEqual([]);
    expect(g.plot.height).toBe(60);
  });

  it("names a value out of order, off the scale or not a number", () => {
    expect(boxplotLayout(box((b) => void (b.rows[0].lq.value = "50"))).issues).toEqual(["Box plot 1: the median is less than the lower quartile."]);
    expect(boxplotLayout(box((b) => void (b.rows[0].max.value = "120"))).issues).toEqual(["Box plot 1: the largest value 120 is outside the scale."]);
    expect(boxplotLayout(box((b) => void (b.rows[0].min.value = "ten"))).issues).toEqual(["Box plot 1: enter a number for the smallest value, or leave it blank."]);
  });

  it("notes a plot with only some of its values", () => {
    const g = boxplotLayout(box((b) => void (b.rows[0].max.value = "")));
    expect(g.issues).toEqual([]);
    expect(g.notes).toEqual(["Box plot 1 has 4 of its 5 values; only the parts those values fix are drawn."]);
  });

  it("draws no axis, a plain line or an arrowed line", () => {
    const arrow = renderSvg(box());
    expect(arrow).toMatch(/fill="black" stroke="none"/);
    const line = renderSvg(box((b) => void (b.line = "line")));
    expect(line).not.toMatch(/fill="black" stroke="none"/);
    expect(line).toMatch(/stroke="black" stroke-width="0.529"/);
    const none = renderSvg(box((b) => void (b.line = "none")));
    expect(none).not.toMatch(/stroke="black" stroke-width="0.529"/);
  });

  it("show all reveals every hidden value for the pupil copy", () => {
    const e = box((b) => boxValueNames.forEach((k) => (b.rows[0][k].show = "hidden")));
    expect(hasHidden(e)).toBe(true);
    expect(hasHidden(setAllShown(e))).toBe(false);
  });

  it("the examples draw cleanly in both copies", () => {
    for (const x of examples.filter((x) => x.id.startsWith("boxplot-"))) {
      for (const worked of [false, true]) expect(layout(x.make(worked)).issues, x.id).toEqual([]);
      expect(hasHidden(x.make(false)), x.id).toBe(true);
    }
  });

  it("the connector merges the scale field by field and replaces rows", async () => {
    const e = io.create({ spec: { example: "boxplot-heights" } });
    const next = await io.revise({
      envelope: e,
      baseHash: await io.hash(e),
      operations: [{ op: "set_presentation", presentation: { boxplot: { axis: { title: "Height (cm)" }, line: "line" } } }],
    });
    const b = next.document.boxplot!;
    expect(b.axis).toMatchObject({ min: "130", max: "180", title: "Height (cm)" });
    expect(b.line).toBe("line");
    expect(b.rows).toHaveLength(2);
    expect(layout(next).issues).toEqual([]);
  });
});
