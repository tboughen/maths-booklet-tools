import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Check,
  ChevronDown,
  CircleHelp,
  Download,
  ExternalLink,
  FileImage,
  Grid3X3,
  LoaderCircle,
  LockKeyhole,
  Shapes,
  X,
} from "lucide-react";
import { AxisSettings } from "./components/AxisSettings";
import { EquationPanel } from "./components/EquationPanel";
import { GraphCanvas } from "./components/GraphCanvas";
import { ObjectInspector } from "./components/ObjectInspector";
import { ObjectsPanel } from "./components/ObjectsPanel";
import { Toolbar } from "./components/Toolbar";
import {
  adjustAxis,
  cloneDefaultDocument,
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
import { clearSavedDiagram, loadDiagram, saveDiagram } from "./domain/persistence";
import type {
  DiagramDocumentV1,
  DrawingTool,
  GraphObject,
  StraightObject,
  UnitsPerSquare,
} from "./domain/types";
import {
  copyDiagram,
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

function sameDocument(first: DiagramDocumentV1, second: DiagramDocumentV1): boolean {
  return JSON.stringify(first) === JSON.stringify(second);
}

export default function App() {
  const [history, setHistory] = useState<HistoryState>(() => ({ past: [], present: loadDiagram(), future: [] }));
  const [tool, setTool] = useState<DrawingTool>("select");
  const [equationOpen, setEquationOpen] = useState(false);
  const [editingEquationId, setEditingEquationId] = useState<string | null>(null);
  const [objectsExpanded, setObjectsExpanded] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [wordHelpOpen, setWordHelpOpen] = useState(false);
  const [toolsMenuOpen, setToolsMenuOpen] = useState(false);
  const [copying, setCopying] = useState(false);
  const [downloadingPng, setDownloadingPng] = useState(false);
  const [saveState, setSaveState] = useState<"saving" | "saved" | "error">("saved");
  const [toast, setToast] = useState<ToastState | null>(null);
  const document = history.present;
  const selectedObject = getSelectedObject(document);
  const editingObject = editingEquationId ? getObjectById(document, editingEquationId) : undefined;
  const editingStraight = editingObject?.kind === "straight" ? editingObject : undefined;

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
    setHistory((current) => {
      const previous = current.past.at(-1);
      if (!previous) return current;
      return {
        past: current.past.slice(0, -1),
        present: previous,
        future: [current.present, ...current.future].slice(0, HISTORY_LIMIT),
      };
    });
  }, []);

  const redo = useCallback(() => {
    setHistory((current) => {
      const next = current.future[0];
      if (!next) return current;
      return {
        past: [...current.past, current.present].slice(-HISTORY_LIMIT),
        present: next,
        future: current.future.slice(1),
      };
    });
  }, []);

  useEffect(() => {
    setSaveState("saving");
    const timeout = window.setTimeout(() => {
      try {
        saveDiagram(document);
        setSaveState("saved");
      } catch {
        setSaveState("error");
      }
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [document]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), toast.kind === "success" ? 3500 : 7000);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    function handleKeyboard(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.matches("input, textarea, select, [contenteditable='true']")) return;
      const command = event.ctrlKey || event.metaKey;
      if (command && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) redo(); else undo();
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
        setToolsMenuOpen(false);
        replaceWithoutHistory({ ...document, selectedObjectId: null });
        return;
      }
      if ((event.key === "Delete" || event.key === "Backspace") && document.selectedObjectId) {
        event.preventDefault();
        commit(deleteSelectedObject(document));
        return;
      }
      if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key) || !selectedObject) return;
      event.preventDefault();
      const dx = event.key === "ArrowLeft" ? -document.axes.x.unitsPerSquare / 2 : event.key === "ArrowRight" ? document.axes.x.unitsPerSquare / 2 : 0;
      const dy = event.key === "ArrowDown" ? -document.axes.y.unitsPerSquare / 2 : event.key === "ArrowUp" ? document.axes.y.unitsPerSquare / 2 : 0;
      const moved: GraphObject = selectedObject.kind === "point"
        ? { ...selectedObject, position: { x: selectedObject.position.x + dx, y: selectedObject.position.y + dy } }
        : {
          ...selectedObject,
          start: { x: selectedObject.start.x + dx, y: selectedObject.start.y + dy },
          end: { x: selectedObject.end.x + dx, y: selectedObject.end.y + dy },
          equationLabelPosition: selectedObject.equationLabelPosition
            ? { x: selectedObject.equationLabelPosition.x + dx, y: selectedObject.equationLabelPosition.y + dy }
            : undefined,
        };
      commit(updateObject(document, moved));
    }
    window.addEventListener("keydown", handleKeyboard);
    return () => window.removeEventListener("keydown", handleKeyboard);
  }, [commit, document, redo, replaceWithoutHistory, selectedObject, undo]);

  function selectObject(id: string | null) {
    replaceWithoutHistory({ ...document, selectedObjectId: id });
  }

  function updateSelected(object: GraphObject) {
    commit(updateObject(document, object));
  }

  function openEquationEditor(object?: StraightObject) {
    setEditingEquationId(object?.id ?? null);
    setEquationOpen(true);
    setTool("select");
  }

  function submitEquation(equation: LineEquation, showEquation: boolean) {
    const [start, end] = pointsForEquation(equation, getBounds(document));
    if (editingStraight) {
      commit(updateObject(document, {
        ...editingStraight,
        start,
        end,
        equationVisible: showEquation,
        equationLabelPosition: undefined,
      }));
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
      commit({ ...document, objects: [...document.objects, object], selectedObjectId: object.id });
    }
    setEquationOpen(false);
    setEditingEquationId(null);
  }

  async function handleCopy() {
    setCopying(true);
    setExportMenuOpen(false);
    try {
      await copyDiagram(document);
      setToast({ kind: "success", title: "Print-quality PNG copied", detail: "Paste into Word with Ctrl+V." });
    } catch (error) {
      const detail = error instanceof Error
        ? error.message
        : "Clipboard copying is unavailable. Use Download PNG (600 ppi) instead.";
      setToast({ kind: "error", title: "Copy was not available", detail });
      setExportMenuOpen(true);
    } finally {
      setCopying(false);
    }
  }

  async function handlePngDownload() {
    setDownloadingPng(true);
    try {
      await downloadDiagramPng(document);
      setToast({ kind: "success", title: "PNG downloaded", detail: "The image is prepared at 600 ppi for high-quality printing." });
      setExportMenuOpen(false);
    } catch {
      setToast({ kind: "error", title: "Download failed", detail: "Try the SVG download instead." });
    } finally {
      setDownloadingPng(false);
    }
  }

  function resetDiagram() {
    const resetDocument = cloneDefaultDocument();
    const meaningfulDocument = { ...document, selectedObjectId: null };
    if (!sameDocument(meaningfulDocument, resetDocument)
        && !window.confirm("Reset the diagram? This clears the grid settings and all objects. You can undo this action afterwards.")) return;
    clearSavedDiagram();
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
    if (saveState === "error") return "Could not save locally";
    return "Saved on this device";
  }, [saveState]);

  return (
    <div className="app-shell" onClick={() => toolsMenuOpen && setToolsMenuOpen(false)}>
      <header className="site-header">
        <div className="brand-mark" aria-hidden="true">MB</div>
        <div className="brand-copy"><strong>Maths Booklet Tools</strong><span>Practical tools for lesson resources</span></div>
        <div className="header-tools">
          <button className="header-menu-button" aria-expanded={toolsMenuOpen} onClick={(event) => { event.stopPropagation(); setToolsMenuOpen((open) => !open); }}><Shapes size={16} />Tools<ChevronDown size={14} /></button>
          {toolsMenuOpen && (
            <div className="tools-popover" onClick={(event) => event.stopPropagation()}>
              <p className="eyebrow">GRAPHS</p>
              <button className="current"><Grid3X3 size={18} /><span><strong>1 cm square grid</strong><small>Current tool</small></span><Check size={16} /></button>
              <p className="coming-soon">More booklet tools can be added here later.</p>
            </div>
          )}
          <div className={`save-indicator save-indicator--${saveState}`}><span />{saveMessage}</div>
        </div>
      </header>

      <main className="main-content">
        <section className="intro-row">
          <div><p className="eyebrow">GRAPHS · 1 CM SQUARE GRID</p><h1>Build a graph for Word</h1><p>Draw, adjust and copy a clean exam-style diagram.</p></div>
          <div className="privacy-note"><LockKeyhole size={15} /><span>Your diagram stays in this browser.</span></div>
        </section>

        <section className="workspace">
          <div className="editor-card">
            <Toolbar
              tool={tool}
              onToolChange={(next) => { setTool(next); setEquationOpen(false); setEditingEquationId(null); }}
              onEquation={() => openEquationEditor()}
              onUndo={undo}
              onRedo={redo}
              onReset={resetDiagram}
              canUndo={history.past.length > 0}
              canRedo={history.future.length > 0}
              copying={copying}
              onCopy={handleCopy}
              onToggleMenu={() => setExportMenuOpen((open) => !open)}
            />
            {exportMenuOpen && (
              <div className="export-menu" role="menu">
                <button role="menuitem" onClick={() => { downloadDiagramSvg(document); setExportMenuOpen(false); }}><Download size={17} /><span><strong>Download SVG</strong><small>Vector · best for resizing</small></span></button>
                <button role="menuitem" disabled={downloadingPng} onClick={handlePngDownload}>{downloadingPng ? <LoaderCircle className="spin" size={17} /> : <FileImage size={17} />}<span><strong>Download PNG</strong><small>600 ppi · print-ready image</small></span></button>
                <div className="export-menu-separator" role="separator" />
                <button className="export-help-item" role="menuitem" onClick={() => { setExportMenuOpen(false); setWordHelpOpen(true); }}><CircleHelp size={17} /><span><strong>First-time Word setup</strong><small>Keep pasted images at full quality</small></span></button>
              </div>
            )}
            <GraphCanvas
              document={document}
              tool={tool}
              onCommit={commit}
              onSelect={selectObject}
              onAxisAdjust={(axis, end, delta) => commit(adjustAxis(document, axis, end, delta))}
            />
          </div>

          <aside className="inspector-stack" aria-label="Graph settings">
            {equationOpen ? (
              <EquationPanel editing={editingStraight} onSubmit={submitEquation} onClose={() => { setEquationOpen(false); setEditingEquationId(null); }} />
            ) : (
              <ObjectInspector
                object={selectedObject}
                onUpdate={updateSelected}
                onDelete={() => commit(deleteSelectedObject(document))}
                onEditEquation={openEquationEditor}
              />
            )}
            <AxisSettings
              xScale={document.axes.x.unitsPerSquare}
              yScale={document.axes.y.unitsPerSquare}
              onChange={(axis: "x" | "y", value: UnitsPerSquare) => commit(setAxisScale(document, axis, value))}
            />
            <ObjectsPanel
              document={document}
              expanded={objectsExpanded}
              onToggle={() => setObjectsExpanded((open) => !open)}
              onSelect={(id) => {
                selectObject(id);
                setTool("select");
                setEquationOpen(false);
                setEditingEquationId(null);
              }}
            />
          </aside>
        </section>
      </main>

      {wordHelpOpen && (
        <div className="word-help-backdrop" onMouseDown={() => setWordHelpOpen(false)}>
          <section className="word-help-dialog" role="dialog" aria-modal="true" aria-labelledby="word-help-title" aria-describedby="word-help-description" onMouseDown={(event) => event.stopPropagation()}>
            <header>
              <div><p className="eyebrow">ONE-TIME SETUP</p><h2 id="word-help-title">Keep full image quality in Word</h2></div>
              <button className="word-help-dismiss" autoFocus aria-label="Close Word setup" onClick={() => setWordHelpOpen(false)}><X size={19} /></button>
            </header>
            <p id="word-help-description">Set this once in Windows desktop Word so pasted graphs keep all 600 pixels per inch.</p>
            <ol>
              <li>Open <strong>File › Options › Advanced</strong>.</li>
              <li>Find <strong>Image Size and Quality</strong> and choose <strong>All New Documents</strong>.</li>
              <li>Tick <strong>Do not compress images in file</strong>.</li>
              <li>Set <strong>Default resolution</strong> to <strong>High fidelity</strong>.</li>
            </ol>
            <div className="word-help-links">
              <a href="https://support.microsoft.com/en-au/office/change-the-default-resolution-for-inserting-pictures-in-office-f4aca5b4-6332-48c6-9488-bf5e0094a7d2" target="_blank" rel="noreferrer">Microsoft: change image resolution <ExternalLink size={14} aria-hidden="true" /></a>
              <a href="https://support.microsoft.com/en-au/office/turn-off-picture-compression-81a6b603-0266-4451-b08e-fc1bf58da658" target="_blank" rel="noreferrer">Microsoft: turn off compression <ExternalLink size={14} aria-hidden="true" /></a>
            </div>
            <button className="word-help-done" onClick={() => setWordHelpOpen(false)}>Done</button>
          </section>
        </div>
      )}

      {toast && (
        <div className={`toast toast--${toast.kind}`} role="status">
          <span className="toast-icon">{toast.kind === "success" ? <Check size={18} /> : <X size={18} />}</span>
          <span><strong>{toast.title}</strong><small>{toast.detail}</small></span>
          <button aria-label="Dismiss message" onClick={() => setToast(null)}><X size={16} /></button>
        </div>
      )}
      <div className="sr-only" aria-live="polite">{saveMessage}</div>
      <div className="sr-only" aria-live="polite">{document.objects.length} object{document.objects.length === 1 ? "" : "s"}</div>
    </div>
  );
}
