import * as chart from "../../../chart-core/src/index";
import * as chi from "../../../chart-core/src/interchange";
export const chartConfig = {
  kind: "charts" as const,
  name: "chart",
  schema: chart.envelopeSchema,
  createInput: chi.createSchema,
  revision: chi.revisionSchema,
  capabilities: {
    schemaVersions: [1],
    rendererVersions: [chart.RENDERER_VERSION],
    kinds: chart.kinds,
    kindNames: chart.kindNames,
    fills: chart.fills,
    grids: chart.gridChoices,
    minorSquaresPerStep: [1, 2, 4, 5, 10],
    categories: { minimum: 1, maximum: chart.MAX_CATEGORIES },
    series: { minimum: 1, maximum: chart.MAX_SERIES },
    heightMm: { minimum: 40, maximum: 140 },
    barMm: { minimum: 5, maximum: 20 },
    lines: ["normal", "bold"],
    pie: {
      radiusMm: { minimum: chart.PIE_RADIUS.minimum, maximum: chart.PIE_RADIUS.maximum, default: chart.PIE_RADIUS.standard },
      labels: chart.pieLabelChoices,
      drawing:
        "sectors clockwise in category order from a radius drawn upwards from the centre; angle = 360 × value ÷ total of series 0; every value needs a number; hidden values leave their sectors (edges and labels) for pupils to draw; the circle and starting radius always print at true size",
    },
    scatter: {
      points: { maximum: chart.MAX_POINTS, shape: "{x: numeric string, y: numeric string, show: show|hidden, ring: boolean}" },
      axes: "xAxis and yAxis {min, max, step (numbered every step; may start away from 0), title, mm: 40-160 length on paper, broken: boolean (zig-zag by the corner for an axis not starting at 0)}",
      table: "none|all|plot: a table of the points above the graph; plot lists only the hidden points pupils plot",
      grid: "none|major|fine with minor small squares per step (1, 2, 4, 5 or 10)",
      bestFit: "optional {from:{x,y}, to:{x,y}, show}: two points the teacher's line passes through, drawn across the grid; nothing is fitted automatically",
      readings: `up to ${chart.MAX_READINGS} {axis: x|y, value, show}: dashed guides from the value to the line of best fit and across to the other axis; the value read off is never printed`,
      hidden: "hidden points (pupils plot), a hidden line (pupils draw) and hidden readings print only on answers copies, in pink",
    },
    grouped: {
      kinds: "histogram (bars at frequency ÷ class width), polygon (crosses at class midpoints joined by lines), cumulative (points at upper boundaries, smooth or straight)",
      classes: `1-${chart.MAX_CLASSES} {lower, upper, frequency (blank = no data), table: show|hidden (cell left for pupils), graph: show|hidden (bar, point or curve part left for pupils)}; in order, not overlapping`,
      axes: "xAxis, and yAxis inside histogram, polygon and cumulative: {min, max, step (numbered every step; grid runs on to max), stepMm: even 4-40 (true-size 2 mm graph paper), title}",
      other: "variable: one letter (italic in 0 < t ⩽ 20) or empty; inequality lower-open|lower-closed; table none|frequency|cumulative above the graph; histogram.fill grey|white; cumulative {curve: smooth|straight, fromZero, crosses, readings: up to 4 {axis, value, show}}",
      hidden: "hidden parts print only on answers copies, in pink; nothing is calculated except drawing the teacher's frequencies",
    },
    boxplot: {
      rows: `1-${chart.MAX_BOX_ROWS} {label, min, lq, median, uq, max}, each value {value, show: show|hidden}; all blank = an empty band for pupils; values in order`,
      other: "axis {min, max, step, stepMm even 4-40, title}; bandMm even 20-40 per plot; line none|line|arrow (grid alone, bold line, arrowed axis)",
      drawing: "1.5 pt whiskers, box and median, 1 cm end lines and box on true-size 2 mm graph paper; a part prints only when every value it needs prints",
    },
    pictogram: {
      symbols: chart.symbolChoices,
      symbolMm: { minimum: chart.SYMBOL_MM.minimum, maximum: chart.SYMBOL_MM.maximum, default: chart.SYMBOL_MM.standard },
      maximumSymbolsPerRow: chart.MAX_SYMBOLS,
      key: "{value: numeric string, show: show|hidden}; hidden prints an answer line in the key for pupils to complete",
      unit: "text after the key value, e.g. represents 8 pictures",
      drawing:
        "ruled table, categories left, value ÷ key symbols per row from series 0; part symbols are exact (a sector of a circle, a half is the left half; part of a square open on its right); blank value = empty row; hidden value = row left for pupils to draw; xTitle and yTitle are the column headings (both empty = no heading row)",
    },
    maximumWidthCm: 18,
    maximumAxisSteps: 40,
    maximumRevisionOperations: 30,
    examples: chi.exampleNames,
    operations: chi.operationSchema.options.map((o) => o.shape.op.value),
    indices: "series and category indices are 0-based positions in the returned envelope",
    values:
      "numeric strings; null or empty is blank (no bar or line); \"0\" is zero; hidden keeps the value as a saved answer for pupils to draw",
    singleSetKinds: "bar, vline, pie and pictogram draw only series 0; other series are kept; scatter, the grouped kinds and boxplot use their own settings and keep categories and series unchanged",
    outputView:
      "pupil (default) or explicitly requested answer; source JSON and hash always retain saved pupil visibility",
    hiddenAnswers: "Editable files/links can contain hidden answers.",
    notIncluded: "time series graphs, stem-and-leaf diagrams and horizontal bars",
    creation: "spec or envelope; omit both for an unworked dual bar chart",
  },
  createDescription:
    "Create an exam-style statistical chart: kind bar (bar chart), dual (comparative/dual bar chart), composite (stacked), vline (vertical line chart), pie (pie chart at true size), pictogram, scatter (scatter graph), histogram, polygon (frequency polygon), cumulative (cumulative frequency graph) or boxplot (box plots). Supply exact envelope OR spec:{example?,worked?,kind?,categories?:[label],series?:[{name,fill?,values:[numeric string|null per category],hidden?:[category indices]}],axis?:{min?,max?,step?,minor?},presentation?:{xTitle?,yTitle?,grid?:none|major|fine,key?,heightMm?,barMm?,lines?:normal|bold,pie?:{radiusMm?:25-70,labels?:name|name-angle|name-percent|none},pictogram?:{symbol?:circle|square,symbolMm?:6-14,key?:{value,show:show|hidden},unit?},scatter?:{points?:[{x,y,show,ring}],xAxis?,yAxis?,grid?,minor?,bestFit?,readings?,table?},grouped?:{variable?,inequality?,classes?,xAxis?,table?,histogram?,polygon?,cumulative?},boxplot?:{rows?,axis?,bandMm?,line?}}}. Examples dual-transport, composite-sales, vline-cars, bar-draw, pie-snacks, pie-complete, pictogram-pictures, pictogram-cycles, scatter-judges, scatter-plot, histogram-puzzle, histogram-complete, polygon-plants, cumulative-office, boxplot-holiday, boxplot-heights are source-linked starters that keep pupil blanks; worked:true shows saved answers. Custom categories require series with one value per category. The axis starts at 0 and its step must divide the range; values above the axis, negative values and widths over 18 cm are rejected. A pie chart uses series 0, needs a number for every category and draws sectors clockwise from the upward radius; hide values to leave sectors for pupils to draw. A pictogram draws value ÷ key symbols per row (at most 20); hide a row for pupils to draw, or hide the key value for pupils to complete the key. A scatter graph plots presentation.scatter.points on its own axes; the line of best fit is the teacher's two points (never fitted); hide points, the line or readings for pupils. Histograms, frequency polygons and cumulative frequency graphs share presentation.grouped classes on true-size graph paper; hide a class's graph part or table cell for pupils. Box plots use presentation.boxplot rows of five values; hide values for pupils to draw. Null is blank; zero is not blank; hidden values are saved answers and are not drawn in pupil output. Never invent data or answers. outputView defaults pupil; answer must be explicitly requested. Not for time series or stem-and-leaf. Returns preview, outlined SVG, verified 600 ppi PNG, editable JSON, contentHash, physicalSizeCm and a bounded editor link.",
  reviseDescription:
    "Revise the returned chart envelope atomically with baseHash:contentHash and operations (max30), using 0-based indices. set_kind {kind:bar|dual|composite|vline|pie|pictogram|scatter|histogram|polygon|cumulative|boxplot} keeps every data set; set_value {series,category,value:string|null,hidden?}; set_category {category,label}; add_category {label?} appends with blank values; remove_category {category}; add_series {name,fill?} with blank values; remove_series {series}; set_series {series,name?,fill?}; set_axis {axis:{min?,max?,step?,minor?}}; set_presentation {presentation:{xTitle?,yTitle?,grid?,key?,heightMm?,barMm?,lines?,pie?:{radiusMm?,labels?},pictogram?:{symbol?,symbolMm?,key?,unit?},scatter?:{points?,xAxis?,yAxis?,grid?,minor?,bestFit?,readings?,table?},grouped?:{...},boxplot?:{...}}} (lines bold makes black strokes 1.5x; the grid keeps its weight; pie, pictogram, scatter, grouped and boxplot merge field by field with the current settings, and a given points, classes or rows array replaces them all); set_all_visibility {hidden} hides or shows every value (draw-the-chart tasks). Values are never calculated or filled. outputView pupil|answer affects artwork only; retain the returned pupil source/hash. Empty operations refresh links. Returns preview, SVG, 600 ppi PNG, JSON, native size and editor link; hidden answers remain in editable source.",
};
