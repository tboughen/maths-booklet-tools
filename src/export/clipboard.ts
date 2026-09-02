import type { DiagramDocumentV1 } from "../domain/types";
import { assertPrintReadyPng, renderDiagramPng } from "./png";
import { getExportMetrics, renderDiagramSvg } from "./svg";

function getLegacyCopyCommand(): ((commandId: string) => boolean) | undefined {
  return (document as unknown as { execCommand?: (commandId: string) => boolean }).execCommand;
}

function assertClipboardSupport(): void {
  if (!getLegacyCopyCommand()) {
    throw new Error("Clipboard images are unavailable. Use Download PNG (600 ppi) instead.");
  }
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("The image could not be prepared."));
    reader.readAsDataURL(blob);
  });
}

function copyWordSizedHtml(html: string): boolean {
  const executeCopy = getLegacyCopyCommand();
  if (!executeCopy) return false;
  const container = document.createElement("div");
  container.contentEditable = "true";
  container.setAttribute("aria-hidden", "true");
  Object.assign(container.style, {
    position: "fixed",
    left: "-10000px",
    top: "0",
    opacity: "0",
    pointerEvents: "none",
  });
  container.innerHTML = html;
  document.body.append(container);

  const selection = window.getSelection();
  if (!selection) {
    container.remove();
    return false;
  }

  const previousRanges = Array.from({ length: selection.rangeCount }, (_, index) => selection.getRangeAt(index).cloneRange());
  try {
    const range = document.createRange();
    range.selectNodeContents(container);
    selection.removeAllRanges();
    selection.addRange(range);
    return executeCopy.call(document, "copy");
  } finally {
    selection.removeAllRanges();
    previousRanges.forEach((range) => selection.addRange(range));
    container.remove();
  }
}

export async function copyDiagram(document: DiagramDocumentV1): Promise<void> {
  assertClipboardSupport();
  const metrics = getExportMetrics(document);
  const png = await renderDiagramPng(document);
  await assertPrintReadyPng(png, metrics.widthCm, metrics.heightCm);
  const dataUrl = await blobToDataUrl(png);
  const html = `<img src="${dataUrl}" width="${metrics.widthCm}cm" height="${metrics.heightCm}cm" style="width:${metrics.widthCm}cm;height:${metrics.heightCm}cm" alt="Coordinate graph">`;
  try {
    // Word ignores PNG density metadata from a raw browser clipboard image. Native
    // webpage copying preserves both the original PNG bytes and the CSS size in cm.
    if (!copyWordSizedHtml(html)) throw new Error("Clipboard images are unavailable.");
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
