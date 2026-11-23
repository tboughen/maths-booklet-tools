import type { MenuKind } from "./site/EditorDownloadMenu";
import { ExampleGallery, ReturnToDiagram } from "./examples/ExampleGallery";
import { graphGallery } from "./examples/galleryCatalogue";
import { EditorFoot } from "./site/EditorFoot";
import { EditorHint } from "./site/EditorHint";
import { ResourceSaveStatus } from "./site/ResourceSaveStatus";
import { graphEnvelope, withGraphAbout, withGraphWorked, type GraphDocument } from "./domain/graphAbout";
import { useTitleNote } from "./site/TitleNote";
import { renderDiagramSvg } from "./export/svg";
import { useWorkedNotes } from "./site/WorkedNotes";
import { WORKED_STEP } from "./site/workedNotesData";
import { answerSize } from "./export/worked";
import { TITLE_NOTE_STEP } from "./site/titleNoteData";
import { useGraphDrafts } from "./components/useGraphDrafts";
import { newBrowserGraph } from "./domain/browserGraph";
import { ResourceSize } from "./site/ResourceSize";
import { formatResourceSize } from "./site/resourceSizeFormat";
import { getExportMetrics } from "./export/svg";
import { RatioDialog } from "./ratio-table/RatioDialog";
import { renderDiagramPng } from "./export/png";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Eye, X } from "lucide-react";
import { OptionsBox } from "./site/OptionsBox";
import { VisibilitySwitch } from "./site/VisibilitySwitch";
import { PupilSpaceHint } from "./site/LabelTargets";
import { FoldCard } from "./site/CardHelp";
import { commonVisibility } from "./editor-kit/visibility";
import { PageHeading, Panel } from "./site/PageHeading";
import { AxisSettings } from "./components/AxisSettings";
import { EquationPanel } from "./components/EquationPanel";
import { GraphCanvas } from "./components/GraphCanvas";
import { ObjectInspector } from "./components/ObjectInspector";
import { ObjectsPanel } from "./components/ObjectsPanel";
import { GraphTools } from "./components/GraphTools";
import { EditorToolbar } from "./site/EditorToolbar";
import "./site/settings-kit.css";
import "./graph-settings.css";
import { GraphExchange } from "./components/GraphExchange";
import {
  adjustAxis,
  cleanNumber,
  deleteSelectedObject,
  getBounds,
  getObjectById,
  getSelectedObject,
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
  downloadDiagramPdf,
  downloadDiagramPng,
  downloadDiagramSvg,
} from "./export/clipboard";
import { handleUndoKeys, useDocumentHistory, redoLabel as redoStepName, undoLabel as undoStepName } from "./editor-kit";


interface ToastState {
  kind: "success" | "error";
  title: string;
  detail: string;
}

function sameDocument(
  first: GraphDocument,
  second: GraphDocument,
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
  const {
    history,
    commit: record,
    replace: replacePresentDocument,
    undo: stepBack,
    redo: stepForward,
  } = useDocumentHistory<GraphDocument>(startup.document, {
    equals: sameDocument,
  });
  const [pendingReset, setPendingReset] = useState(false);
  // Stable, so the dialog's focus effect runs once rather than on every render.
  const cancelReset = useCallback(() => setPendingReset(false), []);
  const [pendingExample, setPendingExample] =
    useState<DiagramDocumentV1 | null>(null);
  const [tool, setTool] = useState<DrawingTool>("select");
  const [equationOpen, setEquationOpen] = useState(false);
  // The control that opened the equation form, so closing it can return focus there.
  const inspector = useRef<HTMLElement>(null),
    equationOpener = useRef<string | null>(null);
  const [equationRevision, setEquationRevision] = useState(0);
  const [editingEquationId, setEditingEquationId] = useState<string | null>(
    null,
  );
  const [objectsExpanded, setObjectsExpanded] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState<MenuKind | false>(false);
  const [copying, setCopying] = useState(false);
  const [saveState, setSaveState] = useState<"saving" | "saved" | "error">(
    "saved",
  );
  const [toast, setToast] = useState<ToastState | null>(null);
  const drafts = useGraphDrafts();
  const hasPendingDraft = drafts.hasPending;
  const [previewZoom, setPreviewZoom] = useState(0);
  // Told by the canvas once it has measured its space; 0 until then.
  const [viewScale, setViewScale] = useState(0);
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

  const commit = useCallback(
    (next: GraphDocument, label?: string) => record(next, label),
    [record],
  );

  const replaceWithoutHistory = replacePresentDocument;

  const undo = useCallback(() => {
    if (hasPendingDraft() || recoveryConflict) return;
    stepBack();
  }, [hasPendingDraft, recoveryConflict, stepBack]);

  const redo = useCallback(() => {
    if (hasPendingDraft() || recoveryConflict) return;
    stepForward();
  }, [hasPendingDraft, recoveryConflict, stepForward]);

  useEffect(() => {
    if (recoveryConflict) {
      setSaveState("error");
      return;
    }
    setSaveState("saving");
    const timeout = window.setTimeout(() => {
      try {
        const raw = localStorage.getItem(ENVELOPE_STORAGE_KEY),
          next = JSON.stringify(graphEnvelope(document));
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
      if (handleUndoKeys(event, { undo, redo })) return;
      if (event.key === "Escape") {
        setTool("select");
        setEquationOpen(false);
        setEditingEquationId(null);
        setExportMenuOpen(false);
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
      // A region follows its inequalities, so arrow keys leave it where it is.
      // A region follows its inequalities and an equation curve its equation, so arrow keys leave them.
      if (selectedObject.kind === "region" || selectedObject.kind === "function") return;
      const moved: GraphObject =
        selectedObject.kind === "polygon"
          ? {
              ...selectedObject,
              vertices: selectedObject.vertices.map((p) => ({
                x: cleanNumber(p.x + dx),
                y: cleanNumber(p.y + dy),
              })),
              ...(selectedObject.namePosition
                ? {
                    namePosition: {
                      x: cleanNumber(selectedObject.namePosition.x + dx),
                      y: cleanNumber(selectedObject.namePosition.y + dy),
                    },
                  }
                : {}),
            }
          : selectedObject.kind === "curve"
          ? {
              ...selectedObject,
              points: selectedObject.points.map((p) => ({ x: cleanNumber(p.x + dx), y: cleanNumber(p.y + dy) })),
              ...(selectedObject.namePosition
                ? { namePosition: { x: cleanNumber(selectedObject.namePosition.x + dx), y: cleanNumber(selectedObject.namePosition.y + dy) } }
                : {}),
            }
          : selectedObject.kind === "circle"
          ? {
              ...selectedObject,
              centre: { x: cleanNumber(selectedObject.centre.x + dx), y: cleanNumber(selectedObject.centre.y + dy) },
              ...(selectedObject.namePosition
                ? { namePosition: { x: cleanNumber(selectedObject.namePosition.x + dx), y: cleanNumber(selectedObject.namePosition.y + dy) } }
                : {}),
            }
          : selectedObject.kind === "reading"
          ? { ...selectedObject, at: { x: cleanNumber(selectedObject.at.x + dx), y: cleanNumber(selectedObject.at.y + dy) } }
          : selectedObject.kind === "point"
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

  // The selected object's options open in the box beside the graph (the usability rollout, 23 Nov 2026).
  // Choosing an object, by a click, the list or drawing it, opens the box; Escape or Close also clears the selection.
  const [boxOpen, setBoxOpen] = useState(false);
  const boxFocus = useRef(false);
  const lastSelected = useRef(document.selectedObjectId);
  useEffect(() => {
    if (document.selectedObjectId && document.selectedObjectId !== lastSelected.current) setBoxOpen(true);
    lastSelected.current = document.selectedObjectId;
  }, [document.selectedObjectId]);
  function closeBox(how: "escape" | "away" | "button") {
    if (how === "escape") drafts.clear();
    else if (hasPendingDraft()) return;
    setBoxOpen(false);
    boxFocus.current = false;
    if (how !== "away" && document.selectedObjectId) replaceWithoutHistory({ ...document, selectedObjectId: null });
  }
  /** Every object is drawn on both copies, or left for pupils to draw (drawn on the answers copy only). */
  const pupilsSee = commonVisibility(document.objects.map((o) => (o.answerOnly ? "hidden" : "show")));
  const drawnByPupils = document.objects.filter((o) => o.answerOnly).length;
  function setAllAnswerOnly(answerOnly: boolean) {
    if (locked()) return;
    const objects = document.objects.map((o) => {
      if (!!o.answerOnly === answerOnly) return o;
      const next = { ...o } as GraphObject;
      if (answerOnly) next.answerOnly = true;
      else delete next.answerOnly;
      return next;
    });
    commit({ ...document, objects }, answerOnly ? "pupils draw every object" : "draw every object");
  }
  /** Double-click an object with the Select tool: pupils draw it, or it is drawn again. */
  const latestDocument = useRef(document);
  latestDocument.current = document;
  function toggleAnswerOnly(id: string) {
    const current = latestDocument.current;
    const object = current.objects.find((o) => o.id === id);
    if (!object || locked()) return;
    const next = { ...object } as GraphObject;
    if (object.answerOnly) delete next.answerOnly;
    else next.answerOnly = true;
    commit(updateObject(current, next), object.answerOnly ? "draw the object" : "pupils draw the object");
  }

  /** Adds a right-angled triangle, named with the next free letter, for the user to edit. */
  function addShape() {
    if (locked()) return;
    const b = getBounds(document),
      ux = document.axes.x.unitsPerSquare,
      uy = document.axes.y.unitsPerSquare;
    const corner = (min: number, max: number, unit: number) =>
      cleanNumber(Math.max(min + unit, Math.min(unit, max - 4 * unit)));
    const x = corner(b.xMin, b.xMax, ux),
      y = corner(b.yMin, b.yMax, uy);
    const used = new Set(document.objects.map((o) => o.name));
    const name = [..."ABCDEFGHPQRST"].find((letter) => !used.has(letter));
    const shape: GraphObject = {
      id: makeId("polygon"),
      kind: "polygon",
      vertices: [
        { x, y },
        { x: cleanNumber(x + 3 * ux), y },
        { x, y: cleanNumber(y + 2 * uy) },
      ],
      ...(name ? { name } : {}),
    };
    commit({
      ...document,
      objects: [...document.objects, shape],
      selectedObjectId: shape.id,
    });
    setTool("select");
    setEquationOpen(false);
    setEditingEquationId(null);
  }

  /** Adds a graph through points for the teacher to edit: four points across the grid, joined. */
  function addCurve() {
    if (locked()) return;
    const b = getBounds(document);
    const at = (fx: number, fy: number) => ({ x: cleanNumber(b.xMin + (b.xMax - b.xMin) * fx), y: cleanNumber(b.yMin + (b.yMax - b.yMin) * fy) });
    const curve: GraphObject = { id: makeId("curve"), kind: "curve", points: [at(0.1, 0.2), at(0.35, 0.6), at(0.6, 0.6), at(0.9, 0.85)] };
    commit({ ...document, objects: [...document.objects, curve], selectedObjectId: curve.id });
    setTool("select");
    setEquationOpen(false);
    setEditingEquationId(null);
  }

  /** Adds y = x² across the grid for the teacher to retype. */
  function addFunction() {
    if (locked()) return;
    const curve: GraphObject = { id: makeId("function"), kind: "function", equation: { family: "polynomial", a: 1, b: 0, c: 0 } };
    commit({ ...document, objects: [...document.objects, curve], selectedObjectId: curve.id });
    setTool("select");
    setEquationOpen(false);
    setEditingEquationId(null);
  }

  /** Adds a circle centred on the origin (or the grid's middle) for the teacher to edit. */
  function addCircle() {
    if (locked()) return;
    const b = getBounds(document);
    const inside = (v: number, lo: number, hi: number) => (v >= lo && v <= hi ? v : cleanNumber((lo + hi) / 2));
    const centre = { x: inside(0, b.xMin, b.xMax), y: inside(0, b.yMin, b.yMax) };
    // The radius is a distance in data units on both axes, so the room is measured the same way.
    const room = Math.min(centre.x - b.xMin, b.xMax - centre.x, centre.y - b.yMin, b.yMax - centre.y);
    const radius = cleanNumber(Math.max(Math.min(document.axes.x.unitsPerSquare, document.axes.y.unitsPerSquare), room * 0.6));
    const circle: GraphObject = { id: makeId("circle"), kind: "circle", centre, radius };
    commit({ ...document, objects: [...document.objects, circle], selectedObjectId: circle.id });
    setTool("select");
    setEquationOpen(false);
    setEditingEquationId(null);
  }

  /** Adds reading lines at a point for the teacher to move onto the graph. */
  function addReading() {
    if (locked()) return;
    const b = getBounds(document);
    const reading: GraphObject = {
      id: makeId("reading"),
      kind: "reading",
      at: { x: cleanNumber((b.xMin + b.xMax) / 2), y: cleanNumber((b.yMin + b.yMax) / 2) },
      read: "y",
    };
    commit({ ...document, objects: [...document.objects, reading], selectedObjectId: reading.id });
    setTool("select");
    setEquationOpen(false);
    setEditingEquationId(null);
  }

  /** Adds an inequality region for the teacher to edit: y ≥ 1, x ≤ 3 and y < x + 1, named R. */
  function addRegion() {
    if (locked()) return;
    const used = new Set(document.objects.map((o) => o.name));
    const region: GraphObject = {
      id: makeId("region"),
      kind: "region",
      inequalities: ["y >= 1", "x <= 3", "y < x + 1"],
      shade: "wanted",
      boundaries: true,
      ...(used.has("R") ? {} : { name: "R" }),
    };
    commit({
      ...document,
      objects: [...document.objects, region],
      selectedObjectId: region.id,
    });
    setTool("select");
    setEquationOpen(false);
    setEditingEquationId(null);
  }

  function openEquationEditor(object?: StraightObject) {
    if (locked()) return;
    setEditingEquationId(object?.id ?? null);
    const opener = globalThis.document.activeElement;
    equationOpener.current =
      opener instanceof HTMLButtonElement && (inspector.current?.contains(opener) || opener.closest(".md-options-box"))
        ? (opener.textContent ?? "").trim()
        : null;
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
      setExportMenuOpen("download");
    } finally {
      setCopying(false);
    }
  }

  function resetDiagram() {
    if (locked()) return;
    const meaningfulDocument = { ...document, selectedObjectId: null };
    // The same in-page confirmation as every other editor; nothing to confirm for an untouched graph.
    if (!sameDocument(meaningfulDocument, newBrowserGraph()))
      setPendingReset(true);
    else confirmReset();
  }

  function confirmReset() {
    if (locked()) return;
    setPendingReset(false);
    commit(newBrowserGraph(), "reset diagram");
    setTool("select");
    setEquationOpen(false);
    setEditingEquationId(null);
    setExportMenuOpen(false);
    setObjectsExpanded(false);
  }

  const saveMessage = useMemo(() => {
    if (saveState === "saving") return "Saving…";
    if (saveState === "error") return "Not saved on device";
    return "Saved on this device";
  }, [saveState]);

  // U34: the title and note ride on the document as `about` and are saved at the envelope's top level.
  const titleNote = useTitleNote({
    active,
    about: document.about ?? {},
    disabled: blocked,
    onSave: (about) => commit(withGraphAbout(document, about), TITLE_NOTE_STEP),
  });
  // U116: worked notes ride the same way and print on the answers copy only.
  const worked = useWorkedNotes({
    active,
    notes: document.about?.worked ?? [],
    size: answerSize(renderDiagramSvg(document, "answer")),
    disabled: blocked,
    onSave: (notes) => commit(withGraphWorked(document, notes), WORKED_STEP),
  });
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
              examples={
                <ExampleGallery
                  examples={graphGallery}
                  active={active}
                  disabled={blocked}
                  onUse={(resource) => setPendingExample(resource)}
                  onWorked={(resource) => commit({ ...resource, selectedObjectId: null }, "use worked version")}
                />
              }
              onUndo={undo}
              onRedo={redo}
              onReset={resetDiagram}
              canUndo={!blocked && history.past.length > 0}
              undoLabel={undoStepName(history)}
              resetStep={history.resetStep}
              active={active}
              redoLabel={redoStepName(history)}
              canRedo={!blocked && history.future.length > 0}
              resetDisabled={blocked}
              exportDisabled={blocked}
              menuId="graph-downloads"
              busy={copying}
              onCopy={() => void handleCopy()}
              onCopyClipboard={() => void handleCopy(true)}
              menuOpen={exportMenuOpen}
              onMenuChange={setExportMenuOpen}
            />
            <GraphExchange
              document={document}
              about={titleNote.item}
              worked={worked.item}
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
                  label: "Download PDF (actual size)",
                  disabled: blocked,
                  action: () => {
                    if (locked())
                      throw Error("Apply or cancel unfinished input first.");
                    return downloadDiagramPdf(document);
                  },
                  success: "PDF download started.",
                },
              ]}
            />
            {titleNote.dialog}
            {worked.dialog}
            {drafts.pending && (
              <p className="graph-pending-note" role="status">
                Unapplied changes. Apply or cancel the unfinished field before
                exporting or changing this graph.
              </p>
            )}
            {/* A press on the graph moves the box to the object pressed rather than closing it (the stage is an options anchor). */}
              <GraphCanvas
                zoom={previewZoom}
                onScale={setViewScale}
                disabled={blocked}
                document={document}
                tool={tool}
                onCommit={(next) => act(() => commit(next))}
                onSelect={(id) => {
                  selectObject(id);
                  if (id && !locked()) setBoxOpen(true);
                }}
                onAxisAdjust={(axis, end, delta) =>
                  act(() => commit(adjustAxis(document, axis, end, delta)))
                }
                onDoubleClick={() => {
                  // The double-click's first press selected the object under it.
                  const id = latestDocument.current.selectedObjectId;
                  if (tool === "select" && id) toggleAnswerOnly(id);
                }}
              />
            {selectedObject && boxOpen && !equationOpen && (
              <OptionsBox
                anchor={
                  globalThis.document.querySelector<SVGElement>(`.graph-stage [data-object-id="${CSS.escape(selectedObject.id)}"]`) ??
                  globalThis.document.querySelector<SVGElement>(".graph-stage svg")
                }
                anchorKey={selectedObject.id}
                placeBy={globalThis.document.querySelector<HTMLElement>(".graph-stage svg") as HTMLElement | null}
                bounds={globalThis.document.querySelector<HTMLElement>(".graph-editor .editor-card")}
                takeFocus={boxFocus.current}
                title="Selected object"
                onClose={closeBox}
              >
                <div className="graph-box">
                  <ObjectInspector
                    drafts={drafts}
                    disabled={recoveryConflict || copying}
                    object={selectedObject}
                    onUpdate={updateSelected}
                    onDelete={() => commit(deleteSelectedObject(document))}
                    onEditEquation={openEquationEditor}
                    bounds={getBounds(document)}
                    objects={document.objects}
                    axes={document.axes}
                    onAdd={(added) => {
                      if (locked() || !added.length) return;
                      commit({ ...document, objects: [...document.objects, ...added], selectedObjectId: added[0].id });
                    }}
                  />
                </div>
              </OptionsBox>
            )}
            <EditorFoot
              zoom={previewZoom}
              onZoom={setPreviewZoom}
              scale={viewScale}
              size={
                <ResourceSize
                  width={exportMetrics.widthCm}
                  height={exportMetrics.heightCm}
                />
              }
              hint={
                <EditorHint tool="graph">
                  Choose a tool, then click or drag on the grid. Click a line,
                  segment or cross to change it. Blue handles are never copied.
                </EditorHint>
              }
            />
          </Panel>

          <aside
            ref={inspector}
            className="inspector-stack md-kit md-kit--one"
            aria-label="Graph settings"
          >
            <ReturnToDiagram />
            {/* On a wide screen: what is selected on the left with the list of objects under it, and the drawing
                tools, the axes and printing on the right (settings-kit.css). The list comes last, as it always has. */}
            {/* One folding column (the usability rollout, 23 Nov 2026): what pupils see, the drawing tools,
                the equation form when it is open, the axes, printing, then the list of objects. */}
            <div className="md-kit-cards">
            <div>
            {document.objects.length > 0 && (
              <FoldCard
                tool="graph"
                title="What pupils see"
                icon={Eye}
                defaultOpen
                summary={pupilsSee === "show" ? "Every object is drawn" : pupilsSee === "hidden" ? "Pupils draw every object" : "Pupils draw some objects"}
                help="An object is drawn, or left for pupils to draw (the answers copy draws it). Double-click an object on the graph for its own choice."
              >
                <VisibilitySwitch
                  name="Objects"
                  caption="Objects"
                  choices={["show", "hidden"]}
                  disabled={blocked}
                  value={pupilsSee ?? "show"}
                  help={{ hidden: "Pupils draw it. The answers copy draws it." }}
                  onChange={(v) => setAllAnswerOnly(v === "hidden")}
                />
                <PupilSpaceHint count={drawnByPupils} disabled={blocked} onClear={() => setAllAnswerOnly(false)}>
                  Double-click a point, line or shape on the graph for pupils to draw it.
                </PupilSpaceHint>
              </FoldCard>
            )}
            {equationOpen && (
              <EquationPanel
                key={`${editingEquationId ?? "new"}-${equationRevision}`}
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
                  // Return focus to the control that opened the form ("Line by equation" or
                  // "Edit equation"; the latter is re-rendered, so it is found again by its text).
                  const opener = equationOpener.current;
                  equationOpener.current = null;
                  if (active && opener)
                    requestAnimationFrame(() =>
                      // Edit equation is in the box beside the graph, Line by equation in the settings.
                      [...(inspector.current?.querySelectorAll("button") ?? []), ...globalThis.document.querySelectorAll<HTMLButtonElement>(".md-options-box button")]
                        .find((button) => button.textContent?.trim() === opener)
                        ?.focus(),
                    );
                }}
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
                onShape={addShape}
                onRegion={addRegion}
                onCurve={addCurve}
                onReading={addReading}
                onCircle={addCircle}
                onFunction={addFunction}
              />
            </fieldset>
            </div>
            <div>
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
            </div>
            <div>
            <fieldset className="graph-control-group" disabled={blocked}>
              <ObjectsPanel
                document={document}
                expanded={objectsExpanded}
                onToggle={() => setObjectsExpanded((open) => !open)}
                onSelect={(id) => {
                  if (locked()) return;
                  selectObject(id);
                  boxFocus.current = true;
                  setBoxOpen(true);
                  setTool("select");
                  setEquationOpen(false);
                  setEditingEquationId(null);
                }}
              />
            </fieldset>
            </div>
            </div>
          </aside>
        </section>
      </main>

      {active && pendingReset && (
        <RatioDialog
          title="Reset the diagram?"
          confirmLabel="Reset diagram"
          onCancel={cancelReset}
          disabled={blocked}
          onConfirm={confirmReset}
        >
          This clears the grid settings and all objects. You can undo it.
        </RatioDialog>
      )}

      {active && pendingExample && (
        <RatioDialog
          title="Replace with this graph example?"
          confirmLabel="Replace graph"
          onCancel={() => setPendingExample(null)}
          disabled={blocked}
          onConfirm={() => {
            if (locked()) return;
            commit({ ...pendingExample, selectedObjectId: null }, "replace with example");
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
