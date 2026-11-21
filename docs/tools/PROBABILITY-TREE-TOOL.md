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
- Every printed value is a label `{ text, show }`. `show` prints it; `hidden` (on screen: **Pupil space**) keeps it as a
  saved answer and leaves a dotted line or box for pupils; `omit` (on screen: **Leave out**, added 21 Nov 2026) keeps
  the text but prints nothing in either copy; an empty shown label prints nothing. Blank, zero, pupil space and left
  out stay distinct. A left-out label keeps a click target in the editor (a grey dashed outline) so it can come back.
- Probabilities are text: `a/b` prints as a stacked fraction; decimals, percentages and algebra (`x`, `1 − x`) print as typed.
- A written calculation such as `5/7 × 4/6 = 20/42` (parts separated by spaces; fractions, decimals and × ÷ + − =)
  prints with each fraction stacked, so the end Probability column can show the multiplication that leads to each
  probability (Tim, 17 Nov 2026). Hidden, it leaves a pupil space wide enough to write the calculation.
- Optional end columns (outcome, probability), stage titles, bold branches for picking out paths, and up to 8
  questions printed below the tree with answer spaces.
- `linkLabels` (default on) makes an outcome edit apply to the same position across its stage.

## Editing (the usability pilot, 21 Nov 2026)

Probability trees are the pilot for the shared editing pattern agreed on 21 Nov 2026, which other tools then adopt:

- **Click** a label on the tree: the options box opens beside it (`src/site/OptionsBox.tsx`) with What pupils see
  (Show / Pupil space / Leave out), its text, and for branches Bold branch, Add branches after this (or End the path
  here), Add a branch beside it and Remove the last branch here. Every change is live and one undo step; Escape or a
  press elsewhere closes the box. Enter, with the box focused, moves to the text field.
- **Double-click** a label, or press **H** with it selected (never while typing in a field), for a pupil space, and
  again to show the value. The box stays open and shows the new state.
- The **What pupils see** card sets every label of a kind at once (outcomes, probabilities, end columns while drawn,
  question answers) and shows Mixed when they differ.
- The **Branches** card lists the tree stage by stage. Under each point's branches is **+ Branch**; the list ends with
  **+ Branch at the start**, **+ Stage** and **Remove last stage**, and a × beside a branch removes it with what follows
  (a point keeps its fewest branches: two at the start, one later). There is no stage stepper beside the diagram: every
  tool sits in the one settings column (Tim, 21 Nov 2026). The card counts the pupil spaces and offers **Clear pupil
  spaces**; the how-to hint is in the foot strip only.
- The Branches, Outcome columns and Questions lists show "pupil space" or "left out" in a field instead of Hide
  ticks. Cards keep their help behind a (?) beside the heading. Branch length and path spacing are − / + steppers.
- Undo names each step: "pupil space on 5/8", "leave out 5/8", "pupil space on all probabilities", "clear 6 pupil spaces".

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

## Line weight (U111)

Lines are normal or bold (the Lines control beside Branch length): bold multiplies every stroke by 1.5 and is saved as `lines: "bold"`; normal is never saved. A new tree starts with the house style's lines. The connector takes `lines` in `settings` (create spec and `set_settings`).
