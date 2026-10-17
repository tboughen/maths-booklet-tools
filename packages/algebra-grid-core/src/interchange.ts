import { z } from "zod";
import * as core from "./index";
import {
  guidance,
  renderedTextSizesPt,
} from "../../graph-core/src/print-guidance";
const cellEdit = z
  .object({
    rowId: z.string(),
    columnId: z.string(),
    value: z.string().max(32).nullable(),
    hidden: z.boolean().optional(),
  })
  .strict();
const settings = core.documentSchema
  .omit({
    rows: true,
    columns: true,
    cellMm: true,
    answer: true,
    answerVisible: true,
    answerBasis: true,
    sourceId: true,
  })
  .partial();
export const exampleNames = [
  "single",
  "double",
  "signed",
  "cubic",
  "factor",
  "negative",
  "common",
  "source-expand",
  "source-factor",
] as const;
export const createSchema = z
  .object({
    envelope: core.schema.optional(),
    spec: z
      .object({
        example: z.enum(exampleNames).optional(),
        rowCount: z.number().int().min(2).max(7).optional(),
        columnCount: z.number().int().min(2).max(7).optional(),
        cellMm: z.number().min(12).max(18).optional(),
        settings: settings.optional(),
        cells: z.array(cellEdit).max(49).optional(),
      })
      .strict()
      .optional(),
  })
  .strict();
export const operationSchema = z.discriminatedUnion("op", [
  cellEdit.extend({ op: z.literal("set_cell") }),
  z.object({ op: z.literal("set_settings"), settings }).strict(),
  z
    .object({
      op: z.literal("set_cell_size"),
      cellMm: z.number().min(12).max(18),
    })
    .strict(),
  z
    .object({
      op: z.literal("set_column_width"),
      columnId: z.string(),
      widthMm: z.number().min(12).max(45),
    })
    .strict(),
  ...(
    [
      "add_row",
      "remove_row",
      "add_column",
      "remove_column",
      "collect_answer",
      "calculate_answer",
      "worked_copy",
    ] as const
  ).map((op) => z.object({ op: z.literal(op) }).strict()),
  z
    .object({
      op: z.literal("fill_products"),
      overwrite: z.boolean().default(false),
    })
    .strict(),
  z
    .object({ op: z.literal("set_answer_visibility"), visible: z.boolean() })
    .strict(),
]);
export const revisionSchema = z
  .object({
    envelope: core.schema,
    baseHash: z.string().regex(/^[a-f0-9]{64}$/),
    operations: z.array(operationSchema).max(30),
  })
  .strict();
export async function hash(e: core.Envelope) {
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(core.canonical(e)),
  );
  return Array.from(new Uint8Array(bytes), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}
function cell(e: core.Envelope, v: z.infer<typeof cellEdit>) {
  const r = e.document.rows.findIndex((row) => row.id === v.rowId),
    c = e.document.columns.findIndex((col) => col.id === v.columnId);
  if (r < 0 || c < 0)
    throw Error(
      "Use existing stable rowId and columnId values from the returned envelope.",
    );
  return core.setCell(
    e,
    r,
    c,
    v.value,
    v.hidden ?? e.document.rows[r].cells[c].hidden,
  );
}
export function create(input: unknown) {
  const v = createSchema.parse(input);
  if (v.envelope && v.spec) throw Error("Supply spec or envelope, not both.");
  if (v.envelope) return core.validate(v.envelope);
  const s = v.spec;
  if (s?.example && (s.rowCount !== undefined || s.columnCount !== undefined))
    throw Error("Use an example or row/column counts, not both.");
  let e = s?.example
    ? core.example(s.example)
    : core.create(s?.rowCount, s?.columnCount);
  if (s?.cellMm !== undefined) e = core.setSize(e, s.cellMm);
  if (s?.settings) {
    e.document = { ...e.document, ...s.settings };
    e = core.validate(e);
  }
  for (const edit of s?.cells ?? []) e = cell(e, edit);
  return e;
}
export async function revise(input: unknown) {
  const v = revisionSchema.parse(input);
  if ((await hash(v.envelope)) !== v.baseHash)
    throw Error(
      "base_hash_mismatch: Use the exact returned envelope and contentHash.",
    );
  let e = structuredClone(v.envelope);
  for (const op of v.operations) {
    switch (op.op) {
      case "set_cell":
        e = cell(e, op);
        break;
      case "set_settings":
        e.document = { ...e.document, ...op.settings };
        e.document.sourceId = null;
        break;
      case "set_cell_size":
        e = core.setSize(e, op.cellMm);
        break;
      case "set_column_width": {
        const c = e.document.columns.find((c) => c.id === op.columnId);
        if (!c) throw Error("Unknown columnId.");
        c.widthMm = op.widthMm;
        c.fixed = true;
        break;
      }
      case "add_row":
      case "remove_row":
      case "add_column":
      case "remove_column":
        e = core.resize(
          e,
          op.op.endsWith("row") ? "row" : "column",
          op.op.startsWith("add"),
        );
        break;
      case "fill_products":
        if (
          !op.overwrite &&
          e.document.rows
            .slice(1)
            .some((r) => r.cells.slice(1).some((c) => c.value !== null))
        )
          throw Error("Existing products require overwrite:true.");
        e = core.fillProducts(e);
        break;
      case "collect_answer":
        e = core.collectAnswer(e);
        break;
      case "calculate_answer":
        e = core.answerBelow(e);
        break;
      case "worked_copy":
        e = core.workedCopy(e);
        break;
      case "set_answer_visibility":
        if (op.visible && !e.document.answer)
          throw Error("Calculate an answer before showing it.");
        e.document.answerVisible = op.visible;
        break;
    }
    e = core.validate(e);
  }
  return e;
}
export function editorLink(e: core.Envelope, base: string) {
  const bytes = new TextEncoder().encode(core.canonical(e));
  const u = new URL(base);
  u.search = "?tool=expanding-factorising";
  u.hash =
    "algebra-grid=" +
    btoa(Array.from(bytes, (b) => String.fromCharCode(b)).join(""))
      .replaceAll("+", "-")
      .replaceAll("/", "_")
      .replace(/=+$/, "");
  return u.href.length <= 16000 ? u.href : null;
}
export function printFacts(e: core.Envelope) {
  const g = core.layout(e),
    d = e.document;
  return guidance({
    textSizesPt: renderedTextSizesPt(core.renderSvg(e), 72 / 25.4),
    gridPitchMm: d.gridVisible ? [d.cellMm] : [],
    tableRowHeightsMm: d.gridVisible ? g.rowHeights : [],
    answerLineLengthsMm: d.answerLines ? [g.width - 6] : [],
  });
}
