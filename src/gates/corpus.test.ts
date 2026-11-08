// Saved-file corpus gate (improvement list L17). Teachers keep editable files for years, so every
// file saved by an earlier version must still open. src/gates/corpus/<date>/<tool>/ holds the
// editable files of every example as they were saved on that date, and is never edited. Each one
// must load through today's parser with nothing lost or changed, save again and reload the same,
// and survive its link where the tool has one.
//
// A deliberate upgrade (a schema change that rewrites old files on load) is listed in
// corpus/UPGRADES.json, file by file, with the reason and Tim's approval. A listed file must still
// load and then save stably, but may differ from what was saved.
//
// Freeze today's examples as a new dated corpus with WRITE_CORPUS=YYYY-MM-DD npx vitest run
// src/gates/corpus.test.ts. It refuses to overwrite a date that exists.
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { tools } from "./saved-files";

const root = "src/gates/corpus"; // vitest runs from the repository root
const upgrades: Record<string, { reason: string; approvedBy: string }> =
  JSON.parse(readFileSync(join(root, "UPGRADES.json"), "utf8"));
const slug = (name: string) => name.replace(/\s+/g, "-");
const byFolder = new Map(tools.map((t) => [slug(t.name), t]));

// Key order is not part of a saved file's meaning.
const sorted = (v: unknown): unknown =>
  Array.isArray(v)
    ? v.map(sorted)
    : v && typeof v === "object"
      ? Object.fromEntries(
          Object.keys(v)
            .sort()
            .map((k) => [k, sorted((v as Record<string, unknown>)[k])]),
        )
      : v;
const canonical = (v: unknown) => JSON.stringify(sorted(v));

const writing = process.env.WRITE_CORPUS;
if (writing) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(writing))
    throw Error("WRITE_CORPUS must be a date, YYYY-MM-DD.");
  const folder = join(root, writing);
  if (existsSync(folder))
    throw Error(`${folder} exists; a dated corpus is never rewritten.`);
  for (const tool of tools) {
    mkdirSync(join(folder, slug(tool.name)), { recursive: true });
    tool
      .envelopes()
      .forEach((raw, i) =>
        writeFileSync(
          join(
            folder,
            slug(tool.name),
            `${String(i + 1).padStart(3, "0")}.json`,
          ),
          JSON.stringify(tool.validate(raw), null, 2) + "\n",
        ),
      );
  }
}

const dates = readdirSync(root)
  .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
  .sort();

describe("saved-file corpus", () => {
  it("has a dated corpus and lists only files that exist as upgrades", () => {
    expect(dates.length).toBeGreaterThan(0);
    expect(
      Object.keys(upgrades).filter((p) => !existsSync(join(root, p))),
    ).toEqual([]);
    for (const u of Object.values(upgrades))
      expect(u.reason && u.approvedBy).toBeTruthy();
  });

  for (const date of dates)
    for (const folder of readdirSync(join(root, date)).sort())
      it(`${date}: ${folder}`, () => {
        const tool = byFolder.get(folder);
        expect(tool, `no tool for corpus folder ${folder}`).toBeDefined();
        const files = readdirSync(join(root, date, folder))
          .filter((f) => f.endsWith(".json"))
          .sort();
        expect(files.length).toBeGreaterThan(0);
        const problems: string[] = [];
        for (const file of files) {
          const path = `${date}/${folder}/${file}`,
            text = readFileSync(join(root, path), "utf8");
          let loaded: unknown;
          try {
            loaded = tool!.parseFile(text);
          } catch (error) {
            problems.push(
              `${path}: does not open (${(error as Error).message})`,
            );
            continue;
          }
          if (
            !(path in upgrades) &&
            canonical(loaded) !== canonical(JSON.parse(text))
          )
            problems.push(`${path}: changed on load`);
          if (
            canonical(tool!.parseFile(JSON.stringify(loaded))) !==
            canonical(loaded)
          )
            problems.push(`${path}: changes when saved again`);
          if (
            tool!.link &&
            canonical(tool!.link.decode(tool!.link.encode(loaded as never))) !==
              canonical(loaded)
          )
            problems.push(`${path}: changes through its link`);
        }
        expect(problems).toEqual([]);
      });
});
