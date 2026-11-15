import { boldLines } from "../../envelope-core/src/house-style";
import {
  CHART_ANSWER_COLOUR,
  FONT,
  MARGIN,
  esc,
  formatNumber,
  n,
  readNumber,
  revealed,
  scatterOf,
  text,
  textWidth,
  type ScatterSettings,
} from "./shared";
import type { Envelope, Target } from "./index";

/**
 * Scatter graphs as Edexcel prints them: crosses on graph paper with arrowed axes, numbered at
 * every step. The line of best fit is the teacher's (two points it passes through), drawn across
 * the grid; nothing is fitted automatically. Outliers can be ringed, and reading guides are
 * dashed lines from a value on one axis to the line and across to the other. Hidden points,
 * lines and guides are left for pupils and print in pink on answers copies. An optional table
 * above the graph gives the values to plot, and an axis that does not start at 0 can be broken
 * with a zig-zag next to the corner. Millimetres.
 */
type Axis = ScatterSettings["xAxis"];
type Scale = { lo: number; hi: number; step: number; count: number };
const CROSS = 1.2;
const RING = 2.4;
const ARROW = 4;
/** The gap a broken axis leaves between the corner and the grid, holding the zig-zag. */
const BREAK = 6;
const TABLE_PAD = 1.5;
const TABLE_GAP = 3;
/** Widest a table may be before its columns continue in a second block underneath. */
const TABLE_MAX = 180 - 2 * MARGIN;

export type TableBlock = { x: number; y: number; headerWidth: number; rows: { header: string[]; y: number; height: number }[]; columns: { x: string; y: string; left: number; width: number }[] };

/** The points the table lists, as typed. A blank point is left out. */
function tableLayout(sc: ScatterSettings, notes: string[]): { blocks: TableBlock[]; width: number; height: number } {
  const empty = { blocks: [], width: 0, height: 0 };
  if (sc.table === "none") return empty;
  const listed = sc.points.filter((p) => p.x.trim() && p.y.trim() && (sc.table === "all" || p.show === "hidden" || revealed(p)));
  if (!listed.length) {
    notes.push(sc.table === "plot" ? "The table lists only hidden points, and no point is hidden, so no table prints." : "The table has no points to list.");
    return empty;
  }
  const headers = [wrap(sc.xAxis.title, 40), wrap(sc.yAxis.title, 40)].map((h, i) => (h.length ? h : [i ? "y" : "x"]));
  const headerWidth = Math.max(...headers.flat().map((l) => textWidth(l))) + 2 * TABLE_PAD;
  const cell = Math.max(10, ...listed.flatMap((p) => [textWidth(p.x.trim()), textWidth(p.y.trim())])) + 2 * TABLE_PAD;
  const perBlock = Math.max(1, Math.floor((TABLE_MAX - headerWidth) / cell));
  const heights = headers.map((h) => h.length * FONT * 1.15 + 2 * TABLE_PAD);
  const blockH = heights[0] + heights[1];
  const blocks: TableBlock[] = [];
  for (let start = 0, b = 0; start < listed.length; start += perBlock, b++) {
    const y = MARGIN + b * (blockH + TABLE_GAP);
    blocks.push({
      x: MARGIN,
      y,
      headerWidth,
      rows: headers.map((header, i) => ({ header, y: y + (i ? heights[0] : 0), height: heights[i] })),
      columns: listed.slice(start, start + perBlock).map((p, i) => ({ x: p.x.trim(), y: p.y.trim(), left: MARGIN + headerWidth + i * cell, width: cell })),
    });
  }
  const width = headerWidth + Math.min(listed.length, perBlock) * cell;
  return { blocks, width, height: blocks.length * blockH + (blocks.length - 1) * TABLE_GAP };
}

function wrap(t: string, width: number): string[] {
  const lines: string[] = [];
  for (const word of t.trim().split(/\s+/).filter(Boolean)) {
    const last = lines[lines.length - 1];
    if (last !== undefined && textWidth(last + " " + word) <= width) lines[lines.length - 1] = last + " " + word;
    else lines.push(word);
  }
  return lines;
}

function scale(a: Axis, name: string, length: number, minor: number, fine: boolean, issues: string[]): Scale & { ok: boolean } {
  const min = readNumber(a.min),
    max = readNumber(a.max),
    step = readNumber(a.step);
  if (min === null) issues.push(`Enter a number for the ${name} axis start.`);
  if (max === null) issues.push(`Enter a number for the ${name} axis end.`);
  if (step === null || step <= 0) issues.push(`Enter a positive number for the ${name} axis step.`);
  // An axis that cannot be drawn falls back to 0–10 so the editor still shows something; points
  // are not checked against it.
  const fallback = { lo: 0, hi: 10, step: 1, count: 10, ok: false };
  if (min === null || max === null || step === null || step <= 0) return fallback;
  if (max <= min) {
    issues.push(`The ${name} axis end must be greater than its start.`);
    return fallback;
  }
  const count = (max - min) / step;
  if (Math.abs(count - Math.round(count)) > 1e-6) {
    issues.push(`The ${name} axis step must divide its range exactly.`);
    return fallback;
  }
  if (Math.round(count) > 40) {
    issues.push(`Use at most 40 steps on the ${name} axis; increase the step.`);
    return fallback;
  }
  if (fine && length / Math.round(count) / minor < 1)
    issues.push(`Small grid squares on the ${name} axis would be under 1 mm. Use fewer small squares or a longer axis.`);
  return { lo: min, hi: max, step, count: Math.round(count), ok: true };
}

/** Where the infinite line through p and q crosses the rectangle, or null if it misses. */
function clip(p: { x: number; y: number }, q: { x: number; y: number }, box: { left: number; right: number; top: number; bottom: number }) {
  const dx = q.x - p.x,
    dy = q.y - p.y;
  let t0 = -Infinity,
    t1 = Infinity;
  for (const [delta, lo, hi, start] of [
    [dx, box.left, box.right, p.x],
    [dy, box.top, box.bottom, p.y],
  ] as const) {
    if (Math.abs(delta) < 1e-12) {
      if (start < lo - 1e-9 || start > hi + 1e-9) return null;
      continue;
    }
    const a = (lo - start) / delta,
      b = (hi - start) / delta;
    t0 = Math.max(t0, Math.min(a, b));
    t1 = Math.min(t1, Math.max(a, b));
  }
  if (t0 > t1 - 1e-9) return null;
  return { x1: p.x + t0 * dx, y1: p.y + t0 * dy, x2: p.x + t1 * dx, y2: p.y + t1 * dy };
}

export function scatterLayout(e: Envelope) {
  const d = e.document,
    sc = scatterOf(d),
    issues: string[] = [],
    notes: string[] = [];
  const fine = sc.grid === "fine";
  const xs = scale(sc.xAxis, "horizontal", sc.xAxis.mm, sc.minor, fine, issues),
    ys = scale(sc.yAxis, "vertical", sc.yAxis.mm, sc.minor, fine, issues);
  for (const [a, s, name] of [[sc.xAxis, xs, "horizontal"], [sc.yAxis, ys, "vertical"]] as const)
    if (a.broken && s.ok && s.lo === 0) notes.push(`The ${name} axis starts at 0, so its zig-zag is not needed.`);
  const table = tableLayout(sc, notes);
  /** Space a broken axis leaves between the corner and the grid. */
  const bx = sc.xAxis.broken ? BREAK : 0,
    by = sc.yAxis.broken ? BREAK : 0;
  const xTicks = Array.from({ length: xs.count + 1 }, (_, i) => xs.lo + i * xs.step),
    yTicks = Array.from({ length: ys.count + 1 }, (_, i) => ys.lo + i * ys.step);
  const yTitle = wrap(sc.yAxis.title, 22),
    yTitleWidth = Math.max(0, ...yTitle.map((l) => textWidth(l)));
  const tickWidth = Math.max(...yTicks.map((t) => textWidth(formatNumber(t))), by ? textWidth("0") : 0);
  const W = sc.xAxis.mm,
    H = sc.yAxis.mm;
  // The corner where the axes meet; the grid starts beside it, or past a broken axis's zig-zag.
  const ax = MARGIN + (yTitle.length ? yTitleWidth + 3 : 0) + tickWidth + 2.5,
    x0 = ax + bx,
    y0 = MARGIN + (table.height ? table.height + 5 : 0) + ARROW + 1,
    ay = y0 + H + by;
  const X = (v: number) => x0 + ((v - xs.lo) / (xs.hi - xs.lo)) * W,
    Y = (v: number) => y0 + H - ((v - ys.lo) / (ys.hi - ys.lo)) * H;
  const inX = (v: number) => v >= xs.lo - 1e-9 && v <= xs.hi + 1e-9,
    inY = (v: number) => v >= ys.lo - 1e-9 && v <= ys.hi + 1e-9;

  const points = sc.points.flatMap((p, i) => {
    const x = readNumber(p.x),
      y = readNumber(p.y),
      where = `Point ${i + 1}`;
    if (x === null || y === null) {
      issues.push(`${where}: enter a number for both x and y.`);
      return [];
    }
    // Points are placed only on axes that can be drawn.
    if (!xs.ok || !ys.ok) return [];
    if (!inX(x) || !inY(y)) {
      issues.push(`${where}: (${formatNumber(x)}, ${formatNumber(y)}) is outside the axes.`);
      return [];
    }
    return [{ index: i, x: X(x), y: Y(y), ring: p.ring, drawn: p.show === "show", revealed: revealed(p) }];
  });
  if (!sc.points.length) notes.push("There are no points. Add points in the Points table.");

  const box = { left: x0, right: x0 + W, top: y0, bottom: y0 + H };
  let line: null | { x1: number; y1: number; x2: number; y2: number; drawn: boolean; revealed: boolean; slope: number | null; through: { x: number; y: number } } = null;
  if (sc.bestFit) {
    const b = sc.bestFit,
      fx = readNumber(b.from.x),
      fy = readNumber(b.from.y),
      tx = readNumber(b.to.x),
      ty = readNumber(b.to.y);
    if (fx === null || fy === null || tx === null || ty === null) issues.push("Line of best fit: enter numbers for both points it passes through.");
    else if (fx === tx && fy === ty) issues.push("Line of best fit: the two points must be different.");
    else {
      const c = clip({ x: X(fx), y: Y(fy) }, { x: X(tx), y: Y(ty) }, box);
      if (!c) issues.push("Line of best fit: the line does not cross the grid.");
      else line = { ...c, drawn: b.show === "show", revealed: revealed(b), slope: tx === fx ? null : (ty - fy) / (tx - fx), through: { x: fx, y: fy } };
    }
  }
  const readings = sc.readings.flatMap((r, i) => {
    const v = readNumber(r.value),
      where = `Reading ${i + 1}`;
    if (v === null) {
      issues.push(`${where}: enter a number.`);
      return [];
    }
    if (!sc.bestFit) {
      issues.push(`${where}: add a line of best fit to read from.`);
      return [];
    }
    if (!line) return [];
    if (!xs.ok || !ys.ok) return [];
    if (r.axis === "x" ? !inX(v) : !inY(v)) {
      issues.push(`${where}: ${formatNumber(v)} is outside the ${r.axis === "x" ? "horizontal" : "vertical"} axis.`);
      return [];
    }
    // The point on the line: the teacher's line, read at the given value.
    let px: number, py: number;
    if (r.axis === "x") {
      if (line.slope === null) {
        issues.push(`${where}: a vertical line cannot be read from the horizontal axis.`);
        return [];
      }
      px = v;
      py = line.through.y + line.slope * (v - line.through.x);
    } else {
      if (line.slope === 0) {
        issues.push(`${where}: a horizontal line cannot be read from the vertical axis.`);
        return [];
      }
      py = v;
      px = line.slope === null ? line.through.x : line.through.x + (v - line.through.y) / line.slope;
    }
    if (!inX(px) || !inY(py)) {
      issues.push(`${where}: the line of best fit is outside the grid at ${formatNumber(v)}.`);
      return [];
    }
    // A guide ends on the line, so it is drawn only with the line: a reading never gives away a
    // line left for pupils to draw.
    if (r.show === "show" && !line.drawn)
      notes.push(`${where} is hidden while the line of best fit is hidden, because its guide would show where the line is.`);
    return [{ index: i, x: X(px), y: Y(py), axis: r.axis, drawn: r.show === "show" && line.drawn, revealed: revealed(r) || (line.revealed && r.show === "show") }];
  });

  // The horizontal title wraps to the plot width and is centred under the plot.
  const xTitle = wrap(sc.xAxis.title, W),
    xTitleWidth = Math.max(0, ...xTitle.map((l) => textWidth(l)));
  const xLabelY = ay + 1.5 + FONT * 0.8,
    xTitleY = xLabelY + (xTitle.length ? FONT * 1.7 : 0);
  const titleRight = x0 + W / 2 + xTitleWidth / 2;
  const width = Math.ceil((Math.max(x0 + W + ARROW + 1, titleRight, MARGIN + table.width) + MARGIN) * 10) / 10,
    height = Math.ceil((xTitleY + Math.max(0, xTitle.length - 1) * FONT * 1.15 + FONT * 0.3 + MARGIN) * 10) / 10;
  if (x0 + W / 2 - xTitleWidth / 2 < MARGIN) issues.push("The horizontal axis title is wider than the graph. Use a shorter title or a longer axis.");
  if (width > 180) issues.push("The scatter graph is wider than 18 cm. Use a shorter horizontal axis or a shorter title.");
  if (height > 260) issues.push("The scatter graph and its table are taller than 26 cm. Use a shorter vertical axis or fewer points in the table.");
  const targets: Target[] = points.map((p) => ({ series: 0, category: p.index, x: p.x - 2.5, y: p.y - 2.5, width: 5, height: 5 }));
  return { width, height, plot: { x: x0, y: y0, width: W, height: H }, corner: { x: ax, y: ay }, table, xs, ys, xTicks, yTicks, X, Y, yTitle, xTitle, xLabelY, xTitleY, points, line, readings, targets, issues, notes, settings: sc };
}

export function scatterSvg(e: Envelope): string {
  const g = scatterLayout(e),
    sc = g.settings,
    p = g.plot,
    out: string[] = [];
  out.push(`<rect width="${n(g.width)}" height="${n(g.height)}" fill="white"/>`);
  const right = p.x + p.width,
    bottom = p.y + p.height;
  const stepX = p.width / g.xs.count,
    stepY = p.height / g.ys.count;
  if (sc.grid === "fine") {
    const lines: string[] = [];
    for (let i = 1; i < g.xs.count * sc.minor; i++) lines.push(`M${n(p.x + (i * stepX) / sc.minor)},${n(p.y)}V${n(bottom)}`);
    for (let i = 1; i < g.ys.count * sc.minor; i++) lines.push(`M${n(p.x)},${n(bottom - (i * stepY) / sc.minor)}H${n(right)}`);
    out.push(`<path d="${lines.join("")}" stroke="#cfcfcf" stroke-width="0.15" fill="none"/>`);
  }
  if (sc.grid !== "none") {
    const lines: string[] = [];
    // Past a broken axis the grid's own edge is drawn, since the axis no longer runs along it.
    for (let i = sc.xAxis.broken ? 0 : 1; i <= g.xs.count; i++) lines.push(`M${n(p.x + i * stepX)},${n(p.y)}V${n(bottom)}`);
    for (let i = sc.yAxis.broken ? 0 : 1; i <= g.ys.count; i++) lines.push(`M${n(p.x)},${n(bottom - i * stepY)}H${n(right)}`);
    out.push(`<path d="${lines.join("")}" stroke="#a6a6a6" stroke-width="0.25" fill="none"/>`);
  }
  // The grid stays at its usual weight; bold lines apply to everything drawn after it.
  const gridEnd = out.length;
  // Axes with arrowheads, as in the papers. A broken axis has a zig-zag next to the corner,
  // which is labelled 0.
  const c = g.corner;
  const xZig = sc.xAxis.broken ? "h1.5l1,-2l1.5,4l1,-2" : "",
    yZig = sc.yAxis.broken ? "v-1.5l-2,-1l4,-1.5l-2,-1" : "";
  out.push(`<path d="M${n(c.x)},${n(c.y)}${xZig}H${n(right + ARROW)}M${n(c.x)},${n(c.y)}${yZig}V${n(p.y - ARROW)}" stroke="black" stroke-width="0.35" fill="none" stroke-linejoin="round"/>`);
  out.push(
    `<path d="M${n(right + ARROW + 1)},${n(c.y)}l-2.6,-1l0,2zM${n(c.x)},${n(p.y - ARROW - 1)}l-1,2.6l2,0z" fill="black" stroke="none"/>`,
  );
  out.push(`<path d="${g.xTicks.map((_, i) => `M${n(p.x + i * stepX)},${n(c.y)}v1.5`).join("")}${g.yTicks.map((_, i) => `M${n(c.x)},${n(bottom - i * stepY)}h-1.5`).join("")}" stroke="black" stroke-width="0.3" fill="none"/>`);
  g.xTicks.forEach((t, i) => out.push(text(formatNumber(t), p.x + i * stepX, g.xLabelY)));
  g.yTicks.forEach((t, i) => out.push(text(formatNumber(t), c.x - 2.2, bottom - i * stepY + FONT * 0.33, "end")));
  if (sc.xAxis.broken) out.push(text("0", c.x, g.xLabelY));
  if (sc.yAxis.broken) out.push(text("0", c.x - 2.2, c.y + FONT * 0.33, "end"));
  // The table of values, ruled like the papers' tables.
  for (const b of g.table.blocks) {
    const bRight = b.x + b.headerWidth + b.columns.length * (b.columns[0]?.width ?? 0),
      bBottom = b.rows[1].y + b.rows[1].height;
    const rules = [`M${n(b.x)},${n(b.rows[1].y)}H${n(bRight)}`, ...[b.x + b.headerWidth, ...b.columns.slice(1).map((col) => col.left)].map((x) => `M${n(x)},${n(b.y)}V${n(bBottom)}`)];
    out.push(`<rect x="${n(b.x)}" y="${n(b.y)}" width="${n(bRight - b.x)}" height="${n(bBottom - b.y)}" fill="none" stroke="black" stroke-width="0.3"/>`);
    out.push(`<path d="${rules.join("")}" stroke="black" stroke-width="0.3" fill="none"/>`);
    b.rows.forEach((r, ri) => {
      const top = r.y + r.height / 2 - ((r.header.length - 1) * FONT * 1.15) / 2 + FONT * 0.33;
      r.header.forEach((l, li) => out.push(text(l, b.x + TABLE_PAD, top + li * FONT * 1.15, "start")));
      for (const col of b.columns) out.push(text(ri ? col.y : col.x, col.left + col.width / 2, r.y + r.height / 2 + FONT * 0.33));
    });
  }
  const midY = p.y + p.height / 2 - ((g.yTitle.length - 1) * FONT * 1.15) / 2;
  g.yTitle.forEach((line, i) => out.push(text(line, MARGIN, midY + i * FONT * 1.15 + FONT * 0.33, "start")));
  g.xTitle.forEach((line, i) => out.push(text(line, p.x + p.width / 2, g.xTitleY + i * FONT * 1.15)));
  const ink = (pink: boolean) => (pink ? CHART_ANSWER_COLOUR : "black");
  for (const r of g.readings) {
    if (!r.drawn) continue;
    const path = r.axis === "x" ? `M${n(r.x)},${n(c.y)}V${n(r.y)}H${n(c.x)}` : `M${n(c.x)},${n(r.y)}H${n(r.x)}V${n(c.y)}`;
    out.push(`<path d="${path}" stroke="${ink(r.revealed)}" stroke-width="0.3" stroke-dasharray="1.2 0.8" fill="none"/>`);
  }
  if (g.line?.drawn)
    out.push(`<line x1="${n(g.line.x1)}" y1="${n(g.line.y1)}" x2="${n(g.line.x2)}" y2="${n(g.line.y2)}" stroke="${ink(g.line.revealed)}" stroke-width="0.35"/>`);
  for (const pt of g.points) {
    if (!pt.drawn) continue;
    const colour = ink(pt.revealed);
    out.push(
      `<path d="M${n(pt.x - CROSS)},${n(pt.y - CROSS)}l${n(2 * CROSS)},${n(2 * CROSS)}M${n(pt.x - CROSS)},${n(pt.y + CROSS)}l${n(2 * CROSS)},${n(-2 * CROSS)}" stroke="${colour}" stroke-width="0.35" fill="none"/>`,
    );
    if (pt.ring) out.push(`<circle cx="${n(pt.x)}" cy="${n(pt.y)}" r="${RING}" stroke="${colour}" stroke-width="0.3" fill="none"/>`);
  }
  const titles = [sc.yAxis.title, sc.xAxis.title].filter((t) => t.trim()).join(" against ");
  const label = `Scatter graph${titles ? ` of ${titles}` : ""}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${n(g.width)}mm" height="${n(g.height)}mm" viewBox="0 0 ${n(g.width)} ${n(g.height)}" role="img" aria-label="${esc(label)}">${out.slice(0, gridEnd).join("")}${boldLines(out.slice(gridEnd).join(""), e.document.lines)}</svg>`;
}
