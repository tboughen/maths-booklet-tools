import fontMetrics from "./v2-font-metrics.json" with { type: "json" };

const glyphs: Record<string, number[]> = fontMetrics.entries;
export const escapeXml = (s: string) =>
  s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
export function ink(s: string, font: number) {
  let advance = 0,
    left = 0,
    right = 0,
    top = 0,
    bottom = 0;
  for (const char of s) {
    const [a, x1, y1, x2, y2] = glyphs[char] ?? [1, 0, -0.25, 1, 1];
    left = Math.min(left, advance + x1 * font);
    right = Math.max(right, advance + x2 * font);
    top = Math.min(top, -y2 * font);
    bottom = Math.max(bottom, -y1 * font);
    advance += a * font;
  }
  return { advance, left, right: Math.max(right, advance), top, bottom };
}
type Run =
  | { kind: "text"; text: string }
  | { kind: "fraction"; numerator: string; denominator: string };
// A display grammar, deliberately without arithmetic evaluation or nested fractions.
const atom = String.raw`(?:[+−-]?(?:\d+(?:\.\d+)?[A-Za-z]?|[A-Za-z])|\([^()/]{1,30}\))`;
export function parseMath(s: string): Run[] {
  const runs: Run[] = [];
  const re = new RegExp(`(${atom})\\s*\\/\\s*(${atom})`, "g");
  let end = 0;
  for (const match of s.matchAll(re)) {
    let start = match.index!,
      numerator = match[1];
    const stop = start + match[0].length;
    // In 1/2+3/4, retain the binary plus as surrounding text. Unary signs
    // at the start of an atom remain in its numerator.
    if (/^[+−-]/.test(numerator) && /[\w.)]/.test(s[start - 1] ?? "")) {
      start++;
      numerator = numerator.slice(1);
    }
    if (/[\w.)/]/.test(s[start - 1] ?? "") || /[\w.(/]/.test(s[stop] ?? ""))
      throw Error(
        "Ambiguous fraction. Use one simple numerator and denominator, with parentheses for a group; choose Plain text explicitly for a date or literal slash.",
      );
    if (start > end) runs.push({ kind: "text", text: s.slice(end, start) });
    runs.push({ kind: "fraction", numerator, denominator: match[2] });
    end = stop;
  }
  if (end < s.length) runs.push({ kind: "text", text: s.slice(end) });
  if (runs.some((r) => r.kind === "text" && r.text.includes("/")))
    throw Error(
      "Unsupported fraction. Use a simple atom or one parenthesised group on each side of /; nested fractions need separate calculation lines. Choose Plain text explicitly for literal slashes.",
    );
  return runs;
}
export function mathematicalLine(s: string, font: number, maths = true) {
  const runs = maths ? parseMath(s) : [{ kind: "text" as const, text: s }];
  let x = 0,
    top = 0,
    bottom = 0;
  const fragments: string[] = [];
  for (const run of runs) {
    if (run.kind === "text") {
      const m = ink(run.text, font),
        baseline = font * 0.32;
      fragments.push(
        `<text x="${x - m.left}" y="${baseline}">${escapeXml(run.text)}</text>`,
      );
      top = Math.min(top, baseline + m.top);
      bottom = Math.max(bottom, baseline + m.bottom);
      x += m.right - m.left;
    } else {
      const n = ink(run.numerator, font),
        d = ink(run.denominator, font);
      const width = Math.max(n.right - n.left, d.right - d.left) + 1.2;
      const nb = -0.65 - n.bottom,
        db = 0.65 - d.top;
      fragments.push(
        `<g data-fraction="horizontal"><text x="${x + (width - (n.right - n.left)) / 2 - n.left}" y="${nb}">${escapeXml(run.numerator)}</text><path d="M${x} 0h${width}" fill="none" stroke="#000" stroke-width="0.2"/><text x="${x + (width - (d.right - d.left)) / 2 - d.left}" y="${db}">${escapeXml(run.denominator)}</text></g>`,
      );
      top = Math.min(top, nb + n.top, -0.1);
      bottom = Math.max(bottom, db + d.bottom, 0.1);
      x += width;
    }
  }
  const height = s.trim() ? Math.max(font * 1.2, -2 * top, 2 * bottom) : 0;
  return { width: x, height, top, bottom, svg: fragments.join("") };
}
export const WRITING = Object.freeze({
  aboveMm: 12,
  belowMm: 3,
  strokeMm: 0.25,
  lengthMm: 8,
  heightMm: 15.25,
  baselineOffsetMm: 4.5,
});
