import type { RatioDocument, RatioCell } from "./schema";
import { RatioError } from "./numbers";
import { glyphAdvance } from "./font-metrics";

const FONT = (12 / 72) * 2.54 * 100;
export function textWidth(text: string, size = FONT, italic = false): number {
  return Array.from(text).reduce(
    (sum, c) => sum + glyphAdvance(c, italic) * size,
    0,
  );
}
function printed(value: string) {
  return value.replaceAll("-", "−");
}
export function numberWidth(value: string, size = FONT): number {
  const [top, bottom] = printed(value).split("/");
  return bottom
    ? Math.max(textWidth(top, size * 0.8), textWidth(bottom, size * 0.8)) + 10
    : textWidth(top, size);
}
export function ratioMetrics(document: RatioDocument) {
  const scale = { compact: 0.8, standard: 1, large: 1.2 }[document.size];
  const annotated =
    document.mode === "annotated" && document.transitions.length > 0;
  let gutter = 0;
  if (annotated && (document.showArrows || document.showOperations)) {
    const operationWidth = document.showOperations
      ? Math.max(
          ...document.transitions.map(
            (t) => 32 + numberWidth(t.factor, FONT * 0.8),
          ),
        )
      : 0;
    gutter = Math.max(
      document.showArrows ? 48 : 0,
      operationWidth + (document.showArrows ? 62 : 18),
    );
  }
  for (const heading of document.headings) {
    if (
      textWidth(heading.text, FONT, heading.italic) +
        (heading.direction !== "none" ? 38 : 0) >
      126
    )
      throw new RatioError(
        "layout_overflow",
        "A heading is too wide for this table. Use a shorter heading.",
      );
  }
  for (const row of document.rows)
    for (const cell of row.cells)
      if (cell.kind === "number" && numberWidth(cell.value) > 126)
        throw new RatioError(
          "layout_overflow",
          `A value in ${row.id} is too wide for the table. Use a shorter value or fraction.`,
        );
  const width = 330 + gutter * 2,
    height = (document.rows.length + 1) * 100 + 30;
  return {
    width,
    height,
    tableLeft: 15 + gutter,
    tableTop: 15,
    gutter,
    widthCm: (width / 100) * scale,
    heightCm: (height / 100) * scale,
    scale,
  };
}
function escape(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
function text(
  value: string,
  x: number,
  baseline: number,
  size = FONT,
  italic = false,
) {
  return `<text fill="#202020" x="${x}" y="${baseline}" font-size="${size}" text-anchor="middle"${italic ? ' font-style="italic"' : ""}>${escape(value)}</text>`;
}
function number(value: string, x: number, y: number, size = FONT) {
  const [top, bottom] = printed(value).split("/");
  if (!bottom) return text(top, x, y + size * 0.31, size);
  const small = size * 0.8,
    bar = Math.max(textWidth(top, small), textWidth(bottom, small)) + 8;
  return (
    text(top, x, y - size * 0.15, small) +
    `<path d="M${x - bar / 2} ${y}H${x + bar / 2}" stroke-width="2"/>` +
    text(bottom, x, y + size * 0.78, small)
  );
}
function cellMarkup(cell: RatioCell, x: number, y: number) {
  if (cell.kind === "number") return number(cell.value, x, y);
  if (cell.kind === "answer-line")
    return `<path class="ratio-answer-line" d="M${x - 30} ${y + 16}H${x + 30}" stroke-width="2"/>`;
  return "";
}
function arrow(x: number, y: number, direction: "up" | "right") {
  return direction === "right"
    ? `<path d="M${x - 12} ${y}H${x + 12}" stroke-width="2"/><path d="M${x + 12} ${y}l-8 -5v10Z" fill="#202020" stroke="none"/>`
    : `<path d="M${x} ${y + 12}V${y - 12}" stroke-width="2"/><path d="M${x} ${y - 12}l-5 8h10Z" fill="#202020" stroke="none"/>`;
}
export function renderRatioSvg(document: RatioDocument): string {
  const m = ratioMetrics(document),
    left = m.tableLeft,
    top = m.tableTop;
  let body = `<path class="ratio-rules" d="M${left + 150} ${top}V${top + (document.rows.length + 1) * 100}M${left} ${top + 100}H${left + 300}" stroke-width="${(2.25 / 72) * 2.54 * 100}"/>`;
  document.headings.forEach((heading, i) => {
    const width = textWidth(heading.text, FONT, heading.italic),
      centre = left + 75 + i * 150;
    const hasArrow = heading.direction !== "none",
      textX = centre - (hasArrow ? 19 : 0);
    body += text(
      heading.text,
      textX,
      top + 50 + FONT * 0.31,
      FONT,
      heading.italic,
    );
    if (heading.direction !== "none")
      body += arrow(textX + width / 2 + 22, top + 50, heading.direction);
  });
  document.rows.forEach((row, i) =>
    row.cells.forEach((cell, column) => {
      body += `<g class="ratio-cell" data-row="${row.id}" data-column="${column}" data-kind="${cell.kind}">${cellMarkup(cell, left + 75 + column * 150, top + 150 + i * 100)}</g>`;
    }),
  );
  if (document.mode === "annotated")
    for (const step of document.transitions) {
      const index = document.rows.findIndex((r) => r.id === step.from),
        y = top + 150 + index * 100;
      for (const side of [-1, 1]) {
        const edge = left + (side < 0 ? 0 : 300),
          x = edge + side * 12;
        if (document.showArrows) {
          // Both arrows travel downwards. Explicit triangles follow the terminal tangent.
          body += `<g class="ratio-scaling-arrow"><path d="M${x} ${y + 12}C${x + side * 28} ${y + 30} ${x + side * 28} ${y + 70} ${x} ${y + 88}" stroke-width="2.6"/><path d="M${x} ${y + 88}l${side * 4} -12l${side * 7} 9Z" fill="#202020" stroke="none"/></g>`;
        }
        if (document.showOperations) {
          const size = FONT * 0.8,
            factorWidth = numberWidth(step.factor, size),
            opWidth = textWidth(
              step.operation === "multiply" ? "×" : "÷",
              size,
            ),
            total = opWidth + 6 + factorWidth;
          const centre =
            edge + side * ((document.showArrows ? 52 : 10) + total / 2);
          body += `<g class="ratio-operation">${text(step.operation === "multiply" ? "×" : "÷", centre - total / 2 + opWidth / 2, y + 50 + size * 0.31, size)}${number(step.factor, centre + total / 2 - factorWidth / 2, y + 50, size)}</g>`;
        }
      }
    }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${m.widthCm}cm" height="${m.heightCm}cm" viewBox="0 0 ${m.width} ${m.height}" role="img" aria-label="Ratio table"><title>Ratio table</title><desc>Use the accompanying editable file to change this table.</desc><rect width="${m.width}" height="${m.height}" fill="white"/><g font-family="STIX Two Text" fill="none" stroke="#202020">${body.replaceAll("<text ", '<text stroke="none" ')}</g></svg>`;
}
