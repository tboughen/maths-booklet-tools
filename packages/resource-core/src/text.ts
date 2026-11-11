import { advance, type FontStyle } from "./metrics";

/**
 * A run of text in one style. Markup: **bold** and *italic*; everything else prints as typed.
 * With maths notation on (a worksheet's `notation: "maths"`), {3/4} is a stacked fraction: a run
 * whose `frac` holds the numerator and denominator, printed one above the other.
 */
export type Run = { text: string; style: FontStyle; frac?: { num: string; den: string } };
export type Line = Run[];

/** Stacked fractions: digits at this share of the body size, with this much side padding (mm). */
export const FRAC_SCALE = 1;
export const FRAC_PAD = 0.8;
/** A paragraph holding a stacked fraction has lines this many body sizes high (ordinary: 1.4). */
export const FRAC_LINE = 2.4;
/**
 * Room below a lettered option that holds a fraction. Word draws a denominator a little below
 * its exact line and clips it at the foot of a table cell (real-Word check, 11 November 2026).
 */
export const FRAC_FOOT = 1;
/** {numerator/denominator}: one slash, no braces inside, up to 12 characters a side. */
export const FRACTION = /\{([^{}/]{1,12})\/([^{}/]{1,12})\}/g;

function plainRuns(source: string, base: FontStyle): Run[] {
  const runs: Run[] = [];
  const re = /\*\*(.+?)\*\*|\*(.+?)\*/g;
  let at = 0;
  for (let m = re.exec(source); m; m = re.exec(source)) {
    if (m.index > at) runs.push({ text: source.slice(at, m.index), style: base });
    runs.push({ text: m[1] ?? m[2], style: m[1] !== undefined ? "bold" : "italic" });
    at = m.index + m[0].length;
  }
  if (at < source.length) runs.push({ text: source.slice(at), style: base });
  return runs;
}

export function parseRuns(source: string, base: FontStyle = "regular", maths = false): Run[] {
  if (!maths) return plainRuns(source, base);
  const runs: Run[] = [];
  let at = 0;
  for (const m of source.matchAll(FRACTION)) {
    if (m.index > at) runs.push(...plainRuns(source.slice(at, m.index), base));
    runs.push({ text: "", style: "regular", frac: { num: m[1].trim(), den: m[2].trim() } });
    at = m.index + m[0].length;
  }
  if (at < source.length) runs.push(...plainRuns(source.slice(at), base));
  return runs;
}

const textWidth = (text: string, style: FontStyle, size: number) => [...text].reduce((w, c) => w + advance(c, style), 0) * size;
/** Letters in a fraction print in italic, as maths letters do; digits and signs stay upright. */
export const fracStyle = (c: string): FontStyle => (/[A-Za-z]/.test(c) ? "italic" : "regular");
const fracPartWidth = (s: string, size: number) => [...s].reduce((w, c) => w + advance(c, fracStyle(c)), 0) * size * FRAC_SCALE;
/**
 * A fraction's width allows its parts at full body size, wider than they print, because Word and
 * LibreOffice set equations with their own spacing: the layout must never under-measure a line.
 */
export const runWidth = (r: Run, size: number) =>
  r.frac ? (Math.max(fracPartWidth(r.frac.num, size), fracPartWidth(r.frac.den, size)) / FRAC_SCALE) + 2 * FRAC_PAD : textWidth(r.text, r.style, size);
export const lineWidth = (l: Line, size: number) => l.reduce((w, r) => w + runWidth(r, size), 0);
export const plainWidth = (s: string, size: number, style: FontStyle = "regular") => runWidth({ text: s, style }, size);

/** Greedy word wrap that keeps each word's runs together. A word wider than the line stays whole on its own line. */
export function wrap(source: string, size: number, width: number, base: FontStyle = "regular", maths = false): Line[] {
  const words: Run[][] = [[]];
  for (const run of parseRuns(source, base, maths)) {
    if (run.frac) {
      words[words.length - 1].push(run);
      continue;
    }
    const parts = run.text.split(/( )/);
    for (const part of parts) {
      if (part === " ") words.push([]);
      else if (part) words[words.length - 1].push({ text: part, style: run.style });
    }
  }
  const lines: Line[] = [];
  let line: Line = [];
  let w = 0;
  const space = advance(" ") * size;
  for (const word of words) {
    if (!word.length) continue;
    const ww = lineWidth(word, size);
    if (line.length && w + space + ww > width) {
      lines.push(line);
      line = [];
      w = 0;
    }
    if (line.length) {
      line.push({ text: " ", style: "regular" });
      w += space;
    }
    line.push(...word);
    w += ww;
  }
  if (line.length || !lines.length) lines.push(line);
  return lines;
}

export const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
export const n = (v: number) => String(Math.round(v * 100) / 100);

export const hasFraction = (line: Line) => line.some((r) => r.frac);

/** One SVG text element; runs become tspans. A line holding stacked fractions is drawn in pieces. */
export function textSvg(line: Line, x: number, y: number, size: number, fill: string, anchor: "start" | "middle" | "end" = "start") {
  if (hasFraction(line)) return fractionLineSvg(line, x, y, size, fill, anchor);
  const spans = line
    .map((r) => {
      const attr = r.style === "bold" ? ' font-weight="600"' : r.style === "italic" ? ' font-style="italic"' : "";
      return attr ? `<tspan${attr}>${esc(r.text)}</tspan>` : esc(r.text);
    })
    .join("");
  return `<text x="${n(x)}" y="${n(y)}" font-size="${n(size)}" fill="${fill}"${anchor === "start" ? "" : ` text-anchor="${anchor}"`} xml:space="preserve">${spans}</text>`;
}

/** A line with stacked fractions: plain pieces as text, each fraction as two centred parts and a bar. */
function fractionLineSvg(line: Line, x: number, y: number, size: number, fill: string, anchor: "start" | "middle" | "end") {
  const total = lineWidth(line, size);
  let at = anchor === "start" ? x : anchor === "middle" ? x - total / 2 : x - total;
  const out: string[] = [];
  let pending: Line = [];
  const flush = () => {
    if (!pending.length) return;
    out.push(textSvg(pending, at, y, size, fill));
    at += lineWidth(pending, size);
    pending = [];
  };
  const fs = size * FRAC_SCALE;
  // The bar sits on the maths axis (the height of a minus sign); the parts clear it by 0.55 mm.
  const axis = y - size * 0.27;
  const part = (s: string, cx: number, baseline: number) =>
    `<text x="${n(cx)}" y="${n(baseline)}" font-size="${n(fs)}" fill="${fill}" text-anchor="middle" xml:space="preserve">${[...s]
      .map((c) => (fracStyle(c) === "italic" ? `<tspan font-style="italic">${esc(c)}</tspan>` : esc(c)))
      .join("")}</text>`;
  for (const r of line) {
    if (!r.frac) {
      pending.push(r);
      continue;
    }
    flush();
    const w = runWidth(r, size);
    const cx = at + w / 2;
    // The bar overhangs the wider part by 0.4 mm each side.
    const half = Math.max(fracPartWidth(r.frac.num, size), fracPartWidth(r.frac.den, size)) / 2 + 0.4;
    out.push(
      `<g data-fraction="stacked">${part(r.frac.num, cx, axis - 0.55)}<line x1="${n(cx - half)}" y1="${n(axis)}" x2="${n(cx + half)}" y2="${n(axis)}" stroke="${fill}" stroke-width="0.3"/>${part(r.frac.den, cx, axis + 0.55 + fs * 0.728)}</g>`,
    );
    at += w;
  }
  flush();
  return out.join("");
}
