import * as po from "../../../probability-objects-core/src/index";
import * as pi from "../../../probability-objects-core/src/interchange";
export const poConfig = {
  kind: "probability-objects" as const,
  name: "probability_objects",
  schema: po.envelopeSchema,
  createInput: pi.createSchema,
  revision: pi.revisionSchema,
  capabilities: {
    schemaVersions: [1],
    rendererVersions: [po.RENDERER_VERSION],
    objectTypes: ["spinner", "dice", "bag"],
    maximumObjects: po.MAX_OBJECTS,
    spinnerSectors: `${po.MIN_SECTORS} to ${po.MAX_SECTORS}`,
    spinnerShapes: ["circle", "polygon"],
    spinnerSizeMm: po.SPINNER_MM,
    pointers: ["arrow", "stick", "none"],
    diceViews: ["cube", "faces"],
    diceMarks: ["pips", "numbers"],
    diceSizeMm: po.DICE_MM,
    maximumCounters: po.MAX_COUNTERS,
    maximumGroups: po.MAX_GROUPS,
    fills: po.FILLS,
    textLength: po.MAX_TEXT,
    captionLength: po.MAX_CAPTION,
    examples: pi.exampleIds,
    itemStates: ["show", "hidden"],
    maximumRevisionOperations: 40,
    revisionOperations: pi.operationSchema.options.map((o) => o.shape.op.value),
    outputView: "pupil (default) or explicitly requested answer; source JSON and hash keep saved pupil visibility",
    hiddenAnswers: "A hidden label is saved and prints as a blank for pupils (a dotted line; a plain counter in a bag); an empty shown label is a blank with no answer.",
    colours: "Print colours as words or letters (Red, R) and give groups or sectors different fills (grey, hatched, dotted) so they read in black and white.",
    creation: "spec or envelope; omit both for one fair circular spinner labelled 1 to 4",
  },
  createDescription:
    'Create Edexcel-style probability objects: spinners, dice and bags of counters, up to 4 side by side. Supply exact envelope OR spec:{example?|objects?, lines?, worked?}. example: four-sided, six-sectors, unequal-sectors, dice-and-spinner, bag-of-counters, complete-the-spinner, two-spinners, biased-dice. objects: [{type:"spinner", labels:[...2-12, clockwise], angles?:[deg|null per label; omit for equal sectors; null shares what is left], fills?:[none|grey|hatched|dotted per label], shape?:circle|polygon (regular polygon, equal sectors, drawn on its stick), pointer?:arrow|stick|none, pointerAngle?, rotation? (degrees clockwise from 12 o\'clock), rightAngles? (marks 90° sectors), sizeMm? 25-80 (default 40), emptyLabels?:blank|none, caption?} | {type:"dice", view?:cube|faces, faces?:[cube: front, top, right; faces: 1-6], marks?:pips|numbers, sizeMm? 12-30, emptyLabels?, caption?} | {type:"bag", groups:[{label?, fill?, count}], caption?} (at most 40 counters)]. Any label is text ("" is a pupil blank: a dotted line, or nothing with emptyLabels:"none"; a plain counter in a bag) or {text, hidden:true} (a saved answer, blank for pupils). Colours print as words or letters with fills, so they stay readable in black and white. Teacher notes flag impossible dice (opposite faces 1-6, 2-5, 3-4 both showing) and labels too wide for their sector. outputView pupil (default) or answer. Never fill or calculate.',
  reviseDescription:
    'Revise probability objects atomically using envelope, baseHash:contentHash and max 40 operations. set_label {objectId, slot, text?, show?} where slot is "sector:N" (spinner, from 0, clockwise), "face:N" (dice; a cube is front 0, top 1, right 2) or "group:N" (bag); replace_object {objectId, object} with an object as in create; add_object {object}; remove_object {objectId}; move_object {objectId, by:-1|1}; set_settings {settings:{lines?}}. Stable IDs (o1, o2) come from the returned envelope. outputView pupil|answer affects artwork only.',
};
