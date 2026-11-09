import { advance, type FontStyle } from "./metrics";

/** A run of text in one style. Markup: **bold** and *italic*; everything else prints as typed. */
export type Run = { text: string; style: FontStyle };
export type Line = Run[];

export function parseRuns(source: string, base: FontStyle = "regular"): Run[] {
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

export const runWidth = (r: Run, size: number) => [...r.text].reduce((w, c) => w + advance(c, r.style), 0) * size;
export const lineWidth = (l: Line, size: number) => l.reduce((w, r) => w + runWidth(r, size), 0);
export const plainWidth = (s: string, size: number, style: FontStyle = "regular") => runWidth({ text: s, style }, size);

/** Greedy word wrap that keeps each word's runs together. A word wider than the line stays whole on its own line. */
export function wrap(source: string, size: number, width: number, base: FontStyle = "regular"): Line[] {
  const words: Run[][] = [[]];
  for (const run of parseRuns(source, base)) {
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

/** One SVG text element; runs become tspans. */
export function textSvg(line: Line, x: number, y: number, size: number, fill: string, anchor: "start" | "middle" | "end" = "start") {
  const spans = line
    .map((r) => {
      const attr = r.style === "bold" ? ' font-weight="700"' : r.style === "italic" ? ' font-style="italic"' : "";
      return attr ? `<tspan${attr}>${esc(r.text)}</tspan>` : esc(r.text);
    })
    .join("");
  return `<text x="${n(x)}" y="${n(y)}" font-size="${n(size)}" fill="${fill}"${anchor === "start" ? "" : ` text-anchor="${anchor}"`} xml:space="preserve">${spans}</text>`;
}
