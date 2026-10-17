import * as algebra from "../../packages/algebra-grid-core/src/index";
import * as ai from "../../packages/algebra-grid-core/src/interchange";
export const algebraConfig = {
  kind: "algebra-grid" as const,
  name: "algebra_grid",
  schema: algebra.schema,
  createInput: ai.createSchema,
  revision: ai.revisionSchema,
  capabilities: {
    schemaVersions: [1],
    rendererVersions: ["algebra-grid-1"],
    styleProfile: "departmental-v1",
    termsPerEdge: { minimum: 1, maximum: 6 },
    cellMm: { minimum: 12, default: 15, maximum: 18 },
    columnWidthMm: { minimum: 12, maximum: 45 },
    gridLineMm: [0.35, 0.5, 0.79375],
    legacyGridLineMm: 0.2,
    maximumPower: 6,
    coefficientLimit: "999999999999",
    maximumRevisionOperations: 30,
    examples: ai.exampleNames,
    operations: ai.operationSchema.options.map((o) => o.shape.op.value),
    creation:
      "Supply spec or exact envelope, not both; omit both for a blank3x3 grid. Counts include headings.",
    hiddenAnswers: "Editable JSON and links retain hidden answers.",
    notation:
      "Integer coefficients and powers of x; no fractions or multiple variables. Upright multiplication18pt,algebra12pt;internal rules only.",
  },
  createDescription:
    "Create expanding/factorising multiplication grids with internal lines only. Supply exact envelope OR spec:{example?,rowCount?,columnCount?,cellMm?,settings?,cells?}. Counts2..7 include headings; default blank3x3. Examples single,double,signed,cubic,factor,negative,common,source-expand,source-factor preserve pupil blanks. Settings: mode:expand|factorise,expression,questionVisible,gridVisible,answerLines:0..3,compactHeadings,gridLineMm:0.35|0.5|0.79375,paper:A4|A3,orientation:portrait|landscape,intentionalError. cells:[{rowId,columnId,value:string|null,hidden?}],initial IDs r0/c0 etc. Product cells12..18mm,default15. Null is blank;zero is not blank. Never infer answers. Returns preview,outlined SVG,verified600ppi PNG,JSON,hash,physicalSizeCm and bounded editor link. Editable files/links retain hidden answers.",
  reviseDescription:
    "Atomically revise exact algebra-grid envelope with baseHash:contentHash and operations(max30). set_cell {rowId,columnId,value:string|null,hidden?}; set_settings {settings:{mode?,expression?,questionVisible?,gridVisible?,answerLines?,compactHeadings?,gridLineMm?,paper?,orientation?,intentionalError?}}; set_cell_size {cellMm:12..18} resets width overrides; set_column_width {columnId,widthMm:12..45}; add_row {},remove_row {},add_column {},remove_column {} append/remove last edge; fill_products {overwrite:false} requires true for occupied products; collect_answer {} needs complete products; calculate_answer {} supplies only final answer,preserving every pupil blank; worked_copy {} explicitly returns a worked variant; set_answer_visibility {visible}. Integer terms in x,powers0..6. Automatic factorising:monic quadratics3x3 or single-row common factors;other shapes need correct headings. Stable IDs come from returned envelope. Empty operations refresh links. Calculate only when explicitly requested. Returns preview,outlined SVG,600ppi PNG,JSON,native dimensions and editor link;hidden answers remain in editable source.",
};
