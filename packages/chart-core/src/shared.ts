import { z } from "zod";
import { glyphAdvance } from "../../ratio-table-core/src/font-metrics";

/**
 * Values, text and drawing primitives shared by every kind of chart. They live apart from
 * index.ts so the kind renderers (pie.ts) can use them without an import cycle.
 */

/** What each pie sector prints: its category name, optionally with its angle or percentage. */
export const pieLabelChoices = ["name", "name-angle", "name-percent", "none"] as const;
export type PieLabels = (typeof pieLabelChoices)[number];
export const pieLabelNames: Record<PieLabels, string> = {
  name: "Category names",
  "name-angle": "Names and angles",
  "name-percent": "Names and percentages",
  none: "No labels",
};
export const PIE_RADIUS = { minimum: 25, maximum: 70, standard: 40 } as const;
export const pieSchema = z
  .object({
    radiusMm: z.number().int().min(PIE_RADIUS.minimum).max(PIE_RADIUS.maximum),
    labels: z.enum(pieLabelChoices),
  })
  .strict();
export type PieSettings = z.infer<typeof pieSchema>;
/** The pie settings used when a document has none saved. */
export const PIE_DEFAULTS: PieSettings = { radiusMm: PIE_RADIUS.standard, labels: "name" };
export const pieOf = (d: { pie?: PieSettings }): PieSettings => d.pie ?? PIE_DEFAULTS;

/** Pictogram symbols. Parts are exact: a sector of a circle, or the left part of a square drawn
 * open on its right, as Edexcel prints them. */
export const symbolChoices = ["circle", "square"] as const;
export type PictogramSymbol = (typeof symbolChoices)[number];
export const symbolNames: Record<PictogramSymbol, string> = { circle: "Circle", square: "Square" };
export const SYMBOL_MM = { minimum: 6, maximum: 14, standard: 10 } as const;
export const MAX_SYMBOLS = 20;
export const pictogramSchema = z
  .object({
    symbol: z.enum(symbolChoices),
    symbolMm: z.number().int().min(SYMBOL_MM.minimum).max(SYMBOL_MM.maximum),
    /** What one whole symbol represents. Hidden leaves an answer line in the key for pupils. */
    key: z.object({ value: z.string().max(12), show: z.enum(["show", "hidden"]) }).strict(),
    /** Printed after the key value: "represents 8 pictures". */
    unit: z
      .string()
      .max(24)
      .refine((s) => ![...s].some((c) => c.charCodeAt(0) < 32 || c === "<" || c === ">"), "Use ordinary text without markup."),
  })
  .strict();
export type PictogramSettings = z.infer<typeof pictogramSchema>;
/** The pictogram settings used when a document has none saved. */
export const PICTOGRAM_DEFAULTS: PictogramSettings = { symbol: "circle", symbolMm: SYMBOL_MM.standard, key: { value: "4", show: "show" }, unit: "" };
export const pictogramOf = (d: { pictogram?: PictogramSettings }): PictogramSettings => d.pictogram ?? PICTOGRAM_DEFAULTS;

const plain = (max: number) =>
  z
    .string()
    .max(max)
    .refine((t) => ![...t].some((c) => c.charCodeAt(0) < 32 || c === "<" || c === ">"), "Use ordinary text without markup.");
const shown = z.enum(["show", "hidden"]);

/**
 * Scatter graphs: points (x, y) on two numerical axes with graph paper, an optional teacher-drawn
 * line of best fit, rings round outliers and dashed reading guides. Values stay as typed.
 */
export const MAX_POINTS = 40;
export const MAX_READINGS = 3;
export const SCATTER_MM = { minimum: 40, maximum: 160 } as const;
export const scatterAxisSchema = z
  .object({
    min: z.string().max(12),
    max: z.string().max(12),
    step: z.string().max(12),
    title: plain(40),
    /** Length of the axis on paper. */
    mm: z.number().int().min(SCATTER_MM.minimum).max(SCATTER_MM.maximum),
    /** A zig-zag on the axis next to the corner, for an axis that does not start at 0. */
    broken: z.boolean(),
  })
  .strict();
export const scatterTableChoices = ["none", "all", "plot"] as const;
export const scatterTableNames: Record<(typeof scatterTableChoices)[number], string> = {
  none: "No table",
  all: "All points",
  plot: "Only the points pupils plot",
};
const coordinate = z.object({ x: z.string().max(12), y: z.string().max(12) }).strict();
export const bestFitSchema = z.object({ from: coordinate, to: coordinate, show: shown }).strict();
export const scatterSchema = z
  .object({
    points: z
      .array(z.object({ x: z.string().max(12), y: z.string().max(12), show: shown, ring: z.boolean() }).strict())
      .max(MAX_POINTS),
    xAxis: scatterAxisSchema,
    yAxis: scatterAxisSchema,
    grid: z.enum(["none", "major", "fine"]),
    minor: z.union([z.literal(1), z.literal(2), z.literal(4), z.literal(5), z.literal(10)]),
    /** Teacher-drawn: two points the line passes through; it is drawn across the grid. */
    bestFit: bestFitSchema.optional(),
    /** Dashed guides from a value on one axis to the line of best fit and across to the other. */
    readings: z.array(z.object({ axis: z.enum(["x", "y"]), value: z.string().max(12), show: shown }).strict()).max(MAX_READINGS),
    /** A table of the points' values above the graph, as the papers print the data to plot. */
    table: z.enum(scatterTableChoices),
  })
  .strict();
export type ScatterSettings = z.infer<typeof scatterSchema>;
export type ScatterPoint = ScatterSettings["points"][number];
/** The scatter graph a document starts with when it has none saved: empty 0–10 axes on graph
 * paper. It has no points, so switching kind never draws data nobody entered. */
export const SCATTER_DEFAULTS: ScatterSettings = {
  points: [],
  xAxis: { min: "0", max: "10", step: "1", title: "", mm: 100, broken: false },
  yAxis: { min: "0", max: "10", step: "1", title: "", mm: 100, broken: false },
  grid: "fine",
  minor: 5,
  readings: [],
  table: "none",
};
export const scatterOf = (d: { scatter?: ScatterSettings }): ScatterSettings => d.scatter ?? SCATTER_DEFAULTS;

/** Cells an answer view draws only because they were saved hidden. */
const REVEALED = new WeakSet<object>();
export const markRevealed = (c: object) => void REVEALED.add(c);
export const revealed = (c: object) => REVEALED.has(c);
/** Hidden pictogram keys an answer view shows. The key stays saved as hidden, so both copies
 * keep its answer-line width; this only lets the renderer print the value. */
const ANSWER_KEY = new WeakSet<object>();
export const markAnswerKey = (c: object) => void ANSWER_KEY.add(c);
export const answerKey = (c: object) => ANSWER_KEY.has(c);
/** Scatter points an answer view shows only because they were saved hidden, whether or not
 * the view is marked pink: a table of only the points pupils plot still lists them. */
const TO_PLOT = new WeakSet<object>();
export const markToPlot = (c: object) => void TO_PLOT.add(c);
export const toPlot = (c: object) => TO_PLOT.has(c);
/** A pictogram whose key value is hidden for pupils to complete. */
export const pictogramKeyHidden = (d: { kind: string; pictogram?: PictogramSettings }) =>
  d.kind === "pictogram" && d.pictogram?.key.show === "hidden";
/** The note every single-set kind gives when other data sets exist. */
export const singleSetNote = (name: string) =>
  `A ${name.toLowerCase()} draws only the first data set. The other data sets are kept for dual and composite bar charts.`;
/** The house answer colour, as on graphs, ratio tables, trees and worksheet answer lines. */
export const CHART_ANSWER_COLOUR = "#b0125b";

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
export const MARGIN = 2;
export const textWidth = (text: string, font = FONT) =>
  [...text].reduce((n, c) => n + glyphAdvance(c), 0) * font;

export const n = (v: number) => String(Math.round(v * 1000) / 1000);
export const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
export const text = (t: string, x: number, y: number, anchor = "middle", fill = "black") =>
  `<text x="${n(x)}" y="${n(y)}" text-anchor="${anchor}" font-family="STIX Two Text,STIX Two Math,serif" font-size="${n(FONT)}" fill="${fill}">${esc(t)}</text>`;

/**
 * Grouped data for histograms, frequency polygons and cumulative frequency graphs: one table of
 * classes shared by the three kinds, so a teacher can switch between them without retyping, and
 * a vertical axis for each kind (frequency density, frequency and cumulative frequency need
 * different scales). Values stay as typed. Graph paper is Edexcel's: 2 mm squares with heavier
 * lines every 1 cm and 2 cm from the corner, so each axis gives the millimetres per numbered step.
 */
export const MAX_CLASSES = 12;
export const MAX_GROUPED_READINGS = 4;
export const STEP_MM = { minimum: 4, maximum: 40 } as const;
export const paperAxisSchema = z
  .object({
    min: z.string().max(12),
    max: z.string().max(12),
    /** Numbered every step from the start; the grid runs on to the end even past the last number. */
    step: z.string().max(12),
    /** Length of one step on paper: an even number of millimetres, so numbers sit on grid lines. */
    stepMm: z.number().int().min(STEP_MM.minimum).max(STEP_MM.maximum).multipleOf(2),
    title: plain(40),
  })
  .strict();
export type PaperAxis = z.infer<typeof paperAxisSchema>;
export const groupedClassSchema = z
  .object({
    lower: z.string().max(12),
    upper: z.string().max(12),
    /** Blank is no data (an empty cell, nothing drawn); "0" is zero. */
    frequency: z.string().max(12),
    /** Hidden leaves the class's table cell for pupils to complete. */
    table: shown,
    /** Hidden leaves the class's bar, point or part of the curve for pupils to draw. */
    graph: shown,
    /** The second frequency polygon's frequency, used only when the polygon has a second set. */
    frequency2: z.string().max(12),
    graph2: shown,
  })
  .strict();
export type GroupedClass = z.infer<typeof groupedClassSchema>;
export const inequalityChoices = ["lower-open", "lower-closed"] as const;
export const groupedTableChoices = ["none", "frequency", "cumulative"] as const;
export const groupedTableNames: Record<(typeof groupedTableChoices)[number], string> = {
  none: "No table",
  frequency: "Frequency table",
  cumulative: "Cumulative frequency table",
};
export const polygonPlotChoices = ["midpoint", "lower", "upper"] as const;
export const polygonPlotNames: Record<(typeof polygonPlotChoices)[number], string> = {
  midpoint: "Class midpoints",
  lower: "Lower class bounds (mistake)",
  upper: "Upper class bounds (mistake)",
};
export const blankGroupedClass = (): GroupedClass => ({ lower: "", upper: "", frequency: "", table: "show", graph: "show", frequency2: "", graph2: "show" });
export const histogramFillChoices = ["white", "grey"] as const;
export const groupedSchema = z
  .object({
    /** The letter in the class inequalities, printed in italics: "0 < t ⩽ 20". Empty prints "0 – 20". */
    variable: z.string().regex(/^[A-Za-z]?$/),
    /** lower-open: 0 < t ⩽ 20 (Edexcel's usual); lower-closed: 0 ⩽ t < 20. */
    inequality: z.enum(inequalityChoices),
    classes: z.array(groupedClassSchema).min(1).max(MAX_CLASSES),
    xAxis: paperAxisSchema,
    /** A table above the graph, ruled as in the papers; the first column heading is the horizontal axis title. */
    table: z.enum(groupedTableChoices),
    /** The table to the right of the graph instead of above it, for a shorter worksheet card. */
    tableBeside: z.boolean(),
    histogram: z.object({ yAxis: paperAxisSchema, fill: z.enum(histogramFillChoices) }).strict(),
    polygon: z
      .object({
        yAxis: paperAxisSchema,
        /** Where each class is plotted: the midpoint, as it should be, or a bound, as a mistake for pupils to spot. */
        plotAt: z.enum(polygonPlotChoices),
        /** Join the last point back to the first, a common mistake. */
        close: z.boolean(),
        /** A second frequency polygon on the same grid, drawn dashed, with a key naming both. */
        second: z.boolean(),
        names: z.array(plain(24)).length(2),
      })
      .strict(),
    cumulative: z
      .object({
        yAxis: paperAxisSchema,
        /** A smooth curve or straight lines through the points. */
        curve: z.enum(["smooth", "straight"]),
        /** Start at the lowest class boundary with cumulative frequency 0. */
        fromZero: z.boolean(),
        /** Crosses at the plotted points (upper class boundaries), as pupils plot them. */
        crosses: z.boolean(),
        /** Dashed guides from a value on one axis to the curve and across (or down) to the other. */
        readings: z.array(z.object({ axis: z.enum(["x", "y"]), value: z.string().max(12), show: shown }).strict()).max(MAX_GROUPED_READINGS),
      })
      .strict(),
  })
  .strict();
export type GroupedSettings = z.infer<typeof groupedSchema>;
/** Kinds drawn from the grouped table. */
export const groupedKinds = ["histogram", "polygon", "cumulative"] as const;
export type GroupedKind = (typeof groupedKinds)[number];
/** The grouped data a document starts with when it has none saved: one empty class on 0–100. */
export const GROUPED_DEFAULTS: GroupedSettings = {
  variable: "",
  inequality: "lower-open",
  classes: [blankGroupedClass()],
  xAxis: { min: "0", max: "100", step: "20", stepMm: 20, title: "" },
  table: "none",
  tableBeside: false,
  histogram: { yAxis: { min: "0", max: "5", step: "1", stepMm: 20, title: "Frequency density" }, fill: "grey" },
  polygon: { yAxis: { min: "0", max: "20", step: "5", stepMm: 20, title: "Frequency" }, plotAt: "midpoint", close: false, second: false, names: ["", ""] },
  cumulative: { yAxis: { min: "0", max: "100", step: "10", stepMm: 10, title: "Cumulative frequency" }, curve: "smooth", fromZero: true, crosses: false, readings: [] },
};
export const groupedOf = (d: { grouped?: GroupedSettings }): GroupedSettings => d.grouped ?? GROUPED_DEFAULTS;
/** Classes an answer view shows only because their graph part was saved hidden. */
const GRAPH_REVEALED = new WeakSet<object>();
export const markGraphRevealed = (c: object) => void GRAPH_REVEALED.add(c);
export const graphRevealed = (c: object) => GRAPH_REVEALED.has(c);
/** Classes an answer view shows only because their table cell was saved hidden. */
const GRAPH2_REVEALED = new WeakSet<object>();
/** Classes an answer view shows only because their second polygon point was saved hidden. */
export const markGraph2Revealed = (c: object) => void GRAPH2_REVEALED.add(c);
export const graph2Revealed = (c: object) => GRAPH2_REVEALED.has(c);
/** Time labels, and second time series values, an answer view shows only because they were saved hidden. */
const LABEL_REVEALED = new WeakSet<object>(),
  VALUE2_REVEALED = new WeakSet<object>();
export const markLabelRevealed = (p: object) => void LABEL_REVEALED.add(p);
export const labelRevealed = (p: object) => LABEL_REVEALED.has(p);
export const markValue2Revealed = (p: object) => void VALUE2_REVEALED.add(p);
export const value2Revealed = (p: object) => VALUE2_REVEALED.has(p);
const TABLE_REVEALED = new WeakSet<object>();
export const markTableRevealed = (c: object) => void TABLE_REVEALED.add(c);
export const tableRevealed = (c: object) => TABLE_REVEALED.has(c);

/**
 * Box plots as Edexcel prints them: one or more plots stacked on true-size graph paper over one
 * numbered horizontal scale, each with a label on the left. Every one of the five values can be
 * hidden for pupils (draw the box plot, or a single missing quartile); a row with every value
 * blank is an empty band for pupils to draw in.
 */
export const MAX_BOX_ROWS = 3;
export const BOX_BAND_MM = { minimum: 20, maximum: 40, standard: 30 } as const;
export const boxValueNames = ["min", "lq", "median", "uq", "max"] as const;
export type BoxValueName = (typeof boxValueNames)[number];
export const boxValueLabels: Record<BoxValueName, string> = { min: "Smallest", lq: "Lower quartile", median: "Median", uq: "Upper quartile", max: "Largest" };
/** How a sentence names each value: in error messages and field labels. */
export const boxValuePhrases: Record<BoxValueName, string> = { min: "smallest value", lq: "lower quartile", median: "median", uq: "upper quartile", max: "largest value" };
const boxValue = z.object({ value: z.string().max(12), show: shown }).strict();
export const boxRowSchema = z
  .object({
    label: plain(24),
    min: boxValue,
    lq: boxValue,
    median: boxValue,
    uq: boxValue,
    max: boxValue,
  })
  .strict();
export type BoxRow = z.infer<typeof boxRowSchema>;
export const boxAxisLineChoices = ["none", "line", "arrow"] as const;
export const boxAxisLineNames: Record<(typeof boxAxisLineChoices)[number], string> = { none: "Grid only", line: "Axis line", arrow: "Axis line with arrow" };
export const boxplotSchema = z
  .object({
    rows: z.array(boxRowSchema).min(1).max(MAX_BOX_ROWS),
    axis: paperAxisSchema,
    /** Height of each plot's band of grid: an even number of millimetres. */
    bandMm: z.number().int().min(BOX_BAND_MM.minimum).max(BOX_BAND_MM.maximum).multipleOf(2),
    /** Edexcel prints the scale on the grid alone, under a bold line, or under an arrowed axis. */
    line: z.enum(boxAxisLineChoices),
  })
  .strict();
export type BoxplotSettings = z.infer<typeof boxplotSchema>;
const emptyBox = (): BoxRow => ({ label: "", min: { value: "", show: "show" }, lq: { value: "", show: "show" }, median: { value: "", show: "show" }, uq: { value: "", show: "show" }, max: { value: "", show: "show" } });
export const blankBoxRow = emptyBox;
/** A new box plot: one empty plot on 0–100, never made-up data. */
export const BOXPLOT_DEFAULTS: BoxplotSettings = {
  rows: [emptyBox()],
  axis: { min: "0", max: "100", step: "10", stepMm: 10, title: "" },
  bandMm: BOX_BAND_MM.standard,
  line: "arrow",
};
export const boxplotOf = (d: { boxplot?: BoxplotSettings }): BoxplotSettings => d.boxplot ?? BOXPLOT_DEFAULTS;

/**
 * Stem-and-leaf diagrams as Edexcel prints them: 1 cm rows ruled between, stems to the left of
 * one vertical line, single-digit leaves spaced along each row, and a boxed key. A row's stem
 * and its leaves can be hidden separately (pupils complete them); a blank row is an empty ruled
 * row; the key can be printed, left as an empty "Key:" box for pupils, or left out.
 */
export const MAX_STEM_ROWS = 12;
export const STEM_LEAF_MM = { minimum: 20, maximum: 120, standard: 50 } as const;
export const stemRowSchema = z
  .object({
    stem: z.string().max(6),
    /** Leaves as typed: single digits, with or without spaces. Never sorted by the tool. */
    leaves: z.string().max(40),
    stemShow: shown,
    leavesShow: shown,
  })
  .strict();
export type StemRow = z.infer<typeof stemRowSchema>;
export const stemKeyChoices = ["show", "hidden", "none"] as const;
export const stemKeyNames: Record<(typeof stemKeyChoices)[number], string> = { show: "Printed", hidden: "Empty box for pupils", none: "No key" };
export const stemleafSchema = z
  .object({
    rows: z.array(stemRowSchema).min(1).max(MAX_STEM_ROWS),
    /** "Key: 1 | 2 represents 12 points" */
    key: z.object({ stem: plain(6), leaf: plain(1), represents: plain(32), show: z.enum(stemKeyChoices) }).strict(),
    /** Width of the leaves column, in millimetres. */
    leafMm: z.number().int().min(STEM_LEAF_MM.minimum).max(STEM_LEAF_MM.maximum),
  })
  .strict();
export type StemleafSettings = z.infer<typeof stemleafSchema>;
export const blankStemRow = (): StemRow => ({ stem: "", leaves: "", stemShow: "show", leavesShow: "show" });
/** A new stem-and-leaf diagram: three empty ruled rows and a key box for pupils, never made-up data. */
export const STEMLEAF_DEFAULTS: StemleafSettings = {
  rows: [blankStemRow(), blankStemRow(), blankStemRow()],
  key: { stem: "", leaf: "", represents: "", show: "hidden" },
  leafMm: STEM_LEAF_MM.standard,
};
export const stemleafOf = (d: { stemleaf?: StemleafSettings }): StemleafSettings => d.stemleaf ?? STEMLEAF_DEFAULTS;
/** A key with its stem, leaf and words: only such a key prints, or counts as a hidden answer. */
export const stemKeyComplete = (k: StemleafSettings["key"]) => !!(k.stem.trim() && k.leaf.trim() && k.represents.trim());
const stemKeyEmpty = (k: StemleafSettings["key"]) => !(k.stem.trim() || k.leaf.trim() || k.represents.trim());
/** A key part filled in: an error whether it prints or is left for pupils. */
export const stemKeyPartial = (k: StemleafSettings["key"]) => !stemKeyComplete(k) && !stemKeyEmpty(k);
/** The leaves of a row: one digit each, or null where the row holds something else. */
export function stemLeaves(text: string): string[] | null {
  const t = text.trim();
  if (!t) return [];
  const parts = /[\s,]/.test(t) ? t.split(/[\s,]+/).filter(Boolean) : [...t];
  return parts.every((p) => /^[0-9]$/.test(p)) ? parts : null;
}

/**
 * Time series graphs as Edexcel prints them: equally spaced times along the horizontal axis
 * (months, quarters, years or days, as typed), each value a cross, consecutive crosses joined
 * by straight lines, on true-size graph paper. A time can carry a group label printed once
 * under a run of equal groups (2016 under quarters 1 to 4). Hidden values are left for pupils
 * to plot; with every value hidden the grid is a blank "construct" graph.
 */
export const MAX_TIMES = 24;
export const timePointSchema = z
  .object({
    label: plain(12),
    /** Hidden leaves the label's space for pupils to write; answers copies print it. */
    labelShow: shown,
    group: plain(12),
    value: z.string().max(12),
    show: shown,
    /** The second time series' value, used only when the graph has two. */
    value2: z.string().max(12),
    show2: shown,
  })
  .strict();
export type TimePoint = z.infer<typeof timePointSchema>;
export const timeJoinChoices = ["straight", "curve"] as const;
export const timeJoinNames: Record<(typeof timeJoinChoices)[number], string> = { straight: "Straight lines", curve: "A curve (misleading)" };
export const timeseriesSchema = z
  .object({
    points: z.array(timePointSchema).min(1).max(MAX_TIMES),
    /** Distance between consecutive times: an even number of millimetres. */
    slotMm: z.number().int().min(STEP_MM.minimum).max(STEP_MM.maximum).multipleOf(2),
    xTitle: plain(40),
    yAxis: paperAxisSchema,
    /** A zig-zag on the vertical axis next to the corner, which is labelled 0, for an axis that starts above 0. */
    yBreak: z.boolean(),
    /** Straight lines, as the papers draw them, or a curve through the points for "what is misleading" questions. */
    join: z.enum(timeJoinChoices),
    /** Join across a time with no value instead of breaking the line, as in "what is misleading" questions where a quarter is missing. */
    bridge: z.boolean(),
    /** A second time series on the same axes, drawn dashed, with a key naming both. */
    second: z.boolean(),
    names: z.array(plain(24)).length(2),
  })
  .strict();
export type TimeseriesSettings = z.infer<typeof timeseriesSchema>;
export const blankTimePoint = (): TimePoint => ({ label: "", labelShow: "show", group: "", value: "", show: "show", value2: "", show2: "show" });
/** A new time series graph: the twelve months with no values, never made-up data. */
export const TIMESERIES_DEFAULTS: TimeseriesSettings = {
  points: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"].map((label) => ({ ...blankTimePoint(), label })),
  slotMm: 10,
  xTitle: "Month",
  yAxis: { min: "0", max: "60", step: "10", stepMm: 10, title: "" },
  yBreak: false,
  join: "straight",
  bridge: false,
  second: false,
  names: ["", ""],
};
export const timeseriesOf = (d: { timeseries?: TimeseriesSettings }): TimeseriesSettings => d.timeseries ?? TIMESERIES_DEFAULTS;
