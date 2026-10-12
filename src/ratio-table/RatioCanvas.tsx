import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { Plus } from "lucide-react";
import {
  describeRatio,
  ratioMetrics,
  renderRatioSvg,
} from "../../packages/ratio-table-core/src/interchange";
import type {
  RatioEnvelope,
  RatioOperation,
} from "../../packages/ratio-table-core/src/interchange";
import { NumberInput } from "./NumberInput";
import { HeadingInput } from "./HeadingInput";
import { headingText, headingFromText } from "./headingText";

export type RatioSelection =
  | { kind: "cell"; rowId: string; column: number }
  | { kind: "heading"; column: number }
  | { kind: "step"; from: string }
  | { kind: "headings" }
  | null;

export function RatioCanvas({
  envelope,
  zoom,
  guides,
  inputVersion,
  disabled,
  structureDisabled,
  selection,
  tool,
  arrowFrom,
  onSelect,
  onArrowRow,
  onPending,
  onOperations,
  onAddRow,
  onAddColumn,
}: {
  envelope: RatioEnvelope;
  zoom: number;
  guides: boolean;
  inputVersion: number;
  disabled: boolean;
  structureDisabled: boolean;
  selection: RatioSelection;
  tool: "edit" | "arrow";
  arrowFrom: string | null;
  onSelect: (selection: RatioSelection) => void;
  onArrowRow: (rowId: string) => void;
  onPending: (key: string, pending: boolean) => void;
  onOperations: (operations: RatioOperation[]) => void;
  onAddRow: () => void;
  onAddColumn: () => void;
}) {
  const document = envelope.document,
    m = ratioMetrics(document);
  const stage = useRef<HTMLDivElement>(null);
  const [availableWidth, setAvailableWidth] = useState(800);
  useEffect(() => {
    if (!stage.current) return;
    const element = stage.current;
    const observer = new ResizeObserver(() => {
      const padding =
        parseFloat(getComputedStyle(element).paddingLeft) +
        parseFloat(getComputedStyle(element).paddingRight);
      setAvailableWidth(element.clientWidth - padding - 16);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const edgeControlsWidth = availableWidth < 560 ? 0 : 132;
  const physicalWidth = m.widthCm * 37.7952756;
  const displayZoom =
    zoom ||
    Math.max(
      1,
      Math.min(2, (availableWidth - edgeControlsWidth) / physicalWidth),
    );
  const position = (
    x: number,
    y: number,
    width: number,
    height: number,
  ): CSSProperties => ({
    left: `${(x / m.width) * 100}%`,
    top: `${(y / m.height) * 100}%`,
    width: `${(width / m.width) * 100}%`,
    height: `${(height / m.height) * 100}%`,
  });
  return (
    <div
      className="ratio-stage"
      ref={stage}
      role="region"
      aria-label="Ratio table workspace"
      tabIndex={0}
    >
      {physicalWidth * displayZoom > availableWidth && (
        <p className="ratio-scroll-hint">
          Scroll sideways to see every column.
        </p>
      )}
      <div className="ratio-canvas-layout">
        <div
          className="ratio-paper"
          style={
            {
              width: `${physicalWidth * displayZoom}px`,
              "--ratio-edit-font": `${16 * m.scale * displayZoom}px`,
            } as CSSProperties
          }
        >
          <div
            className="ratio-preview"
            data-testid="ratio-preview"
            role="img"
            aria-label={describeRatio(envelope)}
            dangerouslySetInnerHTML={{ __html: renderRatioSvg(document) }}
          />
          {guides && (
            <svg
              className="ratio-guides"
              viewBox={`0 0 ${m.width} ${m.height}`}
              aria-hidden="true"
            >
              <g stroke="#a3a9b0" strokeDasharray="3 5" fill="none">
                {Array.from({ length: document.rows.length + 2 }, (_, i) => (
                  <path
                    key={i}
                    d={`M${m.tableLeft} ${m.tableTop + i * 100}h${m.tableWidth}`}
                  />
                ))}
              </g>
            </svg>
          )}
          <fieldset
            className="ratio-edit-layer"
            disabled={disabled}
            aria-label="Edit ratio table"
          >
            {selection?.kind === "step" &&
              document.rows.flatMap((row, index) => {
                const from = document.rows.findIndex(
                  (row) => row.id === selection.from,
                );
                return index === from || index === from + 1
                  ? [
                      <div
                        key={`highlight-${row.id}`}
                        className="ratio-step-highlight"
                        style={position(
                          m.tableLeft,
                          m.tableTop + (index + 1) * 100 + 4,
                          m.tableWidth,
                          92,
                        )}
                      />,
                    ]
                  : [];
              })}
            {document.headings.map((heading, column) => (
              <div
                key={`heading-${column}-${inputVersion}`}
                className={`ratio-inline-heading${selection?.kind === "heading" && selection.column === column ? " is-selected" : ""}`}
                style={position(
                  m.tableLeft + column * m.columnWidth + 8,
                  m.tableTop + 10,
                  134,
                  80,
                )}
              >
                <HeadingInput
                  value={headingText(heading)}
                  label={`Edit column ${column + 1} heading`}
                  inputKey={`inline-heading-${column}`}
                  onPending={onPending}
                  onFocus={() => onSelect({ kind: "heading", column })}
                  onCommit={(text) => {
                    const headings = structuredClone(document.headings);
                    headings[column] = headingFromText(headings[column], text);
                    onOperations([{ op: "set_headings", headings }]);
                  }}
                />
              </div>
            ))}
            {document.rows.map((row, index) => (
              <div key={row.id}>
                {tool === "arrow" ? (
                  <button
                    type="button"
                    className={`ratio-row-target${arrowFrom === row.id ? " is-selected" : ""}`}
                    style={position(
                      m.tableLeft,
                      m.tableTop + (index + 1) * 100 + 5,
                      m.tableWidth,
                      90,
                    )}
                    aria-label={`Choose row ${index + 1} for arrow`}
                    aria-pressed={arrowFrom === row.id}
                    disabled={
                      structureDisabled ||
                      (!arrowFrom && index === document.rows.length - 1)
                    }
                    onClick={() => onArrowRow(row.id)}
                  >
                    <span>Row {index + 1}</span>
                  </button>
                ) : (
                  row.cells.map((cell, column) => (
                    <div
                      key={`${column}-${inputVersion}`}
                      className={`ratio-inline-cell${selection?.kind === "cell" && selection.rowId === row.id && selection.column === column ? " is-selected" : ""}`}
                      data-cell-kind={cell.kind}
                      style={position(
                        m.tableLeft + column * m.columnWidth + 8,
                        m.tableTop + (index + 1) * 100 + 10,
                        134,
                        80,
                      )}
                    >
                      <NumberInput
                        value={cell.kind === "number" ? cell.value : ""}
                        label={`Row ${index + 1} ${document.headings[column].text} value`}
                        inputKey={`inline-cell-${row.id}-${column}`}
                        allowEmpty
                        onPending={onPending}
                        onFocus={() =>
                          onSelect({ kind: "cell", rowId: row.id, column })
                        }
                        onCommit={(value) =>
                          onOperations([
                            {
                              op: "set_cell",
                              rowId: row.id,
                              column: column as 0 | 1 | 2,
                              cell: value
                                ? { kind: "number", value }
                                : {
                                    kind:
                                      cell.kind === "answer-line"
                                        ? "answer-line"
                                        : "empty",
                                  },
                            },
                          ])
                        }
                      />
                    </div>
                  ))
                )}
              </div>
            ))}
            {document.mode === "annotated" &&
              (document.showArrows || document.showOperations) &&
              document.transitions.flatMap((step) => {
                const row = document.rows.findIndex(
                  (row) => row.id === step.from,
                );
                const lanes =
                  document.headings.length === 2
                    ? [0, m.tableLeft + m.tableWidth]
                    : document.headings.map(
                        (_, column) =>
                          m.tableLeft + column * m.columnWidth + 150,
                      );
                return lanes.map((x, index) => (
                  <button
                    key={`${step.from}-${index}`}
                    type="button"
                    className={`ratio-arrow-target${selection?.kind === "step" && selection.from === step.from ? " is-selected" : ""}`}
                    style={position(
                      x,
                      m.tableTop + 150 + row * 100 + 5,
                      m.gutter,
                      90,
                    )}
                    aria-label={`Edit scaling arrow ${row + 1} to ${row + 2}, ${index === 0 && document.headings.length === 2 ? "left" : `column ${index + 1}`}, ${step.operation === "multiply" ? "multiply" : "divide"} by ${step.factor}`}
                    disabled={structureDisabled}
                    onClick={() => {
                      onSelect({ kind: "step", from: step.from });
                      requestAnimationFrame(() =>
                        globalThis.document
                          .querySelector<HTMLInputElement>(
                            `[aria-label="Row ${row + 1} scaling factor"]`,
                          )
                          ?.focus(),
                      );
                    }}
                  />
                ));
              })}
          </fieldset>
        </div>
        <button
          className="tool-button ratio-add-column"
          disabled={structureDisabled || document.headings.length >= 3}
          onClick={onAddColumn}
          title={
            document.headings.length >= 3
              ? "Maximum of three columns"
              : "Add a third column"
          }
        >
          <Plus size={16} />
          <span>Add column</span>
        </button>
        <button
          className="tool-button ratio-add-row"
          disabled={structureDisabled || document.rows.length >= 6}
          onClick={onAddRow}
          title={
            document.rows.length >= 6
              ? "Maximum of six rows"
              : "Extend the table downwards"
          }
        >
          <Plus size={16} />
          <span>Add row</span>
        </button>
      </div>
    </div>
  );
}
