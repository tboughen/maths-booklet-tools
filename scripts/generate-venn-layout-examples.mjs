import { build } from "esbuild";
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

// Separate from the existing card/schema-1 generator: old fixtures stay intact.
await build({
  stdin: {
    contents:
      'export * from "./packages/venn-core/src/index.ts"; export {teachingExamples} from "./packages/venn-core/src/examples.ts";',
    resolveDir: process.cwd(),
  },
  bundle: true,
  platform: "node",
  format: "cjs",
  outfile: "node_modules/.tmp/venn-layout-generator.cjs",
});
const { teachingExamples, canonical, parseFile, exportIssue, forView } =
  createRequire(import.meta.url)(
    resolve("node_modules/.tmp/venn-layout-generator.cjs"),
  );
mkdirSync("docs/venn-layout-examples", { recursive: true });
for (const ex of teachingExamples)
  for (const worked of [false, true]) {
    const text = canonical(ex.make(worked)),
      e = parseFile(text);
    for (const view of ["pupil", "answer"]) {
      const issue = exportIssue(forView(e, view));
      if (issue) throw Error(`${ex.id}/${worked}/${view}: ${issue}`);
    }
    writeFileSync(
      `docs/venn-layout-examples/${ex.id}-${worked ? "worked" : "scaffold"}.json`,
      text + "\n",
    );
  }
console.log(
  "Generated 10 reopened schema-2 teaching examples; pupil and answer outputs fit.",
);
