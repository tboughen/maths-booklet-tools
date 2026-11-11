/**
 * Axis numbering and object names shared by the editor preview, the print renderer and the
 * connector, so every copy of a graph numbers and names things the same way.
 */
import { gridDivisions, shouldLabelAxisSquare } from "./diagram";
import { formatNumber } from "./equations";
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

/** Axis numbers are decimals (0.25, not 1/4); whole numbers print exactly as before. */
export function formatAxisValue(value: number, axis: Pick<AxisConfig, "format">): string {
  if (axis.format === "time") return formatTime(value);
  const clean = Number(value.toFixed(6));
  if (Number.isInteger(clean)) return formatNumber(clean);
  const text = String(clean);
  return text.startsWith("-") ? `−${text.slice(1)}` : text;
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
  const config = document.axes[axis];
  const origin = config.origin ?? 0;
  const total = config.negativeSquares + config.positiveSquares;
  const skipOrigin = sharedOriginLabel(document);
  const ticks: AxisTick[] = [];
  for (let index = 0; index <= total; index += 1) {
    const offset = index - config.negativeSquares;
    if (!shouldLabelAxisSquare(offset, config.unitsPerSquare, config.labelEvery)) continue;
    if (offset === 0 && skipOrigin) continue;
    const value = Number((origin + offset * config.unitsPerSquare).toFixed(9));
    ticks.push({ index, value, label: formatAxisValue(value, config) });
  }
  return ticks;
}

/** The 1 cm line pitch and, for a fine grid, its smaller pitch, in millimetres. */
export function gridPitchesMm(document: Pick<DiagramDocumentV1, "grid">): number[] {
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

/** Bold upright capitals for lines (L), italic capitals for points (A), as papers print them. */
export function mathsLetter(letter: string, style: "bold" | "italic"): string {
  const code = letter.charCodeAt(0) - 65;
  return String.fromCodePoint((style === "bold" ? 0x1d400 : 0x1d434) + code);
}

export function mathsDigits(digits: string, style: "bold" | "italic"): string {
  if (style === "italic") return digits;
  return [...digits].map((d) => String.fromCodePoint(0x1d7ce + Number(d))).join("");
}

/** Plain-text reading of a name: L1 reads "L₁", for descriptions and accessible text. */
export function readableName(name: string): string {
  return name.replace(/[0-9]/g, (d) => String.fromCharCode(0x2080 + Number(d)));
}
