# Question cuts (November 2026 recut)

Every bank question is served from the November 2026 recut of the original Edexcel papers, in the
private bank folder `cuts-2026-11/<questionId>/`. Tim reviewed every flagged cut before the swap
(15 November 2026).

## Files in each question folder

| File | What it is |
| --- | --- |
| `question.pdf`, `print.pdf` | The whole question, vector, at the size Edexcel printed it, one page per paper page it spans. Keeps "Total for Question N" and the printed working space. |
| `question-N.png` | Preview of page N at 2x. |
| `part-<label>.pdf`, `part-<label>-N.png` | One separately served part, as labelled on the paper. |
| `stem.pdf`, `stem-N.png` | The question's shared stem or diagram, when it has one. |
| `scheme.pdf`, `scheme-N.png` | The mark scheme, copied unchanged from the earlier bank folder. |

Side-by-side content that belongs to another part or question is painted out, so a cut need not be
a rectangle; a blank band left wholly by painted-out content is closed up.

## Cutting rules

- Cut at every letter. Keep (i) and (ii) together when they share a Sparx code, otherwise split them.
- A whole question keeps its "Total for Question N" line; a part keeps only its own grey (N).
- An answer prefix, answer line, box, grid or table belongs to its part.
- A stem or shared diagram is its own cut, shown above each part that needs it.
- A part that refers back to an earlier part shows that part as context.
- A part that needs the answer to an earlier part is never served without that part.

## Catalogue

Each question's detail (`DETAIL_KEYS` in `bankCatalogueSplit.ts`) may hold `cuts`, absent for a
question served only whole:

```ts
{ id: "b", kind: "part", label: "(b)", parts: ["18b"], pdf, views,
  context: ["stem", "a"], requiresAnswerTo: ["a"] }
```

- `parts` lists the catalogue part labels the cut covers. Together the part cuts cover every
  catalogue part exactly once. A stem has `id: "stem"` and no parts.
- `context` lists the cuts shown above this one; it always includes every `requiresAnswerTo` id.
- `requiresAnswerTo` lists earlier part cuts whose answers this part needs.

`verifyQuestionDetail` rejects cuts that miss or repeat a part, or link to a cut that does not exist.
`question.revision` is the first 16 hex digits of the SHA-256 of the new `question.pdf`; worked
solutions were moved onto the new revision because their maths is unchanged.

## Regenerating

The paper cutter writes one `<paperId>.units.json` per paper. With the bank checked out:

```
python3 -I scripts/bank/apply-recut.py <manifest-dir> public/bank/assets
```

It rewrites `public/bank/catalogue.json` and stops, writing nothing, on any missing file, any part
label that does not match the catalogue or any broken link. The cutter, the original papers and the
manifests stay outside the repositories.
