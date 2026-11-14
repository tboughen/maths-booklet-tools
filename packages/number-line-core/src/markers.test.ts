import { describe, expect, it } from "vitest";
import { apply, create, metrics, renderSvg, validate } from "./index";

const tenths = () => create({ axis: { minimum: "0", maximum: "1", step: "1/10", labelEvery: 10, minorTicks: true } });

describe("arrow markers and minor ticks (U92)", () => {
  it("keeps lines without markers or minor ticks byte-identical", () => {
    const plain = create({ axis: { minimum: "0", maximum: "1", step: "1/10", labelEvery: 10 } });
    expect(plain.document).not.toHaveProperty("markers");
    expect(plain.document.axis).not.toHaveProperty("minorTicks");
    expect(renderSvg(plain)).not.toContain("data-marker");
    expect(metrics(plain.document).axisY).toBe(12);
  });

  it("draws labelled ticks long and the others short", () => {
    const svg = renderSvg(tenths());
    expect(svg.match(/v3\.5"/g)).toHaveLength(2);
    expect(svg.match(/v1\.2"/g)).toHaveLength(9);
  });

  it("adds, edits and removes a lettered arrow between ticks", () => {
    let e = apply(tenths(), [{ op: "add_marker", marker: { id: "a", value: "0.35", label: "A" } }]);
    expect(metrics(e.document).axisY).toBe(14.5);
    const svg = renderSvg(e);
    expect(svg).toContain('data-marker="a"');
    expect(svg).toContain(">A</text>");
    expect(svg).not.toContain("0.35");
    e = apply(e, [{ op: "set_marker", id: "a", value: "7/10", label: "" }]);
    expect(e.document.markers).toEqual([{ id: "a", value: "7/10" }]);
    e = apply(e, [{ op: "set_axis", axis: { minorTicks: false } }, { op: "remove_marker", id: "a" }]);
    expect(e.document).not.toHaveProperty("markers");
    expect(e.document.axis).not.toHaveProperty("minorTicks");
  });

  it("refuses markers off the line, too close, duplicated or with a solution", () => {
    expect(() => apply(tenths(), [{ op: "add_marker", marker: { id: "a", value: "1.2" } }])).toThrow(/visible range/);
    expect(() => apply(tenths(), [{ op: "add_marker", marker: { id: "a", value: "0.3", label: "A" } }, { op: "add_marker", marker: { id: "b", value: "0.31", label: "B" } }])).toThrow(/A and B are too close/);
    expect(() => apply(tenths(), [{ op: "add_marker", marker: { id: "a", value: "0.3" } }, { op: "add_marker", marker: { id: "a", value: "0.6" } }])).toThrow(/unique/);
    expect(() => apply(tenths(), [{ op: "add_marker", marker: { id: "a", value: "0.3" } }, { op: "add_point", point: { id: "p", value: "0.5" } }])).toThrow(/not both/);
    expect(() => apply(tenths(), [{ op: "set_marker", id: "z", value: "0.5" }])).toThrow(/not found/);
    expect(() => validate({ ...tenths(), document: { ...tenths().document, markers: [] } })).toThrow();
  });
});
