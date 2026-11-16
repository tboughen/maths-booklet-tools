# Statistical charts

`/tools/charts` (called "Bar and line charts" until 15 Nov 2026) makes the statistical charts
in GCSE papers: bar charts, dual (comparative) bar charts, composite (stacked) bar
charts, vertical line charts, pie charts, pictograms, scatter graphs, histograms, frequency
polygons and cumulative frequency graphs. Browser editing and export need no service; the optional MCP connector adds
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

Time series graphs join plotted points on a time axis. Tim decided on 6 Nov 2026 that they
get their own tool later rather than a mode here. Frequency polygons were in the same
decision, but on 16 Nov 2026 they joined histograms and cumulative frequency graphs as kinds
here, because all three draw one grouped frequency table (the coordinator's brief for the
worked-solutions tools; see Grouped data below).

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

## Grouped data: histograms, frequency polygons and cumulative frequency graphs

Added 16 Nov 2026 so worked solutions can be drawn for the higher statistics questions (192
exam parts). The three kinds draw one table of classes (`grouped`), so a teacher can switch
between them without retyping, as exam questions do ("complete the table", "draw a frequency
polygon", "draw the cumulative frequency graph").

- **Drawing (measured from Edexcel papers):** true-size graph paper, 2 mm squares in grey with
  heavier lines every 1 cm and 2 cm from the corner (0.51, 1.02 and 1.417 pt), under black
  1.5 pt axes with arrowheads, numbered at every step with ticks. The grid runs on to the end of
  each axis even past the last number, as in the papers. The vertical title sits to the left,
  the horizontal title below.
  - **Histogram:** bars at frequency ÷ class width (frequency density), 1.5 pt outlines, grey
    (`#bfbfbf`, as in the papers since 2018, with the grid showing through) or white. The
    vertical axis starts at 0. Gaps between classes are allowed.
  - **Frequency polygon:** crosses at the class midpoints joined by 1 pt straight lines, not
    closed to the axis.
  - **Cumulative frequency graph:** running totals at the upper class boundaries, joined by a
    smooth curve (monotone, so it never turns back or overshoots) or straight lines, 1.5 pt.
    It starts at 0 at the lowest boundary unless **Start at 0** is off (some papers start at
    the first point). Crosses at the plotted points are optional.
- **Settings (`grouped`):** `variable` (one letter, printed in italics in the table and in axis
  titles: 0 < *t* ⩽ 20; empty prints 0 – 20), `inequality` (`lower-open` 0 < *t* ⩽ 20, Edexcel's
  usual, or `lower-closed`), up to 12 `classes` `{lower, upper, frequency, table, graph}`,
  `xAxis`, `table` (`none`, `frequency` or `cumulative`), and per kind `histogram {yAxis, fill}`,
  `polygon {yAxis}` and `cumulative {yAxis, curve, fromZero, crosses, readings}`. Each axis is
  `{min, max, step, stepMm, title}`: `stepMm` is the length of one numbered step, an even number
  of millimetres from 4 to 40, so numbers sit on grid lines. Each kind keeps its own vertical
  axis, because frequency density, frequency and cumulative frequency need different scales.
  Without `grouped` a grouped chart starts with one empty class, never made-up data.
- **Table:** a ruled table above the graph in the papers' style (grey rules): the horizontal
  axis title heads the class column; the second column is Frequency or Cumulative frequency
  (0 < *t* ⩽ 40 rows from the lowest boundary).
- **Pupil states:** a blank frequency is no data (empty cell, nothing drawn; a cumulative graph
  needs every frequency); 0 is a value. Each class has two hide flags: **Table** leaves its cell
  for pupils to complete; **Graph** leaves its bar, point or part of the curve for pupils to draw.
  A line or curve part prints only when the points at both of its ends print, so it never gives
  away a hidden point. Answers copies draw hidden parts in pink; a hidden bar is a pink outline.
- **Readings (cumulative frequency):** up to 4 dashed guides from a value on either axis to the
  curve and on to the other axis (medians, quartiles, "how many more than"). The value read off
  is never printed. A guide prints only where that part of the curve prints.
- **Validation:** boundaries and frequencies must be numbers, classes in order and not
  overlapping, inside the horizontal axis; densities and (cumulative) frequencies inside the
  vertical axis; each axis must end on a 2 mm grid line, with at most 40 steps; the graph fits
  18 × 26 cm.
- **Editor:** Classes, Axes and graph paper, and (cumulative) Readings cards replace the Data and
  axes cards. Clicking a bar or point focuses its frequency; + and − beside the graph add or
  remove the last class (a new class starts at the previous upper boundary).
- **Examples:** June 2018 2H Q17 (complete the frequency table from a histogram), November 2019
  2H Q18 (complete a histogram), June 2019 3H Q3 (draw a frequency polygon) and June 2019 2H Q11
  (cumulative frequency table, graph and estimate).
- **Differences from the papers:** where a paper's grid runs on past the last number (June 2019
  2H Q11 stops numbering at 80 on a grid to 90), the tool numbers every step to the end. Older
  papers print 1.0, 2.0 on a frequency density axis; the tool prints 1, 2.

### Frequency polygon mistakes and a second polygon

- **Mistakes to spot** (June 2022 3F Q26 and 3H Q5 ask pupils to write down two mistakes):
  `polygon.plotAt` is `midpoint` (correct), `lower` or `upper` (every point at that class bound),
  and `polygon.close` joins the last point back to the first. A note names each mistake so the
  teacher knows it is deliberate.
- **Two polygons:** `polygon.second` draws a second, dashed polygon from each class's `frequency2`
  (with its own `graph2` hide flag), and a key beside the graph names both (`polygon.names`). A
  table shows one set of frequencies, so two polygons need no table.

## Box plots

Edexcel prints box plots on true-size 2 mm graph paper: a numbered scale below the grid, 1.5 pt
whiskers, box and median, and 1 cm end lines (measured on June 2017 3H Q9 and November 2017 1H
Q12). The papers draw the scale with no axis line, a plain line or an arrowed line.

- **Settings:** `boxplot {rows, axis, bandMm, line}`. `rows` holds 1 to 3 plots, each
  `{label, min, lq, median, uq, max}` with every value `{value, show}`. `axis` is the same
  true-size scale as the grouped charts, `{min, max, step, stepMm, title}`. `bandMm` (even, 20
  to 40) is the height given to each plot; `line` is `none`, `line` or `arrow`. Without
  `boxplot` a box plot starts with one empty band on a 0 to 100 scale, never made-up data.
- **Pupil states:** a plot with every value blank is an empty band for pupils to draw a whole
  plot. A hidden value leaves its 1 cm line, and every part that needs it (a quartile's whisker
  and the box), for pupils; each part prints only when every value it needs prints. Answers
  copies draw the hidden parts in pink at the same size.
- **Validation:** values must be numbers inside the scale and in order (smallest, lower
  quartile, median, upper quartile, largest); the scale must end on a 2 mm grid line; the plot
  fits 18 cm. A plot with only some of its values gets a note, not an error.
- **Editor:** Box plots and Scale and graph paper cards replace the Data and axes cards. Clicking
  a plot focuses its median; + and − beside the diagram add or remove the last plot. "Hide this
  plot" hides all five values of one plot.
- **Examples:** June 2017 3H Q9 (compare two box plots, the second hidden) and November 2017 1H
  Q12 (draw a box plot for Year 11 beside Year 7).

## Stem-and-leaf diagrams

Edexcel prints stem-and-leaf diagrams as 1 cm rows with thin rules between them, a stem column
left of one vertical line, single-digit leaves spaced along each row, and a boxed key (measured
on November 2017 1F Q10, June 2018 3F Q14, June 2025 1F Q18 and November 2024 3H Q6). Questions
that ask pupils to draw one print empty ruled rows and an empty "Key:" box.

- **Settings:** `stemleaf {rows, key, leafMm}`. `rows` holds 1 to 12 rows, each
  `{stem, leaves, stemShow, leavesShow}`; `leaves` is single digits as typed ("2 3 3 4 5" or
  "23345"). `key` is `{stem, leaf, represents, show}` and prints Key: 1 | 2 represents 12 points;
  `show` is `show`, `hidden` (an empty Key: box for pupils, the key kept as the answer) or
  `none`. `leafMm` (20 to 120) is the width of the leaves column. Without `stemleaf` a diagram
  starts as three empty ruled rows and an empty key box, never made-up data.
- **Pupil states:** a blank row is an empty ruled row. A row's stem and its leaves hide
  separately and leave their space for pupils; answers copies print them in pink. A hidden key's
  box is as wide as its answer, so both copies are the same size.
- **Never calculated:** leaves print as typed and are never sorted (a note says when a row is
  out of order, for "spot the mistake" questions); the tool never builds a diagram from raw data.
- **Validation:** each leaf is one digit; stems are numbers or blank; a printed key needs its
  stem, leaf and words; every row's leaves must fit the leaves column; the diagram fits 18 cm.
- **Editor:** Stems and leaves (a row table with Hide Stem and Hide Leaves) and Key and size
  cards replace the Data and axes cards. Clicking a row focuses its leaves; + and − beside the
  diagram add or remove the last row.
- **Examples:** November 2017 1F Q10 (read a printed diagram) and June 2025 1F Q18 (draw one:
  the ordered diagram and key are saved as hidden answers).
- **Not included:** back-to-back stem-and-leaf diagrams (none in the bank's papers).

## Time series graphs

Edexcel prints time series graphs on true-size 2 mm graph paper under arrowed axes, with the
times equally spaced along the horizontal axis from the corner (the first time sits on the
vertical axis), crosses joined by straight lines, and the year printed once under its run of
quarters (measured on Mock Set 4 3F Q7 and June 2019 3F Q27). Construct questions print the
labelled grid only.

- **Settings:** `timeseries {points, slotMm, xTitle, yAxis}`. `points` holds 1 to 24 times, each
  `{label, group, value, show}`: `label` prints under the time (Jan, 1, Mon), `group` (such as a
  year) prints once under its run of equal groups, and `value` is a number as typed or blank.
  `slotMm` (an even number of millimetres) is the space between times; `yAxis` is the shared
  graph-paper axis (`min`, `max`, `step`, `stepMm`, `title`). Without `timeseries` a graph
  starts as twelve months with no values on a 0 to 60 axis, never made-up data.
- **Pupil states:** a blank value is no point and breaks the line; 0 is a value. A hidden value
  leaves its cross and both lines to it for pupils to plot (a line prints only when both its
  crosses print, so it never gives a hidden value away); answers copies print them in pink at the
  same size. Hide every value for a "draw the graph" question.
- **Never calculated:** values are plotted as typed; no trend line, moving average or
  prediction is drawn.
- **Validation:** values are numbers inside the vertical axis; labels fit the space between
  times; the graph fits 18 cm by 26 cm.
- **Editor:** Times and values (label, group, value and Hide per time, with Label as months,
  quarters or days buttons that change only the labels) and Axes and graph paper cards replace
  the Data and axes cards. + and − beside the graph add or remove the last time.
- **Examples:** Mock Set 4 3F Q7 (read monthly gas use from a printed graph) and a quarterly
  sales construct task in the style of the papers (every value saved as a hidden answer).
- **Two series:** `second` draws a dashed second series from each time's `value2` (hidden
  separately with `show2`) and a key beside the graph names both (`names`).
- **Hidden labels:** `labelShow: hidden` leaves a time's label for pupils to write; answers
  copies print it in pink. A blank label is a missing label.
- **Misleading graphs** (June 2019 3F Q27): a vertical axis that starts above 0 prints without a
  zig-zag unless `yBreak` is on (the corner is then labelled 0); `join: curve` joins the points with
  a curve; `bridge` joins across a time with no value, as when a quarter is missing. Notes name
  each misleading feature.
- **More examples:** two shops' quarterly sales with a key, and June 2019 3F Q27 (axis from 6,
  quarter 1 missing, a curve).

## Line weight (U111)

Lines are normal or bold (the Lines control beside Chart height). Bold multiplies the bars, line-chart lines, axes, ticks and key strokes by 1.5. The grey grid keeps its weight, so the grid never competes with the data. Bold is saved as `lines: "bold"`; normal is never saved. A new chart starts with the house style's lines. The connector takes `lines` in `presentation` (create spec and `set_presentation`).

## Not yet included

Horizontal bars, a printed data table beside the chart, comparative pie charts of different sizes and back-to-back stem-and-leaf diagrams. Each is a separate,
reviewed extension or tool.

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
  (`radiusMm`, `labels`) and `presentation.pictogram` (`symbol`, `symbolMm`, `key`, `unit`), `presentation.scatter`
  (`points`, `xAxis`, `yAxis`, `grid`, `minor`, `bestFit`, `readings`) and `presentation.grouped`
  (`variable`, `inequality`, `classes`, `xAxis`, `table`, `histogram`, `polygon`, `cumulative`),
  `presentation.boxplot`, `presentation.stemleaf` and `presentation.timeseries` (`points`, `slotMm`,
  `xTitle`, `yAxis`) merge field by field with the current settings (axes and each kind's settings too); a given
  `points`, `classes` or `rows` array replaces them all.
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
