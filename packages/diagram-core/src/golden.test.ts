// @vitest-environment node
/// <reference types="vite/client" />
/**
 * Golden corpus: every saved envelope in packages/envelope-core/fixtures/corpus must still read,
 * keep its exact contentHash and draw byte-identical pupil and answer artwork. Teachers hold
 * these files and links, and a model holds contentHashes between turns, so any change here is a
 * compatibility change that needs a deliberate, reviewed update of golden.json:
 *
 *   UPDATE_GOLDEN=1 npx vitest run packages/diagram-core/src/golden.test.ts
 *
 * Never regenerate to make a failure go away without saying which files changed and why.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DIAGRAM_KINDS, FAMILIES, type DiagramKind } from "./registry";
// Imported only so the affected-only PR checks (`vitest --changed`) run this test when golden.json
// or a corpus file changes: they follow imports, and the files themselves are read with fs below.
import "../../envelope-core/fixtures/golden.json";
import.meta.glob("../../envelope-core/fixtures/corpus/**/*.json", { eager: true });

const corpus = join(__dirname, "../../envelope-core/fixtures/corpus");
const goldenFile = join(__dirname, "../../envelope-core/fixtures/golden.json");
type Golden = { schemaVersion: unknown; contentHash: string; pupilSvg: string; answerSvg?: string };
const sha = (text: string) => createHash("sha256").update(text).digest("hex");

function entries() {
  return DIAGRAM_KINDS.flatMap((kind) =>
    (existsSync(join(corpus, kind)) ? readdirSync(join(corpus, kind)) : [])
      .filter((f) => f.endsWith(".json"))
      .sort()
      .map((file) => ({ kind, id: `${kind}/${file.replace(/\.json$/, "")}`, raw: JSON.parse(readFileSync(join(corpus, kind, file), "utf8")) as Record<string, unknown> })),
  );
}
async function measure(kind: DiagramKind, raw: unknown): Promise<Golden> {
  const f = FAMILIES[kind];
  const envelope = f.validate(raw, "pupil");
  return {
    schemaVersion: (raw as { schemaVersion?: unknown }).schemaVersion,
    contentHash: await f.hash(envelope),
    pupilSvg: sha(f.svg(envelope, "pupil")),
    ...(f.answerView ? { answerSvg: sha(f.svg(envelope, "answer")) } : {}),
  };
}

describe("saved-envelope golden corpus", () => {
  const all = entries();
  it("covers every family", () => {
    for (const kind of DIAGRAM_KINDS) expect(all.some((e) => e.kind === kind), kind).toBe(true);
  });
  if (process.env.UPDATE_GOLDEN) {
    it("rewrites golden.json", async () => {
      const out: Record<string, Golden> = {};
      for (const e of all) out[e.id] = await measure(e.kind, e.raw);
      writeFileSync(goldenFile, JSON.stringify(out, null, 1) + "\n");
    });
    return;
  }
  const golden = JSON.parse(readFileSync(goldenFile, "utf8")) as Record<string, Golden>;
  it("has a golden record for every corpus file and no stale records", () => {
    expect(Object.keys(golden).sort()).toEqual(all.map((e) => e.id).sort());
  });
  for (const e of all)
    it(`${e.id} keeps its hash and artwork`, async () => {
      expect(await measure(e.kind, e.raw)).toEqual(golden[e.id]);
    });
});
