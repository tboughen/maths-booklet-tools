// Generates the All tools card preview from a saved frequency tree example (docs/tools/TOOL-CARD-PREVIEWS.md).
import { build } from "esbuild";
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { Resvg } from "@resvg/resvg-js";
import { resolve } from "node:path";
await build({
  stdin: {
    contents:
      'export * from "./packages/frequency-tree-core/src/index.ts"; export {examples} from "./packages/frequency-tree-core/src/examples.ts";',
    resolveDir: process.cwd(),
  },
  bundle: true,
  platform: "node",
  format: "cjs",
  outfile: "node_modules/.tmp/frequency-tree-generator.cjs",
});
const { examples, canonical, parseFile, exportIssue, renderSvg } = createRequire(import.meta.url)(
  resolve("node_modules/.tmp/frequency-tree-generator.cjs"),
);
// The coffee tree with the men's counts filled in and the women's left for pupils; no question.
const e = examples.find((x) => x.id === "coffee").make(false);
e.document.questions = [];
for (const b of e.document.nodes) if (b.id === "n1" || b.parent === "n1") b.count.show = "show";
if (exportIssue(e)) throw Error(exportIssue(e));
mkdirSync("docs/tool-card-preview-examples", { recursive: true });
writeFileSync("docs/tool-card-preview-examples/frequency-trees.json", canonical(e) + "\n");
const svg = renderSvg(parseFile(canonical(e)));
const outlined = new Resvg(svg, {
  font: {
    fontFiles: ["STIXTwoText-Regular.otf", "STIXTwoText-Italic.otf", "STIXTwoMath-Regular.otf"].map((n) =>
      resolve("assets/graph-fonts", n),
    ),
    loadSystemFonts: false,
  },
}).toString();
writeFileSync("src/assets/tool-previews/frequency-trees.svg", outlined);
console.log("Generated the outlined frequency tree card from the reopened saved example.");
