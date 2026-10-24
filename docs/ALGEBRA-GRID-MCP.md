Routine publication follows the [MCP release playbook](MCP-RELEASE-PLAYBOOK.md) and
[checklist](MCP-RELEASE-CHECKLIST.md). Retained incident/family details below remain
applicable; historical family/tool counts are snapshots, not discovery evidence.

# Expanding and factorising MCP contract

Uses the existing Maths Booklet Tools service/App. Website, service deployment,
plugin instructions and actual conversation discovery are separate release stages.
Follow [connector acceptance](MCP-CONNECTOR-ACCEPTANCE.md) and retain exact files.

New names: `algebra_grid_capabilities`, `create_algebra_grid`,
`revise_algebra_grid`. Do not call them until actually discovered. Existing six
families retain their signatures. Three generic output calls gain `algebra-grid`:
`check_diagram_placement`, `download_diagram_bundle`, `get_diagram_svg`.

Creation accepts one of `spec` or the exact saved `envelope`, never both.
Omitting both creates a blank 3 by 3 grid. Counts include the heading row/column.

```json
{"spec":{"example":"double","cellMm":15,"settings":{"questionVisible":true},"cells":[{"rowId":"r1","columnId":"c1","value":"x^2","hidden":true}]}}
```

`spec` fields: example (single,double,signed,cubic,factor,negative,common,
source-expand,source-factor); rowCount/columnCount (2..7,exclusive with example);
cellMm (12..18); settings; cells. Initial IDs are r0/r1/etc and c0/c1/etc.
`cells` use rowId,columnId,value (integer term string or null),optional hidden.
Null is an intentional blank; zero is a value. All entries are retained, never
filled implicitly. Hidden values remain in editable JSON and editor links.

Settings: mode expand/factorise; expression string; questionVisible/gridVisible;
answerLines0..3; compactHeadings; gridLineMm0.35/0.5/0.79375 (legacy0.2 retained);
paper A4/A3; orientation portrait/landscape; intentionalError for deliberately
inconsistent error-spotting artwork. Invalid syntax and crowded output reject.
Product cells remain square12..18mm independently of paper and preview scaling.
Each edge has1..6 terms; coefficients bounded to +/-999999999999,powers0..6.
No fraction or multivariable syntax. Multiplication18pt,algebra12pt,internal rules.

Revision: supply exact returned envelope,baseHash:contentHash,operations(max30).
All operations apply atomically and use returned stable IDs. Empty operations
refresh links without changing source/hash. Operation payloads:

- set_cell {rowId,columnId,value,hidden?}; omitted hidden retains current state.
- set_settings {settings}; mode and expression can be changed together.
- set_cell_size {cellMm}; resets explicit column widths like the website.
- set_column_width {columnId,widthMm:12..45}; records an explicit override.
- add_row {},remove_row {},add_column {},remove_column {} append/remove last edge.
- fill_products {overwrite:false}; existing products require explicit true.
- collect_answer {} reads complete products or supplied factor headings.
- calculate_answer {} explicitly supplies only the final answer,retaining all
  pupil cells,hidden values and blank headings/products.
- worked_copy {} explicitly returns a worked variant; retain the caller's original.
- set_answer_visibility {visible}; showing requires a saved non-stale answer.

Automatic factorising uses monic integer quadratics in3x3 or single-row common
factors; other shapes need correct supplied headings. Unsupported factors reject.
Content edits preserve products/answers and use existing disagreement/staleness
guards. Stale baseHash,unknown IDs,invalid shapes/terms or partial edits reject
without modifying the input. Do not request a calculation without user intent.

Returns exact version1/algebra-grid-1/departmental-v1 source and SHA256 of its
canonical JSON,preview,outlined SVG,verified600ppi PNG,JSON,physicalSizeCm,
printGuidance and bounded editor URL (`?tool=expanding-factorising#algebra-grid=`).
Oversized links use existing bounded inline file content/JSON reopening. Pupil
visibility is the artwork default; revealing answers is an explicit revision.
No alternate outputView for this family. No UI controls or teacher warnings print.

Generic output tools use kind `algebra-grid` and the exact returned envelope.
Source/renderer versions and pupil blanks remain unchanged through bundles and
SVG delivery. Signed links last seven days; refresh by empty revision. Existing
queue,pixel,request,archive,chunk,CPU/memory limits apply; never silently shrink.
Follow [original SVG verification](DIRECT-SVG-DELIVERY.md) for UTF8 byte offsets,
source/full/chunk hashes and verified saving. The source hash differs from the
SVG checksum. Physical size and print facts stay outside the definition/hash.

Acceptance includes actual service schemas (homogeneous arrays),retained21 old
names plus three new names,actual intended-chat calls and exact saved outputs.
Qualification covers scaffold/factorising/hidden/zero/signed/max/legacy cases,
atomic/stale failures,600ppi downloads,vector PDF,editor reload/Undo/mobile,
bundle and multi-chunk reassembly. Record target-client refresh/results and
unverified idle/Word/physical-print stages honestly. A successful SDK test is
not actual ChatGPT acceptance. Package updates preserve App binding/audience.
