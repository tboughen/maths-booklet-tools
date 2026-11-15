import * as ss from "../../../sample-space-core/src/index";
import * as si from "../../../sample-space-core/src/interchange";
export const ssConfig = {
  kind: "sample-space" as const,
  name: "sample_space",
  schema: ss.envelopeSchema,
  createInput: si.createSchema,
  revision: si.revisionSchema,
  capabilities: {
    schemaVersions: [1],
    rendererVersions: [ss.RENDERER_VERSION],
    maximumOutcomesEachWay: ss.MAX_OUTCOMES,
    outcomeCharacters: ss.MAX_HEADING,
    eventNameCharacters: ss.MAX_TITLE,
    cellCharacters: ss.MAX_CELL,
    cellMm: { minimum: 10, maximum: 30 },
    examples: si.exampleIds,
    cellStates: ["show", "hidden"],
    fillOperations: ss.OPERATIONS,
    cells: "Short text such as 7, 1/36, 2 1/2, H3 or (H, 3); numbers print with stacked fractions. A ringed cell is circled, as a chosen outcome; ring \"hidden\" circles it only on the answers copy. Blank cells cannot be ringed.",
    maximumRevisionOperations: 40,
    operations: si.operationSchema.options.map((o) => o.shape.op.value),
    outputView: "pupil (default) or explicitly requested answer; source JSON and hash keep saved pupil visibility",
    hiddenAnswers: "A hidden cell is a saved answer and an empty box for pupils; an empty shown cell is a blank with no answer.",
    creation: "spec or envelope; omit both for two fair dice (1 to 6 each way) with every cell blank",
  },
  createDescription:
    'Create an exam-style sample space diagram: the outcomes of one event down the left, a second event across the top and one cell per pair. Supply exact envelope OR spec:{example?|rows?,columns?,rowTitle?,columnTitle?,corner?,cells?,cellMm?,intentionalError?,lines?,fill?,worked?}. example: dice-sum, spinner-product, coin-dice, circle-outcomes. rows:["H","T"] and columns:["1","2","3","4","5","6"] (1-10 each, default 1-6 for two dice). rowTitle:"Coin", columnTitle:"Dice" print beside and above the table. corner:"+" (or ×, −) names the combination; cells that disagree with it raise a teacher warning unless intentionalError:true. cells:[["2",{text:"3",hidden:true},""]] gives one array per row, one cell per column; {text,hidden:true} saves a hidden answer (empty box for pupils), {text,ring:true} circles a chosen outcome ({text,ring:"hidden"} only on the answers copy), "" is a blank with no answer. fill:{operation:"sum"|"product"|"difference"|"pair"} explicitly fills every blank cell (exact; difference is positive; pair gives (H, 3)) as hidden answers, so the pupil copy keeps them empty; fill:{operation,hidden:false} prints them. lines:"bold" for heavier lines. outputView pupil (default) or answer. Never fill cells otherwise.',
  reviseDescription:
    'Revise a sample space diagram atomically using envelope, baseHash:contentHash and max 40 operations. set_cell {rowId,columnId,text?,show?,ring?:true|false|"hidden"}; set_heading {id (row or column ID, "corner", "rowTitle" or "columnTitle"),text}; add_row {heading?}; add_column {heading?}; remove_row {rowId}; remove_column {columnId}; fill_cells {operation:sum|product|difference|pair,hidden?} fills blank cells only, as hidden answers unless hidden:false; set_settings {settings:{cellMm?,intentionalError?,lines?}}. Cells are filled only when requested. Stable IDs come from the returned envelope. outputView pupil|answer affects artwork only.',
};
