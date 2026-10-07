// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  applyRatioOperations,
  canonicalNumber,
  canonicalRatio,
  createRatioTable,
  decodeRatio,
  emptyRatioTable,
  encodeRatio,
  parseNumber,
  ratioEditorLink,
  ratioHash,
  ratioWarnings,
  reviseRatioTable,
  fractionString,
  scaleNumber,
  validateRatioEnvelope,
} from "./interchange";
const scaffold = () =>
  createRatioTable({
    schemaVersion: 1,
    rows: [
      {
        id: "start",
        cells: [
          { kind: "number", value: "3" },
          { kind: "number", value: "2" },
        ],
      },
      {
        id: "target",
        cells: [{ kind: "number", value: "1" }, { kind: "answer-line" }],
      },
    ],
    mode: "annotated",
    transitions: [
      { from: "start", to: "target", operation: "divide", factor: "3" },
    ],
  });
describe("exact ratio-table documents and revisions", () => {
  it("bounds multi-step tables and operation batches while retaining faded scaffolds", () => {
    const rows = Array.from({ length: 6 }, (_, i) => ({ id: `r${i}`, cells: [
      { kind: "number", value: String(64 / 2**i) }, { kind: "number", value: String(128 / 2**i) },
    ] }));
    const transitions = Array.from({ length: 5 }, (_, i) => ({ from: `r${i}`, to: `r${i+1}`, operation: "divide", factor: "2" }));
    const envelope = createRatioTable({ schemaVersion: 1, rows, transitions, mode: "annotated", size: "large" });
    expect(ratioWarnings(envelope)).toEqual([]);
    const faded = applyRatioOperations(envelope, [{ op: "set_annotation_visibility", showOperations: false }]);
    expect(faded.document.transitions).toEqual(envelope.document.transitions);
    expect(faded.document.rows).toEqual(envelope.document.rows);
    expect(() => applyRatioOperations(envelope, [{ op: "add_row", after: "r5", row: { id: "seventh", cells: [{ kind: "empty" }, { kind: "empty" }] } }])).toThrow();
    expect(() => applyRatioOperations(envelope, Array.from({ length: 21 }, () => ({ op: "set_size" as const, size: "standard" as const })))).toThrow();
  });
  it("preserves decimal display, reduces signed fractions and calculates exactly", () => {
    expect(canonicalNumber(" +000.2500 ")).toBe("0.25");
    expect(canonicalNumber("-2/-6")).toBe("1/3");
    expect(canonicalNumber("−0.000")).toBe("0");
    expect(
      fractionString(
        scaleNumber(parseNumber("0.1"), "multiply", parseNumber("3")),
      ),
    ).toBe("3/10");
    expect(() => parseNumber("1/0")).toThrow(/zero denominator/);
    expect(() => parseNumber("1e3")).toThrow(/integer/);
    expect(() => parseNumber("0.1234567")).toThrow(/6 places/);
    expect(() => parseNumber("1/1000001")).toThrow(/limits/);
    expect(() =>
      scaleNumber(parseNumber("1"), "divide", parseNumber("0")),
    ).toThrow(/zero/);
  });
  it("round-trips explicit blanks without inferring answers or changing other cell states", () => {
    const envelope = scaffold(),
      encoded = encodeRatio(envelope);
    expect(decodeRatio(encoded)).toEqual(envelope);
    expect(canonicalRatio(envelope)).not.toContain("2/3");
    expect(envelope.document.rows[1].cells[1]).toEqual({ kind: "answer-line" });
    const empty = emptyRatioTable();
    expect(
      empty.document.rows
        .flatMap((r) => r.cells)
        .every((c) => c.kind === "empty"),
    ).toBe(true);
    const zero = applyRatioOperations(empty, [
      {
        op: "set_cell",
        rowId: "row-1",
        column: 0,
        cell: { kind: "number", value: "0" },
      },
    ]);
    expect(zero.document.rows[0].cells[0].kind).toBe("number");
    expect(zero.document.rows[0].cells[1].kind).toBe("empty");
  });
  it("fills only on an explicit action, requires overwrite consent and is atomic", async () => {
    const envelope = scaffold(),
      hash = await ratioHash(envelope);
    await expect(
      reviseRatioTable({
        envelope,
        baseHash: hash,
        operations: [{ op: "fill_next_row", from: "start" }],
      }),
    ).rejects.toMatchObject({ code: "overwrite_required" });
    const filled = await reviseRatioTable({
      envelope,
      baseHash: hash,
      operations: [{ op: "fill_next_row", from: "start", overwrite: true }],
    });
    expect(filled.document.rows[1].cells).toEqual([
      { kind: "number", value: "1" },
      { kind: "number", value: "2/3" },
    ]);
    expect(envelope).toEqual(scaffold());
    await expect(
      reviseRatioTable({ envelope, baseHash: "0".repeat(64), operations: [] }),
    ).rejects.toMatchObject({ code: "stale_document" });
    await expect(
      reviseRatioTable({
        envelope,
        baseHash: hash,
        operations: [
          {
            op: "set_cell",
            rowId: "start",
            column: 1,
            cell: { kind: "number", value: "9" },
          },
          {
            op: "set_cell",
            rowId: "missing",
            column: 0,
            cell: { kind: "empty" },
          },
        ],
      }),
    ).rejects.toMatchObject({ code: "invalid_ratio_table" });
    expect(await ratioHash(envelope)).toBe(hash);
  });
  it("retains inconsistent teaching examples with warnings and no corrections", () => {
    const envelope = applyRatioOperations(scaffold(), [
      {
        op: "set_cell",
        rowId: "target",
        column: 1,
        cell: { kind: "number", value: "1" },
      },
    ]);
    expect(ratioWarnings(envelope).join(" ")).toMatch(
      /operation disagrees.*different ratio/,
    );
    expect(envelope.document.rows[1].cells[1]).toEqual({
      kind: "number",
      value: "1",
    });
    expect(ratioWarnings(scaffold())).toEqual([]);
  });
  it("cleans only affected transitions and retains unaffected stable rows", () => {
    const envelope = applyRatioOperations(scaffold(), [
      {
        op: "add_row",
        after: "target",
        row: { id: "third", cells: [{ kind: "empty" }, { kind: "empty" }] },
      },
      {
        op: "set_transition",
        transition: {
          from: "target",
          to: "third",
          operation: "multiply",
          factor: "2",
        },
      },
    ]);
    const inserted = applyRatioOperations(envelope, [
      {
        op: "add_row",
        after: "start",
        row: { id: "between", cells: [{ kind: "empty" }, { kind: "empty" }] },
      },
    ]);
    expect(inserted.document.transitions.map((t) => t.from)).toEqual([
      "target",
    ]);
    const removed = applyRatioOperations(inserted, [
      { op: "remove_row", rowId: "between" },
    ]);
    expect(removed.document.transitions).toEqual(inserted.document.transitions);
    expect(removed.document.rows).toEqual(envelope.document.rows);
  });
  it("refuses malformed/oversized/foreign documents and visual overflow", () => {
    const envelope = scaffold();
    expect(() =>
      validateRatioEnvelope({ ...envelope, rendererVersion: "ratio-2" }),
    ).toThrow();
    expect(() =>
      validateRatioEnvelope({ ...envelope, kind: "coordinate-graph" }),
    ).toThrow(/Graph builder/);
    expect(() =>
      validateRatioEnvelope({ ...envelope, unexpected: "script" }),
    ).toThrow();
    expect(() =>
      createRatioTable({
        schemaVersion: 1,
        rows: [{ cells: [{ kind: "empty" }, { kind: "empty" }] }],
      }),
    ).toThrow();
    expect(() =>
      applyRatioOperations(envelope, [
        {
          op: "set_transition",
          transition: {
            from: "target",
            to: "start",
            operation: "divide",
            factor: "2",
          },
        },
      ]),
    ).toThrow(/adjacent/);
    expect(() =>
      applyRatioOperations(envelope, [
        {
          op: "set_cell",
          rowId: "start",
          column: 0,
          cell: { kind: "number", value: "1000000" },
        },
      ]),
    ).toThrow(/too wide/);
    expect(() =>
      applyRatioOperations(envelope, [
        {
          op: "set_headings",
          headings: [
            { text: "Temperature", italic: false, direction: "right" },
            envelope.document.headings[1],
          ],
        },
      ]),
    ).toThrow(/heading is too wide/);
    const link = ratioEditorLink(
      envelope,
      "https://example.com/maths-booklet-tools/?tool=question-bank&code=U851#old",
    );
    expect(new URL(link).search).toBe("?tool=ratio-table");
    expect(new URL(link).pathname).toBe("/maths-booklet-tools/");
    expect(new URL(link).hash).toMatch(/^#ratio-table=/);
  });
});
