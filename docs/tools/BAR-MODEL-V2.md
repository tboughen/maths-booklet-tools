# Bar modelling: improved lesson layout

This is the frozen v2 contract. New empty browser sessions now use
[v3 notation and handwriting space](BAR-MODEL-V3.md); explicit MCP spec2 and saved
v2 definitions still use the renderer documented here. Prior fresh-default and
compact-height descriptions below apply to that retained v2 profile.

The refinement implements the approved revision-2 plan. The route and resource
kind remain `bar-model`. Schema 2 uses renderer `bar-model-2` and profile
`lesson-v2`. Schema 1 keeps its original source, hash, renderer and artwork path.
These are implementation contracts; deployment and actual-client adoption must
be established separately. See [the complete emitted descriptors](BAR-MODEL-EMITTED-SCHEMAS.json).

## Choosing a version

Fresh browser models are blank two-part v2 resources. Saved files keep their
version. **Use improved layout** previews an explicit upgrade; one Undo restores
the original v1 definition and earlier history. Every upgraded span retains its
fixed endpoints, even if it previously covered a whole bar. There is no lossy
downgrade. The original named BM01–BM09/H07/H18/source-sharing examples remain v1.

Bare MCP creation, `spec:{}`, named legacy examples and custom legacy specs keep
their original v1 meaning. Request v2 explicitly:

```json
{"spec":{"schemaVersion":2,"starter":"part-whole"}}
```

Other starters are `comparison`, `equal-sections` and `inline-ratio`.
`count` selects 1–24 equal sections; `ratio:[3,5]` or `[2,3,4]` creates grouped
units. Comparison accepts `comparisonLengths:[7,4]` (whole numbers, longer first)
and `partitioned:true|false`. Structural lengths never become printed answers.
An exact `envelope` keeps its version and is exclusive with `spec`. Mixing legacy
fields such as `example`, `spans` or `shade` into a v2 spec fails explicitly.

## Saved definition

Each bar stores `id`, `name:{text,state}`, exact nonnegative `offset`, and parts.
Each part stores `id`, positive exact `weight`, `labels:{inside,above?,below?}`
and one semantic `fill:none|neutral|blue|green|amber`. Every label is
`{text,state:value|blank|question|line|hidden}`. All five states retain entered
text; only value prints it. Question prints `?`; line prints an 8 mm answer space.
Choosing a label position never moves or copies content. Bulk assignment is one
literal edit, with no continuing linkage or calculation.

An annotation has `id`, `scope`, `label`, `decoration:none|brace|dimension` and
`placement:above|below|inside|between`. Scope is either `{kind:"whole",barId}`
(follows the current whole bar) or `{kind:"range",from,to}` (fixed endpoint IDs).
Endpoints are `{barId,partId,edge:"start"|"end"}`. There is one annotation model;
line-free totals and whole braces do not have competing total fields. All count
towards the existing 18-annotation limit. Section slots do not consume that limit.

Inside whole labels must fit a continuous interval without meeting any divider
or existing label. The editor retains an invalid draft and offers outside
placement or an explicit continuous-bar structure. It never masks partitions.
Between-bar annotations derive their gap from adjacent endpoint bars. Reordering
or removing bars cannot silently select another gap. Change placement, remove
the affected annotation explicitly, or cancel the structural change.

Above/below annotations use deterministic first-fit lanes with separate stroke
and padded text occupancy. Adjacent groups may share an exact boundary when
their text remains clear. Nested/overlapping interiors use separate lanes.
Section labels share a baseline; whole braces sit outside the section-label row.
Visible names determine an automatic gutter; saved hidden text does not affect
its size. A manual 8–60 mm name width is optional. Artwork retains at least 4 mm
outer ink space; no font shrinking, clipping or automatic print scaling occurs.

The optional title is a label. Up to three captions store stable `id`, `label`
and `alignment:left|centre|right`. Captions are literal text, including Unicode
operations and linear fractions such as `4/5 × 45 = 36`; standalone labels retain
stacked simple fractions. There is no formula parser, HTML or automatic solver.
Text is at most 80 characters per label/line. Labels are 10–14 pt; title 12–18 pt.
Glyph advances and ink bounds are generated from the bundled font files, with
their SHA-256 identities recorded. Supported Latin, Greek and mathematical glyphs
include the stated Unicode operations. Unsupported visible characters fail with
their code points and a correction path; their saved text can still be retained
under a hidden display. No replacement glyph is silently printed.

Presentation stores `unitMm:4..16`, `barHeightMm:8..16`, `fontPt:10..14`,
`titlePt:12..18`, optional `nameWidthMm:8..60`, and `output:grey|colour`.
New defaults are 10 mm/unit, 12 mm bars, 12 pt labels, 14 pt title and greyscale.
The stored output choice governs preview and every export. Lines/text stay black;
partitions and labels preserve meaning independently of colour.

## Atomic operations

Use the exact returned envelope and `baseHash:contentHash`, at most 30 operations,
and a 32 KiB request. Old operations remain supported. New operations are:

| Operation | Fields besides `op` |
|---|---|
| upgrade_document | None; exactly once, first, on v1 |
| set_section_label | barId,partId,slot,label |
| set_section_labels | barId,partIds,slot,label |
| move_or_copy_label | from/to:{barId,partId,slot},mode:move/copy,overwrite? |
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
| append_section | barId,part (complete v2 schema),afterId? |
| append_bar | bar (complete v2 schema),afterId? |
| reorder_bars | barIds (every current ID exactly once) |

A mixed upgrade batch checks the original v1 hash before editing a private copy.
A later failure rolls back the upgrade and all edits. New features on v1 require
explicit upgrade. Empty refresh and ordinary legacy edits remain v1.

Move/copy requires explicit overwrite if the destination contains visible or
retained saved content. Its preview shows both saved values; Cancel preserves
both. `autoName:true` explicitly removes a stored manual name-width override.

`equal_sections` preserves the exact total bar length, shared unit width and other
bars. Same-count equalisation preserves IDs/labels/fills/anchors. Changed counts
allocate new IDs and preview affected labels, hidden text, fills and fixed ranges.
Affected content requires `discardContent:true`; dynamic whole annotations survive.
No fixed endpoint silently reattaches. One Undo restores the complete prior model.
Unrepresentable exact rationals and sections narrower than 4 mm fail clearly.

## Saving, output and limits

The v2 browser key holds a discriminated v1/v2 envelope plus storage metadata.
Reading is non-mutating. The old key and its bytes remain protected. A saved
legacy snapshot hash lives outside the definition/hash. Divergent versions offer
previews, explicit choice and downloads of both. Corrupt/future data enters
recovery; compare-before-write protects a newer tab. No old/new-app sync is claimed.

Editable-file/link warnings cover every nonempty saved text field that does not
print its text, including blank/question/line/hidden slots, annotations, title and
captions. Warnings remain outside pupil artwork and source hashes.

Both versions use the same SVG/600-ppi PNG/JSON, original UTF-8 SVG chunks,
placement and bundle protocols. Browser SVG fonts are embedded; service SVG
glyphs are outlined. Preserve native dimensions and verify exact saved bytes
before vector-PDF consumption. Native Word, physical print, real-phone keyboard
and independent teacher acceptance are separate observed/pending checks.

Existing limits remain: 6 bars, 24 parts/bar, 96 parts, 18 annotations, 30 ops,
32 KiB requests/definitions, 16,000-character links, 280 × 260 mm, minimum 4 mm
parts and 32 million 600-ppi pixels. Limits are conditional: all text/structure
maxima are not guaranteed simultaneously. The dense fixture exercises 96 parts,
18 annotations, all three slots, a title and three captions. Longer saved text or
crowded geometry fails explicitly; production memory/PID/request quotas stay fixed.

## Review and adoption

R1–R5 lesson examples are newly authored resources with distinct `lesson-v2-*`
source IDs. They reproduce the supplied mathematical structures without packaging
pupil photographs or private documents. Pupil and explicitly worked variants stay
separate. Report body, caption and complete dimensions independently; historical
renders without captions are not matched full-resource benchmarks.

After separate approval, Gate W publishes the qualified dual-reader website
while production service/package stay unchanged. Verify existing families and
legacy/new saved files without claiming future-service compatibility. Gate S
begins only after that website is actually live: rebase the five-pair compatibility
window to its verified reader identity, retain immutable hashed receipts and
require the canonical helper's compatible result before service/package mutation.
Old-service pairs retain old families and explicitly lack bar calls. Never bypass
the checker or overwrite a frozen matrix. Rollback must retain dual readers and
the latest published paper bank; a v1-only reader cannot recover issued v2 files.
