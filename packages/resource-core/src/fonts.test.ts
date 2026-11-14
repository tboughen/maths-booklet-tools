// @vitest-environment node
// The worksheet text fonts hold every character the measuring table knows, including the
// empty box (□) used in missing-number questions, so PDF and Word never print a missing glyph.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { advance } from "./metrics";

/** Code points mapped by a TrueType font's format 4 (BMP) cmap subtable. */
function mappedCodePoints(file: string): Set<number> {
  const b = readFileSync(file);
  const tables = b.readUInt16BE(4);
  let cmap = -1;
  for (let i = 0; i < tables; i++) {
    const r = 12 + i * 16;
    if (b.toString("latin1", r, r + 4) === "cmap") cmap = b.readUInt32BE(r + 8);
  }
  if (cmap < 0) throw Error(`${file} has no cmap`);
  const out = new Set<number>();
  for (let i = 0; i < b.readUInt16BE(cmap + 2); i++) {
    const sub = cmap + b.readUInt32BE(cmap + 4 + i * 8 + 4);
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
        const glyph = rangeOffset
          ? b.readUInt16BE(offsets + s * 2 + rangeOffset + (c - start) * 2)
          : (c + delta) & 0xffff;
        if (glyph) out.add(c);
      }
    }
  }
  return out;
}

describe("worksheet text fonts", () => {
  for (const [file, style] of [
    ["Inter-Regular.ttf", "regular"],
    ["Inter-SemiBold.ttf", "bold"],
    ["Inter-Italic.ttf", "italic"],
  ] as const) {
    it(`${file} holds the empty box and the worksheet maths symbols, and the table measures them`, () => {
      const mapped = mappedCodePoints(`assets/resource-fonts/${file}`);
      for (const c of "□−×÷²³°θπ≤≥≠√½→↑") {
        expect(mapped.has(c.codePointAt(0)!), `${file} U+${c.codePointAt(0)!.toString(16)}`).toBe(true);
      }
      // The empty box has its own measured width, not the wide unknown-character fallback.
      expect(advance("□", style)).toBeCloseTo(0.9141, 4);
    });
  }
});
