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
    rendererVersions: ["charts-1"],
    kinds: chart.kinds,
    kindNames: chart.kindNames,
    fills: chart.fills,
    grids: chart.gridChoices,
    minorSquaresPerStep: [1, 2, 4, 5, 10],
    categories: { minimum: 1, maximum: chart.MAX_CATEGORIES },
    series: { minimum: 1, maximum: chart.MAX_SERIES },
    heightMm: { minimum: 40, maximum: 140 },
    barMm: { minimum: 5, maximum: 20 },
    maximumWidthCm: 18,
    maximumAxisSteps: 40,
    maximumRevisionOperations: 30,
    examples: chi.exampleNames,
    operations: chi.operationSchema.options.map((o) => o.shape.op.value),
    indices: "series and category indices are 0-based positions in the returned envelope",
    values:
      "numeric strings; null or empty is blank (no bar or line); \"0\" is zero; hidden keeps the value as a saved answer for pupils to draw",
    singleSetKinds: "bar and vline draw only series 0; other series are kept",
    outputView:
      "pupil (default) or explicitly requested answer; source JSON and hash always retain saved pupil visibility",
    hiddenAnswers: "Editable files/links can contain hidden answers.",
    notIncluded: "time series graphs, frequency polygons, histograms, pictograms and horizontal bars",
    creation: "spec or envelope; omit both for an unworked dual bar chart",
  },
  createDescription:
    "Create an exam-style statistical chart: kind bar (bar chart), dual (comparative/dual bar chart), composite (stacked) or vline (vertical line chart). Supply exact envelope OR spec:{example?,worked?,kind?,categories?:[label],series?:[{name,fill?,values:[numeric string|null per category],hidden?:[category indices]}],axis?:{min?,max?,step?,minor?},presentation?:{xTitle?,yTitle?,grid?:none|major|fine,key?,heightMm?,barMm?}}. Examples dual-transport, composite-sales, vline-cars, bar-draw are source-linked starters that keep pupil blanks; worked:true shows saved answers. Custom categories require series with one value per category. The axis starts at 0 and its step must divide the range; values above the axis, negative values and widths over 18 cm are rejected. Null is blank; zero is not blank; hidden values are saved answers and are not drawn in pupil output. Never invent data or answers. outputView defaults pupil; answer must be explicitly requested. Not for time series, frequency polygons or histograms. Returns preview, outlined SVG, verified 600 ppi PNG, editable JSON, contentHash, physicalSizeCm and a bounded editor link.",
  reviseDescription:
    "Revise the returned chart envelope atomically with baseHash:contentHash and operations (max30), using 0-based indices. set_kind {kind:bar|dual|composite|vline} keeps every data set; set_value {series,category,value:string|null,hidden?}; set_category {category,label}; add_category {label?} appends with blank values; remove_category {category}; add_series {name,fill?} with blank values; remove_series {series}; set_series {series,name?,fill?}; set_axis {axis:{min?,max?,step?,minor?}}; set_presentation {presentation:{xTitle?,yTitle?,grid?,key?,heightMm?,barMm?}}; set_all_visibility {hidden} hides or shows every value (draw-the-chart tasks). Values are never calculated or filled. outputView pupil|answer affects artwork only; retain the returned pupil source/hash. Empty operations refresh links. Returns preview, SVG, 600 ppi PNG, JSON, native size and editor link; hidden answers remain in editable source.",
};
