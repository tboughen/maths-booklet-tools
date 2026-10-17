import { build } from "esbuild";
import { Resvg } from "@resvg/resvg-js";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

// Reproducible examples and overview artwork from the actual export renderer.
// No service, network request or source question reconstruction is used.
const folder = "tmp/diagram-consumption/algebra-grid";
mkdirSync(folder, { recursive: true });
const bundle = resolve(folder, "core.mjs");
await build({ entryPoints: ["packages/algebra-grid-core/src/index.ts"], outfile: bundle, bundle: true, platform: "node", format: "esm" });
const { canonical, example, renderSvg, parseFile } = await import(pathToFileURL(bundle).href);
const fonts = ["STIXTwoText-Regular.otf", "STIXTwoText-Italic.otf", "STIXTwoMath-Regular.otf"].map(name => resolve("assets/graph-fonts", name));
mkdirSync("docs/algebra-grid-examples", { recursive: true });
for (const name of ["single", "double", "signed", "cubic", "factor", "negative", "common", "source-expand", "source-factor"]) {
  for (const worked of [false, true]) {
    const e = example(name, worked), text = canonical(e);
    parseFile(text);
    writeFileSync(`docs/algebra-grid-examples/${name}${worked ? "-worked" : ""}.json`, text + "\n");
    const svg = new Resvg(renderSvg(e), { font: { fontFiles: fonts, loadSystemFonts: false } }).toString();
    writeFileSync(`${folder}/${name}${worked ? "-worked" : ""}.svg`, svg);
    if (name === "double" && !worked) writeFileSync("src/assets/tool-previews/expanding-factorising.svg", svg);
  }
}
console.log("Saved 18 reopenable examples and outlined vector controls; overview uses the actual pupil scaffold.");
