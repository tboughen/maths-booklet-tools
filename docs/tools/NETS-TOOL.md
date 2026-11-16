# Nets of 3D shapes

The `nets` diagram family draws nets of cubes, cuboids, triangular prisms, square-based pyramids and tetrahedra for
Hanley GM2.07 (Year 7): "recognise and use nets of 3D shapes, e.g. when the net is folded where does the dot end
up". Added 16 November 2026 for the worksheets due before Christmas.

Code: `packages/net-core` (schema, presets, folding, layout, SVG, examples) and its `interchange.ts` connector
adapter. MCP access is the `nets` kind of the generic tools, so create_worksheet and create_booklet place nets like
any other diagram. The website editor at `/tools/nets` follows in its own pull request; until then
`EDITOR_RELEASED` is false and the connector returns no editor link.

## Document

- `nets` (1 to 6), printed side by side and wrapped at 260 mm. Each net has a `solid` (cube, cuboid,
  triangular-prism, square-pyramid, tetrahedron or other), a `caption` printed underneath ("A", "B", … for "which
  of these are nets of a cube?"), a panel `size` in grid squares (0 fits the net with a square to spare), `faces`,
  corner letters (`vertices`) and edge labels (`edges`, such as "4 cm").
- A face is a polygon in grid squares from the panel's top-left corner, with `show`, a `label` (a letter or word in
  the middle) and a `mark` (none, dot, cross or shade).
- `grid`: squares (default), dots or none; `unitCm` 1 (default) or 0.5. Lines follow exam parity: a 1 cm grid on its
  own is 1 pt grey, nets 1.5 pt black. Text is STIX Two at 11 pt, with a white patch behind it on a grid.
- Presets: the 11 cube nets (numbered 1 to 11, faces any whole number of squares across), the usual cuboid net, a
  prism on a right-angled triangle, a square-based pyramid and a tetrahedron (best on plain paper). Squares can also
  be placed one by one, so arrangements that are not nets can be drawn.

## Pupil and answer copies

A hidden face prints nothing for pupils, so "draw the net" leaves an empty grid and "complete the net" leaves gaps;
the answers copy draws it in the answer colour (#b0125b) with its label and mark. Hidden labels, marks, corner
letters, lengths and captions work the same way. Both copies have the same size, because the panel is sized from
every face, shown or hidden.

## Folding

Nets made only of rectangles (cubes and cuboids) are folded by `fold.ts`: each face carries a 3D frame, every fold
line must land in one place from both of its faces, and every face must cover one whole side of the box. The
results appear only as teacher notes (warnings): whether a net folds, which named faces end up opposite and which
corner letters meet. Nothing is filled in. "Where does the dot end up?" is the explicit `mark_opposite` operation,
which marks the opposite face as a hidden answer. Prisms, pyramids and tetrahedra are drawn but not folded.

## Not yet supported

Nets of cylinders, cones and other prisms; a picture of the folded solid beside the net (use the cuboid or 3D
solids tools next to it).
