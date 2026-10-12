// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  applyRatioOperations,
  canonicalRatio,
  createRatioTable,
  decodeRatio,
  encodeRatio,
  parseRatioFile,
  ratioHash,
  ratioMetrics,
  ratioWarnings,
  renderRatioSvg,
  validateRatioEnvelope,
} from "./interchange";
import type { RatioEnvelope } from "./interchange";

const legacy = JSON.parse(
  readFileSync(new URL("../fixtures/legacy-v1.json", import.meta.url), "utf8"),
) as Array<{ envelope: RatioEnvelope; hash: string; svg: string }>;
const thirdColumn = () =>
  applyRatioOperations(legacy[1].envelope, [
    {
      op: "add_column",
      heading: { text: "z", italic: true, direction: "none" },
    },
  ]);

describe("legacy saved tables and three-column ratios", () => {
  it("keeps untouched legacy files, content hashes and rendered SVGs exactly the same", async () => {
    for (const fixture of legacy) {
      const saved = parseRatioFile(JSON.stringify(fixture.envelope));
      expect(saved).toEqual(fixture.envelope);
      expect(await ratioHash(saved)).toBe(fixture.hash);
      expect(renderRatioSvg(saved.document)).toBe(fixture.svg);
      expect(decodeRatio(encodeRatio(saved))).toEqual(saved);
    }
  });
  it("upgrades only when adding a column, retains blanks and can return to the legacy format", async () => {
    const before = legacy[1].envelope,
      added = thirdColumn();
    expect(added.schemaVersion).toBe(2);
    expect(added.rendererVersion).toBe("ratio-2");
    added.document.rows.forEach((row, index) => {
      expect(row.cells.slice(0, 2)).toEqual(before.document.rows[index].cells);
      expect(row.cells[2]).toEqual({ kind: "empty" });
    });
    expect(added.document.transitions).toEqual(before.document.transitions);
    expect(parseRatioFile(canonicalRatio(added))).toEqual(added);
    expect(decodeRatio(encodeRatio(added))).toEqual(added);
    const removed = applyRatioOperations(added, [
      { op: "remove_column", column: 2 },
    ]);
    expect(removed).toEqual(before);
    expect(await ratioHash(removed)).toBe(legacy[1].hash);
  });
  it("checks the third column and fills every column only on an explicit operation", () => {
    const added = thirdColumn();
    expect(() =>
      applyRatioOperations(added, [
        { op: "fill_next_row", from: "start", overwrite: true },
      ]),
    ).toThrow(/all source/);
    const complete = applyRatioOperations(added, [
      {
        op: "set_cell",
        rowId: "start",
        column: 2,
        cell: { kind: "number", value: "6" },
      },
    ]);
    expect(complete.document.rows[1].cells[2]).toEqual({ kind: "empty" });
    expect(() =>
      applyRatioOperations(complete, [{ op: "fill_next_row", from: "start" }]),
    ).toThrow(/Confirm/);
    const filled = applyRatioOperations(complete, [
      { op: "fill_next_row", from: "start", overwrite: true },
    ]);
    expect(filled.document.rows[1].cells).toEqual([
      { kind: "number", value: "1" },
      { kind: "number", value: "2/3" },
      { kind: "number", value: "2" },
    ]);
    expect(ratioWarnings(filled)).toEqual([]);
    const wrong = applyRatioOperations(filled, [
      {
        op: "set_cell",
        rowId: "target",
        column: 2,
        cell: { kind: "number", value: "5" },
      },
    ]);
    expect(ratioWarnings(wrong).join(" ")).toMatch(/column 3.*different ratio/);
  });
  it("rejects mismatched rows, version claims, nonexistent columns and a fourth column atomically", () => {
    const added = thirdColumn();
    expect(() =>
      validateRatioEnvelope({
        ...added,
        schemaVersion: 1,
        rendererVersion: "ratio-1",
      }),
    ).toThrow(/format/);
    expect(() =>
      createRatioTable({ schemaVersion: 1, rows: added.document.rows }),
    ).toThrow(/schemaVersion 2/);
    expect(() =>
      createRatioTable({
        schemaVersion: 2,
        rows: added.document.rows.map((row, index) =>
          index ? { ...row, cells: row.cells.slice(0, 2) } : row,
        ),
      }),
    ).toThrow(/each heading/);
    expect(() =>
      applyRatioOperations(legacy[1].envelope, [
        { op: "set_cell", rowId: "start", column: 2, cell: { kind: "empty" } },
      ]),
    ).toThrow(/existing column/);
    expect(() =>
      applyRatioOperations(added, [
        {
          op: "add_column",
          heading: { text: "w", italic: true, direction: "none" },
        },
      ]),
    ).toThrow();
    expect(() =>
      applyRatioOperations(legacy[1].envelope, [
        { op: "remove_column", column: 1 },
      ]),
    ).toThrow();
    expect(added).toEqual(thirdColumn());
  });
  it("allocates a distinct, unclipped scaling lane for every column at all print sizes", () => {
    for (const size of ["compact", "standard", "large"] as const) {
      const envelope = applyRatioOperations(thirdColumn(), [
        { op: "set_size", size },
      ]);
      const svg = renderRatioSvg(envelope.document),
        metrics = ratioMetrics(envelope.document);
      expect(svg.match(/class="ratio-scaling-arrow"/g)).toHaveLength(3);
      expect(svg.match(/class="ratio-operation"/g)).toHaveLength(3);
      expect(metrics.tableLeft + metrics.tableWidth).toBeLessThan(
        metrics.width,
      );
      expect(metrics.columnWidth).toBe(150 + metrics.gutter);
      expect(svg).not.toMatch(/ratio-edit-layer|ratio-step-highlight|<input/);
      const hidden = applyRatioOperations(envelope, [
        { op: "set_annotation_visibility", mode: "simple" },
      ]);
      expect(renderRatioSvg(hidden.document)).not.toContain(
        "ratio-scaling-arrow",
      );
      expect(hidden.document.transitions).toEqual(
        envelope.document.transitions,
      );
    }
  });
});
