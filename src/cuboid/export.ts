import {
  canonical,
  layout,
  renderSvg,
  validate,
  type Envelope,
} from "../../packages/cuboid-core/src";
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

export async function printPng(e: Envelope): Promise<Blob> {
  const m = layout(e),
    svg = await embedPortableFonts(renderSvg(e)),
    png = await svgToPng(svg, m.width / 10, m.height / 10),
    size = printRasterSize(m.width / 10, m.height / 10);
  verifyPrintBytes(
    new Uint8Array(await png.arrayBuffer()),
    size.width,
    size.height,
  );
  return png;
}
export async function downloadImage(e: Envelope, format: "png" | "svg") {
  const blob =
    format === "png"
      ? await printPng(e)
      : new Blob([await embedPortableFonts(renderSvg(e))], {
          type: "image/svg+xml;charset=utf-8",
        });
  downloadBlob(blob, `maths-cuboids.${format}`);
}
export function downloadEditable(e: Envelope) {
  downloadBlob(
    new Blob([canonical(validate(e))], { type: "application/json" }),
    "maths-cuboids.json",
  );
}
export async function copyWord(e: Envelope) {
  const m = layout(e),
    url = await blobToDataUrl(await printPng(e));
  if (
    !copyWordSizedHtml(
      `<img src="${url}" width="${m.width / 10}cm" height="${m.height / 10}cm" style="width:${m.width / 10}cm;height:${m.height / 10}cm" alt="Cuboid diagrams">`,
    )
  )
    throw Error(
      "The browser blocked copying. Download PNG (600 ppi) and insert it into Word instead.",
    );
}
