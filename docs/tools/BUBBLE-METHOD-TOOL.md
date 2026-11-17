# Bubble method

`/tools/bubble-method` sets out the school's bubble method (balancing): solving linear equations and inequalities
and changing the subject of a formula, one line per step going down the page, with the operation written in a
bubble underneath the term it acts on, on both sides. Built 16 November 2026 for the A4.08 and A4.09 (changing the
subject) worksheets, Year 8, before Christmas; the same layout serves A3, A6 and A10 (METHODS.md v0.2, "Balancing
(bubble method)"). Algebra strand.

Code: `packages/bubble-method-core` (schema, typesetting, layout, SVG, examples), `src/bubble-method` (editor). The
maths text (`maths.ts`) prints true minus and times signs, italic letters and stacked fractions in STIX Two; a
bracketed numerator or denominator, as in (y − 2)/3, stacks without its brackets. MCP access is the `bubble-method`
kind of the generic connector tools (`diagram_capabilities`, `create_diagram`, `revise_diagram`), adapted by
`packages/bubble-method-core/src/interchange.ts`, and the family can be placed in worksheets (`create_worksheet`)
and booklets, and embedded in worked solutions (`worked-core` RENDERERS).

Worked solutions keep their own `bubbles` step (handwriting font, laid out over a question's cut); this family is
the printed diagram for worksheets, reminder cards and answer copies.

## In a worksheet question card

A bubble layout is a `diagram` item (`{type: "diagram", diagram: {tool: "bubble-method", spec}}`) in a card's items
or in a question part's items, so a question such as "Solve 2x + 6 = 0" can carry its working layout (A7.08 Q5a,
A7.09 Q1 and Q4). Each line side and each bubble is given as text, left blank (`""`, or a step with no `line`) or
saved as a hidden answer (`{text, hidden: true}`), which prints dark pink on the answers copy only. The worksheet
page (PDF) and the Word file both draw it from the same envelope, and the pupil and answers copies are the same
size (`packages/resource-core/src/bubble-method-item.test.ts` checks both outputs and both copies).

## Document

- `first`: the line at the top, `{lhs, rel, rhs}`. `rel` is one of =, <, >, ≤, ≥; lines align on it.
- `steps` (0 to 8): each `{left, right, line}`. `left` and `right` are the bubbles under the line above; `line` is
  the line they lead to. A new step's line takes the sign of the line above; turning an inequality's sign round is
  the teacher's choice, never automatic.
- A bubble is `{op, under}`. `under` is `auto` (a + or − bubble sits under the last term of its side, any other
  bubble under the whole side), `whole`, or a term number from 0 on the left (for v = u + at, the −u bubble on
  the right goes under term 0).
- Every printed item (each side, each bubble) is `{text, show}`: sides up to 40 characters, bubbles up to 12.
  Empty text is a pupil blank: a dotted line 26 mm long on a 12 mm handwriting row, or an empty bubble 13 mm by
  7.2 mm. A hidden item is a saved answer: pupils see the blank and the answers copy prints it in dark pink. An
  answer takes the room of its blank or its text, whichever is wider, on both copies, so pupil and answer copies
  are the same size and bubbles sit in the same places.
- Typing: sides `3x+2`, `y-2`, `(y-2)/3`, `x^2` print as 3x + 2, y − 2, a stacked fraction, x²; bubbles `-2`, `/3`,
  `x3`, `+5`, `-3x` print as −2, ÷3, ×3, +5, −3x. `lines: "bold"` from the house style. `intentionalError`
  silences the teacher notes.

## Explicit actions only

Nothing is solved or rearranged for the teacher. **Write it in both bubbles** copies one bubble's operation to the
other side of that step. Add a step, remove a step, move a bubble to a term and change a sign are the only other
actions; each is one undo step.

## Teacher notes

Never printed, never corrected: two written bubbles on one step that differ ("the bubbles differ (−3 and +3)"),
and a bubble that is not an operation. An empty bubble is a pupil blank, so it never raises a note. A deliberate
error turns them off.
