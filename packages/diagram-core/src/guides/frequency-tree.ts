import * as ftree from "../../../frequency-tree-core/src/index";
import * as fi from "../../../frequency-tree-core/src/interchange";
export const frequencyTreeConfig = {
  kind: "frequency-tree" as const,
  name: "frequency_tree",
  schema: ftree.envelopeSchema,
  createInput: fi.createSchema,
  revision: fi.revisionSchema,
  capabilities: {
    schemaVersions: [1],
    rendererVersions: ["frequency-tree-1"],
    maximumLevels: ftree.MAX_DEPTH,
    branchesPerSplit: { minimum: 2, maximum: ftree.MAX_CHILDREN },
    maximumGroups: ftree.MAX_NODES,
    maximumQuestions: ftree.MAX_QUESTIONS,
    branchMm: { minimum: 24, maximum: 60 },
    gapMm: { minimum: 14, maximum: 30 },
    examples: fi.exampleIds,
    labelStates: ["show", "hidden"],
    labelPlace: "branch (names on the branches) or node (beside the ovals)",
    nodeShape: "oval or box",
    counts: "Text of at most 12 characters; whole numbers are used by fill_counts and calculate_question, anything else prints as typed.",
    maximumRevisionOperations: 30,
    operations: fi.operationSchema.options.map((o) => o.shape.op.value),
    outputView: "pupil (default) or explicitly requested answer; source JSON and hash keep saved pupil visibility",
    hiddenAnswers: "A hidden count is a saved answer and an empty oval for pupils; an empty shown count is a blank oval with no answer.",
    creation: "spec or envelope; omit both for the 80 people coffee tree with every count but the total hidden",
  },
  createDescription:
    'Create an exam-style frequency tree drawn left to right: the total in the first oval, then a count in an oval for each group. Supply exact envelope OR spec:{example?|groups?, total?, totalHidden?, worked?, hide?, fillCounts?, settings?, questions?}. example: coffee, lunches, handedness, text-or-email, three-years. groups:[{name:"men",count:"32",countHidden?:true,nameHidden?,children?:[{name:"like coffee",count:"24",countHidden?:true},...]}] with 2-3 groups per split and up to 2 levels; a group without children ends its path. countHidden saves the count as a hidden answer (empty oval for pupils); an empty count is a blank oval with no answer. hide: none|counts (all but the total)|all. fillCounts:true explicitly works out empty counts that follow from the others (group = sum of branches; one empty branch = group minus the rest). settings:{labelPlace:branch|node,nodeShape:oval|box,linkLabels,branchMm,gapMm}. questions:[{text:"P(a coffee drinker is a woman) =",top:["women, like coffee"],bottom?:["men, like coffee","women, like coffee"],answer?,answerShow?,calculate?:true}] print below the tree with an answer line; groups are IDs or names joined by ", "; no bottom means the total. Only calculate:true computes an answer (unsimplified fraction). outputView pupil (default) or answer. Never infer or fill counts or answers otherwise.',
  reviseDescription:
    "Revise a frequency tree atomically using envelope, baseHash:contentHash and max 30 operations. set_count {groupId|\"total\",text?,show?}; set_name {groupId,text?,show?} follows linkLabels across a level; split_group {groupId,count?} splits a first-level path end; end_path {groupId}; add_branch {parentId|null}; remove_last_branch {parentId|null}; add_level {}; remove_level {}; fill_counts {} works out empty counts that follow from the others; hide_counts {keepTotal?}; show_all {}; set_settings {settings}; add_question {question}; set_question {questionId,question}; remove_question {questionId}; calculate_question {questionId}. Fills and calculations happen only when requested and keep visibility. Stable IDs come from the returned envelope. outputView pupil|answer affects artwork only.",
};
