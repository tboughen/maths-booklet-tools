import { houseVisibility, withHouseVisibility, type HouseLabel } from "../editor-kit/houseLabelVisibility";
import type { Visibility } from "../editor-kit/visibility";
import type { RatioCell } from "../../packages/ratio-table-core/src/schema";

/**
 * What pupils see of a ratio-table cell, read as the geometry tools' label states (wave 2, 22 Nov 2026):
 * a value is Show; a saved answer (blank or on an answer line) or an answer line is Pupil space; an empty cell is
 * Leave out, keeping a value typed before it was left out. Nothing is calculated or filled.
 */
function toHouse(c: RatioCell): HouseLabel {
  if (c.kind === "number") return { state: "value", text: c.value, answer: "" };
  if (c.kind === "hidden") return { state: c.line ? "answer-line" : "hidden", text: "", answer: c.value };
  if (c.kind === "answer-line") return { state: "answer-line", text: "", answer: "" };
  return { state: "blank", text: c.value ?? "", answer: "" };
}
function fromHouse(l: HouseLabel): RatioCell {
  if (l.state === "value" || l.state === "symbol") return { kind: "number", value: l.text };
  if (l.state === "blank") return l.text ? { kind: "empty", value: l.text } : { kind: "empty" };
  if (!l.answer) return { kind: "answer-line" };
  return l.state === "answer-line" ? { kind: "hidden", value: l.answer, line: true } : { kind: "hidden", value: l.answer };
}
export const cellVisibility = (c: RatioCell): Visibility => houseVisibility(toHouse(c));
/** The cell with a new visibility, or why it cannot have it (as a sentence for the status line). */
export function withCellVisibility(c: RatioCell, v: Visibility): RatioCell | string {
  const next = withHouseVisibility(toHouse(c), v, "the value");
  return typeof next === "string" ? next.replace(" or a letter", "") : fromHouse(next);
}
/** The value a cell keeps, whatever pupils see. */
export const cellValue = (c: RatioCell) => (c.kind === "number" || c.kind === "hidden" || c.kind === "empty" ? (c.value ?? "") : "");
