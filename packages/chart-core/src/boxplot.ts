import { boldLines } from "../../envelope-core/src/house-style";
import { ARROW, AXIS_W, DATA_W, LINE, paperGrid, paperScale, richText, runWidth, wrap } from "./grouped";
import { CHART_ANSWER_COLOUR, FONT, MARGIN, boxValueNames, boxValuePhrases as phrase, boxplotOf, esc, formatNumber, n, readNumber, revealed, type BoxValueName } from "./shared";
import type { Envelope, Target } from "./index";

/**
 * Box plots: whiskers from the smallest value to the lower quartile and from the upper quartile
 * to the largest value, a box from quartile to quartile with the median across it, and 1 cm end
 * lines, all 1.5 pt black on true-size graph paper, as in the Edexcel papers. A hidden value
 * leaves its line (and the parts that need it) for pupils; answers copies draw them in pink.
 */
const BOX_H = 10;

type Mark = { x: number; drawn: boolean; revealed: boolean } | null;
export function boxplotLayout(e: Envelope) {
  const b = boxplotOf(e.document),
    issues: string[] = [],
    notes: string[] = [];
  const xs = paperScale(b.axis, "horizontal", issues);
  const labels = b.rows.map((r) => wrap(r.label, 30, ""));
  const labelWidth = Math.max(0, ...labels.flat().map(runWidth));
  const x0 = MARGIN + (labelWidth ? labelWidth + 4 : 0),
    y0 = MARGIN + 1,
    W = xs.length,
    H = b.rows.length * b.bandMm;
  const X = (v: number) => x0 + ((v - xs.lo) / (xs.hi - xs.lo)) * W;
  const targets: Target[] = [];
  const plots = b.rows.map((r, ri) => {
    const where = `Box plot ${ri + 1}`,
      mid = y0 + ri * b.bandMm + b.bandMm / 2;
    const marks = {} as Record<BoxValueName, Mark>;
    let last: { name: BoxValueName; v: number } | null = null;
    for (const name of boxValueNames) {
      const c = r[name];
      marks[name] = null;
      if (!c.value.trim()) continue;
      const v = readNumber(c.value);
      if (v === null) {
        issues.push(`${where}: enter a number for the ${phrase[name]}, or leave it blank.`);
        continue;
      }
      if (xs.ok && (v < xs.lo - 1e-9 || v > xs.hi + 1e-9)) {
        issues.push(`${where}: the ${phrase[name]} ${formatNumber(v)} is outside the scale.`);
        continue;
      }
      if (last && v < last.v - 1e-9) issues.push(`${where}: the ${phrase[name]} is less than the ${phrase[last.name]}.`);
      last = { name, v };
      if (xs.ok) marks[name] = { x: X(v), drawn: c.show === "show", revealed: revealed(c) };
    }
    const given = boxValueNames.filter((k) => r[k].value.trim()).length;
    if (given > 0 && given < 5) notes.push(`${where} has ${given} of its 5 values; only the parts those values fix are drawn.`);
    targets.push({ series: 0, category: ri, x: x0, y: mid - BOX_H / 2 - 2, width: W, height: BOX_H + 4 });
    return { mid, marks };
  });
  const titleLines = wrap(b.axis.title, Math.max(W, 40), "");
  const bottom = y0 + H,
    labelY = bottom + 1.5 + FONT * 0.8,
    titleY = labelY + (titleLines.length ? FONT * 1.7 : 0);
  const lastLabel = runWidth([{ t: formatNumber(xs.ticks[xs.ticks.length - 1] ?? 0), italic: false }]) / 2;
  const right = Math.max(x0 + W + (b.line === "arrow" ? ARROW + 1.5 : 0), X(xs.ticks[xs.ticks.length - 1] ?? 0) + lastLabel, x0 + W / 2 + Math.max(0, ...titleLines.map(runWidth)) / 2);
  const width = Math.ceil((right + MARGIN) * 10) / 10,
    height = Math.ceil((titleY + Math.max(0, titleLines.length - 1) * LINE + FONT * 0.3 + MARGIN) * 10) / 10;
  if (width > 180) issues.push("The box plot is wider than 18 cm. Use fewer or shorter steps on the scale, or shorter labels.");
  return { settings: b, width, height, plot: { x: x0, y: y0, width: W, height: H }, xs, X, labels, plots, labelY, titleLines, titleY, targets, issues, notes };
}

export function boxplotSvg(e: Envelope): string {
  const g = boxplotLayout(e),
    b = g.settings,
    p = g.plot,
    out: string[] = [];
  out.push(`<rect width="${n(g.width)}" height="${n(g.height)}" fill="white"/>`);
  out.push(paperGrid(p.x, p.y, p.width, p.height));
  // The grid's own edge, so a plot on grid alone still has a frame, as in the papers.
  out.push(`<rect x="${n(p.x)}" y="${n(p.y)}" width="${n(p.width)}" height="${n(p.height)}" fill="none" stroke="#b3b3b3" stroke-width="${n(1.02 * (25.4 / 72))}"/>`);
  const gridEnd = out.length;
  const bottom = p.y + p.height;
  if (b.line !== "none") out.push(`<path d="M${n(p.x)},${n(bottom)}H${n(p.x + p.width + (b.line === "arrow" ? ARROW : 0))}" stroke="black" stroke-width="${n(AXIS_W)}" fill="none"/>`);
  if (b.line === "arrow") out.push(`<path d="M${n(p.x + p.width + ARROW + 1.2)},${n(bottom)}l-2.8,-1.1l0,2.2z" fill="black" stroke="none"/>`);
  g.xs.ticks.forEach((v) => out.push(richText([{ t: formatNumber(v), italic: false }], g.X(v), g.labelY)));
  g.titleLines.forEach((l, i) => out.push(richText(l, p.x + p.width / 2, g.titleY + i * LINE)));
  g.labels.forEach((lines, ri) => {
    const top = g.plots[ri].mid - ((lines.length - 1) * LINE) / 2 + FONT * 0.33;
    lines.forEach((l, i) => out.push(richText(l, MARGIN, top + i * LINE, "start")));
  });
  const ink = (pink: boolean) => (pink ? CHART_ANSWER_COLOUR : "black");
  const seg = (d: string, pink: boolean) => out.push(`<path d="${d}" stroke="${ink(pink)}" stroke-width="${n(DATA_W)}" fill="none" stroke-linecap="square"/>`);
  for (const pl of g.plots) {
    const { min, lq, median, uq, max } = pl.marks,
      top = pl.mid - BOX_H / 2,
      both = (a: Mark, c: Mark) => !!a && !!c && a.drawn && c.drawn,
      pink = (...m: Mark[]) => m.some((x) => x?.revealed);
    // Each part prints only when every value it needs prints.
    for (const m of [min, lq, median, uq, max]) if (m?.drawn) seg(`M${n(m.x)},${n(top)}v${BOX_H}`, m.revealed);
    if (both(min, lq)) seg(`M${n(min!.x)},${n(pl.mid)}H${n(lq!.x)}`, pink(min, lq));
    if (both(uq, max)) seg(`M${n(uq!.x)},${n(pl.mid)}H${n(max!.x)}`, pink(uq, max));
    if (both(lq, uq)) seg(`M${n(lq!.x)},${n(top)}H${n(uq!.x)}M${n(lq!.x)},${n(top + BOX_H)}H${n(uq!.x)}`, pink(lq, uq));
  }
  const label = `Box plot${b.axis.title.trim() ? ` of ${b.axis.title.trim()}` : ""}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${n(g.width)}mm" height="${n(g.height)}mm" viewBox="0 0 ${n(g.width)} ${n(g.height)}" role="img" aria-label="${esc(label)}">${out.slice(0, gridEnd).join("")}${boldLines(out.slice(gridEnd).join(""), e.document.lines)}</svg>`;
}
