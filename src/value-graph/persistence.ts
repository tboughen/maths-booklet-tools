import {
  defaultEnvelope,
  parseFile,
  canonical,
  type ValueEnvelope,
} from "../../packages/value-graph-core/src/interchange";
import { housePreference } from "../site/houseStyle";
/** A new resource starts from the house style's lines (U111). */
export function freshValueGraph(): ValueEnvelope {
  const e = defaultEnvelope();
  if (housePreference().lines === "bold") e.document.print.lines = "bold";
  return e;
}
export const STORAGE_KEY = "mathsdock:value-table-graph:v1";
export function recovery(key = STORAGE_KEY) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return { envelope: freshValueGraph(), raw: null, error: "" };
    try {
      return { envelope: parseFile(raw), raw: null, error: "" };
    } catch {
      return {
        envelope: freshValueGraph(),
        raw,
        error:
          "The saved resource needs recovery. Its original data has been preserved.",
      };
    }
  } catch {
    return {
      envelope: freshValueGraph(),
      raw: null,
      error: "Storage is unavailable. Save an editable file to keep your work.",
    };
  }
}
export function save(
  e: ValueEnvelope,
  expected: string | null,
  key = STORAGE_KEY,
) {
  const current = localStorage.getItem(key);
  if (current !== expected)
    throw Error(
      "A newer resource was saved in another tab. Download your editable file before reloading.",
    );
  const next = canonical(e);
  localStorage.setItem(key, next);
  return next;
}
