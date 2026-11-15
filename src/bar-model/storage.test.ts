import { it, expect } from "vitest";
import { readStorage, saveStorage } from "./storage";
import * as v3 from "../../packages/bar-model-core/src/v3";
function storage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    values,
    getItem: (k: string) => values.get(k) ?? null,
    setItem: (k: string, s: string) => {
      values.set(k, s);
    },
  };
}
it("keeps editing available when browser storage cannot be read", async () => {
  const r = await readStorage(
    {
      getItem: () => {
        throw Error("Storage disabled");
      },
    },
    "new",
  );
  expect(r.recovery).toBeUndefined();
  expect(r.envelope.schemaVersion).toBe(3);
  expect(r.message).toContain("Keep editing");
});
it("reading missing work never writes", async () => {
  const empty = storage();
  expect((await readStorage(empty, "new")).envelope.schemaVersion).toBe(3);
  expect(empty.values.size).toBe(0);
});
it("offers work saved under the retired key for download without reading or changing it", async () => {
  const s = storage({ old: "old-editor-bytes" }),
    r = await readStorage(s, "new", "old");
  expect(r.recovery).toBe("old-editor-bytes");
  expect(r.expected).toBeNull();
  expect(r.message).toContain("Download it");
  expect(s.values).toEqual(new Map([["old", "old-editor-bytes"]]));
  const fresh = await readStorage(storage({ new: JSON.stringify({ storageVersion: 1, envelope: v3.fresh() }), old: "x" }), "new", "old");
  expect(fresh.recovery).toBeUndefined();
});
it("protects corrupt, future-version and older-schema data", async () => {
  for (const raw of [
    "{bad",
    JSON.stringify({ storageVersion: 9, envelope: v3.fresh() }),
    JSON.stringify({ storageVersion: 1, envelope: { ...v3.fresh(), schemaVersion: 2 } }),
  ]) {
    const s = storage({ new: raw }),
      r = await readStorage(s, "new");
    expect(r.recovery).toBe(raw);
    expect(s.getItem("new")).toBe(raw);
  }
});
it("compares before writing and leaves a newer tab intact", () => {
  const s = storage({ new: "newer" });
  expect(() => saveStorage(s, "new", null, v3.fresh())).toThrow(/Another tab/);
  expect(s.getItem("new")).toBe("newer");
});
it("reopens a saved model exactly", async () => {
  const e = v3.fresh();
  e.document.captions = [{ id: "c", label: v3.label("4/5 × 45 = 36"), alignment: "right", format: "maths" }];
  e.document.bars[0].parts[0].labels.inside = v3.label("3/4", "line");
  const s = storage();
  saveStorage(s, "new", null, e);
  const raw = s.getItem("new");
  const r = await readStorage(s, "new");
  expect(r.envelope).toEqual(e);
  expect(s.getItem("new")).toBe(raw);
  s.setItem("new", "a different newer tab");
  expect(() => saveStorage(s, "new", raw, e)).toThrow(/Another tab/);
  expect(s.getItem("new")).toBe("a different newer tab");
});
