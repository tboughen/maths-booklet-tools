/**
 * Names for undo steps (improvement item U8), so Undo can say what it will reverse.
 * Names are short lower-case phrases, read after "Undo" or "Redo": "add row", "reset this table".
 */

/** Turn a confirmation question ("Reset this table?") into a step name ("reset this table"). Only the first sentence counts. */
export function stepName(question: string): string {
  const first = question.trim().split(/(?<=[?.!])\s+/)[0] ?? "";
  const text = first.replace(/[?.!]+$/, "").trim();
  if (!text) return "";
  // Keep acronyms ("SVG ...") but lower-case an ordinary first word, including "A" and "I".
  return /^[A-Z](?![A-Z])/.test(text) ? text[0].toLowerCase() + text.slice(1) : text;
}

/** Display names for operations whose schema name is not teacher language. */
const OPERATION_NAMES: Record<string, string> = {
  put_series: "change graph",
  replace_columns: "change x values",
  calculate_cells: "calculate values",
};

/** Name a batch of editing operations by its first operation ("add_column" -> "add column", "set_cell" -> "change cell"). */
export function operationLabel(operations: readonly { op?: unknown }[] | { op?: unknown }): string {
  const list = Array.isArray(operations) ? operations : [operations];
  const name = (list[0] as { op?: unknown } | undefined)?.op;
  if (typeof name !== "string") return "";
  if (OPERATION_NAMES[name]) return OPERATION_NAMES[name];
  return name
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim()
    .toLowerCase()
    .replace(/^set /, "change ");
}

/** The toolbar text for Undo or Redo with an optional step name. */
export const historyActionText = (action: "Undo" | "Redo", label?: string) => (label ? `${action} ${label}` : action);
