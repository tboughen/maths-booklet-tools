import * as fm from "../../../function-machine-core/src/index";
import * as fi from "../../../function-machine-core/src/interchange";
export const fmConfig = {
  kind: "function-machine" as const,
  name: "function_machine",
  schema: fm.envelopeSchema,
  createInput: fi.createSchema,
  revision: fi.revisionSchema,
  capabilities: {
    schemaVersions: [1],
    rendererVersions: [fm.RENDERER_VERSION],
    maximumMachines: fm.MAX_MACHINES,
    maximumBoxes: fm.MAX_STEPS,
    textLength: fm.MAX_TEXT,
    boxShapes: ["pentagon", "rectangle"],
    directions: ["right", "left"],
    examples: fi.exampleIds,
    itemStates: ["show", "hidden"],
    operations: "Type × 3, x3, *3, − 8, -8, + 5, ÷ 2, /2, × 1/2, square, √: signs print as a paper prints them and fractions print stacked. Letters print in italic (n, 3n + 2).",
    maximumRevisionOperations: 40,
    revisionOperations: fi.operationSchema.options.map((o) => o.shape.op.value),
    outputView: "pupil (default) or explicitly requested answer; source JSON and hash keep saved pupil visibility",
    hiddenAnswers: "A hidden item is saved and prints as a blank for pupils (a dotted line, or an empty box with a dotted line for an operation); an empty shown item is a blank with no answer.",
    creation: "spec or envelope; omit both for one machine with two empty boxes from input to output",
  },
  createDescription:
    'Create exam-style function (number) machines: input → [× 3] → [− 8] → output, up to 3 machines stacked. Supply exact envelope OR spec:{example?|ops?,start?,end?|machines?, boxShape?, intentionalError?, lines?, inverse?, complete?, worked?}. example: find-output, find-input, missing-operation, letters, two-machines. One machine: ops:["× 3","− 8"], start:"6" (default "input"), end:"" (default "output"). Several: machines:[{start,ops,between?,end,direction?}]. Any item is text ("" is a pupil blank; an empty op is an empty box with a dotted line) or {text, hidden:true} (a saved answer, blank for pupils). between: values on the arrows between boxes, one fewer than ops, null for none. direction "left" draws arrows right to left. inverse:true explicitly adds machine 1\'s inverse beneath (reversed boxes, inverse operations, arrows right to left). complete:true explicitly works every machine out (forwards from a numeric start, or back from a numeric end when the start is blank), writing values between boxes, as hidden answers; complete:{hidden:false, between:false} prints them / skips between values. intentionalError:true silences teacher notes for values that do not follow. boxShape pentagon (default, recent papers) or rectangle. outputView pupil (default) or answer. Never fill or calculate otherwise.',
  reviseDescription:
    'Revise function machines atomically using envelope, baseHash:contentHash and max 40 operations. set_item {machineId,slot,text?,show?} where slot is "start", "end", "op:N" (box N from 0) or "out:N" (the value on the arrow after box N; setting it adds it); remove_between {machineId,slot:"out:N"}; add_box {machineId,after?,text?} (after -1 for the front; default the end); remove_box {machineId,index}; add_machine {ops?}; remove_machine {machineId}; add_inverse {machineId}; set_direction {machineId,direction:right|left}; complete {machineId?,hidden?,between?} works one or every machine out, as hidden answers unless hidden:false; set_settings {settings:{boxShape?,intentionalError?,lines?}}. Nothing is worked out unless requested. Stable IDs (m1, m2) come from the returned envelope. outputView pupil|answer affects artwork only.',
};
