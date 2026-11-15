# Angle diagrams

The `angles` diagram family draws angle-facts diagrams (improvement list G-1, G-2 and G-3, one tool with five figures).
Added 15 November 2026.

Code: `packages/angle-core` (schema, geometry, label placement, teacher notes, SVG, examples) and its `interchange.ts`
connector adapter. MCP access is the `angles` kind of the generic tools; diagrams can be placed in worksheets and
booklets. The website editor is `src/angles/AnglesPage.tsx` at `/tools/angles`, and the connector returns an editor link
to it.

## Document

- `figure`, one of:
  - `straight-line`: 1 to 5 rays from a point on a straight line, by direction (5 to 175 degrees, anticlockwise from
    the right).
  - `point`: 2 to 8 rays round a point (0 to 360 degrees).
  - `crossing`: 2 or 3 straight lines through one point (0 to 179 degrees): vertically opposite angles.
  - `parallel`: 2 or 3 parallel lines with arrow marks (0 to 3 arrowheads), `gapMm` apart, cut by one transversal at
    `crossDeg` (20 to 160).
  - `polygon`: 3 to 10 sides, regular (`corners: null`) or irregular convex (`corners` in mm, anticlockwise), with
    `exterior` corners whose incoming side is extended, dashed `diagonals` from corner 1 and equal-side `ticks`.
- `angles`: the marked angles, by slot ID. Slots are fixed by the figure: `s1, s2 ...` anticlockwise between rays;
  `p<line>-<ur|ul|ll|lr>` at each parallel-line crossing (line 1 is the top line; ur is above the line, right of the
  transversal); `i<k>` and `e<k>` at polygon corners. An unlisted slot is not marked.
  Each has a `label` (`state`, `text`, `answer`), a `mark` (none, arc, double, triple, right) and `shade` (a grey
  sector for teaching pairs such as alternate angles).
- `names`: letters beside points (A, B, C ...), by point ID.
- `turnDeg`, `sizeMm`, `notToScale` ("Diagram NOT accurately drawn", on by default), and the U111 overrides
  `fontPt` (10 to 14, 11 not saved) and `lines` (bold only saved).

## Labels and answers

The label states are the triangle tool's: `value` (a given size, printed with a degree sign: 62°, 3x°,
(2x + 10)°), `symbol` (a letter, printed as typed), `blank` (the arc only), `answer-line` and `hidden`. Letters print
italic and minus signs are true minus signs. A saved `answer` prints only on the answers copy, in the house answer
colour, in place of the label; a `value` never holds one. Both copies share one layout sized for the wider text.
Nothing is ever calculated or filled in.

## Drawing

The drawing never has to match the numbers, so "Diagram NOT accurately drawn" stays honest. Labels sit just beyond
the arc on the angle's bisector, or off it but still inside the angle when a line (such as a diagonal) cuts through
the middle; a label with no clear space is an export issue. Small angles get a wider arc. Parallel-line arrows sit
at the same place on every line, away from the crossings. Labels print at 11 pt STIX Two (house minimum 10 pt), the
caption at 10 pt.

Teacher notes (never printed) name given sizes that cannot all be right: a straight line or point that does not add
to 180° or 360°, unequal vertically opposite or corresponding angles, a polygon's interior angle sum, an interior and
exterior pair, and a right-angle mark on an angle drawn far from 90°. Only plain numbers are checked; algebra is not.

## Editing

Click an angle (each has a round button on the preview) or choose it in the Selected angle card, which comes first
after the examples. Delete removes the selected angle's mark and label as one undo step; Escape deselects. Moving a
ray keeps it between its neighbours so labels stay with their angles; adding or removing a ray keeps each label on the
angle that starts at the same ray. Changing the figure drops labels the new figure lacks, says so, and Undo restores
them. The connector's `set_figure` refuses to drop labels unless `dropMissing: true`.

## Not yet supported

Two transversals, zig-zag (Z) shapes, parallel lines inside triangles and trapeziums, two regular polygons meeting at a
point, a reason answer line ("alternate angles are equal") inside the diagram (use the worksheet's answer lines),
dragging rays and corners on the preview, and concave polygons.
