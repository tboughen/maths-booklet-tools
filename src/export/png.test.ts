import { describe, expect, it } from "vitest";
import { cloneDefaultDocument } from "../domain/diagram";
import { getExportMetrics } from "./svg";
import {
  assertPrintReadyPng,
  getPngRasterSize,
  readPngMetadata,
  setPngDensity,
} from "./png";

const signature = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

function writeUint32(target: Uint8Array, offset: number, value: number) {
  new DataView(target.buffer).setUint32(offset, value);
}

function chunk(type: string, data = new Uint8Array()): Uint8Array {
  const result = new Uint8Array(12 + data.length);
  writeUint32(result, 0, data.length);
  result.set(new TextEncoder().encode(type), 4);
  result.set(data, 8);
  return result;
}

function fakePng(...chunks: Uint8Array[]): Blob {
  return new Blob([signature, ...chunks], { type: "image/png" });
}

function headerData(width: number, height: number): Uint8Array {
  const data = new Uint8Array(13);
  writeUint32(data, 0, width);
  writeUint32(data, 4, height);
  data[8] = 8;
  data[9] = 6;
  return data;
}

function densityData(pixelsPerMetre: number): Uint8Array {
  const data = new Uint8Array(9);
  writeUint32(data, 0, pixelsPerMetre);
  writeUint32(data, 4, pixelsPerMetre);
  data[8] = 1;
  return data;
}

function readChunks(bytes: Uint8Array) {
  const found: Array<{ type: string; data: Uint8Array }> = [];
  let offset = 8;
  while (offset + 12 <= bytes.length) {
    const length = new DataView(bytes.buffer, bytes.byteOffset + offset).getUint32(0);
    const type = new TextDecoder().decode(bytes.slice(offset + 4, offset + 8));
    found.push({ type, data: bytes.slice(offset + 8, offset + 8 + length) });
    offset += length + 12;
  }
  return found;
}

function readBlob(blob: Blob): Promise<ArrayBuffer> {
  const modernBlob = blob as Blob & { arrayBuffer?: () => Promise<ArrayBuffer> };
  if (typeof modernBlob.arrayBuffer === "function") return modernBlob.arrayBuffer();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error ?? new Error("Could not read test blob"));
    reader.readAsArrayBuffer(blob);
  });
}

describe("PNG print density", () => {
  it("calculates the tightly cropped default diagram at 600 ppi", () => {
    const metrics = getExportMetrics(cloneDefaultDocument());

    expect({ widthCm: metrics.widthCm, heightCm: metrics.heightCm }).toEqual({ widthCm: 11.24, heightCm: 11.12 });
    expect(getPngRasterSize(metrics.widthCm, metrics.heightCm)).toEqual({ width: 2655, height: 2627 });
  });

  it("adds a 600 ppi pHYs chunk immediately after the header", async () => {
    const output = await setPngDensity(fakePng(chunk("IHDR", new Uint8Array(13)), chunk("IEND")));
    const chunks = readChunks(new Uint8Array(await readBlob(output)));

    expect(chunks.map(({ type }) => type)).toEqual(["IHDR", "pHYs", "IEND"]);
    const density = new DataView(chunks[1].data.buffer, chunks[1].data.byteOffset);
    expect(density.getUint32(0)).toBe(23622);
    expect(density.getUint32(4)).toBe(23622);
    expect(chunks[1].data[8]).toBe(1);
  });

  it("replaces an existing density chunk instead of duplicating it", async () => {
    const existingDensity = new Uint8Array(9);
    const output = await setPngDensity(fakePng(chunk("IHDR", new Uint8Array(13)), chunk("pHYs", existingDensity), chunk("IEND")), 11811);
    const chunks = readChunks(new Uint8Array(await readBlob(output)));

    expect(chunks.filter(({ type }) => type === "pHYs")).toHaveLength(1);
    const density = new DataView(chunks[1].data.buffer, chunks[1].data.byteOffset);
    expect(density.getUint32(0)).toBe(11811);
  });

  it("verifies the raster dimensions and 600 ppi density before export", async () => {
    const printReady = fakePng(
      chunk("IHDR", headerData(2655, 2627)),
      chunk("pHYs", densityData(23622)),
      chunk("IEND"),
    );

    await expect(assertPrintReadyPng(printReady, 11.24, 11.12)).resolves.toBeUndefined();
    await expect(readPngMetadata(printReady)).resolves.toEqual({
      width: 2655,
      height: 2627,
      horizontalPixelsPerMetre: 23622,
      verticalPixelsPerMetre: 23622,
      densityUnit: 1,
    });
  });

  it("rejects a Word-downsampled 150 ppi rendition", async () => {
    const downsampled = fakePng(
      chunk("IHDR", headerData(691, 682)),
      chunk("pHYs", densityData(5905)),
      chunk("IEND"),
    );

    await expect(assertPrintReadyPng(downsampled, 11.7, 11.55)).rejects.toThrow("print-quality PNG could not be verified");
    await expect(assertPrintReadyPng(new Blob(["not a PNG"], { type: "image/png" }), 11.7, 11.55)).rejects.toThrow("Use Download PNG (600 ppi) instead");
  });
});
