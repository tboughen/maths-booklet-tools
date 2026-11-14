import type { DiagramDocumentV1 } from "../domain/types";
import { assertPrintReadyPng, renderDiagramPng } from "./png";
import { getExportMetrics, renderDiagramSvg } from "./svg";
import { embedPortableFonts } from "./portable";
import { tidySvgRoot } from "../../packages/envelope-core/src/svg-root";

function getLegacyCopyCommand(): ((commandId: string) => boolean) | undefined {
  return (document as unknown as { execCommand?: (commandId: string) => boolean }).execCommand;
}

function assertClipboardSupport(): void {
  if (!getLegacyCopyCommand()) {
    throw new Error("Clipboard images are unavailable. Use Download PNG (600 ppi) instead.");
  }
}

/** Write immediately in the click handler; PNG preparation can finish asynchronously. */
export async function copyPngToClipboard(render: () => Promise<Blob>): Promise<void> {
  if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined") {
    throw new Error("Image copying is unavailable in this browser. Use Copy for Word or Download PNG (600 ppi) instead.");
  }
  try {
    await navigator.clipboard.write([new ClipboardItem({ "image/png": render() })]);
  } catch {
    throw new Error("The browser blocked image copying. Use Copy for Word or Download PNG (600 ppi) instead.");
  }
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("The image could not be prepared."));
    reader.readAsDataURL(blob);
  });
}

const unescapeXml = (s: string) => s.replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
/**
 * Alt text for an image copied for Word (U37): the artwork's own aria-label, else its title and
 * description, else the fallback. Website copies are pupil copies, so this never names a hidden
 * answer (the answer-leak check covers aria-label, title and desc). Escaped for an attribute.
 */
export function svgAlt(svg: string, fallback: string): string {
  const open = svg.match(/<svg\b[^>]*>/)?.[0] ?? "";
  const label = open.match(/\saria-label="([^"]*)"/)?.[1];
  const title = svg.match(/<title\b[^>]*>([^<]*)<\/title>/)?.[1];
  const desc = svg.match(/<desc\b[^>]*>([^<]*)<\/desc>/)?.[1];
  const text = (label ? unescapeXml(label) : title ? [title, desc].filter(Boolean).map((t) => unescapeXml(t!).trim()).join(". ") : "").trim() || fallback;
  return text.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function copyWordSizedHtml(html: string): boolean {
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
  const html = `<img src="${dataUrl}" width="${metrics.widthCm}cm" height="${metrics.heightCm}cm" style="width:${metrics.widthCm}cm;height:${metrics.heightCm}cm" alt="${svgAlt(renderDiagramSvg(document), "Coordinate graph")}">`;
  try {
    // Word ignores PNG density metadata from a raw browser clipboard image. Native
    // webpage copying preserves both the original PNG bytes and the CSS size in cm.
    if (!copyWordSizedHtml(html)) throw new Error("Clipboard images are unavailable.");
  } catch {
    throw new Error("The browser blocked copying. Use Download PNG (600 ppi) instead.");
  }
}

export function downloadBlob(blob: Blob, filename: string): void {
  const anchor = document.createElement("a");
  const url = URL.createObjectURL(blob);
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function downloadDiagramSvg(document: DiagramDocumentV1): Promise<void> {
  const source = renderDiagramSvg(document);
  const svg = document.styleProfile === "portable-v1" ? await embedPortableFonts(source) : tidySvgRoot(source);
  downloadBlob(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }), "maths-graph.svg");
}

export async function downloadDiagramPdf(document: DiagramDocumentV1): Promise<void> {
  const { svgPdf } = await import("./diagram-pdf");
  downloadBlob(await svgPdf(renderDiagramSvg(document)), "maths-graph.pdf");
}

export async function downloadDiagramPng(document: DiagramDocumentV1): Promise<void> {
  downloadBlob(await renderDiagramPng(document), "maths-graph.png");
}
