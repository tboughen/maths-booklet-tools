import * as wm from "../../../written-method-core/src/index";
import * as wi from "../../../written-method-core/src/interchange";
export const wmConfig = {
  kind: "written-method" as const,
  name: "written_method",
  schema: wm.envelopeSchema,
  createInput: wi.createSchema,
  revision: wi.revisionSchema,
  capabilities: {
    schemaVersions: [1],
    rendererVersions: [wm.RENDERER_VERSION],
    methods: wm.METHODS,
    maximumDigits: wm.MAX_DIGITS,
    maximumWorkingRows: wm.MAX_ROWS,
    maximumSmallDigits: wm.MAX_MARKS,
    cellMm: "5 to 10 (default 7): each digit's square at print size",
    examples: wi.exampleIds,
    itemStates: ["show", "hidden"],
    numbers: "Add and subtract take decimals and line them up on the point; long multiplication takes whole numbers (place the point after, as the school method does); a division's divisor is whole (multiply both by 10, 100 or 1000 first).",
    maximumRevisionOperations: 40,
    revisionOperations: wi.operationSchema.options.map((o) => o.shape.op.value),
    outputView: "pupil (default) or explicitly requested answer; source JSON and hash keep saved pupil visibility",
    hiddenAnswers: "A hidden row or small digit is saved and prints as empty squares for pupils; an empty shown row is a blank with no answer.",
    creation: "spec or envelope; omit both for an empty long multiplication",
  },
  createDescription:
    'Create a written method laid out in place-value columns, as the school teaches it: column addition (2 to 4 numbers, decimals on the point), column subtraction (exchanges crossed out), long multiplication (partial products then their sum), short division (bus stop, remainders carried small) or long division. Supply exact envelope OR spec:{example?|method?,numbers?,working?,answer?,remainder?,extend?, cellMm?, intentionalError?, lines?, complete?, worked?}. example: column-add, add-decimals, column-subtract, long-multiplication, short-division, division-remainder, long-division-decimal. numbers: add 2-4, otherwise 2; division [number to divide, number to divide by]. Any row is text ("" is a pupil blank) or {text, hidden:true} (a saved answer, empty for pupils). working: a number of blank working rows, or rows [{text, place?, kind?}]. remainder:true leaves an "r ..." space after a division answer. extend:"0" writes zeros after the point to keep dividing. complete:true explicitly works the method out (answer, working rows, carries, exchanges) as hidden answers; complete:{hidden:false} prints them, {decimals:true} keeps dividing past the point instead of a remainder. intentionalError:true silences teacher notes. outputView pupil (default) or answer. Never fill or calculate otherwise.',
  reviseDescription:
    'Revise a written method atomically using envelope, baseHash:contentHash and max 40 operations. Row IDs: n1, n2... (numbers), w1... (working rows), answer, remainder, extend. set_row {row,text?,show?}; set_method {method} (keeps the numbers, clears the working); add_number {text?} (addition); remove_number {row}; add_row {text?,place?,kind?} (working rows for long multiplication and long division); remove_row {row}; shift_row {row,by} moves a working row by columns (+1 left); set_remainder {on}; set_mark {row,place,text?,show?,cross?} sets a small digit (a carry or exchange) at a place value (0 ones, 1 tens, -1 tenths; text "" removes it; cross:true strikes the digit beneath); complete {hidden?,decimals?} works it out, as hidden answers unless hidden:false; set_settings {settings:{cellMm?,intentionalError?,lines?}}. Nothing is worked out unless requested. outputView pupil|answer affects artwork only.',
};
