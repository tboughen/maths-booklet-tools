import { boldLines } from "../../envelope-core/src/house-style";
import { ARROW, AXIS_W, DASH, LINE, keySvg, lineKey, paperGrid, paperScale, richText, runWidth, wrap, type Run } from "./grouped";
import { CHART_ANSWER_COLOUR, FONT, MARGIN, esc, formatNumber, labelRevealed, n, readNumber, revealed, timeseriesOf, value2Revealed } from "./shared";
import type { Envelope, Target } from "./index";

/**
 * Time series graphs as Edexcel prints them (June 2019 3F Q27, Mock Set 4 3F Q7): times equally
 * spaced along the horizontal axis from the corner, crosses joined by 1 pt straight lines, on
 * true-size 2 mm graph paper under 1.5 pt arrowed axes. A line between two times prints only
 * when both crosses print, so it never gives away a hidden value. A second series is dashed and
 * named in a key. For "what is misleading" questions the points can be joined with a curve and
 * the vertical axis can start above 0 without its zig-zag. Millimetres.
 */
const PT = 25.4 / 72;
const LINE_W = 1 * PT;
const CROSS = 1.1;
const plain = (t: string): Run[] => [{ t, italic: false }];
/** The gap a broken vertical axis leaves between the corner and the grid, holding the zig-zag. */
const BREAK = 6;
type Plotted = { index: number; x: number; y: number; drawn: boolean; revealed: boolean } | null;

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
  // Time labels, then group labels printed once under each run of equal groups.
  const labels = s.points.map((p) => p.label.trim());
  const groups: { text: string; from: number; to: number }[] = [];
  s.points.forEach((p, i) => {
    const t = p.group.trim(),
      last = groups[groups.length - 1];
    if (last && last.text === t && last.to === i - 1) last.to = i;
    else groups.push({ text: t, from: i, to: i });
  });
  const hasGroups = groups.some((g) => g.text);
  const titleLines = wrap(s.xTitle, Math.max(W, 40), ""),
    titleWidth = Math.max(0, ...titleLines.map(runWidth));
  // Text centred under the first times may reach left of the vertical axis's labels: move the plot right so it all prints.
  const reach = Math.max(runWidth(plain(labels[0] ?? "")) / 2, ...groups.map((g) => runWidth(plain(g.text)) / 2 - (g.from + g.to) * slot / 2), titleWidth / 2 - W / 2);
  const axisLeft = (yTitle.length ? yTitleWidth + 3 : 0) + tickWidth + 2.5;
  const x0 = MARGIN + Math.max(axisLeft, reach),
    y0 = MARGIN + ARROW + 2;
  const X = (i: number) => x0 + i * slot;
  const Y = (v: number) => y0 + H - ((v - ys.lo) / (ys.hi - ys.lo)) * H;
  const targets: Target[] = s.points.map((_, i) => ({ series: 0, category: i, x: X(i) - slot / 2, y: y0, width: slot, height: H }));
  const plot = (second: boolean): Plotted[] =>
    s.points.map((p, i) => {
      const where = `Time ${i + 1}${p.label.trim() ? ` (${p.label.trim()})` : ""}`,
        text = second ? p.value2 : p.value,
        what = second ? "second value" : "value";
      if (!text.trim()) return null;
      const v = readNumber(text);
      if (v === null) return void issues.push(`${where}: enter a number for the ${what}, or leave it blank.`), null;
      if (ys.ok && (v < ys.lo - 1e-9 || v > ys.hi + 1e-9)) return void issues.push(`${where}: the ${what} ${formatNumber(v)} is outside the vertical axis.`), null;
      return second ? { index: i, x: X(i), y: Y(v), drawn: p.show2 === "show", revealed: value2Revealed(p) } : { index: i, x: X(i), y: Y(v), drawn: p.show === "show", revealed: revealed(p) };
    });
  // Lines join consecutive times; a blank value breaks the line. A curve passes smoothly through
  // the points (Catmull–Rom), each part still running only between its two times.
  const join = (pts: Plotted[]) => {
    const out: { from: number; drawn: boolean; revealed: boolean; path: string }[] = [];
    // The points in order; a blank value breaks the line unless the graph bridges missing times.
    const seq = pts.filter((p): p is NonNullable<Plotted> => !!p);
    const linked = (a: NonNullable<Plotted>, b: NonNullable<Plotted>) => s.bridge || b.index === a.index + 1;
    for (let k = 0; k + 1 < seq.length; k++) {
      const a = seq[k],
        b = seq[k + 1];
      if (!linked(a, b)) continue;
      let path = `M${n(a.x)},${n(a.y)}`;
      if (s.join === "curve") {
        const before = seq[k - 1] && linked(seq[k - 1], a) ? seq[k - 1] : a,
          after = seq[k + 2] && linked(b, seq[k + 2]) ? seq[k + 2] : b;
        path += `C${n(a.x + (b.x - before.x) / 6)},${n(a.y + (b.y - before.y) / 6)} ${n(b.x - (after.x - a.x) / 6)},${n(b.y - (after.y - a.y) / 6)} ${n(b.x)},${n(b.y)}`;
      } else path += `L${n(b.x)},${n(b.y)}`;
      out.push({ from: a.index, drawn: a.drawn && b.drawn, revealed: a.revealed || b.revealed, path });
    }
    return out;
  };
  const points = plot(false),
    lines = join(points),
    points2 = s.second ? plot(true) : [],
    lines2 = join(points2);
  const given = points.filter(Boolean).length;
  if (s.bridge && lines.some((l) => points[l.from + 1] === null))
    notes.push("The line is joined across a time with no value: misleading, for pupils to spot.");
  if (!s.bridge && given > 0 && given < s.points.length && points.some((p, i) => !p && i > 0 && i < s.points.length - 1 && points.slice(0, i).some(Boolean) && points.slice(i + 1).some(Boolean)))
    notes.push("A blank value breaks the line between the times either side of it.");
  if (labels.some((l) => runWidth(plain(l)) > slot - 0.5)) issues.push("A time label is wider than the space between times. Use shorter labels or a longer space.");
  // Each group prints centred under its run; neighbouring groups must not run into each other.
  const centre = (g: { from: number; to: number }) => ((g.from + g.to) * slot) / 2;
  const half = (g: { text: string }) => runWidth(plain(g.text)) / 2;
  if (groups.some((g, i) => i > 0 && g.text && groups[i - 1].text && centre(groups[i - 1]) + half(groups[i - 1]) + 1 > centre(g) - half(g)))
    issues.push("Two group labels run into each other. Use shorter groups or a longer space between times.");
  const corner = y0 + H + (s.yBreak ? BREAK : 0);
  if (s.yBreak && ys.ok && ys.lo === 0) notes.push("The vertical axis starts at 0, so its zig-zag is not needed.");
  if (!s.yBreak && ys.ok && ys.lo !== 0) notes.push(`The vertical axis starts at ${formatNumber(ys.lo)}, not 0, with no zig-zag: misleading, for pupils to spot.`);
  if (s.join === "curve") notes.push("The points are joined with a curve, not straight lines: misleading, for pupils to spot.");
  if (s.second && !(s.names[0].trim() && s.names[1].trim())) issues.push("Name both time series for the key.");
  const key = s.second ? lineKey(s.names, x0 + W + ARROW + 5, y0) : null;
  const labelY = corner + 1.5 + FONT * 0.8,
    groupY = labelY + (hasGroups ? FONT * 1.5 : 0),
    titleY = groupY + (titleLines.length ? FONT * 1.6 : 0);
  const right = Math.max(x0 + W + ARROW + 1.5, key ? key.x + key.width : 0, x0 + W / 2 + titleWidth / 2, ...labels.map((l, i) => X(i) + runWidth(plain(l)) / 2));
  const width = Math.ceil((right + MARGIN) * 10) / 10,
    height = Math.ceil((titleY + Math.max(0, titleLines.length - 1) * LINE + FONT * 0.3 + MARGIN) * 10) / 10;
  if (width > 180) issues.push("The graph is wider than 18 cm. Use fewer times or a shorter space between them.");
  if (height > 260) issues.push("The graph is taller than 26 cm. Use fewer or shorter steps on the vertical axis.");
  if (!given && !points2.some(Boolean)) notes.push("There are no values yet: the graph is a blank grid for pupils to plot on.");
  return { settings: s, width, height, plot: { x: x0, y: y0, width: W, height: H }, corner, ys, X, Y, yTitle, labels, labelsShown: s.points.map((p) => ({ drawn: p.labelShow === "show", revealed: labelRevealed(p) })), labelY, groups: hasGroups ? groups : [], groupY, titleLines, titleY, points, lines, points2, lines2, key, targets, issues, notes };
}

export function timeseriesSvg(e: Envelope): string {
  const g = timeseriesLayout(e),
    p = g.plot,
    out: string[] = [];
  const right = p.x + p.width,
    bottom = p.y + p.height,
    c = g.corner;
  const ink = (pink: boolean) => (pink ? CHART_ANSWER_COLOUR : "black");
  out.push(`<rect width="${n(g.width)}" height="${n(g.height)}" fill="white"/>`);
  out.push(paperGrid(p.x, p.y, p.width, p.height));
  const gridEnd = out.length;
  // A broken axis has a zig-zag between the corner, labelled 0, and the grid.
  const zig = g.settings.yBreak ? `V${n(bottom + 4.5)}l-2,-1l4,-1.5l-2,-1` : "";
  out.push(`<path d="M${n(p.x)},${n(c)}H${n(right + ARROW)}M${n(p.x)},${n(c)}${zig}V${n(p.y - ARROW)}" stroke="black" stroke-width="${n(AXIS_W)}" fill="none" stroke-linejoin="round"/>`);
  out.push(`<path d="M${n(right + ARROW + 1.2)},${n(c)}l-2.8,-1.1l0,2.2zM${n(p.x)},${n(p.y - ARROW - 1.2)}l-1.1,2.8l2.2,0z" fill="black" stroke="none"/>`);
  out.push(`<path d="${g.labels.map((_, i) => `M${n(g.X(i))},${n(c)}v1.2`).join("")}${g.ys.ticks.map((v) => `M${n(p.x)},${n(g.Y(v))}h-1.2`).join("")}" stroke="black" stroke-width="0.3" fill="none"/>`);
  g.ys.ticks.forEach((v) => out.push(richText(plain(formatNumber(v)), p.x - 2, g.Y(v) + FONT * 0.33, "end")));
  if (g.settings.yBreak && g.ys.lo !== 0) out.push(richText(plain("0"), p.x - 2, c + FONT * 0.33, "end"));
  // A hidden label leaves its space for pupils to write; answers copies print it in pink.
  g.labels.forEach((l, i) => l && g.labelsShown[i].drawn && out.push(richText(plain(l), g.X(i), g.labelY, "middle", ink(g.labelsShown[i].revealed))));
  for (const gr of g.groups) if (gr.text) out.push(richText(plain(gr.text), (g.X(gr.from) + g.X(gr.to)) / 2, g.groupY));
  const midY = p.y + p.height / 2 - ((g.yTitle.length - 1) * LINE) / 2;
  g.yTitle.forEach((l, i) => out.push(richText(l, MARGIN, midY + i * LINE + FONT * 0.33, "start")));
  g.titleLines.forEach((l, i) => out.push(richText(l, p.x + p.width / 2, g.titleY + i * LINE)));
  for (const l of g.lines) if (l.drawn) out.push(`<path d="${l.path}" stroke="${ink(l.revealed)}" stroke-width="${n(LINE_W)}" fill="none" stroke-linecap="round"/>`);
  for (const l of g.lines2) if (l.drawn) out.push(`<path d="${l.path}" stroke="${ink(l.revealed)}" stroke-width="${n(LINE_W)}" stroke-dasharray="${DASH}" fill="none"/>`);
  for (const q of [...g.points, ...g.points2])
    if (q?.drawn)
      out.push(
        `<path d="M${n(q.x - CROSS)},${n(q.y - CROSS)}l${n(2 * CROSS)},${n(2 * CROSS)}M${n(q.x - CROSS)},${n(q.y + CROSS)}l${n(2 * CROSS)},${n(-2 * CROSS)}" stroke="${ink(q.revealed)}" stroke-width="${n(LINE_W)}" fill="none"/>`,
      );
  if (g.key) out.push(keySvg(g.key));
  const title = g.settings.yAxis.title.trim();
  const label = `Time series graph${title ? ` of ${title}` : ""}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${n(g.width)}mm" height="${n(g.height)}mm" viewBox="0 0 ${n(g.width)} ${n(g.height)}" role="img" aria-label="${esc(label)}">${out.slice(0, gridEnd).join("")}${boldLines(out.slice(gridEnd).join(""), e.document.lines)}</svg>`;
}

export const timeseriesHidden = (s: ReturnType<typeof timeseriesOf>) =>
  s.points.some((p) => (p.show === "hidden" && p.value.trim()) || (s.second && p.show2 === "hidden" && p.value2.trim()) || (p.labelShow === "hidden" && p.label.trim()));
