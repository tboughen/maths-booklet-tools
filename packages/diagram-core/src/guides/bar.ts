import * as bar from "../../../bar-model-core/src/versioned";
import * as bi from "../../../bar-model-core/src/versioned-interchange";
import * as v3 from "../../../bar-model-core/src/v3";
import { z } from "zod";
export const barConfig = {
  kind: "bar-model" as const,
  name: "bar_model",
  schema: bar.schema,
  createInput: bi.createSchema,
  revision: bi.revisionSchema,
  capabilities: {
    schemaVersions: [3],
    rendererVersions: [v3.RENDERER_VERSION],
    styleProfile: "lesson-v3",
    starters: v3.starters,
    slots: v3.slots,
    fills: v3.fills,
    annotationSchema: z.toJSONSchema(v3.annotationSchema),
    captionSchema: z.toJSONSchema(v3.captionSchema),
    limits: bar.LIMITS,
    labelStates: bar.labelSchema.shape.state.options,
    examples: bar.exampleNames,
    handwriting:
      "Every line state reserves 12mm above the upper edge of the 0.25mm underline and 3mm below its lower edge; line length 8mm. Inside lines need uniform bars at least 20mm high. barHeightMm is a minimum 8..24; print facts report the actual height. No horizontal geometry changes.",
    captions:
      "Max 3 lines of 80 characters. format:maths (default) stacks simple a/b fractions; format:plain keeps literal slashes (dates). Single parenthesised groups allowed, no nesting or evaluation; ambiguous Maths is refused. Titles and names stay plain.",
    wholeScope: "A whole scope follows its bar; fixed endpoint ranges stay fixed.",
    placement:
      "Compact above/below lanes; inside labels must clear every divider; between differences need adjacent endpoint bars.",
    replacement:
      "equal_sections keeps the exact total length. A changed count replaces IDs and needs discardContent:true for affected labels, fills or fixed anchors. The same count keeps content and IDs.",
    geometry:
      "One shared unitMm for every bar; positive exact weights and nonnegative offsets in shared units. Text never sets geometry. Minimum section width 4mm; artwork at most 280x260mm and 32 million pixels.",
    operations: bi.operationSchema.options.map((o) => o.shape.op.value),
    removal:
      "Removing a bar or section an annotation refers to needs discardSpans:true or removing the annotation first; anchors never reattach.",
    calculations:
      "No automatic solver. spec.example with worked:true selects a worked example; reveal_saved_answers reveals saved content only on request. Ordinary edits keep answers.",
    hiddenAnswers: "Pupil artwork is the default; editable files and links keep hidden saved answers.",
  },
  createDescription:
    "Create an editable bar model. Supply spec or an exact envelope, never both. spec:{example?:BM01..BM09|H07|H18|source-sharing,worked?:false} opens a saved example on its own; otherwise spec:{starter?:part-whole|comparison|equal-sections|inline-ratio,count?,ratio?:positive-integer-array,partitioned?,comparisonLengths?:[longer,shorter],bars?,annotations?,captions?,title?,presentation?}. Omit spec for the part-whole starter. " +
    "Parts have labels:{inside,above?,below?} and fill:none|neutral|blue|green|amber; each label is {text,state:value|blank|question|line|hidden} and hidden keeps its text. annotations:[{id,scope:{kind:whole,barId}|{kind:range,from:{barId,partId,edge:start|end},to},label,decoration:none|brace|dimension,placement:above|below|inside|between}]. captions:[{id,label,alignment:left|centre|right,format?:maths|plain}], max 3; title is a label. presentation:{unitMm:4..16,barHeightMm:8..24 minimum,fontPt:10..14,titlePt:12..18,nameWidthMm?,output:grey|colour,lines?:bold}. " +
    "Up to 6 bars, 24 sections a bar, 18 annotations, 32 KiB. Exact fraction or decimal geometry; algebra labels are never evaluated. Returns the canonical envelope and hash, preview, SVG, 600 ppi PNG, JSON, print facts, an editor link and warnings.",
  reviseDescription:
    "Revise the exact envelope with baseHash=contentHash; operations (max 30) apply atomically. set_section_label{barId,partId,slot:inside|above|below,label}; set_section_labels{barId,partIds,slot,label}; move_or_copy_label{from:{barId,partId,slot},to,mode:move|copy,overwrite?:false}; set_annotation{annotation}; remove_annotation{annotationId}; equal_sections{barId,count,discardContent?:false}; set_fill{barId,partIds,fill}; add_caption/update_caption{caption}; remove_caption{captionId}; set_title{label|null}; set_presentation{presentation,autoName?}; set_quantity_name{barId,label}; set_relative_length{barId,partId,weight}; append_section{barId,part,afterId?}; append_bar{bar,afterId?}; reorder_bars{barIds}; remove_bar{barId,discardSpans?:false}; remove_part{barId,partId,discardSpans?:false}; set_alignment{barId,offset}; reveal_saved_answers{} only on explicit request. " +
    "Use stable returned IDs. Kept hidden destinations need explicit overwrite. No implicit maths, answer reveal or resizing from labels. Empty operations refresh files and links.",
};
