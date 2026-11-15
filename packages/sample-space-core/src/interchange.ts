import { z } from "zod";
import * as core from "./index";
import { examples } from "./examples";
import { guidance, renderedTextSizesPt } from "../../graph-core/src/print-guidance";
import { LINE_WEIGHTS } from "../../envelope-core/src/house-style";

/** Connector adapter: the same schema, exact fills and renderer as the browser editor. */
export const exampleIds = examples.map((x) => x.id) as [string, ...string[]];
const show = z.enum(["show", "hidden"]);
const cellText = z.string().max(core.MAX_CELL);
/** A cell: its text, or { text, hidden?, ring? } to keep it as a saved answer or circle it. */
const cellInput = z.union([cellText, z.object({ text: cellText, hidden: z.boolean().optional(), ring: z.boolean().optional() }).strict()]);
const heading = z.string().max(core.MAX_HEADING);
const title = z.string().max(core.MAX_TITLE);
export const outputViewSchema = z.enum(["pupil", "answer"]);
const fillSchema = z.object({ operation: z.enum(core.OPERATIONS), hidden: z.boolean().optional() }).strict();
export const specSchema = z
  .object({
    example: z.enum(exampleIds).optional(),
    worked: z.boolean().optional(),
    /** Outcomes of the first event, down the left (default the six faces of a dice). */
    rows: z.array(heading).min(1).max(core.MAX_OUTCOMES).optional(),
    /** Outcomes of the second event, across the top (default the six faces of a dice). */
    columns: z.array(heading).min(1).max(core.MAX_OUTCOMES).optional(),
    rowTitle: title.optional(),
    columnTitle: title.optional(),
    corner: z.string().max(4).optional(),
    /** One array per row, one cell per column. "" is a blank with no answer. */
    cells: z.array(z.array(cellInput).max(core.MAX_OUTCOMES)).max(core.MAX_OUTCOMES).optional(),
    cellMm: core.documentSchema.shape.cellMm.optional(),
    intentionalError: z.boolean().optional(),
    lines: z.enum(LINE_WEIGHTS).optional(),
    /** Explicitly fill blank cells with each pair's sum, product, difference or (row, column) pair; hidden answers unless hidden is false. */
    fill: fillSchema.optional(),
  })
  .strict();
export const createSchema = z
  .object({ envelope: core.envelopeSchema.optional(), spec: specSchema.optional(), outputView: outputViewSchema.optional() })
  .strict();
const rowRef = z.string().max(24).describe('A row ID such as "r1".');
const columnRef = z.string().max(24).describe('A column ID such as "c1".');
export const operationSchema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("set_cell"), rowId: rowRef, columnId: columnRef, text: cellText.optional(), show: show.optional(), ring: z.boolean().optional() }).strict(),
  z
    .object({ op: z.literal("set_heading"), id: z.string().max(24).describe('A row or column ID, or "corner", "rowTitle" or "columnTitle".'), text: title })
    .strict(),
  z.object({ op: z.literal("add_row"), heading: heading.optional() }).strict(),
  z.object({ op: z.literal("add_column"), heading: heading.optional() }).strict(),
  z.object({ op: z.literal("remove_row"), rowId: rowRef }).strict(),
  z.object({ op: z.literal("remove_column"), columnId: columnRef }).strict(),
  z.object({ op: z.literal("fill_cells"), operation: z.enum(core.OPERATIONS), hidden: z.boolean().optional() }).strict(),
  z
    .object({
      op: z.literal("set_settings"),
      settings: z.object({ cellMm: core.documentSchema.shape.cellMm, intentionalError: z.boolean(), lines: z.enum(LINE_WEIGHTS) }).partial().strict(),
    })
    .strict(),
]);
export const revisionSchema = z
  .object({
    envelope: core.envelopeSchema,
    baseHash: z.string().regex(/^[a-f0-9]{64}$/),
    operations: z.array(operationSchema).max(40),
    outputView: outputViewSchema.optional(),
  })
  .strict();

const toCell = (c: z.infer<typeof cellInput>): core.Cell => {
  if (typeof c === "string") return core.cell(c);
  if (c.hidden && !c.text.trim()) throw Error("A blank cell cannot hold a hidden answer. Give its text, then hide it.");
  return { ...core.cell(c.text, c.hidden ? "hidden" : "show"), ...(c.ring ? { ring: true as const } : {}) };
};
function settings(e: core.Envelope, s: { cellMm?: number; intentionalError?: boolean; lines?: "normal" | "bold" }): core.Envelope {
  const n = structuredClone(e),
    d = n.document;
  if (s.cellMm !== undefined) d.cellMm = s.cellMm;
  if (s.intentionalError !== undefined) d.intentionalError = s.intentionalError;
  if (s.lines === "bold") d.lines = "bold";
  else if (s.lines === "normal") delete d.lines;
  return core.validate(n);
}

export function create(input: unknown): core.Envelope {
  const v = createSchema.parse(input);
  if (v.envelope && v.spec) throw Error("Supply spec or envelope, not both.");
  if (v.envelope) return core.validate(v.envelope);
  const s = v.spec;
  if (!s) return core.create();
  if (s.example && (s.rows || s.columns || s.cells || s.fill)) throw Error("Examples already contain their table; revise the result instead.");
  let e: core.Envelope;
  if (s.example) e = examples.find((x) => x.id === s.example)!.make(false);
  else {
    e = core.create(s.rows, s.columns, s.corner ?? "", { row: s.rowTitle, column: s.columnTitle });
    if (s.cells) {
      const n = structuredClone(e);
      if (s.cells.length > n.document.rows.length) throw Error(`cells has ${s.cells.length} rows; this table has ${n.document.rows.length}.`);
      s.cells.forEach((row, i) => {
        if (row.length > n.document.columns.length) throw Error(`Row ${i + 1} of cells has ${row.length} cells; this table has ${n.document.columns.length} columns.`);
        row.forEach((c, j) => (n.document.rows[i].cells[j] = toCell(c)));
      });
      e = core.validate(n);
    }
  }
  e = settings(e, s);
  if (s.fill) e = core.fillCells(e, s.fill.operation, s.fill.hidden ?? true).envelope;
  if (s.worked) e = core.forView(e, "answer");
  return e;
}

export async function revise(input: unknown): Promise<core.Envelope> {
  const v = revisionSchema.parse(input);
  if ((await core.hash(v.envelope)) !== v.baseHash) throw Error("stale_hash: Use the exact returned envelope and contentHash.");
  let e = core.validate(structuredClone(v.envelope));
  for (const op of v.operations) {
    switch (op.op) {
      case "set_cell":
        e = core.setCell(e, op.rowId, op.columnId, { text: op.text, show: op.show, ring: op.ring });
        break;
      case "set_heading":
        e = core.setHeading(e, op.id, op.text);
        break;
      case "add_row":
        e = core.addRow(e, op.heading);
        break;
      case "add_column":
        e = core.addColumn(e, op.heading);
        break;
      case "remove_row":
        e = core.removeRow(e, op.rowId);
        break;
      case "remove_column":
        e = core.removeColumn(e, op.columnId);
        break;
      case "fill_cells":
        e = core.fillCells(e, op.operation, op.hidden ?? true).envelope;
        break;
      case "set_settings":
        e = settings(e, op.settings);
        break;
    }
  }
  return e;
}

export function printFacts(e: core.Envelope, view: "pupil" | "answer" = "pupil") {
  const g = core.layout(e);
  return guidance({
    textSizesPt: renderedTextSizesPt(core.renderSvg(core.forView(e, view)), 72 / 25.4),
    gridPitchMm: [],
    tableRowHeightsMm: g.y.slice(1).map((y, i) => y - g.y[i]),
    answerLineLengthsMm: [],
  });
}
