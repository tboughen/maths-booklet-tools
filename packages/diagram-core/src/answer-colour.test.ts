// @vitest-environment node
// Answers copies print saved answers in the house answer colour (pink) in every family that has an
// answer view; given values stay black, and pupil copies never carry the colour.
import { describe, expect, it } from "vitest";
import { drawDiagram } from "./registry";
import { createVenn } from "../../venn-core/src/interchange";
import { create as createChart } from "../../chart-core/src/interchange";

const ANSWER = "#b0125b";

describe("answers copies print revealed answers pink", () => {
  it("Venn: hidden and answer-line regions and labels turn pink; shown ones stay black", () => {
    const e = createVenn({ spec: { sets: 2 } });
    const regions = e.document.regions;
    regions[1] = { ...regions[1], kind: "members", text: "2, 4", visibility: "hidden" };
    regions[3] = { ...regions[3], kind: "members", text: "6", visibility: "line" };
    regions[2] = { ...regions[2], kind: "members", text: "3", visibility: "show" };
    e.document.labels[1] = { text: "Even", visibility: "hidden" };
    const pupil = drawDiagram("venn", e, "pupil").svg;
    const answer = drawDiagram("venn", e, "answer").svg;
    expect(pupil).not.toContain(ANSWER);
    expect(pupil).not.toContain(">2<");
    expect(answer).toContain(ANSWER);
    // Revealed region 1 and label A are pink; the given region 2 is black.
    expect(answer).toMatch(new RegExp(`fill="${ANSWER}"[^>]*>2<`));
    expect(answer).toMatch(new RegExp(`fill="${ANSWER}"[^>]*>6<`));
    expect(answer).toMatch(new RegExp(`fill="${ANSWER}"[^>]*>Even<`));
    expect(answer).toMatch(/fill="black"[^>]*>3</);
    const shown = createVenn({ spec: { sets: 2 } });
    shown.document.regions[1] = { ...shown.document.regions[1], kind: "members", text: "2", visibility: "show" };
    expect(drawDiagram("venn", shown, "answer").svg).not.toContain(ANSWER);
  });

  it("Charts: bars drawn only for the answers copy are pink; given bars stay black", () => {
    const e = createChart({});
    e.document.series[0].values[1].show = "hidden";
    const pupil = drawDiagram("charts", e, "pupil").svg;
    const answer = drawDiagram("charts", e, "answer").svg;
    expect(pupil).not.toContain(ANSWER);
    expect(answer.match(new RegExp(`stroke="${ANSWER}"`, "g"))).toHaveLength(1);
    expect(drawDiagram("charts", createChart({}), "answer").svg).not.toContain(ANSWER);
  });

  it("Charts: a hidden vertical line prints pink", () => {
    const e = createChart({ spec: { kind: "vline" } });
    e.document.series[0].values[0].show = "hidden";
    expect(drawDiagram("charts", e, "answer").svg).toContain(`stroke="${ANSWER}" stroke-width="0.6"`);
  });
});
