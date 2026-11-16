// Generates the All tools card preview from a saved algebra tiles example (docs/tools/TOOL-CARD-PREVIEWS.md).
import { build } from "esbuild";
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { Resvg } from "@resvg/resvg-js";
import { resolve } from "node:path";
await build({
  stdin: {
    contents:
      'export * from "./packages/algebra-tile-core/src/index.ts"; export {examples} from "./packages/algebra-tile-core/src/examples.ts";',
    resolveDir: process.cwd(),
  },
  bundle: true,
  platform: "node",
  format: "cjs",
  outfile: "node_modules/.tmp/algebra-tiles-generator.cjs",
});
const { examples, canonical, parseFile, exportIssue, renderSvg } = createRequire(import.meta.url)(
  resolve("node_modules/.tmp/algebra-tiles-generator.cjs"),
);
// a²b and ab² blocks as pupils see them, with the simplified answer left for pupils.
const e = examples.find((x) => x.id === "a2b-ab2").make(false);
if (exportIssue(e)) throw Error(exportIssue(e));
mkdirSync("docs/tool-card-preview-examples", { recursive: true });
writeFileSync("docs/tool-card-preview-examples/algebra-tiles.json", canonical(e) + "\n");
const svg = renderSvg(parseFile(canonical(e)));
const outlined = new Resvg(svg, {
  font: {
    fontFiles: ["STIXTwoText-Regular.otf", "STIXTwoText-Italic.otf", "STIXTwoMath-Regular.otf"].map((n) =>
      resolve("assets/graph-fonts", n),
    ),
    loadSystemFonts: false,
  },
}).toString();
writeFileSync("src/assets/tool-previews/algebra-tiles.svg", outlined);
console.log("Generated the outlined algebra tiles card from the reopened saved example.");
