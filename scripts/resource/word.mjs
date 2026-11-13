// Writes the pupil and answers Word files for a worksheet or a booklet, and (with --preview)
// LibreOffice page images for checking. Word is the deliverable; the preview is only for looking at
// the layout.
//
// Usage:
//   node scripts/resource/word.mjs [worksheet-or-booklet.json ...] [--out dir] [--preview] [--no-system-inter] [--lessons] [--unit] [--renderer-pdf]
// With no files, the golden fixtures and the example booklet are written. --lessons also writes
// each booklet lesson on its own, numbered as in the whole booklet; --unit adds a 12-lesson unit
// made from the example's lessons. --renderer-pdf writes the PDF writer's own PDF beside each file
// (--preview does too) for scripts/word/compare-text.mjs. word-expected.json lists the page count
// each file must print as, for scripts/word/word-to-pdf.ps1. --no-system-inter runs LibreOffice
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
      `export { worksheetDocx, bookletDocx } from "./services/graph-mcp/worksheet-docx";`,
      `export { a7Booklet } from "./packages/resource-core/src/booklet-fixtures";`,
      `export { docxFileName } from "./packages/resource-core/src/docx";`,
      `export { wordSample } from "./packages/resource-core/src/word-sample";`,
      `export { layoutSample } from "./packages/resource-core/src/layout-sample";`,
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

const sources = inputs.length
  ? await Promise.all(
      inputs.map(async (f) => {
        const json = JSON.parse(await readFile(f, "utf8"));
        return [basename(f, ".json"), r.isBooklet(json) ? r.validateBooklet(json) : r.validate(json)];
      }),
    )
  : [
      ["comparative-bar-charts", r.comparativeBarCharts],
      ["tree-diagrams", r.treeDiagrams],
      ["word-rendering-test", r.wordSample],
      ["layout-test", r.layoutSample],
      ["a7-booklet", r.a7Booklet],
    ];
if (flag("--unit")) {
  // A whole unit: the example's two lessons repeated to twelve, each with its own title.
  const unit = structuredClone(r.a7Booklet);
  const [a, b] = r.a7Booklet.document.lessons;
  unit.document.lessons = Array.from({ length: 12 }, (_, i) => ({ ...structuredClone(i % 2 ? b : a), title: `${(i % 2 ? b : a).title} (${i + 1})`, code: `A7.${String(i + 1).padStart(2, "0")}` }));
  sources.push(["a7-unit-12-lessons", r.validateBooklet(unit)]);
}
const sheets = sources.filter(([, d]) => !r.isBooklet(d));
const booklets = sources.filter(([, d]) => r.isBooklet(d));

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
  clearImages(stem);
  execFileSync("pdftoppm", ["-r", "60", "-png", pdf, stem]);
  return { pages, fonts: [...new Set(fonts.map((f) => f.replace(/^[A-Z]{6}\+/, "")))] };
};
function clearImages(stem) {
  for (let i = 1; i <= 99; i++) for (const d of [String(i), String(i).padStart(2, "0")]) rmSync(`${stem}-${d}.png`, { force: true });
}
/** The PDF writer's own pages, for side-by-side comparison with the Word preview. */
async function rendererPdf(file, pages, title) {
  await writeFile(file, await r.worksheetPdf(pages, title, roots));
  if (!flag("--preview")) return;
  const stem = file.replace(/\.pdf$/, "");
  clearImages(stem);
  execFileSync("pdftoppm", ["-r", "60", "-png", file, stem]);
}

const report = [];
for (const [id, doc] of sheets)
  for (const view of ["pupil", "answers"]) {
    const { bytes, issues } = await r.worksheetDocx(doc, view, roots, "MathsDock worksheet renderer, Word output 1");
    const name = r.docxFileName(r.fileName(doc, view));
    const file = join(out, `${id}${view === "answers" ? "_answers" : ""}.docx`);
    await writeFile(file, bytes);
    const entry = { id, view, file, name, bytes: bytes.length, issues: issues.map((i) => `side ${i.side} column ${i.column}: ${i.message}`) };
    entry.expectedPages = 2;
    if (flag("--preview")) entry.preview = preview(file);
    if (flag("--preview") || flag("--renderer-pdf"))
      await rendererPdf(join(out, `${id}${view === "answers" ? "_answers" : ""}_renderer.pdf`), r.renderResource(doc, { view }).pages, doc.document.title);
    report.push(entry);
  }
for (const [id, booklet] of booklets) {
  const jobs = [[id, booklet, undefined, r.bookletFileName]];
  if (flag("--lessons"))
    booklet.document.lessons.forEach((_, i) => {
      const one = r.singleLessonBooklet(booklet, i);
      jobs.push([`${id}_lesson-${i + 1}`, one.booklet, one.numbering, (_b, view) => r.lessonFileName(booklet, i, view)]);
    });
  for (const [name, b, numbering, pdfName] of jobs)
    for (const view of ["pupil", "answers"]) {
      const { bytes, issues, pages } = await r.bookletDocx(b, view, roots, "MathsDock booklet renderer, Word output 1", numbering);
      const file = join(out, `${name}${view === "answers" ? "_answers" : ""}.docx`);
      await writeFile(file, bytes);
      const entry = { id: name, view, file, name: pdfName(b, view).replace(/\.pdf$/, ".docx"), bytes: bytes.length, expectedPages: pages, issues: issues.map((i) => `${r.issuePlace(i)}: ${i.message}`) };
      if (flag("--preview")) entry.preview = preview(file);
      if (flag("--preview") || flag("--renderer-pdf")) {
        const rendered = r.renderBooklet(b, { view, numbering }).pages;
        await rendererPdf(join(out, `${name}${view === "answers" ? "_answers" : ""}_renderer.pdf`), numbering ? rendered.slice(1) : rendered, b.document.title);
      }
      report.push(entry);
    }
}
await writeFile(join(out, "word-report.json"), JSON.stringify(report, null, 2));
// The page count each file must print as, read by scripts/word/word-to-pdf.ps1.
await writeFile(join(out, "word-expected.json"), JSON.stringify(Object.fromEntries(report.map((e) => [basename(e.file), e.expectedPages])), null, 2));
for (const e of report)
  console.log(
    `${basename(e.file)}: ${e.bytes} bytes; ${e.issues.length ? e.issues.join(" | ") : "no layout issues"}${e.preview ? `; LibreOffice: ${e.preview.pages} of ${e.expectedPages} pages${e.preview.pages === e.expectedPages ? "" : " <-- WRONG"}, fonts ${e.preview.fonts.join(", ")}` : ""}`,
  );
