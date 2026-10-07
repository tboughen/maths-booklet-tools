import {
  emptyRatioTable,
  parseRatioFile,
  canonicalRatio,
} from "../../packages/ratio-table-core/src/interchange";
import type { RatioEnvelope } from "../../packages/ratio-table-core/src/schema";

export const RATIO_STORAGE_KEY = "maths-booklet-tools:ratio-table-envelope:v1";
export function loadRatioRecovery(): {
  envelope: RatioEnvelope;
  recovery: string | null;
  error: string | null;
} {
  try {
    const raw = localStorage.getItem(RATIO_STORAGE_KEY);
    if (!raw)
      return { envelope: emptyRatioTable(), recovery: null, error: null };
    try {
      return { envelope: parseRatioFile(raw), recovery: null, error: null };
    } catch {
      return {
        envelope: emptyRatioTable(),
        recovery: raw,
        error:
          "The saved table needs recovery. Its original file has been preserved.",
      };
    }
  } catch {
    return {
      envelope: emptyRatioTable(),
      recovery: null,
      error:
        "Device storage is unavailable. Save an editable file to keep your work.",
    };
  }
}
export function saveRatio(envelope: RatioEnvelope): void {
  localStorage.setItem(RATIO_STORAGE_KEY, canonicalRatio(envelope));
}
export function startRatioAfterRecovery(
  expected: string,
  envelope: RatioEnvelope,
): void {
  if (localStorage.getItem(RATIO_STORAGE_KEY) !== expected)
    throw Error(
      "The saved table changed in another tab. Reload before starting a new table.",
    );
  saveRatio(envelope);
}
