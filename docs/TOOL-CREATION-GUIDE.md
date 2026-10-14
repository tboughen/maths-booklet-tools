# Creating MathsDock tools

MathsDock booklet tools help teachers make mathematically precise diagrams, adapt them for teaching, and put them into Word at a dependable print size. A new tool should make that whole journey straightforward: create, edit, scaffold, export, save and reopen.

Graph tool and Ratio tables establish the starting conventions. Their development shows that direct editing, well-placed controls, faithful mathematical notation and reliable exports matter as much as the range of features. Use the principles below when proposing or building an additional tool. Choose the mathematical representation for the teaching task; reuse the familiar MathsDock interaction and delivery patterns.

Start with the [new tool brief](TOOL-BRIEF-TEMPLATE.md). Consult the [development examples](TOOL-EVOLUTION.md) for the decisions behind these principles and [Adding a booklet tool](ADDING-BOOKLET-TOOLS.md) for the code integration instructions.

## Start with the teaching resource

Describe what the teacher needs to produce and what the pupil should see. For example, Graph tool produces a coordinate diagram on a physical 1 cm grid; Ratio tables produces a lesson-style table with optional scaling arrows and deliberate gaps for pupils to complete.

Before adding controls, specify a small set of representative outputs: a simple example, a scaffold with missing answers, a worked example, and a demanding example with fractions, negative values or the largest supported structure. Decide the notation, dimensions, line weights and answer spaces from those outputs. Keep examples editable so they become both starting points for teachers and lasting regression cases.

Define the first release around a coherent teaching task. A tool does not need every possible annotation, arbitrary styling or unlimited dimensions. Give each limit a mathematical, layout or performance reason, explain it in the interface, and avoid borrowing another tool's row or object limits without checking the new use case.

Include a representative output image on the All tools card from the first release, alongside the existing small icon. Generate it from the tool's real export renderer, preserve any illustrative pupil blanks, and keep it legible at card size. Follow [All tools card previews](TOOL-CARD-PREVIEWS.md) for the reference examples, SVG generation, registry fields, responsive layout and review checks.

## Make the diagram the main editing surface

Place the common action where the teacher is looking. Graph tool locates plus and minus controls at the axis ends. Ratio tables progressed from settings-panel editing to clicking headings, cells and arrow factors directly. A capability that exists only in a distant settings panel may still be difficult to discover.

Use these defaults:

| Teacher intention | Preferred interaction | Supporting control |
| --- | --- | --- |
| Change visible text or a value | Click or tap it and type | Labelled contextual input for precision and keyboard access |
| Change an object | Select it in the diagram | Stable settings panel showing only relevant properties |
| Extend or shorten the structure | Paired controls next to the affected edge | Explain the affected row, column, interval or object in its accessible name |
| Add a relationship | Choose the relationship action, then its endpoints | Explicit endpoint and operation fields where useful |
| Change a repeated label | Edit any displayed copy | All copies derive from one stored value |
| Finish the resource | Image-only **Copy to clipboard** first, then **Copy for Word** | A nearby download menu for alternative formats and editable files |

Keep an ordinary edit available immediately. Use a mode only when it disambiguates actions such as selecting, drawing or adding a relationship. Show the active mode and provide a clear exit.

For text and number fields, use Enter to apply, Escape to restore, and predictable Tab navigation. Clicking away should clear obsolete selection highlights. Specify separately what happens to a valid edit and an invalid draft on blur; losing selection must not silently discard invalid text.

Direct manipulation needs an accessible equivalent. Every essential operation should work by keyboard and have a labelled control; a drag gesture or a tiny visual target cannot be the only way to perform it.

## Group controls by their purpose

Use the existing shared header, tool navigation, page heading, workspace and settings panels. The Question bank's white panels, pale blue-grey background, navy text and blue actions became the common interface style. Keep the current MathsDock branding and shared tokens rather than copying an older screenshot's header.

Within the editor:

- Use `EditorToolbar` for the same Undo, Redo, Reset, **Copy to clipboard**, **Copy for Word** and download bar across editors. Keep save status in the page heading and preview-only controls immediately above the resource.
- Put specialist modes and actions in labelled right-hand panels, followed by contextual and whole-resource settings. On narrow screens these panels move below the resource. Use local editors for small values or labels when proximity aids editing; broader configuration belongs in the inspector.
- Place structure controls beside the diagram. Ratio tables pairs Add/Remove row below the table and stacks Add/Remove column at its right. Avoid duplicating those controls in the toolbar.
- Keep selected-object settings in a predictable place. Separate these from whole-diagram settings such as print size and annotation visibility.
- Collapse less frequent options, help and examples where that keeps the main workflow clear.

The [layout audit](EDITOR-LAYOUT-AUDIT.md) records the Graph, Ratio and Table of values & graphs comparison behind this placement convention. Similar utilities share one component; specialist controls keep their mathematical purpose and do not need identical content.

Use Carbon's button hierarchy and grouping guidance as a reference, while reusing MathsDock's existing components and styles. Adopting Carbon as a dependency would be a separate implementation decision. [Carbon button guidance](https://www.carbondesignsystem.com/building-blocks/core/components/button/guidelines).

Reuse Graph tool’s large, rounded, raised +/− design for axis-end range controls. Keep adjacent utility readouts out of the clean workspace; offer precise endpoints in labelled axis settings while retaining the printed mathematical tick labels.

Apply the placement principle to each representation. A number line may put interval controls at its ends; it need not inherit a ratio table's row and column controls.

## Keep the resource easy to snip

Treat the white resource rectangle as the complete pupil artwork. A teacher should be able to snip that rectangle without capturing visible buttons or settings. Put visible utility controls in the surrounding blue workspace, beyond the full resource boundary, even when the artwork has white margins. Align axis controls with their axis; place table structure controls just to the right of the resource at table height. Preserve useful transparent direct-edit targets on values and labels, with keyboard alternatives, and clear selection feedback when editing ends. Keep broader specialist actions in the right-hand inspector.

Check combined, table-only and graph-only output, all supported preview zooms, maximum structures and narrow screens. Controls must remain reachable by scrolling within the workspace, avoid each other and never overlap the white rectangle. Preview zoom and control placement must leave print dimensions and mathematical content unchanged.

## Include examples linked to past-paper questions

Where suitable questions exist, provide editable starting examples linked to the actual source question in the Question bank. Record the verified paper, tier, question and stable question link with each example. Reuse current published sources; do not invent a reference or link to an unrelated question. Explain the mathematical or teaching feature the example illustrates, such as mixed scales, fractions or a deliberate straight-join error.

Keep pupil blanks and scaffolds in the default example. Offer calculation, plotting and worked copies explicitly. Replacing current work should follow the tool's confirmation and Undo conventions. Treat source-linked examples as a design requirement to consider for every future tool; document why they are unavailable or inappropriate when no suitable source exists. Validate the source links and editable example, including its actual exports, during acceptance.

The [Graph and Ratio examples](TOOL-SOURCE-EXAMPLES.md) show verified source cards, separate scaffold/worked actions, confirmation and Undo, and direct links that keep the editor open. An adapted teaching step should say which part of the source question it supports.

## Preserve the teacher's mathematical intent

Separate mathematical content, teaching presentation and temporary editor state.

| State | Examples | Required behaviour |
| --- | --- | --- |
| Mathematical content | Coordinates, cell values, a scaling factor | Change only through an explicit edit or calculation action |
| Teaching presentation | Answer lines, hidden operations, visible equation labels | Preserve when unrelated content or display settings change |
| Editor state | Selection, handles, zoom, unfinished input | Keep out of pupil exports; preserve useful session state during navigation |

An empty space, an answer line and the number zero are different states. Store them explicitly. Do not infer that a blank is an error or fill it merely because the answer is calculable. In Ratio tables, changing ×3 to ×4 changes the annotation; **Fill next row** is the separate action that supplies answers. Hiding scaling arrows retains the saved operations. New columns begin with empty cells.

Use one stored relationship for repeated representations. A three-column ratio table displays the same step beside every column, so editing any factor changes all three copies together. Future tools with repeated lengths, labels or probabilities should decide which values share meaning and which are independent.

Distinguish invalid data from an intentional mathematical disagreement. Division by zero, impossible references and malformed input must be rejected. A teacher may deliberately enter inconsistent values for an error-spotting task; where that is meaningful, show a teacher-facing warning and preserve the values. Do not print the warning or silently correct the pupil resource.

Choose arithmetic and notation suitable for the subject. Ratio tables uses exact bounded rational arithmetic and stacked fractions. The graph axis correction anchored integer labels to zero while retaining half-unit grid positions. Display rules must not alter the underlying mathematics.

## Make editing reversible and validation honest

Treat each meaningful edit as one undoable action, including a drag, a structural change and a confirmed file replacement. Undo/Redo should restore related annotations and values together.

Routine row and column removal in Ratio tables became immediate and undoable after review. Use that pattern for comparable local edits. Reserve confirmations for changes that replace substantial work or overwrite existing answers, such as opening another document or explicitly filling an occupied target row. State exactly what a removal affects and keep the minimum valid structure intact.

Keep unfinished or invalid input visible with a specific explanation. Never export the last committed value while making the teacher believe their visible edit was accepted. Block export and any conflicting action until the draft is applied or cancelled. If a value has several editors, one invalid draft must not be overwritten through a different copy.

Save valid documents under a tool-specific storage key. Preserve corrupt recovery data, offer a recovery download, and require a deliberate fresh start. Show storage failures and offer editable-file saving. Another tab's newer draft must not be overwritten by an old recovery action.

## Treat Word and print output as part of the product

Specify physical output size before polishing the preview. Graph tool's 1 cm squares and Ratio tables' fixed lesson typography are output requirements. Preview zoom is only a viewing aid; it must not change printed dimensions or the document.

For comparable diagram tools, follow the existing output pattern:

- Image-only **Copy to clipboard** as the first copy action; reuse the verified print PNG and give a useful download fallback when the browser denies access.
- **Copy for Word** with an image and physical-size information.
- SVG for scalable artwork, and verified 600 ppi PNG for dependable insertion and printing.
- Editable JSON for later changes in MathsDock, with a compatible editor link where supported.

Keep mathematical artwork separate from interface styles. Export no handles, focus rings, guides, buttons, teacher warnings or selection shading. Crop closely enough for placement in a worksheet, while retaining complete arrowheads, labels, fraction bars and intended writing space. Use bundled fonts or outlined glyphs as appropriate to the renderer; do not rely on an unverified recipient font installation.

Check the actual exported files. PNG dimensions and density metadata, SVG centimetre dimensions and correct crops are separate properties. A clear on-screen preview does not prove any of them. A browser copy test also does not prove how real Word pastes the image: verify Word size, aspect ratio and sharpness when establishing or changing the export route. Report any unperformed Word check explicitly in the handover.

## Design narrow layouts alongside desktop layouts

Check desktop, tablet and 320–375 px screens while implementing the controls. Ratio-table work needed follow-up fixes for font metrics, factor editors and column controls at narrow widths; default two-column screenshots would not have exposed the three-column problems.

Keep controls usable rather than shrinking the complete editor to fit. Stack settings and structure controls when needed. Where the mathematical diagram cannot fit legibly, contain horizontal scrolling within its workspace and keep essential actions reachable. Test the largest supported structure with long valid values and fractions, including focused inline fields and validation messages.

Check visible keyboard focus, descriptive names, logical reading order, touch targets and disabled-state explanations. Use colour together with text or other state cues. Reuse accessible controls and verify the specialist diagram interactions rather than assuming the shared shell makes the whole tool accessible.

## Share the mathematical implementation

Follow the current separation between the browser editor, a reusable mathematical core, and optional service adapters:

| Responsibility | Existing examples | Direction for a new tool |
| --- | --- | --- |
| Navigation and page lifetime | `src/site/SiteApp.tsx`, `src/site/registry.ts` | Register once and inherit the shared shell |
| Editor interactions | `src/components`, `src/ratio-table` | Keep focus, selection and draft input here |
| Schema, maths and artwork | `packages/graph-core`, `packages/ratio-table-core` | Reuse validation, layout and rendering across delivery routes |
| Browser export and recovery | `src/export`, `src/ratio-table/export.ts`, persistence modules | Preserve print dimensions and keep storage distinct |
| Optional connector | `services/graph-mcp` | Adapt the shared core; do not implement different mathematics |

Keep ordinary human editing and export independent of the MCP service. A new diagram tool should not acquire a network dependency solely because AI-assisted creation is also useful.

Keep tool IDs stable and use explicit `?tool=…` routes. Editors remain mounted after first use so switching tools preserves work and undo history. Only the active editor should handle its shortcuts, imports and modal overlays. Follow the detailed navigation and recovery rules in [Adding a booklet tool](ADDING-BOOKLET-TOOLS.md).

## Plan compatibility and optional AI access together

Version the saved document, renderer and style deliberately. Retain representative older files and links as fixtures. The ratio extension kept ordinary two-column documents in their existing format and preserved their hashes and appearance; extended shapes use a newer format. A version change must have a clear interpretation, import behaviour and rollback consequence.

Where an MCP connector is in scope, reuse the capabilities/create/revise pattern. Return the canonical document envelope, its content hash, a preview, real downloads, warnings, physical dimensions and an editor link. Revisions should operate on stable IDs, check the supplied base hash and apply all operations atomically.

For portable print outputs, follow [MCP diagram outputs](MCP-DIAGRAM-OUTPUTS.md).
Return physical facts as response metadata outside the saved definition/hash;
qualify actual SVG consumption into vector PDFs rather than trusting extensions
or previews. Optional placement advice calculates the effects of a supplied size
without editing or inspecting the consumer's booklet. Optional source bundles
remain bounded and stateless; the consuming AI owns assembly and saving. Avoid
adding persistent artifact storage, extra mandatory hashes or broad document
migrations merely to improve printing.

Treat tool descriptions as a usable interface. List complete operation payloads, nested fields, numeric-string conventions, index bases, defaults and supported ranges. The ratio connector needed explicit clarification that `columns: 2` was a legacy default rather than the maximum. Clients must reuse the returned envelope and hash because structural changes may change the canonical version.

Test the schemas exposed by actual discovery as well as internal validators. Ratio-table tuple arrays passed internal use but failed ChatGPT import; homogeneous array schemas plus server-side shape checks resolved that incident. Check the real consuming client and a fresh conversation when connector definitions change. Do not substitute a plausible image or Markdown table for a failed tool call.

Retain existing hosting and cost constraints. Reuse the existing service when appropriate; adding another tool does not by itself justify a new paid service, database or model API dependency. Keep documents and pupil information out of service logs.

## Build and review in small complete steps

1. Complete the brief and agree the intended resource, interaction choices and scope. A request to plan remains a planning task.
2. Build one complete example through editing, undo, saving, reopening and export. Review its layout before expanding the feature range.
3. Add scaffolds, difficult values and the largest supported structure. Review direct interaction and narrow-screen behaviour together.
4. Qualify any optional connector using the same examples and compatible older files.
5. Before an authorised release, check the exact candidate and affected existing tools. Record website deployment, service deployment and consuming-client acceptance separately.

Use the following as an acceptance checklist, marking irrelevant checks with a reason:

- [ ] The white resource can be snipped without visible utility controls at every composition and zoom; nearby blue-space controls remain reachable.
- [ ] Suitable source-linked past-paper examples have verified question links, editable presets and pupil blanks preserved; any exception is explained.
- [ ] Image-only copying writes an actual PNG to the clipboard and handles refusal; Copy for Word retains its physical-size contract.
- [ ] A teacher can produce the representative output without hidden configuration or technical knowledge.
- [ ] The All tools card retains its icon and includes an accurate output preview, meaningful alternative text and a working image link; desktop and narrow-screen layouts are reviewed.
- [ ] Common edits are discoverable on the diagram, with labelled keyboard alternatives.
- [ ] Related controls are grouped; narrow layouts and focused inputs remain usable.
- [ ] Blank, answer-line and zero states survive edits, visibility changes, saving and reopening.
- [ ] Mathematics and notation remain correct under resizing, negative values, fractions and mixed scales where applicable.
- [ ] Repeated representations remain synchronized; unrelated content stays unchanged.
- [ ] Undo/Redo, removal, invalid drafts, import cancellation and storage recovery behave as specified.
- [ ] Navigation away and back preserves work; inactive tools do not intercept input.
- [ ] Actual SVG/PNG files have correct content, crop, dimensions and density, without editor furniture.
- [ ] Real Word insertion is checked for a new or changed clipboard/export path, or the outstanding check is recorded.
- [ ] Older saved files and links retain their agreed meaning and appearance.
- [ ] If included, connector discovery, create/revise, downloads and editor reopening work in the target client.
- [ ] Relevant lint, unit, type, build and browser checks pass; actual visual review covers the difficult examples.
- [ ] Release evidence names the intended production domain and distinguishes merged code, deployed website, deployed service and refreshed client definitions.

Production website checks should target **mathsdock.co.uk**. GitHub Pages and the Render MCP service are separate deployment surfaces; success on one does not establish success on the others. Consult current deployment configuration before releasing, since older runbooks may retain earlier destinations.

## Keep the guidance useful

When review uncovers a reusable lesson, update this guide and the corresponding example or regression check. Keep tool-specific limits and operating details in that tool's documentation. Record the problem, resulting behaviour and reason for the choice so future tools inherit the decision rather than repeating the same correction.
