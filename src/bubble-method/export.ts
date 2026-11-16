import { forView as viewOf } from "../../packages/bubble-method-core/src";
import { downloadBothCopies } from "../export/bothCopies";
import { canonical, exportIssue, layout, renderSvg, type Envelope } from "../../packages/bubble-method-core/src";
import { embedPortableFonts } from "../export/portable";
import { svgToPng } from "../export/png";
import { printRasterSize, verifyPrintBytes } from "../../packages/graph-core/src/png-bytes";
import { blobToDataUrl, copyWordSizedHtml, downloadBlob, svgAlt } from "../export/clipboard";
import { svgPdf } from "../export/diagram-pdf";
import { answerArt, copySizeCm } from "../export/worked";
import { downloadName } from "../export/filenames";

export async function prepareImage(e: Envelope, answers = false) {
  const issue = exportIssue(e);
  if (issue) throw Error(issue);
  const g = layout(e),
    svg = await embedPortableFonts(answerArt(renderSvg(e), e, answers));
  return { svg, ...copySizeCm(svg, g.width / 10, g.height / 10) };
}
export async function printPng(e: Envelope, answers = false) {
  const m = await prepareImage(e, answers),
    png = await svgToPng(m.svg, m.width, m.height),
    size = printRasterSize(m.width, m.height);
  verifyPrintBytes(new Uint8Array(await png.arrayBuffer()), size.width, size.height);
  return png;
}
export async function downloadImage(e: Envelope, format: "png" | "svg" | "pdf", answers = false) {
  downloadBlob(
    format === "pdf"
      ? await svgPdf((await prepareImage(e, answers)).svg)
      : format === "png"
      ? await printPng(e, answers)
      : new Blob([(await prepareImage(e, answers)).svg], { type: "image/svg+xml;charset=utf-8" }),
    downloadName("bubble-method", format, { resource: e, answers }),
  );
}
export function downloadEditable(e: Envelope) {
  downloadBlob(new Blob([canonical(e)], { type: "application/json" }), downloadName("bubble-method", "json", { resource: e }));
}
export async function copyWord(e: Envelope, answers = false) {
  const m = await prepareImage(e, answers),
    url = await blobToDataUrl(await printPng(e, answers));
  if (
    !copyWordSizedHtml(
      `<img src="${url}" width="${m.width}cm" height="${m.height}cm" style="width:${m.width}cm;height:${m.height}cm" alt="${svgAlt(m.svg, "Bubble method")}">`,
    )
  )
    throw Error("The browser blocked copying. Download PNG (600 ppi) and insert it into Word instead.");
}

/** Pupil and answers copies in one ZIP (U28); the editor's view is not used. */
export const downloadBoth = (e: Envelope) =>
  downloadBothCopies("bubble-method", e, async (view) => {
    const copy = viewOf(e, view, true);
    return { svg: (await prepareImage(copy, view === "answer")).svg, png: await printPng(copy, view === "answer") };
  });
