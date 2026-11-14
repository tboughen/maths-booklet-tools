/**
 * Two-way tables (U97): category rows × category columns with optional totals, for "Complete the
 * two-way table" and probability-from-a-table questions.
 *
 * Every cell is {text, show}. Empty text is a pupil blank (an empty box). A hidden cell keeps its
 * saved answer: the pupil copy leaves the box empty and the answers copy prints it in the answer
 * colour. Zero is a value, never a blank. Numbers stay exact: integers, decimals, fractions and
 * mixed numbers, printed with stacked fractions. Totals are filled only by completeTotals.
 */
import { z } from "zod";
import { glyphAdvance } from "../../ratio-table-core/src/font-metrics";
import {
  canonicalRatioNumber,
  numberParts,
  parseRatioNumber,
  rational,
  fractionString,
  mixedString,
  type Rational,
} from "../../ratio-table-core/src/numbers";
import { sha256Hex, toBase64Url } from "../../envelope-core/src/index";

export const MAX_CATEGORIES = 5;
export const MAX_HEADING = 24;
export const ANSWER_COLOUR = "#b0125b";

const show = z.enum(["show", "hidden"]);
export const cellSchema = z.object({ text: z.string().max(16), show }).strict();
const heading = z
  .string()
  .max(MAX_HEADING)
  .refine((s) => !/[<>]/.test(s), "Use headings without markup.");
const id = z.string().regex(/^[a-z][a-z0-9-]{0,23}$/);
export const columnSchema = z.object({ id, heading }).strict();
export const rowSchema = z.object({ id, heading, cells: z.array(cellSchema).min(1).max(MAX_CATEGORIES + 1) }).strict();
export const documentSchema = z
  .object({
    /** Words in the top-left cell, such as "" or "Year group". */
    corner: heading,
    columns: z.array(columnSchema).min(1).max(MAX_CATEGORIES),
    rows: z.array(rowSchema).min(1).max(MAX_CATEGORIES),
    /** A Total column on the right: each row has one more cell. */
    totalColumn: z.boolean(),
    /** A Total row at the bottom, or null. Its cells run under every column (and the Total column). */
    totalRow: z.array(cellSchema).min(1).max(MAX_CATEGORIES + 1).nullable(),
    /** Width of each number column at print size. */
    cellMm: z.number().min(16).max(36),
    /** An error-spotting task: totals may disagree without a warning. */
    intentionalError: z.boolean(),
  })
  .strict();
export const envelopeSchema = z
  .object({
    kind: z.literal("two-way-table"),
    schemaVersion: z.literal(1),
    rendererVersion: z.literal("two-way-table-1"),
    document: documentSchema,
  })
  .strict();
export type Envelope = z.infer<typeof envelopeSchema>;
export type TableDocument = Envelope["document"];
export type Cell = z.infer<typeof cellSchema>;

export const cell = (text = "", visibility: Cell["show"] = "show"): Cell => ({ text, show: visibility });
const width = (d: TableDocument) => d.columns.length + (d.totalColumn ? 1 : 0);

/* ---------- Validation ---------- */

export function validate(input: unknown): Envelope {
  const parsed = envelopeSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue?.path ?? [];
    if (path.includes("text")) throw Error("Use a number of at most 16 characters in each cell, such as 24, 0.3 or 2/5.");
    if (path.includes("heading") || path.includes("corner")) throw Error(`Use headings of at most ${MAX_HEADING} characters, without markup.`);
    if (path.includes("rows") || path.includes("columns")) throw Error(`Use 1 to ${MAX_CATEGORIES} row categories and 1 to ${MAX_CATEGORIES} column categories.`);
    if (path.includes("cellMm")) throw Error("Choose a column width from 16 to 36 mm.");
    throw Error("This is not a supported two-way table file (version 1 is supported).");
  }
  const e = parsed.data,
    d = e.document;
  const ids = new Set<string>();
  for (const x of [...d.columns, ...d.rows]) {
    if (ids.has(x.id)) throw Error(`The ID ${x.id} appears twice.`);
    ids.add(x.id);
  }
  const w = width(d);
  for (const r of d.rows)
    if (r.cells.length !== w) throw Error(`Row "${r.heading || r.id}" needs ${w} cells, one per column${d.totalColumn ? " and the Total" : ""}.`);
  if (d.totalRow && d.totalRow.length !== w) throw Error(`The Total row needs ${w} cells.`);
  for (const c of allCells(d)) {
    if (c.text.trim()) {
      try {
        c.text = canonicalRatioNumber(c.text);
      } catch (error) {
        throw Error(`"${c.text}": ${error instanceof Error ? error.message : String(error)}`);
      }
    } else {
      if (c.show === "hidden") throw Error("A blank cell cannot hold a hidden answer. Enter the answer, then hide it.");
      c.text = "";
    }
  }
  return e;
}
export function allCells(d: TableDocument): Cell[] {
  return [...d.rows.flatMap((r) => r.cells), ...(d.totalRow ?? [])];
}
export const canonical = (e: Envelope) => JSON.stringify(validate(e));
export function parseFile(text: string) {
  if (text.length > 30000) throw Error("This editable file is too large.");
  return validate(JSON.parse(text));
}
export async function hash(e: Envelope) {
  return sha256Hex(canonical(e));
}
export const hasHidden = (e: Envelope) => allCells(e.document).some((c) => c.show === "hidden" && c.text);

/* ---------- Building ---------- */

export function create(columns = ["", ""], rows = ["", ""], totals = true): Envelope {
  const d: TableDocument = {
    corner: "",
    columns: columns.map((heading, i) => ({ id: `c${i + 1}`, heading })),
    rows: rows.map((heading, i) => ({ id: `r${i + 1}`, heading, cells: [] })),
    totalColumn: totals,
    totalRow: null,
    cellMm: 22,
    intentionalError: false,
  };
  d.rows.forEach((r) => (r.cells = Array.from({ length: width(d) }, () => cell())));
  if (totals) d.totalRow = Array.from({ length: width(d) }, () => cell());
  return validate({ kind: "two-way-table", schemaVersion: 1, rendererVersion: "two-way-table-1", document: d });
}
const clone = (e: Envelope) => structuredClone(e);
function freshId(d: TableDocument, prefix: "r" | "c") {
  let i = 1;
  while ([...d.rows, ...d.columns].some((x) => x.id === `${prefix}${i}`)) i++;
  return `${prefix}${i}`;
}
/** The cell at a row (an ID, or "total") and a column (an ID, or "total"). */
export function cellAt(d: TableDocument, rowId: string, columnId: string): Cell {
  const row = rowId === "total" ? d.totalRow : d.rows.find((r) => r.id === rowId)?.cells;
  if (!row) throw Error(rowId === "total" ? "This table has no Total row." : `There is no row ${rowId}.`);
  const c = columnId === "total" ? (d.totalColumn ? d.columns.length : -1) : d.columns.findIndex((x) => x.id === columnId);
  if (c < 0) throw Error(columnId === "total" ? "This table has no Total column." : `There is no column ${columnId}.`);
  return row[c];
}
export function setCell(e: Envelope, rowId: string, columnId: string, text: string, visibility?: Cell["show"]): Envelope {
  const n = clone(e),
    c = cellAt(n.document, rowId, columnId);
  c.text = text.trim();
  c.show = c.text ? (visibility ?? c.show) : "show";
  return validate(n);
}
export function setHeading(e: Envelope, targetId: string, text: string): Envelope {
  const n = clone(e),
    d = n.document;
  if (targetId === "corner") d.corner = text.trim();
  else {
    const x = [...d.rows, ...d.columns].find((y) => y.id === targetId);
    if (!x) throw Error(`There is no row or column ${targetId}.`);
    x.heading = text.trim();
  }
  return validate(n);
}
export function addRow(e: Envelope, headingText = ""): Envelope {
  const n = clone(e),
    d = n.document;
  if (d.rows.length >= MAX_CATEGORIES) throw Error(`Use at most ${MAX_CATEGORIES} row categories.`);
  d.rows.push({ id: freshId(d, "r"), heading: headingText, cells: Array.from({ length: width(d) }, () => cell()) });
  return validate(n);
}
export function addColumn(e: Envelope, headingText = ""): Envelope {
  const n = clone(e),
    d = n.document;
  if (d.columns.length >= MAX_CATEGORIES) throw Error(`Use at most ${MAX_CATEGORIES} column categories.`);
  const at = d.columns.length;
  d.columns.push({ id: freshId(d, "c"), heading: headingText });
  for (const row of [...d.rows.map((r) => r.cells), ...(d.totalRow ? [d.totalRow] : [])]) row.splice(at, 0, cell());
  return validate(n);
}
export function removeRow(e: Envelope, rowId: string): Envelope {
  const n = clone(e),
    d = n.document;
  if (d.rows.length <= 1) throw Error("A two-way table needs at least one row category.");
  const i = d.rows.findIndex((r) => r.id === rowId);
  if (i < 0) throw Error(`There is no row ${rowId}.`);
  d.rows.splice(i, 1);
  return validate(n);
}
export function removeColumn(e: Envelope, columnId: string): Envelope {
  const n = clone(e),
    d = n.document;
  if (d.columns.length <= 1) throw Error("A two-way table needs at least one column category.");
  const i = d.columns.findIndex((c) => c.id === columnId);
  if (i < 0) throw Error(`There is no column ${columnId}.`);
  d.columns.splice(i, 1);
  for (const row of [...d.rows.map((r) => r.cells), ...(d.totalRow ? [d.totalRow] : [])]) row.splice(i, 1);
  return validate(n);
}
/** Adds or removes the Total row and column. Removing one discards its cells (Undo restores them). */
export function setTotals(e: Envelope, totals: { row?: boolean; column?: boolean }): Envelope {
  const n = clone(e),
    d = n.document;
  if (totals.column !== undefined && totals.column !== d.totalColumn) {
    d.totalColumn = totals.column;
    for (const row of [...d.rows.map((r) => r.cells), ...(d.totalRow ? [d.totalRow] : [])])
      if (totals.column) row.push(cell());
      else row.pop();
  }
  if (totals.row !== undefined && totals.row !== !!d.totalRow)
    d.totalRow = totals.row ? Array.from({ length: width(d) }, () => cell()) : null;
  return validate(n);
}

/* ---------- Exact totals ---------- */

const value = (c: Cell): Rational | null => (c.text ? parseRatioNumber(c.text) : null);
function sum(values: Rational[]): Rational {
  return values.reduce((a, b) => rational(a.n * b.d + b.n * a.d, a.d * b.d), rational(0n));
}
/** A total printed like its inputs: decimals stay decimals, fractions stay fractions. */
function totalText(total: Rational, inputs: Cell[]): string {
  const fractions = inputs.some((c) => c.text.includes("/"));
  if (!fractions) {
    if (total.d === 1n) return String(total.n);
    for (let p = 1; p <= 6; p++) {
      const scaled = total.n * 10n ** BigInt(p);
      if (scaled % total.d === 0n) {
        const units = scaled / total.d,
          negative = units < 0n,
          digits = String(negative ? -units : units).padStart(p + 1, "0");
        return `${negative ? "-" : ""}${digits.slice(0, -p)}.${digits.slice(-p)}`;
      }
    }
  }
  // Fractions alone (such as probabilities) total as a fraction; with whole or mixed numbers among
  // the parts the total is a mixed number, as pupils would write it.
  const onlyFractions = inputs.every((c) => /^-?\d+\/\d+$/.test(c.text));
  return onlyFractions ? fractionString(total) : mixedString(total);
}
/** Each line of the table that has a total: its parts and the total cell. */
function sums(d: TableDocument): { name: string; parts: Cell[]; total: Cell }[] {
  const out: { name: string; parts: Cell[]; total: Cell }[] = [];
  const k = d.columns.length;
  if (d.totalColumn)
    d.rows.forEach((r, i) => out.push({ name: `row ${r.heading || i + 1}`, parts: r.cells.slice(0, k), total: r.cells[k] }));
  if (d.totalRow) {
    d.columns.forEach((c, j) =>
      out.push({ name: `column ${c.heading || j + 1}`, parts: d.rows.map((r) => r.cells[j]), total: d.totalRow![j] }),
    );
    if (d.totalColumn) {
      out.push({ name: "the Total row", parts: d.totalRow.slice(0, k), total: d.totalRow[k] });
      out.push({ name: "the Total column", parts: d.rows.map((r) => r.cells[k]), total: d.totalRow[k] });
    }
  }
  return out;
}
/** Totals that disagree with complete parts. Blank cells are pupil scaffolds and never warn. */
export function warnings(e: Envelope): string[] {
  const d = e.document;
  if (d.intentionalError) return [];
  const out: string[] = [];
  for (const s of sums(d)) {
    if (!s.total.text || s.parts.some((c) => !c.text)) continue;
    const parts = sum(s.parts.map((c) => value(c)!)),
      total = value(s.total)!;
    if (parts.n * total.d !== total.n * parts.d)
      out.push(`The parts of ${s.name} add to ${totalText(parts, s.parts)}, not ${s.total.text}.`);
  }
  return [...new Set(out)];
}
/**
 * Fills blank total cells whose parts are all entered. Run only when the teacher asks; filled
 * totals are visible unless `hidden` is true. Repeats until nothing more can be filled, so the grand
 * total follows the row and column totals.
 */
export function completeTotals(e: Envelope, hidden = false): { envelope: Envelope; filled: number } {
  const n = clone(e);
  let filled = 0,
    progress = true;
  while (progress) {
    progress = false;
    for (const s of sums(n.document)) {
      if (s.total.text || s.parts.some((c) => !c.text)) continue;
      s.total.text = totalText(sum(s.parts.map((c) => value(c)!)), s.parts);
      s.total.show = hidden ? "hidden" : "show";
      filled++;
      progress = true;
    }
  }
  return { envelope: validate(n), filled };
}

/* ---------- Views ---------- */

const REVEALED = new WeakSet<Cell>();
/** The answers copy prints hidden answers; with `mark` they print in the answer colour. */
export function forView(e: Envelope, view: "pupil" | "answer", mark = false): Envelope {
  if (view === "pupil") return e;
  const n = clone(e);
  for (const c of allCells(n.document)) {
    if (mark && c.show === "hidden" && c.text) REVEALED.add(c);
    c.show = "show";
  }
  return n;
}

/* ---------- Layout ---------- */

export const FONT = (11 * 25.4) / 72;
const ROW_MM = 10;
const FRACTION_ROW_MM = 14;
const PAD = 2;
const MAX_WIDTH_MM = 180;
export const textWidth = (t: string, font = FONT) => [...t].reduce((a, c) => a + glyphAdvance(c), 0) * font;
const typeset = (t: string) => t.replace(/^-/, "−").replace(/ -/g, " −");

export function layout(e: Envelope) {
  const d = e.document;
  const headings = [d.corner, ...d.rows.map((r) => r.heading), ...(d.totalRow ? ["Total"] : [])];
  const firstWidth = Math.max(18, Math.ceil(Math.max(...headings.map((h) => textWidth(h))) + 2 * PAD));
  const columnHeadings = [...d.columns.map((c) => c.heading), ...(d.totalColumn ? ["Total"] : [])];
  const numberWidths = columnHeadings.map((h) => Math.max(d.cellMm, Math.ceil(textWidth(h) + 2 * PAD)));
  const fractions = allCells(d).some((c) => c.text.includes("/"));
  const rowHeight = fractions ? FRACTION_ROW_MM : ROW_MM;
  const x = [0, firstWidth];
  numberWidths.forEach((w) => x.push(x[x.length - 1] + w));
  const rowCount = 1 + d.rows.length + (d.totalRow ? 1 : 0);
  const y = Array.from({ length: rowCount + 1 }, (_, i) => (i === 0 ? 0 : ROW_MM + (i - 1) * rowHeight));
  const w = x[x.length - 1],
    h = y[y.length - 1];
  const issues: string[] = [];
  if (w > MAX_WIDTH_MM) issues.push(`The table is ${Math.round(w)} mm wide, over the ${MAX_WIDTH_MM} mm print width. Use narrower columns or shorter headings.`);
  const cells = [...d.rows.map((r) => r.cells), ...(d.totalRow ? [d.totalRow] : [])];
  cells.forEach((row, i) =>
    row.forEach((c, j) => {
      const parts = numberParts(c.text);
      const textW = Math.max(textWidth(parts.whole) + (parts.top ? textWidth(parts.top.length > parts.bottom!.length ? parts.top : parts.bottom!) + 1 : 0));
      if (c.text && textW > numberWidths[j] - 2 * PAD)
        issues.push(`Row ${i + 1}, column ${j + 1} is crowded. Widen the columns.`);
    }),
  );
  return { width: w, height: h, x, y, rowHeight, firstWidth, numberWidths, columnHeadings, issues };
}
export const exportIssue = (e: Envelope) => layout(e).issues[0] ?? null;

/* ---------- SVG ---------- */

const num = (v: number) => String(Math.round(v * 1000) / 1000);
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const FAMILY = "STIX Two Text,STIX Two Math,serif";
const text = (t: string, x: number, y: number, fill = "black", anchor = "middle", weight = "normal") =>
  `<text x="${num(x)}" y="${num(y)}" text-anchor="${anchor}" font-family="${FAMILY}" font-size="${num(FONT)}" font-weight="${weight}" fill="${fill}">${esc(t)}</text>`;

function numberMarkup(t: string, cx: number, cy: number, fill: string): string {
  const parts = numberParts(t);
  if (!parts.top) return text(typeset(parts.whole), cx, cy + FONT * 0.33, fill);
  const top = typeset(parts.top),
    bottom = parts.bottom!,
    whole = parts.whole ? typeset(parts.whole) : "";
  const bar = Math.max(textWidth(top), textWidth(bottom)) + 1;
  const wholeW = whole ? textWidth(whole) + 0.8 : 0;
  const left = cx - (wholeW + bar) / 2;
  const fx = left + wholeW + bar / 2;
  return [
    whole ? text(whole, left, cy + FONT * 0.33, fill, "start") : "",
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
  g.x.forEach((x, i) => out.push(line(x, 0, x, g.height, i === 0 || i === g.x.length - 1 || i === 1 ? 0.5 : 0.35)));
  g.y.forEach((y, i) => out.push(line(0, y, g.width, y, i === 0 || i === g.y.length - 1 || i === 1 ? 0.5 : 0.35)));
  const mid = (a: number, b: number) => (a + b) / 2;
  // Headings: the corner, column headings, row headings and Total labels.
  if (d.corner) out.push(text(d.corner, mid(g.x[0], g.x[1]), ROW_MM / 2 + FONT * 0.33));
  g.columnHeadings.forEach((h, j) => h && out.push(text(h, mid(g.x[j + 1], g.x[j + 2]), ROW_MM / 2 + FONT * 0.33)));
  const rowHeadings = [...d.rows.map((r) => r.heading), ...(d.totalRow ? ["Total"] : [])];
  rowHeadings.forEach((h, i) => h && out.push(text(h, PAD, mid(g.y[i + 1], g.y[i + 2]) + FONT * 0.33, "black", "start")));
  const rows = [...d.rows.map((r) => r.cells), ...(d.totalRow ? [d.totalRow] : [])];
  rows.forEach((row, i) =>
    row.forEach((c, j) => {
      if (!c.text || c.show === "hidden") return;
      out.push(numberMarkup(c.text, mid(g.x[j + 1], g.x[j + 2]), mid(g.y[i + 1], g.y[i + 2]), REVEALED.has(c) ? ANSWER_COLOUR : "black"));
    }),
  );
  const label = `Two-way table with ${d.rows.length} row and ${d.columns.length} column categories${d.totalRow || d.totalColumn ? " and totals" : ""}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${num(g.width)}mm" height="${num(g.height)}mm" viewBox="0 0 ${num(g.width)} ${num(g.height)}" role="img" aria-label="${esc(label)}">${out.join("")}</svg>`;
}

/* ---------- Editor links ---------- */

export const MAX_LINK_LENGTH = 16_000;
export const LINK_PREFIX = "#two-way-table=";
export const linkHash = (e: Envelope) => LINK_PREFIX + toBase64Url(canonical(e));
export function editorLink(e: Envelope, base: string): string | null {
  const url = new URL(base);
  url.pathname = url.pathname.replace(/(\/tools(\/[^/]*)?)?\/?$/, "/") + "tools/two-way-table";
  url.search = "";
  url.hash = linkHash(e);
  return url.href.length <= MAX_LINK_LENGTH ? url.href : null;
}
export function decodeLinkHash(hashText: string): Envelope {
  if (!hashText.startsWith(LINK_PREFIX) || !/^[A-Za-z0-9_-]+$/.test(hashText.slice(LINK_PREFIX.length)) || hashText.length > MAX_LINK_LENGTH)
    throw Error("This is not a supported two-way table link. Open an editable file instead.");
  try {
    const binary = atob(hashText.slice(LINK_PREFIX.length).replaceAll("-", "+").replaceAll("_", "/"));
    return parseFile(new TextDecoder("utf-8", { fatal: true }).decode(Uint8Array.from(binary, (c) => c.charCodeAt(0))));
  } catch {
    throw Error("This two-way table link could not be read. Open an editable file instead.");
  }
}
