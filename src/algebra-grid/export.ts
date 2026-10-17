import {
  canonical,
  exportIssue,
  layout,
  renderSvg,
  type Envelope,
} from "../../packages/algebra-grid-core/src";
import { embedPortableFonts } from "../export/portable";
import { svgToPng } from "../export/png";
import {
  printRasterSize,
  verifyPrintBytes,
} from "../../packages/graph-core/src/png-bytes";
import {
  blobToDataUrl,
  copyWordSizedHtml,
  downloadBlob,
} from "../export/clipboard";
export async function prepareImage(e: Envelope) {
  const issue = exportIssue(e);
  if (issue) throw Error(issue);
  const g = layout(e);
  return {
    svg: await embedPortableFonts(renderSvg(e)),
    width: g.width / 10,
    height: g.height / 10,
  };
}
export async function printPng(e: Envelope) {
  const g = await prepareImage(e),
    png = await svgToPng(g.svg, g.width, g.height),
    size = printRasterSize(g.width, g.height);
  verifyPrintBytes(
    new Uint8Array(await png.arrayBuffer()),
    size.width,
    size.height,
  );
  return png;
}
export async function downloadImage(e: Envelope, format: "svg" | "png") {
  downloadBlob(
    format === "png"
      ? await printPng(e)
      : new Blob([(await prepareImage(e)).svg], {
          type: "image/svg+xml;charset=utf-8",
        }),
    `maths-algebra-grid.${format}`,
  );
}
export function downloadEditable(e: Envelope) {
  downloadBlob(
    new Blob([canonical(e)], { type: "application/json" }),
    "maths-algebra-grid.json",
  );
}
export async function copyWord(e: Envelope) {
  const g = await prepareImage(e),
    url = await blobToDataUrl(await printPng(e));
  if (
    !copyWordSizedHtml(
      `<img src="${url}" width="${g.width}cm" height="${g.height}cm" style="width:${g.width}cm;height:${g.height}cm" alt="Algebra multiplication grid">`,
    )
  )
    throw Error(
      "The browser blocked copying. Download PNG (600 ppi) and insert it into Word instead.",
    );
}
