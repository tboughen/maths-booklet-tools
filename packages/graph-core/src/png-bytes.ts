export const PRINT_DPI = 600;
const SIGNATURE = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
export function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++)
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
type Chunk = { type: string; data: Uint8Array; raw: Uint8Array };
export function pngChunks(bytes: Uint8Array): Chunk[] {
  if (!SIGNATURE.every((b, i) => bytes[i] === b))
    throw Error("Invalid PNG signature.");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength),
    chunks: Chunk[] = [];
  let offset = 8;
  while (offset + 12 <= bytes.length) {
    const length = view.getUint32(offset),
      end = offset + 12 + length;
    if (end > bytes.length) throw Error("Truncated PNG.");
    const type = new TextDecoder().decode(
      bytes.subarray(offset + 4, offset + 8),
    );
    if (crc32(bytes.subarray(offset + 4, end - 4)) !== view.getUint32(end - 4))
      throw Error("PNG checksum mismatch.");
    chunks.push({
      type,
      data: bytes.subarray(offset + 8, end - 4),
      raw: bytes.subarray(offset, end),
    });
    offset = end;
    if (type === "IEND") break;
  }
  if (
    chunks[0]?.type !== "IHDR" ||
    chunks[0].data.length !== 13 ||
    chunks.at(-1)?.type !== "IEND" ||
    offset !== bytes.length
  )
    throw Error("Invalid PNG structure.");
  return chunks;
}
export function setDensityBytes(
  bytes: Uint8Array,
  dpi = PRINT_DPI,
): Uint8Array {
  const chunks = pngChunks(bytes),
    density = new Uint8Array(21),
    v = new DataView(density.buffer);
  v.setUint32(0, 9);
  density.set(new TextEncoder().encode("pHYs"), 4);
  v.setUint32(8, Math.round(dpi / 0.0254));
  v.setUint32(12, Math.round(dpi / 0.0254));
  density[16] = 1;
  v.setUint32(17, crc32(density.subarray(4, 17)));
  const parts = [
    SIGNATURE,
    ...chunks.flatMap((c) =>
      c.type === "pHYs" ? [] : c.type === "IHDR" ? [c.raw, density] : [c.raw],
    ),
  ];
  const result = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}
export function printRasterSize(
  widthCm: number,
  heightCm: number,
  dpi = PRINT_DPI,
) {
  return {
    width: Math.round((widthCm / 2.54) * dpi),
    height: Math.round((heightCm / 2.54) * dpi),
  };
}
export function verifyPrintBytes(
  bytes: Uint8Array,
  width: number,
  height: number,
  dpi = PRINT_DPI,
): void {
  const chunks = pngChunks(bytes),
    ihdr = chunks[0].data,
    header = new DataView(ihdr.buffer, ihdr.byteOffset, ihdr.length);
  const physical = chunks.filter((c) => c.type === "pHYs");
  if (physical.length !== 1 || physical[0].data.length !== 9)
    throw Error("Missing PNG density.");
  const data = physical[0].data,
    density = new DataView(data.buffer, data.byteOffset, data.length),
    expected = Math.round(dpi / 0.0254);
  if (
    header.getUint32(0) !== width ||
    header.getUint32(4) !== height ||
    density.getUint32(0) !== expected ||
    density.getUint32(4) !== expected ||
    data[8] !== 1
  )
    throw Error("PNG dimensions or density do not match its physical size.");
}
