# Bar-model MCP contract

Both schema versions are supported by this candidate. Read [the complete v2
contract](BAR-MODEL-V2.md) for explicit `spec.schemaVersion:2`, independent slots,
annotation scope, starters and atomic upgrade operations. Bare/empty legacy specs
and exact v1 envelopes keep the original contract below. Actual discovery and
deployment are separate from this source definition.

Version1: kind/route `bar-model`, schemaVersion1, renderer `bar-model-1`, style
`lesson-v1`. The [brief](BAR-MODEL-BRIEF.md) defines teaching purpose and examples.
[Complete emitted tool descriptors](BAR-MODEL-EMITTED-SCHEMAS.json) retain every
input/output field, required array, enum and bound. Actual discovery governs use;
documentation does not establish deployment or client import.

## Creation and capabilities

`bar_model_capabilities {}` describes states, rational/structure/print/request bounds,
example names, geometry, deletion policy, versions and complete revision schema.

`create_bar_model` accepts `{spec?:...,envelope?:...}`. Spec and envelope are exclusive.
Omit both for an unworked BM01 scaffold. `spec.example` selects BM01–BM09,H07,H18 or
source-sharing; it cannot be mixed with custom bars/spans. `worked:true` requires
an explicit example. Custom definitions default to empty spans; no missing answer
is inferred. Spec permits optional presentation overrides. Exact envelopes retain
saved label states and stable IDs.

```json
{"spec":{"example":"BM03"}}
```

Custom bars: `{id,name:{text,state},offset,parts:[{id,weight,label:{text,state},shade}]}`.
Geometry offset/weight are exact numeric strings, not label expressions. All bars
share presentation.unitMm. Parts have positive weights; offsets are nonnegative.
Labels accept text≤80 characters and state `value|blank|question|line|hidden`.
Hidden/blank states retain text; question prints?;line prints an8mm answer space.
No answer is filled by edits to known quantities or labels.

Spans: `{id,from:{barId,partId,edge},to:{barId,partId,edge},label,side,style}`.
Edge is start/end,side above/below,style brace/dimension. Endpoints must exist and
run left-to-right in shared-unit coordinates. Cross-bar anchors express differences.
Adjacent-group anchors and one contiguous whole support sharing totals.

Presentation: unitMm4–16,barHeightMm8–16,fontPt10–14,nameWidthMm20–60. Full bounds
and layout constraints are in capabilities and the brief. Invalid geometry is
rejected. Layout overflow fails artifact creation with a useful explanation; it
does not alter source or silently rescale output.

## Atomic revision

`revise_bar_model {envelope,baseHash,operations}` requires the exact last returned
envelope and its contentHash, with≤30 operations and32KiB input. Empty operations
refresh artifacts/links without changing source. Invalid/stale requests have no
partial result or server state mutation. Keep the newly returned envelope/hash.

| Operation | Complete payload besides op |
|---|---|
| set_label | target:{spanId} OR {barId,partId?};label:{text,state} |
| set_part | barId,partId,weight?,shade? |
| add_bar | bar (complete schema),afterId?;omitted appends |
| remove_bar | barId,discardSpans?:false |
| add_part | barId,part (complete schema),afterId?;omitted appends |
| remove_part | barId,partId,discardSpans?:false |
| add_span | span (complete schema) |
| set_span | span (complete schema,existing id) |
| remove_span | spanId |
| set_alignment | barId,offset (exact numeric string) |
| set_print | presentation:{unitMm?,barHeightMm?,fontPt?,nameWidthMm?} |
| reveal_saved_answers | no additional fields;explicit request only |

set_label supplies saved text and state together: retain the existing text when
changing visibility. A referenced removal needs prior explicit span removal or
discardSpans:true. It never chooses a new boundary silently. Resizing/relabeling
does not calculate or reveal answers. This editor has no automatic solver.

```js
{envelope: result.envelope, baseHash: result.contentHash,
 operations:[{op:"set_part",barId:"b1",partId:"b1p1",shade:true}]}
```

## Returned resources and output tools

Create/revise return canonical envelope/contentHash/rendererVersion,warnings,
downloads.svg/png/json,editorUrl,physicalSizeCm,printGuidance,printRaster,printDpi600,
printVerified:true and inline preview. Style/version are also in the envelope.
Download links are real signed7-day resources. Oversize links yield existing
bounded embedded resource content; an oversized editor link is null with an editable
file fallback. Files/links retain hidden answers; pupil artwork hides them.

`get_diagram_svg {kind:"bar-model",envelope,...}` uses the existing exact UTF-8
offset/chunk/full-hash protocol. `check_diagram_placement` and
`download_diagram_bundle` accept the same kind/source. There is no outputView
parameter for bars: reveal requires an explicit source revision, keeping ordinary
output pupil-facing. These optional tools never reconstruct artwork from preview.
See [original SVG delivery](DIRECT-SVG-DELIVERY.md) and
[diagram outputs](MCP-DIAGRAM-OUTPUTS.md) for complete shared payloads and limits.

Print facts are outside the saved definition/hash. Use returned native dimensions
and aspect ratio; verify actual saved SVG/PNG/JSON. Browser fonts are embedded;
service SVG lettering is outlined. Exact chunk saving, native vector-PDF consumption,
and actual intended-chat execution are separate evidence from SDK/unit tests.
Native Word insertion, physical printing and real phone use are not established by
printVerified, a screenshot or a browser download event.

## Preservation and publication

The expected catalogue delta adds exactly the three bar calls; changes only
check_diagram_placement/download_diagram_bundle/get_diagram_svg to accept the kind;
and removes nothing. Compare complete descriptors, not counts. Keep all prior
families, signed files, source hashes, defaults, fonts, keys, quotas and App identity.
The release playbook owns exact-source qualification, compatibility matrix and
surface-specific approval. Current plugin guidance must be guarded against its
actual release, not the historical dev-named plugin. No new connection is needed.
