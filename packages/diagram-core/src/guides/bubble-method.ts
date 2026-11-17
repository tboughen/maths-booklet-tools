import * as bm from "../../../bubble-method-core/src/index";
import * as bi from "../../../bubble-method-core/src/interchange";
export const bmConfig = {
  kind: "bubble-method" as const,
  name: "bubble_method",
  schema: bm.envelopeSchema,
  createInput: bi.createSchema,
  revision: bi.revisionSchema,
  capabilities: {
    schemaVersions: [1],
    rendererVersions: [bm.RENDERER_VERSION],
    maximumSteps: bm.MAX_STEPS,
    sideLength: bm.MAX_SIDE,
    bubbleLength: bm.MAX_OP,
    relations: bm.RELATIONS,
    under: 'Where a bubble sits under the line above: "auto" (default: + and − under the last term, others under the whole side), "whole", or a term number from 0 on the left.',
    examples: bi.exampleIds,
    itemStates: ["show", "hidden"],
    typing: "Sides: 3x+2, y-2, (y-2)/3, x^2: signs print as a paper prints them, letters in italic, fractions stacked (a bracketed numerator stacks without its brackets). Bubbles: -2, /3, x3, +5, -3x print as −2, ÷3, ×3, +5, −3x.",
    maximumRevisionOperations: 40,
    revisionOperations: bi.operationSchema.options.map((o) => o.shape.op.value),
    outputView: "pupil (default) or explicitly requested answer; source JSON and hash keep saved pupil visibility",
    hiddenAnswers: "A hidden side or bubble is saved and prints as a blank for pupils (a dotted line, or an empty bubble); an empty shown item is a blank with no answer.",
    creation: "spec or envelope; omit both for 2x + 3 = 11 with one empty step",
  },
  createDescription:
    'Create the school\'s bubble method (balancing) working for solving equations and inequalities and changing the subject: lines aligned on their sign going down the page, and between two lines the operation in a bubble under the term it acts on, on both sides. Supply exact envelope OR spec:{example?|start?, steps?, intentionalError?, lines?, worked?}. example: subject-one-step, subject-two-steps, subject-formula, solve-equation, inequality. start: the first line as text, such as "y = 3x + 2" (signs =, <, >, ≤, ≥). steps: up to 8, each {bubble:"−2" (both sides) or left/right, leftUnder?, rightUnder?, line}. A line is text "y − 2 = 3x", {text, hidden:true} (both sides saved as answers, blank for pupils), or {lhs, rel?, rhs}; a left-out or "" line is blank for pupils, keeping the sign above. A bubble or side is text ("" is a pupil blank: an empty bubble or a dotted line) or {text, hidden:true}. leftUnder/rightUnder: "auto" (default), "whole" or a term number from 0. intentionalError:true silences notes on bubbles that differ. outputView pupil (default) or answer. Never fill, solve or reveal otherwise.',
  reviseDescription:
    'Revise bubble method working atomically using envelope, baseHash:contentHash and max 40 operations. set_item {slot,text?,show?} where slot is "first:lhs", "first:rhs", or for step N from 0 "step:N:left", "step:N:right" (its bubbles), "step:N:lhs", "step:N:rhs" (its line); set_bubbles {step,text} writes both bubbles; set_under {step,side:left|right,under:auto|whole|term number}; set_relation {line:"first"|step number,rel}; add_step {after?,bubble?} (after -1 for straight under the first line; default the end; its line is blank); remove_step {index}; set_settings {settings:{intentionalError?,lines?}}. Nothing is worked out. outputView pupil|answer affects artwork only.',
};
