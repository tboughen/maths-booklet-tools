---
name: mathsdock-diagrams
description: Use whenever a teacher asks for a maths diagram, worksheet or other teaching resource and MathsDock tools (diagram_capabilities, create_diagram, create_worksheet, create_booklet) are connected. Covers coordinate graphs and straight lines, ratio tables, quadratic value graphs, cuboids, number lines and inequalities, Venn diagrams, expanding or factorising grids, bar models, statistical charts (not histograms or time series), probability trees, triangles, worksheets and unit booklets. Load it before the first MathsDock call, so pupil blanks and hidden answers are kept, answer versions are made only on request, and real print files and editor links are returned. Not for developing the tools.
---

<!-- Generated from .agents/skills/mathsdock-diagrams/SKILL.md by scripts/plugins/claude-plugin.mjs. Edit the source, then rerun it. -->

# MathsDock diagrams

Use the MathsDock connector in this conversation to make editable teaching diagrams for
school maths resources. Only call tools that this conversation actually discovered. A newer
skill, a previous chat or the source code does not prove a tool exists here; if a tool or
feature is missing, say exactly what is missing and that a connector refresh or a fresh
chat may be needed.

## Pick the family, then read its capabilities

Current connector builds have three diagram tools that work for every family:

1. `diagram_capabilities` with no `kind` lists the families. With `kind`, it returns that
   family's limits, guidance and the JSON Schemas for its `spec` and revision `operations`.
   Read it before the first create or revise of a family in a conversation.
2. `create_diagram` with `kind` and either a concise `spec` or an existing `envelope`, never both.
3. `revise_diagram` with `kind`, the latest returned `envelope`, its `contentHash` as
   `baseHash`, and atomic `operations`.

| Teacher asks for | `kind` |
| --- | --- |
| Coordinate grid with points, segments, straight lines | `graph` |
| Ratio or proportion table | `ratio-table` |
| Quadratic graph with a table of values | `value-graph` |
| Cuboids, cubes, cube grids, layers | `cuboids` |
| Number line, inequality, intervals | `number-line` |
| Venn diagram, set shading | `venn` |
| Expanding or factorising grid | `algebra-grid` |
| Bar model (part-whole, comparison, equal parts) | `bar-model` |
| Bar, dual, composite or vertical line chart | `charts` |
| Probability tree | `probability-tree` |
| Triangle with lengths, angles, Pythagoras or trigonometry | `triangle` |

Older builds have per-family tools instead (`graph_capabilities`, `create_graph`,
`revise_graph`, `venn_capabilities` and so on). Use whichever set this conversation
discovered, in the same way: read the family's capabilities, then create or revise.
Everything below applies to both.

What the connector cannot draw: curves on the coordinate `graph` (use `value-graph` for
quadratics), time series, frequency polygons and histograms. Say so plainly. Never present
a substitute image, Markdown table or hand-drawn SVG as the tool's output; offer a labelled
alternative only if the teacher wants one.

## Teaching rules that always apply

- **Never fill, calculate or reveal answers unless the teacher explicitly asks.** A blank
  that the teacher could work out is still a blank. "Make it easier" or "make it look
  finished" is not a request to fill answers; ask, or suggest a scaffold.
- Blank, answer line, zero and hidden answer are four different states. Keep each exactly
  as requested.
- Operations that calculate, fill, collect or reveal answers, make worked copies, upgrade
  a document's version, or discard saved content (for example `calculate_answer`,
  `fill_products`, `fill_next_row`, `calculate_cells`, `calculate_and_store`,
  `reveal_saved_answers`, `worked_copy`, `upgrade_document`, `discardIncompatible`) need the
  teacher's explicit request for that action. A loss warning is not permission to discard.
- `outputView: "answer"` (Venn, charts, probability trees) only when the teacher asks for
  the answer version. When they do, make the pupil diagram first, then call
  `create_diagram` again with the same `kind`, the returned `envelope` and
  `outputView: "answer"`, and give both sets of links, labelled pupil and answer. The
  pupil source and its hash stay the same. The answer view reveals hidden entered
  answers; it does not shade or calculate. So when the answer is a shaded region, the
  answer version is instead a separate shaded copy: revise the pupil envelope to shade
  it, keep the unshaded pupil version, and label both.
- Coordinate graphs: leave `equationVisible` false unless the teacher asks to print or label
  the equation. "Plot y = 2x + 1" does not ask for a label. On revisions keep label
  visibility, axes and unchanged objects.
- A worked or answer copy is a separate document made only on request (for example the
  `worked_copy` operation). Never replace or overwrite the pupil source to make one.
- Keep teacher-entered numbers, labels, headings and deliberate mistakes. Explain warnings;
  do not silently correct the exercise or add warnings to the pupil diagram.
- Keep pupil names, school details and credentials out of every request.

## Revise the exact returned document

Always continue from the envelope the last call returned and use its `contentHash` as the
next `baseHash`. Use the stable row, part, object and region IDs it contains. Numeric ratio
values and factors are strings; columns are zero-based. If a hash is rejected as stale,
reconcile against the latest returned document; never guess a hash. Use `overwrite` only
when the teacher asks to replace existing values. Errors name the field and what was
expected: fix that field and try once more rather than guessing a different payload.

## Family notes

- **Bar models.** Request `spec.schemaVersion: 3` for new models: horizontal a/b fractions
  in Maths captions and handwriting space of 12 mm above and 3 mm below each answer line.
  Answer lines inside bars need actual uniform bars of at least 20 mm; the stored
  `barHeightMm` (8 to 24) is only a minimum. Plain text captions are only for dates and
  literal slashes; ambiguous or nested fractions fail rather than fall back. All bars
  share one unit width; labels never change widths. Never shrink fonts, resize bars
  horizontally or upgrade automatically to make text fit. A bare request without a
  version stays v1 and an explicit v2 spec stays v2; saved v1 and v2 files keep their
  version until the teacher asks for `upgrade_document`. For a v2 lesson layout, request
  `spec: {schemaVersion: 2, starter: "part-whole"}` (or `comparison`, `equal-sections`,
  `inline-ratio`). An explicit upgrade runs once,
  first in the batch, checks the original hash and rolls the whole batch back on failure;
  one Undo restores the original version. See [Bar model v3](https://github.com/tboughen/maths-booklet-tools/blob/main/docs/tools/BAR-MODEL-V3.md) and
  [Bar-model MCP](https://github.com/tboughen/maths-booklet-tools/blob/main/docs/tools/BAR-MODEL-MCP.md).
- **Ratio tables.** One scaling transition applies across every column. Keep that shared
  factor and its copies. A legacy default is not a limit: follow the capabilities for
  supported column counts and renderer versions, and reuse the returned envelope's
  version. A factor change uses a nested transition, for example
  `{"op":"set_transition","transition":{"from":"start","to":"target","operation":"multiply","factor":"4"}}`.
  A `hidden` cell (`{kind:"hidden",value}`) and a transition with `hidden: true` print only in
  the answers copy (`outputView: "answer"`); headings point right, up or down (`y ↓` for
  negative gradients).
- **Value graphs.** Keep blank, answer-line and zero cells distinct, hidden labels and any
  deliberate plotting errors. Calculating cells and worked plots are explicit actions.
- **Cuboids.** Dimension edits respect cube locking; enabling it needs an explicit
  `referenceAxis`. Unit changes convert the existing object. Worked volume and area are
  teaching choices the teacher makes. Keep the returned crop size; layout width is not
  necessarily the exported image width.
- **Number lines.** Keep filled or hollow endpoints, rays, joins, hidden solutions and tick
  answer lines as requested. Never extend the axis or delete points to make an edit valid.
  A truncated ray needs the explicit intentional-error settings.
- **Venn.** Membership masks are stable: 0 outside, A = 1, B = 2, C = 4. Renaming a set
  never changes membership. Never merge region values. Only active regions exist in a
  layout; keep reverse nesting as drawn. The answer view keeps the same
  pupil envelope and hash; it is a different rendering, not a different document.
- **Algebra grids.** Integer terms in x, explicit signs, true blanks and hidden answers.
  `calculate_answer` (only on request) keeps the pupil scaffold. Product cells are 12 to
  18 mm, whatever the paper size.
  See [Algebra grid MCP](https://github.com/tboughen/maths-booklet-tools/blob/main/docs/tools/ALGEBRA-GRID-MCP.md).
- **Charts.** See the [charts guide](https://github.com/tboughen/maths-booklet-tools/blob/main/docs/tools/CHARTS-TOOL.md).
- **Triangles.** Keep explicit labels, topology and saved answers. Use the returned
  `calculationContexts` for target mappings. Never measure drawn proportions. See
  [Triangle MCP](https://github.com/tboughen/maths-booklet-tools/blob/main/docs/tools/TRIANGLE-MCP.md).

## Worksheets

Worksheets follow the [Maths Resource Design Guide](https://github.com/tboughen/maths-booklet-tools/blob/main/docs/content/MATHS-RESOURCE-DESIGN-GUIDE.md):
PLAN gives a progression, FINALISE gives the full checked questions, and PRODUCE makes the
resource from the latest finalised set. Each command does one stage. When the teacher asks
for the resource itself or says PRODUCE, produce it without adding another approval step;
if the questions it needs have not been written or cannot be found, say what is missing
rather than inventing them. The teacher's brief sets the format; two-page A3 is the guide's
usual default, not a rule. To produce, read `worksheet_capabilities` once and call
`create_worksheet` with the whole document, in one call rather than many small attempts,
because each call costs the teacher time and tokens. Check the mathematics before the
call, then report every layout issue it returns and look at the returned pages before
calling the worksheet finished.

For a unit booklet (A4 portrait, one lesson per objective), call `create_booklet` once with the
whole booklet; `worksheet_capabilities` lists its layout and section kinds. Give every lesson a
one-sentence key idea, a check in on its prerequisites, worked example and "Our turn" pairs,
practice that fades, lettered diagnostic questions and a spot-the-mistake card, as its
description sets out. A whole unit goes in one call: send diagrams as specs, not envelopes, and
do not split the unit. Share the whole-booklet links and the per-lesson PDF links it returns.

Use a `ratio-table` diagram, not a plain `table` item, for ratio, scaling, rate and
x → / y ↑ gradient tables, so the curved scaling arrows show the method. Write it in the
compact form, which keeps a booklet with many tables small:
`{"tool":"ratio-table","spec":{"columns":["x →","y ↑"],"table":[["2","4"],["1","[2]"]],"steps":["÷ 2"]}}`.
A cell is `"4"` (printed), `""` (blank), `"_"` (answer line), `"[2]"` (hidden answer, answers
copy only) or `"[2]_"`; a step is `"× 3"` or `"÷ 2"`, and `"[÷ 2]"` leaves pupils an answer
line beside the arrow. Keep plain tables for tables of values and other non-ratio tables.

## Files and links

- Show the returned preview and the real links it returned: SVG, 600 ppi print PNG,
  editable JSON and the MathsDock editor link. Use only URLs a tool returned. Never build,
  shorten or edit a signed download link, and never invent a download tool. Editor links
  should point at `mathsdock.co.uk`; report a different returned target rather than
  rewriting it.
- The inline preview is not the print image. Place diagrams at the returned
  `physicalSizeCm`, keeping the aspect ratio; preview zoom never changes print size.
- If `printGuidance` is returned, its text, grid, answer-line and row measurements describe
  the diagram at native size; they are not part of its definition or hash.
- `check_diagram_placement` (kind, envelope, `widthMm` and/or `heightMm`) reports what a
  resize does to print size. `download_diagram_bundle` (kind, envelope) gives one ZIP with
  JSON, SVG, print PNG and a README. Retrieve the archive before saying it worked. Call it
  again with the saved source to refresh an expired link; expired downloads for a single
  diagram can also be refreshed by revising the same returned document without changes.
  Legacy Graph fonts need the reported portable conversion before bundling. The website
  opens the extracted `source.json`, not the ZIP.
- Service SVG is vector artwork with outlined lettering. `printVerified` checks the PNG,
  not a downstream document or printer.
- If an SVG URL cannot be fetched, `get_diagram_svg` (kind and the unchanged envelope)
  returns the same SVG in checked chunks. Start without `offsetBytes`, then continue with
  `nextOffsetBytes` and `expectedSvgSha256` from the first result, keeping `kind`, source
  and `outputView` unchanged; `maxChunkBytes` is 1024 to 49152. Check that offsets are contiguous, each `chunkSha256` matches,
  and `rendererVersion`, `sourceContentHash`, `physicalSizeCm`, `totalBytes` and
  `svgSha256` stay the same; reject missing, repeated or changed chunks. Use a smaller
  `maxChunkBytes` if a response would exceed 256 KiB, and never retry without limit. The
  last chunk has `complete: true`. Save the decoded text exactly (UTF-8, no BOM, no added
  newline), check the byte count and hash, and parse it as SVG before using it.
  `complete` means delivered, not saved. See
  [direct SVG delivery](https://github.com/tboughen/maths-booklet-tools/blob/main/docs/tools/DIRECT-SVG-DELIVERY.md).
- Word exports are images: further mathematical edits mean reopening the editable file in
  MathsDock.
- Do not say a file was saved, downloaded, pasted into Word or printed unless that actually
  happened. A returned link is not a saved file. Editable files and links can contain
  hidden answers, so treat them as teacher copies.
- If a call times out, retry once, then tell the teacher.
