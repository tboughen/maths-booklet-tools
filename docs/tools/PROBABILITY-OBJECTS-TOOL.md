# Spinners, dice and bags

`/tools/probability-objects` draws the objects probability questions are about, as Edexcel papers draw them:
spinners, dice and bags of counters, up to four side by side ("Here is a fair ordinary dice and a fair 8-sided
spinner"). Built 16 November 2026 for the before-Christmas A3 worksheets (SP3 single-event probability; also SP5
and SP7), whose SP3.04 draft had to fake spinners with 50 mm pie charts. Statistics and probability strand.

Code: `packages/probability-objects-core` (schema, layout, SVG, examples), `src/probability-objects` (editor).
Labels use the shared maths-text helper from function machines (STIX Two, stacked fractions). MCP access is the
`probability-objects` kind of the generic connector tools (`diagram_capabilities`, `create_diagram`,
`revise_diagram`), adapted by `packages/probability-objects-core/src/interchange.ts`. Objects can be placed in
worksheets and booklets through the diagram registry.

## Document

- `objects` (1 to 4), left to right, sharing a middle line. Each has an `id`, a `type` and an optional `caption`
  printed underneath ("Spinner A"; empty prints nothing).
- **Spinner**: `shape` `circle` or `polygon` (a regular polygon with one side per sector, equal sectors only, as
  the 4-sided and 8-sided spinners on recent papers); 2 to 12 `sectors`, each `{ label, fill, angle }`. `angle` is
  in degrees, or null to share what the given angles leave equally; all null is a fair spinner. Angles that do
  not make 360° are refused. `rotation` (where the first sector starts) and `pointerAngle` are degrees clockwise
  from 12 o'clock. `pointer` is `arrow` (from the centre, circles on older papers), `stick` (the thick wedge and
  thin end of the stick the spinner turns on) or `none`. `rightAngles` marks every 90° sector at the centre, as
  June 2024 2F Q11 does. `sizeMm` 25 to 80 (default 40). Sector labels sit part way out along the middle of each
  sector, further out in narrow sectors; a teacher note says when a label cannot fit.
- **Dice**: `view` `cube` (front, top and right faces, in that order; pips on the slanted faces are drawn as
  ellipses) or `faces` (1 to 6 flat faces in a row). `marks` `pips` (the numbers 1 to 6 print as pips; anything
  else prints as written) or `numbers`. `sizeMm` 12 to 30 (default 18). A teacher note flags an impossible ordinary
  dice: the same number twice, or opposite faces (1 and 6, 2 and 5, 3 and 4) both showing.
- **Bag**: a drawstring bag holding 1 to 6 `groups` of counters, each `{ label, fill, count }`, at most 40
  counters, laid out by group. Counters grow to fit their label.
- `fill` is `none`, `grey`, `hatched` or `dotted`, so colours stay readable in black and white. Colours are written
  as words or letters (Red, R); a hatched or dotted sector or counter puts a white patch behind its label.
- `lines: "bold"` from the house style.

## Blanks and answers

Every label is `{ text, show }` with at most 12 characters. Empty text on a spinner or dice is a pupil blank: a
dotted line, unless the object's `emptyLabels` is `none` (an unlabelled shaded spinner). An empty bag label is a
plain counter. A hidden label is a saved answer: pupils see the blank and the answers copy prints it in dark pink
(pips too). Answers take their own room on both copies, so pupil and answer copies are the same size. Nothing is
ever worked out, filled or corrected.

## Examples

Fair 4-sided spinner (June 2017 1F Q6, June 2023 3F Q7), six equal sectors with an arrow (Mock Set 5 1F Q5),
sectors of different sizes with a right angle (June 2024 2F Q11), a dice and an 8-sided spinner (June 2023 2F Q15),
a bag of counters, a spinner for pupils to label, two captioned spinners and the faces of a dice in a row. The
numbers and labels are our own; the papers are in the Question Bank.
