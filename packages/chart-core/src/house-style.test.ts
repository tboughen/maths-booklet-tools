import { describe, expect, it } from "vitest";
import { create, envelopeSchema, renderSvg } from "./index";
import * as io from "./interchange";

const widths = (svg: string) => [...svg.matchAll(/stroke-width="([\d.]+)"/g)].map((m) => Number(m[1]));
const gridOf = (svg: string) => [...svg.matchAll(/stroke="#(?:a6a6a6|cfcfcf)" stroke-width="([\d.]+)"/g)].map((m) => Number(m[1]));

describe("chart line weight (U111)", () => {
  it("bold lines multiply the data and axis strokes by 1.5 and keep the grid and fill patterns", () => {
    const normal = create();
    normal.document.grid = "fine";
    const bold = structuredClone(normal);
    bold.document.lines = "bold";
    const a = renderSvg(normal),
      b = renderSvg(bold);
    expect(gridOf(b)).toEqual(gridOf(a));
    const ink = (svg: string) => widths(svg.split("</defs>")[1].replace(/stroke="#(?:a6a6a6|cfcfcf)" stroke-width="[\d.]+"/g, ""));
    expect(ink(b)).toEqual(ink(a).map((w) => +(w * 1.5).toFixed(4)));
    expect(b.split("</defs>")[0]).toBe(a.split("</defs>")[0]);
    // Strokes never change the layout.
    expect(b.match(/viewBox="[^"]+"/)?.[0]).toBe(a.match(/viewBox="[^"]+"/)?.[0]);
  });
  it("normal is never saved", () => {
    const e = create();
    const parsed = envelopeSchema.parse({ ...e, document: { ...e.document, lines: "normal" } });
    expect("lines" in parsed.document && parsed.document.lines !== undefined).toBe(false);
    expect(JSON.stringify(parsed)).not.toContain('"lines"');
  });
  it("the connector takes lines in presentation, and normal clears it", async () => {
    const e = io.create({ spec: { presentation: { lines: "bold" } } });
    expect(e.document.lines).toBe("bold");
    const back = await io.revise({ envelope: e, baseHash: await io.hash(e), operations: [{ op: "set_presentation", presentation: { lines: "normal" } }] });
    expect(JSON.stringify(back)).not.toContain('"lines"');
    expect(() => io.create({ spec: { presentation: { lines: "heavy" } } })).toThrow();
  });
});
