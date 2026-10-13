import {
  defaultEnvelope,
  parseFile,
  canonical,
  type ValueEnvelope,
} from "../../packages/value-graph-core/src/interchange";
export const STORAGE_KEY = "mathsdock:value-table-graph:v1";
export function recovery(key = STORAGE_KEY) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return { envelope: defaultEnvelope(), raw: null, error: "" };
    try {
      return { envelope: parseFile(raw), raw: null, error: "" };
    } catch {
      return {
        envelope: defaultEnvelope(),
        raw,
        error:
          "The saved resource needs recovery. Its original data has been preserved.",
      };
    }
  } catch {
    return {
      envelope: defaultEnvelope(),
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
