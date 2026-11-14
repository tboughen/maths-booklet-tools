import interUrl from "../../assets/resource-fonts/Inter-Regular.ttf?url";
import interSemiBoldUrl from "../../assets/resource-fonts/Inter-SemiBold.ttf?url";
import interItalicUrl from "../../assets/resource-fonts/Inter-Italic.ttf?url";
import stixUrl from "../../assets/graph-fonts/STIXTwoText-Regular.otf?url";
import stixItalicUrl from "../../assets/graph-fonts/STIXTwoText-Italic.otf?url";
import stixMathUrl from "../../assets/graph-fonts/STIXTwoMath-Regular.otf?url";
import { fileName, renderResource, type Resource, type View } from "../../packages/resource-core/src/index";
import { writeWorksheetPdf, type PdfFonts } from "../../packages/resource-core/src/pdf";
import { downloadBlob } from "../export/clipboard";

let fonts: Promise<PdfFonts> | null = null;
function loadFonts() {
  const get = async (url: string) => {
    const r = await fetch(url);
    if (!r.ok) throw Error("A worksheet font could not be loaded. Check the connection and try again.");
    return r.arrayBuffer();
  };
  fonts ??= Promise.all([interUrl, interSemiBoldUrl, interItalicUrl, stixUrl, stixItalicUrl, stixMathUrl].map(get)).then(
    ([inter, interSemiBold, interItalic, stix, stixItalic, stixMath]) => ({ inter, interSemiBold, interItalic, stix, stixItalic, stixMath }),
  );
  fonts.catch(() => (fonts = null));
  return fonts;
}

/**
 * A vector PDF of rendered pages (any millimetre size), written in the browser. Worksheet sides and
 * booklet pages name their kind of page in `check`, which also reads the written file back (W31)
 * and refuses it, with the specific problem, when text lands near the paper's edge or crosses a
 * card or diagram.
 */
export async function pagesPdf(pages: string[], title: string, check?: "Side" | "Page"): Promise<Blob> {
  const [{ default: PDFDocument }, { default: SVGtoPDF }, f] = await Promise.all([import("pdfkit"), import("svg-to-pdfkit"), loadFonts()]);
  const bytes = await writeWorksheetPdf(PDFDocument as never, SVGtoPDF as never, pages, title, f);
  // Post-export vector audit (W30): the file is re-opened and checked before it is offered.
  const { assertVectorPdf } = await import("../../packages/resource-core/src/pdf-audit");
  await assertVectorPdf(bytes, pages);
  if (check) {
    const [{ checkRenderedPages }, { readPdf }] = await Promise.all([import("../../packages/resource-core/src/page-check"), import("../export/pdfjs")]);
    const problems = await checkRenderedPages(readPdf, bytes, pages);
    if (problems.length)
      throw Error(
        `The PDF did not pass the page check, so it was not downloaded. ${problems
          .slice(0, 3)
          .map((p) => `${check} ${p.page + 1}: ${p.message}`)
          .join(" ")}${problems.length > 3 ? ` (${problems.length - 3} more.)` : ""}`,
      );
  }
  return new Blob([bytes as BlobPart], { type: "application/pdf" });
}

/** The vector PDF for one view, written in the browser with the same writer as the MCP service. */
export async function worksheetPdf(resource: Resource, view: View): Promise<Blob> {
  const { pages, issues } = renderResource(resource, { view });
  if (issues.length) throw Error("Fix the layout checks before downloading: the worksheet does not fit two sides yet.");
  return pagesPdf(pages, resource.document.title, "Side");
}

export async function downloadPdf(resource: Resource, view: View) {
  downloadBlob(await worksheetPdf(resource, view), fileName(resource, view));
}

export const editableName = (resource: Resource) => fileName(resource).replace(/_A3\.pdf$/, ".json");
export function downloadEditable(resource: Resource) {
  downloadBlob(new Blob([JSON.stringify(resource, null, 2)], { type: "application/json" }), editableName(resource));
}
