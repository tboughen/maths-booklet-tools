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
  the result: there is no "image" kind in a saved graph.
- **Vectors.** A segment takes `arrow: "end" | "middle"`, pointing from its start to its end.
  The middle head is centred on the segment, as exam vector diagrams print it. Arrowheads scale
  with bold lines and print in the answer colour on hidden answers. Full lines cannot carry one.
- **Centres and mirror lines** use what was already there: a named point prints as a cross, and
  a mirror line is a line, with its equation printed only when the question prints it.

The connector's graph capabilities budget rose from 26,900 to 32,400 bytes for these schemas
(see `services/graph-mcp/catalogue-budget.json`).
