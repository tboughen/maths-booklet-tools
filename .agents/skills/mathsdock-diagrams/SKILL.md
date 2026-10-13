---
name: mathsdock-diagrams
description: Create or revise editable coordinate graphs and lesson-style ratio tables with the existing MathsDock or Maths Booklet Tools MCP connector, preserving pupil blanks and returning real print downloads and editor links. Use for making teaching resources, not implementing new website tools.
---

# MathsDock diagrams

Use the existing connected Maths Booklet Tools MCP tools to produce editable teaching diagrams. Inspect the tools available in this conversation; do not infer availability from a previous conversation or create another connection.

## Choose and inspect the tool

- For coordinate graphs, read `graph_capabilities`, then use `create_graph` or `revise_graph`.
- For lesson-style ratio tables, read `ratio_table_capabilities`, then use `create_ratio_table` or `revise_ratio_table`.

Treat current capabilities and input schemas as authoritative for support limits and payload shapes. A legacy default is not necessarily a limit: ratio `columns: 2` and `rendererVersion: ratio-1` coexist with supported column counts and renderer versions. Structural changes can normalize the returned version; reuse the returned envelope rather than imposing the original version.

If the connector is absent or a required feature is missing, explain the specific gap. Do not present a substitute image or Markdown table as the requested tool's output. Offer an appropriate fallback only with clear labelling. A connector refresh may require a fresh conversation before new definitions are available.

## Preserve the resource

Preserve explicitly entered numbers, headings, blank cells and answer lines. Empty, answer-line and zero are different states. Do not solve a scaffold because its answer is inferable. Changing or hiding an arrow or factor changes the annotation; fill answers only when the user requests it.

One ratio scaling transition applies across every column. Preserve that shared factor and its displayed copies. Keep teacher-entered mathematical disagreements if the tool permits them, and explain returned warnings without silently correcting the exercise or adding warnings to the pupil diagram.

Graph scale and physical grid size are separate choices. Preserve specified coordinates, axis scales and equation-label visibility; do not add equation labels or solutions the user did not ask to show. Let the tool validate geometry and print layout.

## Revise the exact returned document

Use the returned envelope and its `contentHash` as the next revision's `baseHash`. Use stable row/object IDs and atomic operations. Numeric ratio values and factors are strings; columns are zero-based. Follow the current schema for every operation. For example, a ratio factor change uses a nested transition:

```json
{"op":"set_transition","transition":{"from":"start","to":"target","operation":"multiply","factor":"4"}}
```

Preserve all unrelated settings and content. Use overwrite only when the user requests replacement of existing target values. After a revision, continue with its returned envelope and hash. If a stale hash is rejected, reconcile against the latest returned document; do not guess a replacement hash.

## Return usable artifacts

Show the returned preview and concise links to the actual SVG, verified print PNG, editable JSON and website editor where supplied. Use only tool-returned URLs or embedded resources; never construct signed download links. Editor links should target `mathsdock.co.uk`; report a different returned target rather than rewriting a signed or encoded URL by guesswork.

Keep physical dimensions distinct from preview zoom. Word exports are images; further mathematical edits require reopening the editable document in MathsDock. Expired downloads can be refreshed through the supported revision operation with the same returned document, without changing content.

Do not claim that Word paste, client refresh, saving, or a website/service deployment was tested merely because the tool returned files. Keep all pupil information and credentials out of diagrams and service requests.
