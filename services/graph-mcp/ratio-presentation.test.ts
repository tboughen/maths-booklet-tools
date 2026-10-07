// @vitest-environment node
import { describe, expect, it } from "vitest";
import { Resvg } from "@resvg/resvg-js";
import { resolve } from "node:path";
import {
  createRatioTable,
  renderRatioSvg,
  ratioMetrics,
  numberWidth,
  textWidth,
} from "../../packages/ratio-table-core/src/interchange";
const font = {
  loadSystemFonts: false,
  fontFiles: ["STIXTwoText-Regular.otf", "STIXTwoText-Italic.otf"].map((f) =>
    resolve("assets/graph-fonts", f),
  ),
  defaultFontFamily: "STIX Two Text",
};
const fixture = (size = "standard", annotated = true) =>
  createRatioTable({
    schemaVersion: 1,
    size,
    mode: annotated ? "annotated" : "simple",
    rows: [
      {
        id: "a",
        cells: [
          { kind: "number", value: "2" },
          { kind: "number", value: "-6" },
        ],
      },
      {
        id: "b",
        cells: [
          { kind: "number", value: "1" },
          { kind: "number", value: "-3" },
        ],
      },
    ],
    transitions: [{ from: "a", to: "b", operation: "divide", factor: "2" }],
  });
describe("native ratio-table presentation", () => {
  it("draws the two lesson rules, paired downward arrows and visible fractions with clear margins", () => {
    for (const size of ["compact", "standard", "large"])
      for (const annotated of [true, false]) {
        const envelope = fixture(size, annotated),
          metrics = ratioMetrics(envelope.document),
          svg = renderRatioSvg(envelope.document);
        const renderer = new Resvg(
          svg
            .replace(/<rect[^>]+\/>/, "")
            .replace(/width="[^"]+"/, `width="${Math.ceil(metrics.width)}"`)
            .replace(/height="[^"]+"/, `height="${metrics.height}"`),
          { font },
        );
        const bbox = renderer.innerBBox()!;
        expect(bbox.x).toBeGreaterThanOrEqual(0);
        expect(bbox.y).toBeGreaterThanOrEqual(0);
        expect(bbox.x + bbox.width).toBeLessThanOrEqual(metrics.width);
        expect(bbox.y + bbox.height).toBeLessThanOrEqual(metrics.height);
        const raster = renderer.render(),
          pixels = raster.pixels;
        const ink = (x: number, y: number) =>
          pixels[(Math.round(y) * raster.width + Math.round(x)) * 4 + 3];
        const left = metrics.tableLeft;
        expect(ink(left + 150, 200)).toBe(255); // Continuous centre divider.
        expect(ink(left + 10, 115)).toBe(255); // Header rule.
        expect(ink(left + 10, 215)).toBe(0); // No internal row rule.
        expect(ink(left, 200)).toBe(0); // No outer box.
        if (annotated) {
          expect(ink(left - 16, 248)).toBeGreaterThan(200); // Left arrowhead off its shaft.
          expect(ink(left + 316, 248)).toBeGreaterThan(200); // Right arrowhead off its shaft.
          expect(ink(left - 16, 175)).toBe(0); // No upward/source arrowhead.
        }
        expect(svg).not.toContain("strokeDasharray");
      }
  });
  it("qualifies actual font ink widths for largest accepted digits/fractions/headings", () => {
    for (const value of [
      "99999",
      "−9999",
      "0.125",
      "999999/999983",
      "−99999/999983",
    ]) {
      const [top, bottom] = value.split("/");
      for (const part of [top, ...(bottom ? [bottom] : [])]) {
        const size = bottom
          ? (12 / 72) * 2.54 * 100 * 0.8
          : (12 / 72) * 2.54 * 100;
        const measured = new Resvg(
          `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="100"><text x="20" y="60" font-family="STIX Two Text" font-size="${size}">${part}</text></svg>`,
          { font },
        ).innerBBox()!;
        expect(measured.width).toBeLessThanOrEqual(textWidth(part, size) + 5);
        expect(numberWidth(value)).toBeLessThanOrEqual(126);
      }
    }
    const fraction = createRatioTable({
      schemaVersion: 1,
      rows: [
        {
          cells: [
            { kind: "number", value: "1" },
            { kind: "number", value: "2/3" },
          ],
        },
        { cells: [{ kind: "empty" }, { kind: "answer-line" }] },
      ],
    });
    const svg = renderRatioSvg(fraction.document),
      m = ratioMetrics(fraction.document);
    const r = new Resvg(
      svg
        .replace(/<rect[^>]+\/>/, "")
        .replace(/width="[^"]+"/, `width="${m.width}"`)
        .replace(/height="[^"]+"/, `height="${m.height}"`),
      { font },
    ).render();
    const alpha = (x: number, y: number) => r.pixels[(y * r.width + x) * 4 + 3];
    expect(alpha(240, 165)).toBe(255); // Fraction bar in the first y cell.
    expect(alpha(240, 281)).toBe(255); // Pupil answer line remains in the second y cell.
    expect(svg).toContain('data-kind="empty"></g>');
  });
});
