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

- 420 × 297 mm pages, 8 mm margins, three 131 mm columns, one fixed type scale (10 pt body,
  11 pt card titles, 20 pt title) in Inter. Diagrams keep their own STIX fonts and native size.
- Cards never split. Diagrams are never shrunk; one may use its card's padding.
- A short answer line sits on the question's last line, which grows to a full 9 mm writing row.
- Spare column height goes to working and drawing spaces; with none, the last card reaches the foot.
- Too much content is reported per column (`issues`), never fixed by shrinking text. Too-wide
  tables, diagrams and short answer lines are reported too.
- Pupil and answers views share one layout (diagrams reserve the larger of their two sizes).
- File names follow the guide: `[code]_[full objective]_A3.pdf`, `_Answers` before `_A3`.

## MathsDock style, and the evidence behind it

One style, `mathsdock`, taken from the website: Inter (the site's interface font), logo navy
`#173c65` for titles and headings, solid navy number and stage tiles, a soft blue for info
cards and the group label, and white cards with a mid-grey frame and rounded corners like the home-page cards.
Body text uses the site's ink `#262720`; saved answers use dark pink in the answers view only.

Each rule has a reason. Treat the research as general findings about learning materials, not
trials of these worksheets.

| Rule | Why |
| --- | --- |
| A question's diagram, table, working space and answer lines sit inside its card. Cards never split across columns or sides. | Split attention: learning is weaker when material that must be read together is physically separated. Ginns's 2006 meta-analysis found a large effect (d = 0.85), strongest for complex material ([Frontiers in Education, 2019](https://doi.org/10.3389/feduc.2019.00086)). |
| No pictures, logos or decorative colour on pupil pages. Colour marks structure only. | The coherence principle and seductive-details research (Mayer; Harp and Mayer, 1998): interesting but irrelevant additions take attention from the task. The design guide says the same. |
| Each column has a stage tile (A to F across both sides) and a heading. Each question has a number tile and a short title in the same place. | Signalling: consistent cues for structure help readers find and organise content (Mayer). The tiles show the progression from familiar to independent at a glance. |
| Inter at 10 pt with 1.4 line spacing, left-aligned and ragged right. Italic only for variables; bold sparingly. | A sans-serif with a large x-height (Inter 0.55 em) reads larger than its point size. Dyslexia style guides favour sans-serif, left alignment, extra line spacing and little italic. |
| Columns hold about 70 characters a line. | Readability studies of line length generally favour moderate lengths over very long lines (Dyson, 2004, review). |
| More space between cards than inside them; parts are indented under their question. | Proximity (Gestalt): items close together are read as a group. |
| Working space is sized by task, and spare height goes to working and drawing space. | The design guide: allocate space by the work pupils must do, and use the full page. |
| Card frames are mid-grey at 0.45 mm, number and stage tiles are solid navy with white numbers, and info cards have a navy edge. Text stays near-black. | Questions must stay clearly separated on a black-and-white printer (the design guide asks for a monochrome check). Pale tints alone fade out in greyscale. |

Open question for Tim: dyslexia guidance often asks for at least 12 pt. Inter 10 pt is about the
size of 10.5 pt Arial. A larger-print setting (fewer questions a side) is a later option.

## Samples and checks

`node scripts/resource/samples.mjs [outDir]` renders the golden fixtures (Tim's comparative bar
charts and tree diagrams sheets, `src/fixtures.ts`) in both views to SVG and to
vector PDF through Chromium. `npx vitest run packages/resource-core` checks two sides, no layout
issues, no answers in pupil pages, identical placement across views, JSON round trips, overflow
reports and file names.

Known gaps for later steps: the PDF route needs Chromium (step 2 decides the service route);
the Charts y-axis title is horizontal, which makes dual charts wide in a 131 mm column; Triangle,
number line and graph diagrams are not wired in yet.
