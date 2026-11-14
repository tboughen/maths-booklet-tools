import { describe, expect, it } from "vitest";
import { apply, canonical, defaultEnvelope, renderSvg } from "./interchange";

const widths = (svg: string) => [...svg.matchAll(/stroke-width="([\d.]+)"/g)].map((m) => Number(m[1]));
const gridOf = (svg: string) => svg.match(/<g data-layer="grid">[^]*?<\/g>/)?.[0] ?? "";
const ink = (svg: string) => widths(svg.replace(/<g data-layer="grid">[^]*?<\/g>/, ""));

describe("value graph line weight (U111)", () => {
  it("bold lines multiply the table, axes and plots by 1.5 and keep the grid", () => {
    const normal = defaultEnvelope();
    const bold = apply(normal, [{ op: "set_print", settings: { lines: "bold" } }]);
    expect(bold.document.print.lines).toBe("bold");
    const a = renderSvg(normal),
      b = renderSvg(bold);
    expect(gridOf(a)).not.toBe("");
    expect(gridOf(b)).toBe(gridOf(a));
    expect(ink(a).length).toBeGreaterThan(2);
    expect(ink(b)).toEqual(ink(a).map((w) => +(w * 1.5).toFixed(4)));
    expect(b.match(/viewBox="[^"]+"/)?.[0]).toBe(a.match(/viewBox="[^"]+"/)?.[0]);
  });
  it("normal is never saved", () => {
    const bold = apply(defaultEnvelope(), [{ op: "set_print", settings: { lines: "bold" } }]);
    const back = apply(bold, [{ op: "set_print", settings: { lines: undefined } }]);
    expect(canonical(back)).toBe(canonical(defaultEnvelope()));
    expect(canonical(back)).not.toContain('"lines"');
  });
});
