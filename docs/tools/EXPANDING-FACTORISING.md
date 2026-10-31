# Expanding and factorising — local implementation, 17 October 2026

- Route: /tools/expanding-factorising
- Core: packages/algebra-grid-core/src/index.ts
- Editor and exports: src/algebra-grid/

Departmental multiplication grids: internal lines only, black on white, genuine
pupil blanks. The multiplication sign is upright 18 pt, centred in its cell;
algebraic x remains italic 12 pt. This applies to saved grids too, without
resizing their cells or altering entries. Product cells default to 15 mm square. Compact 12 mm and Larger
18 mm presets, intermediate sizes and individual 12–45 mm column widths are
available. Applying a cell size explicitly resets individual width overrides.
Paper size/orientation and preview zoom do not alter the physical dimensions.

Automatic compact headings are enabled for new resources: a fully prefilled
heading row is normally 9 mm high; a fully prefilled left column is normally
9 mm wide, growing as necessary for its text up to the configured width. The
row and column are assessed independently. Any blank or hidden entry in an
edge keeps that edge at full writing size. A blank/hidden corner prevents both
compactions. A visible zero is a prefilled entry. Product writing cells never
shrink. Long text still requires an explicit wider column; type is not reduced.
Custom widths (including an explicit first-column width equal to cell size)
are respected. The actual heading dimensions are shown in Print size.

The usual filled 3 x 3 grid is 39 x 39 mm at a 15 mm product-cell size, compared
with 45 x 45 mm with equal headings, saving about 25% of its grid area. A blank
factorising scaffold retains full heading writing space. Clearing/hiding or
adding a blank heading restores space automatically. The Auto setting can be
turned off and undone; this is a presentation change, not a calculation.

Grid rules: Light 0.35 mm (previous Standard), Standard 0.5 mm (previous Bold),
and Thick 0.79375 mm / 2.25 pt, matching ratio tables at standard size. New
resources default to Standard. Saved explicit widths remain unchanged, including
legacy 0.2 mm files, which display a Legacy option. Rules remain internal only;
answer lines stay 0.2 mm. The All tools card uses the actual default renderer.

Compatibility: first-draft files/links with no compactHeadings/gridLineMm fields
reopen with equal headings and 0.2 mm rules; only the multiplication sign is
enlarged. The current saved device draft missing these fields upgrades once to automatic headings/0.5 mm rules
on refresh, retaining its terms, blanks, product-cell sizes and answers; one Undo restores
its previous presentation. Explicit saved choices are not overwritten. Column
fixed flags preserve manual widths; applying a size preset resets those flags.

There are 1–6 terms on each edge (2–7 total cells including headings). This gives
36 product cells at the maximum and a 105 mm square default maximum structure,
while preserving usable writing space and local scrolling on phones. Added cells
are blank. Removal is undoable. Integer coefficients are exact (BigInt), bounded
to +/-999999999999. Individual cell terms and collected polynomials support x
through x^6; calculations reject degree or coefficient overflow. No fractions,
multiple variables or general computer-algebra syntax is implied.

Click a cell to edit; the cell buttons are keyboard accessible. Enter/Apply
commits, Escape/Cancel restores. Clear removes an answer; Hide keeps it in the
editable document while leaving the pupil cell empty. Invalid/pending drafts
guard history, structural changes, replacement and all exports, and survive
switching tools. A floating editor is hidden and inert while its tool is inactive.

When Include question is selected, click the printed question itself to edit
its expression in the same floating editor. Apply/Enter validates and saves one
undoable change; Cancel/Escape restores it. This shares the settings expression,
preserves all grid entries, and works with the grid hidden. The instruction
Expand/Factorise follows the selected mode. Editor controls are never exported.

The blue working area has centred Question above and Answer below buttons outside the
artwork. They mirror visibility settings and are undoable. Adding an empty
question opens its expression editor. Adding the answer explicitly calculates
it using the existing worked-copy rules, saving only the final answer and its
freshness basis; all pupil entries and hidden/blank cells stay unchanged.
Incorrect entered work is rejected, and existing factorising limits apply.
Hide retains the saved answer. Showing it again recalculates it for current work.

Fill products is explicit and confirms overwriting occupied product cells.
Collect like terms / Read factors explicitly saves the final answer. Changing a
heading preserves existing products and warns about disagreements. A saved final
answer has an entry snapshot and must be hidden or recalculated if stale.
The teacher can deliberately accept an error-spotting grid for artwork export;
automatic calculations still require correct mathematics.

Create worked copy opens a separate tab and storage key. It preserves the pupil
original. Automatic factorising supports monic integer quadratics in a 3 x 3
grid and common factors in a single product row. Other shapes can use supplied
correct headings. Integer factorisation checks the whole polynomial, accepts
swapped bracket orientations and handles repeated/negative/zero roots. It does
not print a separate factor-pair table or a trial transcript.

Grid-only is the default. Optional question, final answer and 0–3 answer lines
are outside the cell footprint. Turning off the grid reserves the same physical
working space. The size report gives actual artwork size; grid dimensions are
reported separately. Blank outer cells are never cropped away. The initial
typography is STIX at 12 points with 0.35 mm internal rules and a 1.25 mm horizontal
padding check. Crowding blocks artwork export and asks for a wider column.
Physical handwriting/monochrome-print review remains required.

The current paper-fit check uses 10 mm placement margins; it is placement advice,
not an A3/A4 page or booklet generator. Scaling A3 down to A4 externally turns a
15 mm cell into approximately 10.6 mm; regenerate/reflow to retain cell size.

SVG has explicit millimetres and embedded bundled fonts. PNG uses the existing
600 ppi renderer and checked density metadata. Pixel dimensions round to the
nearest whole pixel, at most 0.0212 mm per edge. Copy for Word uses the same PNG
with physical dimensions in cm. Native Word paste is a separate manual check.
Editable JSON and bounded links include hidden answers, as disclosed in the UI.
Storage recovery protects corrupt originals and refuses to overwrite another
tab's newer work. The editor is independent of the optional live MCP service;
MCP support is documented in [ALGEBRA-GRID-MCP.md](ALGEBRA-GRID-MCP.md). Its service/plugin/client
release evidence is tracked separately from website publication.

Run node scripts/algebra-grid-examples.mjs to regenerate editable presets and
the All tools SVG from the real core, using bundled fonts converted to paths.
Editable reference examples are in docs/algebra-grid-examples/.

Verified source presets: November 2018, Paper 2F, Q26, catalogue identifier
1MA1_NOV_2018_2F_Q26. Actual question and complete mark-scheme images inspected:

```
public/bank/assets/manual/1MA1_NOV_2018_2F_Q26/
580f27610bcded8172c49610c3b351776794067f5c87e4c5caca035c22d17ced/
question/page-1.png and scheme/page-1.png.
```

- Q26(a): (5x+2)(2x-3) = 10x^2-11x-6.
- Q26(b): x^2+4x+3 = (x+1)(x+3).

The grids are explicitly labelled adaptations; the original question has no
grid. Departmental examples are distinct from these source presets. Question
bank links use ?tool=question-bank&question=1MA1_NOV_2018_2F_Q26.

Checks and review evidence belong to the workspace implementation report.
Local implementation/preview, repository merge, production website publication,
MCP deployment and intended-client acceptance are separate stages.
