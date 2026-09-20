import { getDocument, GlobalWorkerOptions, type PDFDocumentProxy } from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import type { BankQuestion, BankView, ViewRole } from "./model";

GlobalWorkerOptions.workerSrc = workerUrl;
const documents = new Map<string, Promise<PDFDocumentProxy>>();
export const assetUrl = (path: string) => `${import.meta.env.BASE_URL}${path.replace(/^\//, "")}`;

export function loadPdf(path: string, retry = false): Promise<PDFDocumentProxy> {
  if (retry) documents.delete(path);
  let pending = documents.get(path);
  if (!pending) {
    pending = getDocument({
      url: assetUrl(path),
      cMapUrl: assetUrl("bank/pdfjs/cmaps/"), cMapPacked: true,
      standardFontDataUrl: assetUrl("bank/pdfjs/standard_fonts/"),
      wasmUrl: assetUrl("bank/pdfjs/wasm/"),
      isEvalSupported: false,
    }).promise.catch(error => { documents.delete(path); throw error; });
    documents.set(path, pending);
  }
  return pending;
}

export async function renderPage(path: string, pageNumber: number, scale: number, signal?: AbortSignal): Promise<HTMLCanvasElement> {
  const pdf = await loadPdf(path);
  const page = await pdf.getPage(pageNumber);
  if (signal?.aborted) throw new DOMException("Cancelled", "AbortError");
  const natural = page.getViewport({scale: 1});
  const boundedScale = Math.min(scale, Math.sqrt(24_000_000 / (natural.width * natural.height)), 16000 / Math.max(natural.width, natural.height));
  const viewport = page.getViewport({scale: boundedScale});
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
  const context = canvas.getContext("2d", {alpha: false});
  if (!context) throw new Error("This browser could not draw the PDF. Use the downloadable PDF instead.");
  const task = page.render({canvas, canvasContext: context, viewport, background: "rgb(255,255,255)"});
  const abort = () => task.cancel();
  signal?.addEventListener("abort", abort, {once: true});
  try { await task.promise; } finally { signal?.removeEventListener("abort", abort); }
  return canvas;
}

export async function preloadQuestion(question: BankQuestion): Promise<void> {
  const pdf = await loadPdf(question.questionPdf);
  await pdf.getPage(1);
}

export function downloadBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url; anchor.download = name; anchor.style.display = "none";
  document.body.append(anchor); anchor.click(); anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export async function questionImage(question: BankQuestion, role: ViewRole, view: BankView, wholeQuestion: boolean): Promise<Blob> {
  const path = wholeQuestion && role === "question" ? question.printPdf : role === "scheme" ? question.schemePdf : question.questionPdf;
  const pdf = await loadPdf(path);
  const pageNumbers = wholeQuestion ? Array.from({length: pdf.numPages}, (_, i) => i + 1) : [view.page];
  const pages: HTMLCanvasElement[] = [];
  for (const number of pageNumbers) pages.push(await renderPage(path, number, 300 / 72));
  const width = Math.max(...pages.map(p => p.width));
  const gap = 40;
  const footer = 104;
  const height = pages.reduce((n, p) => n + p.height, 0) + gap * (pages.length - 1) + footer;
  if (width * height > 48_000_000 || height > 16000) throw new Error("This whole-question image is too large for a browser canvas. Download its PDF or export one view at a time.");
  const canvas = document.createElement("canvas"); canvas.width = width; canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Image export is unavailable. Download the PDF instead.");
  context.fillStyle = "#fff"; context.fillRect(0, 0, width, height);
  let y = 0;
  for (const page of pages) {context.drawImage(page, (width - page.width) / 2, y); y += page.height + gap;}
  context.fillStyle = "#253e59"; context.font = "28px Arial";
  context.fillText(`${question.source} · ${role === "scheme" ? "Mark scheme" : wholeQuestion ? "Whole question" : view.label}`, 24, height - 50, width - 48);
  context.fillStyle = "#536579"; context.font = "23px Arial";
  context.fillText("Edexcel GCSE Mathematics · Original source notation retained", 24, height - 18, width - 48);
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("The image could not be exported.")), "image/png"));
}
