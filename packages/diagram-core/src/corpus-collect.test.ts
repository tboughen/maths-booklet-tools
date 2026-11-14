// @vitest-environment node
/**
 * One-off collector for the saved-envelope corpus in packages/envelope-core/fixtures/corpus.
 * Run with COLLECT_CORPUS=1 to (re)gather the families' defaults, examples and historical
 * fixtures; it never deletes a file that is already in the corpus, because the corpus is a
 * record of files teachers may hold. Skipped in normal runs.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { it } from "vitest";
import { DIAGRAM_KINDS, FAMILIES, type DiagramKind } from "./registry";
import { examples as chartExamples } from "../../chart-core/src/examples";
import { examples as cuboidExamples } from "../../cuboid-core/src/examples";
import { examples as ftreeExamples } from "../../frequency-tree-core/src/examples";
import { examples as ptreeExamples } from "../../probability-tree-core/src/examples";
import { examples as vennExamples, teachingExamples as vennTeaching } from "../../venn-core/src/examples";
import { examples as triangleExamples } from "../../triangle-core/src/examples";
import { examples as constructionExamples } from "../../construction-core/src/examples";
import { examples as elevationExamples } from "../../elevation-core/src/examples";
import { examples as lineExamples, example as lineExample } from "../../number-line-core/src/examples";
import { lessonExample as barV2, lessonExampleNames } from "../../bar-model-core/src/lesson-examples";
import { lessonExample as barV3 } from "../../bar-model-core/src/lesson-examples-v3";
import { starterRatioTable } from "../../ratio-table-core/src/interchange";
import { example as barV1 } from "../../bar-model-core/src/index";
import { createGraph } from "../../graph-core/src/interchange";

const root = join(__dirname, "../../..");
const out = join(root, "packages/envelope-core/fixtures/corpus");

/** Every object nested up to three levels deep that looks like a saved envelope. */
function candidates(value: unknown, depth = 0): unknown[] {
  if (depth > 3 || value === null || typeof value !== "object") return [];
  if (Array.isArray(value)) return value.flatMap((v) => candidates(v, depth + 1));
  if ("schemaVersion" in value && "document" in value) return [value];
  return Object.values(value).flatMap((v) => candidates(v, depth + 1));
}
function jsonFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? jsonFiles(join(dir, d.name)) : d.name.endsWith(".json") ? [join(dir, d.name)] : []));
}
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);

it.skipIf(!process.env.COLLECT_CORPUS)("collects the saved-envelope corpus", () => {
  const found: { kind: DiagramKind; name: string; envelope: unknown }[] = [];
  const add = (kind: DiagramKind, name: string, make: () => unknown) => {
    try {
      found.push({ kind, name, envelope: make() });
    } catch (error) {
      console.warn(`skip ${kind}/${name}: ${(error as Error).message}`);
    }
  };
  for (const kind of DIAGRAM_KINDS) add(kind, "default", () => FAMILIES[kind].create({}));
  for (const [kind, list] of [["charts", chartExamples], ["frequency-tree", ftreeExamples], ["construction", constructionExamples], ["elevations", elevationExamples], ["probability-tree", ptreeExamples], ["venn", [...vennExamples, ...vennTeaching]]] as const)
    for (const x of list as { id: string; make: (w: boolean) => unknown }[]) for (const w of [false, true]) add(kind, `example-${slug(x.id)}${w ? "-worked" : ""}`, () => x.make(w));
  for (const x of cuboidExamples) for (const w of [false, true]) add("cuboids", `example-${slug(x.id)}${w ? "-worked" : ""}`, () => x.create(w));
  for (const x of triangleExamples) add("triangle", `example-${slug(x.key)}`, () => x.build());
  lineExamples.forEach((x, i) => {
    for (const w of [false, true]) add("number-line", `example-${slug(x.part)}-${slug(x.id)}${w ? "-worked" : ""}`, () => lineExample(i, w));
  });
  for (const name of lessonExampleNames)
    for (const w of [false, true]) {
      add("bar-model", `v2-lesson-${slug(name)}${w ? "-worked" : ""}`, () => barV2(name, w));
      add("bar-model", `v3-lesson-${slug(name)}${w ? "-worked" : ""}`, () => barV3(name, w));
    }
  for (const name of ["BM01", "BM02", "BM03", "BM04", "BM05", "BM06", "BM07", "BM08", "BM09", "H07"])
    for (const w of [false, true]) add("bar-model", `v1-legacy-${slug(name)}${w ? "-worked" : ""}`, () => barV1(name, w));
  add("ratio-table", "starter", () => starterRatioTable());
  add("graph", "blank", () => createGraph({ objects: [] }));
  add("graph", "print-consumption", () => createGraph(JSON.parse(readFileSync(join(root, "services/graph-mcp/fixtures/print-consumption/graph.json"), "utf8"))));
  add("graph", "named-line-and-points", () =>
    createGraph({
      axes: { x: { negativeSquares: 5, positiveSquares: 5, unitsPerSquare: 1 }, y: { negativeSquares: 5, positiveSquares: 5, unitsPerSquare: 1 } },
      objects: [
        { kind: "line", id: "l1", equation: { kind: "slope", slope: "1/2", intercept: "-1" }, equationVisible: false },
        { kind: "point", id: "a", position: { x: "2", y: "3" }, name: "A" },
        { kind: "point", id: "b", position: { x: "-3", y: "-1/2" }, name: "B" },
      ],
    }));
  // Saved files kept elsewhere in the repository, including historical schema versions.
  const dirs = ["docs", "packages", "services/graph-mcp/fixtures"].map((d) => join(root, d));
  for (const file of dirs.flatMap(jsonFiles)) {
    if (file.includes("envelope-core/fixtures") || file.includes("node_modules")) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(readFileSync(file, "utf8"));
    } catch {
      continue;
    }
    const base = slug(file.slice(root.length + 1).replace(/\.json$/, "").replace(/^(docs|packages|services\/graph-mcp)\//, ""));
    candidates(parsed).forEach((raw, i, all) => {
      for (const kind of DIAGRAM_KINDS) {
        try {
          FAMILIES[kind].validate(raw, "pupil");
        } catch {
          continue;
        }
        found.push({ kind, name: `file-${base}${all.length > 1 ? `-${i + 1}` : ""}`, envelope: raw });
        break;
      }
    });
  }
  const seen = new Set<string>();
  let written = 0;
  for (const { kind, name, envelope } of found) {
    const body = JSON.stringify(envelope);
    const key = `${kind}:${body}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const dir = join(out, kind);
    mkdirSync(dir, { recursive: true });
    const path = join(dir, `${name}.json`);
    if (existsSync(path)) continue;
    writeFileSync(path, JSON.stringify(envelope, null, 1) + "\n");
    written++;
  }
  console.log(`corpus: ${written} new files, ${seen.size} distinct envelopes`);
});
