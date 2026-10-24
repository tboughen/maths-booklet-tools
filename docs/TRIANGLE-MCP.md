# Triangle MCP contract

This candidate extends the existing Maths Booklet Tools service and App. Source,
service deployment, plugin guidance, actual chat discovery and saved-file use are
separate stages. Follow `MCP-CONNECTOR-ACCEPTANCE.md`, including the historical
ratio schema-import defect and the later unexplained SVG catalogue delay.

Three added names: `triangle_capabilities`, `create_triangle`, `revise_triangle`.
Only invoke them when actually discovered. Existing 24 names remain; the complete
catalogue has 27. The generic placement, bundle and original-SVG tools gain kind
`triangle`. These instructions alone do not deploy a service or import any tools.

## Create and reopen

Supply `spec` OR the exact saved `envelope`, never both. Omitting both creates the
existing unworked right triangle, width 12 cm, right angle at A. Default stable
IDs are A/B/C, T1, AB/AC/BC and T1-A/T1-B/T1-C. Read returned IDs after topology
changes. Numeric geometry coordinates are numbers; printed mathematical values
and calculation inputs are strings.

```json
{"spec":{"shape":"right","widthCm":12,"labels":[
  {"ref":"e:AB","label":{"state":"value","text":"3","unit":"cm"}},
  {"ref":"e:AC","label":{"state":"value","text":"4","unit":"cm"}},
  {"ref":"e:BC","label":{"state":"symbol","text":"x","unit":"cm"}}
]}}
```

Spec fields: `shape` right/scalene/isosceles/equilateral OR `example` (capabilities
lists the 15 existing teaching/source-linked examples), optional `widthCm`,
`notToScale`, `labels:[{ref,label}]` and up to 30 initial `operations`. Initial
operations use the same payloads as revisions; they do not have a separate solver.

Label patches accept `state`, `text`, `prefix`, `unit`, `dx`, `dy`. States are
value/symbol/blank/answer-line/hidden; text remains independently retained. Empty
labels and saved answers are different. Zero is not blank; the core rejects zero
as a physical side/height/area or interior angle. Units: none, mm/cm/m, degrees,
mm²/cm²/m² as appropriate. Offsets are physical mm, bounded to +/-60. Vertex text
is at most 8 characters, ordinary labels 40, captions 120. Bounded fractions,
surds, Greek and algebraic text follow the existing renderer; no executable text.

References: `v:vertexId`, `e:edgeId`, `a:angleId`, `h:heightId`, `c:captionId`,
`r:triangleId` for an existing per-triangle area label. Missing refs reject.

## Atomic revision

Supply `{envelope,baseHash:previous.contentHash,operations:[...]}`. Maximum 30
operations; all succeed or the input remains unchanged. Empty operations refresh
links and preserve exact canonical source/hash/version. SHA-256 uses validated
canonical JSON. The stateless hash check binds the supplied source, not a newer
copy stored in another chat.

| Operation | Payload after `op` |
| --- | --- |
| set_label | ref, patch (fields listed above) |
| set_angle_mark | id, mark:none/arc/double/triple/right |
| set_edge_style | id, optional ticks:0..3 and dashed:boolean |
| move_vertex | id, x, y (finite coordinates within +/-10000) |
| transform | kind:left/right/reflect/vertical |
| set_constraint | triangleId, type:right/equal/equilateral/none, vertex |
| add_triangle | layout:separate/joined/split; edgeId required for joined/split |
| remove_second | no extra fields; split restores outer triangle |
| add_height | triangleId, apex (a vertex of that triangle) |
| remove_height | id |
| set_area | triangleId, label:patch or null to remove |
| add_caption | label:patch |
| remove_caption | id |
| set_shared_label | id, text; adds or updates bounded shared text |
| link_label | ref, sharedId:string or null; unlink retains displayed text |
| set_print | widthCm:6..18 |
| set_not_to_scale | visible:boolean |
| construct | triangleId, method:SSS/SAS/ASA/AAS/right, inputs:named strings |
| calculate_and_store | ref, triangleId, method, optional inputs/branch, rounding:{kind:dp/sf/exact,digits:0..10}, overwrite:false default |
| set_saved_answer | ref, answer:string up to 40, overwrite:false default; manual and hidden |
| keep_answer_manual | ref; explicitly clears provenance of an existing saved answer |
| set_answer_visibility | optional ref, visible:boolean; omitted ref applies to saved answers throughout the source |
| worked_copy | no extra fields; explicitly reveals valid saved answers in returned copy |

Marks and labels remain independent. A right-angle square requires perpendicular
rays and never reshapes geometry. A constraint or construction explicitly changes
geometry. Ordinary printed values do not. Joined/split operations require a real
edge ID; an unknown ID must never fall back to a default side. Every result is
validated and print collisions reject image generation without silently shrinking.

## Explicit calculations

Every Triangle result includes `calculationContexts`: target, owning triangle,
method, `raw` named input mapping, unit, source descriptions and missing fields.
These are mappings, not calculated answers. Use the appropriate returned context.
Optional operation `inputs` fills missing raw fields only. A conflicting printed
given or unknown key rejects; edit the label explicitly before changing a given.
Geometry proportions and hidden answers never provide input measurements.

The selected method must match the actual target and owning triangle. Shared
targets need an explicit owner. Length givens must use one unit. Area/height
calculations use that triangle's own base and perpendicular height; captions on
paired diagrams do not silently supply an area. Core context selection is shared
with the browser editor. Contexts may require explicit missing inputs.

| Method | Named inputs |
| --- | --- |
| pythagoras-hypotenuse | p,q |
| pythagoras-leg | h,p |
| right-side | angle,known,knownSide,targetSide (H/O/A from returned mapping) |
| right-angle | numerator,denominator,ratio (sin/cos/tan from mapping) |
| sine-side | a,A,B |
| sine-angle | a,A,b |
| cosine-side | b,c,A |
| cosine-angle | a,b,c |
| area-height | base,height |
| height-area | area,base |
| area-sine | b,c,A |
| area-angle | b,c,area |
| angle-sum | A,B |

For the create example, request a hidden answer with:

```json
{"op":"calculate_and_store","ref":"e:BC","triangleId":"T1",
 "method":"pythagoras-hypotenuse","rounding":{"kind":"exact","digits":0}}
```

Only a result supporting exact form accepts `exact`; otherwise choose dp or sf.
Significant figures require at least 1. Multiple inverse-sine branches require an
explicit `branch`: `Acute B`/`Obtuse B` or `Acute included angle`/`Obtuse included
angle`. These are the core's formula-letter names; use the context to identify
actual vertices. Impossible requests reject; intentional printed disagreements
can remain as teacher-facing warnings. Existing answers/givens need explicit
overwrite. Results are saved hidden with formula/basis. Stale calculated answers
cannot be revealed; recalculate or explicitly keep as manual. `worked_copy`
reveals saved answers only and does not solve arbitrary unanswered labels.

Construction inputs: SSS a,b,c; SAS b,c,A; ASA A,B,c; AAS A,C,c; right b,c. Follow
the selected triangle's returned vertex order: construction uses its first vertex
as A, second as B, third as C; a/b/c are opposite A/B/C. It constructs proportions,
not physical scale. Retained joined/split constraints still apply.

## Versions, print and transport

Retain kind `triangle`, style `exam-v1`, schema1/triangle-1 and schema2/triangle-2.
Per-triangle area labels use version 2. Adding/removing the last area follows the
browser version rules; a no-op/import does not silently migrate a valid version.
The MCP wire schema uses a homogeneous exactly-three-entry vertex array while
the saved format/internal tuple remains unchanged. Audit both input and output
schemas; a valid internal Zod type alone does not prove client import acceptance.

Limits: two component triangles; three records for split including outer; six
vertices; seven edges; nine angles; two heights (one per triangle); two captions.
Single default width 12 cm, paired 16 cm; width 6–18 cm. Actual full artwork
determines height; 11 pt typography, margins and pupil writing spaces are retained.

Returns preview, envelope/hash, outlined SVG, verified 600 ppi PNG, editable JSON,
physicalSizeCm, printGuidance, warnings and bounded editor link. Ordinary artwork
follows saved pupil visibility. There is no Triangle `outputView`. Explicit answer
visibility/worked-copy revisions return a new source; retain the original scaffold.
JSON and editor links may contain hidden answers. No UI wedges/handles/warnings
print. `printVerified` concerns PNG bytes/density, not Word or a physical printer.

Editor route: `https://mathsdock.co.uk/?tool=triangle#triangle=...`. Core editor-link
encoder/decoder is shared with the browser. Maximum source 64,000 UTF-8 bytes,
editor URL 16,000 characters, signed artifact URL 7,500; request 65,536 bytes
including operations/protocol overhead. Oversized links use bounded inline files;
no promise that every maximum source fits every transport. Existing raster/queue/
archive/chunk/time/memory limits remain. Downloads expire after seven days.

Generic helpers use kind `triangle` and the exact envelope. Bundles keep the
existing five files; placement does not edit the source. `get_diagram_svg` returns
the original outlined bytes when URL retrieval is unavailable. Check source hash,
UTF-8 offsets, chunk/full checksums and saved-file bytes. Source hash and SVG file
checksum have different meanings. Do not redraw, normalize or substitute previews.

## Qualification and host trial

Run service build/tests, full affected core/browser checks and current release
qualification. The service build must include Triangle in Docker, source manifest
and renderer metadata. The service must not import browser components. The
reusable SDK collector is:

```sh
npm run build:service
node service-dist/verify-triangle.js test-results/triangle-mcp
```

Optional third argument selects an authorised live service origin. It retains the
full catalogue, capabilities, six saved examples, hashes, exact original SVG
reassembly, 600 ppi PNGs, JSON, native-size placement and a bundle. It explicitly
records that SDK success is not actual Codex/ChatGPT connector acceptance.

After separately authorised publication, refresh the existing App metadata and
verify all three named calls in the intended chat. Run capabilities -> unanswered
3/4/x create -> answer-line revise -> exact saved SVG/PNG/JSON -> editor reopening.
Then explicitly save/reveal 5 cm while retaining the pupil original, test a v2
area and a paired diagram, and assemble/render a native-size vector PDF. Record
native Word, physical printing, actual phone input and idle/wake separately.

If a tool is missing, compare deployed build, complete names and actual refresh/
import response before changing schemas. One fresh-chat diagnostic with the same
plugin is sufficient; preserve the existing connection. A spinner ending is not
acceptance. Do not invent a cache explanation, create a replacement connection,
discard old tools or redeploy speculatively.
