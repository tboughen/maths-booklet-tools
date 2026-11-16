# Graph tools for exam questions

Started 16 November 2026. Tim (11:57) asked for the missing tools to be built before worked
solutions go to every paper in the Question Bank. This file records the graph part of that list
(`/mnt/project-files/worked-solutions/tools-needed-for-all-papers.md`): transformations on the
Graph tool (101 parts), real-life and travel graphs (120) and curve work in Plotting quadratics
(148). Each upgrade is its own small pull request.

## Shared with the worked-solution engine

The worked-solution engine (`packages/worked-core`) draws over the printed question in graph
units. To keep one copy of the geometry and the look, graph-core holds the shared pieces and
worked-core imports them:

| Piece | Where | What |
|---|---|---|
| `transformPoint`, `transformVertices`, `imageObjects`, `enlargementRays`, `describeTransformation`, `parseMirrorLine` | `packages/graph-core/src/transform.ts` | Exact images under translation, reflection (any line y = mx + c or x = k), rotation (90°, 180°, 270° either way about any centre) and enlargement (any nonzero scale factor, fractional or negative). Corner i maps to corner i. |
| `smoothCurveSegments`, `smoothCurvePath` | `packages/graph-core/src/curve.ts` | A smooth curve through every given point (uniform Catmull-Rom as cubic Béziers), in any units. |
| `arrowheadPath`, `arrowTip`, `arrowheadCorners` | `packages/graph-core/src/arrow.ts` | Filled arrowheads at the end or centred on the middle of a segment. |
| `VECTOR_ARROWHEAD_POINTS`, `READING_ARROWHEAD_POINTS`, `WORKING_DASH_POINTS` | `packages/graph-core/src/graphStyle.ts` | Vector heads 7 pt long and 6 pt wide; reading-line heads 6 pt by 5.2 pt; working dashes 4 pt on, 3 pt off. |

Nothing here runs by itself. An image, a vector or a construction is drawn only when a teacher
or a caller asks for it, so a pupil's answer is never drawn for them.

## Transformations and vectors (Graph tool)

- **Images.** Select a shape and use *Draw an image of this shape*: translate (across, up),
  reflect (type the mirror line as printed, such as `y = x`, `x = 2` or `y = −x + 1`), rotate
  (centre, 90°/180°/270°, clockwise or anticlockwise) or enlarge (centre and scale factor, such
  as 2, 1/2 or −2, with optional dashed rays from the centre). The image is added as an ordinary
  shape with exact corners, named A′ after A (or the next free letter), shaded like the original,
  and hidden on the pupil copy unless the teacher unticks *Answer only*. Undo removes it in one
  step. It does not follow later edits to the original.
- **Connector.** `{kind: "image", of, transformation, name?, shaded?, answerOnly?, rays?}` in a
  spec or an `add_object` revision makes the same polygon (and rays). The saved file holds only
  the result: there is no "image" kind in a saved graph. Rays are saved as `<image id>-ray-n`
  segments; replacing the image with `replace_object` removes them.
- **Vectors.** A segment takes `arrow: "end" | "middle"`, pointing from its start to its end.
  The middle head is centred on the part of the segment that prints, as exam vector diagrams
  print it. An end head needs the end point on the grid; otherwise it is left off and the
  connector warns. Arrowheads scale
  with bold lines and print in the answer colour on hidden answers. Full lines cannot carry one.
- **Centres and mirror lines** use what was already there: a named point prints as a cross, and
  a mirror line is a line, with its equation printed only when the question prints it.

The connector's graph capabilities budget rose from 26,900 to 32,400 bytes for these schemas
(see `services/graph-mcp/catalogue-budget.json`).

## Real-life and travel graphs (Graph tool)

- **Graphs through points.** *Graph through points* adds a `curve` object: 2 to 40 points in
  order, joined by straight pieces (a travel graph, a conversion graph) or, with *Smooth curve*,
  a smooth curve through every point (a velocity–time graph, a printed curve read off a paper,
  a sketch of y = f(x)). It can be dashed, named (C) and hidden as an answer, so "complete the
  travel graph" is a visible curve plus an answer-only curve. Arrow keys move the whole graph.
- **Reading lines.** *Reading lines* adds a `reading` object at a point: dashed legs to the axes
  (to where the axes cross, so a travel graph starting at 13 00 reads to its own axis) with a
  filled head where the value is read. "y value" goes up from the x-axis and across to the
  y-axis; "x value" goes the other way; "Both" drops to each axis with two heads. It has no name.
- **Axis letters.** An axis takes `name`, one letter such as t or v, printed in italic at the
  arrow. Unlike a title, it does not replace the letter; with both, the letter sits at the
  arrow and the title beside the axis, as velocity–time graphs print them.
- **Connector.** `{kind: "curve", points, smooth?, strokeStyle?, name?, answerOnly?}`,
  `{kind: "reading", at, read: "x" | "y" | "both", answerOnly?}` and `axes.x.name`. The graph
  capabilities budget rose to 35,400 bytes (measured 33,724).

## Curve working and circles (Graph tool)

For tangents and gradients, area under a graph and circles x² + y² = r², drawn on a graph
through points. Each is added as ordinary saved objects in one undo
step, and the editor ticks "Answer only" by default, so nothing appears on a pupil copy unless
the teacher unticks it.

- **Tangents.** With a graph through points selected, *Working on this graph* takes an x value
  and *Draw tangent* adds a segment touching the graph there, reaching 2 squares each side. The
  gradient comes from the curve itself: the slope of the straight piece (the right-hand piece at
  a corner) or of the smooth curve at x. A tangent is a normal segment, so it takes a gradient
  triangle with values or blank labels.
- **Trapezium strips.** *Draw strips* adds 1 to 10 equal-width trapezia from one x value to
  another, down to the x-axis (where the axes cross), as shaded shapes (the connector names them
  `…-strip-n`). Their top corners sit on the graph, so the strip tops are chords, as pupils draw
  them. A strip whose ends sit either side of the x-axis, or that lies along it, is refused with
  the reason.
- **Circles.** *Add circle* adds a `circle` with a centre and a radius in x units. It is drawn
  true to both scales (an ellipse when the axes use different scales), can be dashed, named and
  hidden as an answer, and moves with the arrow keys. A circle partly off the grid gets a warning.
- **Connector.** `{kind: "circle", centre, radius, strokeStyle?, name?, answerOnly?}` is saved;
  `{kind: "tangent", of, x, run?, gradientTriangle?, answerOnly?}` is resolved into a segment and
  `{kind: "strips", of, from, to, count, shaded?, answerOnly?}` into polygons when the graph is
  created or revised, so saved files only hold ordinary objects. The graph capabilities budget
  rose to 39,000 bytes (measured 37,159).
