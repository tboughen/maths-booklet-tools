# Written methods

`/tools/written-method` sets out the school's formal written methods in place-value columns: column addition
(2 to 4 numbers, decimals lined up on the point), column subtraction with exchanges, long multiplication
(partial products, then their sum), short division (the bus stop, with each step's remainder carried small) and
long division. Built 16 November 2026 so that worked solutions can be drawn for the 63 written-method parts in
the Question Bank (Sparx U127, U293, U453, U868, U417; school objectives NP2.01 to NP2.04, NP2.11, NP2.12,
NP2.14 to NP2.16). Number and proportion strand. The grid method for multiplication is the expanding and
factorising grid tool.

Code: `packages/written-method-core` (schema, completion, layout, SVG, examples), `src/written-method` (editor).
Diagram text uses the shared maths-text helper from `packages/function-machine-core` (STIX Two). MCP access is the
`written-method` kind of the generic connector tools (`diagram_capabilities`, `create_diagram`, `revise_diagram`),
adapted by `packages/written-method-core/src/interchange.ts`. Methods can also be placed in worksheets and
booklets, and embedded in worked solutions through `validate` and `renderSvg`.

## Document

- `method`: `add`, `subtract`, `multiply`, `short-division` or `long-division`.
- `numbers`: 2 to 4 for addition, otherwise 2; a division's are the number to divide and the number to divide by.
  Addition and subtraction take decimals. Long multiplication takes whole numbers, as the school method does
  (54.6 × 4.3 is worked as 546 × 43, then the point is placed). A divisor is whole: multiply both numbers by 10,
  100 or 1000 first (NP2.16).
- `working`: partial products (long multiplication), or the rows to subtract and what is left (long division).
  Each row has a `place` (the place value of its last digit) and a `kind`.
- `answer`, `remainder` (division only: `null` for none, otherwise printed as "r 3") and `extend` (zeros written
  after the point to keep dividing).
- `marks`: small digits on a row at a place value: carries above a result row, carried remainders and exchanged
  tens before a digit of a number, and `cross: true` for an exchange (the digit beneath is struck through).
- Every row is `{ text, show }`. Empty text is a pupil blank (empty squares). A hidden row or small digit is a
  saved answer: pupils see the space and the answers copy prints it in dark pink. Columns come from every row's
  text, hidden or not, so pupil and answer copies are the same size.
- `cellMm` (5 to 10, default 7) is each digit's square at print size. Digits print at 11 pt in STIX Two; small
  digits at 80% (8.8 pt), the smallest type the tool prints. `lines: "bold"` from the house style.
  `intentionalError` silences the teacher notes.

## Explicit actions only

Nothing is worked out implicitly. **Work out** fills the answer, the working rows, the remainder and the small
digits from the numbers; rows already entered never change, and what it fills is hidden by default. For a
division, **Keep dividing past the point** writes zeros after the number and continues to a decimal answer
instead of a remainder. Changing the method keeps the numbers and clears the rest. Every edit is one undo step.

## Teacher notes

Never printed, never corrected: an answer, remainder or partial product that does not follow from the numbers
("4758 + 2696 is 7454, not 7464."). A deliberate error turns them off.

## Checks

`packages/written-method-core/src/index.test.ts`, `services/graph-mcp/written-method.test.ts`,
`e2e/written-method.spec.ts`, plus the shared gates (golden corpus, saved-file contracts, output goldens, print
baseline, answer canary, both copies, worked notes, undo coverage).
