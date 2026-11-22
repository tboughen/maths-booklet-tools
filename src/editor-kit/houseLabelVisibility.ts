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
 * becomes a pupil space moves to the saved answer, and back again.
 */
export function withHouseVisibility<L extends HouseLabel>(l: L, v: Visibility, what = "the size"): L | string {
  if (houseVisibility(l) === v) return l;
  const typed = l.answer || l.text;
  if (v === "show") {
    if (!typed) return `Type ${what} or a letter first, then show it.`;
    // A letter with a saved answer stays a letter, keeping its answer for the answers copy.
    if (l.state !== "blank" && l.text && !isValue(l.text) && l.answer) return { ...l, state: "symbol" };
    return isValue(typed) ? { ...l, state: "value", text: typed, answer: "" } : { ...l, state: "symbol", text: typed, answer: "" };
  }
  if (v === "hidden") {
    if (!typed) return `Type the answer first, then make it a pupil space.`;
    return { ...l, state: l.state === "answer-line" ? "answer-line" : "hidden", text: l.state === "symbol" ? l.text : "", answer: typed };
  }
  return { ...l, state: "blank", text: typed, answer: "" };
}
