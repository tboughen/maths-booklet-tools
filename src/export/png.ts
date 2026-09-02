import { getExportMetrics, renderDiagramSvg } from "./svg";
import type { DiagramDocumentV1 } from "../domain/types";

const PNG_SIGNATURE_LENGTH = 8;
const PIXELS_PER_METRE_600_DPI = 23622;

function writeUint32(target: Uint8Array, offset: number, value: number): void {
  target[offset] = (value >>> 24) & 0xff;
  target[offset + 1] = (value >>> 16) & 0xff;
  target[offset + 2] = (value >>> 8) & 0xff;
  target[offset + 3] = value & 0xff;
}

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) value = (value & 1) ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    table[index] = value >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function makeDensityChunk(pixelsPerMetre: number): Uint8Array {
  const chunk = new Uint8Array(4 + 4 + 9 + 4);
  writeUint32(chunk, 0, 9);
  chunk.set(new TextEncoder().encode("pHYs"), 4);
  writeUint32(chunk, 8, pixelsPerMetre);
  writeUint32(chunk, 12, pixelsPerMetre);
  chunk[16] = 1;
  writeUint32(chunk, 17, crc32(chunk.slice(4, 17)));
  return chunk;
}

export async function setPngDensity(blob: Blob, pixelsPerMetre = PIXELS_PER_METRE_600_DPI): Promise<Blob> {
  const source = new Uint8Array(await readBlobAsArrayBuffer(blob));
  const outputParts: Uint8Array[] = [source.slice(0, PNG_SIGNATURE_LENGTH)];
  let offset = PNG_SIGNATURE_LENGTH;
  let inserted = false;
  while (offset + 12 <= source.length) {
    const view = new DataView(source.buffer, source.byteOffset + offset);
    const length = view.getUint32(0);
    const end = offset + 12 + length;
    if (end > source.length) throw new Error("The generated PNG is invalid.");
    const type = new TextDecoder().decode(source.slice(offset + 4, offset + 8));
    if (type !== "pHYs") outputParts.push(source.slice(offset, end));
    if (type === "IHDR" && !inserted) {
      outputParts.push(makeDensityChunk(pixelsPerMetre));
      inserted = true;
    }
    offset = end;
    if (type === "IEND") break;
  }
  return new Blob(outputParts, { type: "image/png" });
}

function readBlobAsArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
  const modernBlob = blob as Blob & { arrayBuffer?: () => Promise<ArrayBuffer> };
  if (typeof modernBlob.arrayBuffer === "function") return modernBlob.arrayBuffer();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error ?? new Error("The PNG could not be read."));
    reader.readAsArrayBuffer(blob);
  });
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("The PNG could not be created.")), "image/png");
  });
}

export async function svgToPng(svg: string, widthCm: number, heightCm: number, dpi = 600): Promise<Blob> {
  const image = new Image();
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("The diagram could not be rendered."));
      image.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round((widthCm / 2.54) * dpi));
    canvas.height = Math.max(1, Math.round((heightCm / 2.54) * dpi));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("The browser cannot create the PNG.");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return setPngDensity(await canvasToBlob(canvas), Math.round(dpi / 0.0254));
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function renderDiagramPng(document: DiagramDocumentV1): Promise<Blob> {
  const metrics = getExportMetrics(document);
  return svgToPng(renderDiagramSvg(document), metrics.widthCm, metrics.heightCm, 600);
}
