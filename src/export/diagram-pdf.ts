/**
 * Download PDF (actual size) for every diagram editor (U32): the same artwork as Download SVG,
 * on an A4 (or A3) page at 1:1, written in the browser by the worksheet PDF writer and audited
 * before it is offered. PDFKit and the fonts load only when a PDF is asked for.
 */
export async function svgPdf(svg: string): Promise<Blob> {
  const [{ diagramPage }, { pagesPdf }] = await Promise.all([
    import("../../packages/resource-core/src/diagram-page"),
    import("../worksheet/export"),
  ]);
  const label = svg.match(/<svg\b[^>]*\saria-label="([^"]*)"/)?.[1] ?? "";
  return pagesPdf([diagramPage(svg, label.replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&"))], "MathsDock diagram");
}
