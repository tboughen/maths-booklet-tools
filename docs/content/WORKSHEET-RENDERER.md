# Worksheet renderer (wave 3, step 1)

`packages/resource-core` turns a finalised question set into a two-sided A3 landscape worksheet:
the shape of Tim's own PLAN / FINALISE / PRODUCE sheets (November 2026). It is the first step of the
approved wave 3 plan: chat produces the finalised set, MathsDock renders it the same way every time.
The MCP tool (step 2), a small browser editor (step 3) and A4 booklets (step 4) build on it.

## The document

`resource` schema 1, `kind: "worksheet-a3"` (see `src/schema.ts`):

- Header: title, objective code and full objective, group (year or tier), optional Name line.
- Exactly two sides. Each side has an optional instruction line, a `layout` and its strand
  columns. A column heading names the progression stage (for example Read and compare, Complete
  paired bars, Organise and interpret).
- Layouts (widths in thirds of the page, so columns line up from side to side): `three` (the
  default: three 131.3 mm columns), `two` (two 199.5 mm), `wide-narrow` (267.7 + 131.3 mm),
  `narrow-wide` and `one` (full-width 394 mm cards). Cards are as wide as their column, so a
  quadratic graph can have one large card instead of three small ones. The number of columns must
  match the layout.
- A card with `stage` starts a new stage band above it, inside its column, with the next letter.
  Stage letters run in reading order across both sides (column headings and stage bands), so three
  plain columns a side are still A to F. A stage on a column's first card is reported: that card
  sits under the column heading.
- `score: n` on a side prints "Score ____ / n" in the header beside "Side 1 of 2" (one mark per
  answer). Leave it `null` (the default) for no score box.
- `working` on a card or a part stores a hidden worked solution (up to 3000 characters, several
  lines). It is never printed, in the pupil or the answers copy; it lets a reviewer or teacher check
  the saved answers.
- Columns hold titled question cards. Numbers are computed, running across both sides.
- Card items: `text`, `info` (pale card), `claim` (a pupil's statement), `bullets`, `table`
  (cells supplied, blank or hidden), `choice` (circle one or tick one), `answerLine` (prefix,
  suffix, inline groups), `space` (working or drawing room), `paper` (blank squared, dotted or graph paper at its printed
  size, optionally with blank axes: arrows, *x*, *y* and *O* but no numbers, so pupils choose the
  scale), `diagram` (a full editable Charts or Probability tree envelope) and `part` (a, b, c… holding further items).
- Text is plain Unicode with `**bold**` and `*italic*` only. Nothing is evaluated. A sheet with
  `notation: "maths"` (default `"plain"`, so saved sheets print as before) also prints `{3/4}` in
  question text as a stacked fraction, and `2{1/2}` as a mixed number; see
  [Word output](WORD-OUTPUT.md#stacked-fractions).
- Saved answers (hidden table cells, answer-line answers, choice answers, hidden diagram values)
  print only in the answers view, in dark pink. Blank and hidden stay distinct.

## Layout rules

- 420 × 297 mm pages, 8 mm margins, 5 mm gutters, columns in thirds of the page (three 131.3 mm by default), one fixed type scale (11 pt body
  and card titles, 20 pt title, nothing below 10 pt) in Inter. Diagrams keep their own STIX fonts and native size.
- Cards never split. Diagrams are never shrunk; one may use its card's padding. Grid paper wider
  than its card is reported. A stage band takes 9.5 mm of its column. An instruction longer than
  one header line is reported.
- A short answer line sits on the question's last line, which grows to a full 9 mm writing row.
- Spare column height goes to working and drawing spaces; with none, the last card reaches the foot.
- Too much content is reported per column (`issues`), never fixed by shrinking text. Too-wide
  tables, diagrams and short answer lines are reported too.
- Pupil and answers views share one layout (diagrams reserve the larger of their two sizes).
- A saved answer wider than its answer line is reported: it would run past the line in the
  answers copy.
- File names follow the guide: `[code]_[full objective]_A3.pdf`, `_Answers` before `_A3`. Word
  files use the same name with `.docx` ([Word output](WORD-OUTPUT.md)).

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
| Inter at 11 pt with 1.4 line spacing, left-aligned and ragged right. Italic only for variables; bold sparingly. | A sans-serif with a large x-height (Inter 0.55 em) reads larger than its point size. Dyslexia style guides favour sans-serif, left alignment, extra line spacing and little italic. |
| Columns hold about 70 characters a line. | Readability studies of line length generally favour moderate lengths over very long lines (Dyson, 2004, review). |
| More space between cards than inside them; parts are indented under their question. | Proximity (Gestalt): items close together are read as a group. |
| Working space is sized by task, and spare height goes to working and drawing space. | The design guide: allocate space by the work pupils must do, and use the full page. |
| Card frames are mid-grey at 0.45 mm, number and stage tiles are solid navy with white numbers, and info cards have a navy edge. Text stays near-black. | Questions must stay clearly separated on a black-and-white printer (the design guide asks for a monochrome check). Pale tints alone fade out in greyscale. |

Body size (Tim, 9 Nov 2026): 11 pt, with nothing smaller than 10 pt. His earlier A3 sheets ranged
from 8.7 pt to 14.3 pt main text. At 12 pt the golden sheets no longer fit two sides without
moving questions; at 11 pt they fit with small wording trims. Dyslexia guidance often asks for
12 pt, so a larger-print setting (fewer questions a side) stays a later option.

## PDF

`services/graph-mcp/worksheet-pdf.ts` writes the PDF with PDFKit and svg-to-pdfkit: one page per
rendered SVG at its own millimetre size, text kept as text with subset embedded fonts (Inter for
the sheet, STIX Two for diagrams), no raster images. It needs no browser, so the free Render
service can run it. The Inter files are TrueType because the PDF writer cannot subset WOFF2.

## MCP tools

`worksheet_capabilities` lists the layout, item types and limits. `create_worksheet` takes a whole
resource document (the PRODUCE step from a finalised question set; diagrams are the exact envelopes
from `create_chart` or `create_probability_tree`) and returns:

- a screen preview of each side (pupil view);
- signed links to the pupil PDF, the answers PDF and the editable JSON, named by the guide's
  convention (the worksheet travels deflated inside the link; files are embedded in the reply when
  a link would be too long);
- `printReady` and the layout issues. Overflow is reported, never fixed by shrinking: the client
  revises the document and calls `create_worksheet` again;
- a `contentHash` of the document.

The PDFs and previews run in the service's render worker, so they share its queue, timeout and
daily output quota. `services/graph-mcp/worksheet-tools.test.ts` covers the round trip.

## Samples and checks

`node scripts/resource/samples.mjs [outDir]` renders the golden fixtures (Tim's comparative bar
charts and tree diagrams sheets, `src/fixtures.ts`) in both views to SVG and to vector PDF with the
service's PDF writer. `npx vitest run packages/resource-core` checks two sides, no layout issues,
no answers in pupil pages, identical placement across views, JSON round trips, overflow reports
and file names.

Known gaps for later steps: the Charts y-axis title is horizontal, which makes dual charts wide in
a 131 mm column; Triangle, number line and graph diagrams are not wired in yet; there is no
browser editor (step 3) and no A4 booklet (step 4).
