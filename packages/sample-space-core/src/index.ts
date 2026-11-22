/**
 * Sample space diagrams (P-3): the outcomes of one event down the left, the outcomes of a second
 * event across the top, and one cell for every pair of outcomes. Used for two dice, a spinner and a
 * coin, sums, products and differences, and "circle the outcomes that..." questions.
 *
 * Every cell is {text, show, ring?}. Empty text is a pupil blank. A hidden cell keeps its saved
 * answer: the pupil copy leaves it empty and the answers copy prints it in the answer colour. Zero
 * is a value, never a blank. A left-out cell keeps its value and prints empty in both copies. A ringed cell is circled (a chosen outcome) and prints in black and
 * white. Cells are filled only by fillCells, when the teacher asks.
 */
import { z } from "zod";
import { glyphAdvance } from "../../ratio-table-core/src/font-metrics";
import { numberParts, parseRatioNumber, rational, fractionString, mixedString, type Rational } from "../../ratio-table-core/src/numbers";
import { sha256Hex, toBase64Url } from "../../envelope-core/src/index";
import { aboutShape } from "../../envelope-core/src/about";
import { boldLines, LINE_WEIGHTS } from "../../envelope-core/src/house-style";

/** The renderer version every new sample-space envelope carries. */
export const RENDERER_VERSION = "sample-space-1" as const;

export const MAX_OUTCOMES = 10;
export const MAX_HEADING = 12;
export const MAX_TITLE = 24;
export const MAX_CELL = 16;
export const ANSWER_COLOUR = "#b0125b";
export const OPERATIONS = ["sum", "product", "difference", "pair"] as const;
export type Operation = (typeof OPERATIONS)[number];
/** The corner sign printed for each arithmetic fill. */
export const OPERATION_SIGN: Record<Exclude<Operation, "pair">, string> = { sum: "+", product: "×", difference: "−" };

/** "omit" (Leave out, 22 Nov 2026) keeps the value but prints nothing in either copy. */
const show = z.enum(["show", "hidden", "omit"]);
const plain = (max: number) =>
  z
    .string()
    .max(max)
    .refine((s) => !/[<>]/.test(s), "Use text without markup.");
export const cellSchema = z
  .object({
    text: plain(MAX_CELL),
    show,
    /** Circled, a chosen outcome: true prints for pupils, "hidden" only on the answers copy. Never saved as false. */
    ring: z.union([z.literal(true), z.literal("hidden")]).optional(),
  })
  .strict();
const id = z.string().regex(/^[a-z][a-z0-9-]{0,23}$/);
export const columnSchema = z.object({ id, heading: plain(MAX_HEADING) }).strict();
export const rowSchema = z.object({ id, heading: plain(MAX_HEADING), cells: z.array(cellSchema).min(1).max(MAX_OUTCOMES) }).strict();
export const documentSchema = z
  .object({
    /** The top-left cell, usually the sign of the combination: "+", "×", "−" or "". */
    corner: plain(4),
    /** The first event's name, printed down the left, such as "Dice A". "" prints nothing. */
    rowTitle: plain(MAX_TITLE),
    /** The second event's name, printed above the table, such as "Spinner". "" prints nothing. */
    columnTitle: plain(MAX_TITLE),
    columns: z.array(columnSchema).min(1).max(MAX_OUTCOMES),
    rows: z.array(rowSchema).min(1).max(MAX_OUTCOMES),
    /** Width of each outcome column at print size. */
    cellMm: z.number().int().min(10).max(30),
    /** An error-spotting task: cells that disagree with the corner sign raise no warning. */
    intentionalError: z.boolean(),
    /** Bold lines (U111). Normal lines are the default and are never saved. */
    lines: z
      .enum(LINE_WEIGHTS)
      .transform((v) => (v === "bold" ? v : undefined))
      .optional(),
  })
  .strict();
export const envelopeSchema = z
  .object({
    kind: z.literal("sample-space"),
    schemaVersion: z.literal(1),
    rendererVersion: z.literal(RENDERER_VERSION),
    document: documentSchema,
    ...aboutShape,
  })
  .strict();
export type Envelope = z.infer<typeof envelopeSchema>;
export type SpaceDocument = Envelope["document"];
export type Cell = z.infer<typeof cellSchema>;

export const cell = (text = "", visibility: Cell["show"] = "show"): Cell => ({ text, show: visibility });
const tidy = (s: string) =>
  s
    .trim()
    .replace(/\s+/g, " ")
    .replace(/(\d) ?\/ ?(\d)/g, "$1/$2");
/** Cell text that reads as a number (integer, decimal, fraction or mixed number). */
export function numberOf(text: string): Rational | null {
  if (!/^[-−]?(\d+(\.\d+)?|\d+\/\d+|\d+ \d+\/\d+)$/.test(text)) return null;
  try {
    return parseRatioNumber(text.replace(/−/g, "-"));
  } catch {
    return null;
  }
}

/* ---------- Validation ---------- */

export function validate(input: unknown): Envelope {
  const parsed = envelopeSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue?.path ?? [];
    if (path.includes("text")) throw Error(`Use at most ${MAX_CELL} characters in each cell, without markup, such as 7, 1/36 or H3.`);
    if (path.includes("rowTitle") || path.includes("columnTitle")) throw Error(`Use event names of at most ${MAX_TITLE} characters, without markup.`);
    if (path.includes("heading")) throw Error(`Use outcomes of at most ${MAX_HEADING} characters, without markup.`);
    if (path.includes("corner")) throw Error("Use at most 4 characters in the corner, such as + or ×.");
    if (path.includes("rows") || path.includes("columns")) throw Error(`Use 1 to ${MAX_OUTCOMES} outcomes for each event.`);
    if (path.includes("cellMm")) throw Error("Choose a column width from 10 to 30 mm.");
    throw Error("This is not a supported sample space file (version 1 is supported).");
  }
  const e = parsed.data,
    d = e.document;
  const ids = new Set<string>();
  for (const x of [...d.columns, ...d.rows]) {
    if (ids.has(x.id)) throw Error(`The ID ${x.id} appears twice.`);
    ids.add(x.id);
    x.heading = tidy(x.heading);
  }
  d.corner = tidy(d.corner);
  d.rowTitle = tidy(d.rowTitle);
  d.columnTitle = tidy(d.columnTitle);
  for (const r of d.rows) if (r.cells.length !== d.columns.length) throw Error(`Row "${r.heading || r.id}" needs ${d.columns.length} cells, one per column.`);
  for (const c of allCells(d)) {
    c.text = tidy(c.text);
    if (!c.text && c.show === "hidden") throw Error("A blank cell cannot hold a hidden answer. Enter the answer, then hide it.");
    if (c.ring !== true && c.ring !== "hidden") delete c.ring;
    if (c.ring && !c.text) throw Error("A blank cell cannot be circled. Enter the outcome, then circle it.");
  }
  return e;
}
export const allCells = (d: SpaceDocument): Cell[] => d.rows.flatMap((r) => r.cells);
export const canonical = (e: Envelope) => JSON.stringify(validate(e));
export function parseFile(text: string) {
  if (text.length > 40000) throw Error("This editable file is too large.");
  return validate(JSON.parse(text));
}
export async function hash(e: Envelope) {
  return sha256Hex(canonical(e));
}
export const hasHidden = (e: Envelope) => allCells(e.document).some((c) => c.show === "hidden" && c.text);

/* ---------- Building ---------- */

const DICE = ["1", "2", "3", "4", "5", "6"];
/** A table for two events; the default is two fair dice with every cell blank. */
export function create(rows: string[] = DICE, columns: string[] = DICE, corner = "", titles: { row?: string; column?: string } = {}): Envelope {
  return validate({
    kind: "sample-space",
    schemaVersion: 1,
    rendererVersion: RENDERER_VERSION,
    document: {
      corner,
      rowTitle: titles.row ?? "",
      columnTitle: titles.column ?? "",
      columns: columns.map((heading, i) => ({ id: `c${i + 1}`, heading })),
      rows: rows.map((heading, i) => ({ id: `r${i + 1}`, heading, cells: columns.map(() => cell()) })),
      cellMm: 14,
      intentionalError: false,
    },
  });
}
const clone = (e: Envelope) => structuredClone(e);
function freshId(d: SpaceDocument, prefix: "r" | "c") {
  let i = 1;
  while ([...d.rows, ...d.columns].some((x) => x.id === `${prefix}${i}`)) i++;
  return `${prefix}${i}`;
}
export function cellAt(d: SpaceDocument, rowId: string, columnId: string): Cell {
  const row = d.rows.find((r) => r.id === rowId);
  if (!row) throw Error(`There is no row ${rowId}.`);
  const c = d.columns.findIndex((x) => x.id === columnId);
  if (c < 0) throw Error(`There is no column ${columnId}.`);
  return row.cells[c];
}
export function setCell(e: Envelope, rowId: string, columnId: string, change: { text?: string; show?: Cell["show"]; ring?: boolean | "hidden" }): Envelope {
  const n = clone(e),
    c = cellAt(n.document, rowId, columnId);
  if (change.text !== undefined) c.text = tidy(change.text);
  if (!c.text && change.show === "hidden") throw Error("A blank cell cannot hold a hidden answer. Enter the answer, then hide it.");
  c.show = c.text || change.show === "omit" ? (change.show ?? c.show) : c.show === "omit" ? "omit" : "show";
  if (change.ring !== undefined) {
    if (change.ring && !c.text) throw Error("A blank cell cannot be circled. Enter the outcome, then circle it.");
    if (change.ring) c.ring = change.ring;
    else delete c.ring;
  }
  // Clearing a cell clears its circle.
  if (!c.text) delete c.ring;
  return validate(n);
}
/** targetId is a row or column ID, or "corner", "rowTitle" or "columnTitle". */
export function setHeading(e: Envelope, targetId: string, text: string): Envelope {
  const n = clone(e),
    d = n.document;
  if (targetId === "corner" || targetId === "rowTitle" || targetId === "columnTitle") d[targetId] = text;
  else {
    const x = [...d.rows, ...d.columns].find((y) => y.id === targetId);
    if (!x) throw Error(`There is no row or column ${targetId}.`);
    x.heading = text;
  }
  return validate(n);
}
export function addRow(e: Envelope, heading = ""): Envelope {
  const n = clone(e),
    d = n.document;
  if (d.rows.length >= MAX_OUTCOMES) throw Error(`Use at most ${MAX_OUTCOMES} outcomes down the side.`);
  d.rows.push({ id: freshId(d, "r"), heading, cells: d.columns.map(() => cell()) });
  return validate(n);
}
export function addColumn(e: Envelope, heading = ""): Envelope {
  const n = clone(e),
    d = n.document;
  if (d.columns.length >= MAX_OUTCOMES) throw Error(`Use at most ${MAX_OUTCOMES} outcomes across the top.`);
  d.columns.push({ id: freshId(d, "c"), heading });
  for (const r of d.rows) r.cells.push(cell());
  return validate(n);
}
export function removeRow(e: Envelope, rowId: string): Envelope {
  const n = clone(e),
    d = n.document;
  if (d.rows.length <= 1) throw Error("A sample space needs at least one outcome down the side.");
  const i = d.rows.findIndex((r) => r.id === rowId);
  if (i < 0) throw Error(`There is no row ${rowId}.`);
  d.rows.splice(i, 1);
  return validate(n);
}
export function removeColumn(e: Envelope, columnId: string): Envelope {
  const n = clone(e),
    d = n.document;
  if (d.columns.length <= 1) throw Error("A sample space needs at least one outcome across the top.");
  const i = d.columns.findIndex((c) => c.id === columnId);
  if (i < 0) throw Error(`There is no column ${columnId}.`);
  d.columns.splice(i, 1);
  for (const r of d.rows) r.cells.splice(i, 1);
  return validate(n);
}

/* ---------- Exact combinations ---------- */

const add = (a: Rational, b: Rational) => rational(a.n * b.d + b.n * a.d, a.d * b.d);
const sub = (a: Rational, b: Rational) => rational(a.n * b.d - b.n * a.d, a.d * b.d);
const mul = (a: Rational, b: Rational) => rational(a.n * b.n, a.d * b.d);
const abs = (a: Rational) => (a.n < 0n ? rational(-a.n, a.d) : a);
/** A value printed like its inputs: decimals stay decimals, fractions stay fractions. */
function valueText(v: Rational, inputs: string[]): string {
  if (!inputs.some((t) => t.includes("/"))) {
    if (v.d === 1n) return String(v.n);
    for (let p = 1; p <= 6; p++) {
      const scaled = v.n * 10n ** BigInt(p);
      if (scaled % v.d === 0n) {
        const units = scaled / v.d,
          negative = units < 0n,
          digits = String(negative ? -units : units).padStart(p + 1, "0");
        return `${negative ? "-" : ""}${digits.slice(0, -p)}.${digits.slice(-p)}`;
      }
    }
  }
  return inputs.every((t) => /^-?\d+\/\d+$/.test(t)) ? fractionString(v) : mixedString(v);
}
/** The combination of two outcomes, or a reason it cannot be made. */
export function combine(operation: Operation, row: string, column: string): string {
  if (operation === "pair") {
    if (!row || !column) throw Error("Give every outcome before filling pairs.");
    const text = `(${row}, ${column})`;
    if (text.length > MAX_CELL) throw Error(`The pair ${text} is longer than ${MAX_CELL} characters. Use shorter outcomes, such as H and T.`);
    return text;
  }
  const a = numberOf(row),
    b = numberOf(column);
  if (!a || !b) throw Error(`Every outcome must be a number to fill with the ${operation}. Use pairs for outcomes such as H and T.`);
  const v = operation === "sum" ? add(a, b) : operation === "product" ? mul(a, b) : abs(sub(a, b));
  return valueText(v, [row, column]);
}
/**
 * Fills every blank cell with the combination of its two outcomes. Run only when the teacher asks;
 * filled cells are visible unless `hidden` is true. Cells already holding text are never changed.
 * Arithmetic fills also put the operation's sign in an empty corner.
 */
export function fillCells(e: Envelope, operation: Operation, hidden = false): { envelope: Envelope; filled: number } {
  const n = clone(e),
    d = n.document;
  let filled = 0;
  for (const r of d.rows)
    r.cells.forEach((c, j) => {
      if (c.text) return;
      c.text = combine(operation, r.heading, d.columns[j].heading);
      // A left-out cell stays left out once filled.
      c.show = c.show === "omit" ? "omit" : hidden ? "hidden" : "show";
      filled++;
    });
  if (operation !== "pair" && !d.corner) d.corner = OPERATION_SIGN[operation];
  return { envelope: validate(n), filled };
}
/** The operation the corner sign names, if any. */
export function cornerOperation(d: SpaceDocument): Exclude<Operation, "pair"> | null {
  const sign = d.corner.replace(/[x*]/g, "×").replace(/-/g, "−");
  return (Object.keys(OPERATION_SIGN) as Exclude<Operation, "pair">[]).find((k) => OPERATION_SIGN[k] === sign) ?? null;
}
/** Cells that disagree with the corner sign. Blank cells are pupil scaffolds and never warn. */
export function warnings(e: Envelope): string[] {
  const d = e.document,
    op = cornerOperation(d);
  if (d.intentionalError || !op) return [];
  const out: string[] = [];
  for (const r of d.rows)
    r.cells.forEach((c, j) => {
      const column = d.columns[j].heading;
      if (!c.text || !numberOf(r.heading) || !numberOf(column)) return;
      const want = combine(op, r.heading, column),
        got = numberOf(c.text);
      const wanted = numberOf(want)!;
      if (!got || got.n * wanted.d !== wanted.n * got.d)
        out.push(`The cell for ${r.heading} and ${column} holds ${c.text}; the ${op} is ${want}.`);
    });
  return out;
}

/* ---------- Views ---------- */

const REVEALED = new WeakSet<Cell>();
const REVEALED_RING = new WeakSet<Cell>();
/** The answers copy prints hidden answers; with `mark` they print in the answer colour. */
export function forView(e: Envelope, view: "pupil" | "answer", mark = false): Envelope {
  if (view === "pupil") return e;
  const n = clone(e);
  for (const c of allCells(n.document)) {
    // A left-out cell stays out of the teacher copy too, circle and all.
    if (c.show === "omit") continue;
    if (mark && c.show === "hidden" && c.text) REVEALED.add(c);
    if (c.ring === "hidden") {
      c.ring = true;
      if (mark) REVEALED_RING.add(c);
    }
    c.show = "show";
  }
  return n;
}

/* ---------- Layout ---------- */

export const FONT = (11 * 25.4) / 72;
const ROW_MM = 9;
const FRACTION_ROW_MM = 14;
const PAD = 2;
const TITLE_MM = 7;
const MAX_WIDTH_MM = 180;
/** STIX Two Text advances for pair punctuation and signs that the shared metrics table leaves out. */
const EXTRA: Record<string, number> = { "(": 0.343, ")": 0.343, ",": 0.245, "+": 0.72, "=": 0.72 };
export const textWidth = (t: string, font = FONT) => [...t].reduce((a, c) => a + (EXTRA[c] ?? glyphAdvance(c)), 0) * font;
const typeset = (t: string) => t.replace(/^-/, "−").replace(/ -/g, " −");
/** The printed width of a cell's text: stacked fractions take the wider of their two parts. */
function inkWidth(t: string) {
  if (!numberOf(t)) return textWidth(t);
  const p = numberParts(t.replace(/−/g, "-"));
  return textWidth(p.whole) + (p.top ? Math.max(textWidth(p.top), textWidth(p.bottom!)) + 1.8 : 0);
}
const isFraction = (t: string) => !!numberOf(t) && t.includes("/");

export function layout(e: Envelope) {
  const d = e.document;
  const left = d.rowTitle ? TITLE_MM : 0,
    top = d.columnTitle ? TITLE_MM : 0;
  const firstWidth = Math.max(d.cellMm, Math.ceil(Math.max(...[d.corner, ...d.rows.map((r) => r.heading)].map(inkWidth)) + 2 * PAD));
  const widths = d.columns.map((c) => Math.max(d.cellMm, Math.ceil(inkWidth(c.heading) + 2 * PAD)));
  const fractions = [...d.rows.map((r) => r.heading), ...d.columns.map((c) => c.heading), ...allCells(d).map((c) => c.text)].some(isFraction);
  const rowHeight = fractions ? FRACTION_ROW_MM : ROW_MM;
  const x = [left, left + firstWidth];
  widths.forEach((w) => x.push(x[x.length - 1] + w));
  const y = Array.from({ length: d.rows.length + 2 }, (_, i) => top + i * rowHeight);
  const width = x[x.length - 1],
    height = y[y.length - 1];
  const issues: string[] = [];
  if (width > MAX_WIDTH_MM) issues.push(`The diagram is ${Math.round(width)} mm wide, over the ${MAX_WIDTH_MM} mm print width. Use narrower columns or fewer outcomes.`);
  if (d.columnTitle && textWidth(d.columnTitle) > width - x[1]) issues.push(`The name "${d.columnTitle}" is longer than the top of the table. Shorten it or add outcomes.`);
  if (d.rowTitle && textWidth(d.rowTitle) > height - y[1]) issues.push(`The name "${d.rowTitle}" is longer than the side of the table. Shorten it or add outcomes.`);
  d.rows.forEach((r, i) =>
    r.cells.forEach((c, j) => {
      if (c.text && inkWidth(c.text) + (c.ring === true ? 3.6 : 0) > widths[j] - 2 * PAD + 0.01) issues.push(`Row ${i + 1}, column ${j + 1} is crowded. Widen the columns.`);
    }),
  );
  return { width, height, x, y, rowHeight, left, top, issues };
}
export const exportIssue = (e: Envelope) => layout(e).issues[0] ?? null;

/* ---------- SVG ---------- */

const num = (v: number) => String(Math.round(v * 1000) / 1000);
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const FAMILY = "STIX Two Text,STIX Two Math,serif";
const text = (t: string, x: number, y: number, fill = "black", anchor = "middle", extra = "") =>
  `<text x="${num(x)}" y="${num(y)}" text-anchor="${anchor}" font-family="${FAMILY}" font-size="${num(FONT)}" fill="${fill}"${extra}>${esc(t)}</text>`;

/** A cell's text centred on (cx, cy): numbers with stacked fractions, other text as typed. */
function cellMarkup(t: string, cx: number, cy: number, fill: string): string {
  if (!numberOf(t)) return text(t, cx, cy + FONT * 0.33, fill);
  const parts = numberParts(t.replace(/−/g, "-"));
  if (!parts.top) return text(typeset(parts.whole), cx, cy + FONT * 0.33, fill);
  const top = parts.top,
    bottom = parts.bottom!,
    whole = parts.whole ? typeset(parts.whole) : "";
  const bar = Math.max(textWidth(top), textWidth(bottom)) + 1;
  const wholeW = whole ? textWidth(whole) + 0.8 : 0;
  const start = cx - (wholeW + bar) / 2;
  const fx = start + wholeW + bar / 2;
  return [
    whole ? text(whole, start, cy + FONT * 0.33, fill, "start") : "",
    text(top, fx, cy - 1.1, fill),
    `<line x1="${num(fx - bar / 2)}" y1="${num(cy)}" x2="${num(fx + bar / 2)}" y2="${num(cy)}" stroke="${fill}" stroke-width="0.25"/>`,
    text(bottom, fx, cy + FONT * 0.72 + 1.1, fill),
  ].join("");
}

export function renderSvg(e: Envelope): string {
  const d = e.document,
    g = layout(e),
    out: string[] = [`<rect width="${num(g.width)}" height="${num(g.height)}" fill="white"/>`];
  const line = (x1: number, y1: number, x2: number, y2: number, weight: number) =>
    `<line x1="${num(x1)}" y1="${num(y1)}" x2="${num(x2)}" y2="${num(y2)}" stroke="black" stroke-width="${weight}" stroke-linecap="square"/>`;
  const x0 = g.x[0],
    x1 = g.x[g.x.length - 1],
    y0 = g.y[0],
    y1 = g.y[g.y.length - 1];
  // The outline and the lines round the outcomes are heavier, as on exam papers.
  g.x.forEach((x, i) => out.push(line(x, y0, x, y1, i <= 1 || i === g.x.length - 1 ? 0.5 : 0.35)));
  g.y.forEach((y, i) => out.push(line(x0, y, x1, y, i <= 1 || i === g.y.length - 1 ? 0.5 : 0.35)));
  const mid = (a: number, b: number) => (a + b) / 2;
  if (d.columnTitle) out.push(text(d.columnTitle, mid(g.x[1], x1), g.top - 2));
  if (d.rowTitle) {
    const cx = g.left / 2 + FONT * 0.33,
      cy = mid(g.y[1], y1);
    out.push(text(d.rowTitle, cx, cy, "black", "middle", ` transform="rotate(-90 ${num(cx)} ${num(cy)})"`));
  }
  if (d.corner) out.push(cellMarkup(d.corner, mid(g.x[0], g.x[1]), mid(g.y[0], g.y[1]), "black"));
  d.columns.forEach((c, j) => c.heading && out.push(cellMarkup(c.heading, mid(g.x[j + 1], g.x[j + 2]), mid(g.y[0], g.y[1]), "black")));
  d.rows.forEach((r, i) => r.heading && out.push(cellMarkup(r.heading, mid(g.x[0], g.x[1]), mid(g.y[i + 1], g.y[i + 2]), "black")));
  d.rows.forEach((r, i) =>
    r.cells.forEach((c, j) => {
      if (!c.text || c.show !== "show") return;
      const cx = mid(g.x[j + 1], g.x[j + 2]),
        cy = mid(g.y[i + 1], g.y[i + 2]),
        fill = REVEALED.has(c) ? ANSWER_COLOUR : "black";
      out.push(cellMarkup(c.text, cx, cy, fill));
      if (c.ring === true) {
        const rx = Math.min((g.x[j + 2] - g.x[j + 1]) / 2 - 0.6, Math.max(FONT * 0.8, inkWidth(c.text) / 2 + 1.8)),
          ry = Math.min(g.rowHeight / 2 - 0.6, isFraction(c.text) ? FONT * 1.3 : FONT * 0.8);
        out.push(`<ellipse cx="${num(cx)}" cy="${num(cy)}" rx="${num(rx)}" ry="${num(ry)}" fill="none" stroke="${REVEALED_RING.has(c) ? ANSWER_COLOUR : fill}" stroke-width="0.3"/>`);
      }
    }),
  );
  const names = [d.rowTitle, d.columnTitle].filter(Boolean).join(" and ");
  const label = `Sample space diagram with ${d.rows.length} by ${d.columns.length} outcomes${names ? ` for ${names}` : ""}`;
  return boldLines(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${num(g.width)}mm" height="${num(g.height)}mm" viewBox="0 0 ${num(g.width)} ${num(g.height)}" role="img" aria-label="${esc(label)}">${out.join("")}</svg>`,
    d.lines,
  );
}

/* ---------- Editor links ---------- */

export const MAX_LINK_LENGTH = 16_000;
export const LINK_PREFIX = "#sample-space=";
export const linkHash = (e: Envelope) => LINK_PREFIX + toBase64Url(canonical(e));
export function editorLink(e: Envelope, base: string): string | null {
  const url = new URL(base);
  url.pathname = url.pathname.replace(/(\/tools(\/[^/]*)?)?\/?$/, "/") + "tools/sample-space";
  url.search = "";
  url.hash = linkHash(e);
  return url.href.length <= MAX_LINK_LENGTH ? url.href : null;
}
export function decodeLinkHash(hashText: string): Envelope {
  if (!hashText.startsWith(LINK_PREFIX) || !/^[A-Za-z0-9_-]+$/.test(hashText.slice(LINK_PREFIX.length)) || hashText.length > MAX_LINK_LENGTH)
    throw Error("This is not a supported sample space link. Open an editable file instead.");
  try {
    const binary = atob(hashText.slice(LINK_PREFIX.length).replaceAll("-", "+").replaceAll("_", "/"));
    return parseFile(new TextDecoder("utf-8", { fatal: true }).decode(Uint8Array.from(binary, (c) => c.charCodeAt(0))));
  } catch {
    throw Error("This sample space link could not be read. Open an editable file instead.");
  }
}
