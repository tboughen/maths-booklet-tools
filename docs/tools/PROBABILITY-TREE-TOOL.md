# Probability trees

`/tools/probability-tree` draws exam-style probability tree diagrams left to right. Tim asked for the tool on
6 November 2026 and agreed the scope: stages and branches, with or without replacement, fractions or decimals,
values hidden for pupils, GCSE-style examples, unequal trees, "given that" questions and an MCP tool.

Code: `packages/probability-tree-core` (schema, exact arithmetic, layout, SVG, examples, MCP interchange),
`src/probability-tree` (editor), `services/graph-mcp/probability-tree-config.ts` (MCP registration).

## Document

- One flat list of branches. `parent: null` is a first-stage branch; sibling order is list order and every parent is
  listed before its children. A branch with no children ends its path, so unequal trees need no special case.
- 2 to 4 branches in the first stage and 1 to 4 at each later point (a lone branch suits "draw the missing branches" questions), up to 4 stages, 60 branches and 24 paths. A probability that would touch another branch or label (the middle branch of a three-way split) slides along its branch, then tries the other side. Shown fractions on a three-way split fit at the default 32 mm / 14 mm; three pupil spaces need gapMm 16 or branchMm 38. A label or space that still crosses a branch gives a note (not a blocking issue, so saved trees export as before).
- Every printed value is a label `{ text, show }`. `show` prints it; `hidden` keeps it as a saved answer and leaves a
  dotted line or box for pupils; an empty shown label prints nothing. Blank, zero and hidden stay distinct.
- Probabilities are text: `a/b` prints as a stacked fraction; decimals, percentages and algebra (`x`, `1 − x`) print as typed.
- Optional end columns (outcome, probability), stage titles, bold branches for picking out paths, and up to 8
  questions printed below the tree with answer spaces.
- `linkLabels` (default on) makes an outcome edit apply to the same position across its stage.

## Explicit actions only

Nothing is filled or calculated implicitly. Each of these is a button (or MCP operation) and is undoable:

- **Fill from bag**: counts by branch position, with or without replacement; writes unsimplified fractions
  (5/8 then 4/7), as on examination trees. Overwriting existing probabilities asks first.
- **Fill missing 1 − p**: where exactly one sibling is empty and the others are numbers.
- **Fill outcome names** / **Calculate path probabilities** for the end columns (simplified fractions; decimals when
  every probability is a decimal).
- **Calculate answer** for a question: P(event), or P(event ∩ given) ÷ P(given) for a given-that question.

Sibling probabilities that are numbers but do not total 1 give a teacher note only (deliberate error-spotting trees
are allowed). A probability below 0 or above 1, overlapping labels, or a tree wider than 18 cm block export.
The overlap error names the labels that clash (for example the probability on Red, Blue and the
outcome on Blue); the width error gives the branch length that fits. A new tree from the connector,
and Add stage on a tree that fitted, take the longest branch length that fits 18 cm (a three-stage
tree with both end columns gets 31 mm), unless the request set `branchMm`.

## Examples

Source-linked: November 2018 1F Q27 (two bags) and June 2018 2H Q15 (darts, dependent events). Teaching examples:
counters without replacement with end columns, an unequal "up to three attempts" tree, a given-that example with bold
condition paths, and three coins.

## MCP

`diagram_capabilities` (kind `probability-tree`), `create_diagram` (kind `probability-tree`), `revise_diagram` (kind `probability-tree`). Create from `spec.example`,
`spec.stages` (equal trees), or `spec.branches` (flat list, for unequal trees), optionally with `bag`, `hide`,
`settings` and `questions` (paths named by end branch ID or outcome names such as `"Red, Blue"`; `calculate: true`
is the only way to compute an answer). `outputView: "answer"` draws hidden answers; the returned envelope and hash
keep pupil visibility. Revision operations are listed in the capabilities and tool descriptions.
The service is not redeployed by merging; a Render deploy needs Tim's go-ahead.
