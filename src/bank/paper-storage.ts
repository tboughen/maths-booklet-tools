import { copyStorageKey } from "../site/copyDocument";
import { emptyDraft, hasDraftIntent, type PaperDraft } from "./paper-builder";

/**
 * The paper a teacher is building is saved on this device (improvement list S20, A59), so a reload,
 * a closed tab or a crash keeps it. It is reconciled with the current catalogue when the catalogue
 * loads, exactly as a draft kept in memory is. "Clear paper" removes it.
 */
export const PAPER_STORAGE_KEY = copyStorageKey("mathsdock:paper-draft:v1");

const strings = (value: unknown): value is string[] => Array.isArray(value) && value.every(v => typeof v === "string");

/** A saved draft, or null when the value is not a version 1 paper draft. */
export function parsePaperDraft(value: unknown): PaperDraft | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (v.schema !== 1 || !strings(v.codes) || !strings(v.excluded) || !strings(v.order) || typeof v.version !== "string") return null;
  if (!v.manual || typeof v.manual !== "object" || Array.isArray(v.manual) || !Object.values(v.manual).every(id => typeof id === "string")) return null;
  const draft: PaperDraft = { codes: v.codes, manual: { ...(v.manual as Record<string, string>) }, excluded: v.excluded, order: v.order, version: v.version };
  if (v.manuallyOrdered === true) draft.manuallyOrdered = true;
  return draft;
}

export function loadPaperDraft(storage: Pick<Storage, "getItem"> | undefined = globalThis.localStorage): PaperDraft {
  try {
    const saved = storage?.getItem(PAPER_STORAGE_KEY);
    return (saved && parsePaperDraft(JSON.parse(saved))) || emptyDraft();
  } catch {
    return emptyDraft();
  }
}

export function savePaperDraft(draft: PaperDraft, storage: Pick<Storage, "setItem" | "removeItem"> | undefined = globalThis.localStorage): void {
  try {
    if (!hasDraftIntent(draft) && !draft.excluded.length) storage?.removeItem(PAPER_STORAGE_KEY);
    else storage?.setItem(PAPER_STORAGE_KEY, JSON.stringify({ schema: 1, ...draft }));
  } catch {
    // Storage can be full or blocked (private windows); the paper still works for this visit.
  }
}
