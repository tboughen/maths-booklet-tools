// @vitest-environment node
/**
 * A11 / W98: saved-file compatibility as a test. Every readable schema version of every family has
 * saved files in the golden corpus; reading never upgrades; every upgrade is pure, faithful to
 * the connector's own upgrade_document operation and gives a valid file of the next version.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DIAGRAM_KINDS, FAMILIES, type DiagramKind } from "./registry";
import { MIGRATIONS, SCHEMA_VERSIONS, schemaVersionOf, upgradeEnvelope, versionTable } from "./migrations";
import { migrationPath } from "../../envelope-core/src/migrations";

const corpus = join(__dirname, "../../envelope-core/fixtures/corpus");
const saved = (kind: DiagramKind) =>
  (existsSync(join(corpus, kind)) ? readdirSync(join(corpus, kind)) : [])
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => ({ name: `${kind}/${f}`, envelope: JSON.parse(readFileSync(join(corpus, kind, f), "utf8")) as unknown }));

describe("schema versions and explicit upgrades", () => {
  it("lists every family, with issued versions inside the readable ones", () => {
    expect(Object.keys(SCHEMA_VERSIONS).sort()).toEqual([...DIAGRAM_KINDS].sort());
    for (const kind of DIAGRAM_KINDS) {
      const v = SCHEMA_VERSIONS[kind];
      expect(v.issued.every((n) => v.readable.includes(n)), kind).toBe(true);
      if (v.issued.length > 1 || v.readable.length > v.issued.length) expect(v.note, kind).toBeTruthy();
    }
  });

  it("holds at least one saved file for every readable version, and no file of an unlisted version", () => {
    for (const kind of DIAGRAM_KINDS) {
      const versions = new Set(saved(kind).map((s) => schemaVersionOf(s.envelope)));
      for (const v of SCHEMA_VERSIONS[kind].readable) expect(versions.has(v), `${kind} schema ${v} needs a corpus file`).toBe(true);
      for (const v of versions) expect(SCHEMA_VERSIONS[kind].readable, `${kind} corpus holds schema ${v}`).toContain(v);
    }
  });

  it("never upgrades a file by reading it", () => {
    for (const kind of DIAGRAM_KINDS)
      for (const s of saved(kind)) {
        const read = FAMILIES[kind].validate(structuredClone(s.envelope), "pupil");
        expect(schemaVersionOf(read), s.name).toBe(schemaVersionOf(s.envelope));
      }
  });

  it("connects every older readable version to the newest by a chain of single steps", () => {
    for (const kind of DIAGRAM_KINDS) {
      const readable = SCHEMA_VERSIONS[kind].readable;
      const newest = Math.max(...readable);
      const upgradable = readable.filter((v) => MIGRATIONS.some((m) => m.kind === kind && m.from === v));
      for (const v of upgradable) expect(migrationPath(MIGRATIONS, kind, v, newest).length, `${kind} ${v}→${newest}`).toBe(newest - v);
    }
    for (const m of MIGRATIONS) {
      expect(m.to, `${m.kind} ${m.from}`).toBe(m.from + 1);
      expect(SCHEMA_VERSIONS[m.kind as DiagramKind].readable).toEqual(expect.arrayContaining([m.from, m.to]));
      expect(m.summary.length).toBeGreaterThan(20);
    }
    expect(() => migrationPath(MIGRATIONS, "bar-model", 3, 1)).toThrow(/cannot be moved back/);
    expect(() => migrationPath(MIGRATIONS, "graph", 1, 2)).toThrow(/no graph upgrade/);
  });

  for (const m of MIGRATIONS)
    it(`${m.kind} ${m.from}→${m.to} is pure, deterministic and valid on every saved schema ${m.from} file`, () => {
      const files = saved(m.kind as DiagramKind).filter((s) => schemaVersionOf(s.envelope) === m.from);
      expect(files.length).toBeGreaterThan(0);
      for (const s of files) {
        const before = JSON.stringify(s.envelope);
        const a = m.migrate(FAMILIES[m.kind as DiagramKind].validate(structuredClone(s.envelope), "pupil"));
        const b = m.migrate(FAMILIES[m.kind as DiagramKind].validate(structuredClone(s.envelope), "pupil"));
        expect(JSON.stringify(s.envelope), `${s.name} input untouched`).toBe(before);
        expect(a).toEqual(b);
        const upgraded = FAMILIES[m.kind as DiagramKind].validate(a, "pupil");
        expect(schemaVersionOf(upgraded), s.name).toBe(m.to);
        // It still draws, in both copies where the family has an answer copy.
        expect(FAMILIES[m.kind as DiagramKind].svg(upgraded, "pupil")).toMatch(/^(<\?xml[^>]*>\s*)?<svg\b/);
      }
    });

  it("upgrades through the registry exactly as the connector's upgrade_document does", async () => {
    for (const kind of ["cuboids", "venn", "bar-model"] as const) {
      const f = FAMILIES[kind];
      for (const s of saved(kind).filter((x) => schemaVersionOf(x.envelope) === 1)) {
        const envelope = f.validate(s.envelope, "pupil");
        const baseHash = await f.hash(envelope);
        const viaConnector = await f.revise({ envelope, baseHash, operations: [{ op: "upgrade_document" }] });
        expect(upgradeEnvelope(kind, s.envelope, 2).envelope, s.name).toEqual(viaConnector);
      }
    }
  });

  it("refuses unknown versions and reports the steps it took", () => {
    const v1 = saved("bar-model").find((s) => schemaVersionOf(s.envelope) === 1)!.envelope;
    const r = upgradeEnvelope("bar-model", v1, 3);
    expect(r.steps.map((s) => [s.from, s.to])).toEqual([
      [1, 2],
      [2, 3],
    ]);
    expect(schemaVersionOf(r.envelope)).toBe(3);
    expect(() => upgradeEnvelope("bar-model", v1, 4)).toThrow(/no schema 4/);
    expect(() => upgradeEnvelope("graph", { schemaVersion: 7 }, 1)).toThrow(/unknown schema version/);
    expect(versionTable().find((v) => v.kind === "bar-model")?.upgrades).toHaveLength(2);
  });
});
