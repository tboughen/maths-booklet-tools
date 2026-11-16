/**
 * Equation sides and bubble operations in STIX Two, as an exam paper prints them: true minus and
 * times signs, italic letters, raised squares, and every fraction stacked (Tim: always stacked
 * fractions). A bracketed numerator or denominator, as in (y − 2)/3, stacks without its brackets,
 * which is what changing the subject needs. Shares the glyph metrics and the label helper of the
 * function machine tool.
 */
import { glyphAdvance } from "../../ratio-table-core/src/font-metrics";
import { esc } from "../../function-machine-core/src/maths-text";

export { esc };
/** 11 pt in millimetres: the house body size for diagram labels. */
export const FONT = (11 * 25.4) / 72;
export const FAMILY = "STIX Two Text,STIX Two Math,serif";
/** STIX Two Text advances (em) for signs the shared metrics table leaves out. */
const EXTRA: Record<string, number> = {
  "+": 0.72, "=": 0.72, "(": 0.333, ")": 0.333, "²": 0.33, "³": 0.33, "√": 0.6, ",": 0.25,
  "<": 0.72, ">": 0.72, "≤": 0.72, "≥": 0.72, "±": 0.72, π: 0.54,
};
const advance = (c: string, italic = false) => EXTRA[c] ?? glyphAdvance(c, italic);
export const textWidth = (t: string, font = FONT, italic = false) => [...t].reduce((a, c) => a + advance(c, italic), 0) * font;

/** Words that print upright; every other run of letters is algebra and prints in italic. */
const UPRIGHT = new Set(["square", "squared", "root", "cube", "cubed", "sin", "cos", "tan", "and", "or", "of"]);

/**
 * An equation side as printed: keyboard signs become true signs and binary plus and minus get a
 * space each side, so 3x+2 and 3x + 2 print the same.
 */
export function typesetSide(input: string): string {
  return input
    .trim()
    .replace(/\s+/g, " ")
    .replace(/<=/g, "≤")
    .replace(/>=/g, "≥")
    .replace(/\^\(?2\)?(?!\d)/g, "²")
    .replace(/\^\(?3\)?(?!\d)/g, "³")
    .replace(/\bsqrt\s*/g, "√")
    .replace(/\bpi\b/g, "π")
    .replace(/-/g, "−")
    .replace(/\s*\*\s*/g, " × ")
    .replace(/(?<=[\p{L}\p{N})²³.])\s*([+−])\s*/gu, " $1 ")
    .replace(/ {2,}/g, " ")
    .trim();
}

/** A bubble's operation as printed, with no space after its sign: −2, ÷3, ×3, +5, −3x. */
export function typesetOp(input: string): string {
  const t = input.trim().replace(/\s+/g, " ");
  if (!t) return "";
  const signed = t
    .replace(/^\*\s*/, "×")
    .replace(/^x\s*(?=[\d(.])/, "×")
    .replace(/^\/\s*/, "÷")
    .replace(/^-\s*/, "−");
  const m = signed.match(/^([+−×÷])\s*(.*)$/);
  return m ? m[1] + typesetSide(m[2]) : typesetSide(signed);
}

export type Piece =
  | { kind: "text"; text: string; italic: boolean; width: number }
  | { kind: "fraction"; num: string; den: string; width: number };

function runs(t: string): Piece[] {
  const out: Piece[] = [];
  for (const part of t.split(/([A-Za-z]+)/)) {
    if (!part) continue;
    const italic = /^[A-Za-z]+$/.test(part) && !UPRIGHT.has(part.toLowerCase());
    const last = out.at(-1);
    if (last && last.kind === "text" && last.italic === italic) {
      last.text += part;
      last.width = textWidth(last.text, FONT, italic);
    } else out.push({ kind: "text", text: part, italic, width: textWidth(part, FONT, italic) });
  }
  return out;
}
const runsWidth = (t: string) => runs(t).reduce((a, p) => a + p.width, 0);

/** The group a fraction bar takes on one side: a bracketed group (without its brackets) or a run. */
function groupBefore(t: string, end: number): { from: number; text: string } | null {
  let i = end;
  while (i > 0 && t[i - 1] === " ") i--;
  if (t[i - 1] === ")") {
    let depth = 0;
    for (let j = i - 1; j >= 0; j--) {
      if (t[j] === ")") depth++;
      else if (t[j] === "(" && --depth === 0) return { from: j, text: t.slice(j + 1, i - 1).trim() };
    }
    return null;
  }
  let j = i;
  while (j > 0 && /[\p{L}\p{N}.²³√π]/u.test(t[j - 1])) j--;
  if (j === i) return null;
  // A minus straight after a sign or at the start belongs to a number on its own (−6/−2); in front of a
  // term (x − 6/2) it stays outside the fraction, as printed.
  if (t[j - 1] === "−" && (j === 1 || /[(×÷/]/.test(t[j - 2]))) j--;
  return { from: j, text: t.slice(j, i) };
}
function groupAfter(t: string, start: number): { to: number; text: string } | null {
  let i = start;
  while (t[i] === " ") i++;
  if (t[i] === "(") {
    let depth = 0;
    for (let j = i; j < t.length; j++) {
      if (t[j] === "(") depth++;
      else if (t[j] === ")" && --depth === 0) return { to: j + 1, text: t.slice(i + 1, j).trim() };
    }
    return null;
  }
  // A signed denominator (x/−2) keeps its sign.
  let j = t[i] === "−" ? i + 1 : i;
  const first = j;
  while (j < t.length && /[\p{L}\p{N}.²³√π]/u.test(t[j])) j++;
  return j > first ? { to: j, text: t.slice(i, j) } : null;
}

/** Already-typeset text split into upright text, italic letters and stacked fractions. */
export function piecesOf(t: string): Piece[] {
  const out: Piece[] = [];
  let at = 0;
  for (let i = 0; i < t.length; i++) {
    if (t[i] !== "/") continue;
    const num = groupBefore(t, i),
      den = groupAfter(t, i + 1);
    if (!num || !den || num.from < at || !num.text || !den.text) continue;
    out.push(...runs(t.slice(at, num.from)));
    out.push({ kind: "fraction", num: num.text, den: den.text, width: Math.max(runsWidth(num.text), runsWidth(den.text)) + 1.2 });
    at = den.to;
    i = den.to - 1;
  }
  out.push(...runs(t.slice(at)));
  return out;
}
export const widthOf = (t: string) => piecesOf(t).reduce((a, p) => a + p.width, 0);
export const hasFraction = (t: string) => piecesOf(t).some((p) => p.kind === "fraction");
/** Height a label needs: one line, or a stacked fraction. */
export const heightOf = (t: string) => (hasFraction(t) ? FONT * 2 + 1.5 : FONT * 1.2);

/**
 * The terms of a typeset side at the top level (outside brackets and fractions), each with its
 * sign: "3x + 2" is ["3x", "+ 2"]. Each comes with where it starts in the text.
 */
export function terms(t: string): { text: string; at: number }[] {
  const out: { text: string; at: number }[] = [];
  let depth = 0,
    start = 0;
  for (let i = 0; i < t.length - 1; i++) {
    const c = t[i];
    if (c === "(") depth++;
    else if (c === ")") depth--;
    else if (depth === 0 && (c === "+" || c === "−") && i > 0 && t[i - 1] === " " && t[i + 1] === " ") {
      out.push({ text: t.slice(start, i - 1), at: start });
      start = i;
    }
  }
  out.push({ text: t.slice(start), at: start });
  return out.filter((x) => x.text.trim());
}
/** Where each term of a side sits, from the left edge of the side: its centre and width. */
export function termSpans(t: string): { cx: number; width: number }[] {
  return terms(t).map((term) => {
    const left = widthOf(t.slice(0, term.at)),
      width = widthOf(term.text);
    return { cx: left + width / 2, width };
  });
}

const num = (v: number) => String(Math.round(v * 1000) / 1000);
const run = (t: string, x: number, y: number, fill: string, italic = false) =>
  `<text x="${num(x)}" y="${num(y)}" font-family="${FAMILY}" font-size="${num(FONT)}"${italic ? ' font-style="italic"' : ""} fill="${fill}" xml:space="preserve">${esc(t)}</text>`;
/** Typeset text from its left edge x; cy is the middle of the line (or the fraction bar). */
export function markupAt(t: string, x: number, cy: number, fill = "black"): string {
  const out: string[] = [];
  const centred = (s: string, mid: number, y: number) => {
    let left = mid - runsWidth(s) / 2;
    return runs(s)
      .map((r) => {
        const svg = r.kind === "text" ? run(r.text, left, y, fill, r.italic) : "";
        left += r.width;
        return svg;
      })
      .join("");
  };
  for (const p of piecesOf(t)) {
    if (p.kind === "text") out.push(run(p.text, x, cy + FONT * 0.33, fill, p.italic));
    else {
      const mid = x + p.width / 2;
      out.push(centred(p.num, mid, cy - 0.9));
      out.push(`<line x1="${num(x + 0.2)}" y1="${num(cy)}" x2="${num(x + p.width - 0.2)}" y2="${num(cy)}" stroke="${fill}" stroke-width="0.25"/>`);
      out.push(centred(p.den, mid, cy + FONT * 0.72 + 0.9));
    }
    x += p.width;
  }
  return out.join("");
}
export const markupCentred = (t: string, cx: number, cy: number, fill = "black") => markupAt(t, cx - widthOf(t) / 2, cy, fill);
