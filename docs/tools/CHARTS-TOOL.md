# Bar and line charts

`/tools/charts` makes the statistical charts in GCSE Foundation papers: bar charts,
dual (comparative) bar charts, composite (stacked) bar charts and line graphs, including
time series. It is browser-only; there is no MCP tool yet.

## Why one tool

All four share a categorical horizontal axis, a numerical vertical axis from a start, end
and step, a grid and a key. Exam questions move between them ("draw a dual bar chart",
"complete the composite bar chart", "plot the time series"), so the chart type is a setting
of one document (`kind`). Switching type never discards data: a bar chart draws only the
first data set and says that the others are kept.

## Brief

- **Teaching purpose:** read, complete and draw charts in the style of the source questions.
- **Representative outputs:** the four examples in `packages/chart-core/src/examples.ts`,
  three linked to Question bank sources (June 2017 2F Q3 dual, June 2018 1F Q12 composite,
  Mock set 4 3F Q7 time series) and one blank "draw a bar chart" scaffold.
- **Pupil states:** each value is blank (no bar or point), a number (0 is a zero-height bar),
  or a number hidden for pupils to draw or plot. Hidden values are saved answers shown only by
  **Show saved answers** or the worked example. A hidden line point also leaves its joining
  segments undrawn.
- **Direct editing:** clicking a bar, point or category label focuses its field in the Data
  table. Round + and − controls beside the chart add or remove the last category.
- **Validation:** values and axis numbers stay as typed. Non-numbers, values outside the axis,
  a step that does not divide the range, a non-zero start for bar charts, stacked totals above
  the axis and charts wider than 18 cm are shown as specific errors and block export.
- **Print:** 11 pt STIX text, physical millimetre layout, chart height 40–140 mm, bar width (or
  line-graph point spacing) 5–20 mm. Patterns (hatching, cross-hatching, dots) and the line
  markers (cross, circle, square, triangle) and dash styles print in black and white. On graph
  paper, line-graph points sit on the major vertical lines.
- **Limits:** 1–12 categories (months of a year), 1–4 data sets, at most 40 axis steps.

## Not yet included

Horizontal bars, a printed data table beside the chart, pictograms, frequency polygons and
histograms (continuous axes), and an MCP create/revise tool. Each would be a separate,
reviewed extension of `chart-core` schema 1.

## Files

`packages/chart-core/src` holds the schema, layout, renderer and examples;
`src/charts` holds the editor, export and editable links (`#chart=`). Browser checks:
`npx playwright test --project=charts`.
