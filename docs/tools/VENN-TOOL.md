# Venn diagrams - website editor, versions 1 and 2

Local preview implementation, 15 October 2026. Not a publication record.

Route: ?tool=venn. Registry: src/site/registry.ts. Editor: src/venn/.
Shared schema, membership rules, layout and SVG: packages/venn-core/src/.
Source research and agreed brief: reports/mathsdock-venn-tool-plan-2026-10-15/
in the enclosing workspace. The downloaded papers are research evidence, not
runtime dependencies or newly published question-bank assets.

## Interface simplification, 15 October 2026

- Only Overlap, Separate and Nested are offered for two sets. A new Nested
  layout uses B inside A; existing A-inside-B documents keep their exact saved
  orientation, data and renderer. Both select the same Nested button, and
  clicking an already-selected Nested button does not change the document.
  Outer set / Inner set label and definition editors follow the actual geometry.
  Renaming changes only the chosen label, retaining every region and shade.
- Show saved answers replaces the resource-view dropdown. It sits beside file
  controls immediately below Copy, controls the existing temporary output view,
  and preserves pupil visibility in autosave/editable files. It is disabled
  during pending edits/replacements/recovery/export like the previous control.
- One Edit/Shade switch above the diagram is the only mode control. Edit shows
  Diagram/Contents tabs; Shade shows shading controls instead. Direct region
  clicks follow the chosen mode, whose active state is explicit. Labels can
  still be edited directly. Drafts block conflicting mode changes; navigation
  preserves mode, view and unfinished editing. The old Shading tab and three
  separate mode actions are removed. Two Edit tabs retain arrow/Home/End keys.
- Labels and definitions are together in one collapsed section; direct label
  and printed-definition editing stays available. Print size has its own
  collapsed section. Essential keyboard alternatives remain labelled.
- One collapsed Examples section shows teaching examples first, then all six
  exam-linked examples. The original complement-shading sample is grouped with
  teaching examples. The redundant reverse-nesting card is omitted from the UI;
  its existing data/function/fixture remain supported unchanged. Nested naming
  on the remaining teaching card is generic. No source references are invented.
- This is a UI-only extension: schemas, both renderers, saved examples, export
  implementation and existing pupil data are unchanged. Evidence is in enclosing
  reports/mathsdock-venn-simplification-preview-2026-10-15/.

## Layout extension, 15 October 2026

- One set; two overlapping or separate sets; B inside A; A inside B; standard
  three-set overlap. Number of sets and two-set thumbnails sit outside the clean
  resource. Circles/ovals work for the new layouts; three sets retain circles.
- Version 2 / venn-2 adds sets=1, arrangement (overlap|separate|b-inside-a|
  a-inside-b) and caption (off|relationship|line). Caption requires separate or
  nested two-set geometry; other counts use arrangement=overlap. Version 1
  documents retain their format and exact legacy renderer in legacy.ts. New
  structure/caption operations explicitly upgrade to version 2; ordinary edits
  to version 1 keep version 1. Existing fixtures and card artwork are retained.
- Realizable masks: single 0,1; separate 0,1,2; B inside A 0,1,3;
  A inside B 0,2,3; overlap unchanged. Incompatible region data is rejected.
  activeMasks drives all editing, content, shading and expression choices.
- Arrangement changes preserve compatible regions. Removing populated, hidden,
  lined or shaded regions requires explicit confirmation; cancellation and
  one-step Undo restore them. No values are moved or combined. Transitions to
  or from one set on populated work explicitly start blank, retaining print
  settings and applicable labels/definitions, with confirmation and Undo.
- Optional captions print A intersection B = empty set, B subset-or-equal A,
  the reverse, or a pupil answer line. They add 12 mm below the universal box;
  no proper-subset claim is inferred. Changing to overlap/count clears caption.
- Resource view: Pupil respects saved visibility; Answer reveals only supplied
  nonempty region answers (excluding Empty-space text) and supplied labels.
  Nothing is calculated. A missing answer stays blank/line. View is temporary,
  survives tool navigation, resets on reload/import/replacement, and controls
  preview and every image/copy output. Editable saving always retains original
  pupil settings, independent of view. Answer-view overflow blocks its images.
- Five original editable teaching examples add one set, disjoint parity sets,
  both nesting directions, and an overlap contrast. Scaffold answers are stored
  hidden so Answer view can reveal them. Existing exam examples are unchanged;
  their genuinely blank scaffolds do not manufacture answers in Answer view.
- Version-2 text fitting avoids visible label backings. Nested inner labels sit
  on the upper-left inner boundary and must fit within the outer set, including
  their backing. Overflow is retained for correction and blocks image outputs.
- scripts/generate-venn-layout-examples.mjs generates ten reopened schema-2
  files under docs/venn-layout-examples/ and checks both views. It is separate
  from the original card/schema-1 example generator, preserving those fixtures.
- Existing device key is deliberately retained. Both versions parse/recover;
  existing drafts are not migrated on page load. Corrupt/newer-tab protection
  remains in force. There is no server migration or MCP adapter.
- Evidence: enclosing reports/mathsdock-venn-layouts-preview-2026-10-15/.
  The older sections below describe the preserved baseline where not extended.

## Resources

- Two overlapping circles or wider ovals; three overlapping circles in the
  standard triangular layout; a universal-set rectangle and editable labels.
- Lists of members, frequencies, exact fractions, decimals, simple algebra and
  ordinary text. Lists accept commas, semicolons and new lines. Fractions use
  numerator/denominator and render stacked. Decimal spelling is retained.
- Empty space, an empty member list, hidden retained contents, a pupil answer
  line and a zero frequency are separate states. A zero-valued member is an
  element, not a frequency. No automatic solving, totals or answer filling.
- Neutral grey/hatch shading per atomic region or a bounded set-expression
  parser. Set identifiers A/B/C remain stable when labels are renamed.
  Intersection has priority over union. Postfix ' is complement; brackets group
  expressions. Both ASCII &/| and mathematical intersection/union are accepted.
- Definitions are optional printed descriptions. They do not classify members.

## Representation

Envelope: tool=venn, schemaVersion=1, rendererVersion=venn-1.
document has sets (2|3), shape, four labels (universe,A,B,C), eight regions,
four definitions, showDefinitions, widthCm and fontPt. Every label has text
and visibility (show|hidden|line). Every region has kind (empty|members|
frequency|number|algebra|text), text, visibility and shade (none|grey|hatch).
Membership mask bits 1,2,4 correspond to A,B,C; mask0 is outside. Two sets use
0..3; three use0..7. Two-set files cannot contain C-region data. Labels and
definition data for C can be retained without being printed in two sets.
Adding C preserves the first four regions and creates four empty regions.
Removing populated/hidden/shaded C regions requires confirmation and is undoable.
Neither operation merges values or silently calculates frequencies.

## Bounds and errors

Print width 8..16 cm; text size 9..14 pt. UI offers integer widths/sizes.
40 members total, 20 per region, 32 characters per member/ordinary region
label, 24 per set label, 120 per definition line. Editable files <=40k characters.
Numbers use the existing bounded exact rational parser. Frequency disagreements
(negative/noninteger) and exact repeated member strings produce teacher-only
warnings, retained for error-spotting. No semantic interpretation of prose.
Malformed fractions and invalid structures are rejected. Layout overflow is
saved for correction and blocks image export; editable saving remains available.
Image layout uses bundled STIX font advances, shape-aware line fitting and
geometric clearance. Geometry changes do not implicitly reduce text size.

## Editing

Click a label/region/printed definition or use labelled inspector controls.
Apply/Enter commits; Cancel/Escape restores. Shift+Enter adds a member-list
newline. One draft can be open at a time; a pending draft blocks other edits
and exports. It stays present through scrolling, resizing and tool navigation;
inactive overlays are hidden/inert. Floating editors are portal children of
document.body, clamped to the visual viewport, with their own scroll overflow.
Diagram/Contents/Shading tabs support arrows, Home and End. All essential
actions have keyboard alternatives. A separate shading mode distinguishes
editing from painting. The white artwork contains only transparent edit hits;
buttons and utilities are in the surrounding workspace or inspector.

## Print and exchange

Default whole output: 12 x8.5 cm (two sets),12 x10.5 cm (three). Enabling
definitions adds explicit height according to displayed lines and text size.
Outer 2mm margins are included in those bounds; no cropping of the outside
region, writing space or universal box. Print typography stays in physical
units as geometry changes; preview zoom does not affect outputs.
SVG embeds existing bundled fonts. PNG uses existing verified 600ppi renderer
and density/size validation. Both copy routes share this artwork. Copy for
Word uses an image plus exact centimetre HTML dimensions; image clipboard
permission refusal provides a download fallback. No editor controls/warnings
appear in exports. Native Word paste and physical monochrome print remain
explicit human review checks; browser clipboard tests do not establish them.
No service/MCP adapter or editor-link payload format was added in this scope.

## Persistence

Device key: maths-booklet-tools:venn:v1. Saving/reopening uses strict schema
validation and versioned examples. Opening/replacing/resetting confirms before
replacing current work and is undoable; cancelled imports retain the document.
Storage failures give an editable-file fallback. Corrupt/foreign-tab recovery
data is protected until its recovery download; changed-again data must be
protected again. Mounted page lifetime keeps history/drafts on navigation;
reload restores valid documents, not full history or unfinished input.

## Examples and All tools card

Six verified sources plus an original complement-shading sample. The 2017
scaffold retains missing set labels. The 2018 three-set list retains genuine
empty intersections. Language-survey scaffold is explicitly adapted from a
prose question; its worked copy preserves the German-only zero. Film and
algebra examples retain given source values in both copies and say so.
Source links open separately. These are editable teaching diagrams, not new
exam question scans. No answer probability is printed or auto-calculated.
docs/venn-examples/ holds version1 scaffold/worked fixtures and card.json.
scripts/generate-venn-preview.mjs reopens card.json through the real parser and
renders/outlines it through the shared renderer with bundled STIX fonts. It
also verifies all14 example layouts. Registry preview retains the small icon.

Local qualification is recorded in the enclosing workspace's
reports/mathsdock-venn-preview-2026-10-15/. This document does not claim merge,
deployment, service availability, client acceptance or physical print approval.
