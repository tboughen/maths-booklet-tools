# Editor layout audit — 14 October 2026

Tim requested an audit, recommendations and implementation for Graph tool, Ratio tables and the quadratic graph editor (Table of values & graphs). The live pages at mathsdock.co.uk were inspected, alongside repository main `9b275a35fbab50915d8023e33ea96ce6ae6f408c`. Desktop visual inspection used a roughly 1265 px browser; responsive candidate checks cover 1440, 1024, 900, 375 and 320 px.

## Audit findings and resulting decisions

| Area | Graph tool before | Ratio tables before | Table of values & graphs before | Improvement |
| --- | --- | --- | --- | --- |
| Common utility bar | Drawing modes, equation, history, reset, split copy/download | Editing modes, headings, history, reset, split copy/download | History, reset, Examples, Layout, separate copy and Downloads; different button styling | One shared `EditorToolbar`: history/reset left, Copy for Word and download menu right |
| Specialist actions | Drawing modes in top bar; object/grid settings on right | Arrow/headings modes in top bar; selection/table settings on right | Large action clusters beside the resource; broader settings in floating editors | Labelled specialist panels on the right; preserve each tool's capabilities |
| Direct editing | Object selection and paired axis-end controls | Click headings, cells and factors; paired row/column controls | Click equation/cells/axis names/endpoints/objects; paired table columns and axis ends | Retain these discoverable actions beside their effect; avoid duplicate structure controls |
| Broad configuration | Stable right-hand panels | Stable right-hand panels | No persistent right-hand inspector; unused right-hand page area, while graph actions consume resource space | Table/graph/layout/example options use the same inspector area; small numeric/text edits retain local editors |
| Save/view information | Save state in heading; fitted graph preview | Save state in heading; preview zoom/guides above resource | Save state beside zoom below toolbar | Save state in heading across all three; view controls remain above resource |
| Visual language | Shared site tokens | Shared site tokens | Separate darker copy button, different padding/radii | Common utility component and shared interface styles; artwork remains separate |
| Small screens | Workspace stacks | Workspace stacks; diagram scrolls | Resource and adjacent controls need a large scroll surface | All inspectors stack using shared breakpoints; contain resource scrolling and keep common actions accessible |
| Download placement | Image and editable menus independently positioned | One export menu | Downloads expand into an inline row | One bounded popover surface per editor; graph image/editable actions grouped within it |

## Implementation boundaries

The design follows the project's direct-editing, control-grouping, keyboard-access, reversible-editing and print-preservation principles. This is an existing-editor layout change, so a new-tool brief is unnecessary.

Specialist actions have a single primary location. Graph Select/Point/Segment/Line by equation and Ratio Edit/Add arrow/Edit headings are in the inspector. In the value editor, Table options, Fill blank values, Plot, Add, Curve, Graph options and Select object live in the inspector, alongside Layout and Examples. The table's column controls and the graph's axis endpoints stay local. Equation, cell, axis and point edits retain proximity; broader controls focus and scroll into the inspector when selected.

No mathematical core, renderer, saved schema, export routine, service definition, catalogue, question-bank feature or deployment configuration changes. Copy for Word still delegates to each existing export implementation. Confirmations, recovery and invalid-draft checks retain their existing responsibilities.

The repository header currently says “Maths Tools”; the audited live production header says “MathsDock”. This task does not alter either branding implementation. Candidate screenshots therefore identify the local repository preview, not a production release.

## Review and release record

Worktree: `web/mathsdock-layout`, branch `codex/consistent-editor-layout`, repository `tboughen/maths-booklet-tools`.

Validation results and retained screenshots are recorded in the local handover under `reports/mathsdock-layout-audit-2026-10-14`. The guide's acceptance checklist is applied to responsive grouping, focused inputs, direct editing, blank preservation, undo, import/recovery, navigation and actual exports. The unchanged mathematical core and existing browser tests provide regression coverage for physical output and older files.

Local results: lint, typecheck and production build passed; 29 unit test files / 173 tests passed. After correcting the graph menu/import interaction, all 10 graph editor unit tests passed again. The final affected browser run passed all 47 checks, including five responsive widths, complete download-menu reachability, Escape dismissal, Ctrl+Y redo, real SVG/PNG dimensions and density, pupil blanks, recovery, older imports and tool navigation. Initial graph-import and ratio click-away regressions were corrected before this final run. The existing large-bundle build warning remains.

The portable development-skill bundle retained with the local handover has been refreshed from the canonical guidance, including this audit. This does not claim an installed or published plugin update.

Real Word insertion is not repeated because the clipboard/export path is unchanged. MCP release and consuming-client refresh are outside this interface-only change. Implementation, local verification, PR creation, merging and production deployment must be reported as distinct stages; a local preview is not deployment evidence.

Trello plugin discovery found Trello but returned `installed: false`; no authenticated board/card read or write was available. The local handover retains the unsaved tracking update. Done requires Tim's explicit confirmation.
