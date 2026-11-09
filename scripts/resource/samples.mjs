// Renders the golden worksheets to SVG pages and vector PDFs for review.
// Usage: node scripts/resource/samples.mjs [outDir]
// Bundles the TypeScript renderer with esbuild, then writes each PDF with the same writer the MCP
// service uses (services/graph-mcp/worksheet-pdf.ts: PDFKit, vector text with embedded fonts).
import { build } from "esbuild";
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const root = resolve(import.meta.dirname, "../..");
const out = resolve(process.argv[2] ?? join(root, "output/resource-samples"));
await mkdir(out, { recursive: true });
const bundle = join(out, "renderer.mjs");
await build({
  stdin: {
    contents: [
      `export * from "./packages/resource-core/src/index";`,
      `export { comparativeBarCharts, treeDiagrams } from "./packages/resource-core/src/fixtures";`,
      `export { worksheetPdf } from "./services/graph-mcp/worksheet-pdf";`,
    ].join("\n"),
    resolveDir: root,
    loader: "ts",
  },
  bundle: true,
  format: "esm",
  platform: "node",
  packages: "external",
  outfile: bundle,
  logLevel: "warning",
});
const r = await import(pathToFileURL(bundle).href);
const fonts = { text: join(root, "assets/resource-fonts"), diagrams: join(root, "assets/graph-fonts") };

const report = [];
for (const [id, doc] of [["comparative-bar-charts", r.comparativeBarCharts], ["tree-diagrams", r.treeDiagrams]])
  for (const style of Object.keys(r.styles))
    for (const view of ["pupil", "answers"]) {
      const { pages, issues } = r.renderResource(doc, { style, view });
      const name = `${id}_${style}${view === "answers" ? "_answers" : ""}`;
      for (const [i, svg] of pages.entries()) await writeFile(join(out, `${name}_side${i + 1}.svg`), svg);
      await writeFile(join(out, `${name}.pdf`), await r.worksheetPdf(pages, doc.document.title, fonts));
      report.push({ name, file: r.fileName(doc, view), issues });
    }
await writeFile(join(out, "report.json"), JSON.stringify(report, null, 2));
for (const x of report) console.log(`${x.name}: ${x.issues.length ? x.issues.map((i) => i.message).join(" | ") : "no layout issues"}`);
