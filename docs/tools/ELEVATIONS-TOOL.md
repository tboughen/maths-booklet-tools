# Plans and elevations

The `elevations` diagram family draws solids made of centimetre cubes, or of prisms, pyramids, cylinders, cones and
spheres (below), for Hanley GM8.08 (interpret plans and
elevations) and GM8.09 (construct a shape from its plans and elevations, including with scale). Added 14 November
2026 with the [construction family](CONSTRUCTION-TOOL.md).

Code: `packages/elevation-core` (height map, views, isometric projection, layout, SVG, examples) and its
`interchange.ts` connector adapter. MCP access is the `elevations` kind of the generic tools; drawings can be placed
in worksheets and booklets. The website editor is `src/elevations/ElevationsPage.tsx` at `/tools/elevations`: a
height grid (front at the bottom, rows added at the back), the panel list (view, drawn/blank/answer, label, grid
size, order) and print settings. The connector returns an editor link to it.

## Document

- `heights[row][column]`: cubes on each square, row 0 at the front, column 0 at the left; up to 6 × 6 squares and
  6 cubes high.
- `panels` (1-6), printed left to right and wrapped at `maxWidthCm`: `isometric`, `plan`, `front` or `side`, each
  `drawn` (both copies), `blank` (empty grid only) or `answer` (empty grid for pupils, drawn on the answer copy),
  with a label (default Plan, Front elevation, Side elevation) and an optional empty-grid size in squares.
- `unitCm` (0.5, 1 or 2): printed cube edge on the cm-square grids. The isometric drawing uses 1 cm isometric paper;
  an empty isometric panel is plain sketching space, as in Edexcel "draw a sketch of the solid shape" (no 1MA1
  question from June 2017 to November 2021 uses isometric paper). `isoDots: true` puts dot paper behind isometric panels.
- The isometric drawing shows the top, front and left side; `arrows` mark Front and Side, and the side elevation is
  the view from the left.

Elevations follow the exam convention: the outline plus a line wherever the visible surface steps back (a change of
height on the plan, of depth on an elevation). Nothing is calculated; there are no answers beyond the hidden views.

## Solids made of shapes (28 November 2026)

Instead of `heights`, a document can give `shapes` (1-4, in grid squares; x across to the right, y back from the
front, z up; everything inside 0 to 12):

- `prism {at, section, axis, length}`: a cross-section of 3-12 corners carried along an axis. Axis `y`: the section
  is the front face (across, up) and runs back; `x`: the left end (back, up), running right; `z`: the base
  (across, back), standing up. Covers triangular, trapezium and L-shaped prisms, and cuboids.
- `pyramid {at, base, apex}`: a base of 3-12 corners (across, back) at the level of `at`, apex offset from `at`.
- `cylinder` and `cone {at, r, h, axis}`: the centre of the base at `at`; `sphere {at, r}`; `hemisphere {at, r,
  flat: down|up}`.
- `lengths` (up to 8): text such as "6 cm" printed beside the line between two corners on the 3D drawing, each
  shown or hidden (answers copy only).
- `hiddenLines`: left out by default, as on Edexcel elevations; `dashed` draws hidden edges dashed.

The engine (`packages/elevation-core/src/shapes.ts`) builds each shape as a closed polyhedron (round surfaces as 64
strips), draws sharp edges plus the outline of round surfaces, cuts every edge where another crosses it in the view,
and hides each piece that a nearer face covers. Shapes may touch face to face (a roof on a cube leaves no seam) but may not overlap: validation names the two shapes. A corner on a straight side is dropped, so it draws no false edge. A cone seen
along its axis gets an apex dot on the plan. Views sit on whole grid squares with one square spare.

In the editor, the Solid card's "Made of" switches between cubes and shapes (one undo step that starts the other
kind afresh). Each shape has its kind, position, sizes, direction and corners typed as pairs; lengths and the
hidden-line style follow. Examples: trapezium prism elevations (June 2017 2F Q19 style), side elevation of an
L-prism, cylinder from its views and a pyramid roof; plain shapes for a triangular prism, cylinder, cone and square
pyramid.
