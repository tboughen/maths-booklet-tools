# Worked solutions: the standard

Agreed with Tim on 16 November 2026 (design review, all six choices taken as recommended). A worked
solution is checked steps per part, drawn by MathsDock over that part's own cut at true size, so a
change of the department's common approach can find and redraw every part that uses it.

Files and registration: [WORKED-SOLUTION-REGISTRATION.md](WORKED-SOLUTION-REGISTRATION.md).
Code: `packages/worked-core` (schema, renderer, checks) and `src/bank/worked*.ts`.

## Choices made

1. Working is in Shantell Sans, a clear handwriting font, served as "MathsDock Hand".
2. Each mark is labelled with the mark scheme's own code and a few words (M1, A1, B1, P1, C1).
   Partial credit is shown only where the scheme gives it, as a bracketed code such as (B1).
3. The school's method is shown, with one "Also scores" line where the scheme accepts a quicker
   route. Tim's view for now; it can change.
4. The bubble method has its own layout: each operation in a bubble under the term it acts on, on
   both sides, one line per step.
5. Pilot: June 2017 1F, then 2H, reviewed by Tim before any more.
6. Solutions are switched back on paper by paper; each switch-on needs Tim's release go.

## Rules (WS1 to WS13)

| Rule | What it says | Checked by |
| --- | --- | --- |
| WS1 | One layer of steps per part cut, drawn on that cut at true size. A whole question is the parts stacked. | Renderer |
| WS2 | The school's method wherever the department's methods list names one (grid, bubbles, ratio table, bar model, number line). Otherwise the clearest method that earns full marks. Each part records its `method`. | Reviewer; `method` tag |
| WS3 | One pink note per mark, beside the line that earns it, with the scheme's code. | Machine: unbracketed codes add up to the part's grey (N) |
| WS4 | The final answer is written on the part's own answer line, box or table, in the form the paper asks for. | Machine: every answer line is filled |
| WS5 | Stacked fractions always, including mixed numbers (`{3/4}`). Whole numbers before fractions. Real powers (`x^2`). | Machine: no slash or ½-style fractions |
| WS6 | Never shrink type or handwriting space. If the printed space is too small, room is added under the working space. | Renderer: fixed sizes; overflow adds a band |
| WS7 | Nothing overlaps: notes, working, answers, marks, the total line and the printed question stay clear. | Machine: box collision and off-cut checks |
| WS8 | Drawing on a shared stem (graph lines, tangents, completed tables) belongs to the part that needs it. | Renderer: `draw` steps name their surface |
| WS9 | A part that uses an earlier answer shows it in a "from (a)" tag and never recalculates it differently. | Machine: the carried value is the earlier part's answer |
| WS10 | School words: "substitute", not "put"; y ↑ with negative movements, never y ↓; Edexcel's own labels and units. | Machine word list; reviewer |
| WS11 | "Also scores" and "Watch out" lines come only from the mark scheme's own guidance. | Reviewer against the scheme |
| WS12 | Black maths in the working font; dark-pink guidance in the interface font, near the working, without leader lines; method diagrams from MathsDock's own renderers in STIX Two. | Renderer |
| WS13 | Every answer is solved independently and agrees with the mark scheme before it is drawn. | Independent solver, then Tim's review |

## The steps file (schema 2)

```json
{
  "schemaVersion": 2, "questionId": "1MA1_…_Q19", "questionRevision": "…",
  "parts": [{
    "on": "a-1", "parts": ["(a)"], "method": "bubble-method",
    "area": { "x": 40, "y": 30, "width": 260, "bottom": 175 }, "notesX": 310,
    "answers": [{ "x": 330, "y": 192, "width": 120 }],
    "steps": [
      { "kind": "line", "lhs": "4x + 3", "rhs": "19" },
      { "kind": "bubbles", "lhs": "-3", "rhs": "-3" },
      { "kind": "line", "lhs": "4x", "rhs": "16", "mark": { "code": "M1", "note": "subtracts 3 from both sides" } },
      { "kind": "bubbles", "lhs": "÷4", "rhs": "÷4" },
      { "kind": "line", "lhs": "x", "rhs": "4" },
      { "kind": "answer", "value": "4", "mark": { "code": "A1", "note": "cao" } }
    ]
  }]
}
```

- Positions are PDF points of the surface: a cut view's `id` (`a-1`, `stem-1`) or, for an uncut
  question, a question view (`question-1`). `area` is the printed blank working space and `bottom`
  its lower edge; `answers` are the printed answer lines (left end, baseline, length); `notesX` is
  the left edge of the guidance column.
- Step kinds: `line` (aligned on its sign), `text`, `bubbles`, `diagram` (an algebra grid, ratio
  table, number line or factor tree envelope drawn by its own renderer), `carry` (a value from an earlier
  part), `note` (guidance; `watch` for a slip the scheme flags), `draw` (lines, paths, crosses,
  rings and labels on any shown surface) and `answer` (centred on its line; `"align": "left"` for
  written words on a full-width line).
- Typed maths prints properly: `-` is a minus sign (a hyphen between letters stays), `*` a times
  sign, `<=` and `>=` their signs, `{a/b}` a stacked fraction, `^2` or `^{12}` a power.
- Step numbers count through every part in order, so step-by-step reveal shows the same steps
  whatever is served.

## In the Question bank

- **Mark notes** (on by default, remembered on this computer) shows the mark codes and "Also scores"
  lines. Off gives a pupil copy: the guidance words stay and nothing moves.
- **Step by step** hides every step, then **Next step** and **Previous step** reveal them one at a
  time in paper order, across the parts shown. Nothing moves as steps appear.
- **Copy image** and **PNG** export what is shown at 300 dpi, with the working drawn in (fonts are
  embedded), the current Mark notes and step choices, and the source caption. **Whole question**
  exports every cut with its total.

## Still to come

- A worked-solutions PDF in Paper Builder.
- The June 2017 1F pilot data.
