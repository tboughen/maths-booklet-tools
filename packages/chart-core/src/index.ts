import { z } from "zod";
import { glyphAdvance } from "../../ratio-table-core/src/font-metrics";

/**
 * Bar charts, dual (comparative) bar charts, composite bar charts and vertical
 * line charts share one categorical axis, one numerical axis, one grid and one
 * key, so they are kinds of one document. Time series graphs and frequency
 * polygons need a continuous axis and belong in their own tools. Switching kind never discards data.
 * Lengths are millimetres.
 */
export const kinds = ["bar", "dual", "composite", "vline"] as const;
export type Kind = (typeof kinds)[number];
export const kindNames: Record<Kind, string> = {
  bar: "Bar chart",
  dual: "Dual bar chart",
  composite: "Composite bar chart",
  vline: "Vertical line chart",
};
export const fills = [
  "grey",
  "hatch",
  "white",
  "black",
  "crosshatch",
  "dots",
] as const;
export type Fill = (typeof fills)[number];
export const fillNames: Record<Fill, string> = {
  grey: "Grey",
  hatch: "Diagonal hatching",
  white: "White",
  black: "Black",
  crosshatch: "Cross-hatching",
  dots: "Dots",
};
export const gridChoices = ["none", "major", "fine"] as const;
export const minorChoices = [1, 2, 4, 5, 10] as const;
export const MAX_CATEGORIES = 12;
export const MAX_SERIES = 4;

const plain = (max: number) =>
  z
    .string()
    .max(max)
    .refine(
      (s) => ![...s].some((c) => c.charCodeAt(0) < 32 || c === "<" || c === ">"),
      "Use ordinary text without markup.",
    );
export const cellSchema = z
  .object({ value: z.string().max(12), show: z.enum(["show", "hidden"]) })
  .strict();
export const seriesSchema = z
  .object({
    name: plain(24),
    fill: z.enum(fills),
    values: z.array(cellSchema).min(1).max(MAX_CATEGORIES),
  })
  .strict();
export const envelopeSchema = z
  .object({
    tool: z.literal("charts"),
    schemaVersion: z.literal(1),
    rendererVersion: z.literal("charts-1"),
    document: z
      .object({
        kind: z.enum(kinds),
        categories: z.array(plain(16)).min(1).max(MAX_CATEGORIES),
        series: z.array(seriesSchema).min(1).max(MAX_SERIES),
        axis: z
          .object({
            min: z.string().max(12),
            max: z.string().max(12),
            step: z.string().max(12),
            minor: z.union([z.literal(1), z.literal(2), z.literal(4), z.literal(5), z.literal(10)]),
          })
          .strict(),
        xTitle: plain(40),
        yTitle: plain(40),
        grid: z.enum(gridChoices),
        key: z.boolean(),
        heightMm: z.number().int().min(40).max(140),
        barMm: z.number().int().min(5).max(20),
      })
      .strict(),
  })
  .strict();
export type Envelope = z.infer<typeof envelopeSchema>;
export type ChartDocument = Envelope["document"];
export type Cell = z.infer<typeof cellSchema>;
export type Series = z.infer<typeof seriesSchema>;

export const blankCell = (): Cell => ({ value: "", show: "show" });
export function defaultFill(index: number): Fill {
  return (["grey", "hatch", "white", "black"] as const)[index % 4];
}

export function create(): Envelope {
  return {
    tool: "charts",
    schemaVersion: 1,
    rendererVersion: "charts-1",
    document: {
      kind: "dual",
      categories: ["Car", "Bus", "Walk", "Cycle"],
      series: [
        {
          name: "boys",
          fill: "grey",
          values: ["5", "6", "8", "3"].map((value) => ({ value, show: "show" })),
        },
        {
          name: "girls",
          fill: "hatch",
          values: ["7", "4", "6", "2"].map((value) => ({ value, show: "show" })),
        },
      ],
      axis: { min: "0", max: "10", step: "1", minor: 1 },
      xTitle: "",
      yTitle: "Frequency",
      grid: "major",
      key: true,
      heightMm: 70,
      barMm: 7,
    },
  };
}

export function validate(input: unknown): Envelope {
  const parsed = envelopeSchema.safeParse(input);
  if (!parsed.success) {
    const path = parsed.error.issues[0]?.path ?? [];
    if (path.includes("categories"))
      throw Error(
        `Use 1 to ${MAX_CATEGORIES} category labels of at most 16 characters, without markup.`,
      );
    if (path.includes("name"))
      throw Error("Use data set names of at most 24 characters, without markup.");
    if (path.includes("series"))
      throw Error(
        `Use 1 to ${MAX_SERIES} data sets, each with one value of at most 12 characters per category.`,
      );
    if (path.includes("heightMm"))
      throw Error("Choose a chart height from 40 to 140 mm.");
    if (path.includes("barMm"))
      throw Error("Choose a bar width from 5 to 20 mm.");
    if (path.includes("xTitle") || path.includes("yTitle"))
      throw Error("Use axis titles of at most 40 characters, without markup.");
    throw Error("This is not a supported chart file (version 1 is supported).");
  }
  const e = parsed.data;
  if (e.document.series.some((s) => s.values.length !== e.document.categories.length))
    throw Error("Each data set needs exactly one value for every category.");
  return e;
}
export const canonical = (e: Envelope) => JSON.stringify(validate(e));
export function parseFile(text: string) {
  if (text.length > 40000) throw Error("This editable file is too large.");
  return validate(JSON.parse(text));
}

/**
 * Pupil view leaves hidden values undrawn; the answer view draws them. With `mark`, bars and lines
 * drawn only because their value was saved hidden print in the house answer colour (worksheet
 * answers copies and outputView answer).
 */
export function forView(e: Envelope, view: "pupil" | "answer", mark = false): Envelope {
  if (view === "pupil") return e;
  const n = structuredClone(e);
  for (const s of n.document.series)
    for (const c of s.values) {
      if (mark && c.show === "hidden" && c.value.trim()) REVEALED.add(c);
      c.show = "show";
    }
  return n;
}
/** Cells an answer view draws only because they were saved hidden. */
const REVEALED = new WeakSet<Cell>();
/** The house answer colour, as on graphs, ratio tables, trees and worksheet answer lines. */
export const CHART_ANSWER_COLOUR = "#b0125b";
export const hasHidden = (e: Envelope) =>
  drawnSeries(e).some((s) => s.values.some((c) => c.show === "hidden" && c.value.trim()));

/** Single-set charts draw only their first data set; the others are kept unchanged. */
export const singleSet = (kind: Kind) => kind === "bar" || kind === "vline";
export function drawnSeries(e: Envelope): Series[] {
  const d = e.document;
  return singleSet(d.kind) ? d.series.slice(0, 1) : d.series;
}

const NUMBER = /^-?\d{1,9}(\.\d{1,4})?$/;
export function readNumber(text: string): number | null {
  const t = text.trim().replace("−", "-");
  return NUMBER.test(t) ? Number(t) : null;
}
export function formatNumber(n: number) {
  const text = String(Math.round(n * 1e6) / 1e6);
  return text.startsWith("-") ? "−" + text.slice(1) : text;
}

export const FONT = (11 * 25.4) / 72;
const MARGIN = 2;
export const textWidth = (text: string, font = FONT) =>
  [...text].reduce((n, c) => n + glyphAdvance(c), 0) * font;
function wrap(text: string, width: number): string[] {
  const lines: string[] = [];
  for (const word of text.trim().split(/\s+/).filter(Boolean)) {
    const last = lines[lines.length - 1];
    if (last !== undefined && textWidth(last + " " + word) <= width)
      lines[lines.length - 1] = last + " " + word;
    else lines.push(word);
  }
  return lines;
}

export type Target = {
  series: number;
  category: number;
  x: number;
  y: number;
  width: number;
  height: number;
};
export type Bar = Target & { fill: Fill; drawn: boolean; revealed?: boolean };
export type Layout = ReturnType<typeof layout>;

/** All positions and teacher-facing issues; issues block export. */
export function layout(e: Envelope) {
  const d = e.document,
    issues: string[] = [],
    notes: string[] = [];
  const series = drawnSeries(e);
  const min = readNumber(d.axis.min),
    max = readNumber(d.axis.max),
    step = readNumber(d.axis.step);
  if (min === null) issues.push("Enter a number for the axis start.");
  if (max === null) issues.push("Enter a number for the axis end.");
  if (step === null || step <= 0)
    issues.push("Enter a positive number for the axis step.");
  const lo = min ?? 0;
  let hi = max ?? 10,
    st = step && step > 0 ? step : 1;
  if (min !== null && max !== null && max <= min) {
    issues.push("The axis end must be greater than its start.");
    hi = lo + 10;
  }
  let count = (hi - lo) / st;
  if (Math.abs(count - Math.round(count)) > 1e-6 || count < 1) {
    if (min !== null && max !== null && max > min && step)
      issues.push("The axis step must divide the axis range exactly.");
    st = (hi - lo) / 10;
    count = 10;
  }
  count = Math.round(count);
  if (count > 40) {
    issues.push("Use at most 40 axis steps; increase the step.");
    st = (hi - lo) / 10;
    count = 10;
  }
  if (lo !== 0)
    issues.push("These charts start their axis at 0. Change the axis start to 0.");
  if (singleSet(d.kind) && d.series.length > 1)
    notes.push(
      `A ${kindNames[d.kind].toLowerCase()} draws only the first data set. The other data sets are kept for dual and composite bar charts.`,
    );
  const H = d.heightMm,
    major = H / count,
    minor = major / d.axis.minor;
  if (d.grid === "fine" && minor < 1)
    issues.push("Small grid squares would be under 1 mm. Use fewer small squares or a taller chart.");
  const values = series.map((s, si) =>
    s.values.map((c, ci) => {
      if (!c.value.trim()) return null;
      const v = readNumber(c.value);
      const where = `${d.categories[ci] || `Category ${ci + 1}`}${series.length > 1 ? `, ${s.name || `data set ${si + 1}`}` : ""}`;
      if (v === null) {
        issues.push(`${where}: enter a number, or leave it blank.`);
        return null;
      }
      if (v < 0) issues.push(`${where}: values cannot be negative.`);
      else if (d.kind !== "composite" && (v < lo || v > hi))
        issues.push(`${where}: ${formatNumber(v)} is outside the axis (${formatNumber(lo)} to ${formatNumber(hi)}).`);
      return v;
    }),
  );
  if (d.kind === "composite")
    d.categories.forEach((name, ci) => {
      const total = values.reduce((n, row) => n + (row[ci] ?? 0), 0);
      if (total > hi + 1e-9)
        issues.push(`${name || `Category ${ci + 1}`}: the stacked total ${formatNumber(total)} is above the axis end.`);
    });

  const ticks = Array.from({ length: count + 1 }, (_, i) => lo + i * st);
  const tickWidth = Math.max(...ticks.map((t) => textWidth(formatNumber(t))));
  const yTitle = wrap(d.yTitle, 18);
  const yTitleWidth = Math.max(0, ...yTitle.map((l) => textWidth(l)));
  const x0 = MARGIN + (yTitle.length ? yTitleWidth + 3 : 0) + tickWidth + 2.5;
  const y0 = MARGIN + FONT * 0.5;
  const labelWidth = Math.max(0, ...d.categories.map((c) => textWidth(c)));
  // Neighbouring labels need half of each label's width plus a gap between centres.
  const widths = d.categories.map((c) => textWidth(c));
  const pairWidth = Math.max(widths[0] ?? 0, ...widths.slice(1).map((w, i) => (w + widths[i]) / 2));
  const bw = d.barMm;
  const slot =
    d.kind === "dual"
      ? Math.max(bw * series.length + bw, labelWidth + 3)
      : d.kind === "vline"
        ? // Whole grid squares: lines stand on vertical grid lines one square apart
          // (or a whole number of squares when labels need more room).
          Math.max(1, Math.ceil((pairWidth + 1) / major - 1e-6)) * major
        : Math.max(bw * 2, labelWidth + 3);
  const centreOf = (ci: number) => (d.kind === "vline" ? x0 + slot * (ci + 1) : x0 + slot * (ci + 0.5));
  const W = slot * (d.categories.length + (d.kind === "vline" ? 1 : 0));
  const y = (v: number) => y0 + H - ((v - lo) / (hi - lo)) * H;
  const clamp = (v: number) => Math.min(hi, Math.max(lo, v));
  const bars: Bar[] = [],
    targets: Target[] = [];
  d.categories.forEach((_, ci) => {
    const centre = centreOf(ci);
    let stack = 0;
    series.forEach((s, si) => {
      const v = values[si][ci],
        cell = s.values[ci],
        drawn = v !== null && cell.show === "show";
      if (d.kind === "vline") {
        // A vertical line chart draws a single thick line; width 0 marks it.
        const top = y(clamp(Math.max(0, v ?? 0)));
        if (v !== null)
          bars.push({ series: si, category: ci, x: centre, y: top, width: 0, height: y0 + H - top, fill: s.fill, drawn, revealed: REVEALED.has(cell) });
        targets.push({ series: si, category: ci, x: centre - 2.5, y: Math.min(top, y0 + H - 4), width: 5, height: Math.max(y0 + H - top, 4) });
        return;
      }
      const left =
        d.kind === "dual" ? centre - (bw * series.length) / 2 + si * bw : centre - bw / 2;
      const base = d.kind === "composite" ? stack : 0;
      const top = base + Math.max(0, v ?? 0);
      if (d.kind === "composite") stack = top;
      const by = y(clamp(top)),
        bh = y(clamp(base)) - by;
      if (v !== null)
        bars.push({ series: si, category: ci, x: left, y: by, width: bw, height: bh, fill: s.fill, drawn, revealed: REVEALED.has(cell) });
      targets.push({
        series: si,
        category: ci,
        x: left,
        y: Math.min(by, y0 + H - 4),
        width: bw,
        height: Math.max(bh, 4),
      });
    });
  });
  const labelY = y0 + H + 1.5 + FONT * 0.8;
  const xTitleY = labelY + (d.xTitle ? FONT * 1.5 : 0);
  let right = x0 + W + 1,
    bottom = xTitleY + FONT * 0.3;
  let key: null | { x: number; y: number; width: number; height: number; rows: { name: string; series: number; y: number }[] } = null;
  if (d.key && series.length > 1) {
    const rowH = FONT + 3,
      kw = 4 + Math.max(textWidth("Key:"), 11 + Math.max(...series.map((s) => textWidth(s.name)))) + 4,
      kh = 3 + FONT + series.length * rowH + 2,
      kx = x0 + W + 6,
      ky = Math.max(MARGIN, y0 + H / 2 - kh / 2);
    key = {
      x: kx,
      y: ky,
      width: kw,
      height: kh,
      rows: series.map((s, i) => ({ name: s.name, series: i, y: ky + 3 + FONT + i * rowH + rowH / 2 })),
    };
    right = kx + kw;
    bottom = Math.max(bottom, ky + kh);
  }
  const width = Math.ceil((right + MARGIN) * 10) / 10,
    height = Math.ceil((bottom + MARGIN) * 10) / 10;
  if (width > 180) issues.push("The chart is wider than 18 cm. Use narrower bars, fewer categories or shorter labels.");
  return {
    width,
    height,
    plot: { x: x0, y: y0, width: W, height: H },
    centres: d.categories.map((_, ci) => centreOf(ci)),
    slot,
    ticks: ticks.map((t) => ({ value: t, y: y(t) })),
    major,
    minor,
    yTitle,
    yTitleWidth,
    labelY,
    xTitleY,
    bars,
    targets,
    key,
    issues,
    notes,
  };
}
export const exportIssue = (e: Envelope) => layout(e).issues.join(" ") || null;

const n = (v: number) => String(Math.round(v * 1000) / 1000);
const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const text = (t: string, x: number, y: number, anchor = "middle") =>
  `<text x="${n(x)}" y="${n(y)}" text-anchor="${anchor}" font-family="STIX Two Text,STIX Two Math,serif" font-size="${n(FONT)}" fill="black">${esc(t)}</text>`;
const fillRef = (f: Fill) =>
  f === "grey" ? "#9a9a9a" : f === "black" ? "#231f20" : f === "white" ? "#ffffff" : `url(#ch-${f})`;
export function renderSvg(e: Envelope): string {
  const d = e.document,
    g = layout(e),
    p = g.plot,
    out: string[] = [];
  const defs =
    `<pattern id="ch-hatch" patternUnits="userSpaceOnUse" width="1.4" height="1.4" patternTransform="rotate(45)"><rect width="1.4" height="1.4" fill="white"/><line x1="0" y1="0" x2="0" y2="1.4" stroke="black" stroke-width="0.25"/></pattern>` +
    `<pattern id="ch-crosshatch" patternUnits="userSpaceOnUse" width="1.6" height="1.6" patternTransform="rotate(45)"><rect width="1.6" height="1.6" fill="white"/><path d="M0,0V1.6M0,0H1.6" stroke="black" stroke-width="0.22"/></pattern>` +
    `<pattern id="ch-dots" patternUnits="userSpaceOnUse" width="1.5" height="1.5"><rect width="1.5" height="1.5" fill="white"/><circle cx="0.75" cy="0.75" r="0.3" fill="black"/></pattern>`;
  out.push(`<rect width="${n(g.width)}" height="${n(g.height)}" fill="white"/>`);
  const bottom = p.y + p.height,
    right = p.x + p.width;
  if (d.grid === "fine") {
    const lines: string[] = [];
    for (let yy = bottom; yy >= p.y - 1e-6; yy -= g.minor) lines.push(`M${n(p.x)},${n(yy)}H${n(right)}`);
    for (let xx = p.x + g.minor; xx <= right + 1e-6; xx += g.minor) lines.push(`M${n(xx)},${n(p.y)}V${n(bottom)}`);
    out.push(`<path d="${lines.join("")}" stroke="#cfcfcf" stroke-width="0.15" fill="none"/>`);
    const majors: string[] = [];
    for (let i = 1; p.x + i * g.major <= right + 1e-6; i++) majors.push(`M${n(p.x + i * g.major)},${n(p.y)}V${n(bottom)}`);
    out.push(`<path d="${majors.join("")}" stroke="#a6a6a6" stroke-width="0.25" fill="none"/>`);
  }
  if (d.grid === "major" && d.kind === "vline") {
    // Square grid: a vertical line every step, the same spacing as the horizontal lines.
    const verticals: string[] = [];
    for (let i = 1; p.x + i * g.major <= right + 1e-6; i++) verticals.push(`M${n(p.x + i * g.major)},${n(p.y)}V${n(bottom)}`);
    out.push(`<path d="${verticals.join("")}" stroke="#a6a6a6" stroke-width="0.25" fill="none"/>`);
  }
  if (d.grid !== "none")
    out.push(
      `<path d="${g.ticks.slice(1).map((t) => `M${n(p.x)},${n(t.y)}H${n(right)}`).join("")}" stroke="#a6a6a6" stroke-width="0.25" fill="none"/>`,
    );
  for (const b of g.bars) {
    // A bar drawn only for the answers copy prints in the answer colour; solid grey or black
    // fills turn pink too, so the outline still shows.
    const ink = b.revealed ? CHART_ANSWER_COLOUR : "black",
      fill = b.revealed && (b.fill === "grey" || b.fill === "black") ? CHART_ANSWER_COLOUR : fillRef(b.fill);
    if (b.drawn && b.width === 0) {
      if (b.height > 0)
        out.push(`<line x1="${n(b.x)}" y1="${n(b.y)}" x2="${n(b.x)}" y2="${n(b.y + b.height)}" stroke="${ink}" stroke-width="0.6"/>`);
    } else if (b.drawn)
      out.push(
        `<rect x="${n(b.x)}" y="${n(b.y)}" width="${n(b.width)}" height="${n(b.height)}" fill="${fill}" stroke="${ink}" stroke-width="0.3"/>`,
      );
  }
  // Axes and the numerical scale.
  out.push(
    `<path d="M${n(p.x)},${n(p.y)}V${n(bottom)}H${n(right)}" stroke="black" stroke-width="0.35" fill="none"/>`,
  );
  out.push(
    `<path d="${g.ticks.map((t) => `M${n(p.x - 1.5)},${n(t.y)}H${n(p.x)}`).join("")}" stroke="black" stroke-width="0.3" fill="none"/>`,
  );
  for (const t of g.ticks) out.push(text(formatNumber(t.value), p.x - 2.2, t.y + FONT * 0.33, "end"));
  const midY = p.y + p.height / 2 - ((g.yTitle.length - 1) * FONT * 1.15) / 2;
  g.yTitle.forEach((line, i) => out.push(text(line, 2, midY + i * FONT * 1.15 + FONT * 0.33, "start")));
  d.categories.forEach((c, i) => out.push(text(c, g.centres[i], g.labelY)));
  if (d.xTitle) out.push(text(d.xTitle, p.x + p.width / 2, g.xTitleY));
  if (g.key) {
    const k = g.key;
    out.push(
      `<rect x="${n(k.x)}" y="${n(k.y)}" width="${n(k.width)}" height="${n(k.height)}" fill="white" stroke="black" stroke-width="0.25"/>`,
    );
    out.push(text("Key:", k.x + 4, k.y + 2 + FONT * 0.9, "start"));
    const series = drawnSeries(e);
    for (const row of k.rows) {
      out.push(
          `<rect x="${n(k.x + 4)}" y="${n(row.y - 2.5)}" width="8" height="5" fill="${fillRef(series[row.series].fill)}" stroke="black" stroke-width="0.3"/>`,
        );
      out.push(text(row.name, k.x + 15, row.y + FONT * 0.33, "start"));
    }
  }
  const label = `${kindNames[d.kind]}${d.yTitle ? ` of ${d.yTitle}` : ""}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${n(g.width)}mm" height="${n(g.height)}mm" viewBox="0 0 ${n(g.width)} ${n(g.height)}" role="img" aria-label="${esc(label)}"><defs>${defs}</defs>${out.join("")}</svg>`;
}

/** Structural edits. Each returns a new valid envelope. */
export function addCategory(e: Envelope): Envelope {
  const n2 = structuredClone(e);
  if (n2.document.categories.length >= MAX_CATEGORIES) return e;
  n2.document.categories.push("");
  for (const s of n2.document.series) s.values.push(blankCell());
  return n2;
}
export function removeCategory(e: Envelope, index = e.document.categories.length - 1): Envelope {
  const n2 = structuredClone(e);
  if (n2.document.categories.length <= 1) return e;
  n2.document.categories.splice(index, 1);
  for (const s of n2.document.series) s.values.splice(index, 1);
  return n2;
}
export function addSeries(e: Envelope): Envelope {
  const n2 = structuredClone(e),
    d = n2.document;
  if (d.series.length >= MAX_SERIES) return e;
  d.series.push({
    name: `data set ${d.series.length + 1}`,
    fill: fills.find((f) => !d.series.some((s) => s.fill === f)) ?? defaultFill(d.series.length),
    values: d.categories.map(blankCell),
  });
  return n2;
}
export function removeSeries(e: Envelope, index = e.document.series.length - 1): Envelope {
  const n2 = structuredClone(e);
  if (n2.document.series.length <= 1) return e;
  n2.document.series.splice(index, 1);
  return n2;
}
/** Teacher action for "draw the chart" tasks: hide every value, keep the data. */
export function setAllShown(e: Envelope, show: Cell["show"]): Envelope {
  const n2 = structuredClone(e);
  for (const s of n2.document.series) for (const c of s.values) c.show = show;
  return n2;
}
