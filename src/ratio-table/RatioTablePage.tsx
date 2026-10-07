import { useCallback, useEffect, useRef, useState } from "react";
import {
  BookOpen,
  Check,
  ChevronDown,
  Copy,
  Download,
  Grid3X3,
  LockKeyhole,
  Plus,
  Redo2,
  RotateCcw,
  Shapes,
  Table2,
  Trash2,
  Undo2,
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
  RatioDocument,
} from "../../packages/ratio-table-core/src/interchange";
import { downloadBlob } from "../export/clipboard";
import { copyRatioForWord, downloadRatioImage } from "./export";
import {
  loadRatioRecovery,
  saveRatio,
  startRatioAfterRecovery,
} from "./persistence";
import { NumberInput } from "./NumberInput";
import { HeadingInput } from "./HeadingInput";
import { RatioDialog } from "./RatioDialog";
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
export default function RatioTablePage() {
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
  const [toolsOpen, setToolsOpen] = useState(false),
    [exportsOpen, setExportsOpen] = useState(false);
  const [busy, setBusy] = useState(false),
    [zoom, setZoom] = useState(2),
    [guides, setGuides] = useState(false);
  const [pending, setPending] = useState<Pending | null>(null),
    [inputVersion, setInputVersion] = useState(0);
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
      if (!location.hash.startsWith("#ratio-table=") || blocked.current) return;
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
  }, [recovery]);
  useEffect(() => {
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
        setToolsOpen(false);
      }
    }
    window.addEventListener("keydown", keyboard);
    return () => window.removeEventListener("keydown", keyboard);
  }, [undo, redo]);
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
  function changeHeadings(
    index: number,
    update: Partial<RatioDocument["headings"][number]>,
  ) {
    const headings = structuredClone(document.headings);
    headings[index] = { ...headings[index], ...update };
    attempt(() => operations([{ op: "set_headings", headings }]));
  }
  const headingNames = document.headings.map((h) => h.text);
  return (
    <div
      className="app-shell ratio-app"
      onClick={() => {
        if (toolsOpen) setToolsOpen(false);
      }}
    >
      <header className="site-header">
        <div className="brand-mark" aria-hidden="true">
          MB
        </div>
        <div className="brand-copy">
          <strong>Maths Booklet Tools</strong>
          <span>Practical tools for lesson resources</span>
        </div>
        <div className="header-tools">
          <button
            className="header-menu-button"
            aria-expanded={toolsOpen}
            onClick={(e) => {
              e.stopPropagation();
              setToolsOpen((v) => !v);
            }}
          >
            <Shapes size={16} />
            Tools
            <ChevronDown size={14} />
          </button>
          {toolsOpen && (
            <div className="tools-popover" onClick={(e) => e.stopPropagation()}>
              <p className="eyebrow">MATHS TOOLS</p>
              <button
                onClick={() => {
                  location.href = "?tool=graph";
                }}
              >
                <Grid3X3 size={18} />
                <span>
                  <strong>Graph builder</strong>
                  <small>1 cm square grid</small>
                </span>
              </button>
              <button>
                <Table2 size={18} />
                <span>
                  <strong>Ratio tables</strong>
                  <small>Current tool</small>
                </span>
                <Check size={16} />
              </button>
              <button
                onClick={() => {
                  location.href = "?tool=question-bank";
                }}
              >
                <BookOpen size={18} />
                <span>
                  <strong>Question bank</strong>
                  <small>Reviewed practice questions</small>
                </span>
              </button>
            </div>
          )}
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
        </div>
      </header>
      <main className="main-content">
        <section className="intro-row">
          <div>
            <p className="eyebrow">RATIO TABLES · LESSON DIAGRAMS</p>
            <h1>Build a ratio table for Word</h1>
            <p>Choose values, fade the scaffolding and copy a clean diagram.</p>
          </div>
          <div className="privacy-note">
            <LockKeyhole size={15} />
            <span>Your table stays in this browser.</span>
          </div>
        </section>
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
          <div className="editor-card">
            <div className="editor-toolbar ratio-toolbar">
              <div className="tool-group">
                <button
                  className={`tool-button${document.mode === "simple" ? " tool-button--active" : ""}`}
                  disabled={!!recovery}
                  onClick={() =>
                    attempt(() =>
                      operations([
                        { op: "set_annotation_visibility", mode: "simple" },
                      ]),
                    )
                  }
                >
                  Simple
                </button>
                <button
                  className={`tool-button${document.mode === "annotated" ? " tool-button--active" : ""}`}
                  disabled={!!recovery}
                  onClick={() =>
                    attempt(() =>
                      operations([
                        { op: "set_annotation_visibility", mode: "annotated" },
                      ]),
                    )
                  }
                >
                  With scaling arrows
                </button>
              </div>
              <button
                className="icon-button"
                aria-label="Undo"
                disabled={!!recovery || !history.past.length}
                onClick={undo}
              >
                <Undo2 size={18} />
              </button>
              <button
                className="icon-button"
                aria-label="Redo"
                disabled={!!recovery || !history.future.length}
                onClick={redo}
              >
                <Redo2 size={18} />
              </button>
              <button
                className="tool-button reset-button"
                disabled={!!recovery}
                onClick={() => replace(emptyRatioTable(), "Reset this table?")}
              >
                <RotateCcw size={16} />
                Reset
              </button>
              <span className="toolbar-spacer" />
              <div className="copy-split">
                <button
                  className="copy-main"
                  disabled={exportDisabled}
                  onClick={() =>
                    void runExport(
                      () => copyRatioForWord(envelope),
                      "Copied at its print size. Paste into Word with Ctrl+V.",
                    )
                  }
                >
                  <Copy size={16} />
                  {busy ? "Preparing…" : "Copy for Word"}
                </button>
                <button
                  className="copy-more"
                  aria-label="Download options"
                  aria-expanded={exportsOpen}
                  disabled={exportDisabled}
                  onClick={() => setExportsOpen((v) => !v)}
                >
                  <ChevronDown size={16} />
                </button>
              </div>
            </div>
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
            <div className="ratio-stage">
              <div
                className="ratio-paper"
                style={{
                  width: `${metrics.widthCm * 37.7952756 * zoom}px`,
                  maxWidth: "100%",
                }}
              >
                <div
                  className="ratio-preview"
                  data-testid="ratio-preview"
                  dangerouslySetInnerHTML={{ __html: renderRatioSvg(document) }}
                />
                {guides && (
                  <svg
                    className="ratio-guides"
                    viewBox={`0 0 ${metrics.width} ${metrics.height}`}
                    aria-hidden="true"
                  >
                    <g stroke="#a3a9b0" strokeDasharray="3 5" fill="none">
                      {Array.from(
                        { length: document.rows.length + 2 },
                        (_, i) => (
                          <path
                            key={i}
                            d={`M${metrics.tableLeft} ${metrics.tableTop + i * 100}h300`}
                          />
                        ),
                      )}
                      <path
                        d={`M${metrics.tableLeft} ${metrics.tableTop}v${(document.rows.length + 1) * 100}M${metrics.tableLeft + 300} ${metrics.tableTop}v${(document.rows.length + 1) * 100}`}
                      />
                    </g>
                  </svg>
                )}
              </div>
            </div>
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
          </div>
          <aside className="inspector-stack" aria-label="Ratio-table settings">
            <fieldset disabled={!!recovery} className="ratio-settings">
              <section className="panel-card">
                <div className="panel-heading">
                  <Table2 size={17} />
                  <h2>Values</h2>
                </div>
                <p className="panel-note">
                  Enter a number or fraction. Choose Empty or Answer line to
                  leave work for pupils.
                </p>
                <div className="ratio-row-headings">
                  <span>{headingNames[0]}</span>
                  <span>{headingNames[1]}</span>
                </div>
                {document.rows.map((row, index) => (
                  <div className="ratio-row" key={row.id}>
                    <div className="ratio-row-label">
                      <strong>Row {index + 1}</strong>
                      <button
                        className="ratio-remove"
                        aria-label={`Remove row ${index + 1}`}
                        disabled={document.rows.length <= 2}
                        onClick={() =>
                          attempt(() =>
                            operations([{ op: "remove_row", rowId: row.id }]),
                          )
                        }
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <div className="ratio-cell-fields">
                      {row.cells.map((cell, column) => (
                        <div key={column}>
                          <select
                            aria-label={`Row ${index + 1} ${headingNames[column]} cell type`}
                            value={cell.kind}
                            onChange={(e) =>
                              attempt(() =>
                                operations([
                                  {
                                    op: "set_cell",
                                    rowId: row.id,
                                    column: column as 0 | 1,
                                    cell:
                                      e.target.value === "number"
                                        ? { kind: "number", value: "0" }
                                        : {
                                            kind: e.target.value as
                                              | "empty"
                                              | "answer-line",
                                          },
                                  },
                                ]),
                              )
                            }
                          >
                            <option value="number">Value</option>
                            <option value="empty">Empty</option>
                            <option value="answer-line">Answer line</option>
                          </select>
                          {cell.kind === "number" && (
                            <NumberInput
                              key={`${row.id}-${column}-${inputVersion}`}
                              inputKey={`${row.id}-${column}`}
                              label={`Row ${index + 1} ${headingNames[column]} value`}
                              value={cell.value}
                              onPending={onInputPending}
                              onCommit={(value) =>
                                operations([
                                  {
                                    op: "set_cell",
                                    rowId: row.id,
                                    column: column as 0 | 1,
                                    cell: { kind: "number", value },
                                  },
                                ])
                              }
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                <button
                  className="panel-button"
                  disabled={document.rows.length >= 6}
                  onClick={() =>
                    attempt(() => {
                      let index = 1;
                      while (document.rows.some((r) => r.id === `row-${index}`))
                        index++;
                      operations([
                        {
                          op: "add_row",
                          after: document.rows.at(-1)!.id,
                          row: {
                            id: `row-${index}`,
                            cells: [{ kind: "empty" }, { kind: "empty" }],
                          },
                        },
                      ]);
                    })
                  }
                >
                  <Plus size={16} />
                  Add row
                </button>
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
              <section className="panel-card">
                <div className="panel-heading">
                  <Shapes size={17} />
                  <h2>Scaling steps</h2>
                </div>
                <p className="panel-note">
                  One operation applies to both columns. Filling answers is
                  always your choice.
                </p>
                {document.rows.slice(0, -1).map((row, index) => {
                  const step = document.transitions.find(
                      (t) => t.from === row.id,
                    ),
                    to = document.rows[index + 1].id;
                  return (
                    <div className="ratio-step" key={row.id}>
                      <strong>
                        Row {index + 1} → Row {index + 2}
                      </strong>
                      <div className="ratio-step-fields">
                        <select
                          aria-label={`Row ${index + 1} scaling operation`}
                          value={step?.operation ?? "none"}
                          onChange={(e) =>
                            attempt(() =>
                              operations([
                                e.target.value === "none"
                                  ? { op: "remove_transition", from: row.id }
                                  : {
                                      op: "set_transition",
                                      transition: {
                                        from: row.id,
                                        to,
                                        operation: e.target.value as
                                          | "multiply"
                                          | "divide",
                                        factor: step?.factor ?? "2",
                                      },
                                    },
                              ]),
                            )
                          }
                        >
                          <option value="none">No step</option>
                          <option value="multiply">Multiply ×</option>
                          <option value="divide">Divide ÷</option>
                        </select>
                        {step && (
                          <NumberInput
                            key={`${row.id}-factor-${inputVersion}`}
                            inputKey={`${row.id}-factor`}
                            value={step.factor}
                            label={`Row ${index + 1} scaling factor`}
                            onPending={onInputPending}
                            onCommit={(factor) =>
                              operations([
                                {
                                  op: "set_transition",
                                  transition: { ...step, factor },
                                },
                              ])
                            }
                          />
                        )}
                      </div>
                      {step && (
                        <button
                          className="panel-button"
                          disabled={pendingInputs.size > 0}
                          onClick={() => {
                            const fill = (overwrite = false) =>
                              attempt(() =>
                                operations([
                                  {
                                    op: "fill_next_row",
                                    from: row.id,
                                    overwrite,
                                  },
                                ]),
                              );
                            if (
                              document.rows[index + 1].cells.some(
                                (c) => c.kind === "number",
                              )
                            )
                              setPending({
                                title: "Replace the next row's values?",
                                action: () => fill(true),
                                confirmLabel: "Fill next row",
                              });
                            else fill();
                          }}
                        >
                          Fill next row
                        </button>
                      )}
                    </div>
                  );
                })}
                <label className="check-row">
                  <input
                    type="checkbox"
                    checked={document.showArrows}
                    onChange={(e) =>
                      attempt(() =>
                        operations([
                          {
                            op: "set_annotation_visibility",
                            showArrows: e.target.checked,
                          },
                        ]),
                      )
                    }
                  />
                  Show arrows
                </label>
                <label className="check-row">
                  <input
                    type="checkbox"
                    checked={document.showOperations}
                    onChange={(e) =>
                      attempt(() =>
                        operations([
                          {
                            op: "set_annotation_visibility",
                            showOperations: e.target.checked,
                          },
                        ]),
                      )
                    }
                  />
                  Show operation labels
                </label>
                {document.mode === "simple" && (
                  <p className="panel-note">
                    Simple mode hides scaling annotations and keeps your steps
                    for later.
                  </p>
                )}
              </section>
              <section className="panel-card">
                <div className="panel-heading">
                  <Grid3X3 size={17} />
                  <h2>Appearance</h2>
                </div>
                <label className="ratio-label">
                  Print size
                  <select
                    aria-label="Print size"
                    value={document.size}
                    onChange={(e) =>
                      attempt(() =>
                        operations([
                          {
                            op: "set_size",
                            size: e.target.value as RatioDocument["size"],
                          },
                        ]),
                      )
                    }
                  >
                    <option value="compact">Compact · 80%</option>
                    <option value="standard">Standard · lesson size</option>
                    <option value="large">Large · 120%</option>
                  </select>
                </label>
                <details className="ratio-headings">
                  <summary>Custom headings</summary>
                  <p className="panel-note">
                    Use short labels to keep the table compact.
                  </p>
                  {document.headings.map((heading, index) => (
                    <div className="ratio-heading-controls" key={index}>
                      <HeadingInput
                        key={`heading-${index}-${inputVersion}`}
                        label={`Column ${index + 1} heading`}
                        inputKey={`heading-${index}`}
                        value={heading.text}
                        onPending={onInputPending}
                        onCommit={(text) => {
                          const headings = structuredClone(document.headings);
                          headings[index] = { ...headings[index], text };
                          operations([{ op: "set_headings", headings }]);
                        }}
                      />
                      <select
                        aria-label={`Column ${index + 1} heading arrow`}
                        value={heading.direction}
                        onChange={(e) =>
                          changeHeadings(index, {
                            direction: e.target
                              .value as typeof heading.direction,
                          })
                        }
                      >
                        <option value="right">Right arrow →</option>
                        <option value="up">Up arrow ↑</option>
                        <option value="none">No arrow</option>
                      </select>
                      <label className="check-row">
                        <input
                          type="checkbox"
                          checked={heading.italic}
                          onChange={(e) =>
                            changeHeadings(index, { italic: e.target.checked })
                          }
                        />
                        Italic maths heading
                      </label>
                    </div>
                  ))}
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
      {pending && (
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
              } else pending.action?.();
            });
            cancelPending();
            setExportsOpen(false);
          }}
        >
          <p>
            {pending.envelope
              ? "Your current table stays unchanged until you open this one. You can undo the replacement."
              : "This will fill both target cells using the selected scaling operation. You can undo this change."}
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
