# Word output for worksheets

`packages/resource-core/src/docx.ts` writes the pupil and answers Word files for an A3 worksheet
from the same source, and the same layout, as the SVG pages and PDFs. It is build step 3 of the
A3 Word worksheets plan (11 November 2026). The target is desktop Word on Windows. Word is the
deliverable; PDFs and page images are only used for checking.

## Making the files

In any chat with the MathsDock connector, `create_worksheet` returns `pupilDocx` and `answersDocx`
download links beside the PDFs (13 November 2026). Booklets print as PDFs only. The connector's file is
byte-identical to the one `scripts/resource/word.mjs` writes for the same sheet: both call
`services/graph-mcp/worksheet-docx.ts`, which the service runs in its render worker. A Word link
carries the worksheet, like the PDF links, so it makes the file again on each download and needs no stored file.

In a project thread, from a fresh clone (no website release, connector or API key needed):

```
npm ci
node scripts/resource/word.mjs sheet.json --out output/word --preview
```

This writes `sheet.docx` and `sheet_answers.docx` (and, with `--preview`, LibreOffice PDFs and page
images plus the PDF writer's own PDF for comparison). With no file it writes the golden sheets, the
rendering-test sheet and the layout-test sheet. `--no-system-inter` hides any installed Inter from LibreOffice, which
proves the embedded fonts are used. The preview needs LibreOffice Writer **and LibreOffice Math**
(`apt-get install libreoffice-math`); without Math, LibreOffice silently drops every equation.

The library call is `writeWorksheetDocx(resource, { view, fonts, picture })`. It has no Node or
browser imports: the caller supplies the Inter font bytes and a function that turns each
diagram's SVG into an outlined SVG and a PNG. `services/graph-mcp/worksheet-docx.ts` is the Node
version (fonts from `assets/`, pictures with resvg).

## How the file is built, and why it cannot reflow

| Rule | Why |
| --- | --- |
| Each side is one fixed-layout table: a header table, then a row of stage headings and a row with one cell per strand column. Cards are bordered one-cell tables inside the column cells. | Word never moves a table cell, so the columns stay where the PDF puts them. Floating text boxes would be fragile to edit. |
| Each card's row has a minimum height equal to the height the SVG layout measured (including the share of spare height its working spaces get, or, in a column with none, the share every card gets at its foot when the sheet's `spareSpace` is `share`). | The card is the same size as in the PDF. Word grows a card rather than overlapping text when a teacher adds words, so an edit pushes content down and never hides it. |
| Text has exact line spacing (11 pt type on 15.4 pt lines); working space, answer rows and table rows have exact heights. | Only line breaks could then change a card's height. |
| The text area in each card is 1 mm wider than the width the layout measured. | Line breaks are predicted from Inter's own advance widths, the ones Word uses. The extra millimetre means Word never needs more lines than predicted. |
| Word's bottom page margin is 3 mm smaller than the layout's (5 mm, not 8 mm). | A card that Word draws a fraction taller cannot push its column onto a third page. Content still ends where the PDF's does. |
| Inter (Regular, Italic and SemiBold) is embedded in the file, obfuscated as Word requires. Bold text uses the "Inter SemiBold" face, as the PDF does. | The layout holds on a computer without Inter. The SemiBold file names its own family, so it is embedded as a separate font rather than as Inter's bold. |
| Diagrams are SVG pictures with their text turned into outlines, at their printed size, with a 300 ppi PNG fallback. | Microsoft 365 draws SVG; older Word uses the PNG. Outlines mean the STIX maths fonts are not needed on the teacher's computer. Diagrams are not editable in Word; edit the source and remake the file. |
| Stacked fractions are native Word equations, set as normal text in Inter. | A teacher can change a number with Word's equation editor, and the digits match the rest of the sheet. |
| Everything comes from the one source. The same worksheet always makes the same bytes. | Pupil and answer copies stay in step; files can be compared. |

Saved answers print only in the answers copy, in the answers colour, exactly as in the PDF:
hidden table cells, answer-line answers (written on the line), the chosen option of a choice, and
hidden diagram values. Blank, hidden and zero stay distinct. The Word writer reports the same
layout issues as the PDF (and any of its own); it still writes the file, so the problem can be seen.

Layouts, stage bands, the score box and grid paper follow the SVG layout exactly. Each side's
body table has one grid column per strand column (and a gutter between), so a wide column is one
wide cell. A stage band is a one-tile-high table between two cards, with exact gaps that add up
to the 9.5 mm the layout gives it. The score box is "Score", a tab, an underscore leader to the
end of the line, then the total, at the PDF's positions. Grid paper is the same SVG as the page,
placed as a picture at its printed size (with a 300 ppi PNG fallback), so its squares are true
millimetres. Stored working is never written to the file.

### Differences from the PDF, by design

- Card corners are square (Word tables cannot round them).
- A circled option in the answers copy is boxed; lettered options are boxed letters, not circles.
- Tick boxes are bordered spaces, shaded in the answers copy when chosen.
- An answer on the question's own line is underlined text followed by Word's underscore leader.

## Stacked fractions

A sheet with `notation: "maths"` prints `{3/4}` in question text (text, info, claims, bullets,
parts, steps, checklists and choice options) as a stacked fraction; `2{1/2}` is a mixed number.
Each side holds up to 12 characters, with no braces or second slash. Letters print in italic.
Table cells, answer lines and titles stay plain. Saved sheets default to `notation: "plain"` and
print exactly as before. A brace that is not part of a fraction is reported.

A paragraph holding a fraction sets all its lines at 2.4 times the body size (9.3 mm at 11 pt),
in the PDF and, with exact spacing, in Word, so its height is as fixed as ordinary text. A
fraction is measured as if its parts were at full body size plus 0.8 mm each side: Word and
LibreOffice set equations with their own spacing, and the layout must never under-measure a line.

## Rendering test (11 November 2026)

`packages/resource-core/src/word-sample.ts` is a two-sided A3 sheet that uses every worksheet block,
23 stacked fractions, two straight-line graphs and hidden answers. With the two golden sheets it
was written as Word, converted by LibreOffice 24.2 in the cloud sandbox, and compared with the PDF.

| Check | Result |
| --- | --- |
| Pages | All six files (three sheets, pupil and answers) are exactly two pages. |
| Embedded fonts | With every installed Inter hidden, LibreOffice used the embedded Inter Regular, Italic and SemiBold (TrueType, from the file). |
| Layout | Columns, cards, tables, answer rows and diagrams sit where the PDF puts them. Card bottoms in LibreOffice are 0.9 to 1.4 mm lower than the PDF's (each card 0.3 mm taller, and the whole grid 0.3 mm lower), inside the 3 mm foot allowance. |
| Line breaks | No line needed more room than predicted. A few lines hold one more word than in the PDF (the 1 mm of extra width at work), so a paragraph can end a line sooner; cards are pinned, so nothing below moves. In one info card, LibreOffice's equation for {rise/run} is wider than the PDF's, and the last two words moved to the next line, still inside the pinned card. |
| Equations | LibreOffice draws OMML in its own maths font (Liberation Serif digits) and ignores the "normal text" setting, so its fractions are larger and in a different font than Word's will be. Treat the equations as the part of the preview to trust least. |
| Answers | Every saved answer appears in the answers copy only. One golden-sheet answer (eight outcomes on one short line) was found to run past its line, in the PDF too; it is now reported, and the fixture has two lines. |

Microsoft's cloud converter (option 3) was not tried, because it ignores embedded custom fonts
and the sheets use Inter. The Arial version was not made, for the same reason.

## Real desktop Word (11 November 2026)

The real-Word check below was run on Tim's Windows PC (Word 16.0, Inter not installed) on the
three sheets above, pupil and answers.

First run: every file was 5 pages. Two causes, both fixed:

- The page settings were inside the last paragraph, so Word ended a section there and added an A4
  portrait page. They are now the body's last child.
- Word adds a cell's top and bottom margins to a minimum row height, so every card was 5.5 to
  5.9 mm taller than the layout and the last card in each column moved to the next page. A card's
  top and bottom padding are now exact empty paragraphs, with no top or bottom cell margin.

Word also printed in-line fraction parts at 8 pt for 11 pt text, so the parts are now written
11/8 larger (`WORD_INLINE_FRACTION`) and print at 10.6 pt.

Second run, with those fixes: all six files are 2 A3 landscape pages. Every card is on its planned
side and column. Card bottoms are 1.1 to 2.3 mm below the PDF writer's: each card is 0.7 to 0.8 mm
taller, so the difference builds down a column. That is inside the 3 mm foot allowance; the
lowest card ends about 6 mm above the page edge. Word used the embedded Inter Regular, Italic and
SemiBold. The diagrams printed as vector SVG. The saved answers appear only in the answers copies.
Typing 21 extra words into a card made it grow by two lines, and nothing was hidden. Fractions
are evenly spaced and whole, except in a row of lettered options, where Word clipped the bottom of
round denominators at the foot of the cell. Such a row now keeps 1 mm (`FRAC_FOOT`) below it, in
the PDF and in Word.

Known differences in Word: diagonal hatching in bar charts prints as flat grey (Word's SVG
drawing does not support pattern fills); the bars and key still match each other. In the answers
copy, the pink behind a chosen letter fills the whole line height in a row with fractions.

### Layout test (11 November 2026)

`packages/resource-core/src/layout-sample.ts` has a three-column side with a score box and graph
paper with blank axes, and a wide-narrow side with a stage band, squared paper with axes and dotted
paper, plus hidden working. Pupil and answers files are each two pages in LibreOffice, with the
embedded fonts and no layout issues, and columns, bands, the score box and the grids sit where the
PDF puts them. The tests also fit the `two`, `narrow-wide` and `one` layouts.

In real Word (same PC, same day) all eight layout files were two pages, with cards within 3 mm,
columns, the stage band and the score box in place and no stored working printed. Three faults
showed, and a probe (`scripts/word/probe.mjs`: small labelled tables, each with the size it
should print at) measured why:

| Probe | Asked | Word printed | Rule taken |
|---|---|---|---|
| P1 minimum row 30 mm, 0.45 mm borders | 30 | 30.93 | Top and bottom borders print outside a minimum row height: a card's row is two borders shorter. |
| P2 minimum 30 mm, 3 + 3 mm cell margins | 30 | 36.90 | Margins are added too (already avoided). |
| P3 exact 30 mm, 3 + 3 mm cell margins | 30 | 33.46 | Exact rows grow by a margin as well: no answer row uses a bottom margin. |
| P4 nested table then a 3 mm paragraph | 23 | 20.88 | The last paragraph of a cell is dropped when it follows a nested table. |
| P5 nested table then 1.5 + 1.5 mm | 23 | 23.93 | Two paragraphs both print: a card's bottom padding is two paragraphs. |
| P7 answer row, exact 9 mm, 0.9 mm bottom margin | box 19 | 20.46 | Each answer row printed 1.3 mm taller, which pushed answer lines down a card. |
| P8 exact 6.9 mm row, line as its bottom border, exact 1.8 mm row | box 19, line 12.05–12.2 | 18.96, line 12.05–12.35 | Answer rows are two exact rows (`ANSWER_WRITE_MM`, `ANSWER_BELOW_MM`). |
| P9 two cards per column, as wide as the column | 4 borders | right border missing on the lower card | Word draws a right border outside the cell and the column cuts it off. |
| P10 the same, 0.3 mm narrower | 4 borders | right border 0.12–0.18 mm of 0.44 | Cards are one border (0.45 mm) narrower than the column. |

Re-check with these rules (same evening, all eight files, pupil and answers): two pages each;
every card shows all four borders at full thickness; card edges are within 0.11 mm across and
0.9 mm down of the PDF writer's; every answer line is within 0.6 mm of the PDF's, and the last
line in a card keeps its space below (4.6 mm, was 0.5 mm).

Known differences in Word: the text baseline of an answer sits about 1.2 mm above the line's
centre (0.8 mm on the SVG page). Word's own PDF export prints pictures 0.43 % small (100 mm graph
paper measures 99.57 mm between frame centres, against 99.99 mm in the PDF writer's, measured the
same way), although the file holds them at full size (Word reports 283.45 pt). The outer frame of
grid paper prints half as thick, because Word clips the half of the stroke outside the picture.

## The real-Word check (option 4)

`scripts/word/word-to-pdf.ps1` opens each `.docx` in a folder with desktop Word (read-only),
saves Word's own PDF beside it and writes `word-check.json` with Word's page count for each file
(it must be 2) and whether Inter is installed. It does what `docx2pdf` does, with nothing to
install. Run it only with Tim's agreement, on a Windows computer with Word:

```
powershell -ExecutionPolicy Bypass -File word-to-pdf.ps1 -Folder "C:\path\to\word-files"
```

It is needed again whenever the Word writer or the font changes. Things to
look for in Word's PDFs: two pages each; card bottoms within 3 mm of the PDF writer's; fraction
size and spacing; that the SVG diagrams (not the PNG fallbacks) printed; and, after typing extra
words into a card, that the card grows and nothing is hidden.
