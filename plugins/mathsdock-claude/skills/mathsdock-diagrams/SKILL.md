---
name: mathsdock-diagrams
description: Create or revise editable MathsDock teaching diagrams (coordinate graphs, ratio tables, quadratic value graphs, cuboids, number lines, Venn diagrams, algebra grids, bar models, statistical charts (not histograms or time series), probability trees and triangles) and finished A3 worksheets through the connected MathsDock MCP tools, keeping pupil blanks and hidden answers and returning real print files and editor links. Use for teaching resources, not for developing the tools.
---

<!-- Generated from .agents/skills/mathsdock-diagrams/SKILL.md by scripts/plugins/claude-plugin.mjs. Edit the source, then rerun it. -->

# MathsDock diagrams

Use the MathsDock connector in this conversation to make editable teaching diagrams for
school maths resources. Only call tools that this conversation actually discovered. A newer
skill, a previous chat or the source code does not prove a tool exists here; if a tool or
feature is missing, say exactly what is missing and that a connector refresh or a fresh
chat may be needed.

## Pick the family, then read its capabilities

The connector has three diagram tools that work for every family:

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

If this connection still shows older per-family tools instead (`graph_capabilities`,
`create_graph`, `revise_graph` and so on), use them the same way; everything below still applies.

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
  the answer version. The pupil source and its hash stay the same.
- Coordinate graphs: leave `equationVisible` false unless the teacher asks to print or label
  the equation. "Plot y = 2x + 1" does not ask for a label. On revisions keep label
  visibility, axes and unchanged objects.
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
  Plain text captions are only for dates and literal slashes. All bars share one unit
  width; labels never change widths. Saved v1 and v2 files keep their version until the
  teacher asks to upgrade. See [Bar model v3](https://github.com/tboughen/maths-booklet-tools/blob/main/docs/tools/BAR-MODEL-V3.md) and
  [Bar-model MCP](https://github.com/tboughen/maths-booklet-tools/blob/main/docs/tools/BAR-MODEL-MCP.md).
- **Ratio tables.** One scaling transition applies across every column. Keep that shared
  factor and its copies.
- **Value graphs.** Keep blank, answer-line and zero cells distinct, hidden labels and any
  deliberate plotting errors. Calculating cells and worked plots are explicit actions.
- **Cuboids.** Dimension edits respect cube locking; enabling it needs an explicit
  `referenceAxis`. Worked volume and area are teaching choices the teacher makes.
- **Number lines.** Keep filled or hollow endpoints, rays, joins, hidden solutions and tick
  answer lines as requested. Never extend the axis or delete points to make an edit valid.
- **Venn.** Membership masks are stable: 0 outside, A = 1, B = 2, C = 4. Renaming a set
  never changes membership. Never merge region values.
- **Algebra grids.** Integer terms in x, explicit signs, true blanks and hidden answers.
  See [Algebra grid MCP](https://github.com/tboughen/maths-booklet-tools/blob/main/docs/tools/ALGEBRA-GRID-MCP.md).
- **Charts.** See the [charts guide](https://github.com/tboughen/maths-booklet-tools/blob/main/docs/tools/CHARTS-TOOL.md).
- **Triangles.** Keep explicit labels, topology and saved answers. Use the returned
  `calculationContexts` for target mappings. Never measure drawn proportions. See
  [Triangle MCP](https://github.com/tboughen/maths-booklet-tools/blob/main/docs/tools/TRIANGLE-MCP.md).

## Worksheets

For a finished two-sided A3 worksheet (the PRODUCE step of the Maths Resource Design Guide),
read `worksheet_capabilities` once, then call `create_worksheet` with the whole document.
Report any layout issues it returns. Keep requests lean: build the worksheet in one call
rather than many small attempts, because each call costs the teacher time and tokens.

## Files and links

- Show the returned preview and the real links it returned: SVG, 600 ppi print PNG,
  editable JSON and the MathsDock editor link. Use only URLs a tool returned. Never build,
  shorten or edit a signed download link.
- The inline preview is not the print image. Place diagrams at the returned
  `physicalSizeCm`, keeping the aspect ratio; preview zoom never changes print size.
- `check_diagram_placement` (kind, envelope, `widthMm` and/or `heightMm`) reports what a
  resize does to print size. `download_diagram_bundle` (kind, envelope) gives one ZIP with
  JSON, SVG, print PNG and a README. Call it again with the saved source to refresh an
  expired link.
- If an SVG URL cannot be fetched, `get_diagram_svg` returns the same SVG in checked
  chunks: start without `offsetBytes`, continue with `nextOffsetBytes`, verify each
  `chunkSha256` and the final `svgSha256`, and save the decoded text exactly. See
  [direct SVG delivery](https://github.com/tboughen/maths-booklet-tools/blob/main/docs/tools/DIRECT-SVG-DELIVERY.md).
- Do not say a file was saved, downloaded, pasted into Word or printed unless that actually
  happened. A returned link is not a saved file. Editable files and links can contain
  hidden answers, so treat them as teacher copies.
- The connector is always on; if a call times out, retry once and then tell the teacher.
