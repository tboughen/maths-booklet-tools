import { useSyncExternalStore } from "react";

/** The diagram tools a teacher has starred, kept in this browser and shared by every page that
 * shows them (the Diagram builder page and the tool switcher). */
const KEY = "mathsdock.favouriteTools";
const listeners = new Set<() => void>();
let current: readonly string[] | null = null;

function read(): readonly string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(KEY) ?? "null");
    return Array.isArray(value) && value.every((id) => typeof id === "string") ? [...new Set(value as string[])] : [];
  } catch {
    return [];
  }
}
function snapshot(): readonly string[] {
  return (current ??= read());
}
function subscribe(listener: () => void) {
  // Another tab changing the list reaches this one through the storage event.
  const storage = (event: StorageEvent) => {
    if (event.key !== KEY && event.key !== null) return;
    current = read();
    listener();
  };
  listeners.add(listener);
  window.addEventListener("storage", storage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", storage);
  };
}

export function toggleFavouriteTool(id: string) {
  const now = snapshot();
  current = now.includes(id) ? now.filter((f) => f !== id) : [...now, id];
  try {
    localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    /* Private windows may refuse storage: the choice still applies until the page closes. */
  }
  listeners.forEach((listener) => listener());
}

/** The starred tool IDs, oldest first. */
export function useFavouriteTools(): readonly string[] {
  return useSyncExternalStore(subscribe, snapshot);
}

/** Tests start each case from what storage holds. */
export function resetFavouriteToolsForTests() {
  current = null;
}
