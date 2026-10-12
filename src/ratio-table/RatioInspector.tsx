import { ArrowDown, Grid3X3, Table2, Trash2 } from "lucide-react";
import type {
  RatioDocument,
  RatioOperation,
} from "../../packages/ratio-table-core/src/interchange";
import type { RatioSelection } from "./RatioCanvas";
import { NumberInput } from "./NumberInput";
import { HeadingInput } from "./HeadingInput";
import { headingText, headingFromText } from "./headingText";

export function RatioInspector({
  document,
  selection,
  inputVersion,
  pendingInputs,
  onSelect,
  onPending,
  onOperations,
  onAction,
  onRemoveRow,
  onRemoveColumn,
  onFill,
}: {
  document: RatioDocument;
  selection: RatioSelection;
  inputVersion: number;
  pendingInputs: boolean;
  onSelect: (selection: RatioSelection) => void;
  onPending: (key: string, pending: boolean) => void;
  onOperations: (operations: RatioOperation[]) => void;
  onAction: (operations: RatioOperation[]) => void;
  onRemoveRow: (rowId: string) => void;
  onRemoveColumn: (column: number) => void;
  onFill: (from: string) => void;
}) {
  function headingControls(column: number) {
    const heading = document.headings[column];
    if (!heading) return null;
    const change = (update: Partial<typeof heading>, safe = false) => {
      const headings = structuredClone(document.headings);
      headings[column] = { ...headings[column], ...update };
      (safe ? onAction : onOperations)([{ op: "set_headings", headings }]);
    };
    return (
      <div className="ratio-heading-controls" key={column}>
        <HeadingInput
          key={`heading-${column}-${inputVersion}`}
          label={`Column ${column + 1} heading`}
          inputKey={`heading-${column}`}
          value={headingText(heading)}
          onPending={onPending}
          onFocus={() => onSelect(selection)}
          onCommit={(text) => change(headingFromText(heading, text))}
        />
        <p className="panel-note">
          Delete → or ↑ to remove the heading arrow. Type either character at
          the end to add it.
        </p>
        <label className="check-row">
          <input
            type="checkbox"
            checked={heading.italic}
            disabled={pendingInputs}
            onChange={(event) => change({ italic: event.target.checked }, true)}
          />
          Italic maths heading
        </label>
        <button
          className="panel-button ratio-danger"
          disabled={pendingInputs || document.headings.length <= 1}
          onClick={() => onRemoveColumn(column)}
        >
          <Trash2 size={15} />
          Remove column {column + 1}
        </button>
      </div>
    );
  }
  const rowIndex =
    selection?.kind === "cell"
      ? document.rows.findIndex((row) => row.id === selection.rowId)
      : -1;
  const row = document.rows[rowIndex];
  const fromIndex =
    selection?.kind === "step"
      ? document.rows.findIndex((row) => row.id === selection.from)
      : -1;
  const step = document.transitions.find(
    (step) =>
      step.from === (selection?.kind === "step" ? selection.from : null),
  );
  const transition =
    fromIndex >= 0 && fromIndex < document.rows.length - 1
      ? {
          from: document.rows[fromIndex].id,
          to: document.rows[fromIndex + 1].id,
          operation: step?.operation ?? ("multiply" as const),
          factor: step?.factor ?? "2",
        }
      : null;
  function setStep(
    update: Partial<NonNullable<typeof transition>>,
    safe = false,
  ) {
    if (transition)
      (safe ? onAction : onOperations)([
        { op: "set_transition", transition: { ...transition, ...update } },
        ...(!step
          ? [
              {
                op: "set_annotation_visibility" as const,
                mode: "annotated" as const,
                showArrows: true,
                showOperations: true,
              },
            ]
          : []),
      ]);
  }
  return (
    <>
      <section
        className="panel-card ratio-selection-panel"
        aria-label="Selected table item"
      >
        <div className="panel-heading">
          <Table2 size={17} />
          <h2>
            {selection?.kind === "cell" && row
              ? `Row ${rowIndex + 1} · ${document.headings[selection.column]?.text}`
              : selection?.kind === "heading"
                ? `Column ${selection.column + 1}`
                : selection?.kind === "headings"
                  ? "Edit headings"
                  : selection?.kind === "step"
                    ? "Scaling arrow"
                    : "Edit table"}
          </h2>
        </div>
        {!selection && (
          <p className="panel-note">
            Click a heading or cell and type. Select an arrow to change its
            operation or factor.
          </p>
        )}
        {selection?.kind === "cell" && row && (
          <>
            <p className="panel-note">
              Type directly in the selected cell. Numbers, decimals and
              fractions are supported.
            </p>
            <label className="ratio-label">
              Cell type
              <select
                aria-label={`Row ${rowIndex + 1} ${document.headings[selection.column].text} cell type`}
                value={row.cells[selection.column].kind}
                disabled={pendingInputs}
                onChange={(event) =>
                  onAction([
                    {
                      op: "set_cell",
                      rowId: row.id,
                      column: selection.column as 0 | 1 | 2,
                      cell:
                        event.target.value === "number"
                          ? { kind: "number", value: "0" }
                          : {
                              kind: event.target.value as
                                | "empty"
                                | "answer-line",
                            },
                    },
                  ])
                }
              >
                <option value="number">Value</option>
                <option value="empty">Empty</option>
                <option value="answer-line">Answer line</option>
              </select>
            </label>
            <button
              className="panel-button ratio-danger"
              disabled={pendingInputs || document.rows.length <= 1}
              onClick={() => onRemoveRow(row.id)}
            >
              <Trash2 size={15} />
              Remove row {rowIndex + 1}
            </button>
          </>
        )}
        {selection?.kind === "heading" && headingControls(selection.column)}
        {selection?.kind === "headings" &&
          document.headings.map((_, column) => headingControls(column))}
        {selection?.kind === "step" && transition && (
          <>
            <p className="panel-note">
              The same operation applies to all {document.headings.length}{" "}
              columns. Values stay unchanged until you choose Fill next row.
            </p>
            <div className="ratio-step-fields">
              <label className="ratio-label">
                From row
                <select
                  aria-label="Arrow from row"
                  disabled={pendingInputs}
                  value={transition.from}
                  onChange={(event) =>
                    onSelect({ kind: "step", from: event.target.value })
                  }
                >
                  {document.rows.slice(0, -1).map((row, index) => (
                    <option key={row.id} value={row.id}>
                      Row {index + 1}
                    </option>
                  ))}
                </select>
              </label>
              <label className="ratio-label">
                To row
                <select
                  aria-label="Arrow to row"
                  value={transition.to}
                  disabled
                >
                  <option value={transition.to}>Row {fromIndex + 2}</option>
                </select>
              </label>
            </div>
            <div className="ratio-step-fields">
              <label className="ratio-label">
                Operation
                <select
                  aria-label={`Row ${fromIndex + 1} scaling operation`}
                  disabled={pendingInputs}
                  value={transition.operation}
                  onChange={(event) =>
                    setStep(
                      {
                        operation: event.target.value as "multiply" | "divide",
                      },
                      true,
                    )
                  }
                >
                  <option value="multiply">Multiply ×</option>
                  <option value="divide">Divide ÷</option>
                </select>
              </label>
              <div className="ratio-label">
                Factor
                <NumberInput
                  key={`${transition.from}-factor-${inputVersion}`}
                  label={`Row ${fromIndex + 1} scaling factor`}
                  inputKey={`${transition.from}-factor`}
                  onFocus={() =>
                    onSelect({ kind: "step", from: transition.from })
                  }
                  value={transition.factor}
                  onPending={onPending}
                  onCommit={(factor) => setStep({ factor })}
                />
              </div>
            </div>
            {!step && (
              <button
                className="panel-button"
                disabled={pendingInputs}
                onClick={() => setStep({}, true)}
              >
                <ArrowDown size={16} />
                Add arrow
              </button>
            )}
            {step && (
              <>
                <button
                  className="panel-button"
                  disabled={pendingInputs}
                  onClick={() => onFill(step.from)}
                >
                  Fill next row
                </button>
                <button
                  className="panel-button ratio-danger"
                  disabled={pendingInputs}
                  onClick={() =>
                    onAction([{ op: "remove_transition", from: step.from }])
                  }
                >
                  <Trash2 size={15} />
                  Remove arrow
                </button>
              </>
            )}
            <p className="panel-note">Scaling arrows connect adjacent rows.</p>
          </>
        )}
      </section>
      <section className="panel-card">
        <div className="panel-heading">
          <Grid3X3 size={17} />
          <h2>Table settings</h2>
        </div>
        <label className="ratio-label">
          Print size
          <select
            aria-label="Print size"
            disabled={pendingInputs}
            value={document.size}
            onChange={(event) =>
              onAction([
                {
                  op: "set_size",
                  size: event.target.value as RatioDocument["size"],
                },
              ])
            }
          >
            <option value="compact">Compact · 80%</option>
            <option value="standard">Standard · lesson size</option>
            <option value="large">Large · 120%</option>
          </select>
        </label>
        <label className="ratio-label">
          Annotations
          <select
            aria-label="Annotation display"
            disabled={pendingInputs}
            value={document.mode}
            onChange={(event) =>
              onAction([
                {
                  op: "set_annotation_visibility",
                  mode: event.target.value as RatioDocument["mode"],
                },
              ])
            }
          >
            <option value="simple">Simple</option>
            <option value="annotated">With scaling arrows</option>
          </select>
        </label>
        <label className="check-row">
          <input
            type="checkbox"
            checked={document.showArrows}
            disabled={pendingInputs}
            onChange={(event) =>
              onAction([
                {
                  op: "set_annotation_visibility",
                  showArrows: event.target.checked,
                },
              ])
            }
          />
          Show arrows
        </label>
        <label className="check-row">
          <input
            type="checkbox"
            checked={document.showOperations}
            disabled={pendingInputs}
            onChange={(event) =>
              onAction([
                {
                  op: "set_annotation_visibility",
                  showOperations: event.target.checked,
                },
              ])
            }
          />
          Show operation labels
        </label>
        {document.mode === "simple" && (
          <p className="panel-note">
            Simple mode hides annotations and keeps your scaling steps for
            later.
          </p>
        )}
        <p className="panel-note">
          {document.rows.length} of 6 rows · {document.headings.length} of 3
          columns
        </p>
        <details>
          <summary>Scaling steps</summary>
          {document.rows.slice(0, -1).map((row, index) => (
            <button
              className="panel-button"
              disabled={pendingInputs}
              key={row.id}
              onClick={() => onSelect({ kind: "step", from: row.id })}
            >
              Row {index + 1} → Row {index + 2}
              {document.transitions.some((step) => step.from === row.id)
                ? " · Edit arrow"
                : " · Add arrow"}
            </button>
          ))}
        </details>
      </section>
    </>
  );
}
