import { describe, expect, it } from "vitest";
import { applyRatioOperations, createRatioTable, describeRatio, validateRatioEnvelope } from "./interchange";
import { RATIO_ANSWER_COLOUR, ratioMetrics, renderRatioSvg } from "./svg";
import { answerLeaks } from "../../diagram-core/src/answer-leaks";
import { answerSlots } from "../../diagram-core/src/answer-slots";

// Faded ratio tables for booklets (BOOKLET-STANDARD rule N8, Tim, 17 Nov 2026): a hidden heading,
// and a whole table that prints on the answers copy only.
const texts = (svg: string) => [...svg.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map((t) => t[1]);

describe("hidden ratio headings", () => {
  const e = createRatioTable({ columns: ["[x →]", "y ↑"], table: [["2", "6"], ["4", "[12]"]], steps: ["× 2"] });
  it('reads "[x →]" as a hidden heading with its arrow', () => {
    expect(e.document.headings[0]).toEqual({ text: "x", italic: true, direction: "right", hidden: true });
    expect(e.document.headings[1]).toEqual({ text: "y", italic: true, direction: "up" });
    expect(createRatioTable({ columns: ["[Time (min) ↑]", "y"] }).document.headings[0]).toMatchObject({ text: "Time (min)", hidden: true });
  });
  it("leaves the heading and its arrow blank on the pupil copy, at the same size", () => {
    const pupil = renderRatioSvg(e.document, "pupil"), answer = renderRatioSvg(e.document, "answer");
    expect(texts(pupil)).not.toContain("x");
    expect(pupil).not.toContain(RATIO_ANSWER_COLOUR);
    // Only y's arrow (one triangle) remains on the pupil copy.
    expect(pupil.match(/l-5 8h10Z|l-8 -5v10Z/g)).toHaveLength(1);
    expect(pupil.match(/viewBox="[^"]+"/)![0]).toBe(answer.match(/viewBox="[^"]+"/)![0]);
    expect(ratioMetrics(e.document)).toEqual(ratioMetrics({ ...e.document, headings: e.document.headings.map(({ hidden: _, ...h }) => h) }));
  });
  it("prints the heading and its arrow in the answer colour on the answers copy", () => {
    const answer = renderRatioSvg(e.document, "answer");
    const hidden = answer.match(/<g class="ratio-hidden-heading"[^>]*>(.*?)<\/g>/)![1];
    expect(hidden).toContain(">x</text>");
    expect(hidden).toContain("l-8 -5v10Z");
    expect(hidden).not.toContain("#202020");
  });
  it("is a hidden answer slot that never leaks into the pupil copy", () => {
    expect(answerSlots("ratio-table", e).find((s) => s.path === "document.headings.0")).toMatchObject({ state: "hidden", text: "x" });
    expect(answerLeaks("ratio-table", e)).toEqual([]);
    expect(describeRatio(e, "pupil")).toContain("headings blank and y ↑");
    expect(describeRatio(e, "answer")).toContain("hidden heading x →");
  });
  it("saves only true and round-trips", () => {
    const shown = applyRatioOperations(e, [{ op: "set_headings", headings: [{ ...e.document.headings[0], hidden: false as unknown as true }, e.document.headings[1]] }]); // A caller may send false.
    expect(JSON.stringify(shown.document.headings[0])).not.toContain("hidden");
    expect(validateRatioEnvelope(JSON.parse(JSON.stringify(e)))).toEqual(e);
  });
});

describe("answers-only ratio tables", () => {
  const base = { columns: ["x →", "y ↑"], table: [["2", "6"], ["4", "[12]"], ["", "_"]], steps: ["× 2", "[÷ 4]"] };
  const plain = createRatioTable(base), only = createRatioTable({ ...base, answerOnly: true });
  it("keeps the same size and leaves blank paper on the pupil copy", () => {
    const pupil = renderRatioSvg(only.document, "pupil");
    expect(only.document.answerOnly).toBe(true);
    expect(ratioMetrics(only.document)).toEqual(ratioMetrics(plain.document));
    expect(pupil.match(/width="[^"]+cm" height="[^"]+cm"/)![0]).toBe(renderRatioSvg(plain.document).match(/width="[^"]+cm" height="[^"]+cm"/)![0]);
    expect(texts(pupil)).toEqual([]);
    expect(pupil).not.toMatch(/<path|ratio-cell/);
    expect(answerLeaks("ratio-table", only)).toEqual([]);
    expect(describeRatio(only, "pupil")).toBe("Blank space for a ratio table that prints on the answers copy only.");
  });
  it("prints the whole table in the answer colour on the answers copy", () => {
    const answer = renderRatioSvg(only.document, "answer");
    expect(answer).not.toContain("#202020");
    expect(answer).toContain(`class="ratio-answer-only" font-family="STIX Two Text" fill="none" stroke="${RATIO_ANSWER_COLOUR}"`);
    expect(texts(answer)).toEqual(texts(renderRatioSvg(plain.document, "answer")));
    expect(answer).toContain("ratio-rules");
  });
  it("is undoable through set_answer_only and saves only true", () => {
    const on = applyRatioOperations(plain, [{ op: "set_answer_only", answerOnly: true }]);
    expect(on.document).toEqual(only.document);
    const off = applyRatioOperations(on, [{ op: "set_answer_only", answerOnly: false }]);
    expect(off).toEqual(plain);
    expect("answerOnly" in off.document).toBe(false);
  });
  it("reports every value as a hidden slot", () => {
    const states = answerSlots("ratio-table", only).map((s) => s.state);
    expect(states).not.toContain("supplied");
    expect(states).not.toContain("answerLine");
  });
});
