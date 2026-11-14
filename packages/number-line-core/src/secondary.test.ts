import { describe, expect, it } from "vitest";
import { apply, create, forView, renderSvg, secondaryText, secondaryTicks, validate } from "./index";

const bar = (labels: Record<string, "value" | "hidden" | "answer-line"> = {}) =>
  create({ axis: { minimum: "0", maximum: "40", step: "4", variable: "" }, secondary: { minimum: "0", maximum: "100", unit: "%", unitPlace: "after", style: "bar", labels } });

describe("second scale and percentage bar (U109)", () => {
  it("pairs exact values with every tick and prints units", () => {
    const e = bar();
    expect(secondaryTicks(e.document)).toEqual(["0", "10", "20", "30", "40", "50", "60", "70", "80", "90", "100"]);
    expect(secondaryText(e.document, "30")).toBe("30%");
    const thirds = create({ axis: { minimum: "0", maximum: "3", step: "1", variable: "" }, secondary: { minimum: "0", maximum: "1", unit: "", unitPlace: "after", style: "line", labels: {} } });
    expect(secondaryTicks(thirds.document)).toEqual(["0", "1/3", "2/3", "1"]);
    const money = create({ axis: { minimum: "0", maximum: "5", step: "1", variable: "" }, secondary: { minimum: "0", maximum: "8", unit: "£", unitPlace: "before", style: "line", labels: {} } });
    expect(secondaryText(money.document, "8/5")).toBe("£1.60");
  });

  it("draws a closed bar with labels above, and leaves no trace on files without a second scale", () => {
    const svg = renderSvg(bar());
    expect(svg).toContain("<rect data-bar=");
    expect(svg).toContain(">100%</text>");
    expect(JSON.stringify(create({}))).not.toContain("secondary");
  });

  it("keeps answer-line and hidden labels off the pupil copy, and reveals only answer lines on the answers copy", () => {
    const e = bar({ "30": "answer-line", "70": "hidden" });
    expect(renderSvg(e)).not.toContain(">30%<");
    expect(renderSvg(e)).not.toContain(">70%<");
    const answers = renderSvg(e, true);
    expect(answers).toMatch(/#b0125b[^]*>30%</);
    expect(answers).not.toContain(">70%<");
    expect(forView(e, "pupil")).toBe(e);
  });

  it("adds, labels and removes the second scale by operations, refusing clashes", () => {
    let e = create({ axis: { minimum: "0", maximum: "10", step: "1", variable: "" } });
    e = apply(e, [{ op: "set_secondary", secondary: { minimum: "0", maximum: "50", unit: "kg", unitPlace: "after", style: "line", labels: {} } }, { op: "set_secondary_label", value: "25", state: "answer-line" }]);
    expect(e.document.secondary?.labels).toEqual({ "25": "answer-line" });
    expect(() => apply(e, [{ op: "set_secondary_label", value: "26", state: "hidden" }])).toThrow(/exact values at the ticks/);
    expect(() => apply(e, [{ op: "set_solution", solution: { kind: "ray", id: "r", value: "2", included: true, direction: "right", intentional: false, stop: null } }])).toThrow(/can't be combined/);
    expect(() => apply(e, [{ op: "set_secondary", secondary: { minimum: "0", maximum: "5000", unit: "kg", unitPlace: "after", style: "line", labels: {} } }])).toThrow(/overlap/);
    e = apply(e, [{ op: "set_secondary", secondary: null }]);
    expect(e.document.secondary).toBeUndefined();
    expect(validate(e)).toEqual(e);
  });
});
