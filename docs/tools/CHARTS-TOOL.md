# Bar and line charts

`/tools/charts` makes the bar-family statistical charts in GCSE Foundation papers: bar
charts, dual (comparative) bar charts, composite (stacked) bar charts and vertical line
charts. It is browser-only; there is no MCP tool yet.

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
  answers shown only by **Show saved answers** or the worked example.
- **Direct editing:** clicking a bar, line or category label focuses its field in the Data
  table. Round + and − controls beside the chart add or remove the last category.
- **Validation:** values and axis numbers stay as typed. Non-numbers, negative values, values
  above the axis, a step that does not divide the range, a non-zero axis start, stacked totals
  above the axis and charts wider than 18 cm are shown as specific errors and block export.
- **Print:** 11 pt STIX text, physical millimetre layout, chart height 40–140 mm, bar width (or
  line spacing) 5–20 mm. Patterns (hatching, cross-hatching, dots) print in black and white.
  Vertical line charts draw 0.6 mm black lines with a grid line through every category.
- **Limits:** 1–12 categories, 1–4 data sets, at most 40 axis steps.

## Not yet included

Horizontal bars, a printed data table beside the chart, pictograms, time series graphs,
frequency polygons, histograms and an MCP create/revise tool. Each would be a separate,
reviewed extension or tool.

## Files

`packages/chart-core/src` holds the schema, layout, renderer and examples;
`src/charts` holds the editor, export and editable links (`#chart=`). Browser checks:
`npx playwright test --project=charts`.
