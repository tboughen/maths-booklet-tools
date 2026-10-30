RATIO TABLES — HUMAN EDITOR AND SHARED MCP RENDERER

Open the human editor at ?tool=ratio-table under the normal website base path.
Use the shared navigation to switch between Graph tool, Ratio tables and Question bank.
Human editing and exports use the browser; the MCP service is not required.

Design and scope
One to three columns and one to six data rows, plus headings. The ratio-lesson-v1 profile
uses a 3 cm table body, 1 cm rows, 12 pt bundled STIX text and 2.25 pt centre/header
rules at Standard size. Compact is 80%; Large is 120%. The exported size includes
margins and scaling annotation gutters. Preview zoom changes screen size only.
There is a divider between each pair of columns and one rule under the headings;
there is no outer box or printed row grid. Two-column diagrams keep the original
layout exactly. A three-column diagram reserves a scaling lane beside each
column so its arrows and factors explicitly include the middle column. Default headings are italic x/right-arrow and y/up-arrow.
Custom headings accept up to 12 ASCII letters, digits, spaces, underscores or
hyphens, subject to the available width. Curved scaling arrows are vector paths
with explicit oriented arrowheads. Fractions are stacked with a fraction bar.

Cells and scaffolds
Value prints the specified integer, decimal or fraction. Empty leaves clear
space; Answer line prints a writing line. These are distinct from the value 0.
Values, blanks and answer lines are never changed by switching presentation.
Simple hides all scaling annotations but retains the saved steps. With scaling
arrows enables annotations; Show arrows and Show operation labels can then fade
each separately. Editing guides are optional and never appear in any export.

Scaling steps connect adjacent rows and apply one factor to every column. Choose
Multiply or Divide, enter a factor and deliberately press Fill next row if the
answers should be supplied. If any target contains a value, confirmation is
required. Filling requires all source values and a valid operation. Row deletion
removes only its connected steps; insertion removes a step across the new row.
Every change and confirmed example/file/link replacement is undoable.


Direct editing and controls
The toolbar matches Graph tool: Edit, Add arrow and Edit headings, then history,
Reset and Copy for Word. Lower-emphasis structural actions are grouped separately.
Click a heading or cell and type; Enter applies, Escape restores and Tab moves
through the fields. The default heading fields contain editable Unicode x → and
y ↑. Backspace/delete removes the arrow; typing → or ↑ at the end restores it.
The legacy text/direction representation preserves untouched saved diagrams.
Clicking away clears all diagram selection, including arrow-source highlighting;
invalid panel drafts remain mounted for correction without selection highlights. Selected-cell settings distinguish Value, Empty and Answer
line. Clearing an answer-line cell preserves its scaffold until its type changes.
Add row and Remove row sit together below the diagram; Remove column sits below
Add column at its right edge. These controls appear only on the diagram.
Visible Remove row and Remove column actions use the selected item
or the last one when nothing is selected. At least one row and one column remain.
Removal is immediate and undoable, and removes affected steps. A new column contains empty cells and never infers pupil answers.
Choose Add arrow and click a source row followed by the row immediately below,
or select the rows and operation in the settings. The initial arrow is multiply
by 2; edit its operation/factor in the contextual panel. Click the number beside
any arrow to edit the factor directly. Enter or clicking away applies a valid
factor; Escape restores it. Decimals and fractions are supported. Every copy of
the same step stays synchronized, including all three columns. Values stay
unchanged until an explicit Fill next row. Invalid drafts remain visible, block
exports and cannot be overwritten through another copy or the side-panel factor.
Click the curved arrow to open its settings. Selected source/target rows
are highlighted only in the editor. Invalid drafts remain visible when moving
between cells and disable structural changes and exports.
Fit to screen is the initial preview zoom; it keeps text at least at 100% and
uses bounded horizontal scrolling when a three-column table does not fit. On
small screens both pairs of structure controls sit below the table.
IBM Carbon button hierarchy, grouping and focus guidance informed the controls;
the editor reuses Graph tool's classes without adding a Carbon dependency.
https://www.carbondesignsystem.com/building-blocks/core/components/button/guidelines

Numbers and validation
Enter strings such as -3, 0.125 or 2/3. Decimals retain decimal presentation;
fractions are reduced and negative denominators are normalized. Arithmetic uses
exact bounded rationals, including explicit fills. No expressions or exponents.
Input: 32 characters, six decimal places; reduced absolute numerator at most
1,000,000,000, denominator at most 1,000,000 and absolute value at most 1,000,000.
Numbers and headings must also fit the fixed print font; a shorter value/fraction
may be needed. The editor will report overflow rather than shrinking the text.
Invalid or unfinished input stays visible and disables exports until applied or
cancelled. Enter applies it, Escape returns to the last committed value.
Invalid input is not written into the saved draft.

Operation and proportionality disagreements produce editor/MCP warnings while
keeping the entered values. This supports deliberate mistake questions. Warnings
and corrected answers are not added to the pupil diagram. Structural failures,
unknown IDs, duplicate/nonadjacent steps and division by zero refuse the change.
All-zero complete rows do not determine a unique ratio. No gradient/equation is
automatically printed or inferred.

Saving, sharing and recovery
The ratio draft uses maths-booklet-tools:ratio-table-envelope:v1, independent of
all graph keys. Save editable table downloads the complete JSON envelope. Two-column tables with at least two rows
retain schemaVersion 1 / ratio-1 and their hashes; one-row, one-column or three-column tables use
schemaVersion 2 / ratio-2. Existing saved files, links and the storage key are
unchanged. Removing a column is immediate and undoable. Returning to two columns with at least two rows
returns to the original format. Older website versions cannot open three-column
files; the current editor can open both formats.
Open saved table and ratio links first show a confirmation preview. Cancel leaves
the current table unchanged; a confirmed opening is one undoable change.
Share links use ?tool=ratio-table#ratio-table=...; the fragment stays in the browser.
Anyone holding that link can open the entered values. Oversized links use JSON.
Files are limited to 64 KiB; canonical envelopes to 8 KiB. Unknown versions and
foreign graph files refuse. Corrupt device data is preserved until a recovery
copy is downloaded and the user confirms starting fresh. A changed draft in
another tab refuses that recovery replacement. Storage failure is shown clearly;
use the editable file to retain work when device storage is unavailable.

Word and print exports
Copy for Word prepares a CRC/density/dimension-verified 600 ppi PNG and copies
image HTML with physical width and height in centimetres. If copying is blocked,
download PNG and insert it into Word instead. Keep the aspect ratio and compare
Word's image size with the print size displayed beneath the preview.
The pasted table is an image. Edit values through the website's editable file.
PNG downloads have a white background and 600 ppi metadata. Browser SVG includes
bundled fonts; MCP SVG outlines glyphs, declares physical centimetre dimensions
and needs no installed font. Exports contain only the chosen pupil-visible table.

Examples and checks
docs/ratio-table-examples contains seven editable JSON, outlined SVG and verified
600 ppi PNG examples: simple, worked, fraction scaffold/completed, negative, empty,
and six rows. review-preview.png compares the two principal reference styles.
verification.json records the canonical content hashes and print dimensions.
Regenerate examples with node scripts/render-ratio-examples.mjs.
Regenerate font advances with Python scripts/ratio-font-metrics.py; it reads the
bundled OpenType hmtx/cmap tables without an external package. Native visual
tests independently qualify actual glyph ink and arrow pixels.

Qualification commands
npm run lint
npm test
npm run typecheck
npm run build
npm run test:e2e
The service pretest/build is included. See RATIO-TABLE-MCP.txt for the protocol,
Docker memory smoke, release dependency and actual live/account acceptance.
