import { z } from "zod";
import * as core from "./index";
import { examples } from "./examples";
import { guidance, renderedTextSizesPt } from "../../graph-core/src/print-guidance";

/** Connector adapter: the same schema, exact totals and renderer as the browser editor. */
export const exampleIds = examples.map((x) => x.id) as [string, ...string[]];
const show = z.enum(["show", "hidden"]);
const cellText = z.string().max(16);
/** A cell: its number, or { text, hidden } to keep it as a saved answer the pupil copy leaves empty. */
const cellInput = z.union([cellText, z.object({ text: cellText, hidden: z.boolean().optional() }).strict()]);
const heading = z.string().max(core.MAX_HEADING);
export const outputViewSchema = z.enum(["pupil", "answer"]);
export const specSchema = z
  .object({
    example: z.enum(exampleIds).optional(),
    worked: z.boolean().optional(),
    corner: heading.optional(),
    columns: z.array(heading).min(1).max(core.MAX_CATEGORIES).optional(),
    rows: z
      .array(
        z
          .object({
            heading,
            /** One per column, then the row total when totals are on. "" is a pupil blank. */
            cells: z.array(cellInput).max(core.MAX_CATEGORIES + 1).optional(),
          })
          .strict(),
      )
      .min(1)
      .max(core.MAX_CATEGORIES)
      .optional(),
    /** A Total column and a Total row (default true). */
    totals: z.boolean().optional(),
    /** The Total row's cells, under each column and then the grand total. */
    totalRow: z.array(cellInput).max(core.MAX_CATEGORIES + 1).optional(),
    cellMm: core.documentSchema.shape.cellMm.optional(),
    intentionalError: z.boolean().optional(),
    /** Explicitly fill blank totals whose parts are all given. */
    completeTotals: z.boolean().optional(),
  })
  .strict();
export const createSchema = z
  .object({ envelope: core.envelopeSchema.optional(), spec: specSchema.optional(), outputView: outputViewSchema.optional() })
  .strict();
const rowRef = z.string().max(24).describe('A row ID such as "r1", or "total" for the Total row.');
const columnRef = z.string().max(24).describe('A column ID such as "c1", or "total" for the Total column.');
export const operationSchema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("set_cell"), rowId: rowRef, columnId: columnRef, text: cellText.optional(), show: show.optional() }).strict(),
  z.object({ op: z.literal("set_heading"), id: z.string().max(24).describe('A row or column ID, or "corner".'), text: heading }).strict(),
  z.object({ op: z.literal("add_row"), heading: heading.optional() }).strict(),
  z.object({ op: z.literal("add_column"), heading: heading.optional() }).strict(),
  z.object({ op: z.literal("remove_row"), rowId: z.string().max(24) }).strict(),
  z.object({ op: z.literal("remove_column"), columnId: z.string().max(24) }).strict(),
  z.object({ op: z.literal("set_totals"), row: z.boolean().optional(), column: z.boolean().optional() }).strict(),
  z.object({ op: z.literal("complete_totals"), hidden: z.boolean().optional() }).strict(),
  z
    .object({ op: z.literal("set_settings"), settings: z.object({ cellMm: core.documentSchema.shape.cellMm, intentionalError: z.boolean() }).partial().strict() })
    .strict(),
]);
export const revisionSchema = z
  .object({
    envelope: core.envelopeSchema,
    baseHash: z.string().regex(/^[a-f0-9]{64}$/),
    operations: z.array(operationSchema).max(30),
    outputView: outputViewSchema.optional(),
  })
  .strict();

const toCell = (c: z.infer<typeof cellInput>): core.Cell =>
  typeof c === "string" ? core.cell(c) : core.cell(c.text, c.hidden && c.text.trim() ? "hidden" : "show");
function fill(cells: core.Cell[], given: z.infer<typeof cellInput>[] | undefined, what: string) {
  if (!given) return;
  if (given.length > cells.length) throw Error(`${what} has ${given.length} cells; this table has room for ${cells.length}.`);
  given.forEach((c, i) => (cells[i] = toCell(c)));
}

export function create(input: unknown): core.Envelope {
  const v = createSchema.parse(input);
  if (v.envelope && v.spec) throw Error("Supply spec or envelope, not both.");
  if (v.envelope) return core.validate(v.envelope);
  const s = v.spec;
  if (!s) return core.create();
  if (s.example && (s.columns || s.rows || s.totalRow)) throw Error("Examples already contain their table; revise the result instead.");
  let e: core.Envelope;
  if (s.example) e = examples.find((x) => x.id === s.example)!.make(false);
  else {
    e = core.create(s.columns ?? ["", ""], (s.rows ?? [{ heading: "" }, { heading: "" }]).map((r) => r.heading), s.totals ?? true);
    const n = structuredClone(e);
    (s.rows ?? []).forEach((r, i) => fill(n.document.rows[i].cells, r.cells, `Row "${r.heading}"`));
    if (s.totalRow) {
      if (!n.document.totalRow) throw Error("Turn totals on to give a Total row.");
      fill(n.document.totalRow, s.totalRow, "The Total row");
    }
    if (s.corner !== undefined) n.document.corner = s.corner;
    e = core.validate(n);
  }
  if (s.cellMm !== undefined || s.intentionalError !== undefined)
    e = core.validate({ ...e, document: { ...e.document, ...(s.cellMm !== undefined ? { cellMm: s.cellMm } : {}), ...(s.intentionalError !== undefined ? { intentionalError: s.intentionalError } : {}) } });
  if (s.completeTotals) e = core.completeTotals(e).envelope;
  if (s.worked) e = core.forView(e, "answer");
  return e;
}

export async function revise(input: unknown): Promise<core.Envelope> {
  const v = revisionSchema.parse(input);
  if ((await core.hash(v.envelope)) !== v.baseHash) throw Error("base_hash_mismatch: Use the exact returned envelope and contentHash.");
  let e = core.validate(structuredClone(v.envelope));
  for (const op of v.operations) {
    switch (op.op) {
      case "set_cell": {
        const current = core.cellAt(e.document, op.rowId, op.columnId);
        e = core.setCell(e, op.rowId, op.columnId, op.text ?? current.text, op.show ?? current.show);
        break;
      }
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
      case "set_totals":
        e = core.setTotals(e, op);
        break;
      case "complete_totals":
        e = core.completeTotals(e, op.hidden).envelope;
        break;
      case "set_settings":
        e = core.validate({ ...e, document: { ...e.document, ...op.settings } });
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
