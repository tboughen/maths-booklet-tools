# Factor trees

`/tools/factor-tree` draws exam-style factor trees: a number split into two factors at a time, down to circled
primes, with an optional "360 = ……" answer line beneath. Up to three trees sit side by side, for "two different
trees for the same number". Improvement list N-5, built 15 November 2026 under the overnight rule (take the
recommended option on small choices; Tim reviews in the morning).

Code: `packages/factor-tree-core` (schema, completion, layout, SVG, examples), `src/factor-tree` (editor). MCP
access is the `factor-tree` kind of the generic connector tools (`diagram_capabilities`, `create_diagram`,
`revise_diagram`; see [the diagram registry](DIAGRAM-REGISTRY.md)), adapted by
`packages/factor-tree-core/src/interchange.ts`. Factor trees can also be placed in worksheets and booklets.

## Document

- `trees` (1 to 3). Each tree's `nodes` is a flat list: the number first (`parent: null`), then its splits, every
  parent listed before its children. Every number has exactly two branches or none; up to 8 levels and 31 numbers.
- Every number is `{ text, show }`: whole numbers of up to 7 digits. Empty text is a pupil blank (dotted line or box,
  `blankStyle`). A hidden number is a saved answer: pupils see the blank, the answers copy prints it in dark pink.
- `circled: true` circles a number. A hidden number's circle is part of the answer and prints only on the answers
  copy; a circled blank prints as an empty circle (a "this is prime" scaffold).
- `product` is the answer line, or null. Its text is a product of powers saved as `2^3 × 3^2 × 5` (typing `x`, `*`
  or superscripts works); powers print raised. Empty text is a pupil answer line; hidden works as for numbers.
- `levelMm` (10 to 24) sets the height of each level; slots are wide enough for the widest number and a 10 mm
  pupil blank. `lines: "bold"` from the house style (U111). `intentionalError` silences the teacher notes.

## Explicit actions only

Nothing is split, filled or circled implicitly. **Split into two** (with the factors typed, or blank) and
**Remove its branches** are single undoable steps. **Complete trees** fills blanks from their parent and the other
branch (or from two branches), splits every composite end by its smallest prime, circles every prime end and writes
an empty answer line in index form; numbers already entered never change, and what it fills is hidden by default.

## Teacher notes

Never printed, never corrected: branches that do not multiply to their number, circled numbers that are not
prime, answer factors that are not prime and answers that do not make the number. A deliberate error turns them off.
