import * as bar from "../../packages/bar-model-core/src/versioned";
import * as bi from "../../packages/bar-model-core/src/versioned-interchange";
import * as v2 from "../../packages/bar-model-core/src/v2";
import * as v3 from "../../packages/bar-model-core/src/v3";
import { z } from "zod";
export const barConfig = {
  kind: "bar-model" as const,
  name: "bar_model",
  schema: bar.schema,
  createInput: bi.createSchema,
  revision: bi.revisionSchema,
  capabilities: {
    schemaVersions: [1, 2, 3],
    rendererVersions: ["bar-model-1", "bar-model-2", "bar-model-3"],
    v3: {
      specSchema: z.toJSONSchema(bi.specV3Schema),
      captionSchema: z.toJSONSchema(v3.captionSchema),
      creation:
        "Explicit spec.schemaVersion:3 or exact v3 envelope. Browser fresh default is v3. Bare requests stay v1; explicit spec2 stays v2.",
      upgrade:
        "upgrade_document{targetSchemaVersion:3}, once FIRST on v1/v2, original baseHash checked first. Without a target upgrade_document retains v1→v2 behaviour. Atomic rollback on any later error.",
      handwriting:
        "Every line state reserves 12mm above the upper edge of the 0.25mm underline and 3mm below its lower edge; line length8mm. Inside lines require uniform effective bars at least20mm. barHeightMm is a minimum8..24; print facts report actual height. No horizontal geometry changes.",
      captions:
        "Max3 lines/80characters. format:maths(default) stacks simple a/b fractions within working; format:plain explicitly preserves literal slashes. Single parenthesised groups allowed, no nesting/evaluation. Ambiguous Maths rejects instead of diagonal fallback. Titles/names stay plain.",
    },
    v2: {
      starters: v2.starters,
      slots: v2.slots,
      fills: v2.fills,
      annotationSchema: z.toJSONSchema(v2.annotationSchema),
      specSchema: z.toJSONSchema(bi.specV2Schema),
      creation:
        "Explicit spec.schemaVersion:2 preserves frozen v2 notation and spacing. Bare/legacy MCP requests remain v1.",
      wholeScope:
        "Dynamic whole bar; fixed endpoint ranges remain fixed, including upgraded v1 spans.",
      placement:
        "Compact above/below lanes; inside labels must clear every divider; between differences require adjacent endpoint bars.",
      captions:
        "Up to three literal 80-character lines; no automatic calculations. Stored colour/grey applies to every output.",
      replacement:
        "equal_sections preserves exact total length. Changed count replaces IDs and requires discardContent:true for affected labels, fills or fixed anchors. Same count retains content and IDs.",
    },
    styleProfile: "lesson-v1",
    styleProfiles: ["lesson-v1", "lesson-v2", "lesson-v3"],
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
    versions:
      "schema1 / bar-model-1 / lesson-v1 and schema2 / bar-model-2 / lesson-v2 preserved; explicit schema3 / bar-model-3 / lesson-v3",
  },
  createDescription:
    "For horizontal working fractions and handwriting space use explicit spec.schemaVersion:3; same v2 fields plus captions[].format:maths(default)|plain, minimum barHeightMm8..24. Maths a/b supports simple atoms or one parenthesised group, never nested fractions; ambiguity fails. Every explicit line reserves12mm above/3mm below its0.25mm underline,8mm long; inside lines produce uniform actual bars>=20mm. See capabilities.v3 complete schemas. Existing v1/v2 rendering remains frozen. " +
    "For the improved layout explicitly supply spec:{schemaVersion:2,starter:part-whole|comparison|equal-sections|inline-ratio,count?,ratio?:positive-integer-array,partitioned?,comparisonLengths?:[longer,shorter],bars?,annotations?,captions?,title?,presentation?}. See capabilities.v2.specSchema for complete strict nested fields. V2 parts have labels:{inside,above?,below?} and fill:none|neutral|blue|green|amber; each label is {text,state}. annotations:[{id,scope:{kind:whole,barId}|{kind:range,from,to},label,decoration:none|brace|dimension,placement:above|below|inside|between}]. Whole scope follows a bar; fixed endpoints stay fixed. Captions:{id,label,alignment:left|centre|right},max3; title is a label. Output grey/colour is saved. Bare requests and legacy specs remain v1; never mix v1 fields with schemaVersion:2. " +
    "Create editable Bar modelling resources. Supply spec OR exact envelope, never both. spec:{example?:BM01..BM09|H07|H18|source-sharing,worked?:false,bars?,spans?,presentation?}; example and custom bars/spans are mutually exclusive. Omit for BM01 unworked sharing64 in3:5. bars:[{id,name:{text,state},offset:numeric-string,parts:[{id,weight:positive-numeric-string,label:{text,state},shade:boolean}]}]. spans:[{id,from:{barId,partId,edge:start|end},to:{barId,partId,edge},label:{text,state},side:above|below,style:brace|dimension}]. Labels state:value|blank|question|line|hidden; hidden retains text. Shared presentation:{unitMm:4..16,barHeightMm:8..16,fontPt:10..14,nameWidthMm:20..60}. Up to6bars,24parts/bar,96parts,18spans,32KiB. Exact geometry fractions/decimals,algebra labels never evaluated. Whole/share/difference braces anchor actual boundaries. No automatic calculation. Returns canonical envelope/hash,preview,SVG,600ppiPNG,JSON,versions,native size,print facts,bounded editor link and warnings. Editable files/links retain hidden answers; pupil output default.",
  reviseDescription:
    "Explicit upgrade_document{targetSchemaVersion:3} upgrades v1/v2 to horizontal fractions and larger handwriting spaces; once FIRST, original hash checked before changes, later failure rolls back all. No target keeps prior v1→v2 meaning. V3 captions add format:maths|plain and set_presentation accepts minimum barHeightMm8..24. " +
    "V2 operations add upgrade_document{} (exactly once FIRST on v1); set_section_label{barId,partId,slot:inside|above|below,label}; set_section_labels{barId,partIds,slot,label}; move_or_copy_label{from:{barId,partId,slot},to:{barId,partId,slot},mode:move|copy,overwrite?:false}; set_annotation{annotation}; remove_annotation{annotationId}; equal_sections{barId,count,discardContent?:false} preserves exact total; changed count replaces IDs and needs explicit discard for affected labels/fills/fixed anchors. set_fill{barId,partIds,fill}; add_caption/update_caption{caption}; remove_caption{captionId}; set_title{label:null|Label}; set_presentation{presentation,autoName?}; set_quantity_name{barId,label}; set_relative_length{barId,partId,weight}; append_section{barId,part,afterId?}; append_bar{bar,afterId?}; reorder_bars{barIds}. Refer to the complete emitted operation schema. Without explicit upgrade, legacy sources stay v1 and reject new features. A later failure rolls back the entire batch including upgrade. Retained hidden destinations require explicit overwrite. Between annotations must still attach to adjacent bars. " +
    "Revise exact bar-model envelope with baseHash=contentHash and operations(max30,atomic). set_label {target:{barId,partId?}|{spanId},label:{text,state}}; set_part {barId,partId,weight?,shade?}; add_bar {bar,afterId?}; remove_bar {barId,discardSpans?:false}; add_part {barId,part,afterId?}; remove_part {barId,partId,discardSpans?:false}; add_span {span}; set_span {span} replaces exact identified span; remove_span {spanId}; set_alignment {barId,offset}; set_print {presentation:{unitMm?,barHeightMm?,fontPt?,nameWidthMm?}}; reveal_saved_answers {} only on explicit request. Use complete bar/part/span schemas from create_bar_model and stable returned IDs. Removal of referenced parts/bars requires discardSpans:true or prior explicit span removal; never reanchors. Label state changes preserve supplied saved text. No implicit maths, answer reveal or resizing from labels. Empty operations refresh files/links. Returns envelope/hash,preview,SVG,verified600ppiPNG,JSON,native dimensions,versions,print facts and warnings; editable files/links retain hidden answers.",
};
