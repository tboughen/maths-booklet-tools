// Compares where text lands in Word's PDFs with the PDF writer's own, page by page, for the
// real-Word check. For each NAME.word.pdf (from word-to-pdf.ps1) or NAME.pdf (LibreOffice) beside a
// NAME_renderer.pdf (from word.mjs --renderer-pdf or --preview), it matches text pieces that occur
// once on a page in both files and reports how far Word moved them, in millimetres.
//
//   node scripts/word/compare-text.mjs <folder>
// Writes <folder>/text-compare.json and prints one line per file.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const folder = process.argv[2];
if (!folder) throw Error("Usage: node scripts/word/compare-text.mjs <folder>");
const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
const MM = 25.4 / 72;

async function pages(file) {
  const doc = await pdfjs.getDocument({ data: new Uint8Array(readFileSync(file)), useSystemFonts: false, isEvalSupported: false }).promise;
  const out = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const height = page.view[3] - page.view[1];
    const { items } = await page.getTextContent();
    const pieces = new Map();
    for (const it of items) {
      const s = it.str.trim();
      if (s.length < 4) continue;
      const at = { x: it.transform[4] * MM, y: (height - it.transform[5]) * MM };
      pieces.set(s, pieces.has(s) ? null : at);
    }
    out.push(pieces);
  }
  return out;
}

const files = readdirSync(folder).filter((f) => f.endsWith("_renderer.pdf"));
const report = [];
for (const ref of files) {
  const stem = ref.replace(/_renderer\.pdf$/, "");
  const word = readdirSync(folder).find((f) => f === `${stem}.word.pdf`) ?? readdirSync(folder).find((f) => f === `${stem}.pdf`);
  if (!word) continue;
  const [a, b] = await Promise.all([pages(join(folder, word)), pages(join(folder, ref))]);
  const perPage = [];
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    const moves = [];
    for (const [s, at] of a[i]) {
      const want = b[i].get(s);
      if (at && want) moves.push({ s, dx: at.x - want.x, dy: at.y - want.y });
    }
    const worst = moves.reduce((m, v) => (Math.abs(v.dy) > Math.abs(m?.dy ?? 0) ? v : m), null);
    perPage.push({ page: i + 1, matched: moves.length, maxDown: Math.max(0, ...moves.map((m) => m.dy)), maxUp: Math.min(0, ...moves.map((m) => m.dy)), maxAcross: Math.max(0, ...moves.map((m) => Math.abs(m.dx))), worst: worst && { text: worst.s.slice(0, 40), dy: worst.dy } });
  }
  const round = (v) => Math.round(v * 100) / 100;
  const entry = {
    file: word,
    pages: a.length,
    rendererPages: b.length,
    matched: perPage.reduce((k, p) => k + p.matched, 0),
    maxDownMm: round(Math.max(0, ...perPage.map((p) => p.maxDown))),
    maxUpMm: round(Math.min(0, ...perPage.map((p) => p.maxUp))),
    maxAcrossMm: round(Math.max(0, ...perPage.map((p) => p.maxAcross))),
    perPage: perPage.map((p) => ({ ...p, maxDown: round(p.maxDown), maxUp: round(p.maxUp), maxAcross: round(p.maxAcross), worst: p.worst && { ...p.worst, dy: round(p.worst.dy) } })),
  };
  report.push(entry);
  console.log(`${word}: ${entry.pages} pages (renderer ${entry.rendererPages}); ${entry.matched} text pieces; text moved ${entry.maxUpMm} to +${entry.maxDownMm} mm down, ${entry.maxAcrossMm} mm across`);
}
writeFileSync(join(folder, "text-compare.json"), JSON.stringify(report, null, 2));
