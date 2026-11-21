import { describe, expect, it } from "vitest";
import { apply, create, metrics, renderSvg, validate, MAX_MARKERS } from "./index";

/** A probability scale as Edexcel prints it: 0 to 1, labelled 0, 1/2 and 1, no arrow. */
const scale = (extra: Record<string, unknown> = {}) =>
  create({ axis: { minimum: "0", maximum: "1", step: "0.1", labelEvery: 5, variable: "", numberFormat: "fraction", ends: "plain" }, widthCm: 12, ...extra });

describe("probability scales (Tim, 21 Nov 2026)", () => {
  it("stops at 0 and 1 with no arrow, closing each end with a tick", () => {
    const svg = renderSvg(scale());
    expect(svg).toContain('data-ends="plain"');
    expect(svg).not.toContain('l-2.5 -1.1v2.2Z'); // the right-pointing arrowhead
    const m = metrics(scale().document);
    expect(m.right).toBe(m.width - 7);
    expect(svg).toContain(`<path d="M${m.left} ${m.axisY - 1.5}v3.5"/>`);
    expect(svg).toContain(`<path d="M${m.right} ${m.axisY - 1.5}v3.5"/>`);
  });
  it("keeps the arrow on lines saved before, and drops the default from the file", () => {
    const old = create({ axis: { minimum: "0", maximum: "1", step: "0.1", variable: "" } });
    expect(renderSvg(old)).not.toContain('data-ends="plain"');
    const back = apply(scale(), [{ op: "set_axis", axis: { ends: "arrow" } }]);
    expect(back.document.axis.ends).toBeUndefined();
  });
  it("refuses a ray on a plain-ended line", () => {
    expect(() => validate({ ...scale(), document: { ...scale().document, solution: { kind: "ray", id: "r", value: "0.5", included: true, direction: "right", intentional: false, stop: null } } })).toThrow(/plain ends/);
  });
  it("prints words under 0, 1/2 and 1, kept inside the drawing", () => {
    const e = apply(scale(), [{ op: "set_words", words: [{ value: "0", text: "Impossible" }, { value: "1/2", text: "Even chance" }, { value: "1", text: "Certain" }] }]);
    const svg = renderSvg(e);
    for (const w of ["Impossible", "Even chance", "Certain"]) expect(svg).toContain(`>${w}</text>`);
    expect(metrics(e.document).height).toBeGreaterThan(metrics(scale().document).height);
    expect(apply(e, [{ op: "set_words", words: null }]).document.words).toBeUndefined();
  });
  it("refuses words that overlap or sit off the line", () => {
    expect(() => apply(scale({ widthCm: 4 }), [{ op: "set_words", words: [{ value: "0", text: "Impossible" }, { value: "1/2", text: "Even chance" }] }])).toThrow(/overlap/);
    expect(() => apply(scale(), [{ op: "set_words", words: [{ value: "2", text: "Certain" }] }])).toThrow(/visible range/);
    expect(() => apply(scale(), [{ op: "set_words", words: [{ value: "0", text: "<b>" }] }])).toThrow();
  });
  it("labels arrows with fractions (stacked) and words", () => {
    const e = apply(scale(), [
      { op: "add_marker", marker: { id: "a", value: "1/3", label: "1/3" } },
      { op: "add_marker", marker: { id: "b", value: "0.9", label: "Likely" } },
    ]);
    const svg = renderSvg(e);
    expect(svg).toContain(">Likely</text>");
    expect(svg).toMatch(/<path d="M[\d.]+ [\d.]+h[\d.]+"\/><text x="[\d.]+" y="[\d.]+" text-anchor="middle">3<\/text>/); // a fraction bar over 3
    expect(metrics(e.document).axisY).toBeGreaterThan(metrics(apply(scale(), [{ op: "add_marker", marker: { id: "a", value: "0.3", label: "A" } }]).document).axisY);
  });
  it("makes room for a fraction label under a prompt, keeps negative fraction labels apart and saves arrow ends once", () => {
    const withPrompt = (label: string) => apply(scale({ teaching: { prompt: "Which fraction?" } }), [{ op: "add_marker", marker: { id: "a", value: "0.3", label } }]);
    expect(metrics(withPrompt("1/3").document).axisY).toBeGreaterThan(metrics(withPrompt("A").document).axisY);
    const neg = create({ axis: { minimum: "-1", maximum: "1", step: "0.5", variable: "" }, widthCm: 8 });
    expect(() => apply(neg, [{ op: "add_marker", marker: { id: "a", value: "-1/2", label: "-1/2" } }, { op: "add_marker", marker: { id: "b", value: "-0.32", label: "B" } }])).toThrow(/too close/);
    expect(create({ axis: { minimum: "0", maximum: "1", step: "0.1", ends: "arrow" } }).document.axis.ends).toBeUndefined();
    expect(() => apply(scale(), [{ op: "set_words", words: [{ value: "0", text: "Even  chance" }] }])).toThrow();
  });
  it(`takes up to ${MAX_MARKERS} arrows and hundredths`, () => {
    const many = Array.from({ length: MAX_MARKERS }, (_, i) => ({ id: `m${i}`, value: String(i / 10), label: "ABCDEFGHIJ"[i] }));
    expect(apply(scale({ widthCm: 16 }), many.map((marker) => ({ op: "add_marker", marker }))).document.markers).toHaveLength(MAX_MARKERS);
    const hundredths = create({ axis: { minimum: "0", maximum: "1", step: "0.01", labelEvery: 10, variable: "", minorTicks: true, ends: "plain" }, widthCm: 16 });
    expect(renderSvg(hundredths).match(/<path d="M[\d.]+ [\d.]+v1\.2"\/>/g)?.length).toBe(90);
    expect(() => create({ axis: { minimum: "0", maximum: "1", step: "0.005", variable: "" } })).toThrow(/2–100/);
  });
});
