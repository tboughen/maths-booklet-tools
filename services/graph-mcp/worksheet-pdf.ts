import { join } from "node:path";
import PDFDocument from "pdfkit";
import SVGtoPDF from "svg-to-pdfkit";

/** Worksheet text fonts (assets/resource-fonts) and diagram fonts (assets/graph-fonts). */
export type PdfFontRoots = { text: string; diagrams: string };

const MM = 72 / 25.4;

/**
 * Vector PDF of rendered worksheet pages (resource-core SVGs in millimetres), one page each at the
 * SVG's own physical size. Text stays text with subset embedded fonts; nothing is rasterised.
 */
export function worksheetPdf(pages: string[], title: string, fonts: PdfFontRoots): Promise<Uint8Array> {
  const doc = new PDFDocument({
    autoFirstPage: false,
    margin: 0,
    pdfVersion: "1.7",
    info: { Title: title, Creator: "MathsDock", Producer: "MathsDock", CreationDate: new Date(0) },
  });
  doc.registerFont("Inter", join(fonts.text, "Inter-Regular.ttf"));
  doc.registerFont("Inter-SemiBold", join(fonts.text, "Inter-SemiBold.ttf"));
  doc.registerFont("Inter-Italic", join(fonts.text, "Inter-Italic.ttf"));
  doc.registerFont("STIX", join(fonts.diagrams, "STIXTwoText-Regular.otf"));
  doc.registerFont("STIX-Italic", join(fonts.diagrams, "STIXTwoText-Italic.otf"));
  doc.registerFont("STIX-Math", join(fonts.diagrams, "STIXTwoMath-Regular.otf"));
  const chunks: Buffer[] = [];
  const done = new Promise<Uint8Array>((resolve, reject) => {
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(new Uint8Array(Buffer.concat(chunks))));
    doc.on("error", reject);
  });
  const problems: string[] = [];
  for (const svg of pages) {
    const size = svg.match(/<svg\b[^>]*\bwidth="([\d.]+)mm"[^>]*\bheight="([\d.]+)mm"/);
    if (!size) throw Error("Each worksheet page must state its size in millimetres.");
    const width = Number(size[1]) * MM,
      height = Number(size[2]) * MM;
    doc.addPage({ size: [width, height], margin: 0 });
    SVGtoPDF(doc, svg, 0, 0, {
      width,
      height,
      preserveAspectRatio: "none",
      fontCallback: (family: string, bold: boolean, italic: boolean) => {
        if (/stix two math/i.test(family) && !/stix two text/i.test(family)) return "STIX-Math";
        if (/stix/i.test(family)) return italic ? "STIX-Italic" : "STIX";
        return bold ? "Inter-SemiBold" : italic ? "Inter-Italic" : "Inter";
      },
      warningCallback: (w: string) => problems.push(w),
    });
  }
  if (problems.length) throw Error(`The PDF writer could not draw part of the page: ${problems[0]}`);
  doc.end();
  return done;
}
