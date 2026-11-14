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
