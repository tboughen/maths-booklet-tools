import { it, expect } from "vitest";
import { readStorage, saveStorage } from "./storage";
import * as v from "../../packages/bar-model-core/src/v2";
import * as c from "../../packages/bar-model-core/src/versioned";
import * as old from "../../packages/bar-model-core/src/index";
it("retains a valid current model when only the older key is corrupt", async () => {
  const e = v.fresh(),
    s = storage({
      old: "broken old key",
      new: JSON.stringify({ storageVersion: 1, envelope: e }),
    }),
    before = [...s.values],
    r = await readStorage(s, "new", "old");
  expect(r.envelope).toEqual(e);
  expect(r.recovery).toBeUndefined();
  expect(r.legacyRecovery).toBe("broken old key");
  expect([...s.values]).toEqual(before);
});
it("keeps editing available when browser storage cannot be read", async () => {
  const r = await readStorage(
    {
      getItem: () => {
        throw Error("Storage disabled");
      },
    },
    "new",
    "old",
  );
  expect(r.recovery).toBeUndefined();
  expect(r.envelope.schemaVersion).toBe(2);
  expect(r.message).toContain("Keep editing");
});
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
it("reading missing or legacy work never writes or upgrades", async () => {
  const empty = storage();
  expect((await readStorage(empty, "new", "old")).envelope.schemaVersion).toBe(
    2,
  );
  expect(empty.values.size).toBe(0);
  const raw = c.canonical(old.fresh()),
    s = storage({ old: raw }),
    r = await readStorage(s, "new", "old");
  expect(r.envelope.schemaVersion).toBe(1);
  expect(r.legacySourceHash).toBe(await c.hash(old.fresh()));
  expect(s.values).toEqual(new Map([["old", raw]]));
});
it("stores legacy snapshot metadata outside the definition and preserves old bytes", async () => {
  const legacy = old.fresh(),
    raw = c.canonical(legacy),
    s = storage({ old: raw }),
    hash = await c.hash(legacy),
    e = v.fresh();
  saveStorage(s, "new", null, e, hash);
  const read = await readStorage(s, "new", "old");
  expect(read.alternate).toBeUndefined();
  expect(c.canonical(read.envelope)).toBe(c.canonical(e));
  expect(s.getItem("old")).toBe(raw);
  expect(c.canonical(e)).not.toContain(hash);
});
it("retains both divergent saved versions without choosing or merging", async () => {
  const e = old.fresh(),
    s = storage({ old: c.canonical(e) });
  saveStorage(s, "new", null, v.fresh(), await c.hash(e));
  e.document.bars[0].name = old.label("Changed old work");
  s.setItem("old", c.canonical(e));
  const before = [...s.values],
    r = await readStorage(s, "new", "old");
  expect(r.alternate).toEqual(e);
  expect([...s.values]).toEqual(before);
});
it("protects corrupt and future new data rather than falling back to old", async () => {
  for (const raw of [
    "{bad",
    JSON.stringify({ storageVersion: 9, envelope: v.fresh() }),
    JSON.stringify({
      storageVersion: 1,
      envelope: { ...v.fresh(), schemaVersion: 99 },
    }),
  ]) {
    const s = storage({ new: raw, old: c.canonical(old.fresh()) }),
      r = await readStorage(s, "new", "old");
    expect(r.recovery).toBe(raw);
    expect(s.getItem("new")).toBe(raw);
  }
});
it("compares before writing and leaves a newer tab intact", () => {
  const s = storage({ new: "newer" });
  expect(() => saveStorage(s, "new", null, v.fresh())).toThrow(/Another tab/);
  expect(s.getItem("new")).toBe("newer");
});
