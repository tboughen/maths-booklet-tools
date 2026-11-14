import * as tree from "../../../probability-tree-core/src/index";
import * as ti from "../../../probability-tree-core/src/interchange";
export const treeConfig = {
  kind: "probability-tree" as const,
  name: "probability_tree",
  schema: tree.envelopeSchema,
  createInput: ti.createSchema,
  revision: ti.revisionSchema,
  capabilities: {
    schemaVersions: [1],
    rendererVersions: ["probability-tree-1"],
    maximumStages: tree.MAX_DEPTH,
    branchesPerPoint: { minimum: 1, firstStageMinimum: 2, maximum: tree.MAX_CHILDREN },
    maximumBranches: tree.MAX_BRANCHES,
    maximumPaths: tree.MAX_LEAVES,
    maximumQuestions: tree.MAX_QUESTIONS,
    branchMm: { minimum: 20, maximum: 50 },
    gapMm: { minimum: 10, maximum: 24 },
    examples: ti.exampleIds,
    labelStates: ["show", "hidden"],
    probabilityText: "Fractions a/b print stacked; decimals, percentages and algebra (x, 1 − x) print as typed.",
    unequalTrees: "A branch with no children ends its path; extend_branch and end_path change one path only.",
    givenThat: "Questions list event and given paths; calculate_question gives P(event ∩ given) / P(given) when every chosen probability is numeric.",
    maximumRevisionOperations: 30,
    operations: ti.operationSchema.options.map((o) => o.shape.op.value),
    outputView: "pupil (default) or explicitly requested answer; source JSON and hash keep saved pupil visibility",
    hiddenAnswers: "Editable JSON and links retain hidden answers.",
    creation: "spec or envelope; omit both for a two-stage counters tree",
  },
  createDescription:
    'Create an exam-style probability tree drawn left to right. Supply exact envelope OR spec:{example?|stages?|branches?, worked?, bag?, hide?, settings?, questions?}. example: two-bags, darts, without-replacement, unequal, given-that, three-coins. stages:[{outcomes:["Red","Blue"],probabilities?:["3/8","5/8"]}] repeats each stage after every path (equal tree). branches:[{id:"b1",parent:null,outcome,probability?,endOutcome?,endProbability?,hidden?:["probability"|"endProbability"...],bold?}] for unequal trees (endOutcome/endProbability on the last branch of a path fill the end columns; hide them to keep them as saved answers); parents precede children; 2-4 first-stage branches and 1-4 branches at each later point (a lone branch suits "draw the missing branches" questions; fill_complements never writes 1 there); up to 4 stages. bag:{counts:[5,3],replacement:false} writes unsimplified fractions from the counts by branch position. hide: none|probabilities|end|all saves those values as hidden answers with pupil spaces. settings:{stageTitles,linkLabels,endColumn:none|outcome|both,endHeadings,blankStyle:dots|box,branchMm,gapMm} (defaults 32 and 14 fit shown fractions on a three-way split; three hidden pupil spaces at one point need gapMm 16 or branchMm 38; in a three-column worksheet card, 130 mm, two stages with endColumn both need branchMm 26 or less, and three stages fit only with endColumn outcome or none at branchMm 26 or less). questions:[{text:"P(both red) =",event:["Red, Red"],given?:[...],answer?,answerShow?,calculate?:true}] print below the tree; paths are end branch IDs or outcome names joined by ", "; given-that questions use given. Only calculate:true computes an answer. outputView pupil (default) or answer. Never infer or fill answers otherwise. Returns preview, SVG, verified 600 ppi PNG, JSON, contentHash, physicalSizeCm and editor link. Editable files and links retain hidden answers.',
  reviseDescription:
    "Revise a probability tree atomically using envelope, baseHash:contentHash and max 30 operations. set_label {branchId,part:outcome|probability|endOutcome|endProbability,text?,show?}; set_outcome_name {branchId,text} follows linkLabels across a stage; set_bold {branchId,bold}; extend_branch {branchId,count?: 1-4} adds branches after one path end (unequal trees); end_path {branchId}; add_branch {parentId|null}; remove_last_branch {parentId|null}; add_stage {}; remove_stage {}; fill_from_bag {counts,replacement,overwrite} needs overwrite:true when probabilities exist; fill_complements {} writes 1 − p where exactly one sibling is empty; fill_end {part:outcome|probability}; set_visibility {part:probabilities|end|all,show}; set_settings {settings}; add_question {question}; set_question {questionId,question}; remove_question {questionId}; calculate_question {questionId}. Fills and calculations happen only when requested and keep visibility. Stable IDs come from the returned envelope. Empty operations refresh links. outputView pupil|answer affects artwork only.",
};
