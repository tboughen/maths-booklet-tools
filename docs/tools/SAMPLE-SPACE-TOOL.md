# Sample space diagrams

`/tools/sample-space` draws exam-style sample space diagrams: the outcomes of one event down the left, a second
event across the top and one cell for every pair, for two dice, spinners and coins. Improvement list P-3, built
15 November 2026 under the overnight rule (Tim reviews in the morning).

Code: `packages/sample-space-core` (schema, exact fills, layout, SVG, examples), `src/sample-space` (editor). MCP
access is the `sample-space` kind of the generic connector tools, adapted by
`packages/sample-space-core/src/interchange.ts`. The diagrams can also be placed in worksheets and booklets.

## Document

- `rows` and `columns` are the two events' outcomes (1 to 10 each, up to 12 characters; the default is two dice).
  `rowTitle` prints rotated down the left and `columnTitle` above the table; empty prints nothing. `corner` holds
  the sign of the combination (`+`, `×`, `−`) or nothing.
- Every cell is `{ text, show, ring? }`, up to 16 characters: numbers (stacked fractions), or text such as `H3` or
  `(H, 3)`. Empty text is a pupil blank; a hidden cell is a saved answer printed only on the answers copy, in dark
  pink. `ring: true` circles a chosen outcome, in black and white;
  `ring: "hidden"` circles it only on the answers copy (pupils circle it). A blank cell cannot be circled.
- `cellMm` (10 to 30), `lines: "bold"` (U111) and `intentionalError`.

## Explicit actions only

**Fill empty cells** puts the sum, product, positive difference or `(row, column)` pair in every empty cell,
exactly (fractions stay fractions, decimals stay decimals), hidden by default; cells holding anything are kept.
An arithmetic fill puts its sign in an empty corner. With a `+`, `×` or `−` corner, any number that disagrees
with its outcomes adds a teacher note (never printed, never corrected) unless the diagram has a deliberate error.
