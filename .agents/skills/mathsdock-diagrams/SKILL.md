---
name: mathsdock-diagrams
description: Create or revise editable MathsDock coordinate graphs, ratio tables, quadratic graphs, cuboids, number lines, Venn diagrams and bar models through the connected Maths Booklet Tools MCP tools, preserving pupil blanks and saved answers and returning real print files and editor links. Use for teaching resources, not tool development.
---

# MathsDock diagrams

Use the existing connected Maths Booklet Tools MCP tools to produce editable teaching diagrams. Inspect the tools available in this conversation; do not infer availability from a previous conversation or create another connection.

## Choose and inspect the tool

When bar calls are actually discovered, request the improved lesson layout with
`spec:{schemaVersion:2,starter:"part-whole"}` (or comparison/equal-sections/inline-ratio).
Bare MCP requests keep the original v1 example. Read [Bar model v2](../../../docs/BAR-MODEL-V2.md)
for complete slots, annotations and operations. Preserve supplied versions and
hashes; v1 needs explicit first `upgrade_document` before new features. Saved text
can be retained under blank, line, question and hidden displays. Never calculate
or reveal answers without the explicit action, mask dividers or silently reanchor.

- For coordinate graphs, read `graph_capabilities`, then use `create_graph` or `revise_graph`.
- For lesson-style ratio tables, read `ratio_table_capabilities`, then use `create_ratio_table` or `revise_ratio_table`.
- For quadratic graphs and tables of values, read `value_graph_capabilities`, then use `create_value_graph` or `revise_value_graph`.
- For one or more cuboids, cubes, cube grids or separated layers, read `cuboid_capabilities`, then use `create_cuboid` or `revise_cuboid`.
- For number-line axes, points, intervals and rays, read `number_line_capabilities`, then use `create_number_line` or `revise_number_line`.
- For set diagrams and region shading, read `venn_capabilities`, then use `create_venn` or `revise_venn`.
- For expanding/factorising grids, read `algebra_grid_capabilities`, then use `create_algebra_grid` or `revise_algebra_grid`. Follow the [algebra contract](../../../docs/ALGEBRA-GRID-MCP.md). Only call these names once actually discovered.

Algebra grids retain integer terms in x, explicit signs, true blanks and hidden
answers. Product cells are12..18mm independent of paper choice. Supply spec or
exact envelope,never both. Revisions use returned IDs and baseHash. Calculate,
fill and worked-copy actions require explicit user intent; calculate_answer
retains the pupil scaffold. Editable files/links may contain hidden answers.

Only call tools actually discovered in this conversation. A newer skill does not establish that the service or client exposes newer integrations. Use capabilities and the discovered schemas for complete payloads. Cuboids, Number lines and Venn accept either a concise `spec` or an existing `envelope`; never supply both. Older Graph/Ratio/value-graph calls keep their existing payloads.

Treat current capabilities and input schemas as authoritative for support limits and payload shapes. A legacy default is not necessarily a limit: ratio `columns: 2` and `rendererVersion: ratio-1` coexist with supported column counts and renderer versions. Structural changes can normalize the returned version; reuse the returned envelope rather than imposing the original version.

If the connector is absent or a required feature is missing, explain the specific gap. Do not present a substitute image or Markdown table as the requested tool's output. Offer an appropriate fallback only with clear labelling. A connector refresh may require a fresh conversation before new definitions are available.

## Preserve the resource

Preserve explicitly entered numbers, headings, blank cells and answer lines. Empty, answer-line and zero are different states. Do not solve a scaffold because its answer is inferable. Changing or hiding an arrow or factor changes the annotation; fill answers only when the user requests it.

One ratio scaling transition applies across every column. Preserve that shared factor and its displayed copies. Keep teacher-entered mathematical disagreements if the tool permits them, and explain returned warnings without silently correcting the exercise or adding warnings to the pupil diagram.

Graph scale and physical grid size are separate choices. Preserve specified coordinates, axis scales and equation-label visibility; do not add equation labels or solutions the user did not ask to show. Let the tool validate geometry and print layout.

Cuboid dimension edits respect cube locking; enabling it requires an explicit referenceAxis. Unit changes convert the existing physical object. Worked volume/area, counts and area values are explicit teaching choices, independent of blank labels and custom captions. Keep the returned crop dimensions; layout width is not necessarily the exported image width. Service pixel/cube limits may reject a demanding combination without changing its mathematics.

Number-line filled/hollow endpoints, rays, point joins, hidden solutions and tick answer lines must remain as requested. Do not silently extend the axis or delete points to make an edit valid. A truncated ray requires explicit intentional-error settings.

Venn membership uses stable masks: 0 outside; A=1, B=2, C=4. Labels may change without changing membership or set-expression IDs. Only active regions exist in a layout. Do not supply discardIncompatible:true unless the user requested discarding the affected saved contents; a loss warning is not permission. Preserve reverse nesting and never merge values. outputView defaults pupil; request answer only explicitly. Answer artwork retains the same canonical pupil envelope/hash. Editable JSON and links may contain hidden answers. If a separately editable worked copy is requested, create that copy explicitly rather than replacing the pupil source.

## Revise the exact returned document

Use the returned envelope and its `contentHash` as the next revision's `baseHash`. Use stable row/object IDs and atomic operations. Numeric ratio values and factors are strings; columns are zero-based. Follow the current schema for every operation. For example, a ratio factor change uses a nested transition:

```json
{"op":"set_transition","transition":{"from":"start","to":"target","operation":"multiply","factor":"4"}}
```

Preserve all unrelated settings and content. Use overwrite only when the user requests replacement of existing target values. After a revision, continue with its returned envelope and hash. If a stale hash is rejected, reconcile against the latest returned document; do not guess a replacement hash.

## Print output for another AI project

The consuming AI owns booklet assembly, final placement and saving. Use the
returned physicalSizeCm for native placement and preserve aspect ratio. The
downloaded 600 ppi PNG is the print image; the inline preview is not. Service SVG
is vector artwork with outlined lettering. printVerified checks the PNG, not a
downstream document or physical printer. Keep the JSON for revisions.

Inspect actual discovery before using optional output tools. If printGuidance
is returned, its visible text, grid, answer-line and row measurements describe
the current resource at native size and do not enter its definition/hash.
When considering a resize, check_diagram_placement accepts kind, the returned
envelope, and widthMm and/or heightMm. No baseHash is needed. It reports a
proportional fit and print consequences without inspecting or editing a booklet.
Warnings do not impose a universal minimum or require repeated confirmations.

If available and useful, download_diagram_bundle accepts kind and the saved
envelope and provides JSON/SVG/print PNG/print facts/README as one ZIP. Retrieve
the actual archive before claiming success; a returned link is not a saved file.
Repeat the call with saved source to refresh expiry. The server retains no
artifact library. Optional failure leaves the individual downloads usable; never
invent a tool call or signed URL. Legacy Graph fonts require the explicitly
reported portable conversion before bundling. Saving to another project is the
consumer's action. The website opens extracted source.json, not the ZIP itself.

For quadratic resources, inspect value_graph_capabilities and use the discovered
create_value_graph/revise_value_graph tools. Preserve blank/answer-line/zero
states, hidden labels and deliberate plotting errors. Calculating answers and
plotting worked variants remain explicit actions.

## Recover an original SVG when downloads are blocked

Try the exact returned SVG URL through the environment's supported download
workflow, including its required URL-opening step where available. Record the
actual tool error or HTTP response. A local URL-view restriction or DNS failure
does not demonstrate a MathsDock HTTP failure. Do not invent container.download.

If `get_diagram_svg` is actually discovered, call it with kind and the unchanged
returned envelope; no URL or baseHash. Venn defaults pupil; request answer only
explicitly and repeat that outputView for every chunk. First omit offsetBytes;
maxChunkBytes is 1024..49152 (default49152). Continue using nextOffsetBytes and
expectedSvgSha256 copied from the first result's svgSha256. Keep source and view
unchanged. Read one representation of the result: structuredContent or decoded
JSON text. Save decoded svgChunk as exact UTF-8 without BOM, added newline,
normalization or literal JSON escapes.

Before appending, verify contiguous offsetBytes, chunkBytes and chunkSha256.
Require stable kind,rendererVersion,sourceContentHash,physicalSizeCm,outputView,
totalBytes and svgSha256. Reject missing,duplicate,truncated or changed chunks.
The last chunk has complete:true and nextOffsetBytes:null; verify complete byte
count/hash and parse as SVG before saving/embedding. sourceContentHash is the
revision hash; svgSha256 is the rendered-file checksum. They differ in meaning.
Use bounded continuation and respect quotas; a smaller chunk may be needed if
the serialized response exceeds256KiB. Never loop/retry indefinitely.

Place the verified saved SVG at physicalSizeCm, preserving aspect ratio. Inspect
the resulting vector PDF before claiming success. complete means delivery, not
that a file was saved or a worksheet finished. If exact saving fails, explain
the client limitation. Do not silently redraw. A600ppi PNG is an explicitly
disclosed alternative only when suitable for the request; the preview is not it.
If the tool is absent, explain the discovery gap and refresh/fresh-chat step.
Instructions alone do not make it available. Actual ChatGPT acceptance requires
the full saved-SVG-to-vector-PDF test in that client.

## Return usable artifacts

Show the returned preview and concise links to the actual SVG, verified print PNG, editable JSON and website editor where supplied. Use only tool-returned URLs or embedded resources; never construct signed download links. Editor links should target `mathsdock.co.uk`; report a different returned target rather than rewriting a signed or encoded URL by guesswork.

Keep physical dimensions distinct from preview zoom. Word exports are images; further mathematical edits require reopening the editable document in MathsDock. Expired downloads can be refreshed through the supported revision operation with the same returned document, without changing content.

Do not claim that Word paste, client refresh, saving, or a website/service deployment was tested merely because the tool returned files. Keep all pupil information and credentials out of diagrams and service requests.

## Bar modelling

For bar-model resources or development read [Bar-model MCP](../../../docs/BAR-MODEL-MCP.md) and [the implementation brief](../../../docs/BAR-MODEL-BRIEF.md). Call bar_model_capabilities/create_bar_model/revise_bar_model only when actually discovered. Preserve shared unit widths, anchored spans, original variables and hidden answers; do not infer answers or reconstruct artwork from previews. New guidance alone does not establish service or intended-client availability.
