// Physical-size assertions for printed resources (improvement list L16). Physical size is part of
// the product: preview zoom never changes print size, and type or writing space is never shrunk to
// make something fit. These helpers read the size a file will print at, in millimetres, so unit
// gates and browser tests check the same thing the same way.
import { pngChunks } from "../../packages/graph-core/src/png-bytes";

const MM: Record<string, number> = { mm: 1, cm: 10, in: 25.4, pt: 25.4 / 72 };
const INCHES_PER_METRE = 39.37007874;

export type SvgPrintSize = {
  /** Printed width and height from the root's absolute width/height (NaN when not absolute). */
  widthMm: number;
  heightMm: number;
  /** The root viewBox width and height (NaN when missing). */
  vw: number;
  vh: number;
  /** Millimetres per user unit, horizontally. */
  mmPerUnit: number;
};

/** The size an SVG prints at, from its root element. */
export function svgPrintSize(svg: string): SvgPrintSize {
  const root = svg.match(/<svg\b[^>]*>/)?.[0] ?? "";
  const attr = (n: string) => root.match(new RegExp(`\\s${n}="([^"]+)"`))?.[1];
  const size = (v?: string) => {
    const m = v?.trim().match(/^([\d.]+)(mm|cm|in|pt)$/);
    return m ? Number(m[1]) * MM[m[2]] : NaN;
  };
  const box = (attr("viewBox") ?? "")
    .trim()
    .split(/[\s,]+/)
    .map(Number);
  const widthMm = size(attr("width")),
    heightMm = size(attr("height")),
    vw = box.length === 4 ? box[2] : NaN,
    vh = box.length === 4 ? box[3] : NaN;
  return { widthMm, heightMm, vw, vh, mmPerUnit: widthMm / vw };
}

/** Problems with an SVG's print size: absolute units, a viewBox and one scale for both axes. */
export function svgPrintSizeProblems(svg: string): string[] {
  const p = svgPrintSize(svg);
  if (!(p.widthMm > 0 && p.heightMm > 0))
    return ["width/height not in mm, cm, in or pt"];
  if (!(p.vw > 0 && p.vh > 0)) return ["missing viewBox"];
  const x = p.widthMm / p.vw,
    y = p.heightMm / p.vh;
  return Math.abs(x - y) > 0.005 * x
    ? ["width and height scale differently"]
    : [];
}

/** The smallest declared font size in points at print size, or null when the SVG declares none. */
export function minFontPt(
  svg: string,
  mmPerUnit = svgPrintSize(svg).mmPerUnit,
): number | null {
  const sizes = [
    ...svg.matchAll(/font-size(?:="|\s*:\s*)([\d.]+)(px|pt|mm)?/g),
  ].map((m) => {
    const n = Number(m[1]),
      unit = m[2];
    return unit === "pt"
      ? n
      : unit === "mm"
        ? (n * 72) / 25.4
        : (n * mmPerUnit * 72) / 25.4;
  });
  return sizes.length ? Math.min(...sizes) : null;
}

export type PngPrintSize = {
  width: number;
  height: number;
  ppi: number;
  widthMm: number;
  heightMm: number;
};

/** The size a PNG prints at, from its pixel size and its pHYs density (which must be per metre). */
export function pngPrintSize(bytes: Uint8Array): PngPrintSize {
  const chunks = pngChunks(bytes),
    ihdr = chunks[0];
  if (ihdr?.type !== "IHDR")
    throw Error("Not a PNG: the first chunk is not IHDR.");
  const header = new DataView(
    ihdr.data.buffer,
    ihdr.data.byteOffset,
    ihdr.data.length,
  );
  const width = header.getUint32(0),
    height = header.getUint32(4);
  const physical = chunks.filter((c) => c.type === "pHYs");
  if (physical.length !== 1)
    throw Error("The PNG has no single pHYs density chunk.");
  const d = new DataView(
    physical[0].data.buffer,
    physical[0].data.byteOffset,
    physical[0].data.length,
  );
  const x = d.getUint32(0),
    y = d.getUint32(4),
    unit = d.getUint8(8);
  if (unit !== 1) throw Error("The PNG density is not in pixels per metre.");
  if (x !== y)
    throw Error("The PNG density differs horizontally and vertically.");
  const ppi = x / INCHES_PER_METRE;
  return {
    width,
    height,
    ppi,
    widthMm: (width / ppi) * 25.4,
    heightMm: (height / ppi) * 25.4,
  };
}

/**
 * Problems when a PNG would not print at the same size as its SVG. The PNG's size may differ by
 * the rounding of one pixel at its own density.
 */
export function samePrintSizeProblems(svg: string, png: Uint8Array): string[] {
  const s = svgPrintSize(svg),
    p = pngPrintSize(png),
    pixelMm = 25.4 / p.ppi,
    problems: string[] = [];
  if (Math.abs(s.widthMm - p.widthMm) > pixelMm)
    problems.push(
      `PNG prints ${p.widthMm.toFixed(2)} mm wide, SVG ${s.widthMm.toFixed(2)} mm`,
    );
  if (Math.abs(s.heightMm - p.heightMm) > pixelMm)
    problems.push(
      `PNG prints ${p.heightMm.toFixed(2)} mm high, SVG ${s.heightMm.toFixed(2)} mm`,
    );
  return problems;
}
