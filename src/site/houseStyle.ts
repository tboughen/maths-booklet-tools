/**
 * The teacher's house style preference (U111), kept in this browser. It sets the starting text
 * size of new diagrams; each diagram's own settings override it and are saved with the diagram.
 */
import { useSyncExternalStore } from "react";
import { DEFAULT_PREFERENCE, parsePreference, startingTextPt, type HousePreference, type LineWeight } from "../../packages/envelope-core/src/house-style";

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

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
// Another tab changed the house style: forget the cached copy.
if (typeof window !== "undefined")
  window.addEventListener("storage", (event) => {
    if (event.key !== KEY && event.key !== null) return;
    cached = null;
    listeners.forEach((l) => l());
  });

export function useHousePreference(): HousePreference {
  return useSyncExternalStore(subscribe, housePreference, () => DEFAULT_PREFERENCE);
}

/** A new diagram's text size and lines from the house style, within the family's text limits. */
export function houseStyled<P extends { fontPt: number; lines?: LineWeight }>(presentation: P, limits: { max?: number } = {}): P {
  const house = housePreference();
  presentation.fontPt = startingTextPt(house.style, presentation.fontPt, limits);
  if (house.lines === "bold") presentation.lines = "bold";
  return presentation;
}

/** Saves a lines choice: normal is the default, so it is not written into the file. */
export function setLines<P extends { lines?: LineWeight }>(presentation: P, lines: LineWeight) {
  if (lines === "bold") presentation.lines = "bold";
  else delete presentation.lines;
}
