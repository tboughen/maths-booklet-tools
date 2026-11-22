/**
 * What pupils see of one label on a diagram: the one vocabulary every editor uses (the 21 Nov 2026 usability plan).
 *
 * - "show" prints the value, including 0.
 * - "hidden" is a pupil space: the pupil copy has a dotted space or a box, and the answers copy prints the saved value.
 * - "omit" (Leave out) keeps the saved value but prints nothing in either copy.
 *
 * An empty shown label prints nothing too, but that is "no value", not a choice. "Answer line" stays the builders'
 * word for the line after a question; "Pupil space" is only for a blank inside a diagram.
 */
export type Visibility = "show" | "hidden" | "omit";
export const VISIBILITIES: readonly Visibility[] = ["show", "hidden", "omit"];
export const VISIBILITY_NAMES: Record<Visibility, string> = { show: "Show", hidden: "Pupil space", omit: "Leave out" };
export const VISIBILITY_HELP: Record<Visibility, string> = {
  show: "Pupils see the value.",
  hidden: "Pupils see a space to fill in. The answers copy shows the value.",
  omit: "Nothing prints, in either copy. The value is kept.",
};
/** The tooltip on every click target on a diagram. */
export const TARGET_TIP = "Click to type a new value · double-click for a pupil space";
export const TARGET_TIP_SPACE = "Pupil space. Click to edit · double-click to show the value";

/** Double-click: a pupil space, and again back to the value. A left-out label becomes a pupil space. */
export const togglePupilSpace = (v: Visibility): Visibility => (v === "hidden" ? "show" : "hidden");

/** The one state a group of labels shares, or "mixed" when they differ (null for an empty group). */
export function commonVisibility(states: readonly Visibility[]): Visibility | "mixed" | null {
  if (!states.length) return null;
  return states.every((s) => s === states[0]) ? states[0] : "mixed";
}

/** Words for a screen reader or an undo step: "pupil space", "left out", or "" when the label shows. */
export const visibilityWords = (v: Visibility) => (v === "hidden" ? "pupil space" : v === "omit" ? "left out" : "");

/** The undo step for a change of what pupils see, e.g. "pupil space on 3/8" or "show all probabilities". */
export function visibilityStep(v: Visibility, what: string): string {
  const verb = v === "hidden" ? "pupil space on" : v === "omit" ? "leave out" : "show";
  return `${verb} ${what}`.trim();
}
