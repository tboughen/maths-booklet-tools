import {
  renderRatioSvg,
  ratioMetrics,
  describeRatio,
  validateRatioEnvelope,
} from "../../packages/ratio-table-core/src/interchange";
import type { RatioEnvelope } from "../../packages/ratio-table-core/src/schema";
import { embedPortableFonts } from "../export/portable";
import { svgToPng } from "../export/png";
import {
  verifyPrintBytes,
  printRasterSize,
} from "../../packages/graph-core/src/png-bytes";
import {
  downloadBlob,
  copyWordSizedHtml,
  blobToDataUrl,
} from "../export/clipboard";

export async function ratioPrintPng(envelope: RatioEnvelope): Promise<Blob> {
  const valid = validateRatioEnvelope(envelope),
    metrics = ratioMetrics(valid.document);
  const svg = await embedPortableFonts(renderRatioSvg(valid.document));
  const png = await svgToPng(svg, metrics.widthCm, metrics.heightCm);
  const size = printRasterSize(metrics.widthCm, metrics.heightCm);
  verifyPrintBytes(
    new Uint8Array(await png.arrayBuffer()),
    size.width,
    size.height,
  );
  return png;
}
export async function downloadRatioImage(
  envelope: RatioEnvelope,
  format: "svg" | "png",
): Promise<void> {
  const valid = validateRatioEnvelope(envelope);
  const blob =
    format === "png"
      ? await ratioPrintPng(valid)
      : new Blob([await embedPortableFonts(renderRatioSvg(valid.document))], {
          type: "image/svg+xml;charset=utf-8",
        });
  downloadBlob(blob, `maths-ratio-table.${format}`);
}
export async function copyRatioForWord(envelope: RatioEnvelope): Promise<void> {
  const valid = validateRatioEnvelope(envelope),
    metrics = ratioMetrics(valid.document);
  const png = await ratioPrintPng(valid),
    url = await blobToDataUrl(png);
  const alternative = describeRatio(valid)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;");
  const html = `<img src="${url}" width="${metrics.widthCm}cm" height="${metrics.heightCm}cm" style="width:${metrics.widthCm}cm;height:${metrics.heightCm}cm" alt="${alternative}">`;
  try {
    if (!copyWordSizedHtml(html)) throw Error("Clipboard unavailable");
  } catch {
    throw Error(
      "The browser blocked copying. Download PNG (600 ppi) and insert it into Word instead.",
    );
  }
}
