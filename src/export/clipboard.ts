import type { DiagramDocumentV1 } from "../domain/types";
import { assertPrintReadyPng, renderDiagramPng } from "./png";
import { getExportMetrics, renderDiagramSvg } from "./svg";

function assertImageClipboardSupport(): void {
  if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined") {
    throw new Error("Clipboard images are unavailable. Use Download PNG (600 ppi) instead.");
  }
}

export async function copyDiagram(document: DiagramDocumentV1): Promise<void> {
  assertImageClipboardSupport();
  const metrics = getExportMetrics(document);
  const png = await renderDiagramPng(document);
  await assertPrintReadyPng(png, metrics.widthCm, metrics.heightCm);
  try {
    await navigator.clipboard.write([new ClipboardItem({ "image/png": png })]);
  } catch {
    throw new Error("The browser blocked copying. Use Download PNG (600 ppi) instead.");
  }
}

function downloadBlob(blob: Blob, filename: string): void {
  const anchor = document.createElement("a");
  const url = URL.createObjectURL(blob);
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadDiagramSvg(document: DiagramDocumentV1): void {
  downloadBlob(new Blob([renderDiagramSvg(document)], { type: "image/svg+xml;charset=utf-8" }), "maths-graph.svg");
}

export async function downloadDiagramPng(document: DiagramDocumentV1): Promise<void> {
  downloadBlob(await renderDiagramPng(document), "maths-graph.png");
}
