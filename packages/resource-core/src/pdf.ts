/**
 * Vector PDF of rendered worksheet pages, shared by the website and the MCP service. The caller
 * supplies PDFKit, svg-to-pdfkit and the font bytes, so this module has no Node or browser imports.
 * Each SVG becomes one page at its own millimetre size; text stays text with subset embedded fonts.
 */
export type PdfFontKey = "inter" | "interSemiBold" | "interItalic" | "stix" | "stixItalic" | "stixMath";
export type PdfFonts = Record<PdfFontKey, ArrayBuffer | Uint8Array>;

interface PdfDoc {
  registerFont(name: string, src: ArrayBuffer | Uint8Array): unknown;
  addPage(options: { size: [number, number]; margin: number }): unknown;
  on(event: string, listener: (chunk: Uint8Array) => void): unknown;
  end(): void;
}
type PdfConstructor = new (options: object) => PdfDoc;
type SvgToPdf = (doc: never, svg: string, x: number, y: number, options: object) => void;

const MM = 72 / 25.4;

export function writeWorksheetPdf(
  PDFDocument: PdfConstructor,
  SVGtoPDF: SvgToPdf,
  pages: string[],
  title: string,
  fonts: PdfFonts,
): Promise<Uint8Array> {
  const doc = new PDFDocument({
    autoFirstPage: false,
    margin: 0,
    pdfVersion: "1.7",
    info: { Title: title, Creator: "MathsDock", Producer: "MathsDock", CreationDate: new Date(0) },
  });
  const names: Record<PdfFontKey, string> = {
    inter: "Inter",
    interSemiBold: "Inter-SemiBold",
    interItalic: "Inter-Italic",
    stix: "STIX",
    stixItalic: "STIX-Italic",
    stixMath: "STIX-Math",
  };
  for (const key of Object.keys(names) as PdfFontKey[]) doc.registerFont(names[key], fonts[key]);
  const chunks: Uint8Array[] = [];
  const done = new Promise<Uint8Array>((resolve, reject) => {
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => {
      const out = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
      let at = 0;
      for (const c of chunks) {
        out.set(c, at);
        at += c.length;
      }
      resolve(out);
    });
    doc.on("error", reject as never);
  });
  const problems: string[] = [];
  for (const svg of pages) {
    const size = svg.match(/<svg\b[^>]*\bwidth="([\d.]+)mm"[^>]*\bheight="([\d.]+)mm"/);
    if (!size) throw Error("Each worksheet page must state its size in millimetres.");
    const width = Number(size[1]) * MM,
      height = Number(size[2]) * MM;
    doc.addPage({ size: [width, height], margin: 0 });
    SVGtoPDF(doc as never, svg, 0, 0, {
      width,
      height,
      preserveAspectRatio: "none",
      fontCallback: (family: string, bold: boolean, italic: boolean) => {
        if (/stix two math/i.test(family) && !/stix two text/i.test(family)) return names.stixMath;
        if (/stix/i.test(family)) return italic ? names.stixItalic : names.stix;
        return bold ? names.interSemiBold : italic ? names.interItalic : names.inter;
      },
      warningCallback: (w: string) => problems.push(w),
    });
  }
  if (problems.length) throw Error(`The PDF writer could not draw part of the page: ${problems[0]}`);
  doc.end();
  return done;
}
