import * as c from "../../packages/bar-model-core/src/versioned";
import * as v from "../../packages/bar-model-core/src/v3";
import { houseModel } from "./house";
const houseFresh = () => houseModel(v.fresh());
export interface StorageRecord {
  storageVersion: 1;
  envelope: c.Envelope;
}
export interface Startup {
  envelope: c.Envelope;
  expected: string | null;
  recovery?: string;
  message: string;
}
export async function readStorage(
  storage: Pick<Storage, "getItem">,
  key: string,
  /** A key earlier versions saved to. Its bytes are never read as a model or changed: when it is
   * the only saved work, it is offered for download so the teacher does not lose it silently. */
  retiredKey?: string,
): Promise<Startup> {
  let raw: string | null = null;
  try {
    raw = storage.getItem(key);
    if (!raw) {
      const retired = retiredKey ? storage.getItem(retiredKey) : null;
      return retired
        ? {
            envelope: houseFresh(),
            expected: raw,
            recovery: retired,
            message: "Saved work from an older version of this editor can no longer be opened. Download it to keep a copy.",
          }
        : { envelope: houseFresh(), expected: raw, message: "" };
    }
    const record: unknown = JSON.parse(raw);
    if (
      !record ||
      typeof record !== "object" ||
      !("storageVersion" in record) ||
      record.storageVersion !== 1 ||
      !("envelope" in record)
    )
      throw Error("Unknown saved storage version.");
    return { envelope: c.validate((record as StorageRecord).envelope), expected: raw, message: "" };
  } catch (err) {
    return {
      envelope: houseFresh(),
      expected: raw,
      ...(raw !== null ? { recovery: raw } : {}),
      message:
        raw !== null
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
) {
  if (storage.getItem(key) !== expected)
    throw Error(
      "Another tab changed the saved model. Download both versions and choose before saving.",
    );
  const raw = JSON.stringify({
    storageVersion: 1,
    envelope: c.validate(envelope),
  } satisfies StorageRecord);
  storage.setItem(key, raw);
  return raw;
}
