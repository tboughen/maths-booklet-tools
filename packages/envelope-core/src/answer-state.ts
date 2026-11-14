/**
 * One answer-state vocabulary for every fillable slot in every MathsDock family and in worksheets
 * (improvement item W3). Each family keeps its own saved fields (`show: "hidden"`, `visibility:
 * "line"`, `state: "answer-line"`, `kind: "hidden"`, `answerOnly` ...): saved files never change.
 * What is shared is how those fields are READ, so the answers copy, the answer-leak check (W90),
 * the connector and the editors all agree on what a slot is.
 *
 * - supplied: given to the pupil and printed on both copies.
 * - zero: a supplied value of 0. It is a real value, never the same as blank.
 * - blank: nothing printed and nothing saved; the pupil fills it. An answers copy shows nothing.
 * - answerLine: an answer line printed for the pupil. A saved answer, if any, prints only on the
 *   answers copy.
 * - hidden: a saved answer left blank (no line) for the pupil, printed only on the answers copy.
 *
 * The renderer never derives an answer: a slot's `answer` is only ever text the teacher saved.
 */
export const ANSWER_STATES = ["supplied", "zero", "blank", "answerLine", "hidden"] as const;
export type AnswerState = (typeof ANSWER_STATES)[number];

/** The house answer colour for saved answers revealed on answers copies (dark pink, B/W safe). */
export const ANSWER_COLOUR = "#b0125b";

export interface AnswerSlot {
  /** Where the slot lives in the saved document, e.g. "document.regions.3". */
  path: string;
  state: AnswerState;
  /** Supplied text, or the saved answer of a hidden or answer-line slot. Empty when none. */
  text: string;
}

/** True when the state prints its text for the pupil. */
export const pupilSees = (state: AnswerState) => state === "supplied" || state === "zero";
/** True when the slot holds a saved answer that only the answers copy shows. */
export const holdsAnswer = (slot: AnswerSlot) => (slot.state === "hidden" || slot.state === "answerLine") && slot.text.trim() !== "";

const ZERO = /^\s*[-−]?\s*0+(?:[.,]0+)?\s*$/;
/** A supplied value: "zero" when it is 0 (0, 0.0, −0), otherwise "supplied"; blank when empty. */
export function suppliedState(text: string): AnswerState {
  if (!text.trim()) return "blank";
  return ZERO.test(text) ? "zero" : "supplied";
}

/** Shorthand for adapters: a slot from a path, state and text. */
export const slot = (path: string, state: AnswerState, text = ""): AnswerSlot => ({
  path,
  state: state === "supplied" ? suppliedState(text) : state,
  text,
});
