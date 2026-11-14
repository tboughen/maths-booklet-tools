import * as twt from "../../../two-way-table-core/src/index";
import * as ti from "../../../two-way-table-core/src/interchange";
export const twoWayTableConfig = {
  kind: "two-way-table" as const,
  name: "two_way_table",
  schema: twt.envelopeSchema,
  createInput: ti.createSchema,
  revision: ti.revisionSchema,
  capabilities: {
    schemaVersions: [1],
    rendererVersions: ["two-way-table-1"],
    maximumColumns: twt.MAX_CATEGORIES,
    maximumRows: twt.MAX_CATEGORIES,
    headingCharacters: twt.MAX_HEADING,
    cellMm: { minimum: 16, maximum: 36 },
    examples: ti.exampleIds,
    cellStates: ["show", "hidden"],
    cells: "Integers, decimals (up to 6 places), fractions such as 3/20 or mixed numbers such as 2 1/2, at most 16 characters; fractions print stacked. Any other text is refused.",
    maximumRevisionOperations: 30,
    operations: ti.operationSchema.options.map((o) => o.shape.op.value),
    outputView: "pupil (default) or explicitly requested answer; source JSON and hash keep saved pupil visibility",
    hiddenAnswers: "A hidden cell is a saved answer and an empty box for pupils; an empty shown cell is a blank with no answer.",
    creation: "spec or envelope; omit both for an empty 2 by 2 table with totals",
  },
  createDescription:
    'Create an exam-style two-way table: column headings across the top, row headings down the left, optional Total column and Total row. Supply exact envelope OR spec:{example?|columns?,rows?, corner?, totals?, totalRow?, cellMm?, intentionalError?, completeTotals?, worked?}. example: complete, totals, probability. columns:["Walk","Bus","Car"] (1-5). rows:[{heading:"Year 7",cells:["18",{text:"25",hidden:true},"","52"]}] (1-5) give one cell per column, then the row total when totals are on. totalRow lists the Total row under each column, then the grand total. {text,hidden:true} saves a hidden answer (empty box for pupils); "" is a blank with no answer. totals:false leaves out both totals. completeTotals:true explicitly fills blank totals whose parts are all given (exact; fractions stay fractions). intentionalError:true marks an error-spotting task, so totals that disagree raise no warning. outputView pupil (default) or answer. Never fill cells or totals otherwise.',
  reviseDescription:
    'Revise a two-way table atomically using envelope, baseHash:contentHash and max 30 operations. set_cell {rowId|"total",columnId|"total",text?,show?}; set_heading {id (row or column ID, or "corner"),text}; add_row {heading?}; add_column {heading?}; remove_row {rowId}; remove_column {columnId}; set_totals {row?,column?}; complete_totals {hidden?} fills blank totals whose parts are given (hidden:true saves them as hidden answers); set_settings {settings:{cellMm?,intentionalError?}}. Totals are filled only when requested. Stable IDs come from the returned envelope. outputView pupil|answer affects artwork only.',
};
