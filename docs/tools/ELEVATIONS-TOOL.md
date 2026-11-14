# Plans and elevations

The `elevations` diagram family draws solids made of centimetre cubes for Hanley GM8.08 (interpret plans and
elevations) and GM8.09 (construct a shape from its plans and elevations, including with scale). Added 14 November
2026 with the [construction family](CONSTRUCTION-TOOL.md).

Code: `packages/elevation-core` (height map, views, isometric projection, layout, SVG, examples) and its
`interchange.ts` connector adapter. MCP access is the `elevations` kind of the generic tools; drawings can be placed
in worksheets and booklets. The website editor (`/tools/elevations`) is a later step: until then `EDITOR_RELEASED`
is false and there is no editor link.

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

## Not yet supported

Prisms with sloping faces, cylinders, cones and pyramids (for example June 2017 2F Q19's trapezium prism) need true
3D faces and hidden-line rules. Tim was told this is much harder than cube solids and was recommended as a later
step.
