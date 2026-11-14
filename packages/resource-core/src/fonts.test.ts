// @vitest-environment node
// The worksheet text fonts hold every character the measuring table knows, including the
// empty box (□) used in missing-number questions, so PDF and Word never print a missing glyph,
// and the fonts' own advance widths match the table, so line breaks match what was measured.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { advance, measuredWidths, type FontStyle } from "./metrics";

function table(b: Buffer, tag: string): number {
  for (let i = 0; i < b.readUInt16BE(4); i++) {
    const r = 12 + i * 16;
    if (b.toString("latin1", r, r + 4) === tag) return b.readUInt32BE(r + 8);
  }
  throw Error(`no ${tag} table`);
}

/** Code point to glyph from the font's format 4 (BMP) cmap subtable. */
function cmap(b: Buffer): Map<number, number> {
  const base = table(b, "cmap");
  const out = new Map<number, number>();
  for (let i = 0; i < b.readUInt16BE(base + 2); i++) {
    const sub = base + b.readUInt32BE(base + 4 + i * 8 + 4);
    if (b.readUInt16BE(sub) !== 4) continue;
    const segs = b.readUInt16BE(sub + 6) / 2;
    const ends = sub + 14;
    const starts = ends + segs * 2 + 2;
    const deltas = starts + segs * 2;
    const offsets = deltas + segs * 2;
    for (let s = 0; s < segs; s++) {
      const end = b.readUInt16BE(ends + s * 2);
      const start = b.readUInt16BE(starts + s * 2);
      const delta = b.readUInt16BE(deltas + s * 2);
      const rangeOffset = b.readUInt16BE(offsets + s * 2);
      for (let c = start; c <= end && c !== 0xffff; c++) {
        const glyph = rangeOffset ? b.readUInt16BE(offsets + s * 2 + rangeOffset + (c - start) * 2) : (c + delta) & 0xffff;
        if (glyph) out.set(c, glyph);
      }
    }
  }
  return out;
}

/** Advance width in em of a glyph, from hmtx. */
function advanceOf(b: Buffer, glyph: number): number {
  const unitsPerEm = b.readUInt16BE(table(b, "head") + 18);
  const metrics = b.readUInt16BE(table(b, "hhea") + 34);
  const hmtx = table(b, "hmtx");
  return b.readUInt16BE(hmtx + Math.min(glyph, metrics - 1) * 4) / unitsPerEm;
}

describe("worksheet text fonts", () => {
  for (const [file, style] of [
    ["Inter-Regular.ttf", "regular"],
    ["Inter-SemiBold.ttf", "bold"],
    ["Inter-Italic.ttf", "italic"],
  ] as [string, FontStyle][]) {
    it(`${file} holds the empty box and the worksheet maths symbols`, () => {
      const map = cmap(readFileSync(`assets/resource-fonts/${file}`));
      for (const c of "□○●ξ∅≈∞−×÷²³°θπ≤≥≠√½→↑")
        expect(map.has(c.codePointAt(0)!), `${file} U+${c.codePointAt(0)!.toString(16)}`).toBe(true);
      // The empty box has its own measured width, not the wide unknown-character fallback.
      expect(advance("□", style)).not.toBe(0.66);
    });
    it(`${file} advance widths match the measuring table for every character`, () => {
      const font = readFileSync(`assets/resource-fonts/${file}`);
      const map = cmap(font);
      const widths = measuredWidths(style);
      expect(Object.keys(widths).length).toBeGreaterThan(200);
      for (const [c, width] of Object.entries(widths)) {
        const glyph = map.get(c.codePointAt(0)!);
        expect(glyph, `${file} has ${c}`).toBeDefined();
        // The table is rounded to 4 decimal places.
        expect(Math.abs(advanceOf(font, glyph!) - width), `${file} ${c}`).toBeLessThan(0.00006);
      }
    });
  }
});
