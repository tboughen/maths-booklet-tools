import {
  canonical,
  exportIssue,
  geometry,
  renderSvg,
  type Envelope,
} from "../../packages/venn-core/src";
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
  const g = geometry(e),
    svg = await embedPortableFonts(renderSvg(e));
  return { svg, width: g.width / 10, height: g.height / 10 };
}
export async function printPng(e: Envelope) {
  const m = await prepareImage(e),
    png = await svgToPng(m.svg, m.width, m.height),
    size = printRasterSize(m.width, m.height);
  verifyPrintBytes(
    new Uint8Array(await png.arrayBuffer()),
    size.width,
    size.height,
  );
  return png;
}
export async function downloadImage(e: Envelope, format: "png" | "svg") {
  downloadBlob(
    format === "png"
      ? await printPng(e)
      : new Blob([(await prepareImage(e)).svg], {
          type: "image/svg+xml;charset=utf-8",
        }),
    `maths-venn.${format}`,
  );
}
export function downloadEditable(e: Envelope) {
  downloadBlob(
    new Blob([canonical(e)], { type: "application/json" }),
    "maths-venn.json",
  );
}
export async function copyWord(e: Envelope) {
  const m = await prepareImage(e),
    url = await blobToDataUrl(await printPng(e));
  if (
    !copyWordSizedHtml(
      `<img src="${url}" width="${m.width}cm" height="${m.height}cm" style="width:${m.width}cm;height:${m.height}cm" alt="Venn diagram">`,
    )
  )
    throw Error(
      "The browser blocked copying. Download PNG (600 ppi) and insert it into Word instead.",
    );
}
