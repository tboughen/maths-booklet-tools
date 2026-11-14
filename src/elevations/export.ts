import { downloadBothCopies } from "../export/bothCopies";
import { canonical, exportIssue, layout, renderSvg, type Envelope, type View } from "../../packages/elevation-core/src";
import { embedPortableFonts } from "../export/portable";
import { svgToPng } from "../export/png";
import { printRasterSize, verifyPrintBytes } from "../../packages/graph-core/src/png-bytes";
import { blobToDataUrl, copyWordSizedHtml, downloadBlob, svgAlt } from "../export/clipboard";
import { downloadName } from "../export/filenames";
import { svgPdf } from "../export/diagram-pdf";
import { answerArt } from "../export/worked";

/** Exports take the saved drawing and the copy to print, so both copies keep one size. */
export async function prepareImage(e: Envelope, view: View) {
  const issue = exportIssue(e, view);
  if (issue) throw Error(issue);
  const g = layout(e, view),
    svg = await embedPortableFonts(answerArt(renderSvg(e, view), e, view === "answer"));
  return { svg, width: g.width / 10, height: g.height / 10 };
}
export async function printPng(e: Envelope, view: View) {
  const m = await prepareImage(e, view),
    png = await svgToPng(m.svg, m.width, m.height),
    size = printRasterSize(m.width, m.height);
  verifyPrintBytes(new Uint8Array(await png.arrayBuffer()), size.width, size.height);
  return png;
}
export async function downloadImage(e: Envelope, format: "png" | "svg" | "pdf", view: View) {
  downloadBlob(
    format === "pdf"
      ? await svgPdf((await prepareImage(e, view)).svg)
      : format === "png"
        ? await printPng(e, view)
        : new Blob([(await prepareImage(e, view)).svg], { type: "image/svg+xml;charset=utf-8" }),
    downloadName("elevations", format, { resource: e, answers: view === "answer" }),
  );
}
export function downloadEditable(e: Envelope) {
  downloadBlob(new Blob([canonical(e)], { type: "application/json" }), downloadName("elevations", "json", { resource: e }));
}
export async function copyWord(e: Envelope, view: View) {
  const m = await prepareImage(e, view),
    url = await blobToDataUrl(await printPng(e, view));
  if (
    !copyWordSizedHtml(
      `<img src="${url}" width="${m.width}cm" height="${m.height}cm" style="width:${m.width}cm;height:${m.height}cm" alt="${svgAlt(m.svg, "Plans and elevations")}">`,
    )
  )
    throw Error("The browser blocked copying. Download PNG (600 ppi) and insert it into Word instead.");
}

/** Pupil and answers copies in one ZIP (U28); the editor's view is not used. */
export const downloadBoth = (e: Envelope) =>
  downloadBothCopies("elevations", e, async (view) => ({ svg: (await prepareImage(e, view)).svg, png: await printPng(e, view) }));
