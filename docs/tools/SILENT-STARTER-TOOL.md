# Silent starter tool

A silent starter is the short printed task pupils do as they come into the lesson. It is cut out
and stuck in their books, so they can look back at earlier ones. The tool makes a **run of six**
starters at once. Each question slot keeps its type for the whole run: question 3 is the same kind
of question in every starter, and only its numbers or difficulty move a little from one starter to
the next (Tim, 18 November 2026). Design page with mock-ups:
https://claude.ai/artifact/Fp4FYqJk7zQaxxUEoxS5ZZ

Code: `packages/resource-core/src/starter.ts` (the file format), `starter-render.ts` (layout and
PDF pages) and `starter-docx.ts` (Word).

## Decisions

- **Print comes first.** Each starter is an A5 landscape card (210 × 148 mm). The print sheet is A4
  portrait with two copies of the same card and a dashed cut line, so one cut gives two pupils a
  half-page each. Text is the house 11 pt and is never shrunk; maths uses the worksheet typesetting
  and stacked fractions.
- **The board comes second.** The board view shows the same card filling the height of a
  1920 × 1080 screen, with a side strip for the starter number, the topic, a timer and the pink
  answers switch. It is not re-laid for 16:9, so pupils see exactly what is on their sheet.
- **Templates.** `four`: four questions two by two, numbered in reading order (Years 7 and 8).
  `six`: six questions in three columns, numbered down the columns (1 2 | 3 4 | 5 6) for Key
  Stage 4. `core-extension`: the same six with the third column marked as extension by a 1.3 mm
  bar, a black "EXTENSION" band and a light grey tint (option C, chosen by Tim). Questions 5 and 6
  are always the extension column.
- **Year 7 and 8 question types.** Each slot has a type name (not printed) and an icon printed in
  its corner: pencil, speech bubbles, book and puzzle piece, as on Tim's Year 8 starters. Tim will
  name the four types later; fill them in `YEAR_7_8_SLOTS` in `starter.ts` when he does.
- **Logo.** A run may hold a small PNG or JPEG logo, printed at the right of the header. It is kept
  inside the saved file and never committed to the repository (the app repository is public).
  A damaged image (wrong PNG or JPEG start or end bytes) is rejected when the file is read.
  The pelican logo was not found on 18 November 2026, so none is set by default.

## The file

`kind: "starter-run"` in the shared resource schema (`tool: "resource"`, `schemaVersion: 1`):
title and group (for the editor and file names), the printed topic, the template, `notation`
(`maths` by default), one slot per question (`name`, `icon`), one to six starters, each holding
one question card per slot, and an optional logo. A card's title is the question's instruction,
printed in bold after its green number; its items are the worksheet and booklet items (text,
answer lines, tables, choices, spaces and any MathsDock diagram).

## Layout

- 7 mm margins (a cutting allowance), a 12 mm header ("Silent starter", "On your sheet", the run
  tracker with today's number boxed, the topic and the logo), then the slots.
- Slots are 98 × 61 mm (four) or 65 × 61 mm (six). Spare height goes to working spaces, as on
  worksheets. A question that does not fit is reported with its starter and question number,
  as are a topic too long for the header, a fraction in an instruction and a stage band.
- On the grey extension column a diagram's own white background is left out, so the tint shows.
- MathsDock diagrams print at their true size, so a starter needs small ones. A diagram wider
  than its slot is reported ("Draw it smaller in its tool"); nothing is scaled down. The area
  tool, for example, can draw a shape at any size while its labels stay at full size.
- File names: `[title]_Silent-starters.pdf`, `..._Answers.pdf`; one starter adds `_[n]`.

## Word

`writeStarterDocx` writes one A4 portrait page per starter (or one starter with `only`), with two
copies of the card and a dashed cut line, at the PDF's sizes. The header (title, run tracker, topic,
logo) is a picture so it prints exactly as on the PDF; each slot is a table cell with exact row
height, holding the number, instruction and items as editable Word text, native equations for
stacked fractions, tables and diagram pictures. Icons are small pictures in the slot corner. The
PDF layout's problems are reported with the Word file. The service helper is `starterDocx` in
`services/graph-mcp/worksheet-docx.ts`.

## The Starter builder page

`/starters` (`src/starter/StarterPage.tsx`, a seventh page in the top bar after Worksheet builder).
Above the card is the run grid: one row per question slot, one column per starter, each cell the
question's instruction and first text. Choosing a starter previews its A5 card at print size
(Actual size and Calibrate as on every page) and opens its questions in the side panel, edited
with the worksheet field editors. Per question: **Copy to every starter** (the same question in
that slot of every starter, ready for the numbers to change) and **Copy from starter n-1**. Per
starter: move earlier or later, add a copy after it (up to six), remove. Run settings: name,
year, topic, template (a template with fewer slots drops the last slots; Undo brings them back),
maths printing, logo (PNG or JPEG kept in the file) and each slot's type name and icon. Every
change is one undo step; the run autosaves on the device like the worksheet. Downloads: Word
(the main button: every starter, two copies on each A4 sheet), Word for one starter, the answers
Word, and the same three as PDF; a download is refused while a question does not fit. Steps are
in `src/starter/edit.ts`; browser checks in `e2e/starters.spec.ts` (`--project=starters`).

## Still to build

The board view and slides; a connector tool to draft a run; optional AI suggestions for a row's
numbers. Each is its own small pull request.
