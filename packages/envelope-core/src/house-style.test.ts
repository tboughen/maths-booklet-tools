import { describe, expect, it } from "vitest";
import { DEFAULT_PREFERENCE, parsePreference, startingTextPt } from "./house-style";

describe("house style presets (U111)", () => {
  it("keeps a family's own size on Standard and raises it to at least 12 pt on Large print", () => {
    expect(startingTextPt("standard", 11)).toBe(11);
    expect(startingTextPt("large", 11)).toBe(12);
    expect(startingTextPt("large", 12)).toBe(13);
  });
  it("never starts text below 10 pt and respects a family's limits", () => {
    expect(startingTextPt("standard", 9)).toBe(10);
    expect(startingTextPt("large", 14, { min: 9, max: 14 })).toBe(14);
  });
  it("falls back to the defaults for unknown or broken saved preferences", () => {
    expect(parsePreference(null)).toEqual(DEFAULT_PREFERENCE);
    expect(parsePreference("{oops")).toEqual(DEFAULT_PREFERENCE);
    expect(parsePreference({ style: "huge", lines: "bold" })).toEqual({ style: "standard", lines: "bold" });
  });
});

describe("bold lines", () => {
  it("multiplies every stroke width by 1.5 and leaves normal lines alone", async () => {
    const { boldLines } = await import("./house-style");
    const svg = '<path stroke-width=".3"/><line stroke-width="0.2"/>';
    expect(boldLines(svg, "bold")).toBe('<path stroke-width="0.45"/><line stroke-width="0.3"/>');
    expect(boldLines(svg, "normal")).toBe(svg);
    expect(boldLines(svg, undefined)).toBe(svg);
  });
});
