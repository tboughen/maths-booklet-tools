// @vitest-environment node
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DIAGRAM_KINDS, FAMILIES } from "./registry";
import { TITLE_MAX } from "../../envelope-core/src/about";

const corpus = join(__dirname, "../../envelope-core/fixtures/corpus");
/** A saved file of the family's current schema version, as a teacher would hold it now. */
const saved = (kind: string) =>
  readdirSync(join(corpus, kind))
    .filter((n) => n.endsWith(".json"))
    .sort()
    .map((n) => JSON.parse(readFileSync(join(corpus, kind, n), "utf8")) as Record<string, unknown>)
    .reduce((best, e) => (Number(e.schemaVersion) > Number(best.schemaVersion) ? e : best));
const about = { title: "Year 8 ratio starter", note: "From the department bank, lesson 3. Keep the blanks." };

describe("every family saves a title and a note beside the drawing (U34)", () => {
  for (const kind of DIAGRAM_KINDS) {
    it(`${kind}: keeps them through validate, create and revise, and never prints them`, async () => {
      const f = FAMILIES[kind];
      const plain = f.validate(saved(kind), "pupil") as Record<string, unknown>;
      const titled = { ...plain, ...about };
      expect(f.validate(titled, "pupil")).toMatchObject(about);
      expect(f.create({ envelope: titled })).toMatchObject(about);
      const revised = await f.revise({ envelope: titled, baseHash: await f.hash(titled), operations: [] });
      expect(revised).toMatchObject(about);
      expect(f.svg(f.validate(titled, "pupil"), "pupil")).toBe(f.svg(f.validate(plain, "pupil"), "pupil"));
      expect(await f.hash(titled)).not.toBe(await f.hash(plain));
      expect(() => f.validate({ ...plain, title: "x".repeat(TITLE_MAX + 1) }, "pupil")).toThrow();
      expect(() => f.validate({ ...plain, colour: "red" }, "pupil")).toThrow();
    });
  }

  it("every saved file of every schema version takes them, and a bar model keeps them through its upgrade", async () => {
    for (const kind of DIAGRAM_KINDS) {
      for (const name of readdirSync(join(corpus, kind)).filter((n) => n.endsWith(".json"))) {
        const raw = JSON.parse(readFileSync(join(corpus, kind, name), "utf8")) as Record<string, unknown>;
        expect(FAMILIES[kind].create({ envelope: { ...raw, ...about } }), `${kind}/${name}`).toMatchObject(about);
      }
    }
    const bar = FAMILIES["bar-model"];
    const v1 = { ...(readdirSync(join(corpus, "bar-model")).map((n) => JSON.parse(readFileSync(join(corpus, "bar-model", n), "utf8")) as Record<string, unknown>).find((e) => e.schemaVersion === 1)!), ...about };
    expect(await bar.revise({ envelope: v1, baseHash: await bar.hash(v1), operations: [{ op: "upgrade_document" }] })).toMatchObject({ ...about, schemaVersion: 2 });
  });
});

