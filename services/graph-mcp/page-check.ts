import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { checkRenderedPages, type GetDocument, type PageProblem } from "../../packages/resource-core/src/page-check";
import type { RasterQueue } from "./raster";

/**
 * W31: write each copy's PDF, as the download links will, and read it back to check where its text
 * actually landed. Problems are returned with the copy they belong to, so they read as issues.
 */
export async function renderedProblems(raster: RasterQueue, copies: { view: "pupil" | "answers"; pages: string[] }[], title: string, signal?: AbortSignal) {
  const found: (PageProblem & { view: "pupil" | "answers" })[] = [];
  try {
    for (const { view, pages } of copies) {
      const pdf = await raster.worksheetPdf(pages, title, signal);
      for (const p of await checkRenderedPages(getDocument as unknown as GetDocument, pdf, pages))
        found.push({ ...p, view, message: view === "answers" ? `On the answers copy: ${p.message}` : p.message });
    }
  } catch (error) {
    if (signal?.aborted) throw error;
    // A busy or slow service must not stop the sheet being made: each download is still written
    // and audited (W30) when it is fetched. Only the read-back check is skipped this time.
    console.warn(`Rendered-page check skipped: ${error instanceof Error ? error.message : String(error)}`);
    return [];
  }
  // The same fault on both copies is one fault.
  const seen = new Set<string>();
  return found.filter((p) => {
    const key = `${p.page}|${p.message.replace(/^On the answers copy: /, "")}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
