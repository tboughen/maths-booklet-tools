# Bar-model MCP contract

Kind/route `bar-model`. Every model uses the single [saved format](BAR-MODEL-V3.md)
(schemaVersion 3, renderer `bar-model-3`, style `lesson-v3`). The
[brief](BAR-MODEL-BRIEF.md) defines teaching purpose and examples. Actual discovery
governs use; documentation does not establish deployment or client import.

## Creation and capabilities

`diagram_capabilities {kind:"bar-model"}` describes states, structure/print/request bounds,
starters, example names, geometry, deletion policy and the complete revision schema.

`create_diagram` accepts `{kind:"bar-model",spec?:...,envelope?:...}`. Spec and envelope are
exclusive. Omit both for a blank two-part part-whole model.

```json
{"spec":{"starter":"part-whole"}}
```

Other starters are `comparison`, `equal-sections` and `inline-ratio`. `count` selects 1–24
equal sections; `ratio:[3,5]` or `[2,3,4]` creates grouped units. Comparison accepts
`comparisonLengths:[7,4]` (whole numbers, longer first) and `partitioned:true|false`.
Structural lengths never become printed answers. Custom `bars`, `annotations`, `captions`,
`title` and partial `presentation` use the saved schemas; `bars` and `starter` are exclusive.

`spec.example` selects BM01–BM09, H07, H18 or source-sharing, and must come
on its own. `worked:true` requires an explicit example. An exact envelope retains saved label
states and stable IDs. `spec.schemaVersion` is optional and can only be 3.

## Atomic revision

`revise_diagram {kind:"bar-model",envelope,baseHash,operations}` requires the exact last
returned envelope and its contentHash, with ≤30 operations and a 32 KiB request. Empty
operations refresh artifacts/links without changing source. Invalid or stale requests have no
partial result. Keep the newly returned envelope/hash.

| Operation | Fields besides `op` |
|---|---|
| set_section_label | barId,partId,slot:inside\|above\|below,label |
| set_section_labels | barId,partIds,slot,label |
| move_or_copy_label | from/to:{barId,partId,slot},mode:move\|copy,overwrite? |
| set_annotation | annotation (complete saved schema) |
| remove_annotation | annotationId |
| equal_sections | barId,count,discardContent? |
| set_fill | barId,partIds,fill |
| add_caption / update_caption | caption (complete saved schema) |
| remove_caption | captionId |
| set_title | label (or null to remove) |
| set_presentation | presentation (partial),autoName? |
| set_quantity_name | barId,label |
| set_relative_length | barId,partId,weight |
| append_section | barId,part,afterId? |
| append_bar | bar,afterId? |
| reorder_bars | barIds (every current ID exactly once) |
| remove_bar | barId,discardSpans?:false |
| remove_part | barId,partId,discardSpans?:false |
| set_alignment | barId,offset (exact numeric string) |
| reveal_saved_answers | none; explicit request only |

Move/copy needs explicit `overwrite` if the destination holds content. `autoName:true`
removes a stored manual name width. `equal_sections` keeps the exact total bar length and
other bars; a changed count that affects labels, fills or fixed ranges needs
`discardContent:true`. Removing a bar or section an annotation refers to needs
`discardSpans:true` or removing the annotation first; anchors never reattach. No edit
calculates or reveals answers.

```js
{envelope: result.envelope, baseHash: result.contentHash,
 operations:[{op:"set_fill",barId:"b1",partIds:["b1p1"],fill:"neutral"}]}
```

## Returned resources and output tools

Create/revise return the canonical envelope, contentHash, rendererVersion, warnings,
downloads.svg/png/json, editorUrl, physicalSizeCm, printGuidance, printRaster, printDpi600,
printVerified:true and an inline preview. Download links are real signed 7-day resources.
An oversized editor link is null with an editable-file fallback. Files/links retain hidden
answers; pupil artwork hides them.

`get_diagram_svg {kind:"bar-model",envelope,...}` uses the shared exact UTF-8
offset/chunk/full-hash protocol. `check_diagram_placement` and `download_diagram_bundle`
accept the same kind/source. There is no outputView for bars: reveal requires an explicit
source revision. See [original SVG delivery](DIRECT-SVG-DELIVERY.md) and
[diagram outputs](MCP-DIAGRAM-OUTPUTS.md).

Print facts are outside the saved definition/hash. Use returned native dimensions and
verify actual saved SVG/PNG/JSON. Browser fonts are embedded; service SVG lettering is
outlined. Native Word insertion, physical printing and real phone use are not established
by printVerified, a screenshot or a browser download event.
