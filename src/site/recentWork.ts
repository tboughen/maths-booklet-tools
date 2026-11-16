import { useSyncExternalStore } from "react";
import { readPage, toolIds, type ToolId } from "./routes";

/**
 * Where a teacher last changed something on this device, newest first. Home's "Carry on" row
 * reads it. It holds a place and a time only, never the work itself, which each page saves on
 * its own. Kept in this browser like the work is.
 */
export type WorkPlace = ToolId | "worksheets" | "booklets" | "paper-builder";
export type RecentWork = { id: WorkPlace; at: number; detail?: string };

const KEY = "mathsdock.recentWork";
/** Enough for the row and a few to spare if a place is later forgotten. */
const LIMIT = 6;
const places: readonly string[] = [...toolIds, "worksheets", "booklets", "paper-builder"];
const isPlace = (id: unknown): id is WorkPlace => typeof id === "string" && places.includes(id);
const listeners = new Set<() => void>();
let current: readonly RecentWork[] | null = null;

function read(): readonly RecentWork[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(KEY) ?? "null");
    if (!Array.isArray(value)) return [];
    const seen = new Set<string>();
    return value
      .filter((item): item is RecentWork => !!item && isPlace(item.id) && Number.isFinite(item.at) && (item.detail === undefined || typeof item.detail === "string"))
      .filter((item) => !seen.has(item.id) && seen.add(item.id))
      .slice(0, LIMIT);
  } catch {
    return [];
  }
}
function snapshot(): readonly RecentWork[] {
  return (current ??= read());
}
function write(next: readonly RecentWork[]) {
  current = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* Private windows may refuse storage: the row still works until the page closes. */
  }
  listeners.forEach((listener) => listener());
}
// Another tab's work reaches this one through the storage event.
if (typeof window !== "undefined")
  window.addEventListener("storage", (event) => {
    if (event.key !== KEY && event.key !== null) return;
    current = read();
    listeners.forEach((listener) => listener());
  });

/** Records a change made just now. `detail` is a short line about the work, such as "3 Sparx codes". */
export function noteWork(id: WorkPlace, detail?: string, now = Date.now()) {
  write([{ id, at: now, ...(detail ? { detail } : {}) }, ...snapshot().filter((item) => item.id !== id)].slice(0, LIMIT));
}

/** Records a change to the page that is open, if it is one that keeps work: a diagram tool or a builder. */
export function noteWorkHere() {
  const page = readPage();
  if (isPlace(page)) noteWork(page);
}

/** Drops a place whose work has gone, such as a cleared paper. */
export function forgetWork(id: WorkPlace) {
  if (snapshot().some((item) => item.id === id)) write(snapshot().filter((item) => item.id !== id));
}

export function useRecentWork(): readonly RecentWork[] {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    snapshot,
  );
}

/** "today at 13:05", "yesterday at 09:10", "on Tuesday", "on 3 November", "on 3 November 2025". */
export function whenText(at: number, now = Date.now()): string {
  const then = new Date(at), today = new Date(now);
  const day = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((day(today) - day(then)) / 86_400_000);
  const time = `${String(then.getHours()).padStart(2, "0")}:${String(then.getMinutes()).padStart(2, "0")}`;
  if (days <= 0) return `today at ${time}`;
  if (days === 1) return `yesterday at ${time}`;
  if (days < 7) return `on ${then.toLocaleDateString("en-GB", { weekday: "long" })}`;
  return `on ${then.toLocaleDateString("en-GB", { day: "numeric", month: "long", ...(then.getFullYear() === today.getFullYear() ? {} : { year: "numeric" }) })}`;
}

/** Tests start each case from what storage holds. */
export function resetRecentWorkForTests() {
  current = null;
}
