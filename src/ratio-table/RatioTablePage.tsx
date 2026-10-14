import { copyPngToClipboard } from "../export/clipboard";
import { ratioPrintPng } from "./export";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Copy,
  Download,
  ArrowDown,
  MousePointer2,
  Type,
  Table2,
} from "lucide-react";
import {
  applyRatioOperations,
  createRatioTable,
  decodeRatio,
  describeRatio,
  emptyRatioTable,
  parseRatioFile,
  ratioEditorLink,
  ratioMetrics,
  ratioWarnings,
  renderRatioSvg,
  RATIO_MAX_FILE_BYTES,
  RATIO_MAX_LINK_LENGTH,
} from "../../packages/ratio-table-core/src/interchange";
import type {
  RatioOperation,
  RatioEnvelope,
} from "../../packages/ratio-table-core/src/interchange";
import { downloadBlob } from "../export/clipboard";
import { copyRatioForWord, downloadRatioImage } from "./export";
import {
  loadRatioRecovery,
  saveRatio,
  startRatioAfterRecovery,
} from "./persistence";
import { RatioCanvas } from "./RatioCanvas";
import type { RatioSelection } from "./RatioCanvas";
import { RatioInspector } from "./RatioInspector";
import { RatioDialog } from "./RatioDialog";
import { EditorToolbar } from "../site/EditorToolbar";
import { PageHeading, Panel } from "../site/PageHeading";
import "./ratio-table.css";

type History = {
  past: RatioEnvelope[];
  present: RatioEnvelope;
  future: RatioEnvelope[];
};
type Pending = {
  title: string;
  envelope?: RatioEnvelope;
  action?: () => void;
  confirmLabel?: string;
  fromLink?: boolean;
  description?: string;
};
function example(kind: "simple" | "worked" | "fraction") {
  const values =
    kind === "simple"
      ? [
          ["4", "8"],
          ["1", null],
        ]
      : kind === "worked"
        ? [
            ["2", "4"],
            ["1", "2"],
          ]
        : [
            ["3", "2"],
            ["1", null],
          ];
  return createRatioTable({
    schemaVersion: 1,
    rows: values.map((pair, i) => ({
      id: `row-${i + 1}`,
      cells: pair.map((value) =>
        value === null ? { kind: "answer-line" } : { kind: "number", value },
      ),
    })),
    mode: kind === "simple" ? "simple" : "annotated",
    transitions:
      kind === "simple"
        ? []
        : [
            {
              from: "row-1",
              to: "row-2",
              operation: "divide",
              factor: kind === "worked" ? "2" : "3",
            },
          ],
  });
}
export default function RatioTablePage({
  active = true,
}: {
  active?: boolean;
}) {
  const [startup] = useState(loadRatioRecovery);
  const [recovery, setRecovery] = useState(startup.recovery),
    [recoveryDownloaded, setRecoveryDownloaded] = useState(false);
  const [history, setHistory] = useState<History>(() => ({
    past: [],
    present: startup.envelope,
    future: [],
  }));
  const [saveState, setSaveState] = useState(startup.error ? "error" : "saved");
  const [message, setMessage] = useState(startup.error ?? "");
  const [exportsOpen, setExportsOpen] = useState(false);
  const [busy, setBusy] = useState(false),
    [zoom, setZoom] = useState(0),
    [guides, setGuides] = useState(false);
  const [pending, setPending] = useState<Pending | null>(null),
    [inputVersion, setInputVersion] = useState(0);
  const [selection, setSelection] = useState<RatioSelection>(null);
  const [selectionActive, setSelectionActive] = useState(false);
  const editor = useRef<HTMLDivElement>(null);
  const [tool, setTool] = useState<"edit" | "arrow">("edit");
  const [arrowFrom, setArrowFrom] = useState<string | null>(null);
  const [pendingInputs, setPendingInputs] = useState<Set<string>>(
    () => new Set(),
  );
  const file = useRef<HTMLInputElement>(null),
    current = useRef(history.present),
    blocked = useRef(recovery);
  current.current = history.present;
  blocked.current = recovery;
  const envelope = history.present,
    document = envelope.document,
    metrics = ratioMetrics(document),
    warnings = ratioWarnings(envelope);
  const exportDisabled = !!recovery || busy || pendingInputs.size > 0;
  const onInputPending = useCallback(
    (key: string, value: boolean) =>
      setPendingInputs((previous) => {
        if (previous.has(key) === value) return previous;
        const next = new Set(previous);
        if (value) next.add(key);
        else next.delete(key);
        return next;
      }),
    [],
  );
  const commit = useCallback((next: RatioEnvelope) => {
    if (blocked.current)
      throw Error("Save the recovery copy before replacing the saved table.");
    setHistory((previous) =>
      JSON.stringify(previous.present) === JSON.stringify(next)
        ? previous
        : {
            past: [...previous.past, previous.present].slice(-50),
            present: next,
            future: [],
          },
    );
  }, []);
  function operations(ops: RatioOperation[]) {
    commit(applyRatioOperations(current.current, ops));
  }
  function attempt(action: () => void) {
    try {
      action();
      setMessage("");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "The table could not be changed.",
      );
    }
  }
  const undo = useCallback(() => {
    setHistory((previous) => {
      const next = previous.past.at(-1);
      return !next
        ? previous
        : {
            past: previous.past.slice(0, -1),
            present: next,
            future: [previous.present, ...previous.future].slice(0, 50),
          };
    });
    setInputVersion((v) => v + 1);
    setPendingInputs(new Set());
    setSelection(null);
    setArrowFrom(null);
    setTool("edit");
  }, []);
  const redo = useCallback(() => {
    setHistory((previous) => {
      const next = previous.future[0];
      return !next
        ? previous
        : {
            past: [...previous.past, previous.present].slice(-50),
            present: next,
            future: previous.future.slice(1),
          };
    });
    setInputVersion((v) => v + 1);
    setPendingInputs(new Set());
    setSelection(null);
    setArrowFrom(null);
    setTool("edit");
  }, []);
  useEffect(() => {
    if (recovery) return;
    setSaveState("saving");
    const timeout = window.setTimeout(() => {
      try {
        saveRatio(envelope);
        setSaveState("saved");
      } catch {
        setSaveState("error");
        setMessage(
          "Device storage is unavailable. Save an editable file to keep your work.",
        );
      }
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [envelope, recovery]);
  useEffect(() => {
    const flush = () => {
      if (!blocked.current) {
        try {
          saveRatio(current.current);
        } catch {
          /* The visible save state already handles storage failure. */
        }
      }
    };
    window.addEventListener("pagehide", flush);
    return () => {
      flush();
      window.removeEventListener("pagehide", flush);
    };
  }, []);
  useEffect(() => {
    function link() {
      if (
        !active ||
        !location.hash.startsWith("#ratio-table=") ||
        blocked.current
      )
        return;
      try {
        if (location.href.length > RATIO_MAX_LINK_LENGTH)
          throw Error(
            "This link is too large. Open the editable JSON instead.",
          );
        setPending({
          title: "Open this ratio table?",
          envelope: decodeRatio(location.hash.slice(13)),
          fromLink: true,
        });
      } catch (error) {
        setMessage(
          error instanceof Error ? error.message : "The link cannot be read.",
        );
      }
    }
    link();
    window.addEventListener("hashchange", link);
    return () => window.removeEventListener("hashchange", link);
  }, [active, recovery]);
  useEffect(() => {
    if (!active) return;
    function keyboard(e: KeyboardEvent) {
      if (globalThis.document.querySelector('[aria-modal="true"]')) return;
      const target = e.target as HTMLElement | null;
      if (target?.matches("input, select, textarea, [contenteditable='true']"))
        return;
      if (
        (e.ctrlKey || e.metaKey) &&
        ["z", "y"].includes(e.key.toLowerCase())
      ) {
        e.preventDefault();
        if (e.key.toLowerCase() === "y" || e.shiftKey) redo();
        else undo();
      }
      if (e.key === "Escape") {
        setExportsOpen(false);
        setTool("edit");
        setArrowFrom(null);
      }
    }
    window.addEventListener("keydown", keyboard);
    return () => window.removeEventListener("keydown", keyboard);
  }, [active, undo, redo]);
  async function runExport(action: () => Promise<void>, success = "") {
    setBusy(true);
    setExportsOpen(false);
    try {
      await action();
      setMessage(success);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "The export could not be prepared.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function openFile(selected: File | undefined) {
    if (!selected) return;
    try {
      if (selected.size > RATIO_MAX_FILE_BYTES)
        throw Error("Choose a ratio-table JSON smaller than 64 KiB.");
      setPending({
        title: "Open this ratio table?",
        envelope: parseRatioFile(await selected.text()),
      });
      setExportsOpen(false);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "The file cannot be read.",
      );
    }
    if (file.current) file.current.value = "";
  }
  const cancelPending = useCallback(() => {
    setPending((previous) => {
      if (previous?.fromLink)
        window.history.replaceState(
          null,
          "",
          location.pathname + location.search,
        );
      return null;
    });
  }, []);
  function replace(next: RatioEnvelope, title: string) {
    setPending({ envelope: next, title, confirmLabel: "Replace table" });
  }
  const structureDisabled = !!recovery || pendingInputs.size > 0;
  useEffect(() => {
    if (!active) return;
    function clickAway(event: MouseEvent) {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (
        event.composedPath().includes(editor.current as EventTarget) &&
        target.closest(
          ".ratio-inline-cell, .ratio-inline-heading, .ratio-inline-factor, .ratio-arrow-target, .ratio-row-target, .ratio-selection-panel input, .ratio-selection-panel select, .ratio-selection-panel button, .ratio-selection-panel label, [data-ratio-select], .ratio-action-pair button, .ratio-settings details button",
        )
      )
        return;
      setSelectionActive(false);
      setTool("edit");
      setArrowFrom(null);
      // Keep invalid panel drafts mounted, but clear all diagram selection.
      if (!Array.from(pendingInputs).some((key) => !key.startsWith("inline-")))
        setSelection(null);
    }
    globalThis.document.addEventListener("click", clickAway);
    return () => globalThis.document.removeEventListener("click", clickAway);
  }, [active, pendingInputs]);
  useEffect(() => {
    if (!selectionActive && !pendingInputs.size) setSelection(null);
  }, [selectionActive, pendingInputs]);
  function showSelection(next: RatioSelection) {
    setSelection(next);
    setSelectionActive(true);
  }
  function selectItem(next: RatioSelection) {
    if (
      Array.from(pendingInputs).some((key) => !key.startsWith("inline-")) &&
      JSON.stringify(selection) !== JSON.stringify(next)
    ) {
      setMessage(
        "Finish or cancel the panel input before selecting another item. Press Enter to apply it or Escape to cancel.",
      );
      setSelectionActive(false);
      return;
    }
    showSelection(next);
  }
  function addRow() {
    attempt(() => {
      let index = 1;
      while (document.rows.some((row) => row.id === `row-${index}`)) index++;
      operations([
        {
          op: "add_row",
          after: document.rows.at(-1)!.id,
          row: {
            id: `row-${index}`,
            cells: document.headings.map(() => ({ kind: "empty" })),
          },
        },
      ]);
      setTool("edit");
      setArrowFrom(null);
      showSelection({ kind: "cell", rowId: `row-${index}`, column: 0 });
      requestAnimationFrame(() =>
        globalThis.document
          .querySelector<HTMLInputElement>(
            `[aria-label="Row ${document.rows.length + 1} ${document.headings[0].text} value"]`,
          )
          ?.focus(),
      );
    });
  }
  function addColumn() {
    attempt(() => {
      const column = document.headings.length;
      const text =
        ["x", "y", "z"].find(
          (name) => !document.headings.some((heading) => heading.text === name),
        ) ?? "z";
      operations([
        {
          op: "add_column",
          heading: {
            text,
            italic: true,
            direction: text === "x" ? "right" : text === "y" ? "up" : "none",
          },
        },
      ]);
      setTool("edit");
      setArrowFrom(null);
      showSelection({ kind: "heading", column });
      requestAnimationFrame(() =>
        globalThis.document
          .querySelector<HTMLInputElement>(
            `[aria-label="Edit column ${column + 1} heading"]`,
          )
          ?.focus(),
      );
    });
  }
  function arrowRow(rowId: string) {
    if (!arrowFrom || arrowFrom === rowId) {
      setArrowFrom(rowId);
      setMessage("Choose the row immediately below to add the scaling arrow.");
      return;
    }
    const index = document.rows.findIndex((row) => row.id === arrowFrom);
    if (document.rows[index + 1]?.id !== rowId) {
      setMessage(
        "Choose the row immediately below the highlighted row. Scaling arrows connect adjacent rows.",
      );
      return;
    }
    attempt(() => {
      const existing = document.transitions.find(
        (step) => step.from === arrowFrom,
      );
      operations([
        {
          op: "set_transition",
          transition: existing ?? {
            from: arrowFrom,
            to: rowId,
            operation: "multiply",
            factor: "2",
          },
        },
        {
          op: "set_annotation_visibility",
          mode: "annotated",
          showArrows: true,
          showOperations: true,
        },
      ]);
      showSelection({ kind: "step", from: arrowFrom });
      setArrowFrom(null);
      setTool("edit");
    });
  }
  function fill(from: string) {
    const step = document.transitions.find((step) => step.from === from);
    const target = document.rows.find((row) => row.id === step?.to);
    const action = (overwrite = false) =>
      attempt(() => operations([{ op: "fill_next_row", from, overwrite }]));
    if (target?.cells.some((cell) => cell.kind === "number"))
      setPending({
        title: "Replace the next row's values?",
        action: () => action(true),
        confirmLabel: "Fill next row",
        description: `This will fill all ${document.headings.length} target cells using the selected scaling operation. You can undo this change.`,
      });
    else action();
  }
  function removeRow(rowId: string) {
    attempt(() => {
      operations([{ op: "remove_row", rowId }]);
      setSelection(null);
      setArrowFrom(null);
      setTool("edit");
    });
  }
  function removeColumn(column: number) {
    attempt(() => {
      operations([{ op: "remove_column", column: column as 0 | 1 | 2 }]);
      setSelection(null);
      setArrowFrom(null);
      setTool("edit");
    });
  }
  const removalRow =
    selection?.kind === "cell"
      ? selection.rowId
      : selection?.kind === "step"
        ? selection.from
        : document.rows.at(-1)!.id;
  const removalColumn =
    selection?.kind === "cell" || selection?.kind === "heading"
      ? selection.column
      : document.headings.length - 1;
  return (
    <div ref={editor} className="app-shell booklet-editor ratio-app">
      <main
        className="main-content"
        id={active ? "main-content" : undefined}
        tabIndex={-1}
      >
        <PageHeading
          title="Ratio tables"
          description="Choose values, add scaling arrows and copy a clean table into Word."
        >
          <div
            role="status"
            className={`save-indicator save-indicator--${saveState}`}
          >
            <span />
            {recovery
              ? "Recovery needed"
              : pendingInputs.size
                ? "Finish editing to save"
                : saveState === "saving"
                  ? "Saving…"
                  : saveState === "error"
                    ? "Not saved on device"
                    : "Saved on this device"}
          </div>
        </PageHeading>
        {recovery !== null && (
          <section className="ratio-recovery" role="alert">
            <strong>Recover your saved table</strong>
            <p>
              Its original file is preserved. Save a recovery copy before
              starting fresh.
            </p>
            <button
              onClick={() => {
                downloadBlob(
                  new Blob([recovery], { type: "application/json" }),
                  "maths-ratio-table-recovery.json",
                );
                setRecoveryDownloaded(true);
              }}
            >
              Download recovery copy
            </button>
            <button
              disabled={!recoveryDownloaded}
              onClick={() =>
                attempt(() => {
                  startRatioAfterRecovery(recovery, envelope);
                  setRecovery(null);
                  setMessage("");
                })
              }
            >
              I've saved the copy — start fresh
            </button>
          </section>
        )}
        {message && (
          <p role="status" className="ratio-message">
            {message}
          </p>
        )}
        <section className="workspace">
          <Panel className="editor-card">
            <EditorToolbar
              canUndo={!recovery && !!history.past.length}
              canRedo={!recovery && !!history.future.length}
              onUndo={undo}
              onRedo={redo}
              onReset={() => replace(emptyRatioTable(), "Reset this table?")}
              resetDisabled={structureDisabled}
              exportDisabled={exportDisabled}
              busy={busy}
              onCopyClipboard={() =>
                void runExport(
                  () => copyPngToClipboard(() => ratioPrintPng(envelope)),
                  "Image copied to clipboard. Paste with Ctrl+V.",
                )
              }
              onCopy={() =>
                void runExport(
                  () => copyRatioForWord(envelope),
                  "Copied at its print size. Paste into Word with Ctrl+V.",
                )
              }
              menuOpen={exportsOpen}
              onToggleMenu={() => setExportsOpen((v) => !v)}
            />
            <div className="editor-export-popover" hidden={!exportsOpen}>
              {exportsOpen && (
                <div className="export-menu ratio-export-menu" role="menu">
                  <button
                    role="menuitem"
                    onClick={() =>
                      void runExport(() => downloadRatioImage(envelope, "svg"))
                    }
                  >
                    <Download size={18} />
                    <span>
                      <strong>Download SVG</strong>
                      <small>Scalable vector with bundled fonts</small>
                    </span>
                  </button>
                  <button
                    role="menuitem"
                    onClick={() =>
                      void runExport(() => downloadRatioImage(envelope, "png"))
                    }
                  >
                    <Download size={18} />
                    <span>
                      <strong>Download PNG</strong>
                      <small>600 ppi · print-ready image</small>
                    </span>
                  </button>
                  <button
                    role="menuitem"
                    onClick={() => {
                      downloadBlob(
                        new Blob([JSON.stringify(envelope, null, 2)], {
                          type: "application/json",
                        }),
                        "maths-ratio-table.json",
                      );
                      setExportsOpen(false);
                    }}
                  >
                    <Download size={18} />
                    <span>
                      <strong>Save editable table</strong>
                      <small>Reopen to change values and scaffolds</small>
                    </span>
                  </button>
                  <button role="menuitem" onClick={() => file.current?.click()}>
                    <Table2 size={18} />
                    <span>
                      <strong>Open saved table</strong>
                      <small>Preview before replacing your draft</small>
                    </span>
                  </button>
                  <button
                    role="menuitem"
                    onClick={() =>
                      void runExport(async () => {
                        await navigator.clipboard.writeText(
                          ratioEditorLink(envelope, location.href),
                        );
                      }, "Editable link copied. Anyone with the link can open this table.")
                    }
                  >
                    <Copy size={18} />
                    <span>
                      <strong>Copy editable link</strong>
                      <small>Share this table for further editing</small>
                    </span>
                  </button>
                </div>
              )}
            </div>
            <input
              ref={file}
              className="sr-only"
              type="file"
              accept=".json,application/json"
              aria-label="Open editable ratio-table file"
              onChange={(e) => void openFile(e.target.files?.[0])}
            />
            <div className="ratio-preview-controls">
              <label>
                Preview zoom{" "}
                <select
                  aria-label="Preview zoom"
                  value={zoom}
                  onChange={(e) => setZoom(Number(e.target.value))}
                >
                  <option value={0}>Fit to screen</option>
                  <option value={1}>100%</option>
                  <option value={2}>200%</option>
                  <option value={3}>300%</option>
                </select>
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={guides}
                  onChange={(e) => setGuides(e.target.checked)}
                />
                Editing guides
              </label>
            </div>
            <p className="ratio-edit-hint">
              {tool === "arrow"
                ? arrowFrom
                  ? "Select the row immediately below."
                  : "Select a source row, then the row below, or use the arrow settings."
                : "Click a heading, cell or arrow number and type. Click a curved arrow for its settings."}
            </p>
            <RatioCanvas
              envelope={envelope}
              zoom={zoom}
              guides={guides}
              inputVersion={inputVersion}
              disabled={!!recovery}
              structureDisabled={structureDisabled}
              pendingInputs={pendingInputs}
              selection={selectionActive ? selection : null}
              tool={tool}
              arrowFrom={arrowFrom}
              onSelect={selectItem}
              onArrowRow={arrowRow}
              onPending={onInputPending}
              onOperations={operations}
              onAddRow={addRow}
              onAddColumn={addColumn}
              onRemoveRow={() => removeRow(removalRow)}
              onRemoveColumn={() => removeColumn(removalColumn)}
              removalRowIndex={document.rows.findIndex(
                (row) => row.id === removalRow,
              )}
              removalColumnIndex={removalColumn}
            />
            <div className="ratio-preview-footer">
              <span>
                Print size: {metrics.widthCm.toFixed(2)} ×{" "}
                {metrics.heightCm.toFixed(2)} cm
              </span>
              <span>Zoom and editing guides do not appear in exports.</span>
            </div>
            {pendingInputs.size > 0 && (
              <p className="ratio-message" role="status">
                Finish or cancel the current input before exporting. Press Enter
                to apply it or Escape to cancel.
              </p>
            )}
          </Panel>
          <aside className="inspector-stack" aria-label="Ratio-table settings">
            <fieldset disabled={!!recovery} className="ratio-settings">
              <section className="panel-card specialist-tools">
                <h2>Table tools</h2>
                <div
                  className="tool-group"
                  role="group"
                  aria-label="Ratio editing tools"
                >
                  <button
                    className={`tool-button${tool === "edit" ? " tool-button--active" : ""}`}
                    aria-pressed={tool === "edit"}
                    disabled={structureDisabled}
                    onClick={() => {
                      setTool("edit");
                      setArrowFrom(null);
                      setSelection(null);
                      setSelectionActive(false);
                      setMessage("");
                    }}
                  >
                    <MousePointer2 size={18} />
                    <span>Edit</span>
                  </button>
                  <button
                    className={`tool-button${tool === "arrow" ? " tool-button--active" : ""}`}
                    aria-pressed={tool === "arrow"}
                    data-ratio-select
                    disabled={structureDisabled || document.rows.length < 2}
                    onClick={() => {
                      setTool("arrow");
                      setArrowFrom(null);
                      showSelection({
                        kind: "step",
                        from: document.rows[0].id,
                      });
                      setMessage("");
                    }}
                  >
                    <ArrowDown size={18} />
                    <span>Add arrow</span>
                  </button>
                  <button
                    className="tool-button"
                    disabled={structureDisabled}
                    data-ratio-select
                    onClick={() => {
                      setTool("edit");
                      setArrowFrom(null);
                      showSelection({ kind: "headings" });
                    }}
                  >
                    <Type size={18} />
                    <span>Edit headings</span>
                  </button>
                </div>

                <p className="panel-note">
                  Edit values on the table. Add and remove rows or columns
                  beside its edges.
                </p>
              </section>
              <RatioInspector
                document={document}
                selection={selection}
                inputVersion={inputVersion}
                pendingInputs={pendingInputs.size > 0}
                factorDisabled={Array.from(pendingInputs).some((key) =>
                  key.startsWith("inline-factor-"),
                )}
                onSelect={selectItem}
                onPending={onInputPending}
                onOperations={operations}
                onAction={(ops) => attempt(() => operations(ops))}
                onFill={fill}
              />
              <section className="panel-card">
                <details className="ratio-examples">
                  <summary>Start from an example</summary>
                  <button
                    onClick={() =>
                      replace(
                        example("simple"),
                        "Replace with the simple example?",
                      )
                    }
                  >
                    Simple: 4, 8 → 1, answer line
                  </button>
                  <button
                    onClick={() =>
                      replace(
                        example("worked"),
                        "Replace with the worked example?",
                      )
                    }
                  >
                    Worked: divide both columns by 2
                  </button>
                  <button
                    onClick={() =>
                      replace(
                        example("fraction"),
                        "Replace with the fraction scaffold?",
                      )
                    }
                  >
                    Scaffold: divide both columns by 3
                  </button>
                </details>
              </section>
            </fieldset>
            {warnings.length > 0 && (
              <section className="panel-card ratio-warnings">
                <h2>Check the maths</h2>
                {warnings.map((w) => (
                  <p key={w}>{w}</p>
                ))}
                <p>These notes stay out of the printed diagram.</p>
              </section>
            )}
            <p className="panel-note">
              Word exports are images. Save an editable table to change it later
              in this website.
            </p>
          </aside>
        </section>
      </main>
      {active && pending && (
        <RatioDialog
          title={pending.title}
          onCancel={cancelPending}
          disabled={!!recovery || pendingInputs.size > 0}
          confirmLabel={pending.confirmLabel}
          onConfirm={() => {
            attempt(() => {
              if (pending.envelope) {
                commit(pending.envelope);
                setInputVersion((v) => v + 1);
                setSelection(null);
                setTool("edit");
                setArrowFrom(null);
              } else pending.action?.();
            });
            cancelPending();
            setExportsOpen(false);
          }}
        >
          <p>
            {pending.envelope
              ? "Your current table stays unchanged until you open this one. You can undo the replacement."
              : (pending.description ?? "You can undo this change.")}
          </p>
          {pending.envelope && (
            <div
              className="ratio-import-preview"
              aria-label={describeRatio(pending.envelope)}
              dangerouslySetInnerHTML={{
                __html: renderRatioSvg(pending.envelope.document),
              }}
            />
          )}
        </RatioDialog>
      )}
    </div>
  );
}
