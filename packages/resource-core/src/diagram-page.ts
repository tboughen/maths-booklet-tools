/**
 * One diagram on a printable page at its exact physical size (improvement items U32 and M24).
 * The page is A4 portrait when the diagram fits inside 15 mm margins, else A4 landscape, else A3;
 * the diagram is centred across the page, 15 mm from the top, and is never scaled. Print it at
 * "Actual size" (100 %) and a ruler on the paper matches the diagram's printed measurements.
 */
import { svgSizeMm } from "../../diagram-core/src/registry";

const MARGIN = 15;
const SHEETS = [
  { name: "A4 portrait", width: 210, height: 297 },
  { name: "A4 landscape", width: 297, height: 210 },
  { name: "A3 portrait", width: 297, height: 420 },
  { name: "A3 landscape", width: 420, height: 297 },
] as const;

const n = (v: number) => String(Math.round(v * 1e4) / 1e4);
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** The smallest sheet that holds a diagram of this size inside the margins. */
export function sheetFor(widthMm: number, heightMm: number) {
  const sheet = SHEETS.find((s) => widthMm <= s.width - 2 * MARGIN + 0.01 && heightMm <= s.height - 2 * MARGIN + 0.01);
  if (!sheet) throw Error(`The diagram is ${n(widthMm)} × ${n(heightMm)} mm, larger than an A3 page holds at actual size.`);
  return sheet;
}

/** A page SVG (sized in mm, as the PDF writer needs) holding the diagram at 1:1. */
export function diagramPage(svg: string, label = ""): string {
  const art = svg
    .replace(/^\s*<\?xml[^>]*\?>\s*/, "")
    // Website SVGs carry their own fonts; the PDF writer embeds the same fonts itself.
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<style>\s*@font-face[\s\S]*?<\/style>/g, "")
    .trimStart();
  const { width, height } = svgSizeMm(art);
  if (!(width > 0 && height > 0)) throw Error("The diagram did not report its physical size.");
  const sheet = sheetFor(width, height);
  const open = art.match(/^<svg\b[^>]*>/)?.[0];
  if (!open) throw Error("The diagram is not an SVG.");
  const placed = open
    .replace(/\swidth="[^"]*"/, ` width="${n(width)}"`)
    .replace(/\sheight="[^"]*"/, ` height="${n(height)}" x="${n((sheet.width - width) / 2)}" y="${MARGIN}"`);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${sheet.width}mm" height="${sheet.height}mm" viewBox="0 0 ${sheet.width} ${sheet.height}" role="img" aria-label="${esc(label || "Diagram at actual size")}"><rect width="${sheet.width}" height="${sheet.height}" fill="#fff"/>${placed}${art.slice(open.length)}</svg>`;
}
