/**
 * Post-export vector audit (W30). After a worksheet or booklet PDF is written, it is opened again
 * and checked against what was asked for: page count, each page's size and orientation, no raster
 * images except those the pages themselves hold (bank question images), every font embedded with a
 * text map so the text can be selected and searched, and text present on every page that has any.
 * This automates the PRODUCE check "verify page count, page size and orientation, and that text
 * and diagrams are not rasterised". pdf-lib is pure JavaScript, so the website and the connector
 * run the same audit.
 */
import { PDFArray, PDFDict, PDFDocument, PDFName, PDFNumber, PDFRawStream, PDFRef, decodePDFRawStream } from "pdf-lib";

const MM = 72 / 25.4;
/** How far a page's size may differ from the SVG's, in millimetres (PDF points round to 0.001). */
export const PAGE_SIZE_TOLERANCE_MM = 0.1;

export interface PdfAuditPage {
  widthMm: number;
  heightMm: number;
  /** Raster images the page artwork itself holds (<image> elements); these are allowed. */
  images: number;
  /** Whether the page artwork holds any text. */
  text: boolean;
}

/** What each written page should be, read from the SVG pages handed to the PDF writer. */
export function expectedPages(pages: string[]): PdfAuditPage[] {
  return pages.map((svg) => {
    const size = svg.match(/<svg\b[^>]*\bwidth="([\d.]+)mm"[^>]*\bheight="([\d.]+)mm"/);
    if (!size) throw Error("Each page must state its size in millimetres.");
    return {
      widthMm: Number(size[1]),
      heightMm: Number(size[2]),
      images: (svg.match(/<image\b/g) ?? []).length,
      text: /<(text|tspan)\b[^>]*>[^<]*\S/.test(svg),
    };
  });
}

export interface PdfAudit {
  pages: number;
  images: number;
  fonts: number;
  problems: string[];
}

const lookup = (doc: PDFDocument, v: unknown) => (v instanceof PDFRef ? doc.context.lookup(v) : v);

/** Every XObject and font reachable from a resource dictionary, following form XObjects. */
function walkResources(doc: PDFDocument, resources: unknown, seen: Set<unknown>, found: { images: number; fonts: PDFDict[] }) {
  const res = lookup(doc, resources);
  if (!(res instanceof PDFDict) || seen.has(res)) return;
  seen.add(res);
  const fonts = lookup(doc, res.get(PDFName.of("Font")));
  if (fonts instanceof PDFDict)
    for (const [, ref] of fonts.entries()) {
      const font = lookup(doc, ref);
      if (font instanceof PDFDict && !seen.has(font)) {
        seen.add(font);
        found.fonts.push(font);
      }
    }
  const xobjects = lookup(doc, res.get(PDFName.of("XObject")));
  if (xobjects instanceof PDFDict)
    for (const [, ref] of xobjects.entries()) {
      const x = lookup(doc, ref);
      if (!(x instanceof PDFRawStream) || seen.has(x)) continue;
      seen.add(x);
      const subtype = x.dict.get(PDFName.of("Subtype"));
      if (subtype === PDFName.of("Image")) found.images++;
      else if (subtype === PDFName.of("Form")) walkResources(doc, x.dict.get(PDFName.of("Resources")), seen, found);
    }
}

/** A font's embedded program, following Type0 descendants. */
function embedded(doc: PDFDocument, font: PDFDict): boolean {
  const subtype = font.get(PDFName.of("Subtype"));
  if (subtype === PDFName.of("Type3")) return true;
  if (subtype === PDFName.of("Type0")) {
    const kids = lookup(doc, font.get(PDFName.of("DescendantFonts")));
    return kids instanceof PDFArray && kids.asArray().every((k) => { const d = lookup(doc, k); return d instanceof PDFDict && embedded(doc, d); });
  }
  const desc = lookup(doc, font.get(PDFName.of("FontDescriptor")));
  return desc instanceof PDFDict && ["FontFile", "FontFile2", "FontFile3"].some((k) => desc.has(PDFName.of(k)));
}

const fontName = (font: PDFDict) => String(font.get(PDFName.of("BaseFont")) ?? "a font").replace(/^\//, "").replace(/^[A-Z]{6}\+/, "");

/** Content stream text of one page, decoded. */
function contentText(doc: PDFDocument, contents: unknown): string {
  const c = lookup(doc, contents);
  const streams = c instanceof PDFArray ? c.asArray().map((s) => lookup(doc, s)) : [c];
  return streams
    .map((s) => (s instanceof PDFRawStream ? new TextDecoder("latin1").decode(decodePDFRawStream(s).decode()) : ""))
    .join("\n");
}

/** Audits written PDF bytes against the pages that were drawn into them. */
export async function auditPdf(bytes: Uint8Array, expected: PdfAuditPage[]): Promise<PdfAudit> {
  const problems: string[] = [];
  const doc = await PDFDocument.load(bytes, { updateMetadata: false });
  const pages = doc.getPages();
  if (pages.length !== expected.length) problems.push(`The PDF has ${pages.length} pages; ${expected.length} were drawn.`);
  let images = 0,
    fontCount = 0;
  const allFonts: PDFDict[] = [];
  pages.forEach((page, i) => {
    const want = expected[i];
    if (!want) return;
    const { width, height } = page.getMediaBox();
    const w = width / MM,
      h = height / MM;
    if (Math.abs(w - want.widthMm) > PAGE_SIZE_TOLERANCE_MM || Math.abs(h - want.heightMm) > PAGE_SIZE_TOLERANCE_MM)
      problems.push(`Page ${i + 1} is ${w.toFixed(1)} × ${h.toFixed(1)} mm; it should be ${want.widthMm} × ${want.heightMm} mm.`);
    const rotate = page.node.get(PDFName.of("Rotate"));
    if (rotate instanceof PDFNumber && rotate.asNumber() % 360 !== 0) problems.push(`Page ${i + 1} is rotated ${rotate.asNumber()}°; the orientation must come from its size.`);
    const found = { images: 0, fonts: [] as PDFDict[] };
    walkResources(doc, page.node.get(PDFName.of("Resources")), new Set(), found);
    images += found.images;
    if (found.images > want.images)
      problems.push(`Page ${i + 1} holds ${found.images} raster image${found.images === 1 ? "" : "s"}; only ${want.images} ${want.images === 1 ? "was" : "were"} drawn. Text or diagrams may have been rasterised.`);
    for (const f of found.fonts) if (!allFonts.includes(f)) allFonts.push(f);
    if (want.text) {
      const content = contentText(doc, page.node.get(PDFName.of("Contents")));
      if (!found.fonts.length || !/\b(Tj|TJ|'|")\s/.test(content + " ")) problems.push(`Page ${i + 1} has no selectable text; its lettering may have been turned into pictures.`);
    }
  });
  for (const font of allFonts) {
    fontCount++;
    if (!embedded(doc, font)) problems.push(`The font ${fontName(font)} is not embedded, so the page may print in another font.`);
    if (font.get(PDFName.of("Subtype")) !== PDFName.of("Type3") && !font.has(PDFName.of("ToUnicode")))
      problems.push(`The font ${fontName(font)} has no text map, so its text cannot be searched or copied.`);
  }
  return { pages: pages.length, images, fonts: fontCount, problems };
}

/** Audits and throws a teacher-readable error naming the first problem. */
export async function assertVectorPdf(bytes: Uint8Array, pages: string[]): Promise<PdfAudit> {
  const audit = await auditPdf(bytes, expectedPages(pages));
  if (audit.problems.length) throw Error(`The PDF failed its print check: ${audit.problems[0]}`);
  return audit;
}
