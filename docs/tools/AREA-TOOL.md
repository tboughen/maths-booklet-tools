# Area and perimeter

The `area` diagram family draws area and perimeter diagrams (improvement list G-8 compound shapes and G-9 circles,
arcs and sectors, one tool). Added 15 November 2026.

Code: `packages/area-core` (schema, geometry, label placement, teacher notes, SVG, examples) and its `interchange.ts`
connector adapter. MCP access is the `area` kind of the generic tools; diagrams can be placed in worksheets and
booklets. The website editor is `src/area/AreaPage.tsx` at `/tools/area`, and the connector returns an editor link to
it.

## Document

- `shape`, one of:
  - `polygon`: 3 to 12 `corners` in mm (y up, anticlockwise, within 150 mm of the origin). Side k runs from corner k
    to corner k + 1. Each side's `arcs` entry is `none` (straight), `out` (a semicircle on the side, added to the
    shape) or `in` (a semicircle cut out of it). `heights` are dashed perpendiculars from a corner to the line of a side,
    with a right-angle mark at the foot and a dashed extension when the foot is beyond the side. `rightAngles` lists the
    corners with a right-angle mark.
  - `circle`: `part` full, semicircle, quarter or sector, `radiusMm` (10 to 80), `angleDeg` (sectors, 5 to 355,
    turning anticlockwise from the right), `line` (a whole circle's radius, diameter or none) and a `centre` dot.
- `hole`: null, a rectangle (`x`, `y`, `w`, `h`) or a circle (`x`, `y`, `r`) inside the shape, for frames, ponds and
  "a circle cut from a square". It must not cross the outline.
- `shaded`: none, `shape` (the shape less any hole) or `hole`. Grey, so it prints in black and white.
- `labels`: by place ID. `e1 ...` sides (on a semicircle side, beyond its arc; on a cut-out, in the space it leaves),
  `h1 ...` heights, `r`, `r2`, `d`, `angle` and `arc` on a circle, `hw`, `hh` and `hr` on the hole (a circle hole draws
  its radius only when `hr` is labelled) and `area` inside. An unlisted place prints nothing.
- `names`: letters beside corners (`v1 ...`) or a circle's centre and line ends (`o`, `a`, `b`).
- `grid` (light 1 cm squares at true size, lined up with the corners, for counting squares), `notToScale` ("Diagram
  NOT accurately drawn", on by default) and the U111 overrides `fontPt` (10 to 14, 11 not saved) and `lines` (bold
  only saved).

## Labels and answers

The label states are the angle tool's: `value` (a given length, printed as typed with its units: 8 cm), `symbol` (a
letter, italic), `blank` (nothing printed: a missing side), `answer-line` and `hidden`. A saved `answer` prints only on
the answers copy, in the house answer colour, in place of the label; a `value` never holds one. Answers are text, so
"25π cm²" stays exact. Both copies share one layout sized for the wider text. Nothing is ever calculated or filled in.

Label text is typeset: single letters italic (but not `m`, `g` or `l` after a number), units, words and point pairs such as AB upright; a
true minus sign, `^2` as ², `pi` as π, and `a/b` as a stacked fraction (so the label is taller). The centre angle of
a sector prints with a degree sign (110°, x°).

## Drawing

The drawing never has to match the numbers. Each label sits just clear of its side or line, moving outwards (and
sliding along the side) until it touches no line and no other label; the area label takes the roomiest clear place
inside the shape. A label with no clear space is an export issue. Labels print at 11 pt STIX Two (house minimum 10
pt), the caption at 10 pt.

Teacher notes (never printed) name lengths that cannot all be right: on a rectilinear shape, the sides going one way
not adding up to the sides going back (or a missing side that would have to be zero or negative); a sector's or
quarter circle's two unequal radii; a quarter circle's angle that is not 90°; and, with the grid on, corners off
the half-centimetres. Only plain numbers (with or without a unit) are checked.

## Editing

Click a place on the preview (each has a round button) or choose it in the Selected label card, which comes first
after the examples. Delete removes the selected label as one undo step; Escape deselects. "Start from" changes the
shape to a preset (rectangle, L, T and U shapes, triangle, parallelogram, trapezium, rectangle and triangle,
rectangle and semicircle, rectangle with a semicircle cut out, frame, circle, semicircle, quarter circle, sector);
labels the new shape has no place for are dropped, the message says so and Undo restores them. Width and height
stretch a polygon and its hole from its bottom-left corner (up to 150 mm). The corners table edits corners, sides (straight or semicircle) and right-angle marks;
heights have their own rows. The connector's `set_shape` refuses to drop labels unless `dropMissing: true`.

## Connector

`spec`: `{example? | preset?, shape?, hole?, labels?, names?, settings?, worked?}`. A polygon can be given as
`corners` or as `outline` moves (`right`, `up`, `left`, `down` with a length in mm, from the bottom left going right
first; the last move must bring the outline back to its start). Labels default from their text: a digit makes a given
length, letters alone a letter, an answer alone a hidden label. Revisions: `set_shape`, `set_label`, `remove_label`,
`set_name`, `set_settings`.

## Not yet supported

Segments and chords, tangents and labelled circle parts, quarter circles on a corner of a polygon, trapezium and
triangle shapes with semicircles on slanting sides that need a different radius, algebraic side lengths with
automatic checks (A-15: algebra prints but is not checked), dashed lines splitting a compound shape into rectangles,
dimension lines with arrows, italic products of letters such as xy (they print upright), dragging corners on the preview, and turning a whole circle's radius line.
