# Statistical charts

`/tools/charts` (called "Bar and line charts" until 15 Nov 2026) makes the statistical charts
in GCSE Foundation papers: bar charts, dual (comparative) bar charts, composite (stacked) bar
charts, vertical line charts and pie charts. Browser editing and export need no service; the optional MCP connector adds
`diagram_capabilities` (kind `charts`), `create_diagram` (kind `charts`) and `revise_diagram` (kind `charts`) (see below).

## Why one tool

All four share a categorical horizontal axis, a numerical vertical axis from 0 with an end
and step, a grid and a key. Exam questions move between them ("draw a dual bar chart",
"complete the composite bar chart", "show this information on the graph"), so the chart type
is a setting of one document (`kind`). Switching type never discards data: a bar chart or
vertical line chart draws only the first data set and says that the others are kept.

Time series graphs and frequency polygons join plotted points on a time or continuous axis
(class midpoints for frequency polygons). Tim decided on 6 Nov 2026 that each gets its own
tool later rather than a mode here.

## Brief

- **Teaching purpose:** read, complete and draw charts in the style of the source questions.
- **Representative outputs:** the four examples in `packages/chart-core/src/examples.ts`,
  three linked to Question bank sources (June 2017 2F Q3 dual, June 2018 1F Q12 composite,
  Mock set 8 3F Q8 vertical line chart) and one blank "draw a bar chart" scaffold.
- **Pupil states:** each value is blank (no bar or line), a number (0 draws nothing above the
  axis but is stored as 0), or a number hidden for pupils to draw. Hidden values are saved
  answers shown only by **Teacher copy: show hidden answers** or the worked example, in the
  house answer colour (pink) in the editor, its downloads and the pupil-and-answers ZIP (since
  15 Nov 2026; before that the browser drew them in black).
- **Direct editing:** clicking a bar, line or category label focuses its field in the Data
  table. Round + and − controls beside the chart add or remove the last category.
- **Validation:** values and axis numbers stay as typed. Non-numbers, negative values, values
  above the axis, a step that does not divide the range, a non-zero axis start, stacked totals
  above the axis and charts wider than 18 cm are shown as specific errors and block export.
- **Print:** 11 pt STIX text, physical millimetre layout, chart height 40–140 mm, bar width (or
  line spacing) 5–20 mm. Patterns (hatching, cross-hatching, dots) print in black and white.
  Vertical line charts draw 0.6 mm black lines with a grid line through every category.
- **Limits:** 1–12 categories, 1–4 data sets, at most 40 axis steps.

## Pie charts

A pie chart is a kind of the same document: it draws the categories and the first data set,
so a teacher can switch between a bar chart and a pie chart of the same table without losing
anything. The axis, grid and bar settings are kept but not used.

- **Drawing:** sectors run clockwise in category order from a radius drawn upwards from the
  centre, as Edexcel prints them. Each angle is exactly 360 × value ÷ total. The circle and the
  starting radius always print, at true size, so pupils can draw with a protractor. There is no
  centre dot, as in the papers.
- **Pupil states:** every category needs a number (0 is a value and draws no sector). A blank
  value is an error, because the other angles depend on the total. A hidden value leaves its
  sector for pupils to draw: its label is not printed, and an edge prints only when a sector on
  either side of it is drawn. The answers copy draws the missing edges and labels in the house
  answer colour; the starting radius stays black. If both neighbours of a hidden sector are
  drawn, both of its edges print and pupils only label it; a teacher note says so.
- **Settings (`pie`):** radius 25–70 mm (default 40) and sector labels: category names, names
  and angles, names and percentages, or none. Angles and percentages print to 1 decimal place.
  `pie` is saved only once a teacher changes a pie setting; without it the defaults apply.
- **Labels** sit inside their sector when they fit, otherwise just outside the circle beside the
  middle of the sector, with no leader line. Every label is placed (drawn or not), so the pupil
  and answers copies are the same size.
- **Editor:** the Data table adds an Angle column for the teacher (not printed). A hidden sector's
  angle shows there only with **Teacher copy: show hidden answers**. Clicking a sector focuses its
  value. Labels that cannot be placed without overlapping are an error that blocks export. The Pie chart card replaces Axes and grid.
- **Examples:** June 2018 2F Q12 (draw a pie chart, every sector hidden) and a "complete the pie
  chart" teaching example.
- **Notes:** angles that are not whole numbers are flagged, because pupils draw to the nearest degree.

## Line weight (U111)

Lines are normal or bold (the Lines control beside Chart height). Bold multiplies the bars, line-chart lines, axes, ticks and key strokes by 1.5. The grey grid keeps its weight, so the grid never competes with the data. Bold is saved as `lines: "bold"`; normal is never saved. A new chart starts with the house style's lines. The connector takes `lines` in `presentation` (create spec and `set_presentation`).

## Not yet included

Horizontal bars, a printed data table beside the chart, pictograms, time series graphs,
frequency polygons, scatter graphs, comparative pie charts of different sizes and histograms. Each would be a separate, reviewed extension or tool.

## MCP connector

`packages/chart-core/src/interchange.ts` adapts the same schema, layout and renderer for
`services/graph-mcp` (`chart-config.ts`). It follows the capabilities/create/revise pattern:

- `create_diagram` (kind `charts`) takes an exact `envelope` or a `spec` (an `example` with optional `worked`,
  or `kind`, `categories`, `series` with one numeric string or `null` per category and
  optional `hidden` indices, `axis`, `presentation`). Omitting both gives the unworked default
  dual bar chart.
- `revise_diagram` (kind `charts`) takes the returned envelope, its `contentHash` as `baseHash` and up to 30
  atomic operations using 0-based indices: `set_kind`, `set_value`, `set_category`,
  `add_category`, `remove_category`, `add_series`, `remove_series`, `set_series`, `set_axis`,
  `set_presentation`, `set_all_visibility`. Nothing is calculated or filled. `presentation.pie`
  (`radiusMm`, `labels`) merges with the current pie settings.
- `outputView` is `pupil` by default; `answer` draws hidden values in the artwork only, in the house
  answer colour (pink, `#b0125b`), as worksheet answers copies do. The
  returned JSON, hash and editor link always keep the saved pupil document, which can contain
  hidden answers.
- Responses carry the preview, outlined SVG, verified 600 ppi PNG, JSON, physical size, print
  guidance and a `/tools/charts#chart=` editor link. The shared placement, bundle and
  `get_diagram_svg` tools accept kind `charts`.

The connector is live only after a separately approved Render deploy and client refresh.
Service checks: `npx vitest run services/graph-mcp/chart.test.ts`.

## Files

`packages/chart-core/src` holds the schema, layout, renderer and examples;
`src/charts` holds the editor, export and editable links (`#chart=`). Browser checks:
`npx playwright test --project=charts`.
