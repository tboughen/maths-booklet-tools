import { z } from "zod";
import {
  DEFAULT_HEADINGS,
  documentSchema,
  headingsSchema,
  ratioEnvelopeSchema,
  ratioSpecSchema,
  rowSchema,
  cellSchema,
  transitionSchema,
  readSchema,
  normalizeDocument,
  RATIO_RENDERER_VERSION,
  RATIO_STYLE_PROFILE,
  RATIO_MAX_ENVELOPE_BYTES,
  RATIO_MAX_FILE_BYTES,
  RATIO_MAX_LINK_LENGTH,
  RATIO_MAX_REQUEST_BYTES,
} from "./schema";
import type { RatioDocument, RatioEnvelope } from "./schema";
import {
  RatioError,
  parseNumber,
  scaleNumber,
  fractionString,
  sameNumber,
} from "./numbers";
import { ratioMetrics } from "./svg";

export * from "./schema";
export * from "./numbers";
export * from "./svg";

function bounded(value: unknown, maximum: number, name: string) {
  const bytes = new TextEncoder().encode(JSON.stringify(value)).length;
  if (bytes > maximum)
    throw new RatioError("size_limit", `${name} is too large.`);
}
export function ratioEnvelope(input: unknown): RatioEnvelope {
  const document = normalizeDocument(input);
  ratioMetrics(document);
  const envelope: RatioEnvelope = {
    kind: "ratio-table",
    schemaVersion: 1,
    rendererVersion: RATIO_RENDERER_VERSION,
    styleProfile: RATIO_STYLE_PROFILE,
    document,
  };
  bounded(envelope, RATIO_MAX_ENVELOPE_BYTES, "The ratio table");
  return envelope;
}
export function validateRatioEnvelope(input: unknown): RatioEnvelope {
  bounded(input, RATIO_MAX_FILE_BYTES, "The editable file");
  if (
    input &&
    typeof input === "object" &&
    (("kind" in input && input.kind !== "ratio-table") ||
      ("rendererVersion" in input && input.rendererVersion === "graph-1"))
  )
    throw new RatioError(
      "wrong_tool",
      "This file is not a ratio table. Open graph files in the Graph builder.",
    );
  return ratioEnvelope(readSchema(ratioEnvelopeSchema, input).document);
}
export function createRatioTable(input: unknown): RatioEnvelope {
  bounded(input, RATIO_MAX_REQUEST_BYTES, "The ratio request");
  const spec = readSchema(ratioSpecSchema, input),
    used = new Set(spec.rows.flatMap((r) => (r.id ? [r.id] : [])));
  return ratioEnvelope({
    headings: spec.headings ?? structuredClone(DEFAULT_HEADINGS),
    rows: spec.rows.map((row) => {
      if (row.id) return row;
      let index = 1;
      while (used.has(`row-${index}`)) index++;
      const id = `row-${index}`;
      used.add(id);
      return { ...row, id };
    }),
    transitions: spec.transitions ?? [],
    size: spec.size ?? "standard",
    mode: spec.mode ?? "simple",
    showArrows: spec.showArrows ?? true,
    showOperations: spec.showOperations ?? true,
  });
}
export function emptyRatioTable(): RatioEnvelope {
  return createRatioTable({
    schemaVersion: 1,
    rows: [
      { cells: [{ kind: "empty" }, { kind: "empty" }] },
      { cells: [{ kind: "empty" }, { kind: "empty" }] },
    ],
  });
}
const id = z
  .string()
  .min(1)
  .max(32)
  .regex(/^[A-Za-z0-9_-]+$/);
export const ratioOperationSchema = z.discriminatedUnion("op", [
  z
    .object({
      op: z.literal("set_cell"),
      rowId: id,
      column: z.union([z.literal(0), z.literal(1)]),
      cell: cellSchema,
    })
    .strict(),
  z
    .object({ op: z.literal("add_row"), after: id.nullable(), row: rowSchema })
    .strict(),
  z.object({ op: z.literal("remove_row"), rowId: id }).strict(),
  z
    .object({ op: z.literal("set_transition"), transition: transitionSchema })
    .strict(),
  z.object({ op: z.literal("remove_transition"), from: id }).strict(),
  z
    .object({ op: z.literal("set_headings"), headings: headingsSchema })
    .strict(),
  z
    .object({ op: z.literal("set_size"), size: documentSchema.shape.size })
    .strict(),
  z
    .object({
      op: z.literal("set_annotation_visibility"),
      mode: documentSchema.shape.mode.optional(),
      showArrows: z.boolean().optional(),
      showOperations: z.boolean().optional(),
    })
    .strict(),
  z
    .object({
      op: z.literal("fill_next_row"),
      from: id,
      overwrite: z.boolean().optional(),
    })
    .strict(),
]);
export type RatioOperation = z.infer<typeof ratioOperationSchema>;
export const ratioRevisionSchema = z
  .object({
    envelope: ratioEnvelopeSchema,
    baseHash: z.string().regex(/^[a-f0-9]{64}$/),
    operations: z.array(ratioOperationSchema).max(20),
  })
  .strict();

export function applyRatioOperations(
  input: RatioEnvelope,
  operations: RatioOperation[],
): RatioEnvelope {
  operations = readSchema(z.array(ratioOperationSchema).max(20), operations);
  let document = structuredClone(validateRatioEnvelope(input).document);
  for (const raw of operations) {
    const op = readSchema(ratioOperationSchema, raw);
    const requireRow = (rowId: string) => {
      const row = document.rows.find((r) => r.id === rowId);
      if (!row)
        throw new RatioError("invalid_ratio_table", `No row has ID ${rowId}.`);
      return row;
    };
    switch (op.op) {
      case "set_cell":
        requireRow(op.rowId).cells[op.column] = op.cell;
        break;
      case "add_row": {
        if (document.rows.some((r) => r.id === op.row.id))
          throw new RatioError(
            "invalid_ratio_table",
            "The new row needs a unique ID.",
          );
        const index =
          op.after === null
            ? 0
            : document.rows.indexOf(requireRow(op.after)) + 1;
        const previous = document.rows[index - 1]?.id,
          next = document.rows[index]?.id;
        document.transitions = document.transitions.filter(
          (t) => !(t.from === previous && t.to === next),
        );
        document.rows.splice(index, 0, op.row);
        break;
      }
      case "remove_row": {
        document.rows.splice(document.rows.indexOf(requireRow(op.rowId)), 1);
        document.transitions = document.transitions.filter(
          (t) => t.from !== op.rowId && t.to !== op.rowId,
        );
        break;
      }
      case "set_transition": {
        requireRow(op.transition.from);
        requireRow(op.transition.to);
        document.transitions = document.transitions.filter(
          (t) => t.from !== op.transition.from,
        );
        document.transitions.push(op.transition);
        break;
      }
      case "remove_transition":
        requireRow(op.from);
        document.transitions = document.transitions.filter(
          (t) => t.from !== op.from,
        );
        break;
      case "set_headings":
        document.headings = op.headings;
        break;
      case "set_size":
        document.size = op.size;
        break;
      case "set_annotation_visibility": {
        if (op.mode !== undefined) document.mode = op.mode;
        if (op.showArrows !== undefined) document.showArrows = op.showArrows;
        if (op.showOperations !== undefined)
          document.showOperations = op.showOperations;
        break;
      }
      case "fill_next_row": {
        const step = document.transitions.find((t) => t.from === op.from);
        if (!step)
          throw new RatioError(
            "invalid_operation",
            "Choose a scaling operation and factor before filling the next row.",
          );
        const source = requireRow(step.from),
          target = requireRow(step.to);
        if (source.cells.some((c) => c.kind !== "number"))
          throw new RatioError(
            "incomplete_row",
            "Enter both source values before filling the next row.",
          );
        if (!op.overwrite && target.cells.some((c) => c.kind === "number"))
          throw new RatioError(
            "overwrite_required",
            "The next row contains values. Confirm before replacing them.",
          );
        target.cells = source.cells.map((c) => ({
          kind: "number" as const,
          value: fractionString(
            scaleNumber(
              parseNumber(c.kind === "number" ? c.value : "0"),
              step.operation,
              parseNumber(step.factor),
            ),
          ),
        })) as RatioDocument["rows"][number]["cells"];
        break;
      }
    }
    // Enforce every operation's invariants, so temporary dangling references cannot hide in a batch.
    document = ratioEnvelope(document).document;
  }
  return ratioEnvelope(document);
}
function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([k, v]) => [k, stable(v)]),
    );
  return value;
}
export function canonicalRatio(input: RatioEnvelope): string {
  return JSON.stringify(stable(validateRatioEnvelope(input)));
}
export async function ratioHash(envelope: RatioEnvelope): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(canonicalRatio(envelope)),
  );
  return Array.from(new Uint8Array(digest), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}
export async function reviseRatioTable(input: unknown): Promise<RatioEnvelope> {
  bounded(input, RATIO_MAX_REQUEST_BYTES, "The revision");
  const revision = readSchema(ratioRevisionSchema, input),
    envelope = validateRatioEnvelope(revision.envelope);
  if ((await ratioHash(envelope)) !== revision.baseHash)
    throw new RatioError(
      "stale_document",
      "Use the contentHash from the exact ratio table being revised.",
    );
  return applyRatioOperations(envelope, revision.operations);
}
export function ratioWarnings(envelope: RatioEnvelope): string[] {
  const document = envelope.document,
    warnings: string[] = [];
  for (const step of document.transitions) {
    const source = document.rows.find((r) => r.id === step.from)!,
      target = document.rows.find((r) => r.id === step.to)!;
    source.cells.forEach((cell, column) => {
      const other = target.cells[column];
      if (cell.kind !== "number" || other.kind !== "number") return;
      const a = parseNumber(cell.value),
        b = parseNumber(other.value),
        factor = parseNumber(step.factor);
      const matches =
        step.operation === "multiply"
          ? a.n * factor.n * b.d === b.n * a.d * factor.d
          : a.n * factor.d * b.d === b.n * a.d * factor.n;
      if (!matches)
        warnings.push(
          `${step.from} to ${step.to}: the operation disagrees with column ${column + 1}. Values have been kept.`,
        );
    });
  }
  const pairs = document.rows.flatMap((row) =>
    row.cells.every((c) => c.kind === "number")
      ? [
          {
            id: row.id,
            x: parseNumber((row.cells[0] as { value: string }).value),
            y: parseNumber((row.cells[1] as { value: string }).value),
          },
        ]
      : [],
  );
  const reference = pairs.find((row) => row.x.n !== 0n);
  for (const row of pairs) {
    if (!row.x.n && row.y.n)
      warnings.push(
        `${row.id} has zero x and nonzero y, so it is not a direct-proportion pair. Values have been kept.`,
      );
    else if (
      reference &&
      !sameNumber(
        { n: row.x.n * reference.y.n, d: row.x.d * reference.y.d },
        { n: row.y.n * reference.x.n, d: row.y.d * reference.x.d },
      )
    )
      warnings.push(
        `${row.id} has a different ratio from ${reference.id}. Values have been kept.`,
      );
  }
  if (pairs.length && !reference && pairs.every((row) => !row.y.n))
    warnings.push(
      "All complete rows contain zeros; they do not determine a unique ratio.",
    );
  return warnings;
}
export function describeRatio(envelope: RatioEnvelope): string {
  const d = envelope.document;
  const rows = d.rows
    .map(
      (row) =>
        `${row.id}: (${row.cells.map((c) => (c.kind === "number" ? c.value : c.kind === "empty" ? "empty" : "answer line")).join(", ")})`,
    )
    .join("; ");
  return `Ratio table, headings ${d.headings.map((h) => h.text + (h.direction === "none" ? "" : h.direction === "up" ? " ↑" : " →")).join(" and ")}. ${rows}. ${d.mode === "simple" ? "Scaling annotations hidden." : `Scaling arrows ${d.showArrows ? "shown" : "hidden"}; operation labels ${d.showOperations ? "shown" : "hidden"}.`}`;
}
export function encodeRatio(envelope: RatioEnvelope): string {
  return btoa(
    Array.from(new TextEncoder().encode(canonicalRatio(envelope)), (b) =>
      String.fromCharCode(b),
    ).join(""),
  )
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}
export function decodeRatio(payload: string): RatioEnvelope {
  if (
    payload.length > RATIO_MAX_LINK_LENGTH ||
    !/^[A-Za-z0-9_-]+$/.test(payload)
  )
    throw new RatioError(
      "size_limit",
      "Invalid or oversized ratio link. Open the editable file instead.",
    );
  try {
    const bytes = Uint8Array.from(
      atob(payload.replaceAll("-", "+").replaceAll("_", "/")),
      (c) => c.charCodeAt(0),
    );
    return validateRatioEnvelope(
      JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)),
    );
  } catch (error) {
    if (error instanceof RatioError) throw error;
    throw new RatioError(
      "invalid_ratio_table",
      "The ratio-table link cannot be read.",
    );
  }
}
export function ratioEditorLink(envelope: RatioEnvelope, base: string): string {
  const url = new URL(base);
  url.search = "?tool=ratio-table";
  url.hash = `ratio-table=${encodeRatio(envelope)}`;
  if (url.href.length > RATIO_MAX_LINK_LENGTH)
    throw new RatioError(
      "size_limit",
      "This table is too large for a link. Save its editable JSON instead.",
    );
  return url.href;
}
export function parseRatioFile(text: string): RatioEnvelope {
  if (new TextEncoder().encode(text).length > RATIO_MAX_FILE_BYTES)
    throw new RatioError(
      "size_limit",
      "Choose a ratio-table JSON smaller than 64 KiB.",
    );
  try {
    return validateRatioEnvelope(JSON.parse(text));
  } catch (error) {
    if (error instanceof RatioError) throw error;
    throw new RatioError(
      "invalid_ratio_table",
      "Choose a valid editable ratio-table JSON file.",
    );
  }
}
