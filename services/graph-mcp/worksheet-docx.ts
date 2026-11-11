import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Resvg } from "@resvg/resvg-js";
import { writeWorksheetDocx, type DocxPicture, type RenderedDocx } from "../../packages/resource-core/src/docx";
import type { Resource, View } from "../../packages/resource-core/src/index";

/** Worksheet text fonts (assets/resource-fonts) and diagram fonts (assets/graph-fonts). */
export type DocxFontRoots = { text: string; diagrams: string };

/** PNG fallback resolution for Word versions without SVG support. */
const PNG_PPI = 300;

/**
 * Turns a diagram's SVG into what Word needs: the same SVG with its text as outlines (a teacher's
 * computer will not have the STIX maths fonts) and a PNG of the same picture for older Word.
 */
export function wordPicture(svg: string, widthMm: number, heightMm: number, roots: DocxFontRoots): DocxPicture {
  const fontFiles = [
    ...["STIXTwoText-Regular.otf", "STIXTwoText-Italic.otf", "STIXTwoMath-Regular.otf"].map((f) => join(roots.diagrams, f)),
    ...["Inter-Regular.ttf", "Inter-SemiBold.ttf", "Inter-Italic.ttf"].map((f) => join(roots.text, f)),
  ];
  const font = { loadSystemFonts: false, fontFiles, defaultFontFamily: "STIX Two Text" };
  const px = Math.round((widthMm / 25.4) * PNG_PPI);
  const png = new Resvg(svg, { background: "white", font, fitTo: { mode: "width", value: px }, logLevel: "off" }).render().asPng();
  let outlined = new Resvg(svg, { font, logLevel: "off" }).toString();
  // resvg states pixel dimensions; restore the printed size so Word places it at its true size.
  outlined = outlined.replace(/(<svg\b[^>]*?)\swidth="[^"]+"/, `$1 width="${widthMm}mm"`).replace(/(<svg\b[^>]*?)\sheight="[^"]+"/, `$1 height="${heightMm}mm"`);
  return { svg: outlined, png };
}

/** The Word file for one view of a worksheet, with the fonts read from disk. */
export function worksheetDocx(resource: Resource, view: View, roots: DocxFontRoots, version?: string): Promise<RenderedDocx> {
  const read = (file: string) => new Uint8Array(readFileSync(join(roots.text, file)));
  return writeWorksheetDocx(resource, {
    view,
    version,
    fonts: { regular: read("Inter-Regular.ttf"), semiBold: read("Inter-SemiBold.ttf"), italic: read("Inter-Italic.ttf") },
    picture: (svg, w, h) => wordPicture(svg, w, h, roots),
  });
}
