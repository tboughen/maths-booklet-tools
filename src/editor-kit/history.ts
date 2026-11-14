/**
 * One undo/redo history for every editor (improvement item U7).
 *
 * The history holds whole documents. `done` and `undone` hold the names of the changes, aligned with the end of
 * `past` and the start of `future`, so the toolbar can say "Undo add row" (item U8). Labels are optional:
 * an unnamed change has the empty string.
 */
export interface History<T> {
  past: T[];
  present: T;
  future: T[];
  /** done[i] names the change that turned past[i] into the next state. */
  done?: string[];
  /** undone[i] names the change that turns the state before future[i] into future[i]. */
  undone?: string[];
}

/** One limit for every editor. Older steps fall off the start of the history. */
export const EDITOR_HISTORY_LIMIT = 100;

export interface PushOptions<T> {
  /** Name of the change, for "Undo …" (U8). */
  label?: string;
  /** Changes equal to the present are not recorded. Defaults to `Object.is`. */
  equals?: (a: T, b: T) => boolean;
  limit?: number;
}

const labels = (list: string[] | undefined, length: number, from: "end" | "start") => {
  const source = list ?? [];
  if (source.length === length) return source;
  if (source.length > length) return from === "end" ? source.slice(source.length - length) : source.slice(0, length);
  const padding = Array<string>(length - source.length).fill("");
  return from === "end" ? [...padding, ...source] : [...source, ...padding];
};

export function createHistory<T>(present: T): History<T> {
  return { past: [], present, future: [], done: [], undone: [] };
}

/** Record `next` as a new step and clear redo. */
export function pushHistory<T>(history: History<T>, next: T, options: PushOptions<T> = {}): History<T> {
  const equals = options.equals ?? Object.is;
  if (equals(history.present, next)) return history;
  const limit = Math.max(1, options.limit ?? EDITOR_HISTORY_LIMIT);
  const past = [...history.past, history.present];
  const done = [...labels(history.done, history.past.length, "end"), options.label ?? ""];
  const drop = Math.max(0, past.length - limit);
  return { past: past.slice(drop), present: next, future: [], done: done.slice(drop), undone: [] };
}

export function undoHistory<T>(history: History<T>): History<T> {
  if (!history.past.length) return history;
  const done = labels(history.done, history.past.length, "end");
  const undone = labels(history.undone, history.future.length, "start");
  return {
    past: history.past.slice(0, -1),
    present: history.past[history.past.length - 1],
    future: [history.present, ...history.future],
    done: done.slice(0, -1),
    undone: [done[done.length - 1], ...undone],
  };
}

export function redoHistory<T>(history: History<T>): History<T> {
  if (!history.future.length) return history;
  const done = labels(history.done, history.past.length, "end");
  const undone = labels(history.undone, history.future.length, "start");
  return {
    past: [...history.past, history.present],
    present: history.future[0],
    future: history.future.slice(1),
    done: [...done, undone[0]],
    undone: undone.slice(1),
  };
}

/** Change the present without making an undo step (selection, recovery). */
export function replacePresent<T>(history: History<T>, present: T): History<T> {
  return history.present === present ? history : { ...history, present };
}

/** The name of the step Undo would reverse, or "" when it has none. */
export const undoLabel = <T,>(history: History<T>) => (history.past.length ? (labels(history.done, history.past.length, "end").at(-1) ?? "") : "");
/** The name of the step Redo would restore, or "" when it has none. */
export const redoLabel = <T,>(history: History<T>) => (history.future.length ? (labels(history.undone, history.future.length, "start")[0] ?? "") : "");
