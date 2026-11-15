import { readFileSync } from "node:fs";
import { join } from "node:path";
import { writeWorksheetPdf } from "../../packages/resource-core/src/pdf";
import { assertVectorPdf } from "../../packages/resource-core/src/pdf-audit";

/** Worksheet text fonts (assets/resource-fonts) and diagram fonts (assets/graph-fonts). */
export type PdfFontRoots = { text: string; diagrams: string };

/**
 * Vector PDF of rendered worksheet pages, with the fonts read from disk. PDFKit loads only here:
 * every raster job runs in a fresh worker process, and loading PDFKit there would slow every diagram.
 * Every PDF is re-opened and audited before it is returned (W30); a failed audit is an error.
 */
export async function worksheetPdf(pages: string[], title: string, roots: PdfFontRoots): Promise<Uint8Array> {
  const [{ default: PDFDocument }, { default: SVGtoPDF }] = await Promise.all([import("pdfkit"), import("svg-to-pdfkit")]);
  const read = (root: string, file: string) => readFileSync(join(root, file));
  const pdf = await writeWorksheetPdf(PDFDocument as never, SVGtoPDF as never, pages, title, {
    inter: read(roots.text, "Inter-Regular.ttf"),
    interSemiBold: read(roots.text, "Inter-SemiBold.ttf"),
    interItalic: read(roots.text, "Inter-Italic.ttf"),
    stix: read(roots.diagrams, "STIXTwoText-Regular.otf"),
    stixItalic: read(roots.diagrams, "STIXTwoText-Italic.otf"),
    stixMath: read(roots.diagrams, "STIXTwoMath-Regular.otf"),
  });
  // Post-export vector audit: page count, size, no rasterised text or diagrams, embedded fonts.
  await assertVectorPdf(pdf, pages);
  return pdf;
}
