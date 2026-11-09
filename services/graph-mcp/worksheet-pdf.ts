import { readFileSync } from "node:fs";
import { join } from "node:path";
import PDFDocument from "pdfkit";
import SVGtoPDF from "svg-to-pdfkit";
import { writeWorksheetPdf } from "../../packages/resource-core/src/pdf";

/** Worksheet text fonts (assets/resource-fonts) and diagram fonts (assets/graph-fonts). */
export type PdfFontRoots = { text: string; diagrams: string };

/** Vector PDF of rendered worksheet pages, with the fonts read from disk. */
export function worksheetPdf(pages: string[], title: string, roots: PdfFontRoots): Promise<Uint8Array> {
  const read = (root: string, file: string) => readFileSync(join(root, file));
  return writeWorksheetPdf(PDFDocument as never, SVGtoPDF as never, pages, title, {
    inter: read(roots.text, "Inter-Regular.ttf"),
    interSemiBold: read(roots.text, "Inter-SemiBold.ttf"),
    interItalic: read(roots.text, "Inter-Italic.ttf"),
    stix: read(roots.diagrams, "STIXTwoText-Regular.otf"),
    stixItalic: read(roots.diagrams, "STIXTwoText-Italic.otf"),
    stixMath: read(roots.diagrams, "STIXTwoMath-Regular.otf"),
  });
}
