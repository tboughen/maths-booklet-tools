import { build } from "esbuild";
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { Resvg } from "@resvg/resvg-js";
import { resolve } from "node:path";
await build({
  stdin: {
    contents:
      'export * from "./packages/venn-core/src/index.ts"; export {examples} from "./packages/venn-core/src/examples.ts";',
    resolveDir: process.cwd(),
  },
  bundle: true,
  platform: "node",
  format: "cjs",
  outfile: "node_modules/.tmp/venn-generator.cjs",
});
const { examples, canonical, parseFile, exportIssue, renderSvg } =
  createRequire(import.meta.url)(
    resolve("node_modules/.tmp/venn-generator.cjs"),
  );
const e = examples.find((x) => x.id === "2019").make(true);
e.document.showDefinitions = false;
e.document.regions[2].visibility = "line";
if (exportIssue(e)) throw Error(exportIssue(e));
mkdirSync("docs/venn-examples", { recursive: true });
writeFileSync("docs/venn-examples/card.json", canonical(e) + "\n");
const svg = renderSvg(parseFile(canonical(e)));
const outlined = new Resvg(svg, {
  font: {
    fontFiles: [
      "STIXTwoText-Regular.otf",
      "STIXTwoText-Italic.otf",
      "STIXTwoMath-Regular.otf",
    ].map((n) => resolve("assets/graph-fonts", n)),
    loadSystemFonts: false,
  },
}).toString();
writeFileSync("src/assets/tool-previews/venn.svg", outlined);
for (const ex of examples)
  for (const worked of [false, true]) {
    const value = ex.make(worked);
    const issue = exportIssue(value);
    if (issue) throw Error(`${ex.id}/${worked}: ${issue}`);
    writeFileSync(
      `docs/venn-examples/${ex.id}-${worked ? "worked" : "scaffold"}.json`,
      canonical(value) + "\n",
    );
  }
console.log(
  "Generated outlined Venn card from reopened saved example; all 14 example exports fit.",
);
