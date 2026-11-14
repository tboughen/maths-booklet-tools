import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import type { GetDocument } from "../../packages/resource-core/src/page-check";

/** pdf.js with its worker, for reading back a PDF the website has just written (W31). */
GlobalWorkerOptions.workerSrc = workerUrl;
export const readPdf = getDocument as unknown as GetDocument;
