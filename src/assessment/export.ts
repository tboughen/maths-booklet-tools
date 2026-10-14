import { PDFDocument, StandardFonts, PrintScaling, degrees, rgb, type PDFFont, type PDFPage, type PDFEmbeddedPage } from "pdf-lib";
import { resolveBankAssetUrl } from "../bank/assetUrl";
import { A4, BOTTOM, MARGIN, WIDTH, blockHeading, layoutPack } from "./layout";
import type { ClassPlan, Settings } from "./types";

const text = (value: string) => value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[–—]/g, "-").replace(/[^\x20-\x7E]/g, " ");
async function identifier(page: PDFPage, value: string, font: PDFFont, doc: PDFDocument) {
  const label = `Student: ${value}`;
  try {
    font.encodeText(label);
    const size = Math.min(12, WIDTH / Math.max(1, font.widthOfTextAtSize(label, 1)));
    if (size >= 7) { page.drawText(label, { x: MARGIN, y: A4.height - 30, size, font }); return; }
  } catch { /* Preserve non-WinAnsi identifiers through a local image. */ }
  const canvas = document.createElement("canvas"); canvas.width = Math.ceil(WIDTH * 3); canvas.height = 54;
  const context = canvas.getContext("2d"); if (!context) throw new Error("This browser could not render the student identifier.");
  context.fillStyle = "#fff"; context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#18283c"; context.font = "36px sans-serif"; context.fillText(label, 0, 39, canvas.width);
  const png = await doc.embedPng(canvas.toDataURL("image/png")); page.drawImage(png, { x: MARGIN, y: A4.height - 35, width: WIDTH, height: 18 });
}

export async function exportClass(plan: ClassPlan, settings: Settings, version: string, progress: (message: string) => void, signal?: AbortSignal): Promise<Blob> {
  const cancelled = () => { if (signal?.aborted) throw new DOMException("Generation cancelled.", "AbortError"); };
  const doc = await PDFDocument.create(); const font = await doc.embedFont(StandardFonts.Helvetica), bold = await doc.embedFont(StandardFonts.HelveticaBold);
  doc.setTitle("MathsDock assessment follow-up"); doc.setCreator("MathsDock"); doc.setLanguage("en-GB");
  doc.catalog.getOrCreateViewerPreferences().setPrintScaling(PrintScaling.None);
  const sources = new Map<string, Promise<PDFDocument>>();
  const artwork = new Map<string, PDFEmbeddedPage>(), answers = new Map<string, PDFEmbeddedPage>();
  const load = (path: string) => {
    let source = sources.get(path);
    if (!source) {
      source = fetch(resolveBankAssetUrl(path, import.meta.env.BASE_URL, import.meta.env.VITE_BANK_ASSET_ORIGIN), { signal }).then(async response => {
        if (!response.ok) throw new Error("A question or scheme could not be loaded. No incomplete class PDF has been produced.");
        return PDFDocument.load(await response.arrayBuffer());
      }); sources.set(path, source);
    }
    return source;
  };
  for (const [pupilIndex, pack] of plan.packs.entries()) {
    cancelled(); progress(`Preparing pack ${pupilIndex + 1} of ${plan.packs.length}`);
    const layout = layoutPack(pack.entries, settings.pageLimit);
    if (!layout.valid) throw new Error("A pack exceeds its layout limit. Generate the selections again.");
    const pages: PDFPage[] = [];
    const marks = pack.entries.reduce((n, entry) => n + entry.question.marks, 0);
    for (let p = 0; p < layout.pages; p++) {
      const page = doc.addPage([A4.width, A4.height]); pages.push(page);
      await identifier(page, pack.pupil.identifier, bold, doc);
      page.drawText(`Assessment follow-up | Year ${pack.profile.year} | ${pack.profile.tier === "H" ? "Higher" : "Foundation"} | ${marks} marks`, { x: MARGIN, y: A4.height - 48, size: 10, font });
      if (plan.assessmentName) page.drawText(text(plan.assessmentName), { x: MARGIN, y: A4.height - 64, size: 9, font });
      page.drawText(`Page ${p + 1} of ${layout.pages} | ${text(version)}`, { x: MARGIN, y: 15, size: 8, font, color: rgb(.35, .4, .46) });
      if (p >= layout.usedPages) page.drawText("Space retained for this student. The next pack starts on a new page.", { x: MARGIN, y: A4.height - 100, size: 9, font });
    }
    if (!pack.entries.length) pages[0].drawText("No suitable complete question and scheme fit the chosen limits.", { x: MARGIN, y: A4.height - 100, size: 10, font });
    for (const placement of layout.placements) {
      cancelled();
      const page = pages[placement.page], entry = pack.entries[placement.entry], top = A4.height - placement.y;
      if (placement.kind === "working") {
        page.drawText(`Working space - practice ${placement.entry + 1}`, { x: MARGIN, y: top - 10, size: 8, font });
        for (let dy = 28; dy < placement.height - 5; dy += 20) page.drawLine({ start: { x: MARGIN, y: top - dy }, end: { x: A4.width - MARGIN, y: top - dy }, color: rgb(.8, .84, .88), thickness: .4 });
        continue;
      }
      const source = await load(placement.path);
      const sourcePage = source.getPage(placement.assetPage);
      if (!sourcePage || Math.abs(sourcePage.getWidth() - placement.width) > 1 || Math.abs(sourcePage.getHeight() * placement.scale - placement.artworkHeight) > 1) throw new Error("Question dimensions differ from the reviewed catalogue. No incomplete class PDF has been produced.");
      const artworkKey = `${placement.path}#${placement.assetPage}`;
      let embedded = artwork.get(artworkKey);
      if (!embedded) { embedded = await doc.embedPage(sourcePage); artwork.set(artworkKey, embedded); }
      if (placement.kind === "question") {
        let y = top - 10;
        for (const line of blockHeading(entry, placement.entry, placement.assetPage, false)) { page.drawText(text(line.text), { x: MARGIN, y, font: line.bold ? bold : font, size: line.size }); y -= line.size + 2; }
        page.drawPage(embedded, { x: MARGIN, y: top - placement.height + 8, width: placement.width * placement.scale, height: placement.artworkHeight });
      } else {
        // Rotate the whole block, including its reference, rather than artwork alone.
        const heading = blockHeading(entry, placement.entry, placement.assetPage, true);
        const answerKey = JSON.stringify([artworkKey, placement.height, heading]);
        let inverted = answers.get(answerKey);
        if (!inverted) {
          const block = doc.addPage([WIDTH, placement.height]);
          let y = placement.height - 10;
          for (const line of heading) { block.drawText(text(line.text), { x: 0, y, font: line.bold ? bold : font, size: line.size }); y -= line.size + 2; }
          block.drawPage(embedded, { x: (WIDTH - placement.width * placement.scale) / 2, y: 5, width: placement.width * placement.scale, height: placement.artworkHeight });
          inverted = await doc.embedPage(block); answers.set(answerKey, inverted);
          doc.removePage(doc.getPageCount() - 1);
        }
        page.drawPage(inverted, { x: A4.width - MARGIN, y: top, width: WIDTH, height: placement.height, rotate: degrees(180) });
      }
      if (top - placement.height < BOTTOM - .01) throw new Error("The pack failed its page-boundary check.");
    }
  }
  cancelled(); progress("Saving the class PDF");
  const bytes = await doc.save(); cancelled(); return new Blob([new Uint8Array(bytes).buffer], { type: "application/pdf" });
}
