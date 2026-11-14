import { useCallback, useEffect, useRef, useState } from "react";

/**
 * The shared device draft for an editor (improvement item A29). Every editor keeps its working copy in
 * localStorage under a versioned key (".../v1"), opens it on the next visit, keeps a draft it cannot read as
 * recovery data instead of overwriting it, and never overwrites a newer draft saved by another tab. These were
 * copied into each page; this is the one adapter. Stored text and keys are unchanged, so existing drafts open.
 */

export const SAVED = "Saved on this device";
export const SAVE_UNAVAILABLE = "Save unavailable — download editable file";
export const STORAGE_UNAVAILABLE = "Device storage is unavailable. Save an editable file to keep your work.";

/** What an editor starts from: the saved draft, or a fresh document with the unreadable draft kept as recovery. */
export interface DraftStart<T> {
  document: T;
  /** The stored text that could not be opened, kept until the teacher protects it. */
  recovery: string | null;
  /** The message to show at start, or "" for none. */
  message: string;
}

export interface DraftOpenOptions<T> {
  key: string;
  parse: (text: string) => T;
  fresh: () => T;
  /** Shown when a stored draft cannot be opened. */
  recoveryMessage: string;
  /** Shown when device storage cannot be read. */
  unavailableMessage?: string;
}

/** Open the stored draft. A draft that fails to parse is kept as recovery data, never discarded. */
export function openDraft<T>(o: DraftOpenOptions<T>): DraftStart<T> {
  let raw: string | null;
  try {
    raw = localStorage.getItem(o.key);
  } catch {
    return { document: o.fresh(), recovery: null, message: o.unavailableMessage ?? STORAGE_UNAVAILABLE };
  }
  if (!raw) return { document: o.fresh(), recovery: null, message: "" };
  try {
    return { document: o.parse(raw), recovery: null, message: "" };
  } catch {
    return { document: o.fresh(), recovery: raw, message: o.recoveryMessage };
  }
}

/** Why the stored draft is now protected instead of being overwritten. */
export type DraftConflict = "newer" | "changed";

export interface DraftAutosaveOptions {
  key: string;
  /** The present document as stored text (canonical JSON). */
  text: string;
  /** True while recovery data is shown: nothing is written until it is resolved. */
  paused: boolean;
  /**
   * The stored draft cannot be overwritten. "newer": a save found another tab's newer draft. "changed": another
   * tab saved while this one was open. The page shows its own message and keeps `raw` as recovery data.
   */
  onConflict: (raw: string, reason: DraftConflict) => void;
}

/**
 * Autosave the present document, guarded against other tabs. Returns the save status text and the two ways to
 * resolve recovery data: `keepStored` (the stored draft is unchanged since it was protected, so this tab may
 * write again) and `forget` (start afresh: the next save writes without comparing).
 */
export function useDraftAutosave({ key, text, paused, onConflict }: DraftAutosaveOptions) {
  const [saveState, setSaveState] = useState(SAVED);
  const expected = useRef<string | null>(null);
  const conflict = useRef(onConflict);
  conflict.current = onConflict;

  useEffect(() => {
    if (paused) return;
    try {
      const raw = localStorage.getItem(key);
      if (expected.current !== null && raw !== expected.current && raw !== text) {
        conflict.current(raw ?? "", "newer");
        return;
      }
      localStorage.setItem(key, text);
      expected.current = text;
      setSaveState(SAVED);
    } catch {
      setSaveState(SAVE_UNAVAILABLE);
    }
  }, [key, text, paused]);

  useEffect(() => {
    const listener = (event: StorageEvent) => {
      if (event.key === key && event.newValue !== expected.current) conflict.current(event.newValue ?? "", "changed");
    };
    window.addEventListener("storage", listener);
    return () => window.removeEventListener("storage", listener);
  }, [key]);

  /**
   * After the teacher protected `recovery`: true when the stored draft is still exactly that copy, so this tab
   * may save over it. False when it changed again (protect the new copy first). Throws when storage is unavailable.
   */
  const keepStored = useCallback(
    (recovery: string) => {
      const raw = localStorage.getItem(key);
      if (raw !== recovery) return false;
      expected.current = raw;
      return true;
    },
    [key],
  );
  /** Start afresh after protecting recovery data: the next save writes without comparing. */
  const forget = useCallback(() => {
    expected.current = null;
  }, []);
  /** The stored draft text, for pages that compare it themselves (null when there is none). */
  const stored = useCallback(() => localStorage.getItem(key), [key]);

  return { saveState, keepStored, forget, stored };
}
