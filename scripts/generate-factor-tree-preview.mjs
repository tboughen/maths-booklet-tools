// Generates the All tools card preview from a saved factor tree example (docs/tools/TOOL-CARD-PREVIEWS.md).
import { build } from "esbuild";
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { Resvg } from "@resvg/resvg-js";
import { resolve } from "node:path";
await build({
  stdin: {
    contents:
      'export * from "./packages/factor-tree-core/src/index.ts"; export {examples} from "./packages/factor-tree-core/src/examples.ts";',
    resolveDir: process.cwd(),
  },
  bundle: true,
  platform: "node",
  format: "cjs",
  outfile: "node_modules/.tmp/factor-tree-generator.cjs",
});
const { examples, canonical, parseFile, exportIssue, renderSvg } = createRequire(import.meta.url)(
  resolve("node_modules/.tmp/factor-tree-generator.cjs"),
);
// The 360 tree as pupils see it: the first split given, the rest left for pupils.
const e = examples.find((x) => x.id === "complete-360").make(false);
if (exportIssue(e)) throw Error(exportIssue(e));
mkdirSync("docs/tool-card-preview-examples", { recursive: true });
writeFileSync("docs/tool-card-preview-examples/factor-trees.json", canonical(e) + "\n");
const svg = renderSvg(parseFile(canonical(e)));
const outlined = new Resvg(svg, {
  font: {
    fontFiles: ["STIXTwoText-Regular.otf", "STIXTwoText-Italic.otf", "STIXTwoMath-Regular.otf"].map((n) =>
      resolve("assets/graph-fonts", n),
    ),
    loadSystemFonts: false,
  },
}).toString();
writeFileSync("src/assets/tool-previews/factor-trees.svg", outlined);
console.log("Generated the outlined factor tree card from the reopened saved example.");
