import { boldLines } from "../../envelope-core/src/house-style";
import { glyphAdvance } from "../../ratio-table-core/src/font-metrics";
import {
  CHART_ANSWER_COLOUR,
  FONT,
  MARGIN,
  esc,
  formatNumber,
  graphRevealed,
  graph2Revealed,
  groupedOf,
  n,
  readNumber,
  revealed,
  tableRevealed,
  type GroupedClass,
  type GroupedKind,
  type GroupedSettings,
  type PaperAxis,
} from "./shared";
import type { Envelope, Target } from "./index";

/**
 * Histograms, frequency polygons and cumulative frequency graphs as Edexcel prints them, from one
 * table of classes. Graph paper is true size: 2 mm squares with heavier lines every 1 cm and 2 cm
 * from the corner, grey, under black axes of 1.5 pt with arrowheads. Histogram bars and
 * cumulative frequency curves are 1.5 pt; frequency polygons are thinner lines through crosses at
 * the class midpoints. A class's graph part can be hidden for pupils to draw and its table cell
 * hidden for pupils to complete; answers copies draw both in pink. Millimetres.
 */
const PT = 25.4 / 72;
/** Exam parity (Edexcel papers, measured): axes and data lines 1.5 pt; graph paper 0.51, 1.02 and 1.417 pt. */
export const AXIS_W = 1.5 * PT;
export const DATA_W = 1.474 * PT;
const POLYGON_W = 1 * PT;
const GRID_W = [0.51 * PT, 1.02 * PT, 1.417 * PT];
const GRID_COLOUR = "#b3b3b3";
const BAR_GREY = "#bfbfbf";
const TABLE_RULE = "#9d9d9d";
export const ARROW = 4;
const CROSS = 1.1;
const ROW_H = 7.6;
const TABLE_GAP = 6;
export const LINE = FONT * 1.15;

/** The second line of a pair (a second frequency polygon or time series) is dashed, so the two read apart in black and white. */
export const DASH = "2.2 1.2";
/** A 1 pt cross, as the papers plot points. */
export const cross = (x: number, y: number, colour: string) =>
  `<path d="M${n(x - CROSS)},${n(y - CROSS)}l${n(2 * CROSS)},${n(2 * CROSS)}M${n(x - CROSS)},${n(y + CROSS)}l${n(2 * CROSS)},${n(-2 * CROSS)}" stroke="${colour}" stroke-width="${n(POLYGON_W)}" fill="none"/>`;
export type LineKey = { x: number; y: number; width: number; height: number; names: string[] };
const KEY_SAMPLE = 10,
  KEY_ROW = FONT * 1.8;
/** A key for two lines beside a graph: a solid and a dashed sample, each with a cross, and the names. */
export function lineKey(names: string[], x: number, y: number): LineKey {
  const width = KEY_SAMPLE + 3 + Math.max(...names.map((t) => runWidth([{ t: t.trim(), italic: false }])));
  return { x, y, width, height: 2 * KEY_ROW, names };
}
export function keySvg(k: LineKey): string {
  return k.names
    .map((name, i) => {
      const cy = k.y + KEY_ROW * (i + 0.5);
      const line = `<path d="M${n(k.x)},${n(cy)}h${n(KEY_SAMPLE)}" stroke="black" stroke-width="${n(POLYGON_W)}"${i ? ` stroke-dasharray="${DASH}"` : ""} fill="none"/>`;
      return line + cross(k.x + KEY_SAMPLE / 2, cy, "black") + richText([{ t: name.trim(), italic: false }], k.x + KEY_SAMPLE + 3, cy + FONT * 0.33, "start");
    })
    .join("");
}

export const groupedKind = (kind: string): kind is GroupedKind => kind === "histogram" || kind === "polygon" || kind === "cumulative";

/** Text runs: a single-letter word equal to the variable prints in italics, as in the papers. */
export type Run = { t: string; italic: boolean };
function runs(text: string, variable: string): Run[] {
  if (!variable) return [{ t: text, italic: false }];
  const out: Run[] = [];
  for (const part of text.split(new RegExp(`(?<![A-Za-z])(${variable})(?![A-Za-z])`))) {
    if (!part) continue;
    out.push({ t: part, italic: part === variable });
  }
  return out;
}
const OTHER: Record<string, number> = { "<": 0.564, "⩽": 0.66, "–": 0.5, "(": 0.333, ")": 0.333 };
/** An italic letter leans left over the space before it, so it gets a little more room. */
const ITALIC_PAD = 0.3;
export const runWidth = (r: Run[]) =>
  r.reduce((w, x) => w + [...x.t].reduce((a, c) => a + (OTHER[c] ?? glyphAdvance(c, x.italic)), 0) * FONT + (x.italic ? ITALIC_PAD : 0), 0);
const textEl = (t: string, x: number, y: number, anchor: string, fill: string, italic: boolean) =>
  `<text x="${n(x)}" y="${n(y)}" text-anchor="${anchor}" font-family="STIX Two Text,STIX Two Math,serif" font-size="${n(FONT)}"${italic ? ' font-style="italic"' : ""} fill="${fill}"${/^\s|\s$/.test(t) ? ' xml:space="preserve"' : ""}>${esc(t)}</text>`;
/**
 * Mixed runs print as separate texts placed end to end: a renderer that falls back to STIX Two
 * Math for "⩽" would otherwise set the whole line in that font and lose the italic letter.
 */
export function richText(r: Run[], x: number, y: number, anchor: "start" | "middle" | "end" = "middle", fill = "black") {
  if (r.length === 1) return textEl(r[0].t, x, y, anchor, fill, r[0].italic);
  const total = runWidth(r);
  let left = anchor === "start" ? x : anchor === "end" ? x - total : x - total / 2;
  return r
    .map((run) => {
      const el = textEl(run.t, left + (run.italic ? ITALIC_PAD : 0), y, "start", fill, run.italic);
      left += runWidth([run]);
      return el;
    })
    .join("");
}
export function wrap(text: string, width: number, variable: string): Run[][] {
  const lines: string[] = [];
  for (const word of text.trim().split(/\s+/).filter(Boolean)) {
    const last = lines[lines.length - 1];
    if (last !== undefined && runWidth(runs(last + " " + word, variable)) <= width) lines[lines.length - 1] = last + " " + word;
    else lines.push(word);
  }
  return lines.map((l) => runs(l, variable));
}

export type PaperScale = { lo: number; hi: number; step: number; stepMm: number; length: number; ticks: number[]; ok: boolean };
/** One axis of Edexcel graph paper: numbered every step from the start, with the grid on to the end. */
export function paperScale(a: PaperAxis, name: string, issues: string[]): PaperScale {
  const min = readNumber(a.min),
    max = readNumber(a.max),
    step = readNumber(a.step);
  if (min === null) issues.push(`Enter a number for the ${name} axis start.`);
  if (max === null) issues.push(`Enter a number for the ${name} axis end.`);
  if (step === null || step <= 0) issues.push(`Enter a positive number for the ${name} axis step.`);
  const fallback = { lo: 0, hi: 10, step: 1, stepMm: 10, length: 100, ticks: Array.from({ length: 11 }, (_, i) => i), ok: false };
  if (min === null || max === null || step === null || step <= 0) return fallback;
  if (max <= min) {
    issues.push(`The ${name} axis end must be greater than its start.`);
    return fallback;
  }
  const steps = (max - min) / step;
  if (steps > 40 + 1e-9) {
    issues.push(`Use at most 40 steps on the ${name} axis; increase the step.`);
    return fallback;
  }
  const length = steps * a.stepMm;
  // The grid is 2 mm squares from the corner, so the axis must end on a grid line.
  if (Math.abs(length / 2 - Math.round(length / 2)) > 1e-6) {
    issues.push(`The ${name} axis end must fall on a 2 mm grid line. Change the end, the step or the length of a step.`);
    return fallback;
  }
  const ticks: number[] = [];
  for (let i = 0; min + i * step <= max + 1e-9; i++) ticks.push(Math.round((min + i * step) * 1e9) / 1e9);
  return { lo: min, hi: max, step, stepMm: a.stepMm, length, ticks, ok: true };
}

/** Graph paper (true size, from the corner) and arrowed axes; text goes after the returned grid. */
export function paperGrid(x0: number, y0: number, w: number, h: number): string {
  const paths = ["", "", ""];
  const tier = (mm: number) => (Math.abs(mm / 20 - Math.round(mm / 20)) < 1e-6 ? 2 : Math.abs(mm / 10 - Math.round(mm / 10)) < 1e-6 ? 1 : 0);
  for (let i = 1; i <= Math.round(w / 2); i++) paths[tier(i * 2)] += `M${n(x0 + i * 2)},${n(y0)}V${n(y0 + h)}`;
  for (let i = 1; i <= Math.round(h / 2); i++) paths[tier(i * 2)] += `M${n(x0)},${n(y0 + h - i * 2)}H${n(x0 + w)}`;
  return paths.map((d, i) => (d ? `<path d="${d}" stroke="${GRID_COLOUR}" stroke-width="${n(GRID_W[i])}" fill="none"/>` : "")).join("");
}

/** The class inequality as the papers print it: "0 < t ⩽ 20". */
function interval(lower: string, upper: string, g: GroupedSettings): Run[] {
  const l = lower.trim().replace("-", "−"),
    u = upper.trim().replace("-", "−");
  if (!g.variable) return [{ t: `${l} – ${u}`, italic: false }];
  const [a, b] = g.inequality === "lower-open" ? ["<", "⩽"] : ["⩽", "<"];
  return [
    { t: `${l} ${a} `, italic: false },
    { t: g.variable, italic: true },
    { t: ` ${b} ${u}`, italic: false },
  ];
}

type Point = { x: number; y: number };
/**
 * Monotone cubic (Fritsch–Carlson) tangents, one pair per part: the curve never overshoots or
 * turns back. `cut[i]` marks a part pupils do not see (hidden). A point next to a cut part takes
 * its tangent from the visible side only, and a cut part's own tangents are adjusted locally, so
 * the visible curve never depends on (and never hints at) a hidden value. Where a visible part
 * meets a hidden one the answers copy may show a slight corner.
 */
type Tangents = [number, number][];
function tangents(p: Point[], cut: boolean[]): Tangents {
  const k = p.length,
    d = p.slice(1).map((q, i) => (q.y - p[i].y) / (q.x - p[i].x));
  const m = p.map((_, i) => {
    if (i === 0) return d[0];
    if (i === k - 1) return d[k - 2];
    if (cut[i - 1] && !cut[i]) return d[i];
    if (cut[i] && !cut[i - 1]) return d[i - 1];
    return d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  });
  const clamp = (i: number, m0: number, m1: number): [number, number] => {
    if (d[i] === 0) return [0, 0];
    const a = m0 / d[i],
      b = m1 / d[i],
      s = a * a + b * b;
    if (s <= 9) return [m0, m1];
    const t = 3 / Math.sqrt(s);
    return [t * a * d[i], t * b * d[i]];
  };
  // Visible parts share their tangents, so the visible curve stays smooth.
  for (let i = 0; i < k - 1; i++) if (!cut[i]) [m[i], m[i + 1]] = clamp(i, m[i], m[i + 1]);
  // Hidden parts stay smooth among themselves; only an end at a visible part keeps its own value.
  return d.map((_, i): [number, number] => {
    if (!cut[i]) return [m[i], m[i + 1]];
    const t = clamp(i, m[i], m[i + 1]);
    if (i + 1 < k - 1 && cut[i + 1]) m[i + 1] = t[1];
    return t;
  });
}
/** The value on the curve at x (graph units), or null outside it. */
function curveAt(p: Point[], m: Tangents | null, x: number): number | null {
  if (x < p[0].x - 1e-9 || x > p[p.length - 1].x + 1e-9) return null;
  let i = 0;
  while (i < p.length - 2 && x > p[i + 1].x) i++;
  const a = p[i],
    b = p[i + 1],
    h = b.x - a.x,
    t = Math.min(1, Math.max(0, (x - a.x) / h));
  if (!m) return a.y + t * (b.y - a.y);
  const t2 = t * t,
    t3 = t2 * t;
  return (2 * t3 - 3 * t2 + 1) * a.y + (t3 - 2 * t2 + t) * h * m[i][0] + (-2 * t3 + 3 * t2) * b.y + (t3 - t2) * h * m[i][1];
}

export type GroupedReading = { index: number; axis: "x" | "y"; x: number; y: number; drawn: boolean; revealed: boolean };
export type GroupedTable = {
  x: number;
  y: number;
  widths: [number, number];
  heading: [Run[][], Run[][]];
  headH: number;
  rows: { label: Run[]; value: string; drawn: boolean; revealed: boolean }[];
};

export function groupedLayout(e: Envelope) {
  const d = e.document,
    kind = (groupedKind(d.kind) ? d.kind : "histogram") as GroupedKind,
    g = groupedOf(d),
    issues: string[] = [],
    notes: string[] = [];
  const yAxis = g[kind].yAxis;
  const xs = paperScale(g.xAxis, "horizontal", issues),
    ys = paperScale(yAxis, "vertical", issues);
  const ok = xs.ok && ys.ok;

  // The classes, as numbers. A blank frequency is no data; it is not zero.
  const classes = g.classes.map((c, i) => {
    const where = `Class ${i + 1}`,
      lo = readNumber(c.lower),
      hi = readNumber(c.upper),
      f = c.frequency.trim() ? readNumber(c.frequency) : null;
    let valid = true;
    if (lo === null || hi === null) {
      issues.push(`${where}: enter numbers for both class boundaries.`);
      valid = false;
    } else if (hi <= lo) {
      issues.push(`${where}: the upper boundary must be greater than the lower one.`);
      valid = false;
    } else if (ok && (lo < xs.lo - 1e-9 || hi > xs.hi + 1e-9)) {
      issues.push(`${where}: ${formatNumber(lo)} to ${formatNumber(hi)} is outside the horizontal axis.`);
      valid = false;
    }
    if (c.frequency.trim() && f === null) {
      issues.push(`${where}: enter a number for the frequency, or leave it blank.`);
      valid = false;
    } else if (f !== null && f < 0) {
      issues.push(`${where}: frequencies cannot be negative.`);
      valid = false;
    }
    return { cell: c, index: i, lo: lo ?? 0, hi: hi ?? 0, f, valid };
  });
  classes.forEach((c, i) => {
    const prev = classes[i - 1];
    if (!prev || !c.valid || !prev.valid) return;
    if (c.lo < prev.hi - 1e-9) issues.push(`Class ${i + 1}: classes must be in order and must not overlap.`);
    else if (c.lo > prev.hi + 1e-9 && kind !== "histogram") notes.push(`There is a gap between class ${i} and class ${i + 1}.`);
  });

  // Cumulative frequencies need every frequency.
  const running: (number | null)[] = [];
  let total = 0,
    complete = true;
  for (const c of classes) {
    if (c.f === null) complete = false;
    total += c.f ?? 0;
    running.push(complete ? total : null);
  }
  if ((kind === "cumulative" || g.table === "cumulative") && !complete && !classes.some((c) => c.cell.frequency.trim() && c.f === null))
    issues.push("Cumulative frequency needs a frequency for every class. Hide a frequency rather than leaving it blank.");

  // Layout: an optional table, then the graph with its vertical title on the left.
  const yTitle = wrap(yAxis.title, 24, g.variable),
    yTitleWidth = Math.max(0, ...yTitle.map(runWidth));
  const tickWidth = Math.max(...ys.ticks.map((t) => runWidth([{ t: formatNumber(t), italic: false }])));
  const W = xs.length,
    H = ys.length;
  const x0 = MARGIN + (yTitle.length ? yTitleWidth + 3 : 0) + tickWidth + 2.5;

  let table: GroupedTable | null = null;
  if (g.table !== "none") {
    const cumulative = g.table === "cumulative";
    const first = g.classes[0]?.lower ?? "";
    const rows = classes.map((c) => {
      const value = cumulative ? (running[c.index] === null ? "" : formatNumber(running[c.index]!)) : c.f === null ? "" : formatNumber(c.f);
      return {
        label: interval(cumulative ? first : c.cell.lower, c.cell.upper, g),
        value: value.replace("-", "−"),
        drawn: c.cell.table === "show",
        revealed: tableRevealed(c.cell),
      };
    });
    const head0 = wrap(g.xAxis.title || "Class", 44, g.variable),
      head1 = wrap(cumulative ? "Cumulative frequency" : "Frequency", cumulative ? 26 : 44, g.variable);
    const w0 = Math.max(36, ...head0.map(runWidth), ...rows.map((r) => runWidth(r.label))) + 6,
      w1 = Math.max(36, ...head1.map(runWidth), ...rows.map((r) => runWidth([{ t: r.value, italic: false }]))) + 6;
    const headH = Math.max(ROW_H, Math.max(head0.length, head1.length) * LINE + 3);
    table = { x: 0, y: MARGIN, widths: [w0, w1], heading: [head0, head1], headH, rows };
  }
  const tableH = table ? table.headH + table.rows.length * ROW_H : 0;
  const y0 = MARGIN + (table ? tableH + TABLE_GAP : 0) + ARROW + 1;
  if (table) {
    const tw = table.widths[0] + table.widths[1];
    table.x = Math.max(MARGIN, x0 + W / 2 - tw / 2);
  }
  const X = (v: number) => x0 + ((v - xs.lo) / (xs.hi - xs.lo)) * W,
    Y = (v: number) => y0 + H - ((v - ys.lo) / (ys.hi - ys.lo)) * H;
  const inY = (v: number) => v >= ys.lo - 1e-9 && v <= ys.hi + 1e-9;

  // Histogram bars: height = frequency ÷ class width (frequency density).
  const bars: { index: number; x: number; y: number; width: number; height: number; drawn: boolean; revealed: boolean }[] = [];
  // Polygon and cumulative points, with the line or curve parts that belong to each class.
  const points: { index: number; x: number; y: number; drawn: boolean; revealed: boolean }[] = [];
  let curve: { path: string; index: number; drawn: boolean; revealed: boolean }[] = [];
  // The second frequency polygon, when there is one.
  const points2: typeof points = [];
  let curve2: typeof curve = [];
  const readings: GroupedReading[] = [];
  const targets: Target[] = [];
  if (ok) {
    if (kind === "histogram") {
      for (const c of classes) {
        if (!c.valid || c.f === null) continue;
        const density = c.f / (c.hi - c.lo);
        if (!inY(density)) {
          issues.push(`Class ${c.index + 1}: the frequency density ${formatNumber(density)} is above the vertical axis.`);
          continue;
        }
        const top = Y(density);
        bars.push({ index: c.index, x: X(c.lo), y: top, width: X(c.hi) - X(c.lo), height: Y(ys.lo) - top, drawn: c.cell.graph === "show", revealed: graphRevealed(c.cell) });
        targets.push({ series: 0, category: c.index, x: X(c.lo), y: Math.min(top, Y(ys.lo) - 4), width: X(c.hi) - X(c.lo), height: Math.max(Y(ys.lo) - top, 4) });
      }
      if (ys.lo !== 0) issues.push("A histogram's vertical axis starts at 0. Change the vertical axis start to 0.");
    } else if (kind === "polygon") {
      const pg = g.polygon,
        sets = pg.second ? [0, 1] : [0];
      for (const set of sets) {
        const plotted: { index: number; x: number; y: number; drawn: boolean; revealed: boolean }[] = [];
        for (const c of classes) {
          if (!c.valid) continue;
          let f = c.f;
          if (set === 1) {
            const text = c.cell.frequency2.trim();
            f = text ? readNumber(text) : null;
            if (text && (f === null || f < 0)) {
              issues.push(`Class ${c.index + 1}: enter a number of 0 or more for the second frequency, or leave it blank.`);
              continue;
            }
          }
          if (f === null) continue;
          if (!inY(f)) {
            issues.push(`Class ${c.index + 1}: the ${set ? "second " : ""}frequency ${formatNumber(f)} is outside the vertical axis.`);
            continue;
          }
          // Midpoints as they should be; a bound only as a mistake for pupils to spot.
          const px = pg.plotAt === "lower" ? c.lo : pg.plotAt === "upper" ? c.hi : (c.lo + c.hi) / 2;
          const drawn = (set ? c.cell.graph2 : c.cell.graph) === "show",
            shown = set ? graph2Revealed(c.cell) : graphRevealed(c.cell);
          plotted.push({ index: c.index, x: X(px), y: Y(f), drawn, revealed: shown });
        }
        if (issues.some((x) => x.includes("must not overlap"))) plotted.splice(1);
        for (const q of plotted) {
          (set ? points2 : points).push(q);
          targets.push({ series: set, category: q.index, x: q.x - 2.5, y: q.y - 2.5, width: 5, height: 5 });
        }
        // A part prints only when both of its points print, so it never gives away a hidden point.
        // The line breaks at a class with no frequency rather than joining across it.
        const parts: typeof curve = [];
        plotted.slice(1).forEach((q, j) => {
          const a = plotted[j];
          if (q.index !== a.index + 1) {
            if (classes.slice(a.index + 1, q.index).some((x) => x.valid && (set ? !x.cell.frequency2.trim() : x.f === null)))
              notes.push(`The ${set ? "second " : ""}frequency polygon is broken between class ${a.index + 1} and class ${q.index + 1}, where a frequency is blank.`);
            return;
          }
          parts.push({ path: `M${n(a.x)},${n(a.y)}L${n(q.x)},${n(q.y)}`, index: q.index, drawn: q.drawn && a.drawn, revealed: q.revealed || a.revealed });
        });
        const first = plotted[0],
          last = plotted[plotted.length - 1];
        // Closing joins the ends of one unbroken polygon; a broken polygon is left open.
        if (pg.close && plotted.length > 2 && parts.length === plotted.length - 1)
          parts.push({ path: `M${n(last.x)},${n(last.y)}L${n(first.x)},${n(first.y)}`, index: first.index, drawn: first.drawn && last.drawn, revealed: first.revealed || last.revealed });
        if (set) curve2 = parts;
        else curve = parts;
        if (plotted.length === 1) notes.push(`The ${set ? "second " : ""}frequency polygon needs at least two classes with frequencies to draw a line.`);
      }
      if (pg.plotAt !== "midpoint") notes.push(`The points are plotted at the ${pg.plotAt} class bounds, not the midpoints: a mistake for pupils to find.`);
      if (pg.close) notes.push("The last point is joined to the first: a mistake for pupils to find.");
      if (pg.second && !(pg.names[0].trim() && pg.names[1].trim())) issues.push("Name both frequency polygons for the key.");
      if (pg.second && g.table !== "none") issues.push("A table shows one set of frequencies. Choose no table for two frequency polygons.");
    } else {
      const cumulative = kind === "cumulative";
      const plotted: { index: number; p: Point; drawn: boolean; revealed: boolean }[] = [];
      if (cumulative && complete && g.cumulative.fromZero && classes[0]?.valid)
        plotted.push({ index: -1, p: { x: classes[0].lo, y: 0 }, drawn: true, revealed: false });
      for (const c of classes) {
        if (!c.valid) continue;
        const v = cumulative ? running[c.index] : c.f;
        if (v === null) continue;
        const px = cumulative ? c.hi : (c.lo + c.hi) / 2;
        if (!inY(v)) {
          issues.push(`Class ${c.index + 1}: ${cumulative ? "the cumulative frequency" : "the frequency"} ${formatNumber(v)} is outside the vertical axis.`);
          continue;
        }
        plotted.push({ index: c.index, p: { x: px, y: v }, drawn: c.cell.graph === "show", revealed: graphRevealed(c.cell) });
      }
      if (cumulative && g.cumulative.fromZero && plotted[0]?.index === -1 && !inY(0)) issues.push("The curve starts at 0, which is outside the vertical axis.");
      for (const q of plotted) {
        if (q.index < 0) continue;
        points.push({ index: q.index, x: X(q.p.x), y: Y(q.p.y), drawn: q.drawn, revealed: q.revealed });
        targets.push({ series: 0, category: q.index, x: X(q.p.x) - 2.5, y: Y(q.p.y) - 2.5, width: 5, height: 5 });
      }
      // Each part of the line runs from the previous point to a class's point. It prints only when
      // both of its points print, so a part never gives away a hidden point (a hidden first class
      // also hides the part from the start at 0).
      // Classes out of order or overlapping are already an error; no line is drawn through them.
      const ordered = !issues.some((x) => x.includes("must not overlap"));
      if (!ordered) plotted.splice(1);
      const pts = plotted.map((q) => q.p);
      // What pupils see: a part whose two points both print on the pupil copy.
      const cut = plotted.slice(1).map((q, j) => !(q.drawn && !q.revealed && plotted[j].drawn && !plotted[j].revealed));
      const m = cumulative && g.cumulative.curve === "smooth" && pts.length > 2 ? tangents(pts, cut) : null;
      curve = plotted.slice(1).map((q, j) => {
        const a = pts[j],
          b = q.p;
        let path = `M${n(X(a.x))},${n(Y(a.y))}`;
        if (m) {
          const h = b.x - a.x;
          path += `C${n(X(a.x + h / 3))},${n(Y(a.y + (m[j][0] * h) / 3))} ${n(X(b.x - h / 3))},${n(Y(b.y - (m[j][1] * h) / 3))} ${n(X(b.x))},${n(Y(b.y))}`;
        } else path += `L${n(X(b.x))},${n(Y(b.y))}`;
        const from = plotted[j];
        return { path, index: q.index, drawn: q.drawn && from.drawn, revealed: q.revealed || from.revealed };
      });
      // A frequency polygon breaks at a class with no frequency rather than joining across it,
      // which would show a value nobody entered.
      if (!cumulative) {
        curve = curve.filter((c, j) => {
          const joined = plotted[j + 1].index === plotted[j].index + 1;
          if (!joined && classes.slice(plotted[j].index + 1, plotted[j + 1].index).some((x) => x.valid && x.f === null))
            notes.push(`The frequency polygon is broken between class ${plotted[j].index + 1} and class ${plotted[j + 1].index + 1}, where a frequency is blank.`);
          return joined;
        });
      }
      if (!cumulative && points.length === 1) notes.push("A frequency polygon needs at least two classes with frequencies to draw a line.");
      if (cumulative && ordered)
        g.cumulative.readings.forEach((r, i) => {
          const where = `Reading ${i + 1}`,
            v = readNumber(r.value);
          if (v === null) return void issues.push(`${where}: enter a number.`);
          if (pts.length < 2) return void issues.push(`${where}: the curve needs at least two points to read from.`);
          let px: number, py: number | null;
          if (r.axis === "x") {
            px = v;
            py = curveAt(pts, m, v);
            if (py === null) return void issues.push(`${where}: the curve does not reach ${formatNumber(v)} on the horizontal axis.`);
          } else {
            py = v;
            const top = pts[pts.length - 1].y,
              bottom = pts[0].y;
            if (v < bottom - 1e-9 || v > top + 1e-9) return void issues.push(`${where}: the curve does not reach ${formatNumber(v)} on the vertical axis.`);
            // The curve never decreases, so the first x where it reaches v is found by halving.
            let a = pts[0].x,
              b = pts[pts.length - 1].x;
            for (let k = 0; k < 60; k++) {
              const mid = (a + b) / 2;
              if ((curveAt(pts, m, mid) ?? 0) < v) a = mid;
              else b = mid;
            }
            px = b;
          }
          // A guide ends on the curve, so it prints only where that part of the curve prints.
          const part = curve.find((c, j) => px >= pts[j].x - 1e-9 && px <= pts[j + 1].x + 1e-9);
          const partDrawn = part?.drawn ?? true;
          if (r.show === "show" && !partDrawn)
            notes.push(`${where} is hidden while that part of the curve is hidden, because its guide would show where the curve is.`);
          readings.push({ index: i, axis: r.axis, x: X(px), y: Y(py), drawn: r.show === "show" && partDrawn, revealed: revealed(r) || (r.show === "show" && !!part?.revealed) });
        });
    }
  }
  if (!g.classes.some((c) => c.frequency.trim())) notes.push("There are no frequencies yet. Enter them in the Classes table.");

  const xTitle = wrap(g.xAxis.title, Math.max(W, 40), g.variable),
    xTitleWidth = Math.max(0, ...xTitle.map(runWidth));
  const xLabelY = y0 + H + 1.5 + FONT * 0.8,
    xTitleY = xLabelY + (xTitle.length ? FONT * 1.7 : 0);
  const lastLabel = runWidth([{ t: formatNumber(xs.ticks[xs.ticks.length - 1] ?? 0), italic: false }]) / 2;
  const key = kind === "polygon" && g.polygon.second ? lineKey(g.polygon.names, x0 + W + ARROW + 5, y0) : null;
  const right = Math.max(x0 + W + ARROW + 1.5, key ? key.x + key.width : 0, X(xs.ticks[xs.ticks.length - 1] ?? 0) + lastLabel, x0 + W / 2 + xTitleWidth / 2, table ? table.x + table.widths[0] + table.widths[1] : 0);
  const width = Math.ceil((right + MARGIN) * 10) / 10,
    height = Math.ceil((xTitleY + Math.max(0, xTitle.length - 1) * LINE + FONT * 0.3 + MARGIN) * 10) / 10;
  if (x0 + W / 2 - xTitleWidth / 2 < MARGIN) issues.push("The horizontal axis title is wider than the graph. Use a shorter title or a longer axis.");
  if (width > 180) issues.push("The graph is wider than 18 cm. Use fewer or shorter steps on the horizontal axis.");
  if (height > 260) issues.push("The graph and its table are taller than 26 cm. Use fewer or shorter steps on the vertical axis, or no table.");
  return { kind, settings: g, width, height, plot: { x: x0, y: y0, width: W, height: H }, xs, ys, X, Y, yTitle, xTitle, xLabelY, xTitleY, table, bars, points, curve, points2, curve2, key, readings, targets, issues, notes };
}

export function groupedSvg(e: Envelope): string {
  const g = groupedLayout(e),
    s = g.settings,
    p = g.plot,
    out: string[] = [];
  out.push(`<rect width="${n(g.width)}" height="${n(g.height)}" fill="white"/>`);
  const right = p.x + p.width,
    bottom = p.y + p.height;
  const ink = (pink: boolean) => (pink ? CHART_ANSWER_COLOUR : "black");
  const greyBars = g.kind === "histogram" && s.histogram.fill === "grey";
  // Grey bars go under the grid, which shows through them as in the papers.
  if (greyBars)
    for (const b of g.bars) if (b.drawn && !b.revealed) out.push(`<rect x="${n(b.x)}" y="${n(b.y)}" width="${n(b.width)}" height="${n(b.height)}" fill="${BAR_GREY}" stroke="none"/>`);
  out.push(paperGrid(p.x, p.y, p.width, p.height));
  const gridEnd = out.length;
  // The table, ruled in grey as in the papers.
  const t = g.table;
  if (t) {
    const tw = t.widths[0] + t.widths[1],
      th = t.headH + t.rows.length * ROW_H;
    const rules = [`M${n(t.x + t.widths[0])},${n(t.y)}V${n(t.y + th)}`, ...t.rows.map((_, i) => `M${n(t.x)},${n(t.y + t.headH + i * ROW_H)}H${n(t.x + tw)}`)];
    out.push(`<rect x="${n(t.x)}" y="${n(t.y)}" width="${n(tw)}" height="${n(th)}" fill="none" stroke="${TABLE_RULE}" stroke-width="0.25"/>`);
    out.push(`<path d="${rules.join("")}" stroke="${TABLE_RULE}" stroke-width="0.25" fill="none"/>`);
    t.heading.forEach((lines, col) => {
      const cx = t.x + (col ? t.widths[0] + t.widths[1] / 2 : t.widths[0] / 2),
        top = t.y + t.headH / 2 - ((lines.length - 1) * LINE) / 2 + FONT * 0.33;
      lines.forEach((l, i) => out.push(richText(l, cx, top + i * LINE)));
    });
    t.rows.forEach((r, i) => {
      const cy = t.y + t.headH + i * ROW_H + ROW_H / 2 + FONT * 0.33;
      out.push(richText(r.label, t.x + t.widths[0] / 2, cy));
      if (r.drawn && r.value) out.push(richText([{ t: r.value, italic: false }], t.x + t.widths[0] + t.widths[1] / 2, cy, "middle", ink(r.revealed)));
    });
  }
  // Axes with arrowheads, and the numbers.
  out.push(`<path d="M${n(p.x)},${n(bottom)}H${n(right + ARROW)}M${n(p.x)},${n(bottom)}V${n(p.y - ARROW)}" stroke="black" stroke-width="${n(AXIS_W)}" fill="none"/>`);
  out.push(`<path d="M${n(right + ARROW + 1.2)},${n(bottom)}l-2.8,-1.1l0,2.2zM${n(p.x)},${n(p.y - ARROW - 1.2)}l-1.1,2.8l2.2,0z" fill="black" stroke="none"/>`);
  out.push(
    `<path d="${g.xs.ticks.map((v) => `M${n(g.X(v))},${n(bottom)}v1.2`).join("")}${g.ys.ticks.map((v) => `M${n(p.x)},${n(g.Y(v))}h-1.2`).join("")}" stroke="black" stroke-width="0.3" fill="none"/>`,
  );
  const num = (v: number) => [{ t: formatNumber(v), italic: false }];
  g.xs.ticks.forEach((v) => out.push(richText(num(v), g.X(v), g.xLabelY)));
  g.ys.ticks.forEach((v) => out.push(richText(num(v), p.x - 2, g.Y(v) + FONT * 0.33, "end")));
  const midY = p.y + p.height / 2 - ((g.yTitle.length - 1) * LINE) / 2;
  g.yTitle.forEach((l, i) => out.push(richText(l, MARGIN, midY + i * LINE + FONT * 0.33, "start")));
  g.xTitle.forEach((l, i) => out.push(richText(l, p.x + p.width / 2, g.xTitleY + i * LINE)));
  // Data.
  for (const b of g.bars) {
    if (!b.drawn) continue;
    // A bar drawn only for the answers copy is a pink outline: pupils draw the outline.
    out.push(`<rect x="${n(b.x)}" y="${n(b.y)}" width="${n(b.width)}" height="${n(b.height)}" fill="none" stroke="${ink(b.revealed)}" stroke-width="${n(DATA_W)}"/>`);
  }
  for (const r of g.readings) {
    if (!r.drawn) continue;
    const path = r.axis === "x" ? `M${n(r.x)},${n(bottom)}V${n(r.y)}H${n(p.x)}` : `M${n(p.x)},${n(r.y)}H${n(r.x)}V${n(bottom)}`;
    out.push(`<path d="${path}" stroke="${ink(r.revealed)}" stroke-width="0.3" stroke-dasharray="1.2 0.8" fill="none"/>`);
  }
  const lineW = g.kind === "polygon" ? POLYGON_W : DATA_W;
  for (const c of g.curve) if (c.drawn) out.push(`<path d="${c.path}" stroke="${ink(c.revealed)}" stroke-width="${n(lineW)}" fill="none" stroke-linejoin="round" stroke-linecap="round"/>`);
  for (const c of g.curve2) if (c.drawn) out.push(`<path d="${c.path}" stroke="${ink(c.revealed)}" stroke-width="${n(lineW)}" stroke-dasharray="${DASH}" fill="none"/>`);
  if (g.kind === "polygon" || (g.kind === "cumulative" && s.cumulative.crosses))
    for (const q of [...g.points, ...g.points2]) if (q.drawn) out.push(cross(q.x, q.y, ink(q.revealed)));
  if (g.key) out.push(keySvg(g.key));
  const names = { histogram: "Histogram", polygon: "Frequency polygon", cumulative: "Cumulative frequency graph" };
  const label = `${names[g.kind]}${s.xAxis.title.trim() ? ` of ${s.xAxis.title.trim()}` : ""}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${n(g.width)}mm" height="${n(g.height)}mm" viewBox="0 0 ${n(g.width)} ${n(g.height)}" role="img" aria-label="${esc(label)}">${out.slice(0, gridEnd).join("")}${boldLines(out.slice(gridEnd).join(""), e.document.lines)}</svg>`;
}

/** Classes with a hidden table cell or graph part that hold a frequency. */
export const groupedHidden = (g: GroupedSettings, kind: GroupedKind) =>
  g.classes.some((c: GroupedClass) => c.frequency.trim() && ((g.table !== "none" && c.table === "hidden") || c.graph === "hidden")) ||
  (kind === "polygon" && g.polygon.second && g.classes.some((c) => c.frequency2.trim() && c.graph2 === "hidden")) ||
  (kind === "cumulative" && g.cumulative.readings.some((r) => r.show === "hidden"));
