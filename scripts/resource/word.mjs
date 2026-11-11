// Writes the pupil and answers Word files for a worksheet, and (with --preview) LibreOffice page
// images for checking. Word is the deliverable; the preview is only for looking at the layout.
//
// Usage:
//   node scripts/resource/word.mjs [worksheet.json ...] [--out dir] [--preview] [--no-system-inter]
// With no worksheet files, the golden fixtures are written. --no-system-inter runs LibreOffice
// with a font set that leaves out any installed Inter, so the preview proves the embedded fonts.
import { build } from "esbuild";
import { execFileSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const root = resolve(import.meta.dirname, "../..");
const args = process.argv.slice(2);
const flag = (f) => args.includes(f);
const outAt = args.indexOf("--out");
const out = resolve(outAt >= 0 ? args[outAt + 1] : join(root, "output/resource-word"));
const inputs = args.filter((a, i) => !a.startsWith("--") && !(outAt >= 0 && i === outAt + 1));
await mkdir(out, { recursive: true });

// The bundle sits inside the repository so its package imports resolve from node_modules.
await mkdir(join(root, "output/resource-word"), { recursive: true });
const bundle = join(root, "output/resource-word/word-renderer.mjs");
await build({
  stdin: {
    contents: [
      `export * from "./packages/resource-core/src/index";`,
      `export { comparativeBarCharts, treeDiagrams } from "./packages/resource-core/src/fixtures";`,
      `export { worksheetDocx } from "./services/graph-mcp/worksheet-docx";`,
      `export { docxFileName } from "./packages/resource-core/src/docx";`,
      `export { wordSample } from "./packages/resource-core/src/word-sample";`,
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
const roots = { text: join(root, "assets/resource-fonts"), diagrams: join(root, "assets/graph-fonts") };

const sheets = inputs.length
  ? await Promise.all(inputs.map(async (f) => [basename(f, ".json"), r.validate(JSON.parse(await readFile(f, "utf8")))]))
  : [
      ["comparative-bar-charts", r.comparativeBarCharts],
      ["tree-diagrams", r.treeDiagrams],
      ["word-rendering-test", r.wordSample],
    ];

// LibreOffice preview, optionally without any installed Inter (to prove the embedded fonts work).
let fontEnv = {};
if (flag("--no-system-inter")) {
  const conf = join(out, "fonts-no-inter.conf");
  await writeFile(
    conf,
    `<?xml version="1.0"?><!DOCTYPE fontconfig SYSTEM "fonts.dtd"><fontconfig>` +
      `<dir>/usr/share/fonts/truetype</dir><cachedir>${join(out, "fc-cache")}</cachedir>` +
      `<selectfont><rejectfont><glob>*/inter/*</glob><glob>*Inter*</glob></rejectfont></selectfont></fontconfig>`,
  );
  fontEnv = { FONTCONFIG_FILE: conf };
}
const preview = (file) => {
  const env = { ...process.env, ...fontEnv };
  execFileSync("soffice", [`-env:UserInstallation=file://${join(out, "lo-profile")}`, "--headless", "--convert-to", "pdf", "--outdir", out, file], { env, stdio: "ignore" });
  const pdf = file.replace(/\.docx$/, ".pdf");
  if (!existsSync(pdf)) throw Error(`LibreOffice did not convert ${file}`);
  const pages = Number(execFileSync("pdfinfo", [pdf]).toString().match(/Pages:\s+(\d+)/)?.[1]);
  const fonts = execFileSync("pdffonts", [pdf]).toString().split("\n").slice(2).filter(Boolean).map((l) => l.split(/\s+/)[0]);
  const stem = pdf.replace(/\.pdf$/, "");
  for (let i = 1; i <= 9; i++) rmSync(`${stem}-${i}.png`, { force: true });
  execFileSync("pdftoppm", ["-r", "60", "-png", pdf, stem]);
  return { pages, fonts: [...new Set(fonts.map((f) => f.replace(/^[A-Z]{6}\+/, "")))] };
};

const report = [];
for (const [id, doc] of sheets)
  for (const view of ["pupil", "answers"]) {
    const { bytes, issues } = await r.worksheetDocx(doc, view, roots, "MathsDock worksheet renderer, Word output 1");
    const name = r.docxFileName(r.fileName(doc, view));
    const file = join(out, `${id}${view === "answers" ? "_answers" : ""}.docx`);
    await writeFile(file, bytes);
    const entry = { id, view, file, name, bytes: bytes.length, issues: issues.map((i) => `side ${i.side} column ${i.column}: ${i.message}`) };
    if (flag("--preview")) {
      entry.preview = preview(file);
      // The same sheet from the PDF writer, for side-by-side comparison with the Word preview.
      const pdf = join(out, `${id}${view === "answers" ? "_answers" : ""}_renderer.pdf`);
      await writeFile(pdf, await r.worksheetPdf(r.renderResource(doc, { view }).pages, doc.document.title, roots));
      const stem = pdf.replace(/\.pdf$/, "");
      for (let i = 1; i <= 9; i++) rmSync(`${stem}-${i}.png`, { force: true });
      execFileSync("pdftoppm", ["-r", "60", "-png", pdf, stem]);
    }
    report.push(entry);
  }
await writeFile(join(out, "word-report.json"), JSON.stringify(report, null, 2));
for (const e of report)
  console.log(`${basename(e.file)}: ${e.bytes} bytes; ${e.issues.length ? e.issues.join(" | ") : "no layout issues"}${e.preview ? `; LibreOffice: ${e.preview.pages} pages, fonts ${e.preview.fonts.join(", ")}` : ""}`);
