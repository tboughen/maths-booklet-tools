// Renders the golden worksheets to SVG pages and vector PDFs for review.
// Usage: node scripts/resource/samples.mjs [outDir]
// Bundles the TypeScript renderer with esbuild, then prints the pages with Chromium (Playwright),
// which keeps text and lines as vectors and embeds the fonts.
import { build } from "esbuild";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const root = resolve(import.meta.dirname, "../..");
const out = resolve(process.argv[2] ?? join(root, "output/resource-samples"));
await mkdir(out, { recursive: true });
const bundle = join(out, "renderer.mjs");
await build({
  stdin: {
    contents: `export * from "./packages/resource-core/src/index"; export { comparativeBarCharts, treeDiagrams } from "./packages/resource-core/src/fixtures";`,
    resolveDir: root,
    loader: "ts",
  },
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: bundle,
  logLevel: "warning",
});
const r = await import(pathToFileURL(bundle).href);

const font = async (file, family, weight, style) =>
  `@font-face{font-family:"${family}";src:url(data:font/${file.endsWith(".otf") ? "otf" : "woff2"};base64,${(await readFile(join(root, file))).toString("base64")});font-weight:${weight};font-style:${style}}`;
const css = (
  await Promise.all([
    font("assets/resource-fonts/Lato-Regular.woff2", "Lato", 400, "normal"),
    font("assets/resource-fonts/Lato-Bold.woff2", "Lato", 700, "normal"),
    font("assets/resource-fonts/Lato-Italic.woff2", "Lato", 400, "italic"),
    font("assets/graph-fonts/STIXTwoText-Regular.otf", "STIX Two Text", 400, "normal"),
    font("assets/graph-fonts/STIXTwoText-Italic.otf", "STIX Two Text", 400, "italic"),
    font("assets/graph-fonts/STIXTwoMath-Regular.otf", "STIX Two Math", 400, "normal"),
  ])
).join("");

const { chromium } = await import("playwright");
const browser = await chromium.launch();
const page = await browser.newPage();
const report = [];
for (const [id, doc] of [["comparative-bar-charts", r.comparativeBarCharts], ["tree-diagrams", r.treeDiagrams]])
  for (const style of ["cards", "lines"])
    for (const view of ["pupil", "answers"]) {
      const { pages, issues } = r.renderResource(doc, { style, view });
      const name = `${id}_${style}${view === "answers" ? "_answers" : ""}`;
      for (const [i, svg] of pages.entries()) await writeFile(join(out, `${name}_side${i + 1}.svg`), svg);
      const html = `<!doctype html><html><head><meta charset="utf-8"><style>${css}@page{size:420mm 297mm;margin:0}html,body{margin:0}svg{display:block;width:420mm;height:297mm;page-break-after:always}</style></head><body>${pages.join("")}</body></html>`;
      await page.setContent(html, { waitUntil: "load" });
      await page.evaluate(() => globalThis.document.fonts.ready);
      await page.pdf({ path: join(out, `${name}.pdf`), width: "420mm", height: "297mm", printBackground: true, preferCSSPageSize: true });
      report.push({ name, file: r.fileName(doc, view), issues });
    }
await browser.close();
await writeFile(join(out, "report.json"), JSON.stringify(report, null, 2));
for (const x of report) console.log(`${x.name}: ${x.issues.length ? x.issues.map((i) => i.message).join(" | ") : "no layout issues"}`);
