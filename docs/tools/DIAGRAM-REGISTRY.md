# Diagram registry and generic connector tools

Since wave 4 (November 2026) every diagram family is described once, in
`packages/diagram-core/src/registry.ts`. The connector, worksheets and the in-site AI worksheet
maker all read that registry, so a new family reaches all three without new tool names.

## What the connector advertises

Eight tools in total (about 56 KB of `tools/list`, down from about 478 KB):

| Tool | Purpose |
| --- | --- |
| `diagram_capabilities {kind?}` | With no kind: the short family list. With a kind: that family's options, create and revise guides, `specSchema` and `operationsSchema` (as `structuredContent` and JSON text). |
| `create_diagram {kind, spec?, envelope?, outputView?}` | Builds a new diagram, or re-delivers a saved envelope. |
| `revise_diagram {kind, envelope, baseHash, operations, outputView?}` | Applies operations to the returned envelope; a stale `baseHash` is refused. |
| `check_diagram_placement`, `download_diagram_bundle`, `get_diagram_svg` | Print outputs (unchanged; see MCP-DIAGRAM-OUTPUTS.md). |
| `create_worksheet`, `worksheet_capabilities` | Two-sided A3 worksheets; any family can be placed in one. |
| `create_booklet` | A4 unit booklets (see [BOOKLET-MAKER.md](BOOKLET-MAKER.md)); same items and families as worksheets. Added 11 Nov 2026, the ninth tool. |

Kinds are `graph`, `ratio-table`, `value-graph`, `cuboids`, `number-line`, `venn`,
`algebra-grid`, `bar-model`, `charts`, `probability-tree`, `frequency-tree` and `triangle`. `outputView` applies
only to families with an answers copy (ratio tables, graphs, number lines, Venn, bar models, charts,
probability trees, frequency trees, expanding and factorising grids, and triangles). Value graphs and cuboids hold no
saved answers (a blank value-graph cell or cuboid label has nothing stored), so they stay pupil-only: an answers copy
there would mean calculating. Since M84 (14 November 2026) number lines print answer-line tick values, a hidden
solution and a hidden saved answer in pink (hidden tick labels stay hidden), and bar models (v1, v2 and v3) print
labels saved hidden in pink; blank, question and answer-line bar labels stay as they are. Both copies share one
layout size, and create/revise/bundle results report `outputView` for every answer-view family. Since 14 November 2026 the grid and triangle answers copies show
saved hidden answers, and the two trees colour revealed answers in the house answer colour, as worksheet answers
copies already did for answer lines, ratio tables and graphs. Venn diagrams (regions and set labels saved hidden or
as answer lines) and charts (bars and lines whose value was saved hidden) do the same since R24; their solid grey or
black bar fills turn pink too so the outline still shows. Given values stay black, and pupil copies are unchanged.

A create or revise result starts with a one-line plain summary (`Created a <label>, W × H cm at
100%.`), then the preview image, then `resource_link` blocks for the SVG, PNG and JSON downloads.
`structuredContent` adds `kind`, `summary` and `altText` to the family's own fields (`envelope`,
`contentHash`, `downloads`, `editorUrl`, warnings and so on).

Errors are JSON `{code, message}`. Invalid input uses `invalid_input` and names the field
(`spec.categories: ...`) with a pointer to `diagram_capabilities {kind:"..."}`.

Download links carry deflated, base64url tokens (prefix `z`); older `ey...` tokens still open.
The signature is checked before a token is unpacked.

Limits are unchanged except one addition (Tim, 10 Nov 2026): one address may use at most a quarter
of the 200 MB daily download allowance, so a single script cannot lock everyone out until
midnight UTC. The per-address count is kept in memory; the shared total stays in Cloudflare KV.

The old per-family tools (`create_bar_model`, `revise_venn`, `triangle_capabilities` and so on)
are gone. Tests and scripts that still use the old names go through
`services/graph-mcp/family-tool-names.ts`, which maps them onto the generic calls.

## Diagrams in worksheets

A worksheet item `{"type":"diagram","diagram":{"tool":"<kind>","spec":{...}}}` is built with the
family's own create rules when the worksheet is validated; a saved worksheet always holds the
`envelope`, never the spec. Give exactly one of `spec` or `envelope`. Both pupil and answers copies
must draw, and each diagram prints at its own physical size.

The AI worksheet maker sends only the spec schemas of the families a request needs
(`src/worksheet/ai/families.ts`: keyword cues on the objective plus any family already on the
sheet), in the user turn, so the cached system prompt and tool schema stay byte-identical between
requests. The page refuses spec settings that would print a worked answer on the pupil copy
(`worked…`, `calculate`, `answerVisible`), and asks the model to leave answers blank or hidden.

## Adding a family

1. Build the family's core package as usual (`docs/tools/ADDING-BOOKLET-TOOLS.md`).
2. Add the kind to `DIAGRAM_KINDS` and an entry to `FAMILIES` in
   `packages/diagram-core/src/registry.ts`: `label`, `summary`, `route`, `answerView`, the
   envelope, create and revision schemas, and `validate`, `create`, `revise`, `hash` and `svg`.
   The `Record<DiagramKind, ...>` types make the build fail until every step below is done.
3. Add its guides to `GUIDES` in `packages/diagram-core/src/guides.ts` (long guides live in
   `packages/diagram-core/src/guides/<family>.ts`).
4. Add its result builder to the `diagramTools({...})` map in `services/graph-mcp/server.ts`
   (most families reuse the shared builder in `resource-tools.ts` via `RESOURCE_KINDS`).
5. Add a keyword cue to `CUES` in `src/worksheet/ai/families.ts`, and a small spec to `SPECS` in
   `services/graph-mcp/worksheet-families.test.ts`.
6. Run `npx vitest run services/graph-mcp/diagram-tools.test.ts services/graph-mcp/worksheet-families.test.ts`,
   then refresh the contract snapshot (`UPDATE_CONTRACTS=1 npx vitest run src/gates/contracts.test.ts`);
   the catalogue change goes to Tim.
