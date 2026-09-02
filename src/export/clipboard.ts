import type { DiagramDocumentV1 } from "../domain/types";
import { renderDiagramPng } from "./png";
import { getExportMetrics, renderDiagramSvg } from "./svg";

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("The image could not be prepared."));
    reader.readAsDataURL(blob);
  });
}

async function writeClipboardRepresentations(representations: Record<string, Blob>): Promise<void> {
  if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined") {
    throw new Error("Clipboard images are not supported in this browser.");
  }
  await navigator.clipboard.write([new ClipboardItem(representations)]);
}

export async function copyDiagram(document: DiagramDocumentV1): Promise<void> {
  const svg = renderDiagramSvg(document);
  const metrics = getExportMetrics(document);
  const png = await renderDiagramPng(document);
  const dataUrl = await blobToDataUrl(png);
  const html = `<img src="${dataUrl}" width="${metrics.widthCm}cm" height="${metrics.heightCm}cm" style="width:${metrics.widthCm}cm;height:${metrics.heightCm}cm" alt="Coordinate graph">`;
  const baseRepresentations: Record<string, Blob> = {
    "image/png": png,
    "text/html": new Blob([html], { type: "text/html" }),
  };
  const supportsSvg = typeof ClipboardItem !== "undefined"
    && typeof ClipboardItem.supports === "function"
    && ClipboardItem.supports("image/svg+xml");

  if (supportsSvg) {
    try {
      await writeClipboardRepresentations({
        ...baseRepresentations,
        "image/svg+xml": new Blob([svg], { type: "image/svg+xml" }),
      });
      return;
    } catch {
      // Some browsers report SVG support but reject mixed clipboard items.
    }
  }
  try {
    await writeClipboardRepresentations(baseRepresentations);
  } catch {
    await writeClipboardRepresentations({ "image/png": png });
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
