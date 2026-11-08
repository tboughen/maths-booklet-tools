// @vitest-environment node
import { describe, expect, it } from "vitest";
import { Resvg } from "@resvg/resvg-js";
import {
  printRasterSize,
  setDensityBytes,
} from "../../packages/graph-core/src/png-bytes";
import {
  minFontPt,
  pngPrintSize,
  samePrintSizeProblems,
  svgPrintSize,
  svgPrintSizeProblems,
} from "./print-size";

const svg = (
  width: string,
  height: string,
  viewBox = "0 0 100 50",
  body = "",
) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${viewBox}">${body}</svg>`;
const png = (source: string, dpi: number) => {
  const { widthMm } = svgPrintSize(source);
  const r = new Resvg(source, {
    fitTo: { mode: "width", value: Math.round((widthMm / 25.4) * dpi) },
  }).render();
  return setDensityBytes(r.asPng(), dpi);
};

describe("print size", () => {
  it("reads an SVG's printed size in every absolute unit", () => {
    expect(svgPrintSize(svg("10cm", "5cm"))).toMatchObject({
      widthMm: 100,
      heightMm: 50,
      vw: 100,
      vh: 50,
      mmPerUnit: 1,
    });
    expect(svgPrintSize(svg("2in", "1in")).widthMm).toBeCloseTo(50.8);
    expect(svgPrintSize(svg("72pt", "36pt")).widthMm).toBeCloseTo(25.4);
    expect(svgPrintSize(svg("100mm", "50mm")).heightMm).toBe(50);
  });

  it("rejects screen-relative sizes, a missing viewBox and unequal scales", () => {
    expect(svgPrintSizeProblems(svg("100%", "50px"))).toEqual([
      "width/height not in mm, cm, in or pt",
    ]);
    expect(svgPrintSizeProblems(svg("10cm", "5cm", ""))).toEqual([
      "missing viewBox",
    ]);
    expect(svgPrintSizeProblems(svg("10cm", "6cm"))).toEqual([
      "width and height scale differently",
    ]);
    expect(svgPrintSizeProblems(svg("10cm", "5cm"))).toEqual([]);
  });

  it("measures the smallest type in points at print size", () => {
    // 100 user units across 10 cm: 1 unit = 1 mm, so 3.5 units = 3.5 mm = 9.92 pt.
    expect(
      minFontPt(
        svg(
          "10cm",
          "5cm",
          undefined,
          '<text font-size="3.5">a</text><text font-size="5">b</text>',
        ),
      ),
    ).toBeCloseTo(9.92, 2);
    // Doubling the printed width doubles the type.
    expect(
      minFontPt(
        svg("20cm", "10cm", undefined, '<text font-size="3.5">a</text>'),
      ),
    ).toBeCloseTo(19.84, 2);
    expect(
      minFontPt(
        svg("10cm", "5cm", undefined, '<text style="font-size: 11pt">a</text>'),
      ),
    ).toBe(11);
    expect(minFontPt(svg("10cm", "5cm"))).toBeNull();
  });

  it("reads a PNG's printed size from its pixels and density", () => {
    const source = svg("8cm", "4cm"),
      bytes = png(source, 600),
      expected = printRasterSize(8, 4);
    const size = pngPrintSize(bytes);
    expect(size).toMatchObject({
      width: expected.width,
      height: expected.height,
    });
    expect(size.ppi).toBeCloseTo(600, 1);
    expect(size.widthMm).toBeCloseTo(80, 1);
    expect(samePrintSizeProblems(source, bytes)).toEqual([]);
  });

  it("flags a PNG that would print at a different size from its SVG", () => {
    const source = svg("8cm", "4cm");
    // Rendered for 8 cm but labelled 300 ppi, it would print twice as large.
    const doubled = samePrintSizeProblems(
      source,
      setDensityBytes(png(source, 600), 300),
    );
    expect(doubled).toHaveLength(2);
    expect(doubled[0]).toMatch(/^PNG prints 160\.0\d mm wide, SVG 80\.00 mm$/);
    expect(doubled[1]).toMatch(/^PNG prints 80\.0\d mm high, SVG 40\.00 mm$/);
    // Rendered at 300 ppi but labelled 600 ppi, it would print at half size.
    expect(
      samePrintSizeProblems(source, setDensityBytes(png(source, 300), 600)),
    ).toHaveLength(2);
  });
});
