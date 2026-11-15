# Statistical charts

`/tools/charts` (called "Bar and line charts" until 15 Nov 2026) makes the statistical charts
in GCSE Foundation papers: bar charts, dual (comparative) bar charts, composite (stacked) bar
charts, vertical line charts, pie charts, pictograms and scatter graphs. Browser editing and export need no service; the optional MCP connector adds
`diagram_capabilities` (kind `charts`), `create_diagram` (kind `charts`) and `revise_diagram` (kind `charts`) (see below).

## Why one tool

All four share a categorical horizontal axis, a numerical vertical axis from 0 with an end
and step, a grid and a key. Exam questions move between them ("draw a dual bar chart",
"complete the composite bar chart", "show this information on the graph"), so the chart type
is a setting of one document (`kind`). Switching type never discards data: a bar chart or
vertical line chart draws only the first data set and says that the others are kept.

Scatter graphs are a kind too (15 Nov 2026), so they share the editor, files, links, answers
copies and connector family, but they keep their own data (`scatter`): points on two numerical
axes do not fit the category table.

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

## Pictograms

A pictogram is another kind of the same document: one row per category from the first data set.

- **Drawing (Edexcel style):** a ruled table with the categories on the left and the symbols on
  the right, and a framed key beside it: "Key: [symbol] represents 8 pictures". If side by side
  would be wider than 18 cm, the key goes under the table. Each row draws value ÷ key symbols
  (at most 20). Part symbols are exact: part of a square is its left part drawn open on the right,
  and part of a circle is a sector anticlockwise from 12 o'clock, so a half is the left half,
  as in the papers.
- **Settings (`pictogram`):** symbol (circle or square), symbol size 6–14 mm (default 10), the
  key value (`key: {value, show}`) and the unit printed after it. The horizontal and vertical
  axis titles become the category and symbol column headings; with both empty there is no
  heading row. `pictogram` is saved once a teacher changes a pictogram setting.
- **Pupil states:** a blank value is an empty row; 0 draws nothing; a hidden value leaves the row
  for pupils to draw. A hidden key value prints a dotted answer line in the key (pupils complete
  the key) and keeps that width on the answers copy. Answers copies draw hidden rows and the key
  value in pink. **Show all** also shows a hidden key; **Hide all** leaves the key as it is.
- **Validation:** the key value must be a positive number; values must be numbers and not
  negative; a row needing more than 20 symbols is an error. Circle parts that are not whole
  quarters, and parts under 1 mm wide, get a teacher note because they are hard to read.
- **Examples:** November 2019 1F Q6 (squares, April row hidden) and November 2017 3F Q6 (circles,
  key and two rows hidden).
- **Not yet:** a frequency column inside the pictogram, other symbols (stick figures), and
  horizontal pictograms.

## Scatter graphs

- **Drawing (Edexcel style):** crosses on graph paper with arrowed axes numbered at every step,
  the vertical axis title to the left and the horizontal title below. Axes may start away from 0,
  optionally with a zig-zag break next to the corner (each broken axis labels the corner 0), which moves the grid 6 mm off
  that axis.
- **Settings (`scatter`):** up to 40 points `{x, y, show, ring}`; `xAxis` and `yAxis` (start, end,
  step, title, length 40–160 mm on paper and `broken`); grid (none, lines at each step, graph paper) with
  small squares per step; an optional line of best fit; up to 3 readings; `table` (`none`, `all`, `plot`).
  Without `scatter` a scatter graph starts with no points on 0–10 axes.
- **Table of values:** a ruled table above the graph with the axis titles as row headings and one
  column per point, as typed. **Only the points pupils plot** lists the hidden points, so pupils
  get the data and plot it; the table prints the same on both copies. A long table continues in
  a second block underneath.
- **Line of best fit:** the teacher gives two points it passes through and it is drawn across the
  grid. Nothing is fitted automatically.
- **Readings:** dashed guides from a value on one axis to the line of best fit and across to the
  other axis. The value read off is never printed.
- **Pupil states:** a hidden point is left for pupils to plot, a hidden line for pupils to draw, a
  hidden reading for pupils to read. Answers copies draw them in pink. A ring circles an outlier
  (and is hidden with its point). **Hide all points** hides every point; **Show all** shows
  everything.
- **Validation:** coordinates must be numbers inside the axes; each axis needs a start below its
  end and a step that divides the range (at most 40 steps); a reading needs a line of best fit
  that is inside the grid at that value.
- **Editor:** Points, Axes and grid, and Line of best fit and readings cards replace the Data and
  axes cards. Clicking a cross focuses its x value; the round + and − beside the graph add or
  remove the last point.
- **Examples:** Mock set 8 3F Q21 (plot a point, line of best fit and an estimate, all hidden) and
  a "plot a scatter graph from a table" teaching example with a table and a broken axis.
- **Left to the worksheet:** correlation captions and other answers in words (Tim, 15 Nov 2026).

## Line weight (U111)

Lines are normal or bold (the Lines control beside Chart height). Bold multiplies the bars, line-chart lines, axes, ticks and key strokes by 1.5. The grey grid keeps its weight, so the grid never competes with the data. Bold is saved as `lines: "bold"`; normal is never saved. A new chart starts with the house style's lines. The connector takes `lines` in `presentation` (create spec and `set_presentation`).

## Not yet included

Horizontal bars, a printed data table beside the chart, time series graphs,
frequency polygons, comparative pie charts of different sizes and histograms. Each would be a separate, reviewed extension or tool.

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
  (`radiusMm`, `labels`) and `presentation.pictogram` (`symbol`, `symbolMm`, `key`, `unit`) and `presentation.scatter`
  (`points`, `xAxis`, `yAxis`, `grid`, `minor`, `bestFit`, `readings`) merge field by field with the
  current settings; a given `points` array replaces every point.
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
