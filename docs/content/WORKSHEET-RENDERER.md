# Worksheet renderer (wave 3, step 1)

`packages/resource-core` turns a finalised question set into a two-sided A3 landscape worksheet:
the shape of Tim's own PLAN / FINALISE / PRODUCE sheets (November 2026). It is the first step of the
approved wave 3 plan: chat produces the finalised set, MathsDock renders it the same way every time.
The MCP tool (step 2), a small browser editor (step 3) and A4 booklets (step 4) build on it.

## The document

`resource` schema 1, `kind: "worksheet-a3"` (see `src/schema.ts`):

- Header: title, objective code and full objective, group (year or tier), optional Name line.
- Exactly two sides. Each side has an optional instruction line and exactly three strand columns.
  A column heading names the progression stage (for example Read and compare, Complete paired
  bars, Organise and interpret).
- Columns hold titled question cards. Numbers are computed, running across both sides.
- Card items: `text`, `info` (pale card), `claim` (a pupil's statement), `bullets`, `table`
  (cells supplied, blank or hidden), `choice` (circle one or tick one), `answerLine` (prefix,
  suffix, inline groups), `space` (working or drawing room), `diagram` (a full editable Charts or
  Probability tree envelope) and `part` (a, b, c… holding further items).
- Text is plain Unicode with `**bold**` and `*italic*` only. Nothing is evaluated.
- Saved answers (hidden table cells, answer-line answers, choice answers, hidden diagram values)
  print only in the answers view, in dark pink. Blank and hidden stay distinct.

## Layout rules

- 420 × 297 mm pages, 8 mm margins, three 131 mm columns, one fixed type scale (9 pt body,
  20 pt title) in Lato. Diagrams keep their own STIX fonts and native physical size.
- Cards never split. Diagrams are never shrunk; one may use its card's padding.
- A short answer line sits on the question's last line, which grows to a full 9 mm writing row.
- Spare column height goes to working and drawing spaces; with none, the last card reaches the foot.
- Too much content is reported per column (`issues`), never fixed by shrinking text. Too-wide
  tables, diagrams and short answer lines are reported too.
- Pupil and answers views share one layout (diagrams reserve the larger of their two sizes).
- File names follow the guide: `[code]_[full objective]_A3.pdf`, `_Answers` before `_A3`.

## House styles

`cards` (tinted column bands, framed cards with number badges) and `lines` (ruled headings and
dividers). Sizes and positions are identical; Tim chooses one at checkpoint 1.

## Samples and checks

`node scripts/resource/samples.mjs [outDir]` renders the golden fixtures (Tim's comparative bar
charts and tree diagrams sheets, `src/fixtures.ts`) in both styles and both views to SVG and to
vector PDF through Chromium. `npx vitest run packages/resource-core` checks two sides, no layout
issues, no answers in pupil pages, identical placement across views, JSON round trips, overflow
reports and file names.

Known gaps for later steps: the PDF route needs Chromium (step 2 decides the service route);
the Charts y-axis title is horizontal, which makes dual charts wide in a 131 mm column; Triangle,
number line and graph diagrams are not wired in yet.
