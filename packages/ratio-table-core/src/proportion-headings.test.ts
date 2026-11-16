// @vitest-environment node
import { describe, expect, it } from "vitest";
import { createRatioTable, describeRatio, renderRatioSvg } from "./interchange";
import { headingWidth } from "./svg";

// Proportion tables for NP17 (Tim, 16 Nov 2026): x | y with no arrows, x² | y and 1/x | y, with
// both columns scaled by the same number.

describe("proportion headings", () => {
  it("A: x | y with no arrows", () => {
    const e = createRatioTable({ columns: ["x", "y"], table: [["4", "20"], ["1", "[5]"]], steps: ["÷ 4"] });
    expect(e.document.headings).toEqual([
      { text: "x", italic: true, direction: "none" },
      { text: "y", italic: true, direction: "none" },
    ]);
    const svg = renderRatioSvg(e.document);
    expect(svg).not.toMatch(/l-5 8h10Z|l-8 -5v10Z/);
  });

  it("B1: x² | y, saved as x^2, prints an italic x with an upright raised 2", () => {
    const e = createRatioTable({ columns: ["x² →", "y ↑"], table: [["9", "36"], ["1", "4"], ["25", "100"]], steps: ["÷ 9", "× 25"] });
    expect(e.document.headings[0]).toEqual({ text: "x^2", italic: true, direction: "right" });
    expect(createRatioTable({ columns: ["x^3", "y"], table: [["8", "16"]] }).document.headings[0].text).toBe("x^3");
    const svg = renderRatioSvg(e.document);
    const x = svg.match(/<text stroke="none" fill="#202020" x="([\d.]+)" y="([\d.]+)" font-size="([\d.]+)" font-style="italic">x<\/text>/)!;
    const two = svg.match(/<text stroke="none" fill="#202020" x="([\d.]+)" y="([\d.]+)" font-size="([\d.]+)">2<\/text>/)!;
    expect(Number(two[1])).toBeGreaterThan(Number(x[1]));
    expect(Number(two[2])).toBeLessThan(Number(x[2]));
    // The superscript is at the 10 pt house minimum, never smaller.
    expect(Number(two[3])).toBeCloseTo((10 / 72) * 254, 1);
  });

  it("C2: 1/x | y prints a stacked fraction with an italic x", () => {
    const e = createRatioTable({ columns: ["1/x →", "y ↑"], table: [["1/2", "30"], ["1", "60"], ["1/6", "10"]], steps: ["× 2", "÷ 6"] });
    expect(e.document.headings[0]).toEqual({ text: "1/x", italic: true, direction: "right" });
    const svg = renderRatioSvg(e.document);
    expect(svg).toMatch(/>1<\/text><path d="M[\d.]+ [\d.]+H[\d.]+" stroke-width="2"\/><text[^>]*font-style="italic">x<\/text>/);
    expect(createRatioTable({ columns: ["1/x^2", "y"], table: [["1", "2"]] }).document.headings[0]).toMatchObject({ text: "1/x^2", italic: true });
  });

  it("keeps plain headings and units exactly as before", () => {
    const e = createRatioTable({ columns: ["m/s", "Cost £"], table: [["1", "2"]] });
    expect(renderRatioSvg(e.document)).toContain('text-anchor="middle">m/s</text>');
    expect(headingWidth({ text: "1/x", italic: true, direction: "none" })).toBeLessThan(headingWidth({ text: "1/x", italic: false, direction: "none" }) + 20);
  });

  it("keeps units such as 60/min and 1/km inline, and reads powers aloud in words", () => {
    const e = createRatioTable({ columns: ["6/h", "1/km"], table: [["1", "2"]] });
    const svg = renderRatioSvg(e.document);
    expect(svg).toContain('text-anchor="middle">6/h</text>');
    expect(svg).toContain('text-anchor="middle">1/km</text>');
    const p = createRatioTable({ columns: ["x^2 →", "1/x"], table: [["1", "2"]] });
    expect(describeRatio(p)).toContain("headings x squared → and 1 over x");
  });

  it("refuses a power that is not on one letter group", () => {
    expect(() => createRatioTable({ columns: ["2^x", "y"], table: [["1", "2"]] })).toThrow();
  });
});
