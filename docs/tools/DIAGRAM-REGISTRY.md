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
`algebra-grid`, `bar-model`, `charts`, `probability-tree`, `frequency-tree`, `triangle`, `construction` and `elevations`
([constructions, loci and bearings](CONSTRUCTION-TOOL.md) and [plans and elevations](ELEVATIONS-TOOL.md), 14 Nov 2026). `outputView` applies
only to families with an answers copy (ratio tables, graphs, number lines, Venn, bar models, charts,
probability trees, frequency trees, expanding and factorising grids, triangles, constructions, and plans and elevations). Value graphs and cuboids hold no
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
`altText` (M16) always describes the pupil copy, even when `outputView` is `answer`, so it
never reveals hidden answers; the answer-leak check (W90) covers the label it comes from.

Every connector failure, from any tool and from the SDK's own input checks, has one shape
(improvement list M12, `services/graph-mcp/tool-error.ts`, body type in
`packages/envelope-core/src/errors.ts`):

```json
{ "code": "invalid_input", "message": "spec.categories: Expected array",
  "fields": [{ "path": "spec.categories", "message": "Expected array" }],
  "hint": "Check diagram_capabilities {kind:\"charts\"} for the expected fields.",
  "retry": "fix_input" }
```

- `fields` and `hint` are optional; `message` always repeats the field problems in words.
- `retry` is `fix_input`, `refresh_envelope` (a stale `baseHash`: every family's core throws code `stale_hash`),
  `try_later` (quota, busy, stopped or timed-out renderer) or `none`.
- Cores throw `MathsDockError(code, message, { fields, hint })` (GraphError and RatioError extend
  it). A plain `Error` keeps its message under the tool's default code; a message starting with
  a known code (`stale_hash: `) is read as that code, and any other `word: ` prefix stays text.
  The output and SVG tools replace an uncoded `Error`'s text with a fixed sentence, and an SDK
  failure (such as a result that breaks its output schema) answers `internal` and only its lead-in is logged, so
  internal detail never reaches the model. The SDK is pinned: upgrading it must pass
  `services/graph-mcp/tool-error.test.ts`, which guards the two SDK internals this relies on.

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

## Answer states (W3, 14 November 2026)

Every fillable or answer-bearing slot reads as one of five states, defined once in
`packages/envelope-core/src/answer-state.ts`: `supplied`, `zero` (a supplied 0, never blank),
`blank`, `answerLine` and `hidden`. Families keep their own saved fields (`show`, `visibility`,
`state`, `kind`, `answerOnly`, `answerVisible` ...); `answerSlots(kind, envelope)` in
`packages/diagram-core/src/answer-slots.ts` only reads them, and `resourceAnswerSlots` in
`packages/resource-core/src/answer-slots.ts` does the same for worksheets and booklets, including
their diagrams. Nothing is derived or changed. Notes per family:

- A label printed with `answerVisible: true` (triangle, number line, algebra grid) is `supplied`.
- A triangle `blank` label that holds a saved answer is `hidden`: the answers copy prints it.
- A bar-model `question` label prints "?" and is `supplied`.
- Cuboid `hidden` means no label at all; cuboids and value graphs store no answers.
- Graph slots are answer-only objects only. An algebra grid's final answer is a slot only while
  shown: hidden, it prints on neither copy.

A new family adds its visitor in `answer-slots.ts`; `answer-slots.test.ts` reads the whole corpus.

**Answer-leak check (W90).** `answerLeaks(kind, envelope)` in
`packages/diagram-core/src/answer-leaks.ts` checks a pupil copy two ways: it never uses the answer
colour, and swapping every saved answer for a same-length stand-in changes none of its printed
text (text, title, desc, aria-label, so alt text too). Geometry is not compared, because both
copies share one layout sized for the answers. The worksheet renderer reports a leak as a layout
issue, and `create_diagram` / `revise_diagram` add it to their warnings.

## Single-diagram PDF (U32, 14 November 2026)

Every editor's menu has **Download PDF (actual size)**: the same artwork as Download SVG on an A4
portrait page (A4 landscape or A3 when it does not fit inside 15 mm margins), centred 15 mm from
the top and never scaled. `diagramPage` (`packages/resource-core/src/diagram-page.ts`) builds the
page; the worksheet PDF writer draws it and the W30 audit checks it before it is offered. Print at
"Actual size" (100 %).

## Tidy root numbers (U38, 14 November 2026)

Every family's artwork from the registry, every website SVG export (`embedPortableFonts` and the
graph's own download) and every connector SVG download passes through `tidySvgRoot`
(`packages/envelope-core/src/svg-root.ts`): the root `width`, `height` and `viewBox` are rounded to
four decimal places of their own unit, so `5.515280000000001cm` becomes `5.5153cm`. The print size
changes by at most 0.5 µm in cm (1.3 µm in inches); a value too small to keep at four places is
left alone, and nothing below the root element changes.

## Title and note (U34, 14 November 2026)

Every family's envelope may carry `title` (up to 80 characters) and `note` (up to 600) at its top
level, after `document` (`packages/envelope-core/src/about.ts`). They are the teacher's name for
the diagram and a free note, saved in the editable file and its link. Neither is ever printed: the
artwork, previews and print files are identical with or without them. They take part in the
contentHash, so a revision quotes the hash of the titled file. Create from an envelope and every
revision keep them unchanged; a file without them keeps its exact canonical text and hash
(`packages/diagram-core/src/about.test.ts`). A new family spreads `aboutShape` into its envelope
schema and carries `aboutOf(envelope)` onto any envelope it rebuilds.

## Worked-solution notes (U116, 14 November 2026)

The same spread carries an optional `worked` list (`packages/envelope-core/src/worked.ts`): up to
12 notes of dark-pink guidance for the worked copy, each with `text` (one line, up to 160
characters, wrapped at word boundaries to `widthMm`, default 60 mm), `x` and `y` (the note's
top-left corner, in mm from the artwork's top-left at its printed size) and an optional straight
`leader` ending at a point in the same mm frame. They follow the worked-solution rulebook: black
maths, nearby dark-pink guidance, no leader by default, a straight leader only when needed, never
an L-shaped leader.

- They print only on the answers copy, as the artwork's last layer, at 11 pt STIX Two in the house
  answer colour (`ANSWER_COLOUR`). The pupil copy is byte-identical with or without them.
- They never change the diagram's printed size. A note sits inside the artwork or, where a small
  diagram has no room (Tim, 14 Nov), in a margin of up to `WORKED_MARGIN_MM` (70 mm) beyond any
  edge; negative positions are left of or above it. The answers copy's page then grows round the
  artwork to hold the note (`workedPage`), with the artwork at the same size and place; the pupil
  copy never changes. Editor previews draw such notes in place (`inPlace`), overflowing the
  artwork, because the editors' controls sit over it.
- The registry's `validate` refuses a note that runs past that margin, a leader that ends outside
  the artwork or on its own note, and notes that overlap one another, each with a message naming
  the note and what to change.
- `FAMILIES[kind].svg(envelope, "answer")` draws them, so worksheets, booklets, the connector's
  files, bundles and get_diagram_svg all show the same notes. Families without an answers copy
  (tables of values and graphs, cuboids) refuse a `worked` list until they have one.
- In the website, "Worked notes…" in the File menu edits them in the tools with an answers copy
  (ratio tables, Venn, charts, probability and frequency trees, two-way tables, constructions and
  elevations) and in the graph, number line, expanding and factorising, triangle and bar-model
  editors, whose answers print in worksheets, booklets and the connector (algebra grids and
  triangles also show the notes in their teacher preview); see `docs/tools/BOOKLET-CONSISTENCY.md`.
- They take part in the contentHash and survive every revision through `aboutOf`
  (`packages/diagram-core/src/worked.test.ts`).

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
