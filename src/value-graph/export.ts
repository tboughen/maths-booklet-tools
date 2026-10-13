import {
  validate,
  metrics,
  renderSvg,
  canonical,
  type ValueEnvelope,
} from "../../packages/value-graph-core/src/interchange";
import { embedPortableFonts } from "../export/portable";
import { svgToPng } from "../export/png";
import {
  printRasterSize,
  verifyPrintBytes,
} from "../../packages/graph-core/src/png-bytes";
import {
  downloadBlob,
  blobToDataUrl,
  copyWordSizedHtml,
} from "../export/clipboard";
export async function printPng(e: ValueEnvelope) {
  const valid = validate(e),
    m = metrics(valid),
    svg = await embedPortableFonts(renderSvg(valid)),
    blob = await svgToPng(svg, m.widthCm, m.heightCm),
    size = printRasterSize(m.widthCm, m.heightCm);
  verifyPrintBytes(
    new Uint8Array(await blob.arrayBuffer()),
    size.width,
    size.height,
  );
  return blob;
}
export async function download(
  e: ValueEnvelope,
  format: "svg" | "png" | "json",
) {
  const valid = validate(e);
  const blob =
    format === "png"
      ? await printPng(valid)
      : format === "svg"
        ? new Blob([await embedPortableFonts(renderSvg(valid))], {
            type: "image/svg+xml",
          })
        : new Blob([canonical(valid)], { type: "application/json" });
  downloadBlob(blob, `mathsdock-values-and-graph.${format}`);
}
export async function copyForWord(e: ValueEnvelope) {
  const m = metrics(e),
    png = await printPng(e),
    url = await blobToDataUrl(png);
  if (
    !copyWordSizedHtml(
      `<img src="${url}" width="${m.widthCm}cm" height="${m.heightCm}cm" style="width:${m.widthCm}cm;height:${m.heightCm}cm" alt="Table of values and graph">`,
    )
  )
    throw Error(
      "The browser blocked copying. Download PNG (600 ppi) and insert it into Word.",
    );
}
