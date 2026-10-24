# Bar modelling: implementation brief

This brief implements Tim's attached request of 24 October 2026. Source baseline:
main `bc9ac3704586baa7366bd4104dc76c375f521ef1`, tree
`c8f7aedd731dd388201821a4e52e2d91f23143ef`, after PR43. Work is isolated in
`codex/bar-model`. PR41 (Triangles) and PR42 (paper publication) remain independent.
Implementation/testing is authorised. Merge and publication remain separate stages
under AGENTS and the release pipeline. Failed publication40119746997 is ineligible
as a successful baseline; use a complete audit unless a newer eligible successful
baseline is established.

On25 October, main advanced to `b97f3db21576399e1978e2c8e362fb3990899837`
through Mock Set2 PR45. That complete change was merged into this branch before
final qualification, preserving all147 new paper questions and13 browser cases.
The bar-model change itself does not modify the bank or measured percentages.

## Purpose and scope

**Bar modelling**, stable route/document kind **bar-model**, creates teacher-editable
lesson and worked-solution resources: part-whole, comparison, sharing in two or three
parts, fractions of amounts and symbolic unknowns. Pupil scaffolds retain deliberate
blanks; worked versions are explicit presets. The editor is independent of MCP.
There is no automatic question solver, general drawing canvas, graph annotation
tool or worked-solutions pilot redraft.

Explicit feedback governs, then Common Approaches, curriculum workbook, verified
Tim examples, applicable formula sheets and GCSE defaults. Question instructions,
mathematical validity and marking constraints govern throughout. The original
Common Approaches paragraphs171–172 and181–182 and original Number & Proportion
cells C/K69–77 were read without executing macros. They assign bar models to sharing
and known-value problems and ratio tables to simplifying, direct proportion and
multiplier work. Detailed software features below are design proposals, not quoted
departmental requirements.

## Outputs and references

| Example | Structure and known information | Explicit worked information |
|---|---|---|
| BM01 | Eight equal units;3:5;whole64 | Unit8;shares24,40 |
| BM02 | Eight equal units;first three units24 | Unit8;other share40 |
| BM03 | Five/three aligned units;difference16 spans exactly two units | Unit8;shares40,24 |
| BM04 | Nine units grouped2:3:4;whole72 | Unit8;shares16,24,32 |
| BM05 | Eight units;whole400;three shaded | Unit50;selected150 |
| BM06 | Five/three aligned bars;difference two units | Comparison scaffold |
| BM07 | Entire three-unit group is x | Unit x/3;whole8x/3 |
| BM08 | Six parts:0,1/2,0.75,hidden18,answer line,blank;long name | No automatic solution |
| BM09 | Four bars ×24 parts;96 parts;whole braces | Maximum total/per-bar structure |
| H07 | Fifteen units;empty jars150;groups3:4:8 | Unit10;small30,medium40,large80 |
| H18 | Adapted bag A: red three-unit share x | Unit x/3;bag A8x/3 |
| Source sharing | Mock set7 1H Q1:£60 in3:2:5 | Unit£6;Tim£18,Jason£12,Peter£30 |

H07/H18 sources and schemes are retained in Tim's handover. Their2024 questions
are absent from the current published bank: no fabricated bank links are offered.
H07 is the sharing stage only; BM05 supplies the preceding fraction stage with a
different mathematical unit. The final percentage stage belongs in a ratio table.
H18 supports bag A rather than claiming to solve the complete source question.
The source-sharing preset links the actual published `1MA1_MOCK_SET_07_1H_Q1`;
its question and official scheme were inspected. Scaffold answers remain hidden.

The All tools card retains a small icon and actual renderer-derived BM01 artwork.
Editable sources, source metadata and pupil thumbnails use the shared ExampleGallery
and generation script. No independently redrawn or generated illustration is used.

## Model, notation and bounds

The version1 envelope contains kind, schemaVersion, rendererVersion, styleProfile
and document. Each bar has a stable ID, quantity-name label, nonnegative exact
offset and positive-weight parts with stable IDs, labels and light shading.
One presentation.unitMm supplies the physical width of a shared unit across all
bars. Label text does not determine geometric weights or invoke algebra evaluation.
Numbers, fractions, decimals and original variables remain text; simple fractions
are stacked by the renderer. Exact rational geometry accepts integers, four-place
decimals and fractions, normalises them and rejects invalid/zero denominators.
Reduced numerators are bounded by1000000 and denominators by10000.

States value/blank/question/line/hidden are distinct. Text is retained in every
state;0 is a value. Hidden answers do not print. Ordinary resize, relabel, shading,
alignment and print edits never supply or reveal answers. Reveal saved answers and
worked presets are explicit. Teacher-entered mathematical disagreements are kept;
the editor does not evaluate their truth.

A span has two exact bar/part/edge anchors, stable ID, label, side and brace/dimension
style. Its endpoints follow identified parts. Cross-bar differences use their actual
shared-coordinate boundaries. Braces use curved strokes; dimension ticks and straight
extension marks are purposeful measurement geometry. No L-shaped callout leaders are
introduced. A total over sharing uses one contiguous whole bar with grouped shares,
so the whole is unambiguous.

Removing referenced structure fails unless attached spans have been explicitly
removed or discardSpans:true is supplied. The editor shows a concrete removal choice;
Undo restores structure and annotations together. Braces are never silently reattached.

Bounds:6 bars,24 parts/bar,96 parts total,18 spans,30 operations,80 label characters,
32KiB source/request,16000-character editor link. Unit4–16mm,bar height8–16mm,
font10–14pt,name column20–60mm. Actual layout requires every part≥4mm, labels fitting
their segments, complete artwork≤280×260mm and≤32million600ppi pixels. These are
conditional limits; all maxima need not coexist. BM09 demonstrates96 parts at a
useful native size; the15-part H07 fixture is also retained. Overflows give actionable
errors without scaling, clipping or quietly exporting stale data.

## Teacher interactions

| Intention | Direct / labelled interaction | Validation and Undo |
|---|---|---|
| Name/label | Click transparent artwork target; matching inspector buttons | Docked field, explicit Apply/Enter;Cancel/Escape |
| Part geometry/shading | Weight/shade action for named part | Exact draft retained on error;one Undo |
| Add/remove bar/part | Paired controls beyond white resource; selected bar identified | Min/max and affected-span policy;one Undo |
| Brace | Click brace or named inspector action;pick bar/part/edge endpoints | Anchors validated atomically;one Undo |
| Alignment/print | Specialist inspector drafts | One shared unit width;no calculation |
| Worked version | Shared gallery;immediate replacement | One Undo/Redo;earlier history retained |
| Import/scaffold/reset | Pupil preview and replacement confirmation | Cancel preserves work;accept undoable |

The common toolbar provides Undo/Redo/Reset/Copy image/Copy for Word/File. Pending
drafts block conflicting history, replacement and exports, leaving correction or
Cancel available. Selection/hit targets and teacher controls are excluded from
artwork. The shared shell retains mounted editors, drafts and history across tool
switches; only active editors handle shortcuts and fragments. Valid autosave uses
a distinct storage key and compare-before-write; corrupt/newer data are protected
with a recovery download and deliberate fresh-start route.

The preview uses shared fit/zoom controls and fixed-size utilities outside the white
resource. At320–375px settings stack, long structures scroll inside the workspace
and100% viewing remains available. Focused fields are docked and scrolled into view;
the whole interface is not scaled down. Desktop/tablet/mobile emulation, maximum
structures and invalid drafts need actual browser checks.

## Print, files and connector

Browser exports use embedded STIX fonts and existing Copy image/Word physical-size
helpers; service SVGs outline bundled glyphs. Both use the same core layout/SVG,
with explicit millimetre dimensions, black0.3mm bar rules,0.25mm annotations and
light-grey shading. Physical facts remain outside the definition/hash. SVG, verified
600ppi PNG, versioned JSON and bounded editor links preserve complete artwork.
Hidden-answer warnings accompany editable interchange; pupil artwork is default.

The existing service adds bar_model_capabilities/create_bar_model/revise_bar_model.
See [the complete contract](BAR-MODEL-MCP.md) and
[emitted schemas](BAR-MODEL-EMITTED-SCHEMAS.json). Shared direct-SVG,placement and
bundle support accepts bar-model. Old families retain signatures/defaults/files.
The private Mathsdock plugin is the sole package-update target, with identity/App
binding/audience and stronger acceptance instructions preserved through a guarded
current-source overlay. Publication waits for applicable surface approval and actual
implementation availability.

## Acceptance and release record

Core tests independently check BM arithmetic, equal widths, anchored spans, exact
roundtrips, states, structural failures and atomic hashes. Protocol tests cover full
metadata, real downloads, print bytes, bundles, placement and chunk reconstruction.
Browser tests cover direct/keyboard editing, drafts, Undo/Redo, worked replacement,
navigation, recovery, cancellation, source imports and320/375/768/1440px layouts.
The full local SDK→MathsDock→saved JSON→MCP revision→exact SVG journey is separately
recorded from actual connected-client acceptance. Independent vector-PDF consumption,
full existing regressions and exact-candidate hosted qualification remain mandatory
where applicable. No stage is inferred from another.

Native Word insertion, real phone keyboard, physical print and independent teacher
acceptance require their own observations. Actual intended-client discovery and
named execution cannot happen until the new service is available and definitions
are adopted. Preserve pending states, timings/failures and exact source/evidence.
Implementation, tests, qualification, merge, website/service/plugin publication,
client acceptance and Tim's completion confirmation are separate recorded stages.
