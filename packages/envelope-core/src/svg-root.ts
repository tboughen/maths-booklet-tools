/**
 * Tidy numbers on an SVG's root element (improvement item U38). Layout arithmetic leaves sizes such
 * as width="5.515280000000001cm" or viewBox="0 0 100 61.745690181818176". They print the same but
 * read badly and make byte comparisons fragile. Width, height and viewBox are rounded to four
 * decimal places (0.1 µm in mm units), so the physical size is unchanged for print. Nothing else in
 * the file is touched.
 */
const round = (s: string) => {
  const v = Number(s);
  return Number.isFinite(v) ? String(Math.round(v * 1e4) / 1e4 || 0) : s;
};
const numbers = (value: string) => value.replace(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi, round);

export function tidySvgRoot(svg: string): string {
  return svg.replace(/<svg\b[^>]*>/, (open) =>
    open.replace(/\s(width|height|viewBox)="([^"]*)"/g, (_, name: string, value: string) => ` ${name}="${numbers(value)}"`),
  );
}
