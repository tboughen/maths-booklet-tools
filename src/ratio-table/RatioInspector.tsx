import type { ReactNode } from "react";
import { ArrowDown, Eye, Grid3X3, Trash2 } from "lucide-react";
import { FoldCard } from "../site/CardHelp";
import { VisibilitySwitch } from "../site/VisibilitySwitch";
import { PupilSpaceHint } from "../site/LabelTargets";
import { commonVisibility, type Visibility } from "../editor-kit/visibility";
import { cellVisibility, withCellVisibility } from "./cellVisibility";
import type {
  RatioDocument,
  RatioOperation,
} from "../../packages/ratio-table-core/src/interchange";
import type { RatioSelection } from "./RatioCanvas";
import { NumberInput } from "./NumberInput";
import { HeadingInput } from "./HeadingInput";
import { LINE_WEIGHTS, LINE_WEIGHT_NAMES, type LineWeight } from "../../packages/envelope-core/src/house-style";
import { headingText, headingFromText } from "./headingText";

export function RatioInspector({
  document,
  selection,
  inputVersion,
  pendingInputs,
  factorDisabled,
  onSelect,
  onPending,
  onOperations,
  onAction,
  onFill,
  onMessage,
  onOpen,
  part,
  tools,
  after,
}: {
  /** "box": the selected item's options, for the box beside it. "cards": the settings column. */
  part: "box" | "cards";
  onMessage: (message: string) => void;
  /** A Scaling steps button opens that step's box beside it. */
  onOpen: (anchor: HTMLElement) => void;
  document: RatioDocument;
  selection: RatioSelection;
  inputVersion: number;
  pendingInputs: boolean;
  factorDisabled: boolean;
  onSelect: (selection: RatioSelection) => void;
  onPending: (key: string, pending: boolean) => void;
  onOperations: (operations: RatioOperation[]) => void;
  onAction: (operations: RatioOperation[]) => void;
  onFill: (from: string) => void;
  /** The table tools card, shown after the selected item and before the table settings (U21). */
  tools?: ReactNode;
  /** Cards that come last, under the table's settings (the warnings). */
  after?: ReactNode;
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
        <label className="ratio-label">
          Heading arrow
          <select
            aria-label={`Column ${column + 1} heading arrow`}
            disabled={pendingInputs}
            value={heading.direction}
            onChange={(event) =>
              change(
                {
                  direction: event.target
                    .value as RatioDocument["headings"][number]["direction"],
                },
                true,
              )
            }
          >
            <option value="none">None</option>
            <option value="right">Right →</option>
            <option value="up">Up ↑</option>
            <option value="down">Down ↓</option>
          </select>
        </label>
        <p className="panel-note">
          You can also type →, ↑ or ↓ at the end of the heading.
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
        <label className="check-row">
          <input
            type="checkbox"
            checked={heading.hidden === true}
            disabled={pendingInputs}
            onChange={(event) => change({ hidden: event.target.checked || undefined }, true)}
          />
          Hidden heading (answers copy only)
        </label>
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
          hidden: step?.hidden ?? false,
          ...(step?.side ? { side: step.side } : {}),
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
  function setCellVisibility(rowId: string, column: number, v: Visibility) {
    const cell = document.rows.find((r) => r.id === rowId)?.cells[column];
    if (!cell) return;
    const next = withCellVisibility(cell, v);
    if (typeof next === "string") return onMessage(next);
    onAction([{ op: "set_cell", rowId, column: column as 0 | 1 | 2, cell: next }]);
  }
  // Every cell that has something to show or a space: a plain empty cell has neither.
  const cells = document.rows.flatMap((r) => r.cells.map((c, column) => ({ row: r, column, c }))).filter(({ c }) => c.kind !== "empty" || !!c.value);
  const spaceCount =
    cells.filter(({ c }) => c.kind === "hidden").length + document.headings.filter((h) => h.hidden).length + document.transitions.filter((t) => t.hidden).length;
  const settingsCard = (
    <FoldCard
      tool="ratio-table"
      title="Table settings"
      icon={Grid3X3}
      defaultOpen
      summary={`${document.rows.length} rows · ${document.headings.length} column${document.headings.length === 1 ? "" : "s"}`}
    >

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
            <option value="standard">Standard · lesson size</option>
            <option value="large">Large · 120%</option>
          </select>
        </label>
        <label className="ratio-label">
          Lines
          <select
            aria-label="Lines"
            disabled={pendingInputs}
            value={document.lines ?? "normal"}
            onChange={(event) =>
              onAction([{ op: "set_lines", lines: event.target.value as LineWeight }])
            }
          >
            {LINE_WEIGHTS.map((v) => (
              <option key={v} value={v}>
                {LINE_WEIGHT_NAMES[v]}
              </option>
            ))}
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
        <label className="check-row">
          <input
            type="checkbox"
            checked={document.answerOnly === true}
            disabled={pendingInputs}
            onChange={(event) =>
              onAction([{ op: "set_answer_only", answerOnly: event.target.checked }])
            }
          />
          Answers copy only
        </label>
        {document.answerOnly && (
          <p className="panel-note">
            The pupil copy keeps this table&apos;s space as blank paper. The
            answers copy prints the whole table in the answer colour.
          </p>
        )}
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
              aria-haspopup="dialog"
              data-options-anchor=""
              onClick={(ev) => {
                onSelect({ kind: "step", from: row.id });
                onOpen(ev.currentTarget);
              }}
            >
              Row {index + 1} → Row {index + 2}
              {document.transitions.some((step) => step.from === row.id)
                ? " · Edit arrow"
                : " · Add arrow"}
            </button>
          ))}
        </details>
    </FoldCard>
  );
  if (part === "cards") {
    const all = commonVisibility(cells.map(({ c }) => cellVisibility(c)));
    return (
      <>
        {/* One column (the usability rollout, 22 Nov 2026): what pupils see first, the tools open, the settings folded. */}
        <FoldCard
          tool="ratio-table"
          title="What pupils see"
          icon={Eye}
          defaultOpen
          summary={spaceCount === 0 ? "No pupil spaces" : `${spaceCount} pupil space${spaceCount === 1 ? "" : "s"}`}
          help={
            <p className="panel-note">
              Show: the value prints on both copies. Pupil space: a blank or a dotted answer line for pupils, with the value in the answers copy. Leave out:
              printed in neither copy, but kept. Headings and scaling operations can be hidden in their own boxes.
            </p>
          }
        >
          {all && (
            <VisibilitySwitch
              name="Values"
              caption="Values"
              value={all}
              disabled={pendingInputs}
              onChange={(v) => {
                let skipped = "";
                const ops: RatioOperation[] = [];
                for (const { row: r, column, c } of cells) {
                  const next = withCellVisibility(c, v);
                  if (typeof next === "string") skipped ||= next;
                  else if (JSON.stringify(next) !== JSON.stringify(c)) ops.push({ op: "set_cell", rowId: r.id, column: column as 0 | 1 | 2, cell: next });
                }
                if (ops.length) onAction(ops);
                if (skipped) onMessage(`Some values were left as they were. ${skipped}`);
              }}
            />
          )}
          <PupilSpaceHint
            count={spaceCount}
            disabled={pendingInputs}
            onClear={() => {
              const ops: RatioOperation[] = cells.flatMap(({ row: r, column, c }) =>
                c.kind === "hidden" ? [{ op: "set_cell" as const, rowId: r.id, column: column as 0 | 1 | 2, cell: { kind: "number" as const, value: c.value } }] : [],
              );
              if (document.headings.some((h) => h.hidden))
                ops.push({ op: "set_headings", headings: document.headings.map((h) => {
                  const { hidden: _hidden, ...rest } = h;
                  void _hidden;
                  return rest;
                }) });
              for (const t of document.transitions) if (t.hidden) ops.push({ op: "set_transition", transition: { ...t, hidden: false } });
              if (ops.length) onAction(ops);
            }}
          >
            Double-click a cell for a pupil space.
          </PupilSpaceHint>
        </FoldCard>
        {tools}
        {settingsCard}
        {after}
      </>
    );
  }
  return (
    <>
        {selection?.kind === "cell" && row && (
          <>
            <VisibilitySwitch
              name="What pupils see"
              caption="What pupils see"
              value={cellVisibility(row.cells[selection.column])}
              disabled={pendingInputs}
              onChange={(v) => setCellVisibility(row.id, selection.column, v)}
            />
            {(row.cells[selection.column].kind === "hidden" || row.cells[selection.column].kind === "answer-line") && (
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={(() => {
                    const c = row.cells[selection.column];
                    return c.kind === "answer-line" || (c.kind === "hidden" && c.line === true);
                  })()}
                  disabled={pendingInputs || row.cells[selection.column].kind === "answer-line"}
                  onChange={(event) => {
                    const c = row.cells[selection.column];
                    if (c.kind !== "hidden") return;
                    onAction([
                      {
                        op: "set_cell",
                        rowId: row.id,
                        column: selection.column as 0 | 1 | 2,
                        cell: event.target.checked ? { kind: "hidden", value: c.value, line: true } : { kind: "hidden", value: c.value },
                      },
                    ]);
                  }}
                />
                On a dotted answer line
              </label>
            )}
            <p className="panel-note">
              {(() => {
                const c = row.cells[selection.column];
                if (c.kind === "hidden") return "Pupils see a space. The value prints in the answers copy only, in the answer colour.";
                if (c.kind === "answer-line") return "An answer line with no saved answer. Type the answer in the cell to save it for the answers copy.";
                if (c.kind === "empty") return c.value ? "Left out: kept here, but printed in neither copy." : "Nothing prints here. Type a value in the cell.";
                return "Type in the cell. Numbers, decimals and fractions are supported.";
              })()}
            </p>
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
                  disabled={factorDisabled}
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
            <label className="check-row">
              <input
                type="checkbox"
                checked={transition.hidden}
                disabled={pendingInputs || !step}
                onChange={(event) =>
                  setStep({ hidden: event.target.checked }, true)
                }
              />
              Hide the operation in the pupil copy
            </label>
            {document.headings.length === 2 && (
              <label className="ratio-label">
                Show on
                <select
                  aria-label={`Row ${fromIndex + 1} scaling sides`}
                  disabled={pendingInputs || !step}
                  value={transition.side ?? "both"}
                  onChange={(event) => {
                    const side = event.target.value;
                    const { from, to, operation, factor, hidden } = transition;
                    onAction([
                      {
                        op: "set_transition",
                        transition: {
                          from,
                          to,
                          operation,
                          factor,
                          hidden,
                          ...(side === "left" || side === "right" ? { side } : {}),
                        },
                      },
                    ]);
                  }}
                >
                  <option value="both">Both sides</option>
                  <option value="left">Left side only</option>
                  <option value="right">Right side only</option>
                </select>
              </label>
            )}
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
    </>
  );
}
