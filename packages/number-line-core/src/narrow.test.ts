import { describe, expect, it } from "vitest";
import { apply, create, markerLabelX, metrics, renderSvg, validate } from "./index";

const rounding = (widthCm: number) => create({ axis: { minimum: "3.4", maximum: "3.5", step: "1/100", labelEvery: 10, minorTicks: true, variable: "" }, widthCm });

describe("narrow number lines and number labels on arrows", () => {
  it("prints a line as narrow as 4 cm at its true size, still at 11 pt", () => {
    const e = rounding(4), m = metrics(e.document);
    expect(m.widthCm).toBe(4);
    const svg = renderSvg(e);
    expect(svg).toContain('width="4cm"');
    expect(svg).toContain(`font-size="${11 * 25.4 / 72}"`);
    expect(() => rounding(3.9)).toThrow();
    expect(() => apply(rounding(6), [{ op: "set_print", widthCm: 3.5 }])).toThrow();
  });

  it("refuses tick labels that would collide on a narrow line, rather than shrinking them", () => {
    expect(() => create({ axis: { minimum: "3000", maximum: "5000", step: "100", labelEvery: 2, variable: "" }, widthCm: 6 })).toThrow(/Tick labels overlap/);
    expect(() => create({ axis: { minimum: "3000", maximum: "5000", step: "100", labelEvery: 10, variable: "" }, widthCm: 6 })).not.toThrow();
  });

  it("labels arrows with numbers such as 3.47, −2.5 and 12 500", () => {
    const e = apply(rounding(6), [{ op: "add_marker", marker: { id: "a", value: "3.47", label: "3.47" } }]);
    expect(renderSvg(e)).toContain(">3.47</text>");
    const neg = create({ axis: { minimum: "-3", maximum: "0", step: "1/2", labelEvery: 2, variable: "" }, widthCm: 6, markers: [{ id: "n", value: "-2.5", label: "-2.5" }] });
    expect(renderSvg(neg)).toContain(">−2.5</text>");
    const big = create({ axis: { minimum: "12000", maximum: "13000", step: "100", labelEvery: 10, minorTicks: true, variable: "" }, widthCm: 8, markers: [{ id: "b", value: "12500", label: "12 500" }] });
    expect(renderSvg(big)).toContain(">12 500</text>");
    for (const bad of ["1234567890123", "Even  chance", "1/0", "1/3/4", " 3.4", "3.4 ", "3  4", "<b>", "x/y", "-", "...", "3-4", "12 50", "£5"])
      expect(() => apply(rounding(6), [{ op: "add_marker", marker: { id: "a", value: "3.45", label: bad } }]), bad).toThrow();
  });

  it("moves an end label inwards to stay inside the drawing, and checks the moved label for collisions", () => {
    const axis = { minimum: "-13000", maximum: "-12000", step: "100", labelEvery: 10, minorTicks: true, variable: "" };
    const e = create({ axis, widthCm: 6, markers: [{ id: "a", value: "-13000", label: "-13 000" }] });
    const d = validate(e).document, x = markerLabelX(d, d.markers![0]);
    expect(x).toBeGreaterThan(metrics(d).left);
    expect(renderSvg(e)).toContain(`<text x="${x}"`);
    const right = validate(create({ axis, widthCm: 6, markers: [{ id: "a", value: "-12000", label: "-12 000" }] })).document;
    expect(markerLabelX(right, right.markers![0])).toBeLessThanOrEqual(60 - 1);
    expect(() => create({ axis, widthCm: 6, markers: [{ id: "a", value: "-13000", label: "-13 000" }, { id: "b", value: "-12700", label: "-12 700" }] })).toThrow(/too close/);
  });

  it("refuses tick labels that would run off the edge or touch a letter printed below", () => {
    expect(() => create({ axis: { minimum: "-130000", maximum: "-120000", step: "5000", variable: "" }, widthCm: 14 })).toThrow(/runs off the edge/);
    expect(() => create({ axis: { minimum: "120000", maximum: "130000", step: "5000", variable: "x", variableBelow: true }, widthCm: 14 })).toThrow(/touches the letter x/);
    expect(() => create({ axis: { minimum: "120000", maximum: "130000", step: "5000", variable: "x" }, widthCm: 14 })).not.toThrow();
  });

  it("refuses arrow labels that would collide", () => {
    expect(() => apply(rounding(6), [{ op: "add_marker", marker: { id: "a", value: "3.44", label: "3.44" } }, { op: "add_marker", marker: { id: "b", value: "3.45", label: "3.45" } }])).toThrow(/too close/);
    expect(() => apply(rounding(16), [{ op: "add_marker", marker: { id: "a", value: "3.44", label: "3.44" } }, { op: "add_marker", marker: { id: "b", value: "3.47", label: "3.47" } }])).not.toThrow();
  });
});
