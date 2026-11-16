# Function machines

`/tools/function-machine` draws exam-style function (number) machines: input → [× 3] → [− 8] → output, as
Edexcel prints them, with up to three machines one above the other ("Here is a different number machine") and
machines that run backwards for working out an input from an output. Built 16 November 2026 so that worked
solutions can be drawn for the 22 function-machine parts in the Question Bank (Sparx M175 and M428; school
objectives A1.02 to A1.05 and A2.03). Algebra strand.

Code: `packages/function-machine-core` (schema, exact arithmetic, completion, layout, SVG, examples),
`src/function-machine` (editor). The maths-text helper (`maths-text.ts`: true minus and times, italic letters,
raised squares, stacked fractions in STIX Two) is shared with written methods. MCP access is the
`function-machine` kind of the generic connector tools (`diagram_capabilities`, `create_diagram`,
`revise_diagram`), adapted by `packages/function-machine-core/src/interchange.ts`. Machines can also be placed in
worksheets and booklets, and embedded in worked solutions through `validate` and `renderSvg`.

## Document

- `machines` (1 to 3). Each has a `start` (the word or number before the first box, "input" by default), 1 to 5
  `steps`, an `end` ("output" by default) and a `direction`: `right` as printed, or `left` (arrows right to left).
- Each step is `{ op, out }`: the operation in the box and the value on the arrow after it. `out` is null when
  nothing is printed there, and is always null on the last box (the end follows it).
- Every printed item is `{ text, show }`, at most 16 characters. Empty text is a pupil blank: a dotted line, or an
  empty box with a dotted line for an operation, as on the paper. A hidden item is a saved answer: pupils see the
  blank and the answers copy prints it in dark pink. An answer takes the room of its blank or its text, whichever
  is wider, on both copies, so pupil and answer copies are the same size.
- Operations are typed with an ordinary keyboard (`x3`, `*3`, `-8`, `/2`, `+ 1/2`, `square`) and print as
  × 3, − 8, ÷ 2 and a stacked fraction. Letters print in italic (n, 3n + 2). Fractions are always stacked.
- `boxShape`: `pentagon` (the arrow-shaped boxes of recent papers, default) or `rectangle` (older papers).
  `lines: "bold"` from the house style. `intentionalError` silences the teacher notes.

## Explicit actions only

Nothing is worked out implicitly. **Work out** goes forwards from a number at the start, or backwards through the
inverse operations from a number at the end when the start is blank, with exact fractions (never rounded). It
fills blanks and, by choice, writes the value on every arrow between boxes; items already entered never change,
and what it fills is hidden by default. **Add the inverse machine** puts the machine's inverse beneath it: the
boxes in reverse order with inverse operations (× ↔ ÷, + ↔ −, square ↔ √), arrows right to left, its end as the
new start.

## Teacher notes

Never printed, never corrected: values that do not follow from the machine ("6 × 3 − 8 is 10, not 12.") and boxes
that hold something that is not an operation. A deliberate error turns them off.
