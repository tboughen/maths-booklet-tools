// Generates the All tools card preview from a saved 3D solids example (docs/tools/TOOL-CARD-PREVIEWS.md).
import { build } from "esbuild";
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { Resvg } from "@resvg/resvg-js";
import { resolve } from "node:path";
await build({
  stdin: {
    contents:
      'export * from "./packages/solid-core/src/index.ts"; export {examples} from "./packages/solid-core/src/examples.ts";',
    resolveDir: process.cwd(),
  },
  bundle: true,
  platform: "node",
  format: "cjs",
  outfile: "node_modules/.tmp/solids-generator.cjs",
});
const { examples, canonical, parseFile, exportIssue, renderSvg } = createRequire(import.meta.url)(
  resolve("node_modules/.tmp/solids-generator.cjs"),
);
// The cylinder tank as pupils see it: its diameter and height on arrows.
const e = examples.find((x) => x.id === "cylinder-tank").make(false);
if (exportIssue(e)) throw Error(exportIssue(e));
mkdirSync("docs/tool-card-preview-examples", { recursive: true });
writeFileSync("docs/tool-card-preview-examples/3d-solids.json", canonical(e) + "\n");
const svg = renderSvg(parseFile(canonical(e)));
const outlined = new Resvg(svg, {
  font: {
    fontFiles: ["STIXTwoText-Regular.otf", "STIXTwoText-Italic.otf", "STIXTwoMath-Regular.otf"].map((n) =>
      resolve("assets/graph-fonts", n),
    ),
    loadSystemFonts: false,
  },
}).toString();
writeFileSync("src/assets/tool-previews/3d-solids.svg", outlined);
console.log("Generated the outlined 3D solids card from the reopened saved example.");
