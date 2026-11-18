import type { RatioDocument, RatioCell } from "./schema";
import { RatioError, numberParts } from "./numbers";
import { glyphAdvance } from "./font-metrics";
import { guidance, renderedTextSizesPt } from "../../graph-core/src/print-guidance";
import { boldLines } from "../../envelope-core/src/house-style";

const FONT = (12 / 72) * 2.54 * 100;
/** Fraction parts and operation labels print at 10 pt, the house minimum (U111). */
const SMALL = 10 / 12;
/** Stacked fraction parts: 10 pt, even inside a 10 pt operation label. */
const part = (size: number) => Math.max(size * SMALL, FONT * SMALL);
const ROW_HEIGHT = 100;
/** The heading row's height when a heading is a stacked fraction such as 1/x^2. */
const FRACTION_HEAD_HEIGHT = 130;
/** A column's printed width (1.5 cm) before any long heading widens it. */
const CELL_WIDTH = 150;
const ANSWER_LINE_WIDTH = 60;
/**
 * The answer line for a hidden scaling operation ("÷ 3"): 13 mm at standard size, room to write
 * the sign and a factor by hand (Tim, A7 marking, 16 Nov 2026). 6 mm was too tight.
 */
export const FACTOR_LINE_WIDTH = 130;
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
/**
 * STIX Two Text advances for heading characters the shared metrics table leaves out (other
 * tools rely on its wide fallback): brackets and the degree sign, for units such as "Time (min)"
 * and "°C". Measured from assets/graph-fonts, regular then italic.
 */
const HEADING_GLYPHS: Record<string, [number, number]> = { "(": [0.343, 0.34], ")": [0.343, 0.339], "°": [0.405, 0.398] };
const advance = (c: string, italic: boolean) => HEADING_GLYPHS[c]?.[italic ? 1 : 0] ?? glyphAdvance(c, italic);
export function textWidth(text: string, size = FONT, italic = false): number {
  return Array.from(text).reduce(
    (sum, c) => sum + advance(c, italic) * size,
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
  const fraction = Math.max(textWidth(top, part(size)), textWidth(bottom, part(size))) + 10;
  return whole ? textWidth(whole, size) + MIXED_GAP + fraction : fraction;
}
const annotatedLabels = (document: RatioDocument) =>
  document.mode === "annotated" && document.transitions.length > 0 && document.showOperations;
/** The width an operation label takes beside its arrow. A hidden label reserves a full answer line. */
export function labelSlot(step: RatioDocument["transitions"][number]) {
  const size = FONT * SMALL,
    total =
      textWidth(step.operation === "multiply" ? "×" : "÷", size) +
      6 +
      numberWidth(step.factor, size);
  return step.hidden ? Math.max(total, FACTOR_LINE_WIDTH) : total;
}
/** Does this step print on the left (-1) or right (1) side of a two-column table? */
export const printsOn = (step: RatioDocument["transitions"][number], side: -1 | 1) =>
  !step.side || step.side === (side < 0 ? "left" : "right");
/**
 * Where a step's arrow and operation print: both sides of a two-column table (or the one side it
 * names), and beside every column of a wider table.
 */
export function stepLanes(
  document: RatioDocument,
  m: Pick<ReturnType<typeof ratioMetrics>, "tableLeft" | "tableWidth" | "columnWidth" | "cellWidth">,
  step: RatioDocument["transitions"][number],
) {
  if (document.headings.length !== 2)
    return document.headings.map((_, column) => ({
      side: 1 as const,
      edge: m.tableLeft + column * m.columnWidth + m.cellWidth,
      name: `column ${column + 1}`,
    }));
  return [
    { side: -1 as const, edge: m.tableLeft, name: "left" },
    { side: 1 as const, edge: m.tableLeft + m.tableWidth, name: "right" },
  ].filter((lane) => printsOn(step, lane.side));
}
export function ratioMetrics(document: RatioDocument) {
  const scale = { standard: 1, large: 1.2 }[document.size];
  const annotated =
    document.mode === "annotated" && document.transitions.length > 0;
  // The room beside the table for the arrows and operations of these steps.
  const gutterFor = (steps: RatioDocument["transitions"]) => {
    if (!annotated || !steps.length || !(document.showArrows || document.showOperations)) return 0;
    const operationWidth = document.showOperations
      ? Math.max(
          ...steps.map((t) =>
            Math.max(
              32 + numberWidth(t.factor, FONT * SMALL),
              t.hidden ? labelSlot(t) + 6 : 0,
            ),
          ),
        )
      : 0;
    return Math.max(
      document.showArrows ? 48 : 0,
      operationWidth + (document.showArrows ? 62 : 18),
    );
  };
  const gutter = gutterFor(document.transitions);
  // Two columns: each side is only as wide as the steps printed there.
  const two = document.headings.length === 2;
  const gutterLeft = two ? gutterFor(document.transitions.filter((t) => printsOn(t, -1))) : 0,
    gutterRight = two ? gutterFor(document.transitions.filter((t) => printsOn(t, 1))) : 0;
  // A heading that fits 1.5 cm (1.2 mm clear of the rules each side) keeps the exact layout. A
  // longer one, such as "Distance (km) ↑", widens every column to fit it with 2 mm clear each
  // side; the table never shrinks type to fit (Tim, 16 Nov 2026).
  const need = Math.max(...document.headings.map((h) => headingWidth(h) + (h.direction !== "none" ? 38 : 0)));
  const cellWidth = need + 24 <= CELL_WIDTH ? CELL_WIDTH : Math.ceil(need + 40);
  for (const row of document.rows)
    for (const cell of row.cells)
      if (
        (cell.kind === "number" || cell.kind === "hidden") &&
        numberWidth(cell.value) > cellWidth - 24
      )
        throw new RatioError(
          "layout_overflow",
          `A value in ${row.id} is too wide for the table. Use a shorter value or fraction.`,
        );
  // Two-column documents retain their exact lesson layout. Three columns each
  // reserve a scaling lane, so the middle column's operation is explicit too.
  const columnWidth = cellWidth + (two ? 0 : gutter),
    tableWidth = document.headings.length * columnWidth,
    width = 30 + tableWidth + gutterLeft + gutterRight,
    // A stacked fraction heading (1/x, 1/x^2) gets a taller heading row so it clears the heading
    // rule; other tables keep the exact layout (add room, never shrink).
    headHeight = document.headings.some((h) => HEADING_FRACTION.test(h.text)) ? FRACTION_HEAD_HEIGHT : ROW_HEIGHT,
    height = headHeight + document.rows.length * ROW_HEIGHT + 30;
  return {
    width,
    height,
    tableLeft: 15 + gutterLeft,
    tableTop: 15,
    headHeight,
    /** The top of the first row under the headings. */
    bodyTop: 15 + headHeight,
    columnWidth,
    cellWidth,
    tableWidth,
    gutter,
    widthCm: (width / 100) * scale,
    heightCm: (height / 100) * scale,
    scale,
  };
}
/**
 * How far the bottom row's numbers sit above the foot of the printed table, in millimetres: their
 * baseline. Text placed beside a ratio table lines up with this row, because the answer comes from
 * it (booklet standard N5, Tim 17 November 2026).
 */
export function ratioBottomBaselineMm(document: RatioDocument): number {
  const m = ratioMetrics(document);
  const baseline = m.bodyTop + 50 + (document.rows.length - 1) * ROW_HEIGHT + FONT * 0.31;
  return (m.height - baseline) * (m.heightCm * 10) / m.height;
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
  const small = part(size),
    bar = Math.max(textWidth(top, small), textWidth(bottom, small)) + 8;
  return (
    text(top, x, y - size * 0.15, small, false, fill) +
    `<path d="M${x - bar / 2} ${y}H${x + bar / 2}" stroke-width="2"${fill === INK ? "" : ` stroke="${fill}"`}/>` +
    text(bottom, x, y + size * 0.78, small, false, fill)
  );
}
/**
 * Proportion headings (Tim, NP17, 16 Nov 2026): "x^2" and "x^3" print a true superscript, and
 * "1/x" or "1/x^2" a stacked fraction. Letters in an italic heading are italic; digits stay upright.
 * Superscripts print at 10 pt, the house minimum. Other text (m/s, %, £) prints as typed.
 */
// Only 1 over one letter (or its power) stacks; units such as 60/min or 1/km print inline as typed.
const HEADING_FRACTION = /^(1)\/([A-Za-z](?:\^\d)?)$/;
const SUP_RISE = 0.36;
type HeadingRun = { text: string; sup: boolean };
function headingRuns(value: string): HeadingRun[] {
  return value
    .split(/\^(\d)/)
    .map((t, i) => ({ text: t, sup: i % 2 === 1 }))
    .filter((r) => r.text);
}
/** Each character's advance, italic only for letters in an italic heading. */
const styledWidth = (value: string, size: number, italic: boolean) =>
  Array.from(value).reduce((sum, c) => sum + advance(c, italic && /[A-Za-z]/.test(c)) * size, 0);
function runsWidth(runs: HeadingRun[], size: number, italic: boolean) {
  return runs.reduce((sum, r) => sum + styledWidth(r.text, r.sup ? Math.max(size * SMALL, FONT * SMALL) : size, italic), 0);
}
/** Runs from `left` on one baseline, letters italic when asked, superscripts raised. */
function runsMarkup(runs: HeadingRun[], left: number, baseline: number, size: number, italic: boolean, rise = SUP_RISE) {
  let x = left,
    out = "";
  for (const r of runs) {
    const s = r.sup ? Math.max(size * SMALL, FONT * SMALL) : size,
      y = r.sup ? baseline - size * rise : baseline;
    // Letters and other characters in separate pieces, so only letters lean.
    for (const piece of r.text.match(/[A-Za-z]+|[^A-Za-z]+/g) ?? []) {
      const lean = italic && /[A-Za-z]/.test(piece);
      out += `<text fill="${INK}" x="${x}" y="${y}" font-size="${s}"${lean ? ' font-style="italic"' : ""}>${escape(piece)}</text>`;
      x += styledWidth(piece, s, italic);
    }
  }
  return out;
}
export function headingWidth(heading: RatioDocument["headings"][number], size = FONT): number {
  const f = heading.text.match(HEADING_FRACTION);
  if (f) {
    const small = part(size);
    return Math.max(textWidth(f[1], small), runsWidth(headingRuns(f[2]), small, heading.italic)) + 10;
  }
  if (!heading.text.includes("^")) return textWidth(heading.text, size, heading.italic);
  return runsWidth(headingRuns(heading.text), size, heading.italic);
}
/** A heading centred on x, its middle on y (the row's centre line). */
function headingMarkup(heading: RatioDocument["headings"][number], x: number, y: number, size = FONT) {
  const f = heading.text.match(HEADING_FRACTION);
  // A plain heading prints exactly as before: one centred text.
  if (!f && !heading.text.includes("^")) return text(heading.text, x, y + size * 0.31, size, heading.italic);
  if (!f) {
    const runs = headingRuns(heading.text);
    return runsMarkup(runs, x - runsWidth(runs, size, heading.italic) / 2, y + size * 0.31, size, heading.italic);
  }
  const small = part(size),
    bottom = headingRuns(f[2]),
    bar = Math.max(textWidth(f[1], small), runsWidth(bottom, small, heading.italic)) + 8;
  return (
    text(f[1], x, y - size * 0.15, small) +
    `<path d="M${x - bar / 2} ${y}H${x + bar / 2}" stroke-width="2"/>` +
    // A power in the denominator sits a little lower, so its raised digit clears the bar.
    runsMarkup(bottom, x - runsWidth(bottom, small, heading.italic) / 2, y + size * 0.78 + (bottom.some((r) => r.sup) ? 9 : 0), small, heading.italic, bottom.some((r) => r.sup) ? 0.3 : SUP_RISE)
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
      `M${left + (i + 1) * m.columnWidth} ${top}V${m.bodyTop + document.rows.length * 100}`,
  ).join("");
  let body = `<path class="ratio-rules" d="${rules}M${left} ${m.bodyTop}H${left + m.tableWidth}" stroke-width="${(2.25 / 72) * 2.54 * 100}"/>`;
  document.headings.forEach((heading, i) => {
    const width = headingWidth(heading),
      centre = left + m.cellWidth / 2 + i * m.columnWidth;
    const hasArrow = heading.direction !== "none",
      textX = centre - (hasArrow ? 19 : 0);
    let markup = headingMarkup(heading, textX, top + m.headHeight / 2);
    if (heading.direction !== "none")
      markup += arrow(textX + width / 2 + 22, top + m.headHeight / 2, heading.direction);
    // A hidden heading is blank on the pupil copy (no text, no arrow) and prints in the answer
    // colour on the answers copy. The column keeps the same width either way.
    if (!heading.hidden) body += markup;
    else if (view === "answer")
      body += `<g class="ratio-hidden-heading" stroke="${RATIO_ANSWER_COLOUR}">${markup.replaceAll(INK, RATIO_ANSWER_COLOUR)}</g>`;
  });
  document.rows.forEach((row, i) =>
    row.cells.forEach((cell, column) => {
      body += `<g class="ratio-cell" data-row="${row.id}" data-column="${column}" data-kind="${cell.kind}">${cellMarkup(cell, left + m.cellWidth / 2 + column * m.columnWidth, m.bodyTop + 50 + i * 100, view)}</g>`;
    }),
  );
  if (document.mode === "annotated")
    for (const step of document.transitions) {
      const index = document.rows.findIndex((r) => r.id === step.from),
        y = m.bodyTop + 50 + index * 100;
      const lanes = stepLanes(document, m, step);
      for (const { side, edge } of lanes) {
        const x = edge + side * 12;
        if (document.showArrows) {
          // Both arrows travel downwards. Explicit triangles follow the terminal tangent.
          body += `<g class="ratio-scaling-arrow"><path d="M${x} ${y + 12}C${x + side * 28} ${y + 30} ${x + side * 28} ${y + 70} ${x} ${y + 88}" stroke-width="2.6"/><path d="M${x} ${y + 88}l${side * 4} -12l${side * 7} 9Z" fill="#202020" stroke="none"/></g>`;
        }
        if (document.showOperations) {
          const size = FONT * SMALL,
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
  // An answers-only table: the pupil copy is blank paper of exactly the same size; the answers
  // copy prints the whole table (cross, headings, cells and arrows) in the answer colour.
  const answerOnly = document.answerOnly === true,
    ink = answerOnly ? RATIO_ANSWER_COLOUR : INK;
  if (answerOnly) body = view === "answer" ? body.replaceAll(INK, RATIO_ANSWER_COLOUR) : "";
  return boldLines(`<svg xmlns="http://www.w3.org/2000/svg" width="${m.widthCm}cm" height="${m.heightCm}cm" viewBox="0 0 ${m.width} ${m.height}" role="img" aria-label="Ratio table"><title>Ratio table</title><desc>Use the accompanying editable file to change this table.</desc><rect width="${m.width}" height="${m.height}" fill="white"/>${body ? `<g${answerOnly ? ' class="ratio-answer-only"' : ""} font-family="STIX Two Text" fill="none" stroke="${ink}">${body.replaceAll("<text ", '<text stroke="none" ')}</g>` : ""}</svg>`, document.lines);
}
