import {
  canonical,
  renderSvg,
  validate,
  type Envelope,
} from "../../packages/cuboid-core/src";
import { embedPortableFonts } from "../export/portable";
import { svgToPng } from "../export/png";
import {
  printRasterSize,
  verifyPrintBytes,
} from "../../packages/graph-core/src/png-bytes";
import {
  blobToDataUrl,
  copyWordSizedHtml,
  downloadBlob,
} from "../export/clipboard";

export async function prepareImage(e: Envelope) {
  const source = await embedPortableFonts(renderSvg(e));
  const svg = new DOMParser().parseFromString(source, "image/svg+xml")
    .documentElement as unknown as SVGSVGElement;
  const background = svg.querySelector(":scope > rect")!;
  const art = document.createElementNS("http://www.w3.org/2000/svg", "g");
  for (const child of Array.from(svg.children)) {
    if (child !== background && !["defs", "style"].includes(child.localName))
      art.append(child);
  }
  svg.append(art);
  background.remove();
  const host = document.createElement("div");
  host.inert = true;
  host.setAttribute("aria-hidden", "true");
  Object.assign(host.style, {
    position: "fixed",
    left: "-10000px",
    top: "0",
    opacity: "0",
    pointerEvents: "none",
  });
  host.append(svg);
  document.body.append(host);
  try {
    // Measure the actual bundled font, including custom labels and pupil blanks.
    const fonts = await document.fonts.load(
      '3.88px "STIX Two Text"',
      art.textContent || "Cuboid",
    );
    if (!fonts.length)
      throw Error("The portable print font could not be loaded.");
    const b = art.getBBox();
    if (
      ![b.x, b.y, b.width, b.height].every(Number.isFinite) ||
      !b.width ||
      !b.height
    )
      throw Error("The image boundaries could not be measured.");
    // Default getBBox excludes strokes and markers. Include their full extent
    // before adding the margin, including SVG consumers' start-arrow handling.
    let left = b.x - 0.125,
      top = b.y - 0.125,
      endX = b.x + b.width + 0.125,
      endY = b.y + b.height + 0.125;
    for (const arrow of art.querySelectorAll<SVGGraphicsElement>(
      "[marker-start], [marker-end]",
    )) {
      const a = arrow.getBBox();
      left = Math.min(left, a.x - 1.6);
      top = Math.min(top, a.y - 1.6);
      endX = Math.max(endX, a.x + a.width + 1.6);
      endY = Math.max(endY, a.y + a.height + 1.6);
    }
    const x = Math.floor((left - 2) * 100) / 100,
      y = Math.floor((top - 2) * 100) / 100,
      right = Math.ceil((endX + 2) * 100) / 100,
      bottom = Math.ceil((endY + 2) * 100) / 100,
      width = (right - x) / 10,
      height = (bottom - y) / 10;
    svg.setAttribute("viewBox", `${x} ${y} ${right - x} ${bottom - y}`);
    svg.setAttribute("width", `${width}cm`);
    svg.setAttribute("height", `${height}cm`);
    background.setAttribute("x", String(x));
    background.setAttribute("y", String(y));
    background.setAttribute("width", String(right - x));
    background.setAttribute("height", String(bottom - y));
    svg.insertBefore(background, art);
    return { svg: new XMLSerializer().serializeToString(svg), width, height };
  } finally {
    host.remove();
  }
}

async function rasterImage(m: Awaited<ReturnType<typeof prepareImage>>) {
  const png = await svgToPng(m.svg, m.width, m.height),
    size = printRasterSize(m.width, m.height);
  verifyPrintBytes(
    new Uint8Array(await png.arrayBuffer()),
    size.width,
    size.height,
  );
  return png;
}
export async function printPng(e: Envelope): Promise<Blob> {
  return rasterImage(await prepareImage(e));
}
export async function downloadImage(e: Envelope, format: "png" | "svg") {
  const blob =
    format === "png"
      ? await printPng(e)
      : new Blob([(await prepareImage(e)).svg], {
          type: "image/svg+xml;charset=utf-8",
        });
  downloadBlob(blob, `maths-cuboids.${format}`);
}
export function downloadEditable(e: Envelope) {
  downloadBlob(
    new Blob([canonical(validate(e))], { type: "application/json" }),
    "maths-cuboids.json",
  );
}
export async function copyWord(e: Envelope) {
  const m = await prepareImage(e),
    url = await blobToDataUrl(await rasterImage(m));
  if (
    !copyWordSizedHtml(
      `<img src="${url}" width="${m.width}cm" height="${m.height}cm" style="width:${m.width}cm;height:${m.height}cm" alt="Cuboid diagrams">`,
    )
  )
    throw Error(
      "The browser blocked copying. Download PNG (600 ppi) and insert it into Word instead.",
    );
}
