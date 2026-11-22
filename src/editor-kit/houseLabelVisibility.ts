import type { Visibility } from "./visibility";

/**
 * What pupils see, for the tools with the house label states (angle diagrams, area and perimeter, geometry
 * figures, 3D solids; wave 1c of the usability rollout, 22 Nov 2026). Their labels keep five states and a saved
 * answer; the switch reads them as three:
 * - Show: a given value or a letter, printed on both copies.
 * - Pupil space: hidden or an answer line on the pupil copy; the answers copy prints the saved answer.
 * - Leave out: blank, so only the mark prints and no words on either copy. What was typed is kept in the text.
 * A blank that holds a saved answer prints it on the answers copy, so it reads as a pupil space.
 */
export type HouseState = "value" | "symbol" | "blank" | "answer-line" | "hidden";
export type HouseLabel = { state: HouseState; text: string; answer: string };

export function houseVisibility(l: HouseLabel): Visibility {
  if (l.state === "value" || l.state === "symbol") return "show";
  if (l.state === "blank" && !l.answer) return "omit";
  return "hidden";
}

/** Typed text with a digit is a given value (62, 2x + 10, 8 cm); without one it is a letter (x). */
const isValue = (t: string) => /\d/.test(t);

/**
 * The label with what pupils see changed, or a message saying what to type first. Nothing is lost: a value that
 * becomes a pupil space moves to the saved answer and back again, and a letter is never taken for an answer.
 */
export function withHouseVisibility<L extends HouseLabel>(l: L, v: Visibility, what = "the size"): L | string {
  if (houseVisibility(l) === v) return l;
  const letter = !!l.text && !isValue(l.text);
  if (v === "show") {
    // A letter stays a letter, keeping any saved answer for the answers copy.
    if (letter) return { ...l, state: "symbol" };
    const typed = l.answer || l.text;
    if (!typed) return `Type ${what} or a letter first, then show it.`;
    return isValue(typed) ? { ...l, state: "value", text: typed, answer: "" } : { ...l, state: "symbol", text: typed, answer: "" };
  }
  if (v === "hidden") {
    // The answer is the saved answer, or a typed value; a letter is what pupils see, not an answer.
    const answer = l.answer || (letter ? "" : l.text);
    if (!answer) return letter ? `Type the answer for ${l.text} first, then make it a pupil space.` : `Type the answer first, then make it a pupil space.`;
    return { ...l, state: l.state === "answer-line" ? "answer-line" : "hidden", text: letter ? l.text : "", answer };
  }
  // Leave out: a blank prints nothing, but a blank's saved answer would print on the answers copy, so a letter
  // that also has an answer cannot keep both.
  if (letter && l.answer) return `${l.text} has a saved answer. Clear the answer first, then leave the label out.`;
  return { ...l, state: "blank", text: l.answer || l.text, answer: "" };
}
