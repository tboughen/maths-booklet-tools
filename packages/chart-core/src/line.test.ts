import { describe, expect, it } from "vitest";
import { forView, renderSvg, CHART_ANSWER_COLOUR } from "./index";
import { plainShapes } from "./examples";

const base = () => plainShapes.find((p) => p.id === "line")!.make();
const lines = (svg: string) => (svg.match(/<line [^>]*>/g) ?? []).filter((l) => l.includes('stroke-width="0.35"'));
const crosses = (svg: string) => (svg.match(/<path d="M[^"]*L[^"]*M[^"]*L[^"]*" stroke="[^"]*" stroke-width="0.35"/g) ?? []).length;

describe("line graph", () => {
  it("draws a cross at every value, joined to the next by straight lines, one data set dashed", () => {
    const svg = renderSvg(base());
    // 2 data sets × 5 days: 10 crosses plus 2 in the key; 2 × 4 joins plus 2 key lines.
    expect(crosses(svg)).toBe(12);
    expect(lines(svg)).toHaveLength(10);
    expect(lines(svg).filter((l) => l.includes("stroke-dasharray"))).toHaveLength(5);
  });
  it("breaks the line at a blank value", () => {
    const e = base();
    e.document.series[0].values[2].value = "";
    expect(lines(renderSvg(e))).toHaveLength(8);
  });
  it("leaves a hidden value and its joins off the pupil copy, and prints them in the answer colour on the answers copy", () => {
    const e = base();
    e.document.series[1].values[3].show = "hidden";
    const pupil = renderSvg(e);
    expect(lines(pupil)).toHaveLength(8);
    expect(pupil).not.toContain(CHART_ANSWER_COLOUR);
    const answers = renderSvg(forView(e, "answer", true));
    const pink = lines(answers).filter((l) => l.includes(CHART_ANSWER_COLOUR));
    expect(pink).toHaveLength(2);
    expect(pink.every((l) => l.includes("stroke-dasharray"))).toBe(true);
  });
});
