import * as c from "../../packages/bar-model-core/src/versioned";
import * as v from "../../packages/bar-model-core/src/v3";
export interface StorageRecord {
  storageVersion: 1;
  envelope: c.Envelope;
  legacySourceHash?: string;
}
export interface Startup {
  envelope: c.Envelope;
  expected: string | null;
  legacyRaw: string | null;
  legacySourceHash?: string;
  observedLegacyHash?: string;
  recovery?: string;
  legacyRecovery?: string;
  alternate?: c.Envelope;
  message: string;
}
export async function readStorage(
  storage: Pick<Storage, "getItem">,
  key: string,
  oldKey: string,
): Promise<Startup> {
  let raw: string | null = null,
    legacyRaw: string | null = null;
  try {
    raw = storage.getItem(key);
    legacyRaw = storage.getItem(oldKey);
    let old: c.Envelope | null = null,
      legacyRecovery: string | undefined;
    try {
      old = legacyRaw ? c.parseFile(legacyRaw) : null;
    } catch (err) {
      if (raw === null) throw err;
      legacyRecovery = legacyRaw ?? undefined;
    }
    const oldHash = old ? await c.hash(old) : undefined;
    if (raw) {
      const record: unknown = JSON.parse(raw);
      if (
        !record ||
        typeof record !== "object" ||
        !("storageVersion" in record) ||
        record.storageVersion !== 1 ||
        !("envelope" in record)
      )
        throw Error("Unknown saved storage version.");
      const r = record as StorageRecord,
        e = c.validate(r.envelope);
      if (
        r.legacySourceHash !== undefined &&
        (typeof r.legacySourceHash !== "string" ||
          !/^[a-f0-9]{64}$/.test(r.legacySourceHash))
      )
        throw Error("Invalid legacy snapshot metadata.");
      return {
        envelope: e,
        expected: raw,
        legacyRaw,
        legacySourceHash: r.legacySourceHash,
        observedLegacyHash: oldHash,
        legacyRecovery,
        ...(old && oldHash !== r.legacySourceHash ? { alternate: old } : {}),
        message:
          old && oldHash !== r.legacySourceHash
            ? "Two saved versions differ. Preview and choose; neither has been overwritten."
            : legacyRecovery
              ? "The older saved data needs recovery and is protected; the current saved model remains available."
              : "",
      };
    }
    return {
      envelope: old ?? v.fresh(),
      expected: raw,
      legacyRaw,
      legacySourceHash: oldHash,
      observedLegacyHash: oldHash,
      message: "",
    };
  } catch (err) {
    return {
      envelope: v.fresh(),
      expected: raw,
      legacyRaw,
      ...(raw !== null || legacyRaw !== null
        ? { recovery: raw ?? legacyRaw ?? "" }
        : {}),
      message:
        raw !== null || legacyRaw !== null
          ? `Saved work needs recovery: ${err instanceof Error ? err.message : String(err)}. Original bytes are protected.`
          : "Device storage is unavailable. Keep editing and save an editable file to retain your work.",
    };
  }
}
export function saveStorage(
  storage: Pick<Storage, "getItem" | "setItem">,
  key: string,
  expected: string | null,
  envelope: c.Envelope,
  legacySourceHash?: string,
) {
  if (storage.getItem(key) !== expected)
    throw Error(
      "Another tab changed the saved model. Download both versions and choose before saving.",
    );
  const raw = JSON.stringify({
    storageVersion: 1,
    envelope: c.validate(envelope),
    ...(legacySourceHash ? { legacySourceHash } : {}),
  } satisfies StorageRecord);
  storage.setItem(key, raw);
  return raw;
}
