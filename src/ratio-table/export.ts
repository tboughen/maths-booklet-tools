import { downloadBothCopies } from "../export/bothCopies";
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
import { downloadName } from "../export/filenames";
import { svgPdf } from "../export/diagram-pdf";
import { answerArt, copySizeCm } from "../export/worked";
import { workedOf } from "../../packages/envelope-core/src/worked";

/** Whether the table has an answers copy: hidden cells, hidden operations or worked notes (U116). */
export const hasRatioAnswers = (envelope: RatioEnvelope) =>
  workedOf(envelope).length > 0 ||
  envelope.document.rows.some((r) => r.cells.some((c) => c.kind === "hidden")) ||
  envelope.document.transitions.some((t) => t.hidden);
/** The table's artwork for one copy; worked notes (U116) print on the answers copy only. */
const ratioArt = (valid: RatioEnvelope, view: RatioView) => answerArt(renderRatioSvg(valid.document, view), valid, view === "answer");
export async function ratioPrintPng(envelope: RatioEnvelope, view: RatioView = "pupil"): Promise<Blob> {
  const valid = validateRatioEnvelope(envelope),
    metrics = ratioMetrics(valid.document);
  const svg = await embedPortableFonts(ratioArt(valid, view));
  const cm = copySizeCm(svg, metrics.widthCm, metrics.heightCm);
  const png = await svgToPng(svg, cm.width, cm.height);
  const size = printRasterSize(cm.width, cm.height);
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
      ? await svgPdf(ratioArt(valid, view))
      : format === "png"
      ? await ratioPrintPng(valid, view)
      : new Blob([await embedPortableFonts(ratioArt(valid, view))], {
          type: "image/svg+xml;charset=utf-8",
        });
  downloadBlob(blob, downloadName("ratio-table", format, { resource: valid, answers: view === "answer" }));
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

/** Pupil and answers copies in one ZIP (U28); the editor's view is not used. */
export async function downloadRatioBoth(envelope: RatioEnvelope) {
  const valid = validateRatioEnvelope(envelope);
  await downloadBothCopies("ratio-table", valid, async (view) => ({
    svg: await embedPortableFonts(ratioArt(valid, view)),
    png: await ratioPrintPng(valid, view),
  }));
}
