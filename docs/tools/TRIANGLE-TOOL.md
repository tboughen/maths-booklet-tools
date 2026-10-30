# MathsDock Triangles — editor and print behaviour

## Wedge and area refinement, 17 October 2026 (local review)

The interior shaded wedge is the angle control, including Blank/Hidden and
None-mark angles. Wedges are invisible at rest, with feedback only for the
hovered angle or keyboard focus/named chooser; selection alone does not shade
them. Angle rectangles are removed. Wedges support click, touch,
Tab and Enter/Space; named choices resolve genuinely overlapping angles.
The round vertex drag handles and vertex-name/side-length text targets remain.
Precise angle-label offsets remain in Label position. Editor wedges never print.

Hover a triangle, focus its centre target, or select its triangle to reveal
+ Area. On touch, tap the triangle interior to select it first. The named
centre target opens an optional label for that triangle alone: given, unknown,
blank, answer line or hidden. Square units or None are available. Applying is
one Undo action; Cancel does not add a label. The resulting text is editable
and draggable; offsets are physical mm from the triangle's centroid. Remove
area label is undoable. No numerical area is inferred from drawn proportions.
The existing explicit calculation helpers can save an area answer to this
label; connected givens and calculation ownership use its exact triangle.

Old files and presets retain schemaVersion 1 / triangle-1 and identical output.
Adding a centre area uses schemaVersion 2 / triangle-2: each triangle may have
an optional area: Label, reached as r:`<triangle-id>`. Captions keep their original
meaning and two-caption limit. Both versions are validated; version/renderer
mismatches and area fields in version 1 are rejected. Old clients cannot open
version 2. Removal of the last area in this editor returns to version 1. Area
labels follow reshape, transforms, split/restore and worked-copy operations.

## Visible label controls, 17 October 2026 (local review refinement)

The underlying tool was published in PR34; these refinements are local only.
Label display and units use visible native radio choices. Angle marker is
immediately available: None, Arc, Double arc, Triple arc or Right angle.
Click an angle position or a printed arc to edit that exact named angle.
An overlapping wedge offers named alternatives and a visual highlight.
Choose Arc and Blank for an unlabelled arc. Labels and marks stay independent:

typing or changing label type never inserts a mark; None stays None on reopen.
Right angle is enabled only on perpendicular rays and never reshapes geometry.
Show degree symbol, Dashed side and saved-answer visibility are checkboxes.
Vertex names open directly in a text field; uncommon styles remain in More
label options and survive no-op edits. All existing caption units are retained.
Given / expression, Unknown (x), Blank, Answer line and Hidden retain existing
label semantics and text. Unknown suggests x only for empty unlinked labels.
An already printed saved answer has a visible explanation and checkbox; hidden
labels do not erase answers or change saved visibility. Saved mathematical
answers retain the existing visibility-independent validity rule. Loaded helper
inputs/results separately detect changed printed givens and require a reload.
Apply/Enter or valid click-away commits the complete edit once. Cancel/Escape
restores it; a valid draft can hand off to another label with one click. Invalid
drafts stay available and continue to block conflicting operations and export.
Radio choices do not summon the touch keyboard. Native keyboard grouping and
focus, measured popup bounds and existing drag/history/recovery guards remain.
That label-control-only refinement did not change the saved format or artwork;
the later optional centre-area extension is described above.

## Direct-interaction refinement, 16 October 2026

Ordinary editing is mode-free: click/tap labels to edit, drag labels to move
them, and drag geometric vertices to reshape. Vertex names and points have
separate targets; crowded hit areas are partitioned at their midpoint. Sides,
angle marks and triangle interiors select contextual settings. Overlapping
geometry offers named choices; the grouped Selected object chooser reaches
every object by keyboard, including hidden/blank quantities and outer splits.
The selected-object inspector replaces the mode switches and Shape/Labels
tabs. Precise position, shape locks, captions and starting a new triangle stay
optional. Print size and Examples remain separate; full manual calculations
and construction remain inside More tools.
Attach triangle to a selected side and Split triangle from a selected apex
preview before applying. A split resolves the opposite side explicitly.
Apply is one Undo action; Cancel leaves the saved definition exact. Copying
and conflicting edits are blocked while a structural preview is unresolved.
Add separate triangle remains direct. After adding, show the named added
triangle's removal, or Remove split to restore the outer triangle. Keep these
actions in blue space beneath the complete white resource, without dead Add
controls. The current limit remains two component triangles.
Preview zoom, temporary saved-answer visibility, actual size and worked copy
share a responsive view strip. Fit reserves room for the structure controls.
Simple label editors show the common state/text/unit fields first; saved
answers, presentation/marks and offsets expand without changing stored data.
An error remains outside the collapsed groups. Native print/export artwork,
schema, renderer and saved pupil states are retained. The shared mathematical
helper adds the explicit inverse-area height method h = 2A/base; existing
methods and exported preset artwork remain unchanged.

Route: ?tool=triangle. Renderers: triangle-1/triangle-2; file kind triangle, schemaVersion 1/2,
style exam-v1. Core: packages/triangle-core/src. Browser: src/triangle.
This implementation is local and uncommitted. No MCP adapter is included.

Start with a blank right triangle, or use the collapsed Examples section.
There are five teaching examples and ten source-linked exam scaffolds. Each
source card names the original question and explains any triangle-only substep.
The impossible-length and ambiguous-SSA examples are deliberate teaching cases.

## Editing

Click a side, angle, vertex name, height or caption to edit it. Blank quantities
retain click targets. The Selected label list provides a keyboard alternative.
Choose given value, symbol, blank, answer line or hidden. Saved answers remain
separate from the printed pupil state. Enter applies; Escape cancels; valid blur
applies. An invalid draft stays available and blocks replacement/export until
corrected or cancelled. Other tool navigation preserves the draft and disables
its floating editor while that tool is inactive.

Geometry supports pointer dragging and keyboard/numeric coordinate edits.
Label dragging changes physical mm offsets, with numeric alternatives. Each
drag is one Undo action; the final pointer event determines the final result.
Escape, lost capture, pointer cancellation, tool navigation or window blur
restores the starting resource. Invalid movement retains its last valid preview.
Touch uses a larger drag threshold and targets; geometry touch capture is
native/implicit. Touch label editing does not force the keyboard until a field
is tapped. Local history touch releases activate once and consume a matching
compatibility click; moving/cancelling a touch over history does not undo work.
Rotate/reflection affects the complete diagram and preserves label identities.
Right-angle, isosceles and equilateral constraints are geometric. Equal-side
ticks, angle arcs and dashed sides are independent printed annotations. A
right-angle square is allowed only on perpendicular rays.

Layouts: single; two separate triangles; two triangles sharing a selected side;
or an outer triangle split by a point on the opposite side. The joined layout
permits a concave outside boundary. Shared sides have one label. Shared angle
symbols can be linked explicitly. Add/remove changes are undoable. The split
point stays on the base; degenerate or overlapping invalid layouts are refused.
Up to two perpendicular heights include external feet and dashed base extension.
Up to two captions can hold area statements or bounded mathematical text.

Printed labels do not resize geometry. Construct from measurements explicitly
previews SSS, SAS, ASA, AAS or two perpendicular sides. Applying replaces geometry
and its locks, retains pupil labels/blanks, and is one undoable transaction.
It is a proportional construction, not a physical scale drawing. A construction
that violates the retained joined/split geometry is rejected without mutation.

## Calculations

Selecting a side, angle, height or area caption offers Calculate. Choose its
owning triangle (explicitly for shared targets), then Load selected context.
Methods show missing inputs, use named actual edge/angle records and only
prefill parseable printed givens. Shape proportions and hidden answers never
become measurements. Formula letters use the listed named input mapping;
they need not match the triangle record's vertex order. A single compatible
area caption can supply a height's area in a single triangle; ambiguous areas
or captions on paired diagrams require explicit entry. A height uses 2A/base,
never an invented auxiliary triangle. Area output needs an explicitly created
caption. Changing selection does not overwrite manually edited helper inputs;
reloading context is explicit. Diagram-given changes revoke old results and
require a reload. Only the named target can receive a contextual result.

The collapsed Calculate a value panel provides Pythagoras, right trigonometry,
sine rule, cosine rule, base-height/sine area, inverse area, height from area
and angle sum.
Inputs must be explicit; importing numerical diagram givens fills the matching
named a/b/c/A/B/C fields only. Right methods require a selected right triangle.
All length inputs must use one unit. Inverse sine/area lists each valid branch.
No result is saved automatically. Select a compatible target, choose rounding
or an available exact form, then explicitly store a hidden answer. Replacing an
existing target answer is explicit. Changing helper inputs clears unsaved
results. Changing diagram givens blocks saving an earlier result and makes
retained calculated answers stale; recalculate or keep a saved answer as manual.
Impossible printed givens can remain for error-spotting; construction/calculation
refuse invalid numerical requests. Helpers do not solve arbitrary symbolic text.

## Print and files

Print width is 6–18 cm; defaults are 12 cm single and 16 cm paired. Text is 11 pt
and independent of view zoom. Actual export height follows complete artwork,
labels and captions with white allowance; an invalid collision/oversized layout
blocks image export and keeps editable save available. Fit shows the full width
on narrow screens. Explicit zoom permits scrolling without changing export size.

SVG embeds portable fonts; PNG is opaque greyscale at 600 ppi. Copy to clipboard
uses the same PNG. Copy for Word adds the exact physical cm dimensions to HTML.
Temporary Show saved answers is a preview only: pupil downloads retain saved
visibility. Open worked copy creates independent tab/storage and permits answer
exports without changing the scaffold. A stale saved answer must be resolved
before showing it. Native Word paste and physical monochrome printing require
Tim's review; browser clipboard checks do not substitute for those checks.

Save/Open editable file uses strict bounded JSON. Complete UTF-8 editor links
are offered only within the URL bound. Broken files, cancelled choosers and
cancelled replacements preserve work. Undo/Redo is session-local. Autosave is
origin-local; another tab's newer draft or corrupt data is protected. Download
the exact original recovery file before deliberately starting fresh. A further
storage change revokes that confirmation/download acknowledgement.

Bounds: 6 vertices, 7 edges, 9 angle labels, 3 triangle records including the
outer split triangle, 2 heights, 2 captions. Vertex text 8 characters, ordinary
labels 40, captions 120. Bounded fractions, surds, Greek/superscripts and plain
algebraic labels are supported; arbitrary LaTeX/executable expressions are not.
3D solids, circles, full bearings scenes, arbitrary polygon topology, symbolic
solving and a triangle MCP integration remain outside this implementation.

Verification and review evidence:

../reports/mathsdock-triangle-implementation-2026-10-16/HANDOVER.txt (workspace root)
Source pack plan: reports/mathsdock-triangle-tool-plan-2026-10-16/PLAN.html
