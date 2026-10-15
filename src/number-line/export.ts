import { validate, metrics, renderSvg, describe, type Envelope } from "../../packages/number-line-core/src";
import { embedPortableFonts } from "../export/portable";
import { svgToPng } from "../export/png";
import { verifyPrintBytes, printRasterSize } from "../../packages/graph-core/src/png-bytes";
import { downloadBlob, copyWordSizedHtml, blobToDataUrl } from "../export/clipboard";
export async function printPng(e: Envelope) { const v = validate(e), m = metrics(v.document); const png = await svgToPng(await embedPortableFonts(renderSvg(v)), m.widthCm, m.heightCm); const s = printRasterSize(m.widthCm, m.heightCm); verifyPrintBytes(new Uint8Array(await png.arrayBuffer()), s.width, s.height); return png; }
export async function downloadImage(e: Envelope, format: "png" | "svg") { const blob = format === "png" ? await printPng(e) : new Blob([await embedPortableFonts(renderSvg(e))], { type: "image/svg+xml" }); downloadBlob(blob, `maths-number-line.${format}`); }
export async function copyWord(e: Envelope) { const m = metrics(e.document), url = await blobToDataUrl(await printPng(e)), alt = describe(e).replaceAll("&", "&amp;").replaceAll('"', "&quot;"); if (!copyWordSizedHtml(`<img src="${url}" width="${m.widthCm}cm" height="${m.heightCm}cm" style="width:${m.widthCm}cm;height:${m.heightCm}cm" alt="${alt}">`))
    throw Error("Copying was blocked. Download PNG (600 ppi) and insert it into Word."); }
