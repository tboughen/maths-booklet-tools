# Geometry figures

The `figures` diagram family draws general exam-style geometry figures: circles with chords, radii and tangents
(circle theorems), similar and congruent shapes, parallel lines inside shapes, and figures for geometric proof. Added
16 November 2026 as the first of the tools the worked-solution redraws need
(`/mnt/project-files/worked-solutions/tools-needed-for-all-papers.md`: circle theorems 42 question parts, similar
shapes 71).

Code: `packages/figure-core` (schema, constructions, label placement, teacher notes, SVG, examples) and its
`interchange.ts` connector adapter. MCP access is the `figures` kind of the generic tools; figures can be placed in
worksheets and booklets. The website editor is `src/figures/FiguresPage.tsx` at `/tools/figures`, and the connector
returns an editor link to it.

It is one generic family rather than more options on the triangle or angle tools: those draw fixed figures (a
triangle, a set of rays, a polygon), while a bank diagram needs any number of points, lines, circles and marks.

## Document

Everything is built from points. Other objects refer to points by id (lower-case letter then up to 7 letters or
digits). Coordinates are mm with y up, within 150 mm of the origin.

- `points` (1 to 40): `{id, place, name, show}`. `name` is the letter printed beside it (up to 3 characters, italic
  capitals as in the papers); `show` is none, a dot (a circle's centre) or a cross. `place` says where it goes:
  - `free {x, y}`;
  - `on {circle, deg}`: on a circle, deg anticlockwise from the right of its centre;
  - `along {a, b, t}`: on the line through a and b (t = 0 at a, 1 at b; below 0 or above 1 is beyond the ends);
  - `meet {a, b, c, d}`: where line ab meets line cd;
  - `tangent {at, mm}`: mm along the tangent at a point on a circle (positive anticlockwise);
  - `tangents {a, b}`: where the tangents at two points on the same circle meet;
  - `foot {from, a, b}`: the foot of the perpendicular from a point to line ab.
  Points built on others move with them, so a tangent stays a tangent and a point on a chord stays on it. Loops,
  missing points, parallel lines that never meet and tangents at points not on a circle are refused with a message
  naming the point.
- `circles` (up to 4): `{id, centre, r (5 to 90 mm), style}`.
- `segments` (up to 60): `{id, a, b, style, extend [beyond a, beyond b] in mm, ticks 0-3, arrows 0-3, label, side}`.
  Ticks mark equal sides; arrows mark parallel sides and point from a to b. `side` puts the label left or right
  looking from a to b; `auto` puts it outside the shape.
- `angles` (up to 40): `{id, at, from, to, label, mark, shade}`. The angle sweeps anticlockwise from the arm to `from`
  to the arm to `to` (swap them for the other side). `mark` is none, a single, double or triple arc (matching angles in
  similar shapes), or a right-angle square. `shade` greys the sector.
- `fills` (up to 8): grey regions through points in order, drawn under every line.
- `captions` (up to 8): free text such as "Triangle A", optionally bold.
- `notToScale` ("Diagram NOT accurately drawn", on by default), and the U111 overrides `fontPt` (10 to 14, 11 not saved)
  and `lines` (bold only saved).

## Labels and answers

The label states are the angle and area tools': `value` (given), `symbol` (a letter), `blank` (nothing printed),
`answer-line` and `hidden`. A saved `answer` prints only on the answers copy, in the house answer colour; a `value`
never holds one. Angle labels take a degree sign whether they are numbers or letters (62°, x°), as the papers print
them; side labels print as typed (9 cm). Both copies share one layout sized for the wider text. Nothing is ever
calculated or filled in: the worked versions of the examples copy their answers from the question's mark scheme.

## Drawing (measured against Edexcel papers)

Lines and circles 0.26 mm (0.75 pt), marks 0.2 mm; dashed 1.6/1.1 mm; labels 11 pt STIX Two, point names italic,
"Diagram NOT accurately drawn" 10 pt. Arcs have a 5 mm radius (7 mm under 45°, 9 mm under 25°); a right-angle square
is 2.6 mm. Angle labels sit inside the angle, at the nearest clear spot; side labels sit outside the shape; point
names take the widest gap between the lines meeting at the point. A label with no clear space is an export issue.

Teacher notes (never printed): a right-angle mark more than 10° from square, and two points with the same name.

## Editing

Click a line, an angle or a point on the preview, or choose it in the Selected object card, which comes first after
the examples. Drag the round handles to move free points, points on circles (they stay on the circle, in 5° steps;
1° with Shift), points on lines and tangent ends; arrow keys move a focused handle. Delete removes the selected object
as one undo step, and also removes everything built on it (the message says how many; Undo restores them). Escape
deselects. "Add to the figure" adds a line between two points, an angle at a middle point, a circle round a point,
or a new point of any place type. Shading and captions are under their own heading.

Examples (each redrawn from a Question Bank question in the same layout; the question's words stay in the question):
tangent and cyclic quadrilateral, two tangents from a point, angle at the centre, similar right-angled triangles,
parallel lines in a triangle and "which triangles are congruent?".

## Connector

`spec`: `{example?, worked?, points?, circles?, segments?, angles?, fills?, captions?, settings?}`. Labels default
from their text: a digit makes a given value, letters alone a letter, an answer alone a hidden label. Revisions:
`set_point`, `set_circle`, `set_segment`, `set_angle`, `set_fill`, `set_caption`, `remove`, `set_settings`; set
operations merge into an existing object with the same id. Every set operation applies first, in order, then every
`remove`, and the result is checked once, so objects can arrive in any order. `remove` refuses a point or circle that
other objects are built on, naming them (the editor instead removes them too, with a message and Undo).

## Not yet supported

Arcs of circles other than whole circles (semicircles drawn as part of a figure), curved region fills, labels on
circles and arcs, dimension lines with arrows, 3D solids (the next family), and dragging points placed where lines
meet (edit their lines instead).
