import * as bar from "../../packages/bar-model-core/src/index";
import * as bi from "../../packages/bar-model-core/src/interchange";
import { z } from "zod";
export const barConfig = {
  kind: "bar-model" as const,
  name: "bar_model",
  schema: bar.schema,
  createInput: bi.createSchema,
  revision: bi.revisionSchema,
  capabilities: {
    schemaVersions: [1],
    rendererVersions: ["bar-model-1"],
    styleProfile: "lesson-v1",
    limits: bar.LIMITS,
    labelStates: bar.labelSchema.shape.state.options,
    examples: bar.exampleNames,
    geometry:
      "One shared unitMm for every bar; positive exact weights and nonnegative offsets in shared units. Text never determines geometry. Minimum part width4mm; bounded artwork280x260mm and32million pixels.",
    operations: bi.operationSchema.options.map((o) => o.shape.op.value),
    operationSchema: z.toJSONSchema(bi.operationSchema),
    removal:
      "Referenced structure requires explicit discardSpans:true or prior span removal; never reattaches anchors.",
    calculations:
      "No automatic solver. worked:true selects an explicit worked example; reveal_saved_answers explicitly reveals saved content. All ordinary edits preserve answers.",
    hiddenAnswers:
      "Pupil artwork is default; editable files/links retain hidden saved answers.",
    versions: "bar-model schema1 / renderer bar-model-1 / lesson-v1",
  },
  createDescription:
    "Create editable Bar modelling resources. Supply spec OR exact envelope, never both. spec:{example?:BM01..BM09|H07|H18|source-sharing,worked?:false,bars?,spans?,presentation?}; example and custom bars/spans are mutually exclusive. Omit for BM01 unworked sharing64 in3:5. bars:[{id,name:{text,state},offset:numeric-string,parts:[{id,weight:positive-numeric-string,label:{text,state},shade:boolean}]}]. spans:[{id,from:{barId,partId,edge:start|end},to:{barId,partId,edge},label:{text,state},side:above|below,style:brace|dimension}]. Labels state:value|blank|question|line|hidden; hidden retains text. Shared presentation:{unitMm:4..16,barHeightMm:8..16,fontPt:10..14,nameWidthMm:20..60}. Up to6bars,24parts/bar,96parts,18spans,32KiB. Exact geometry fractions/decimals,algebra labels never evaluated. Whole/share/difference braces anchor actual boundaries. No automatic calculation. Returns canonical envelope/hash,preview,SVG,600ppiPNG,JSON,versions,native size,print facts,bounded editor link and warnings. Editable files/links retain hidden answers; pupil output default.",
  reviseDescription:
    "Revise exact bar-model envelope with baseHash=contentHash and operations(max30,atomic). set_label {target:{barId,partId?}|{spanId},label:{text,state}}; set_part {barId,partId,weight?,shade?}; add_bar {bar,afterId?}; remove_bar {barId,discardSpans?:false}; add_part {barId,part,afterId?}; remove_part {barId,partId,discardSpans?:false}; add_span {span}; set_span {span} replaces exact identified span; remove_span {spanId}; set_alignment {barId,offset}; set_print {presentation:{unitMm?,barHeightMm?,fontPt?,nameWidthMm?}}; reveal_saved_answers {} only on explicit request. Use complete bar/part/span schemas from create_bar_model and stable returned IDs. Removal of referenced parts/bars requires discardSpans:true or prior explicit span removal; never reanchors. Label state changes preserve supplied saved text. No implicit maths, answer reveal or resizing from labels. Empty operations refresh files/links. Returns envelope/hash,preview,SVG,verified600ppiPNG,JSON,native dimensions,versions,print facts and warnings; editable files/links retain hidden answers.",
};
