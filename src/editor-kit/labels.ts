/**
 * Names for undo steps (improvement item U8), so Undo can say what it will reverse.
 * Names are short lower-case phrases, read after "Undo" or "Redo": "add row", "reset this table".
 */

/** Turn a confirmation question ("Reset this table?") into a step name ("reset this table"). */
export function stepName(question: string): string {
  const text = question.trim().replace(/[?.!]+$/, "").trim();
  if (!text) return "";
  // Keep acronyms and proper names ("SVG", "Venn") but lower-case an ordinary first word.
  return /^[A-Z][a-z]/.test(text) ? text[0].toLowerCase() + text.slice(1) : text;
}

/** Name a batch of editing operations by its first operation ("add_column" -> "add column", "set_cell" -> "change cell"). */
export function operationLabel(operations: readonly { op?: unknown; type?: unknown; kind?: unknown }[] | { op?: unknown; type?: unknown; kind?: unknown }): string {
  const list = Array.isArray(operations) ? operations : [operations];
  const first = list[0] as { op?: unknown; type?: unknown; kind?: unknown } | undefined;
  const name = first && [first.op, first.type, first.kind].find(value => typeof value === "string");
  if (typeof name !== "string") return "";
  return name
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim()
    .toLowerCase()
    .replace(/^set /, "change ");
}

/** The toolbar text for Undo or Redo with an optional step name. */
export const historyActionText = (action: "Undo" | "Redo", label?: string) => (label ? `${action} ${label}` : action);

/** Whether a step name is a Reset or "new resource" step, which gets a visible "Resource reset — Undo" notice (U25). */
export const isResetStep = (label?: string) => !!label && /^(reset|start a new|start afresh|new model)\b/.test(label);
