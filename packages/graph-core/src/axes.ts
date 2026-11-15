/**
 * Axis numbering and object names shared by the editor preview, the print renderer and the
 * connector, so every copy of a graph numbers and names things the same way.
 */
import { axisNumberText, axisNumbersTouch, axisTickValues } from "./axis-scale";
import { gridDivisions, isSketch } from "./diagram";
import { AXIS_LABEL_FONT_POINTS, axisLabelBoxWidth, pointsToDiagramUnits } from "./graphStyle";
import type { AxisConfig, DiagramDocumentV1 } from "./types";

export interface AxisTick {
  /** 1 cm lines from the negative end of the axis (0 is the left or bottom edge). */
  index: number;
  value: number;
  label: string;
}

/** A thin space between hours and minutes, as exam papers print 12 00. */
export const TIME_GAP = " ";

export function formatTime(minutes: number): string {
  const whole = Math.round(minutes);
  const day = ((whole % 1440) + 1440) % 1440;
  const hours = Math.floor(day / 60);
  const rest = day % 60;
  return `${String(hours).padStart(2, "0")}${TIME_GAP}${String(rest).padStart(2, "0")}`;
}

/** Reads 12:30, 12 30, 12.30 or 1230 as minutes after midnight. */
export function parseTimeOfDay(text: string): number | null {
  const match = text.trim().match(/^(\d{1,2})(?:[:.\s\u2009]?)(\d{2})$/);
  if (!match) return null;
  const hours = Number(match[1]),
    minutes = Number(match[2]);
  if (hours > 24 || minutes > 59 || (hours === 24 && minutes > 0)) return null;
  return hours * 60 + minutes;
}

/** Axis numbers are decimals (0.25, not 1/4); whole numbers print exactly as before. */
export function formatAxisValue(value: number, axis: Pick<AxisConfig, "format">): string {
  return axis.format === "time" ? formatTime(value) : axisNumberText(value);
}

/** True when the shared origin mark (0 or O) replaces both axes' own numbers at the corner. */
export function sharedOriginLabel(document: DiagramDocumentV1): boolean {
  return (
    Math.abs(document.axes.x.origin ?? 0) < 1e-9 &&
    Math.abs(document.axes.y.origin ?? 0) < 1e-9 &&
    document.axes.x.format !== "time" &&
    document.axes.y.format !== "time"
  );
}

/**
 * The numbered 1 cm lines of one axis, in drawing order from the negative end. The x-axis
 * returns left to right; the y-axis returns bottom to top.
 */
export function axisTicks(document: DiagramDocumentV1, axis: "x" | "y"): AxisTick[] {
  if (isSketch(document)) return [];
  const config = document.axes[axis];
  const origin = config.origin ?? 0;
  const total = config.negativeSquares + config.positiveSquares;
  const skipOrigin = sharedOriginLabel(document);
  const step = config.unitsPerSquare;
  // Every labelEvery-th line from the origin; at 0.5 per square, every 2nd line by default.
  const every = (config.labelEvery ?? (step === 0.5 ? 2 : 1)) * step;
  const min = origin - config.negativeSquares * step;
  return axisTickValues(min, origin + config.positiveSquares * step, every, origin)
    .map((value) => ({ index: Math.round((value - min) / step), value, label: formatAxisValue(value, config) }))
    .filter((tick) => tick.index >= 0 && tick.index <= total && !(skipOrigin && tick.index === config.negativeSquares));
}

/** The 1 cm line pitch and, for a fine grid, its smaller pitch, in millimetres. */
export function gridPitchesMm(document: Pick<DiagramDocumentV1, "grid">): number[] {
  if (isSketch(document)) return [];
  const divisions = gridDivisions(document);
  return divisions === 1 ? [10] : [10, 10 / divisions];
}

/** A capital letter, an optional prime and an optional one- or two-digit subscript. */
export const OBJECT_NAME_PATTERN = /^[A-Z]′?[0-9]{0,2}$/;

export interface NameParts {
  letter: string;
  prime: boolean;
  subscript: string;
}

export function normaliseObjectName(name: string): string {
  return name.trim().replaceAll("'", "′").replace(/[₀-₉]/g, (d) => String(d.charCodeAt(0) - 0x2080));
}

export function nameParts(name: string): NameParts {
  return { letter: name[0], prime: name.includes("′"), subscript: name.replace(/^[A-Z]′?/, "") };
}

/** Bold upright capitals for lines (L), italic capitals for points (A) and plain upright
 * capitals for shapes (A), as papers print them. */
export function mathsLetter(letter: string, style: NameStyle): string {
  if (style === "upright") return letter;
  const code = letter.charCodeAt(0) - 65;
  return String.fromCodePoint((style === "bold" ? 0x1d400 : 0x1d434) + code);
}

export type NameStyle = "bold" | "italic" | "upright";
export function mathsDigits(digits: string, style: NameStyle): string {
  if (style !== "bold") return digits;
  return [...digits].map((d) => String.fromCodePoint(0x1d7ce + Number(d))).join("");
}

export const LABEL_SIDES = [
  "left",
  "right",
  "above",
  "below",
  "above-left",
  "above-right",
  "below-left",
  "below-right",
] as const;

/** The longest label text a line can carry, such as "(−12, 3.5)". */
export const MAX_LABEL_TEXT_LENGTH = 16;

/** Label text prints minus signs, not hyphens: "-2" becomes "−2". */
export function normaliseLabelText(text: string): string {
  return text.replaceAll("-", "−");
}

/** Plain-text reading of a name: L1 reads "L₁", for descriptions and accessible text. */
export function readableName(name: string): string {
  return name.replace(/[0-9]/g, (d) => String.fromCharCode(0x2080 + Number(d)));
}

/**
 * True when neighbouring x-axis numbers would touch at print size (for example times of day on
 * every 1 cm line). Numbering every 2nd or 5th line fixes it; nothing is shrunk to fit.
 */
export function xNumbersCrowded(document: DiagramDocumentV1): boolean {
  const fontSize = pointsToDiagramUnits(AXIS_LABEL_FONT_POINTS, 100);
  const numbers = axisTicks(document, "x").map((tick) => ({ at: tick.index, width: axisLabelBoxWidth(tick.label, fontSize) }));
  return axisNumbersTouch(numbers, 4, (from, to) => (to - from) * 100);
}

/** Printed coordinates are exact only for short decimals: (1/3, 2) would print as 0.333333. */
export function coordinatesPrintable(position: { x: number; y: number }): boolean {
  return [position.x, position.y].every((v) => Math.abs(v * 1000 - Math.round(v * 1000)) < 1e-6);
}
