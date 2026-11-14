import type { RatioDocument, RatioCell } from "./schema";
import { RatioError, numberParts } from "./numbers";
import { glyphAdvance } from "./font-metrics";
import { guidance, renderedTextSizesPt } from "../../graph-core/src/print-guidance";

const FONT = (12 / 72) * 2.54 * 100;
const ROW_HEIGHT = 100;
const ANSWER_LINE_WIDTH = 60;
/** Saved answers print in the answers copy only, in the house answer colour. */
export const RATIO_ANSWER_COLOUR = "#b0125b";
const INK = "#202020";
export type RatioView = "pupil" | "answer";
const hasLine = (c: RatioCell) =>
  c.kind === "answer-line" || (c.kind === "hidden" && c.line === true);
export function ratioPrintFacts(document: RatioDocument) {
  const m = ratioMetrics(document), mmPerUnit = m.widthCm * 10 / m.width;
  const lines = [
    ...(document.rows.some((r) => r.cells.some(hasLine)) ? [ANSWER_LINE_WIDTH] : []),
    ...(annotatedLabels(document) && document.transitions.some((t) => t.hidden)
      ? [Math.min(...document.transitions.filter((t) => t.hidden).map(labelSlot))] : []),
  ];
  return guidance({
    textSizesPt: renderedTextSizesPt(renderRatioSvg(document, "answer"), mmPerUnit * 72 / 25.4),
    answerLineLengthsMm: lines.length ? [Math.min(...lines) * mmPerUnit] : [],
    tableRowHeightsMm: [ROW_HEIGHT * mmPerUnit],
  });
}
export function textWidth(text: string, size = FONT, italic = false): number {
  return Array.from(text).reduce(
    (sum, c) => sum + glyphAdvance(c, italic) * size,
    0,
  );
}
function printed(value: string) {
  return value.replaceAll("-", "−");
}
/** The gap between a mixed number's whole part and its stacked fraction. */
const MIXED_GAP = 4;
export function numberWidth(value: string, size = FONT): number {
  const { whole, top, bottom } = numberParts(printed(value));
  if (top === undefined || bottom === undefined) return textWidth(whole, size);
  const fraction = Math.max(textWidth(top, size * 0.8), textWidth(bottom, size * 0.8)) + 10;
  return whole ? textWidth(whole, size) + MIXED_GAP + fraction : fraction;
}
const annotatedLabels = (document: RatioDocument) =>
  document.mode === "annotated" && document.transitions.length > 0 && document.showOperations;
/** The width an operation label takes beside its arrow. A hidden label reserves a full answer line. */
function labelSlot(step: RatioDocument["transitions"][number]) {
  const size = FONT * 0.8,
    total =
      textWidth(step.operation === "multiply" ? "×" : "÷", size) +
      6 +
      numberWidth(step.factor, size);
  return step.hidden ? Math.max(total, ANSWER_LINE_WIDTH) : total;
}
export function ratioMetrics(document: RatioDocument) {
  const scale = { compact: 0.8, standard: 1, large: 1.2 }[document.size];
  const annotated =
    document.mode === "annotated" && document.transitions.length > 0;
  let gutter = 0;
  if (annotated && (document.showArrows || document.showOperations)) {
    const operationWidth = document.showOperations
      ? Math.max(
          ...document.transitions.map((t) =>
            Math.max(
              32 + numberWidth(t.factor, FONT * 0.8),
              t.hidden ? labelSlot(t) + 6 : 0,
            ),
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
      if (
        (cell.kind === "number" || cell.kind === "hidden") &&
        numberWidth(cell.value) > 126
      )
        throw new RatioError(
          "layout_overflow",
          `A value in ${row.id} is too wide for the table. Use a shorter value or fraction.`,
        );
  // Two-column documents retain their exact lesson layout. Three columns each
  // reserve a scaling lane, so the middle column's operation is explicit too.
  const columnWidth = 150 + (document.headings.length !== 2 ? gutter : 0),
    tableWidth = document.headings.length * columnWidth,
    width = 30 + tableWidth + (document.headings.length === 2 ? gutter * 2 : 0),
    height = (document.rows.length + 1) * ROW_HEIGHT + 30;
  return {
    width,
    height,
    tableLeft: 15 + (document.headings.length === 2 ? gutter : 0),
    tableTop: 15,
    columnWidth,
    tableWidth,
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
  fill = INK,
) {
  return `<text fill="${fill}" x="${x}" y="${baseline}" font-size="${size}" text-anchor="middle"${italic ? ' font-style="italic"' : ""}>${escape(value)}</text>`;
}
function number(value: string, x: number, y: number, size = FONT, fill = INK): string {
  const { whole, top, bottom } = numberParts(printed(value));
  if (top === undefined || bottom === undefined) return text(whole, x, y + size * 0.31, size, false, fill);
  if (whole) {
    // A mixed number: the whole number at full size beside a stacked fraction, centred as one.
    const left = x - numberWidth(value, size) / 2,
      wholeWidth = textWidth(whole, size),
      fractionWidth = numberWidth(`${top}/${bottom}`, size);
    return (
      text(whole, left + wholeWidth / 2, y + size * 0.31, size, false, fill) +
      number(`${top}/${bottom}`, left + wholeWidth + MIXED_GAP + fractionWidth / 2, y, size, fill)
    );
  }
  const small = size * 0.8,
    bar = Math.max(textWidth(top, small), textWidth(bottom, small)) + 8;
  return (
    text(top, x, y - size * 0.15, small, false, fill) +
    `<path d="M${x - bar / 2} ${y}H${x + bar / 2}" stroke-width="2"${fill === INK ? "" : ` stroke="${fill}"`}/>` +
    text(bottom, x, y + size * 0.78, small, false, fill)
  );
}
const answerLine = (x: number, y: number, width = ANSWER_LINE_WIDTH) =>
  `<path class="ratio-answer-line" d="M${x - width / 2} ${y + 16}H${x + width / 2}" stroke-width="2"/>`;
function cellMarkup(cell: RatioCell, x: number, y: number, view: RatioView) {
  if (cell.kind === "number") return number(cell.value, x, y);
  if (cell.kind === "answer-line") return answerLine(x, y);
  if (cell.kind === "hidden") {
    // The pupil copy keeps the cell blank (or its answer line); the answers copy adds the value.
    // A fraction sits in the cell without the line, so the line never crosses its denominator.
    const line = cell.line && (view === "pupil" || !cell.value.includes("/")) ? answerLine(x, y) : "";
    return view === "answer"
      ? `${line}<g class="ratio-hidden-answer">${number(cell.value, x, y, FONT, RATIO_ANSWER_COLOUR)}</g>`
      : line;
  }
  return "";
}
function arrow(x: number, y: number, direction: "up" | "down" | "right") {
  if (direction === "right")
    return `<path d="M${x - 12} ${y}H${x + 12}" stroke-width="2"/><path d="M${x + 12} ${y}l-8 -5v10Z" fill="${INK}" stroke="none"/>`;
  return direction === "up"
    ? `<path d="M${x} ${y + 12}V${y - 12}" stroke-width="2"/><path d="M${x} ${y - 12}l-5 8h10Z" fill="${INK}" stroke="none"/>`
    : `<path d="M${x} ${y - 12}V${y + 12}" stroke-width="2"/><path d="M${x} ${y + 12}l-5 -8h10Z" fill="${INK}" stroke="none"/>`;
}
/**
 * The table's artwork. The pupil copy (the default) leaves hidden answers blank; the answers copy
 * prints them in the answer colour. Both copies have exactly the same size and layout.
 */
export function renderRatioSvg(document: RatioDocument, view: RatioView = "pupil"): string {
  const m = ratioMetrics(document),
    left = m.tableLeft,
    top = m.tableTop;
  const rules = Array.from(
    { length: document.headings.length - 1 },
    (_, i) =>
      `M${left + (i + 1) * m.columnWidth} ${top}V${top + (document.rows.length + 1) * 100}`,
  ).join("");
  let body = `<path class="ratio-rules" d="${rules}M${left} ${top + 100}H${left + m.tableWidth}" stroke-width="${(2.25 / 72) * 2.54 * 100}"/>`;
  document.headings.forEach((heading, i) => {
    const width = textWidth(heading.text, FONT, heading.italic),
      centre = left + 75 + i * m.columnWidth;
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
      body += `<g class="ratio-cell" data-row="${row.id}" data-column="${column}" data-kind="${cell.kind}">${cellMarkup(cell, left + 75 + column * m.columnWidth, top + 150 + i * 100, view)}</g>`;
    }),
  );
  if (document.mode === "annotated")
    for (const step of document.transitions) {
      const index = document.rows.findIndex((r) => r.id === step.from),
        y = top + 150 + index * 100;
      const lanes =
        document.headings.length === 2
          ? [
              { side: -1, edge: left },
              { side: 1, edge: left + 300 },
            ]
          : document.headings.map((_, column) => ({
              side: 1,
              edge: left + column * m.columnWidth + 150,
            }));
      for (const { side, edge } of lanes) {
        const x = edge + side * 12;
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
            total = opWidth + 6 + factorWidth,
            slot = labelSlot(step);
          const centre =
            edge + side * ((document.showArrows ? 52 : 10) + slot / 2);
          const fill = step.hidden ? RATIO_ANSWER_COLOUR : INK,
            label = `${text(step.operation === "multiply" ? "×" : "÷", centre - total / 2 + opWidth / 2, y + 50 + size * 0.31, size, false, fill)}${number(step.factor, centre + total / 2 - factorWidth / 2, y + 50, size, fill)}`;
          if (!step.hidden) body += `<g class="ratio-operation">${label}</g>`;
          else
            // Pupil copy: an answer line for the operation. Answers copy: the label on that line
            // (a fractional factor without the line, which would cross its denominator).
            body += `<g class="ratio-operation" data-hidden="true">${view === "pupil" || !step.factor.includes("/") ? answerLine(centre, y + 50, slot) : ""}${view === "answer" ? label : ""}</g>`;
        }
      }
    }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${m.widthCm}cm" height="${m.heightCm}cm" viewBox="0 0 ${m.width} ${m.height}" role="img" aria-label="Ratio table"><title>Ratio table</title><desc>Use the accompanying editable file to change this table.</desc><rect width="${m.width}" height="${m.height}" fill="white"/><g font-family="STIX Two Text" fill="none" stroke="#202020">${body.replaceAll("<text ", '<text stroke="none" ')}</g></svg>`;
}
