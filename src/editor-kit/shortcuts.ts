/** Fields where Ctrl+Z belongs to the text, not to the document. */
export function isTypingTarget(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest("input,textarea,select,[contenteditable]:not([contenteditable='false'])") !== null;
}

/** A dialog is open, so the document behind it must not change. */
export function modalOpen(root: Document = document): boolean {
  return root.querySelector('[aria-modal="true"]') !== null;
}

export type UndoCommand = "undo" | "redo";

/**
 * The same undo keys in every editor: Ctrl/Cmd+Z undoes, Ctrl/Cmd+Shift+Z and Ctrl+Y redo. Never while typing in a
 * field or while a dialog is open. Returns the command, or null when the key is not an undo key for the document.
 */
export function undoCommand(event: Pick<KeyboardEvent, "key" | "ctrlKey" | "metaKey" | "shiftKey" | "altKey" | "target">): UndoCommand | null {
  if (!(event.ctrlKey || event.metaKey) || event.altKey) return null;
  const key = event.key.toLowerCase();
  if (key !== "z" && key !== "y") return null;
  if (isTypingTarget(event.target) || modalOpen()) return null;
  return key === "y" || event.shiftKey ? "redo" : "undo";
}

/**
 * Handle an undo key. Returns true when the event was an undo key (it is then prevented, even when `blocked`,
 * so the browser never undoes something else instead).
 */
export function handleUndoKeys(event: KeyboardEvent, actions: { undo: () => void; redo: () => void; blocked?: boolean }): boolean {
  const command = undoCommand(event);
  if (!command) return false;
  event.preventDefault();
  if (!actions.blocked) actions[command]();
  return true;
}

export type ObjectKey =
  | { kind: "delete" }
  | { kind: "deselect" }
  | { kind: "nudge"; dx: number; dy: number };

/** One nudge, in millimetres on the printed resource: 1 mm, or 5 mm with Shift (U9). */
export const NUDGE_MM = 1;
export const NUDGE_LARGE_MM = 5;

/**
 * The same object keys in every editor (U9): Delete or Backspace removes the selected object (a label, point,
 * arrow, line or shading, never a row, column or set) as one undo step; arrow keys nudge a movable object by
 * 1 mm (Shift: 5 mm; dy is positive downwards); Escape deselects. Tab already moves between objects because
 * every direct-edit target is a button. Never while typing in a field, behind a dialog, or with Ctrl/Cmd/Alt.
 */
export function objectKeyCommand(
  event: Pick<KeyboardEvent, "key" | "ctrlKey" | "metaKey" | "shiftKey" | "altKey" | "target" | "defaultPrevented">,
): ObjectKey | null {
  if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return null;
  if (isTypingTarget(event.target) || modalOpen()) return null;
  if (event.key === "Escape") return { kind: "deselect" };
  if (event.key === "Delete" || event.key === "Backspace") return { kind: "delete" };
  const step = event.shiftKey ? NUDGE_LARGE_MM : NUDGE_MM;
  const move = ({ ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] } as Record<string, [number, number]>)[event.key];
  return move ? { kind: "nudge", dx: move[0], dy: move[1] } : null;
}
