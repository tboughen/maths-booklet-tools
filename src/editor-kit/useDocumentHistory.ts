import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createHistory, pushHistory, redoHistory, redoLabel, replacePresent, undoHistory, undoLabel, type History } from "./history";
import { handleUndoKeys } from "./shortcuts";

export interface DocumentHistoryOptions<T> {
  /** Treat a change equal to the present as no change (no undo step). */
  equals?: (a: T, b: T) => boolean;
  limit?: number;
  /** Start from an existing history instead of a single document (tests, restored sessions). */
  from?: History<T>;
}

/**
 * The shared undo/redo history for an editor's document (improvement item U7). `commit` records a change,
 * `replace` changes the present without an undo step, and `setHistory` is there for whole-history moves such as
 * loading a file that the page has already turned into one undoable step.
 */
export function useDocumentHistory<T>(initial: T | (() => T), options: DocumentHistoryOptions<T> = {}) {
  const [history, setHistory] = useState<History<T>>(() => options.from ?? createHistory(typeof initial === "function" ? (initial as () => T)() : initial));
  const settings = useRef(options);
  settings.current = options;
  const commit = useCallback((next: T, label?: string) => setHistory(h => pushHistory(h, next, { ...settings.current, label })), []);
  const undo = useCallback(() => setHistory(undoHistory), []);
  const redo = useCallback(() => setHistory(redoHistory), []);
  const replace = useCallback((next: T) => setHistory(h => replacePresent(h, next)), []);
  return useMemo(
    () => ({
      history,
      setHistory,
      present: history.present,
      canUndo: history.past.length > 0,
      canRedo: history.future.length > 0,
      undoLabel: undoLabel(history),
      redoLabel: redoLabel(history),
      commit,
      undo,
      redo,
      replace,
    }),
    [history, commit, undo, redo, replace],
  );
}

/** Listen for the shared undo keys while the editor is the active page. */
export function useUndoKeys(active: boolean, actions: { undo: () => void; redo: () => void; blocked?: boolean }) {
  const latest = useRef(actions);
  latest.current = actions;
  useEffect(() => {
    if (!active) return;
    const listener = (event: KeyboardEvent) => {
      handleUndoKeys(event, latest.current);
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [active]);
}
