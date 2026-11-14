import {
  renderRatioSvg,
  ratioMetrics,
  describeRatio,
  validateRatioEnvelope,
} from "../../packages/ratio-table-core/src/interchange";
import type { RatioEnvelope } from "../../packages/ratio-table-core/src/schema";
import type { RatioView } from "../../packages/ratio-table-core/src/svg";
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
import { svgPdf } from "../export/diagram-pdf";

/** Whether the table has an answers copy: hidden cells or hidden operations. */
export const hasRatioAnswers = (envelope: RatioEnvelope) =>
  envelope.document.rows.some((r) => r.cells.some((c) => c.kind === "hidden")) ||
  envelope.document.transitions.some((t) => t.hidden);
export async function ratioPrintPng(envelope: RatioEnvelope, view: RatioView = "pupil"): Promise<Blob> {
  const valid = validateRatioEnvelope(envelope),
    metrics = ratioMetrics(valid.document);
  const svg = await embedPortableFonts(renderRatioSvg(valid.document, view));
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
  format: "svg" | "png" | "pdf",
  view: RatioView = "pupil",
): Promise<void> {
  const valid = validateRatioEnvelope(envelope);
  const blob =
    format === "pdf"
      ? await svgPdf(renderRatioSvg(valid.document, view))
      : format === "png"
      ? await ratioPrintPng(valid, view)
      : new Blob([await embedPortableFonts(renderRatioSvg(valid.document, view))], {
          type: "image/svg+xml;charset=utf-8",
        });
  downloadBlob(blob, `maths-ratio-table${view === "answer" ? "-answers" : ""}.${format}`);
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
