// @vitest-environment node
// M84: every family whose files can hold saved answers has an answers copy. Number lines and bar
// models joined on 14 November 2026. Saved answers print in the house answer colour; nothing is
// calculated, pupil copies are unchanged, and families with no saved answers stay pupil-only.
import { describe, expect, it } from "vitest";
import { drawDiagram, FAMILIES } from "./registry";
import * as line from "../../number-line-core/src/index";
import { create as createBar } from "../../bar-model-core/src/versioned-interchange";
import * as bar from "../../bar-model-core/src/versioned";

const ANSWER = "#b0125b";

describe("number line answers copy", () => {
  const e = line.create({
    axis: { minimum: "-2", maximum: "4", step: "1" },
    solution: { id: "s1", kind: "interval", lower: "-1", lowerIncluded: true, upper: "3", upperIncluded: false },
    teaching: { solutionVisible: false, labels: { "2": "answer-line", "0": "hidden" }, answer: "−1 ≤ x < 3", answerVisible: false },
  });
  it("is listed as an answer-view family", () => expect(FAMILIES["number-line"].answerView).toBe(true));
  it("leaves the pupil copy unchanged", () => {
    expect(drawDiagram("number-line", e, "pupil").svg).toBe(line.renderSvg(e));
    expect(line.renderSvg(e)).not.toContain(ANSWER);
  });
  it("prints the hidden solution, answer-line ticks and saved answer in pink; hidden ticks stay hidden", () => {
    const svg = drawDiagram("number-line", e, "answer").svg;
    expect(svg).toContain(`<circle data-value="-1"`);
    expect(svg).toMatch(new RegExp(`<g fill="${ANSWER}" stroke="${ANSWER}"><path d="M[^"]*"/><circle data-value="-1"`));
    expect(svg).toMatch(new RegExp(`<g fill="${ANSWER}"[^>]*><text[^>]*>2</text></g>`));
    expect(svg).toMatch(new RegExp(`<g fill="${ANSWER}"[^>]*><text[^>]*>−1 ≤ x &lt; 3</text></g>`));
    expect(svg).not.toMatch(/>0<\/text>/);
    // Given tick labels stay black.
    expect(svg).toMatch(/<text x="[^"]*" y="[^"]*" text-anchor="middle">1<\/text>/);
  });
  it("shares one layout size for both copies (the answer row adds height)", () => {
    const d = drawDiagram("number-line", e, "pupil");
    expect(d.heightMm).toBeGreaterThan(line.metrics(e.document).height);
  });
  it("adds no pink when nothing was saved hidden", () => {
    const shown = line.create({ solution: { id: "s1", kind: "ray", value: "1", included: true, direction: "right", stop: null } });
    expect(drawDiagram("number-line", shown, "answer").svg).not.toContain(ANSWER);
  });
});

describe("bar model answers copy", () => {
  it.each(["BM08", "H07"])("%s: saved hidden labels print in pink, other states unchanged", (example) => {
    const e = createBar({ spec: { example } });
    const pupil = drawDiagram("bar-model", e, "pupil").svg;
    const answer = drawDiagram("bar-model", e, "answer").svg;
    expect(pupil).toBe(bar.renderSvg(e));
    expect(pupil).not.toContain(ANSWER);
    if (bar.hasHiddenAnswers(e)) expect(answer).toContain(ANSWER);
    else expect(answer).toBe(pupil);
  });
  it("v1, v2 and v3 files all colour a saved hidden part label", () => {
    for (const schemaVersion of [1, 2, 3]) {
      const base = (schemaVersion === 1 ? createBar({ spec: { example: "BM08" } }) : createBar({ spec: { schemaVersion } })) as {
        schemaVersion: number;
        document: { bars: { parts: { labels?: { inside: unknown } }[] }[] };
      };
      if (schemaVersion > 1) base.document.bars[0].parts[0].labels!.inside = { text: "18", state: "hidden" };
      expect(base.schemaVersion).toBe(schemaVersion);
      const answer = drawDiagram("bar-model", base, "answer").svg;
      expect(answer).toContain(ANSWER);
      expect(answer).toMatch(/>18</);
      expect(drawDiagram("bar-model", base, "pupil").svg).not.toMatch(/>18</);
    }
  });
  it("never edits the saved document", () => {
    const e = createBar({ spec: { example: "BM08" } });
    const before = JSON.stringify(e);
    drawDiagram("bar-model", e, "answer");
    expect(JSON.stringify(e)).toBe(before);
  });
});

describe("families without saved answers stay pupil-only", () => {
  it.each(["value-graph", "cuboids"] as const)("%s", (kind) => expect(FAMILIES[kind].answerView).toBe(false));
});
