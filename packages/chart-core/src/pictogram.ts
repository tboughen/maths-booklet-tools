import { boldLines } from "../../envelope-core/src/house-style";
import {
  CHART_ANSWER_COLOUR,
  FONT,
  MARGIN,
  MAX_SYMBOLS,
  esc,
  formatNumber,
  n,
  pictogramOf,
  readNumber,
  revealed,
  text,
  textWidth,
  wasHidden,
  type PictogramSymbol,
} from "./shared";
import type { Envelope, HitBox, Target } from "./index";

/**
 * Pictograms as Edexcel prints them: a ruled table with the categories on the left and a row of
 * symbols on the right, and a framed key beside it ("Key: [symbol] represents 8 pictures").
 * Each row draws value ÷ key symbols from the first data set. A part symbol is exact: a sector
 * of a circle anticlockwise from 12 o'clock (a half is the left half), or the left part of a
 * square drawn open on its right, so a part always starts where the whole symbols end.
 * A hidden row is left for pupils to draw; a hidden key value leaves an answer line. Millimetres.
 */
export type SymbolRow = {
  category: number;
  /** Whole symbols, then the part (0 ≤ part < 1) of one more. */
  whole: number;
  part: number;
  drawn: boolean;
  revealed: boolean;
  y: number;
};

const PAD = 2.5;
const GAP = 1.5;
/** An answer line for a hidden key value, as on worksheet answer lines. */
const KEY_LINE = 14;

export function pictogramLayout(e: Envelope) {
  const d = e.document,
    s = d.series[0],
    p = pictogramOf(d),
    size = p.symbolMm,
    issues: string[] = [],
    notes: string[] = [];
  if (d.series.length > 1)
    notes.push("A pictogram draws only the first data set. The other data sets are kept for dual and composite bar charts.");
  const key = readNumber(p.key.value);
  if (!p.key.value.trim()) issues.push("Enter what one symbol represents in the key. Tick Hide to leave it for pupils.");
  else if (key === null || key <= 0) issues.push("The key value must be a positive number.");
  const rows: SymbolRow[] = [];
  const header = !!(d.xTitle.trim() || d.yTitle.trim());
  const rowH = Math.max(size + 4, FONT * 1.8),
    headH = header ? FONT * 2 : 0;
  s.values.forEach((c, ci) => {
    const where = d.categories[ci] || `Category ${ci + 1}`,
      y = MARGIN + headH + ci * rowH;
    if (!c.value.trim()) return;
    const v = readNumber(c.value);
    if (v === null) return void issues.push(`${where}: enter a number, or leave it blank.`);
    if (v < 0) return void issues.push(`${where}: values cannot be negative.`);
    if (key === null || key <= 0) return;
    const count = v / key;
    // Round away float noise so 0.75 of a symbol is exactly three quarters.
    const exact = Math.round(count * 1e9) / 1e9,
      whole = Math.floor(exact),
      part = Math.round((exact - whole) * 1e9) / 1e9;
    if (Math.ceil(exact) > MAX_SYMBOLS) {
      issues.push(`${where}: ${formatNumber(v)} needs ${Math.ceil(exact)} symbols. Use at most ${MAX_SYMBOLS}; increase the key value.`);
      return;
    }
    if (p.symbol === "circle" && part > 0 && Math.abs(part * 4 - Math.round(part * 4)) > 1e-9)
      notes.push(`${where}: ${formatNumber(v)} needs part of a circle that is not a whole number of quarters, which is hard to read. Try a key value that divides the data more evenly.`);
    if (part > 0 && part * size < 1)
      notes.push(`${where}: the part symbol is under 1 mm wide, which is hard to read.`);
    rows.push({ category: ci, whole, part, drawn: c.show === "show", revealed: revealed(c), y });
  });

  // Column widths: categories, then room for the most symbols any row needs (at least 5).
  const labelW = Math.max(18, ...d.categories.map((c) => textWidth(c)), header ? textWidth(d.xTitle) : 0) + 2 * PAD;
  const most = Math.max(5, ...rows.map((r) => r.whole + (r.part > 0 ? 1 : 0)));
  const symbolsW = Math.max(PAD * 2 + most * size + (most - 1) * GAP, header ? textWidth(d.yTitle) + 2 * PAD : 0);
  const x0 = MARGIN,
    tableW = labelW + symbolsW,
    tableH = headH + d.categories.length * rowH;
  // The key: "Key:" above the symbol and "represents …". Its value prints as typed.
  const keyValue = p.key.value.trim(),
    keyRest = p.unit.trim() ? ` ${p.unit.trim()}` : "";
  // A hidden key value keeps an answer line's width on both copies; a shown one is its own width.
  const lineKey = p.key.show === "hidden" || wasHidden(p.key),
    valueW = lineKey ? Math.max(textWidth(keyValue), KEY_LINE) : textWidth(keyValue),
    repW = textWidth("represents ") + valueW + textWidth(keyRest);
  const keyW = PAD * 2 + size + 3 + repW,
    keyH = PAD * 2 + FONT * 1.3 + size;
  let kx = x0 + tableW + 6,
    ky = MARGIN + Math.max(0, tableH / 2 - keyH / 2);
  let width = kx + keyW + MARGIN,
    height = MARGIN + Math.max(tableH, keyH) + MARGIN;
  if (width > 180) {
    // Too wide side by side: the key goes under the table.
    kx = x0;
    ky = MARGIN + tableH + 5;
    width = Math.max(x0 + tableW, kx + keyW) + MARGIN;
    height = ky + keyH + MARGIN;
  }
  width = Math.ceil(width * 10) / 10;
  height = Math.ceil(height * 10) / 10;
  if (width > 180) issues.push("The pictogram is wider than 18 cm. Use smaller symbols, a larger key value or shorter labels.");
  if (height > 180) issues.push("The pictogram is taller than 18 cm. Use smaller symbols or fewer categories.");
  const symbolsX = x0 + labelW + PAD;
  const targets: Target[] = d.categories.map((_, ci) => ({
    series: 0,
    category: ci,
    x: x0 + labelW,
    y: MARGIN + headH + ci * rowH,
    width: symbolsW,
    height: rowH,
  }));
  const labels: HitBox[] = d.categories.map((_, ci) => ({ category: ci, x: x0, y: MARGIN + headH + ci * rowH, width: labelW, height: rowH }));
  return {
    width,
    height,
    x0,
    y0: MARGIN,
    labelW,
    symbolsW,
    symbolsX,
    rowH,
    headH,
    size,
    symbol: p.symbol,
    rows,
    key: { x: kx, y: ky, width: keyW, height: keyH, value: keyValue, rest: keyRest, valueW, shown: p.key.show === "show", revealed: revealed(p.key) },
    targets,
    labels,
    issues,
    notes,
  };
}

/** One symbol (or the given part of one) with its top-left corner at x, y. */
function symbolSvg(kind: PictogramSymbol, x: number, y: number, size: number, part: number, ink: string) {
  const stroke = `stroke="${ink}" stroke-width="0.3"`;
  if (kind === "square") {
    if (part >= 1) return `<rect x="${n(x)}" y="${n(y)}" width="${n(size)}" height="${n(size)}" fill="white" ${stroke}/>`;
    // Edexcel draws part of a square open on its right: top, left and bottom edges.
    const w = size * part;
    return `<path d="M${n(x + w)},${n(y)}H${n(x)}V${n(y + size)}H${n(x + w)}" fill="none" ${stroke}/>`;
  }
  const r = size / 2,
    cx = x + r,
    cy = y + r;
  if (part >= 1) return `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r)}" fill="white" ${stroke}/>`;
  // Anticlockwise from 12 o'clock, so a half or a quarter sits on the left, next to the whole symbols.
  const a = part * 2 * Math.PI,
    ex = cx - r * Math.sin(a),
    ey = cy - r * Math.cos(a);
  return `<path d="M${n(cx)},${n(cy)}V${n(cy - r)}A${n(r)},${n(r)} 0 ${part > 0.5 ? 1 : 0} 0 ${n(ex)},${n(ey)}Z" fill="white" ${stroke}/>`;
}

export function pictogramSvg(e: Envelope): string {
  const d = e.document,
    g = pictogramLayout(e),
    out: string[] = [];
  out.push(`<rect width="${n(g.width)}" height="${n(g.height)}" fill="white"/>`);
  const right = g.x0 + g.labelW + g.symbolsW,
    bottom = g.y0 + g.headH + d.categories.length * g.rowH;
  // Table rules.
  const rules = [`M${n(g.x0 + g.labelW)},${n(g.y0)}V${n(bottom)}`];
  for (let i = 1; i < d.categories.length + (g.headH ? 1 : 0); i++) {
    const y = g.y0 + (g.headH ? g.headH + (i - 1) * g.rowH : i * g.rowH);
    rules.push(`M${n(g.x0)},${n(y)}H${n(right)}`);
  }
  out.push(`<rect x="${n(g.x0)}" y="${n(g.y0)}" width="${n(right - g.x0)}" height="${n(bottom - g.y0)}" fill="none" stroke="black" stroke-width="0.3"/>`);
  out.push(`<path d="${rules.join("")}" stroke="black" stroke-width="0.3" fill="none"/>`);
  if (g.headH) {
    const y = g.y0 + g.headH / 2 + FONT * 0.33;
    if (d.xTitle.trim()) out.push(text(d.xTitle, g.x0 + PAD, y, "start"));
    if (d.yTitle.trim()) out.push(text(d.yTitle, g.x0 + g.labelW + PAD, y, "start"));
  }
  d.categories.forEach((c, ci) =>
    out.push(text(c, g.x0 + PAD, g.y0 + g.headH + ci * g.rowH + g.rowH / 2 + FONT * 0.33, "start")),
  );
  for (const r of g.rows) {
    if (!r.drawn) continue;
    const ink = r.revealed ? CHART_ANSWER_COLOUR : "black",
      top = r.y + (g.rowH - g.size) / 2;
    for (let i = 0; i < r.whole + (r.part > 0 ? 1 : 0); i++)
      out.push(symbolSvg(g.symbol, g.symbolsX + i * (g.size + GAP), top, g.size, i < r.whole ? 1 : r.part, ink));
  }
  // Key.
  const k = g.key;
  out.push(`<rect x="${n(k.x)}" y="${n(k.y)}" width="${n(k.width)}" height="${n(k.height)}" fill="white" stroke="black" stroke-width="0.3"/>`);
  out.push(text("Key:", k.x + PAD, k.y + PAD + FONT * 0.8, "start"));
  const sy = k.y + PAD + FONT * 1.3,
    ty = sy + g.size / 2 + FONT * 0.33,
    tx = k.x + PAD + g.size + 3;
  out.push(symbolSvg(g.symbol, k.x + PAD, sy, g.size, 1, "black"));
  out.push(text("represents", tx, ty, "start"));
  const vx = tx + textWidth("represents ");
  if (k.shown) out.push(text(k.value, vx + k.valueW / 2, ty, "middle", k.revealed ? CHART_ANSWER_COLOUR : "black"));
  else out.push(`<line x1="${n(vx)}" y1="${n(ty + 0.8)}" x2="${n(vx + k.valueW)}" y2="${n(ty + 0.8)}" stroke="black" stroke-width="0.3" stroke-dasharray="0.3 0.6"/>`);
  if (k.rest) out.push(text(k.rest.trim(), vx + k.valueW + textWidth(" "), ty, "start"));
  const label = `Pictogram${d.categories.length ? ` of ${d.categories.filter(Boolean).join(", ")}` : ""}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${n(g.width)}mm" height="${n(g.height)}mm" viewBox="0 0 ${n(g.width)} ${n(g.height)}" role="img" aria-label="${esc(label)}">${boldLines(out.join(""), d.lines)}</svg>`;
}
