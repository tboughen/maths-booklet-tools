import { speakRatio } from "./speakRatio";
import { useRef } from "react";
import { useResourceViewport, fitResource } from "../site/useResourceFit";
import type { CSSProperties } from "react";
import { Plus, Trash2 } from "lucide-react";
import {
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
import {
  numberWidth,
  textWidth,
} from "../../packages/ratio-table-core/src/svg";

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
  pendingInputs,
  selection,
  tool,
  arrowFrom,
  onSelect,
  onArrowRow,
  onPending,
  onOperations,
  onAddRow,
  onAddColumn,
  onRemoveRow,
  onRemoveColumn,
  removalRowIndex,
  removalColumnIndex,
}: {
  envelope: RatioEnvelope;
  zoom: number;
  guides: boolean;
  inputVersion: number;
  disabled: boolean;
  structureDisabled: boolean;
  pendingInputs: ReadonlySet<string>;
  selection: RatioSelection;
  tool: "edit" | "arrow";
  arrowFrom: string | null;
  onSelect: (selection: RatioSelection) => void;
  onArrowRow: (rowId: string) => void;
  onPending: (key: string, pending: boolean) => void;
  onOperations: (operations: RatioOperation[]) => void;
  onAddRow: () => void;
  onAddColumn: () => void;
  onRemoveRow: () => void;
  onRemoveColumn: () => void;
  removalRowIndex: number;
  removalColumnIndex: number;
}) {
  const document = envelope.document,
    m = ratioMetrics(document);
  const stage = useRef<HTMLDivElement>(null);
  const available = useResourceViewport(stage);
  const availableWidth = available.width;
  const edgeControlsWidth = availableWidth < 560 ? 0 : 170;
  const physicalWidth = (m.widthCm * 96) / 2.54;
  const displayZoom =
    zoom ||
    fitResource(
      physicalWidth,
      (m.heightCm * 96) / 2.54,
      available.width,
      available.height,
      edgeControlsWidth + 16,
      availableWidth < 560 ? 150 : 80,
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
      <div
        className="ratio-canvas-layout"
        role="group"
        aria-label="Table structure"
      >
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
            aria-label={speakRatio(envelope)}
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
                    ? [
                        { edge: m.tableLeft, side: -1 },
                        {
                          edge: m.tableLeft + m.tableWidth,
                          side: 1,
                        },
                      ]
                    : document.headings.map((_, column) => ({
                        edge: m.tableLeft + column * m.columnWidth + 150,
                        side: 1,
                      }));
                return lanes.flatMap(({ edge, side }, index) => {
                  // Match the printed label's geometry without changing the SVG or saved format.
                  const font = (12 / 72) * 2.54 * 100 * 0.8,
                    factorWidth = numberWidth(step.factor, font),
                    total =
                      textWidth(
                        step.operation === "multiply" ? "×" : "÷",
                        font,
                      ) +
                      6 +
                      factorWidth,
                    centre =
                      edge +
                      side * ((document.showArrows ? 52 : 10) + total / 2),
                    factorCentre = centre + total / 2 - factorWidth / 2,
                    inputKey = `inline-factor-${step.from}-${index}`,
                    laneName =
                      index === 0 && document.headings.length === 2
                        ? "left"
                        : `column ${index + 1}`;
                  return [
                    <button
                      key={`${step.from}-${index}`}
                      type="button"
                      className={`ratio-arrow-target${selection?.kind === "step" && selection.from === step.from ? " is-selected" : ""}`}
                      style={position(
                        document.showArrows
                          ? edge + (side < 0 ? -48 : 4)
                          : centre - total / 2 - 3,
                        m.tableTop +
                          150 +
                          row * 100 +
                          (document.showArrows ? 5 : 24),
                        document.showArrows
                          ? 44
                          : textWidth(
                              step.operation === "multiply" ? "×" : "÷",
                              font,
                            ) + 6,
                        document.showArrows ? 90 : 52,
                      )}
                      aria-label={`Edit scaling arrow ${row + 1} to ${row + 2}, ${laneName}, ${step.operation === "multiply" ? "multiply" : "divide"} by ${step.factor}`}
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
                    />,
                    ...(document.showOperations && tool === "edit"
                      ? [
                          <div
                            key={`${inputKey}-${inputVersion}`}
                            className={`ratio-inline-factor${side < 0 ? " is-left" : ""}`}
                            style={position(
                              factorCentre - factorWidth / 2 - 3,
                              m.tableTop + 150 + row * 100 + 24,
                              Math.max(factorWidth + 6, 28),
                              52,
                            )}
                          >
                            {side < 0 && (
                              <span
                                className="ratio-factor-operation"
                                aria-hidden="true"
                              >
                                {step.operation === "multiply" ? "×" : "÷"}
                              </span>
                            )}
                            <NumberInput
                              value={step.factor}
                              label={`Row ${row + 1} ${laneName} arrow factor`}
                              inputKey={inputKey}
                              disabled={
                                structureDisabled &&
                                !pendingInputs.has(inputKey)
                              }
                              onPending={onPending}
                              onFocus={() =>
                                onSelect({ kind: "step", from: step.from })
                              }
                              onCommit={(factor) =>
                                onOperations([
                                  {
                                    op: "set_transition",
                                    transition: { ...step, factor },
                                  },
                                ])
                              }
                            />
                          </div>,
                        ]
                      : []),
                  ];
                });
              })}
          </fieldset>
        </div>
        <div
          className="ratio-action-pair ratio-column-actions"
          role="group"
          aria-label="Columns"
        >
          <button
            className="tool-button ratio-add-column"
            disabled={structureDisabled || document.headings.length >= 3}
            onClick={onAddColumn}
            title={
              document.headings.length >= 3
                ? "Maximum of three columns"
                : "Extend the table to the right"
            }
          >
            <Plus size={16} />
            <span>Add column</span>
          </button>
          <button
            className="tool-button ratio-danger"
            disabled={structureDisabled || document.headings.length <= 1}
            onClick={onRemoveColumn}
            title={`Remove column ${removalColumnIndex + 1}`}
          >
            <Trash2 size={16} />
            <span>Remove column</span>
          </button>
        </div>
        <div
          className="ratio-action-pair ratio-row-actions"
          role="group"
          aria-label="Rows"
        >
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
          <button
            className="tool-button ratio-danger"
            disabled={structureDisabled || document.rows.length <= 1}
            onClick={onRemoveRow}
            title={`Remove row ${removalRowIndex + 1}`}
          >
            <Trash2 size={16} />
            <span>Remove row</span>
          </button>
        </div>
      </div>
    </div>
  );
}
