/**
 * The teacher's house style preference (U111), kept in this browser. It sets the starting text
 * size of new diagrams; each diagram's own settings override it and are saved with the diagram.
 */
import { useSyncExternalStore } from "react";
import { DEFAULT_PREFERENCE, parsePreference, type HousePreference } from "../../packages/envelope-core/src/house-style";

const KEY = "mathsdock.houseStyle";
const listeners = new Set<() => void>();
let cached: HousePreference | null = null;

export function housePreference(): HousePreference {
  if (cached) return cached;
  try {
    cached = parsePreference(JSON.parse(localStorage.getItem(KEY) ?? "null"));
  } catch {
    cached = DEFAULT_PREFERENCE;
  }
  return cached;
}

export function setHousePreference(next: HousePreference) {
  cached = parsePreference(next);
  try {
    localStorage.setItem(KEY, JSON.stringify(cached));
  } catch {
    /* Private windows may refuse storage: the choice still applies until the page closes. */
  }
  listeners.forEach((l) => l());
}

export function useHousePreference(): HousePreference {
  return useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    housePreference,
    () => DEFAULT_PREFERENCE,
  );
}
