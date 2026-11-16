import { boldLines } from "../../envelope-core/src/house-style";
import { ARROW, AXIS_W, LINE, paperGrid, paperScale, richText, runWidth, wrap, type Run } from "./grouped";
import { CHART_ANSWER_COLOUR, FONT, MARGIN, esc, formatNumber, n, readNumber, revealed, timeseriesOf } from "./shared";
import type { Envelope, Target } from "./index";

/**
 * Time series graphs as Edexcel prints them (June 2019 3F Q27, Mock Set 4 3F Q7): times equally
 * spaced along the horizontal axis from the corner, crosses joined by 1 pt straight lines, on
 * true-size 2 mm graph paper under 1.5 pt arrowed axes. A line between two times prints only
 * when both crosses print, so it never gives away a hidden value. Millimetres.
 */
const PT = 25.4 / 72;
const LINE_W = 1 * PT;
const CROSS = 1.1;
const plain = (t: string): Run[] => [{ t, italic: false }];

export function timeseriesLayout(e: Envelope) {
  const s = timeseriesOf(e.document),
    issues: string[] = [],
    notes: string[] = [];
  const ys = paperScale(s.yAxis, "vertical", issues);
  const yTitle = wrap(s.yAxis.title, 24, ""),
    yTitleWidth = Math.max(0, ...yTitle.map(runWidth));
  const tickWidth = Math.max(...ys.ticks.map((t) => runWidth(plain(formatNumber(t)))));
  const slot = s.slotMm,
    W = s.points.length * slot,
    H = ys.length;
  const x0 = MARGIN + (yTitle.length ? yTitleWidth + 3 : 0) + tickWidth + 2.5,
    y0 = MARGIN + ARROW + 2;
  const X = (i: number) => x0 + i * slot;
  const Y = (v: number) => y0 + H - ((v - ys.lo) / (ys.hi - ys.lo)) * H;
  const targets: Target[] = [];
  const points = s.points.map((p, i) => {
    const where = `Time ${i + 1}${p.label.trim() ? ` (${p.label.trim()})` : ""}`;
    targets.push({ series: 0, category: i, x: X(i) - slot / 2, y: y0, width: slot, height: H });
    if (!p.value.trim()) return null;
    const v = readNumber(p.value);
    if (v === null) return void issues.push(`${where}: enter a number for the value, or leave it blank.`), null;
    if (ys.ok && (v < ys.lo - 1e-9 || v > ys.hi + 1e-9)) return void issues.push(`${where}: the value ${formatNumber(v)} is outside the vertical axis.`), null;
    return { index: i, x: X(i), y: Y(v), drawn: p.show === "show", revealed: revealed(p) };
  });
  // Lines join consecutive times; a blank value breaks the line.
  const lines: { from: number; drawn: boolean; revealed: boolean; path: string }[] = [];
  for (let i = 0; i + 1 < points.length; i++) {
    const a = points[i],
      b = points[i + 1];
    if (!a || !b) continue;
    lines.push({ from: i, drawn: a.drawn && b.drawn, revealed: a.revealed || b.revealed, path: `M${n(a.x)},${n(a.y)}L${n(b.x)},${n(b.y)}` });
  }
  const given = points.filter(Boolean).length;
  if (given > 0 && given < s.points.length && points.some((p, i) => !p && i > 0 && i < s.points.length - 1 && points.slice(0, i).some(Boolean) && points.slice(i + 1).some(Boolean)))
    notes.push("A blank value breaks the line between the times either side of it.");
  // Time labels, then group labels printed once under each run of equal groups.
  const labels = s.points.map((p) => p.label.trim());
  if (labels.some((l) => runWidth(plain(l)) > slot - 0.5)) issues.push("A time label is wider than the space between times. Use shorter labels or a longer space.");
  const groups: { text: string; from: number; to: number }[] = [];
  s.points.forEach((p, i) => {
    const t = p.group.trim(),
      last = groups[groups.length - 1];
    if (last && last.text === t && last.to === i - 1) last.to = i;
    else groups.push({ text: t, from: i, to: i });
  });
  const hasGroups = groups.some((g) => g.text);
  const labelY = y0 + H + 1.5 + FONT * 0.8,
    groupY = labelY + (hasGroups ? FONT * 1.5 : 0),
    titleLines = wrap(s.xTitle, Math.max(W, 40), ""),
    titleY = groupY + (titleLines.length ? FONT * 1.6 : 0);
  const titleWidth = Math.max(0, ...titleLines.map(runWidth));
  const right = Math.max(x0 + W + ARROW + 1.5, x0 + W / 2 + titleWidth / 2, ...labels.map((l, i) => X(i) + runWidth(plain(l)) / 2));
  const width = Math.ceil((right + MARGIN) * 10) / 10,
    height = Math.ceil((titleY + Math.max(0, titleLines.length - 1) * LINE + FONT * 0.3 + MARGIN) * 10) / 10;
  if (width > 180) issues.push("The graph is wider than 18 cm. Use fewer times or a shorter space between them.");
  if (height > 260) issues.push("The graph is taller than 26 cm. Use fewer or shorter steps on the vertical axis.");
  if (!given) notes.push("There are no values yet: the graph is a blank grid for pupils to plot on.");
  return { settings: s, width, height, plot: { x: x0, y: y0, width: W, height: H }, ys, X, Y, yTitle, labels, labelY, groups: hasGroups ? groups : [], groupY, titleLines, titleY, points, lines, targets, issues, notes };
}

export function timeseriesSvg(e: Envelope): string {
  const g = timeseriesLayout(e),
    p = g.plot,
    out: string[] = [];
  const right = p.x + p.width,
    bottom = p.y + p.height;
  const ink = (pink: boolean) => (pink ? CHART_ANSWER_COLOUR : "black");
  out.push(`<rect width="${n(g.width)}" height="${n(g.height)}" fill="white"/>`);
  out.push(paperGrid(p.x, p.y, p.width, p.height));
  const gridEnd = out.length;
  out.push(`<path d="M${n(p.x)},${n(bottom)}H${n(right + ARROW)}M${n(p.x)},${n(bottom)}V${n(p.y - ARROW)}" stroke="black" stroke-width="${n(AXIS_W)}" fill="none"/>`);
  out.push(`<path d="M${n(right + ARROW + 1.2)},${n(bottom)}l-2.8,-1.1l0,2.2zM${n(p.x)},${n(p.y - ARROW - 1.2)}l-1.1,2.8l2.2,0z" fill="black" stroke="none"/>`);
  out.push(`<path d="${g.labels.map((_, i) => `M${n(g.X(i))},${n(bottom)}v1.2`).join("")}${g.ys.ticks.map((v) => `M${n(p.x)},${n(g.Y(v))}h-1.2`).join("")}" stroke="black" stroke-width="0.3" fill="none"/>`);
  g.ys.ticks.forEach((v) => out.push(richText(plain(formatNumber(v)), p.x - 2, g.Y(v) + FONT * 0.33, "end")));
  g.labels.forEach((l, i) => l && out.push(richText(plain(l), g.X(i), g.labelY)));
  for (const gr of g.groups) if (gr.text) out.push(richText(plain(gr.text), (g.X(gr.from) + g.X(gr.to)) / 2, g.groupY));
  const midY = p.y + p.height / 2 - ((g.yTitle.length - 1) * LINE) / 2;
  g.yTitle.forEach((l, i) => out.push(richText(l, MARGIN, midY + i * LINE + FONT * 0.33, "start")));
  g.titleLines.forEach((l, i) => out.push(richText(l, p.x + p.width / 2, g.titleY + i * LINE)));
  for (const l of g.lines) if (l.drawn) out.push(`<path d="${l.path}" stroke="${ink(l.revealed)}" stroke-width="${n(LINE_W)}" fill="none" stroke-linecap="round"/>`);
  for (const q of g.points)
    if (q?.drawn)
      out.push(
        `<path d="M${n(q.x - CROSS)},${n(q.y - CROSS)}l${n(2 * CROSS)},${n(2 * CROSS)}M${n(q.x - CROSS)},${n(q.y + CROSS)}l${n(2 * CROSS)},${n(-2 * CROSS)}" stroke="${ink(q.revealed)}" stroke-width="${n(LINE_W)}" fill="none"/>`,
      );
  const title = g.settings.yAxis.title.trim();
  const label = `Time series graph${title ? ` of ${title}` : ""}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${n(g.width)}mm" height="${n(g.height)}mm" viewBox="0 0 ${n(g.width)} ${n(g.height)}" role="img" aria-label="${esc(label)}">${out.slice(0, gridEnd).join("")}${boldLines(out.slice(gridEnd).join(""), e.document.lines)}</svg>`;
}

export const timeseriesHidden = (s: ReturnType<typeof timeseriesOf>) => s.points.some((p) => p.show === "hidden" && p.value.trim());
