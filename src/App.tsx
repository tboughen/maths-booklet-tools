import { ExampleGallery } from "./examples/ExampleGallery";
import { graphGallery } from "./examples/galleryCatalogue";
import { PreviewControls } from "./site/PreviewControls";
import { ResourceSaveStatus } from "./site/ResourceSaveStatus";
import { createEnvelope } from "../packages/graph-core/src/interchange";
import { useGraphDrafts } from "./components/useGraphDrafts";
import { newBrowserGraph } from "./domain/browserGraph";
import { ResourceSize } from "./site/ResourceSize";
import { formatResourceSize } from "./site/resourceSizeFormat";
import { getExportMetrics } from "./export/svg";
import { RatioDialog } from "./ratio-table/RatioDialog";
import { renderDiagramPng } from "./export/png";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, ExternalLink, X } from "lucide-react";
import { PageHeading, Panel } from "./site/PageHeading";
import { AxisSettings } from "./components/AxisSettings";
import { EquationPanel } from "./components/EquationPanel";
import { GraphCanvas } from "./components/GraphCanvas";
import { ObjectInspector } from "./components/ObjectInspector";
import { ObjectsPanel } from "./components/ObjectsPanel";
import { GraphTools } from "./components/GraphTools";
import { EditorToolbar } from "./site/EditorToolbar";
import { GraphExchange } from "./components/GraphExchange";
import {
  adjustAxis,
  deleteSelectedObject,
  getBounds,
  getObjectById,
  getSelectedObject,
  HISTORY_LIMIT,
  makeId,
  setAxisScale,
  updateObject,
} from "./domain/diagram";
import { pointsForEquation } from "./domain/equations";
import type { LineEquation } from "./domain/equations";
import {
  acknowledgeRecovery,
  ENVELOPE_STORAGE_KEY,
  loadDiagramRecovery,
  saveDiagram,
} from "./domain/persistence";
import type {
  DiagramDocumentV1,
  DrawingTool,
  GraphObject,
  StraightObject,
  UnitsPerSquare,
} from "./domain/types";
import {
  copyDiagram,
  copyPngToClipboard,
  downloadDiagramPng,
  downloadDiagramSvg,
} from "./export/clipboard";

interface HistoryState {
  past: DiagramDocumentV1[];
  present: DiagramDocumentV1;
  future: DiagramDocumentV1[];
}

interface ToastState {
  kind: "success" | "error";
  title: string;
  detail: string;
}

function sameDocument(
  first: DiagramDocumentV1,
  second: DiagramDocumentV1,
): boolean {
  return JSON.stringify(first) === JSON.stringify(second);
}

export default function App({ active = true }: { active?: boolean }) {
  const [startup] = useState(() => loadDiagramRecovery(newBrowserGraph));
  const [recoveryConflict, setRecoveryConflict] = useState(startup.conflict);
  const [recoveryReason, setRecoveryReason] = useState(
    "A saved graph could not be read by this version. Its original data will be kept as a recovery copy. Continue with the last readable graph?",
  );
  const [storedAtStart] = useState(() => {
    try {
      return localStorage.getItem(ENVELOPE_STORAGE_KEY);
    } catch {
      return null;
    }
  });
  const expectedStorage = useRef(storedAtStart);
  const [history, setHistory] = useState<HistoryState>(() => ({
    past: [],
    present: startup.document,
    future: [],
  }));
  const [pendingExample, setPendingExample] =
    useState<DiagramDocumentV1 | null>(null);
  const [tool, setTool] = useState<DrawingTool>("select");
  const [equationOpen, setEquationOpen] = useState(false);
  const [equationRevision, setEquationRevision] = useState(0);
  const [editingEquationId, setEditingEquationId] = useState<string | null>(
    null,
  );
  const [objectsExpanded, setObjectsExpanded] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [wordHelpOpen, setWordHelpOpen] = useState(false);
  const [copying, setCopying] = useState(false);
  const [saveState, setSaveState] = useState<"saving" | "saved" | "error">(
    "saved",
  );
  const [toast, setToast] = useState<ToastState | null>(null);
  const drafts = useGraphDrafts();
  const hasPendingDraft = drafts.hasPending;
  const [previewZoom, setPreviewZoom] = useState(0);
  const blocked = recoveryConflict || copying || drafts.pending;
  const locked = () => recoveryConflict || copying || hasPendingDraft();
  const act = (action: () => void) => {
    if (!locked()) action();
  };
  const document = history.present;
  const exportMetrics = getExportMetrics(document);
  const selectedObject = getSelectedObject(document);
  const editingObject = editingEquationId
    ? getObjectById(document, editingEquationId)
    : undefined;
  const editingStraight =
    editingObject?.kind === "straight" ? editingObject : undefined;
  const exchangeMessage = useCallback((message: string, error = false) => {
    setToast({
      kind: error ? "error" : "success",
      title: error ? "Action could not be completed" : "Graph sharing",
      detail: message,
    });
  }, []);

  const commit = useCallback((next: DiagramDocumentV1) => {
    setHistory((current) => {
      if (sameDocument(current.present, next)) return current;
      return {
        past: [...current.past, current.present].slice(-HISTORY_LIMIT),
        present: next,
        future: [],
      };
    });
  }, []);

  const replaceWithoutHistory = useCallback((next: DiagramDocumentV1) => {
    setHistory((current) => ({ ...current, present: next }));
  }, []);

  const undo = useCallback(() => {
    if (hasPendingDraft() || recoveryConflict) return;
    setHistory((current) => {
      const previous = current.past.at(-1);
      if (!previous) return current;
      return {
        past: current.past.slice(0, -1),
        present: previous,
        future: [current.present, ...current.future].slice(0, HISTORY_LIMIT),
      };
    });
  }, [hasPendingDraft, recoveryConflict]);

  const redo = useCallback(() => {
    if (hasPendingDraft() || recoveryConflict) return;
    setHistory((current) => {
      const next = current.future[0];
      if (!next) return current;
      return {
        past: [...current.past, current.present].slice(-HISTORY_LIMIT),
        present: next,
        future: current.future.slice(1),
      };
    });
  }, [hasPendingDraft, recoveryConflict]);

  useEffect(() => {
    if (recoveryConflict) {
      setSaveState("error");
      return;
    }
    setSaveState("saving");
    const timeout = window.setTimeout(() => {
      try {
        const raw = localStorage.getItem(ENVELOPE_STORAGE_KEY),
          next = JSON.stringify(createEnvelope(document, false));
        if (raw !== expectedStorage.current && raw !== next) {
          setRecoveryReason(
            "The saved graph changed in another tab. Keep a recovery copy before replacing it with this graph.",
          );
          setRecoveryConflict(true);
          setSaveState("error");
          return;
        }
        saveDiagram(document);
        expectedStorage.current = localStorage.getItem(ENVELOPE_STORAGE_KEY);
        setSaveState("saved");
      } catch {
        setSaveState("error");
      }
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [document, recoveryConflict]);

  useEffect(() => {
    const changed = (event: StorageEvent) => {
      if (
        (event.key === ENVELOPE_STORAGE_KEY || event.key === null) &&
        event.newValue !== expectedStorage.current
      ) {
        setRecoveryReason(
          "The saved graph changed in another tab. Keep a recovery copy before replacing it with this graph.",
        );
        setRecoveryConflict(true);
      }
    };
    window.addEventListener("storage", changed);
    return () => window.removeEventListener("storage", changed);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(
      () => setToast(null),
      toast.kind === "success" ? 3500 : 7000,
    );
    return () => window.clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    if (!active) return;
    function handleKeyboard(event: KeyboardEvent) {
      if (globalThis.document.querySelector('[aria-modal="true"]')) return;
      const target = event.target as HTMLElement | null;
      if (target?.matches("input, textarea, select, [contenteditable='true']"))
        return;
      if (hasPendingDraft() || recoveryConflict) return;
      const command = event.ctrlKey || event.metaKey;
      if (command && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
        return;
      }
      if (command && event.key.toLowerCase() === "y") {
        event.preventDefault();
        redo();
        return;
      }
      if (event.key === "Escape") {
        setTool("select");
        setEquationOpen(false);
        setEditingEquationId(null);
        setExportMenuOpen(false);
        setWordHelpOpen(false);
        replaceWithoutHistory({ ...document, selectedObjectId: null });
        return;
      }
      if (
        (event.key === "Delete" || event.key === "Backspace") &&
        document.selectedObjectId
      ) {
        event.preventDefault();
        commit(deleteSelectedObject(document));
        return;
      }
      if (
        !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(
          event.key,
        ) ||
        !selectedObject
      )
        return;
      event.preventDefault();
      const dx =
        event.key === "ArrowLeft"
          ? -document.axes.x.unitsPerSquare / 2
          : event.key === "ArrowRight"
            ? document.axes.x.unitsPerSquare / 2
            : 0;
      const dy =
        event.key === "ArrowDown"
          ? -document.axes.y.unitsPerSquare / 2
          : event.key === "ArrowUp"
            ? document.axes.y.unitsPerSquare / 2
            : 0;
      const moved: GraphObject =
        selectedObject.kind === "point"
          ? {
              ...selectedObject,
              position: {
                x: selectedObject.position.x + dx,
                y: selectedObject.position.y + dy,
              },
            }
          : {
              ...selectedObject,
              start: {
                x: selectedObject.start.x + dx,
                y: selectedObject.start.y + dy,
              },
              end: {
                x: selectedObject.end.x + dx,
                y: selectedObject.end.y + dy,
              },
              equationLabelPosition: selectedObject.equationLabelPosition
                ? {
                    x: selectedObject.equationLabelPosition.x + dx,
                    y: selectedObject.equationLabelPosition.y + dy,
                  }
                : undefined,
            };
      commit(updateObject(document, moved));
    }
    window.addEventListener("keydown", handleKeyboard);
    return () => window.removeEventListener("keydown", handleKeyboard);
  }, [
    active,
    commit,
    document,
    redo,
    replaceWithoutHistory,
    selectedObject,
    undo,
    hasPendingDraft,
    recoveryConflict,
  ]);

  function selectObject(id: string | null) {
    if (locked()) return;
    replaceWithoutHistory({ ...document, selectedObjectId: id });
  }

  function updateSelected(object: GraphObject) {
    commit(updateObject(document, object));
  }

  function openEquationEditor(object?: StraightObject) {
    if (locked()) return;
    setEditingEquationId(object?.id ?? null);
    setEquationOpen(true);
    setTool("select");
  }

  function submitEquation(equation: LineEquation, showEquation: boolean) {
    drafts.cancel("equation");
    const [start, end] = pointsForEquation(equation, getBounds(document));
    if (editingStraight) {
      commit(
        updateObject(document, {
          ...editingStraight,
          start,
          end,
          equationVisible: showEquation,
          equationLabelPosition: undefined,
        }),
      );
    } else {
      const object: StraightObject = {
        id: makeId(),
        kind: "straight",
        display: "line",
        strokeStyle: "solid",
        start,
        end,
        equationVisible: showEquation,
      };
      commit({
        ...document,
        objects: [...document.objects, object],
        selectedObjectId: object.id,
      });
    }
    setEquationOpen(false);
    setEditingEquationId(null);
  }

  async function handleCopy(imageOnly = false) {
    if (locked()) return;
    setCopying(true);
    setExportMenuOpen(false);
    try {
      if (imageOnly) await copyPngToClipboard(() => renderDiagramPng(document));
      else await copyDiagram(document);
      setToast({
        kind: "success",
        title: imageOnly ? "Image copied" : "Copied for Word",
        detail: imageOnly
          ? "Paste with Ctrl+V."
          : "Copied for Word at " +
            formatResourceSize(exportMetrics.widthCm, exportMetrics.heightCm) +
            ". Paste with Ctrl+V.",
      });
    } catch (error) {
      const detail =
        error instanceof Error
          ? error.message
          : "Clipboard copying is unavailable. Use Download PNG (600 ppi) instead.";
      setToast({ kind: "error", title: "Copy was not available", detail });
      setExportMenuOpen(true);
    } finally {
      setCopying(false);
    }
  }

  function resetDiagram() {
    if (locked()) return;
    const resetDocument = newBrowserGraph();
    const meaningfulDocument = { ...document, selectedObjectId: null };
    if (
      !sameDocument(meaningfulDocument, resetDocument) &&
      !window.confirm(
        "Reset the diagram? This clears the grid settings and all objects. You can undo this action afterwards.",
      )
    )
      return;
    commit(resetDocument);
    setTool("select");
    setEquationOpen(false);
    setEditingEquationId(null);
    setExportMenuOpen(false);
    setWordHelpOpen(false);
    setObjectsExpanded(false);
  }

  const saveMessage = useMemo(() => {
    if (saveState === "saving") return "Saving…";
    if (saveState === "error") return "Not saved on device";
    return "Saved on this device";
  }, [saveState]);

  return (
    <div className="app-shell booklet-editor graph-editor">
      <main
        className="main-content"
        id={active ? "main-content" : undefined}
        tabIndex={-1}
      >
        <PageHeading
          title="Graph tool"
          description="Draw, adjust and copy a graph on a 1 cm square grid."
        >
          <ResourceSaveStatus
            text={saveMessage}
            state={
              saveState === "saved" && drafts.pending ? "pending" : saveState
            }
          />
        </PageHeading>

        <section className="workspace">
          <Panel className="editor-card">
            <EditorToolbar
              onUndo={undo}
              onRedo={redo}
              onReset={resetDiagram}
              resetLabel="Reset diagram"
              canUndo={!blocked && history.past.length > 0}
              canRedo={!blocked && history.future.length > 0}
              resetDisabled={blocked}
              exportDisabled={blocked}
              menuId="graph-downloads"
              busy={copying}
              onCopy={() => void handleCopy()}
              onCopyClipboard={() => void handleCopy(true)}
              menuOpen={exportMenuOpen}
              onToggleMenu={() => setExportMenuOpen((open) => !open)}
            />
            <GraphExchange
              document={document}
              onImport={(next) => act(() => commit(next))}
              onClose={() => setExportMenuOpen(false)}
              onMessage={exchangeMessage}
              visible={exportMenuOpen}
              enabled={active && !blocked}
              active={active}
              onBusyChange={setCopying}
              imageActions={[
                {
                  label: "Download SVG",
                  disabled: blocked,
                  action: () => {
                    if (locked())
                      throw Error("Apply or cancel unfinished input first.");
                    return downloadDiagramSvg(document);
                  },
                  success: "SVG download started.",
                },
                {
                  label: "Download PNG (600 ppi)",
                  disabled: blocked,
                  action: () => {
                    if (locked())
                      throw Error("Apply or cancel unfinished input first.");
                    return downloadDiagramPng(document);
                  },
                  success: "PNG download started.",
                },
                {
                  label: "First-time Word setup",
                  disabled: blocked,
                  action: () => setWordHelpOpen(true),
                  picker: true,
                },
              ]}
            />
            {drafts.pending && (
              <p className="graph-pending-note" role="status">
                Unapplied changes. Apply or cancel the unfinished field before
                exporting or changing this graph.
              </p>
            )}
            <div className="resource-preview-bar">
              <PreviewControls zoom={previewZoom} onZoom={setPreviewZoom} />
              <ResourceSize
                width={exportMetrics.widthCm}
                height={exportMetrics.heightCm}
              />
            </div>
            <GraphCanvas
              zoom={previewZoom}
              disabled={blocked}
              document={document}
              tool={tool}
              onCommit={(next) => act(() => commit(next))}
              onSelect={selectObject}
              onAxisAdjust={(axis, end, delta) =>
                act(() => commit(adjustAxis(document, axis, end, delta)))
              }
            />
          </Panel>

          <aside className="inspector-stack" aria-label="Graph settings">
            <ExampleGallery
              examples={graphGallery}
              active={active}
              disabled={blocked}
              onUse={(resource) => setPendingExample(resource)}
              onWorked={(resource) => commit(resource)}
            />
            {equationOpen || !selectedObject ? (
              <EquationPanel
                key={`${editingEquationId ?? "new"}-${equationRevision}`}
                persistent={!selectedObject && !equationOpen}
                disabled={recoveryConflict || copying}
                onPending={(pending) =>
                  pending
                    ? drafts.edit("equation", "pending", "")
                    : drafts.cancel("equation")
                }
                editing={editingStraight}
                onSubmit={submitEquation}
                onClose={() => {
                  drafts.cancel("equation");
                  setEquationOpen(false);
                  setEditingEquationId(null);
                  setEquationRevision((revision) => revision + 1);
                }}
              />
            ) : (
              <ObjectInspector
                drafts={drafts}
                disabled={recoveryConflict || copying}
                object={selectedObject}
                onUpdate={updateSelected}
                onDelete={() => commit(deleteSelectedObject(document))}
                onEditEquation={openEquationEditor}
              />
            )}
            <fieldset className="graph-control-group" disabled={blocked}>
              <GraphTools
                tool={tool}
                onToolChange={(next) => {
                  if (locked()) return;
                  setTool(next);
                  setEquationOpen(false);
                  setEditingEquationId(null);
                }}
                onEquation={() => openEquationEditor()}
              />
            </fieldset>
            <AxisSettings
              document={document}
              drafts={drafts}
              onDocument={commit}
              disabled={recoveryConflict || copying}
              xScale={document.axes.x.unitsPerSquare}
              yScale={document.axes.y.unitsPerSquare}
              onChange={(axis: "x" | "y", value: UnitsPerSquare) =>
                act(() => commit(setAxisScale(document, axis, value)))
              }
            />
            <section className="panel-card">
              <details>
                <summary>Print settings</summary>
                <p>
                  Grid squares print at 1 cm. Preview zoom changes the view
                  only.
                </p>
                <button
                  disabled={blocked}
                  onClick={() =>
                    act(() =>
                      commit({
                        ...document,
                        styleProfile:
                          document.styleProfile === "portable-v1"
                            ? "legacy"
                            : "portable-v1",
                      }),
                    )
                  }
                >
                  {document.styleProfile === "portable-v1"
                    ? "Use original graph font"
                    : "Use portable graph font"}
                </button>
              </details>
            </section>
            <fieldset className="graph-control-group" disabled={blocked}>
              <ObjectsPanel
                document={document}
                expanded={objectsExpanded}
                onToggle={() => setObjectsExpanded((open) => !open)}
                onSelect={(id) => {
                  if (locked()) return;
                  selectObject(id);
                  setTool("select");
                  setEquationOpen(false);
                  setEditingEquationId(null);
                }}
              />
            </fieldset>
          </aside>
        </section>
      </main>

      {active && pendingExample && (
        <RatioDialog
          title="Replace with this graph example?"
          confirmLabel="Replace graph"
          onCancel={() => setPendingExample(null)}
          disabled={blocked}
          onConfirm={() => {
            if (locked()) return;
            commit(pendingExample);
            setPendingExample(null);
            setTool("select");
            setEquationOpen(false);
            setEditingEquationId(null);
          }}
        >
          Your current graph stays unchanged until you confirm. Replacing it is
          undoable.
        </RatioDialog>
      )}

      {active && recoveryConflict && (
        <div className="word-help-backdrop">
          <section
            className="word-help-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="graph-recovery-title"
          >
            <h2 id="graph-recovery-title">Review local graph recovery</h2>
            <p>{recoveryReason}</p>
            <button
              className="word-help-done"
              onClick={() => {
                try {
                  acknowledgeRecovery(document);
                  expectedStorage.current =
                    localStorage.getItem(ENVELOPE_STORAGE_KEY);
                  setRecoveryConflict(false);
                } catch {
                  exchangeMessage(
                    "The recovery copy could not be saved. Your original data is unchanged.",
                    true,
                  );
                }
              }}
            >
              Keep recovery copy and continue
            </button>
          </section>
        </div>
      )}

      {active && wordHelpOpen && (
        <div
          className="word-help-backdrop"
          onMouseDown={() => setWordHelpOpen(false)}
        >
          <section
            className="word-help-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="word-help-title"
            aria-describedby="word-help-description"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header>
              <div>
                <p className="eyebrow">ONE-TIME SETUP</p>
                <h2 id="word-help-title">Keep full image quality in Word</h2>
              </div>
              <button
                className="word-help-dismiss"
                autoFocus
                aria-label="Close Word setup"
                onClick={() => setWordHelpOpen(false)}
              >
                <X size={19} />
              </button>
            </header>
            <p id="word-help-description">
              Set this once in Windows desktop Word so pasted graphs keep all
              600 pixels per inch.
            </p>
            <ol>
              <li>
                Open <strong>File › Options › Advanced</strong>.
              </li>
              <li>
                Find <strong>Image Size and Quality</strong> and choose{" "}
                <strong>All New Documents</strong>.
              </li>
              <li>
                Tick <strong>Do not compress images in file</strong>.
              </li>
              <li>
                Set <strong>Default resolution</strong> to{" "}
                <strong>High fidelity</strong>.
              </li>
            </ol>
            <div className="word-help-links">
              <a
                href="https://support.microsoft.com/en-au/office/change-the-default-resolution-for-inserting-pictures-in-office-f4aca5b4-6332-48c6-9488-bf5e0094a7d2"
                target="_blank"
                rel="noreferrer"
              >
                Microsoft: change image resolution{" "}
                <ExternalLink size={14} aria-hidden="true" />
              </a>
              <a
                href="https://support.microsoft.com/en-au/office/turn-off-picture-compression-81a6b603-0266-4451-b08e-fc1bf58da658"
                target="_blank"
                rel="noreferrer"
              >
                Microsoft: turn off compression{" "}
                <ExternalLink size={14} aria-hidden="true" />
              </a>
            </div>
            <button
              className="word-help-done"
              onClick={() => setWordHelpOpen(false)}
            >
              Done
            </button>
          </section>
        </div>
      )}

      {toast && (
        <div className={`toast toast--${toast.kind}`} role="status">
          <span className="toast-icon">
            {toast.kind === "success" ? <Check size={18} /> : <X size={18} />}
          </span>
          <span>
            <strong>{toast.title}</strong>
            <small>{toast.detail}</small>
          </span>
          <button aria-label="Dismiss message" onClick={() => setToast(null)}>
            <X size={16} />
          </button>
        </div>
      )}
      <div className="sr-only" aria-live="polite">
        {document.objects.length} object
        {document.objects.length === 1 ? "" : "s"}
      </div>
    </div>
  );
}
