# Lessons from Graph tool and Ratio tables

These examples explain the design choices behind the [tool creation guide](TOOL-CREATION-GUIDE.md). They cover development through 14 October 2026. Commit links identify the relevant changes; the principles describe how to apply those changes to future tools.

## Graph tool

The first graph editor already supported mathematical objects, equations, grid controls, persistence and export. Subsequent work refined the full teacher workflow: matching exam conventions, making controls easier to use, aligning pointer input, improving object selection and ensuring the diagram arrived in Word at a useful size.

| Development | What changed | Lesson for the next tool |
| --- | --- | --- |
| Initial editor and exam styling, 2 September | A coordinate editor was followed by refinements to exam-style artwork. | Start from the intended classroom resource, including mathematical typography. [Initial editor](https://github.com/tboughen/maths-booklet-tools/commit/4c93290be1af67769eb5d06b01cd4c0bfee8f04e), [styling](https://github.com/tboughen/maths-booklet-tools/commit/813e65f3). |
| Controls and selection, 2 September | Axis-end controls were enlarged and repositioned; later changes addressed pointer alignment and object selection. | Place actions beside their effect, and test hit areas and coordinate mapping at the actual display size. [Controls](https://github.com/tboughen/maths-booklet-tools/commit/495ac771fc465317efe0cb8a6bb22cd103461168), [pointer alignment](https://github.com/tboughen/maths-booklet-tools/commit/83665f08), [selection](https://github.com/tboughen/maths-booklet-tools/commit/6507d81c711d4e0199493573b58bcb529bc9e86b). |
| Word output, 2 September | The main action became **Copy for Word**, with subsequent size/resolution preservation and tighter export cropping. | Treat the destination application, physical size and crop as acceptance criteria from the start. [Copy action](https://github.com/tboughen/maths-booklet-tools/commit/5ab7e089815fa7932e5a29459a1b1c09e26066b8), [size preservation](https://github.com/tboughen/maths-booklet-tools/commit/a634566b), [crop](https://github.com/tboughen/maths-booklet-tools/commit/bdb1252877ff4c4e0f5a85a0469c77b05ad80a85). |
| Editable exchange and MCP, 6 October | Versioned files and editor links connected human editing with direct AI creation through a shared core. | Make generated resources reopenable and editable; keep browser use independent of the optional service. [Integration](https://github.com/tboughen/maths-booklet-tools/commit/071c6283). |
| Integer axis labels, 12 October | At two squares per unit, label positions were anchored to zero rather than counted from an edge. | Tie mathematical display rules to mathematical coordinates. Test odd/even bounds, negative coordinates, mixed axis scales and resizing. [Correction](https://github.com/tboughen/maths-booklet-tools/commit/a53cfba3). |

The axis example is especially instructive. Labelling every second grid position can look correct for one set of bounds yet produce half-integer labels after the grid is resized. The correction changed label placement in the preview and export, including layout calculations, while retaining half-unit grid positions and plotting accuracy. A visual rule needs tests across the transformations a teacher can actually perform.

## Ratio tables

The initial ratio tool established the lesson-style representation: explicit values, empty cells and answer lines; optional scaling steps; exact fractions; and Word/image/editable exports. It already offered settings-panel controls for several operations. The later interface work made those operations visible and natural on the diagram itself.

| Development | What changed | Lesson for the next tool |
| --- | --- | --- |
| Initial lesson table, 7 October | The browser and MCP service shared a mathematical core, with pupil blanks preserved and filling made explicit. | Represent teaching choices in the model; automatic computation must not erase the exercise. [Initial implementation](https://github.com/tboughen/maths-booklet-tools/commit/8b895caf). |
| Connector import repair, 9 October | Positional tuple array schemas were replaced with homogeneous items and bounded lengths for discovery compatibility. | Test the actual client's import, as well as the service's own calls and validators. [Schema repair](https://github.com/tboughen/maths-booklet-tools/commit/e4a0882e). |
| Direct editing and a third column, 12 October | Headings and cells became directly editable, with GUI structure/arrow controls and a scaling lane beside every column. | Extending a representation needs a fresh visual review; repeating a two-column layout may leave the middle column unclear. [Direct editor](https://github.com/tboughen/maths-booklet-tools/commit/56bf1365). |
| Removal and deselection, 12 October | Row/column removal, editable default heading arrows and complete click-away deselection were added. | Pair creation with removal. Useful defaults should be editable, and focus/selection feedback should end when its interaction ends. [Follow-up](https://github.com/tboughen/maths-booklet-tools/commit/81ecf87d). |
| Grouped structure controls, 12 October | Add/remove controls moved together beside the diagram; duplicated toolbar controls and routine deletion confirmations were removed. | Avoid repeated controls and use Undo for small reversible edits. [Control grouping](https://github.com/tboughen/maths-booklet-tools/commit/01d6de5f). |
| Direct factor editing, 12 October | Clicking an arrow number opened an inline editor. All copies stayed synchronized; column controls were stacked and mobile layout refined. | Make the visible quantity editable, retain one source of truth, and inspect focused fields on narrow screens. [Factor editing](https://github.com/tboughen/maths-booklet-tools/commit/f0e766f9), [mobile refinement](https://github.com/tboughen/maths-booklet-tools/commit/c99a2813). |
| Extended service release and descriptions, 13 October | The connector gained extended shapes and column operations; descriptions clarified nested payloads and legacy defaults. | Website capability, deployed service capability and usable client definitions require separate verification. [Service qualification](https://github.com/tboughen/maths-booklet-tools/commit/0b35bb05), [definition clarity](https://github.com/tboughen/maths-booklet-tools/commit/4fb35f099e9dd787cff08914110a8d9866eeb594). |

Two choices are worth preserving together. First, a scaling step is shared across the columns, so editing one displayed factor updates every copy. Second, this does not recalculate the cells: a teacher may be preparing a scaffold or an error-spotting task. Consistency of representation and preservation of teaching intent are separate requirements.

Compatibility also shaped the extension. Existing two-column tables with at least two rows retain schema 1 and renderer ratio-1. Other supported shapes use schema 2 and ratio-2. Removing a column can return a table to the earlier canonical format, so clients must continue with the returned document and hash. The details are in [Ratio table MCP](RATIO-TABLE-MCP.md).

## All tools output previews

On 14 October, Tim asked to keep the small tool icons while adding examples of what each tool generates. The Graph tool, Ratio tables and Table of values & graphs cards gained actual exported artwork on the right, with the image stacked beneath the text on narrow phones. Icons, descriptions and the whole-card launch links were retained. The ratio sample deliberately keeps an answer line.

The examples were generated locally from the shared core renderers after the connector timed out, with bundled mathematical fonts outlined into SVG. Saved editable examples, card-size visual review, responsive/navigation checks and live byte comparisons established that the images accurately represented the tools. The website release was [794ee8ff](https://github.com/tboughen/maths-booklet-tools/commit/794ee8fff0e4849e4c8a7639396d1b209428f451); its Cloudflare deployment is separate from a main-branch merge.

The reusable lesson is to include a discoverable example in each new tool's first release, using the shared registry/card implementation and the tool's real rendering. [All tools card previews](TOOL-CARD-PREVIEWS.md) records the examples and full convention.

## Shared direction

The 15 October consistency preview applies this direction across all six editors: a shared menu and print-size information, retained invalid Graph drafts, fixed-size Graph controls beyond the complete white artwork, source-linked quadratic examples, compatible portable browser defaults and bounded editable Venn links. The [shared contract](BOOKLET-CONSISTENCY.md) records the reusable behaviour; this entry does not claim that the preview was published.

The [11 October site organisation change](https://github.com/tboughen/maths-booklet-tools/commit/493f6b00) brought both editors into the Question bank's visual language and introduced shared navigation and a tool registry. This made consistency an implementation default and preserved drafts and undo history while switching pages.

The resulting design direction is a specialist mathematical editor inside a familiar shell. Reuse the shared navigation, visual hierarchy, editing conventions, recovery and export behaviour. Design each new representation around its own mathematics and classroom use.

## Plotting quadratic graphs: clean resource and source examples, 14 October

Tim requested a white resource area that less technical teachers can screenshot directly. Axis controls now sit beyond the resource in the blue workspace, aligned with their axes; table controls sit further right at table height. Transparent direct editing remains on the artwork. The shared bar places image-only Copy to clipboard before Copy for Word, keeping the Word physical-size route. The stable route and editable file format are unchanged by the new display name.

The quadratic presets demonstrate another reusable feature: editable examples linked to real published past-paper questions. Include this wherever suitable questions exist in future tools, retaining traceable sources and pupil blanks and making worked output explicit. See the guide and brief for acceptance cases.

## Source-linked Graph and Ratio examples and clearer range buttons, 14 October

Graph tool and Ratio tables gained verified source-question cards with separate blank/scaffold and worked actions. The source opens alongside the editor; confirmed replacement is undoable. The [example record](../content/TOOL-SOURCE-EXAMPLES.md) documents the checked values and deliberate adaptations. Plotting quadratics reuses Graph tool’s 48 px rounded +/− design without adjacent numeric readouts; exact bounds remain available through the printed axis labels.

## Reference implementation

The 14 October [three-editor layout audit](../archive/EDITOR-LAYOUT-AUDIT.md) extends this direction to Table of values & graphs: a shared document utility bar, specialist actions in the right-hand inspector, and selected local controls beside the resource. Direct editing remains useful without putting every settings panel beside the diagram.

- [Adding a booklet tool](ADDING-BOOKLET-TOOLS.md): registry, shell, page lifetime and navigation.
- [Ratio table editor](RATIO-TABLE-TOOL.md): direct editing, teaching states, arithmetic, recovery and output.
- [Ratio table MCP](RATIO-TABLE-MCP.md): versions, operations, discovery, artifacts and release checks.
- [Graph integration runbook](../release/GRAPH-MCP-RUNBOOK.md): shared-core architecture and service qualification. Its older deployment examples must be reconciled with the current production configuration.
- [Ratio reference artwork](../ratio-table-examples/review-preview.png): simple and worked lesson styles, alongside saved examples in the same directory.

For this guide's baseline, repository main was [3e7c4d91](https://github.com/tboughen/maths-booklet-tools/commit/3e7c4d91c8e305b64e4e33bec63ed0215c002578). The live [Graph tool](https://mathsdock.co.uk/?tool=graph) and [Ratio tables](https://mathsdock.co.uk/?tool=ratio-table) were also inspected for their shared layout and visible controls. These observations support the design examples; they are not a fresh release qualification of either tool.


## Eight-editor usability pass, 17 October — local review candidate

The local usability candidate puts renderer-derived examples at the start of all eight workflows, fits the complete resource in both screen dimensions, and supplies consistent preview and inspector navigation. Worked examples use separate browser documents. Number-line notation and straight-line equation input are bounded adapters to existing mathematical models. Core renderers, file versions and physical writing dimensions remain the compatibility boundary. See [the shared contract](BOOKLET-CONSISTENCY.md#eight-editor-usability-workspace). This is a local implementation record, not a merge or publication claim.


## Follow-up usability refinement, 17 October — local candidate

The follow-up retains white breathing room and exact exported margins, while giving the resource more space through measured preview sizing and simpler interface hierarchy. Triangle grouped editing moves beside the resource; mathematical input is initially visible. The toolbar uses Copy image, Copy for Word and an independent File menu with existing payloads. Tim explicitly changed worked-version behaviour: replace the current resource without confirmation and use one-step Undo/Redo, retaining earlier history. Older separate worked documents remain compatible. Existing search, thumbnails and scaffold replacement protections stay. This is an implementation record for local review, not a merge or publication claim.
