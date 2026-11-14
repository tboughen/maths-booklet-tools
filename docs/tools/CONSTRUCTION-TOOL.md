# Constructions, loci and bearings

The `construction` diagram family draws ruler-and-compasses constructions, loci, scale drawings, maps and
bearings at true size, for Hanley unit GM8 "Visualising and constructing" (GM8.01-07 and GM8.10-13). Tim asked for
it on 14 November 2026 ("work on GM8's drawing tools now in parallel"). Plans and elevations (GM8.08-09) are a
separate family that comes later.

Code: `packages/construction-core` (schema, geometry, explicit construction helpers, layout, SVG, examples) and
`packages/construction-core/src/interchange.ts` (connector adapter). MCP access is the `construction` kind of the
generic connector tools (see [the diagram registry](DIAGRAM-REGISTRY.md)); drawings can be placed in worksheets and
booklets. **The website editor (`/tools/construction`) is the next step**: until it ships, `EDITOR_RELEASED` is
false, the connector returns no editor link, and drawings reopen from their JSON envelope.

## Physical size

Coordinates are centimetres, y upwards, origin at the bottom-left of the drawing area (`width` × `height`, 2-26 by
2-30 cm). One document centimetre prints as one centimetre, so pupils can measure and construct on the sheet. The
whole drawing area is always printed, whatever it contains, so there is room to construct; worksheets never shrink
it (a too-wide drawing is an issue that names widthCm). `grid: "cm"` adds centimetre squares; `border` frames the
area; `caption` prints in a box underneath ("Scale: 1 cm represents 4 km."), as on Edexcel papers.

## Document

- `points`: crosses (or dots, or nothing) with italic labels placed automatically away from their lines, or at a
  chosen compass position.
- `objects`: `segment` (with `extend` beyond each end for lines and rays, dashed, a label such as "7 cm"), `arc`
  (centre, radius, start and sweep in degrees anticlockwise from east; 360 is a circle), `angle` (arc or right-angle
  mark with a label), `north` (north line with arrow and N), `bearing` (clockwise arc from north with a label such
  as "070°", optionally with its own north line), `polygon`, `text` and `region`.
- A `region` hatches (or cross-hatches) the points meeting every rule: within or beyond a distance of a point or
  segment; closer to one point (or segment) than another; inside or outside a polygon. Hatching is computed line by
  line at 2.5 mm spacing and is never solid fill, so it prints in black and white and needs no SVG clipping.
- Every point and object has `role`: `given` prints on both copies; `answer` is a saved answer printed only on the
  answers copy. Labels also have `show`/`hidden`, so a given segment can keep its length as a hidden answer. Blank
  (empty shown label) and hidden stay distinct.

## Explicit actions only

Nothing is constructed, measured or shaded implicitly. The helpers add one group each (removable as a group) and
default to `answer`, so the pupil copy shows only the starting lines:

- perpendicular bisector (four compass arcs and the line; the default radius is shortened so the arcs stay in the
  drawing), angle bisector, perpendicular from a point to a line, perpendicular at a point on a line;
- locus a fixed distance from a point (circle) or a segment (parallel lines and semicircles);
- point by bearing and distance;
- measure a segment (in a scale's units), an angle or a bearing into its label.

A construction that reaches outside the drawing is an export issue naming the group.

## Examples

`perpendicular-bisector`, `angle-bisector`, `perpendicular-from-point`, `perpendicular-at-point`,
`locus-segment`, `map-equidistant` (June 2017 2F Q16, `1MA1_JUN_2017_2F_Q16`), `bearings-port` (November 2019 1H
Q8, `1MA1_NOV_2019_1H_Q8`) and `loci-garden`. Each has a pupil copy and a worked copy, frozen in
`src/gates/corpus/2026-11-14/constructions/`.
