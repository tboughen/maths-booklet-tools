/**
 * Short maths labels in STIX Two, as an exam paper prints them: true minus and times signs,
 * italic letters for algebra (n, 3x + 2), raised squares and cubes, and every fraction stacked
 * (Tim: always stacked fractions, mixed numbers too). Shared by function machines and written
 * methods. Words of three or more letters (input, output, square) stay upright.
 */
import { glyphAdvance } from "../../ratio-table-core/src/font-metrics";

export const FONT = (11 * 25.4) / 72;
export const FAMILY = "STIX Two Text,STIX Two Math,serif";
/** STIX Two Text advances (em) for signs the shared metrics table leaves out. */
const EXTRA: Record<string, number> = { "+": 0.72, "=": 0.72, "(": 0.333, ")": 0.333, "²": 0.33, "³": 0.33, "√": 0.6, ",": 0.25, "<": 0.72, ">": 0.72, "±": 0.72 };
const advance = (c: string, italic = false) => EXTRA[c] ?? glyphAdvance(c, italic);
export const textWidth = (t: string, font = FONT, italic = false) => [...t].reduce((a, c) => a + advance(c, italic), 0) * font;

/** Keyboard signs as printed: -3 → −3, * and a lone x before a number → ×, / at the start → ÷, ^2 → ². */
export function typeset(input: string): string {
  return input
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\^\(?2\)?(?!\d)/g, "²")
    .replace(/\^\(?3\)?(?!\d)/g, "³")
    .replace(/\bsqrt\s*/g, "√")
    .replace(/^\*\s*|(?<=\s)\*\s*/g, "× ")
    .replace(/\*/g, " × ")
    .replace(/^x\s*(?=[\d(.])/, "× ")
    .replace(/(\d) x (?=\d)/g, "$1 × ")
    .replace(/^\/\s*/, "÷ ")
    .replace(/-/g, "−")
    .replace(/ {2,}/g, " ");
}

export type Piece =
  | { kind: "text"; text: string; italic: boolean; width: number }
  | { kind: "fraction"; num: string; den: string; width: number };

const FRACTION = /(−?[0-9a-z.]+)\s*\/\s*([0-9a-z.]+)/g;
function runs(t: string): Piece[] {
  // Letters standing alone or after digits are algebra (3n, x); longer words stay upright.
  const out: Piece[] = [];
  for (const part of t.split(/([A-Za-z]+)/)) {
    if (!part) continue;
    const italic = /^[a-z]{1,2}$/.test(part) && part !== "or";
    const last = out.at(-1);
    if (last && last.kind === "text" && last.italic === italic) {
      last.text += part;
      last.width = textWidth(last.text, FONT, italic);
    } else out.push({ kind: "text", text: part, italic, width: textWidth(part, FONT, italic) });
  }
  return out;
}
/** A label split into upright text, italic letters and stacked fractions. */
export function pieces(input: string): Piece[] {
  const t = typeset(input);
  const out: Piece[] = [];
  let at = 0;
  for (const m of t.matchAll(FRACTION)) {
    out.push(...runs(t.slice(at, m.index)));
    const width = Math.max(textWidth(m[1]), textWidth(m[2])) + 1.2;
    out.push({ kind: "fraction", num: m[1], den: m[2], width });
    at = m.index! + m[0].length;
  }
  out.push(...runs(t.slice(at)));
  return out;
}
export const hasFraction = (t: string) => pieces(t).some((p) => p.kind === "fraction");
export const mathsWidth = (t: string) => pieces(t).reduce((a, p) => a + p.width, 0);
/** Height a label needs: one line, or a stacked fraction. */
export const mathsHeight = (t: string) => (hasFraction(t) ? FONT * 2 + 1.5 : FONT * 1.2);

const num = (v: number) => String(Math.round(v * 1000) / 1000);
export const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const run = (t: string, x: number, y: number, fill: string, italic = false) =>
  `<text x="${num(x)}" y="${num(y)}" font-family="${FAMILY}" font-size="${num(FONT)}"${italic ? ' font-style="italic"' : ""} fill="${fill}" xml:space="preserve">${esc(t)}</text>`;
/** A label centred on (cx, cy): cy is the middle of the line (or the fraction bar). */
export function mathsMarkup(input: string, cx: number, cy: number, fill = "black"): string {
  const ps = pieces(input),
    width = ps.reduce((a, p) => a + p.width, 0);
  let x = cx - width / 2;
  const out: string[] = [];
  for (const p of ps) {
    if (p.kind === "text") out.push(run(p.text, x, cy + FONT * 0.33, fill, p.italic));
    else {
      const mid = x + p.width / 2;
      const center = (s: string, y: number) => {
        const w = mathsWidth(s);
        return runs(s)
          .map((r, i, all) => {
            const left = mid - w / 2 + all.slice(0, i).reduce((a, q) => a + q.width, 0);
            return r.kind === "text" ? run(r.text, left, y, fill, r.italic) : "";
          })
          .join("");
      };
      out.push(center(p.num, cy - 0.9));
      out.push(`<line x1="${num(x + 0.2)}" y1="${num(cy)}" x2="${num(x + p.width - 0.2)}" y2="${num(cy)}" stroke="${fill}" stroke-width="0.25"/>`);
      out.push(center(p.den, cy + FONT * 0.72 + 0.9));
    }
    x += p.width;
  }
  return out.join("");
}
