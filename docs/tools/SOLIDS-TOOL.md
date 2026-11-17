# 3D solids

The `solids` diagram family draws 3D solids as the Edexcel papers do: prisms (cuboids, triangular and other
prisms), pyramids and frustums, cylinders, cones and frustums of cones, spheres and hemispheres. Each can be drawn
alone or joined to others, with hidden edges dashed. It was added on 16 November 2026, after
[geometry figures](FIGURES-TOOL.md), as one of the tools the worked-solution redraws need
(`/mnt/project-files/worked-solutions/tools-needed-for-all-papers.md` lists 88 question parts on 3D solids beyond
cuboids).

Code: `packages/solid-core` holds the schema, the projection, hidden-edge work, label placement, teacher notes, the
SVG and the examples. Its `interchange.ts` is the connector adapter. MCP access is the `solids` kind of the generic
tools, and solids can be placed in worksheets and booklets. The website editor is `src/solids/SolidsPage.tsx` at
`/tools/solids`, and the connector returns an editor link to it.

The [cuboids](CUBOID-TOOL.md) tool stays as it is: it draws cuboids made of unit cubes, with layers, for counting
volume. This family draws the plain line drawings that exam questions use.

## Document

Sizes are mm in 3D: x across, y up and z towards you (so "back" is negative z). Everything stays within 120 mm of
the origin.

- `solids` (1 to 4). Each has an `id` of 1 to 3 lower-case letters, which names its corners and centres:
  - `prism {at, section, length, axis}`: a cross-section of 3 to 12 corners, anticlockwise, carried `length` mm along
    its axis. With axis z the section faces you and runs back. With axis x the section is the left end and runs right.
    With axis y the section is the bottom and runs up. Its corners are `id1..idn` at the start and `idb1..idbn` at the
    end. A cuboid is a prism with a rectangle section.
  - `pyramid {at, base, apex, top}`: a base of 3 to 12 corners (x across, y going back) and an apex offset from `at`.
    `top` from 0.1 to 0.9 cuts it to a frustum. Its corners are `id1..idn`, with the apex `idt` or a frustum top
    `idb1..idbn`.
  - `cylinder {at, r, h, axis}` and `cone {at, r, h, top, axis}`: base centre `ido`, top centre or apex `idt`. A cone
    with `top` above 0 is a frustum with that top radius.
  - `sphere {at, r, equator}`: centre `ido`. The equator is optional, with its back half dashed.
  - `hemisphere {at, r, flat}`: the middle of the flat face `ido`. The flat face can be up (a bowl, or a base for a
    cone) or down (a dome).
- `points` (up to 20): extra points `{id, place, show}`. A place is `at {x, y, z}`, `along {a, b, t}` (t = 0 at a, 1 at
  b) or `rim {solid, end, deg}` on a round solid's base or top rim. On an upright solid (axis y), deg goes round
  from the right: 90 is the back and 270 is nearest you. On axis z, 0 is the right and 90 the top; on axis x, 0 is
  the back and 90 the top.
- `names`: the letters printed beside points, `{id, text}`, in italic capitals as in the papers.
- `lines` (up to 20): extra straight lines between points, solid, dashed or dotted, such as heights, diagonals and
  radii.
- `dims` (up to 12): lengths, `{id, a, b, kind, offset, gap, side, label}`. A `beside` length puts its label beside the
  edge. An `arrow` length draws a double-headed arrow `offset` mm from the line, with the label beside it or in a gap
  in the arrow (`gap`), as the papers do for cylinders and cones. `side` is left or right looking from a to b; `auto`
  puts the label outside the solid.
- `angles` (up to 8): `{id, at, from, to, mark, label}`. The mark is an arc, a right-angle mark (drawn as a square in
  the plane of the angle) or nothing.
- `view`. `oblique {angle, scale}` keeps the front face true shape and draws depth at the angle (45 is up and right)
  and scale; it suits prisms and cuboids. `turned {turn, tilt}` is an exact parallel view; a tilt of 10 to 20 shows a
  cylinder's or cone's top as the papers do.
- `hidden`: `dashed` (the default) or `none`.
- `notToScale`: prints "Diagram NOT accurately drawn" and is on by default.
- `fontPt` and `weight`: the U111 overrides, text 10 to 14 pt and bold lines. 11 pt and normal lines are not saved.

Clashing ids, missing points, flat bases, points on a rim that is not there and loops are refused, and the message
names the cause.

## Hidden edges

Every face of a prism or pyramid faces toward or away from the viewer. An edge is hidden when both of its faces face
away. On a round solid the outline is worked out exactly from the view. Each rim shows its front half, and shows
whole when its flat face can be seen and nothing covers it. A rim that two solids share is drawn once: for example, a
cone on a hemisphere of the same radius, or a hemisphere's flat face under a narrower cone.

Each face's outward direction comes from how the solid is built, not from its middle, so a non-convex cross-section,
such as an L-shaped prism, dashes the right edges.

Limitations: hidden edges are worked out within each solid, so one solid never hides another's edges. Joined solids
should be placed so that they meet rather than overlap in the drawing, as they do in the papers. Two prisms or
pyramids that share a face (a pyramid on a cuboid) both draw that face's edges, so an edge one of them would dash can
show solid; check such drawings. A round solid's flat face on a prism face is handled. Very non-convex sections can
hide part of themselves in a way face directions alone do not show.

## Labels and answers

The label states are the same as in the other geometry tools: `value` (given), `symbol` (a letter), `blank` (nothing
printed), `answer-line` and `hidden`. A saved `answer` prints only on the answers copy, in the house answer colour,
and a `value` never holds one. Angle labels take a degree sign (35°, x°). Both copies share one layout, sized for the
wider text. Nothing is ever calculated or filled in, and the examples carry no answers.

## Drawing

- Lines are 0.26 mm and marks 0.2 mm. Dashed lines are 1.2/0.9 mm and dotted lines are round dots.
- Labels are 11 pt STIX Two, point names are italic, and "Diagram NOT accurately drawn" is 10 pt.
- Arrowheads are filled. Angle arcs are 5 mm, and larger for narrow angles.
- Labels sit at the nearest clear place beside their line. A label with no clear space is an export issue.

Teacher notes (never printed) flag a right-angle mark on an angle that is not square in the solid, and two points
with the same name.

## Editing

- Click a length, an angle or a corner on the preview, or choose any object (solids too) in the Selected object card.
- A solid's card changes its type (keeping its radius, height and direction where the new type has them), position,
  sizes, cross-section or base corners (typed as pairs, such as `0 0, 30 0, 30 20`), apex and frustum cut.
- Changing type removes anything on corners or rims the new type does not have, says so, and Undo brings it back.
- A corner's card names it. An extra point's card also places it.
- The View card switches between the two views and sets the angle, scale, turn and tilt, and turns dashed hidden edges
  on or off.
- "Add to the drawing" adds a length, a line, an angle at the middle point, a midpoint, a point on a rim, or another
  solid (placed to the right).
- Delete removes the selected object, and anything built on it, as one undo step. Escape deselects.

Examples (each redrawn from a Question Bank question in the same layout; the question's words stay in the question):

- triangular prism with an angle to the base (1MA1 June 2019 2H Q19)
- cuboid ABCDEFGH (June 2018 2H Q18)
- square-based pyramid with its height and slant height (June 2018 1H Q5)
- cylinder tank (June 2019 3H Q6)
- cone on a hemisphere (June 2019 1H Q15)
- narrow cone standing on a wider hemisphere (Mock Set 6 3H Q18)

## Connector

`spec`: `{example?, solids?, points?, names?, lines?, dims?, angles?, settings?}`. Labels default from their text: a
digit makes a given value, letters alone a letter, an answer alone a hidden label. Revisions: `set_solid` (a whole
solid), `set_point`, `set_name`, `set_line`, `set_dim`, `set_angle` (only the fields given change), `remove` and
`set_settings`. All operations apply together and the result is checked once. Set operations run before removes, and
removes in one revision work in any order. Removing something still in use is refused, with its users named.
