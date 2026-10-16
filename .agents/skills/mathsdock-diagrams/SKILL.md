---
name: mathsdock-diagrams
description: Create or revise editable MathsDock coordinate graphs, ratio tables, quadratic graphs, cuboids, number lines and Venn diagrams through the connected Maths Booklet Tools MCP tools, preserving pupil blanks and saved answers and returning real print files and editor links. Use for teaching resources, not tool development.
---

# MathsDock diagrams

Use the existing connected Maths Booklet Tools MCP tools to produce editable teaching diagrams. Inspect the tools available in this conversation; do not infer availability from a previous conversation or create another connection.

## Choose and inspect the tool

- For coordinate graphs, read `graph_capabilities`, then use `create_graph` or `revise_graph`.
- For lesson-style ratio tables, read `ratio_table_capabilities`, then use `create_ratio_table` or `revise_ratio_table`.
- For quadratic graphs and tables of values, read `value_graph_capabilities`, then use `create_value_graph` or `revise_value_graph`.
- For one or more cuboids, cubes, cube grids or separated layers, read `cuboid_capabilities`, then use `create_cuboid` or `revise_cuboid`.
- For number-line axes, points, intervals and rays, read `number_line_capabilities`, then use `create_number_line` or `revise_number_line`.
- For set diagrams and region shading, read `venn_capabilities`, then use `create_venn` or `revise_venn`.

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

## Return usable artifacts

Show the returned preview and concise links to the actual SVG, verified print PNG, editable JSON and website editor where supplied. Use only tool-returned URLs or embedded resources; never construct signed download links. Editor links should target `mathsdock.co.uk`; report a different returned target rather than rewriting a signed or encoded URL by guesswork.

Keep physical dimensions distinct from preview zoom. Word exports are images; further mathematical edits require reopening the editable document in MathsDock. Expired downloads can be refreshed through the supported revision operation with the same returned document, without changing content.

Do not claim that Word paste, client refresh, saving, or a website/service deployment was tested merely because the tool returned files. Keep all pupil information and credentials out of diagrams and service requests.
