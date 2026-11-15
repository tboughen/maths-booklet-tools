/**
 * House style presets for diagrams (improvement items U111, U39, U40; Tim chose 14 Nov 2026:
 * "Two house presets plus overrides"). A preset only sets the starting values of a NEW diagram;
 * each diagram's own saved settings stay its override, and saved files never change.
 *
 * - Standard: each family's usual text size (11 pt for most; bar models 12 pt).
 * - Large print: one point larger, and never below 12 pt.
 * Text never goes below MIN_TEXT_PT. Line weight is a separate choice: normal or bold.
 */
export const HOUSE_STYLES = ["standard", "large"] as const;
export type HouseStyle = (typeof HOUSE_STYLES)[number];
export const HOUSE_STYLE_NAMES: Record<HouseStyle, string> = { standard: "Standard", large: "Large print" };

export const LINE_WEIGHTS = ["normal", "bold"] as const;
export type LineWeight = (typeof LINE_WEIGHTS)[number];
export const LINE_WEIGHT_NAMES: Record<LineWeight, string> = { normal: "Normal lines", bold: "Bold lines" };
/** How much heavier bold lines are than normal ones. */
export const BOLD_LINE_FACTOR = 1.5;

/** The smallest text any diagram prints (house rule: body 11 pt, minimum 10 pt). */
export const MIN_TEXT_PT = 10;
/** Large print never prints below this size. */
export const LARGE_PRINT_PT = 12;

export interface HousePreference {
  style: HouseStyle;
  lines: LineWeight;
}
export const DEFAULT_PREFERENCE: HousePreference = { style: "standard", lines: "normal" };

/** Starting text size for a new diagram whose family normally uses `familyPt`, within its limits. */
export function startingTextPt(style: HouseStyle, familyPt: number, limits: { min?: number; max?: number } = {}): number {
  const wanted = style === "large" ? Math.max(familyPt + 1, LARGE_PRINT_PT) : familyPt;
  const min = Math.max(MIN_TEXT_PT, limits.min ?? MIN_TEXT_PT);
  return Math.min(limits.max ?? Infinity, Math.max(min, wanted));
}

/** Reads a stored preference, falling back to the defaults for anything unknown. */
export function parsePreference(raw: unknown): HousePreference {
  const v = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    style: (HOUSE_STYLES as readonly unknown[]).includes(v.style) ? (v.style as HouseStyle) : DEFAULT_PREFERENCE.style,
    lines: (LINE_WEIGHTS as readonly unknown[]).includes(v.lines) ? (v.lines as LineWeight) : DEFAULT_PREFERENCE.lines,
  };
}

/**
 * Every stroke-width in an SVG, multiplied for bold lines. Strokes never change a layout. Fill
 * patterns (hatching) keep their weight, so shading still reads the same.
 */
export function boldLines(svg: string, lines: LineWeight | undefined): string {
  if (lines !== "bold") return svg;
  return svg
    .split(/(<pattern\b[^]*?<\/pattern>)/)
    .map((part) =>
      part.startsWith("<pattern")
        ? part
        : part.replace(/stroke-width="([\d.]+)"/g, (_, w: string) => `stroke-width="${+(Number(w) * BOLD_LINE_FACTOR).toFixed(4)}"`),
    )
    .join("");
}
