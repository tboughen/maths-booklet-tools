// Generates the All tools card previews for constructions and plans and elevations from saved
// examples (docs/tools/TOOL-CARD-PREVIEWS.md).
import { build } from "esbuild";
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { Resvg } from "@resvg/resvg-js";
import { resolve } from "node:path";
await build({
  stdin: {
    contents: [
      'export * as construction from "./packages/construction-core/src/index.ts";',
      'export { examples as constructionExamples } from "./packages/construction-core/src/examples.ts";',
      'export * as elevations from "./packages/elevation-core/src/index.ts";',
      'export { examples as elevationExamples } from "./packages/elevation-core/src/examples.ts";',
    ].join("\n"),
    resolveDir: process.cwd(),
  },
  bundle: true,
  platform: "node",
  format: "cjs",
  outfile: "node_modules/.tmp/gm8-preview-generator.cjs",
});
const m = createRequire(import.meta.url)(resolve("node_modules/.tmp/gm8-preview-generator.cjs"));
const outline = (svg) =>
  new Resvg(svg, {
    font: {
      fontFiles: ["STIXTwoText-Regular.otf", "STIXTwoText-Italic.otf", "STIXTwoMath-Regular.otf"].map((n) => resolve("assets/graph-fonts", n)),
      loadSystemFonts: false,
    },
  }).toString();
mkdirSync("docs/tool-card-preview-examples", { recursive: true });
// The perpendicular bisector worked example: the line, both pairs of compass arcs and the bisector.
const c = m.constructionExamples.find((x) => x.id === "perpendicular-bisector").make(true);
if (m.construction.exportIssue(c)) throw Error(m.construction.exportIssue(c));
writeFileSync("docs/tool-card-preview-examples/constructions.json", m.construction.canonical(c) + "\n");
writeFileSync("src/assets/tool-previews/constructions.svg", outline(m.construction.renderSvg(m.construction.parseFile(m.construction.canonical(c)))));
// The draw-the-views example: an isometric solid with its plan, front and side left for pupils.
// A narrower row puts the views on two rows, so the card preview is nearly square.
const v = m.elevationExamples.find((x) => x.id === "draw-views").make(false);
v.document.maxWidthCm = 16;
if (m.elevations.exportIssue(v)) throw Error(m.elevations.exportIssue(v));
writeFileSync("docs/tool-card-preview-examples/plans-and-elevations.json", m.elevations.canonical(v) + "\n");
writeFileSync("src/assets/tool-previews/plans-and-elevations.svg", outline(m.elevations.renderSvg(m.elevations.parseFile(m.elevations.canonical(v)))));
console.log("Generated the outlined construction and plans-and-elevations cards from reopened saved examples.");
