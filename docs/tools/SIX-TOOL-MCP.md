Routine publication follows the [MCP release playbook](../release/MCP-RELEASE-PLAYBOOK.md) and
[checklist](../release/MCP-RELEASE-CHECKLIST.md). Retained incident/family details below remain
applicable; historical family/tool counts are snapshots, not discovery evidence.

# Six booklet-tool MCP integrations

This source adds Cuboids, Number lines and Venn to the existing Graph, Ratio
tables and Plotting quadratics integrations. A source change does not establish
service deployment or client acceptance. Check the actual discovered tools.

| Resource | Capabilities | Create | Revise |
| --- | --- | --- | --- |
| Graph | graph_capabilities | create_graph | revise_graph |
| Ratio tables | ratio_table_capabilities | create_ratio_table | revise_ratio_table |
| Plotting quadratics | value_graph_capabilities | create_value_graph | revise_value_graph |
| Cuboids | cuboid_capabilities | create_cuboid | revise_cuboid |
| Number lines | number_line_capabilities | create_number_line | revise_number_line |
| Venn | venn_capabilities | create_venn | revise_venn |

The catalogue also includes `check_diagram_placement` and
`download_diagram_bundle`, plus optional `get_diagram_svg` (21 calls in this
source). See [original SVG delivery](DIRECT-SVG-DELIVERY.md) for verified saving
when external downloads are blocked. Their six source kinds are `graph`, `ratio-table`,
`value-graph`, `cuboids`, `number-line` and `venn`. Do not reconstruct signed URLs.

## Common create, revise and output contract

The three new create calls accept `{spec?: ..., envelope?: ...}`. Omit both for
the documented defaults; supply at most one. An imported envelope keeps its saved
version. New Cuboids/Venn use version 2. Number lines use version 1. Mathematical
numbers are exact strings; physical centimetres and font points are numbers.

Revision takes `{envelope, baseHash, operations}` with at most 30 operations.
Hash mismatch, invalid IDs, incompatible versions or an invalid final layout fail
the entire call. A failing call never alters the caller's input. Empty operations
refresh links and preserve source/hash. `baseHash` checks the supplied canonical
definition; the service retains no cross-chat current document.

Responses retain `envelope`, `contentHash`, `rendererVersion`, `warnings`, an inline
preview, SVG/PNG/JSON downloads or bounded embedded files, nullable `editorUrl`,
`physicalSizeCm`, `printRaster`, `printDpi:600`, `printVerified:true` and
`printGuidance`. Facts and output views are outside the definition/hash. Actual
print PNG generation and density validation precede success. Preview pixels are
not the print file. Retrieve files before claiming a saved download.

Open returned JSON with the existing editor's Open editable file action, or use
its complete returned editor link. Edit, save the new JSON and supply that exact
envelope on a future create/revise call. Human editing has no service dependency.
Saving a new browser edit changes its hash: create from that exact envelope to
obtain the corresponding revision hash. Do not guess or substitute an old hash.

## Cuboids

Example scaffold creation:

```json
{"spec":{"widthCm":10,"shapes":[{"id":"solid","dimensions":{"width":"4","depth":"3","height":"2"},"unit":"cm","arrows":true,"labels":{"width":{"mode":"blank"}},"caption":"Find the volume."}]}}
```

Example revision with the result's exact envelope/hash:

```json
{"envelope":"RETURNED_OBJECT","baseHash":"RETURNED_HASH","operations":[{"op":"set_dimension","id":"solid","axis":"depth","value":"5/2"}]}
```

Replace RETURNED_OBJECT with the returned object, not a string. A worked copy is
an explicit revision `set_presentation` with `settings:{workedVolume:true}`.
Retain the pupil source separately.

Creation shape fields default from an unworked cuboid. Labels support hidden,
value, blank, text and face area as appropriate. Dimensions and labels merge
partial fields with defaults. Full appearance and projection proportions follow
the discovered schema. Never supply arbitrary SVG or executable expressions.

Operations and complete payload fields:

| op | Fields after op |
| --- | --- |
| add_shape | shape, afterId? (omitted appends) |
| remove_shape | id (last shape cannot be removed) |
| replace_shape | id, shape (ID retained; omitted fields use creation defaults) |
| set_dimension | id, axis: width/depth/height, value:string |
| set_unit | id, unit: cm/mm/m (converts existing physical dimensions) |
| set_cube | id, enabled:boolean, referenceAxis? (required when enabling a new lock) |
| set_cube_side | id, value:string in the displayed unit |
| set_view | id, view: plain/cubes/layers |
| set_projection | id, direction?, projection?, schematic?, proportions? |
| set_label | id, key: width/depth/height/front/top/side, label:{mode?,text?,x?,y?} |
| set_appearance | id, appearance:{mode,tone,face,area:{mode,heading,text,expression}} |
| set_presentation | id, settings:{title?,hiddenEdges?,arrows?,workedVolume?,workedArea?,counts?,layerNumbers?,caption?} |
| set_print | widthCm:number |
| upgrade_document | no additional fields |

Use explicit `upgrade_document` before version-2 appearance in a version-1 file.
Limits: 1–3 shapes, layout width 4–18 cm; cube view up to 40 cubes per edge and
10,000 per shape; at most 20 separate layers; minimum 2 mm printed cube cells.
The service also has a 32-million-pixel print bound, smaller than the browser's
maximum. Oversized combinations fail rather than change dimensions/resolution.

The native renderer measures actual ink/strokes/markers and adds 2 mm margins,
rounded outwards to 0.01 mm. Its white margins can differ from Chrome's text-box
crop. Mathematical artwork scale is unchanged. Return the actual exported size,
not the layout width. Existing browser exports and legacy renderers are retained.

Portable Venn SVG shading uses equivalent vector clip paths, including opposite
winding for excluded sets. This avoids luminance-mask differences in consumers
such as CairoSVG without changing the website renderer or saved mathematics.
Qualification samples every feasible region against both native PNG and the
independent vector consumer.

## Number lines

```json
{"spec":{"axis":{"minimum":"-5","maximum":"5","step":"1"},"solution":{"kind":"interval","id":"solution","lower":"-3","upper":"2","lowerIncluded":true,"upperIncluded":false},"teaching":{"labels":{"0":"answer-line"},"answer":"-3 ≤ x < 2","answerVisible":false}}}
```

Revise using the returned envelope/hash and:

```json
[{"op":"set_endpoint","id":"solution","endpoint":"upper","value":"5/2"}]
```

Other operations: `set_axis {axis}`; `set_solution {solution}`;
`add_point {point:{id,value,included?}}`; `set_point {id,value?,included?}`;
`connect_points {interval:{id,from,to}}`; `remove_interval {id}`;
`remove_point {id}`; `set_tick_label {value,state}`;
`set_presentation {teaching}`; `set_print {widthCm}`. `set_endpoint` also accepts
`included` and endpoint lower/value as appropriate. Presentation teaching fields
are solutionVisible, labels, prompt, answer, answerVisible and responseLines.

Solutions are null, interval, ray or points. Rays need value, direction and
included; an intentional truncated ray additionally needs intentional:true and
stop. Points have stable IDs and optional connections. Removal removes incident
connections only. Axis edits that strand a solution fail. Default is a blank
-5..5 axis, width 14 cm. Limits: 8–18 cm, 2–32 whole tick intervals aligned to
zero, 33 points, 32 connections and existing label-spacing checks. Tick label
states are value/hidden/answer-line. To show an explicitly requested saved answer,
use set_presentation with teaching.answerVisible:true in a separate worked copy.

## Venn

```json
{"spec":{"sets":2,"arrangement":"overlap","regions":[{"mask":1,"region":{"kind":"number","text":"0","visibility":"hidden"}},{"mask":3,"region":{"kind":"number","text":"1/2","visibility":"line"}}]}}
```

Revise using the returned envelope/hash and:

```json
[{"op":"shade_expression","expression":"A ∩ B","style":"hatch","mode":"replace"}]
```

Creation accepts sets, shape, arrangement, caption, widthCm, fontPt,
showDefinitions, labels:[{set,label}], definitions:[{set,text}] and
regions:[{mask,region}]. IDs are universe/A/B/C. No duplicate creation entries.
Region masks: 0 outside, bits A=1, B=2, C=4. Active masks:

| Layout | Masks |
| --- | --- |
| One set | 0,1 |
| Two overlapping | 0,1,2,3 |
| Separate | 0,1,2 |
| B inside A | 0,1,3 |
| A inside B | 0,2,3 |
| Three overlapping | 0–7 |

Operations: `set_region {mask,region:{kind?,text?,visibility?,shade?}}`;
`set_label {set,label:{text?,visibility?}}`; `set_definition {set,text}`;
`set_definitions_visible {visible}`; `set_layout
{sets?,shape?,arrangement?,caption?,discardIncompatible?}`;
`shade_regions {masks,style,mode}`; `shade_expression {expression,style,mode}`;
`clear_shading {}`; `set_print {widthCm?,fontPt?}`; `upgrade_document {}`.

Kinds: empty/members/frequency/number/algebra/text. Visibility: show/hidden/line.
Shade: none/grey/hatch. Replace clears current active-region shading first; add
changes the specified regions only. Clear removes shading without changing values.
Expressions use A/B/C, union, intersection, complement and brackets, independent
of displayed labels. Non-overlap arrangements require two sets.

Reject layout changes that discard/deactivate saved contents, hidden/line/shaded
states or customised set definitions unless the user explicitly asks to discard
and the operation supplies discardIncompatible:true. Changes to/from one set
reset region contents under the same guard. Never merge values. Version-1 files
require explicit upgrade for version-2 layouts/captions. Reverse nesting retains
its orientation and exact source.

Create/revise optionally accept `outputView:"pupil"|"answer"`, default pupil.
Explicit answer output reveals a clone only; canonical envelope, hash, JSON and
editor link retain pupil visibility. The response echoes the view and active
regions. Downloads bind view into the signed token. Placement/bundle requests
must repeat outputView for answer artwork. Bundle print-info and README record
that source.json retains pupil visibility. Editable files/links may contain
hidden answers; they are not secure answer removal.

Limits: 1–3 sets, width 8–16 cm, font 9–14 pt, 40 members total/20 per region,
32 characters per member, 24 per set label, 120 per definition, 120 per shading
expression; actual layout fitting can reject smaller content. Complete bounded
UTF-8 editor links preserve all source; oversized links use editable JSON.

## Qualification and release

Run all unit/core/service/catalogue tests, lint/typecheck, publisher regressions,
actual-discovery HTTP smoke, real downloads, independent vector-PDF consumption,
all browser regressions and six-family reopening. Retain old source/artifact
comparisons. Service Docker compilation/hash inputs include all six cores.
Exact hosted qualification and bounded Linux image smoke follow the current
release pipeline. Qualification is separate from publication.

When separately authorised, verify compatible website support first if changed;
deploy the qualified service through its existing manual process; verify actual
health build identity and real HTTPS calls/downloads; update the existing private
plugin's instructions; refresh metadata and test in fresh intended clients.
Preserve existing audience, App identity, signing keys, cost and limits. No new
database, history, paid host or solver is needed. Retain previous releases and
explain new-link expiry/regeneration implications if rolling back.
