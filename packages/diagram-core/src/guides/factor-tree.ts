import * as ft from "../../../factor-tree-core/src/index";
import * as fi from "../../../factor-tree-core/src/interchange";
export const ftConfig = {
  kind: "factor-tree" as const,
  name: "factor_tree",
  schema: ft.envelopeSchema,
  createInput: fi.createSchema,
  revision: fi.revisionSchema,
  capabilities: {
    schemaVersions: [1],
    rendererVersions: [ft.RENDERER_VERSION],
    maximumTrees: ft.MAX_TREES,
    maximumLevels: ft.MAX_DEPTH,
    maximumNumbersPerTree: ft.MAX_NODES,
    numberDigits: ft.MAX_DIGITS,
    blankStyles: ["dots", "box"],
    levelMm: { minimum: 10, maximum: 24 },
    examples: fi.exampleIds,
    numberStates: ["show", "hidden"],
    answerLine: "A product of powers such as 2^3 × 3^2 × 5 (x, * and superscripts are accepted); powers print raised. Empty text is a pupil answer line.",
    maximumRevisionOperations: 40,
    operations: fi.operationSchema.options.map((o) => o.shape.op.value),
    outputView: "pupil (default) or explicitly requested answer; source JSON and hash keep saved pupil visibility",
    hiddenAnswers: "A hidden number or answer is saved and prints as a blank for pupils; an empty shown number is a blank with no answer. A hidden number's circle, and a circle saved as \"hidden\", print only on the answers copy.",
    creation: "spec or envelope; omit both for one empty number with an answer line",
  },
  createDescription:
    'Create exam-style factor trees: a number split into two factors at a time down to circled primes, with an optional "360 = ......" answer line. Supply exact envelope OR spec:{example?|root?,product?|trees?, blankStyle?, levelMm?, intentionalError?, lines?, complete?, worked?}. example: complete-360, two-ways-84, product-of-primes, spot-the-mistake. One tree: root:"360" (product defaults to true, an empty pupil answer line; false for none). Up to 3 trees side by side: trees:[{root:{value:"360",children:[{value:"36",children:[...]},{value:"10",hidden:true}]},product:{text:"2^3 × 3^2 × 5",hidden:true}}]. Each number has exactly two children or none; value "" is a blank; hidden:true saves a hidden answer (blank for pupils); circled:true circles a prime; circled:"hidden" circles it only on the answers copy. complete:true explicitly finishes every tree (fills blanks from parent and sibling, splits composite ends by their smallest prime, circles primes, fills an empty answer line in index form) as hidden answers and answers-only circles, so the pupil copy keeps them blank; complete:{hidden:false} prints them. intentionalError:true marks an error-spotting task: wrong splits, circles and answers raise no warning. blankStyle dots (default) or box. outputView pupil (default) or answer. Never split, fill or circle otherwise.',
  reviseDescription:
    'Revise factor trees atomically using envelope, baseHash:contentHash and max 40 operations. set_node {treeId,nodeId,text?,show?,circled?:true|false|"hidden"}; split_node {treeId,nodeId,factors?:[a,b]} gives a number two branches (blank by default); remove_split {treeId,nodeId} removes everything beneath; add_tree {root?} (defaults to the first tree\'s number); remove_tree {treeId}; set_product {treeId,product:{text?,show?}|null}; complete_tree {treeId?,hidden?} completes one or every tree, as hidden answers unless hidden:false; set_settings {settings:{blankStyle?,levelMm?,intentionalError?,lines?}}. Nothing is completed unless requested. Stable IDs (t1, n1...) come from the returned envelope. outputView pupil|answer affects artwork only.',
};
