/**
 * Tidy numbers on an SVG's root element (improvement item U38). Layout arithmetic leaves sizes such
 * as width="5.515280000000001cm" or viewBox="0 0 100 61.745690181818176". They print the same but
 * read badly and make byte comparisons fragile. Width, height and viewBox are rounded to four
 * decimal places of their own unit (at most 0.5 µm for cm, 1.3 µm for inches), far below any
 * printer's resolution. A value too small to keep at four places is left as it is. Nothing outside
 * the root element's own tag is touched.
 */
export const round4 = (v: number) => Math.round(v * 1e4) / 1e4;
const round = (s: string) => {
  const v = Number(s);
  if (!Number.isFinite(v)) return s;
  const r = round4(v);
  return r === 0 && v !== 0 ? s : String(r || 0);
};
const numbers = (value: string) => value.replace(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi, round);

export function tidySvgRoot(svg: string): string {
  // The root tag: skip any XML declaration, comments or doctype; quoted values may hold ">".
  return svg.replace(/^((?:\s|<\?[^]*?\?>|<!--[^]*?-->|<!DOCTYPE[^>]*>)*)(<svg\b(?:[^>"']|"[^"]*"|'[^']*')*>)/, (_, lead: string, open: string) =>
    lead + open.replace(/\s(width|height|viewBox)=(["'])([^"']*)\2/g, (_m, name: string, q: string, value: string) => ` ${name}=${q}${numbers(value)}${q}`),
  );
}
