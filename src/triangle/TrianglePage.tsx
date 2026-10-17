import { fitResource } from "../site/useResourceFit";
import { ExampleGallery } from "../examples/ExampleGallery";
import { triangleGallery } from "../examples/galleryCatalogue";
import { openWorkedDocument, copyStorageKey } from "../site/copyDocument";
import { PreviewControls } from "../site/PreviewControls";
import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  addHeight,
  addTriangle,
  allLabels,
  canonical,
  caption,
  create,
  editLabel,
  getLabel,
  isStale,
  layout,
  moveVertex,
  nameOf,
  numeric,
  parseFile,
  point,
  refName,
  removeSecond,
  setConstraint,
  textOf,
  transform,
  validate,
  warnings,
  workedCopy,
  type Envelope,
  type Metrics,
  type Point,
} from "../../packages/triangle-core/src";
import {
  sourceExamples,
  teachingExamples,
} from "../../packages/triangle-core/src/examples";
import { EditorToolbar } from "../site/EditorToolbar";
import {
  EditorDownloadMenu,
  LINK_DESCRIPTION,
} from "../site/EditorDownloadMenu";
import { PageHeading, Panel } from "../site/PageHeading";
import { ResourceSize } from "../site/ResourceSize";
import { ResourceSaveStatus } from "../site/ResourceSaveStatus";
import { formatResourceSize } from "../site/resourceSizeFormat";
import { RatioDialog } from "../ratio-table/RatioDialog";
import { copyPngToClipboard, downloadBlob } from "../export/clipboard";
import { copyWord, downloadEditable, downloadImage, printPng } from "./export";
import { parseTriangleLink, triangleEditorLink } from "./links";
import { TriangleFloatingEditor } from "./TriangleFloatingEditor";
import { TriangleLabelFields } from "./TriangleLabelFields";
import {
  labelDraft,
  applyLabelDraft,
  type LabelDraft as Draft,
} from "./labelDraft";
import { MathsPanel } from "./MathsPanel";
import { ConstructionPanel } from "./ConstructionPanel";
import {
  geometryHits,
  angleWedge,
  triangleCentre,
  objectName,
  objects,
  oppositeEdge,
  owningTriangles,
  triangleName,
  vertexHandleClip,
} from "./interaction";
import { ContextCalculation } from "./ContextCalculation";
import "./triangle.css";

const STORAGE = copyStorageKey("maths-booklet-tools:triangle:v1"),
  COPY_CONTEXT = STORAGE + ":copy-context";
function initial() {
  let key = STORAGE,
    copyId = "";
  try {
    const fromUrl =
        new URL(location.href).searchParams.get("triangleCopy") ?? "",
      fromSession = sessionStorage.getItem(COPY_CONTEXT) ?? "";
    copyId = /^[a-f0-9-]{36}$/.test(fromUrl)
      ? fromUrl
      : /^[a-f0-9-]{36}$/.test(fromSession)
        ? fromSession
        : "";
    if (copyId) {
      key += ":copy:" + copyId;
      sessionStorage.setItem(COPY_CONTEXT, copyId);
    }
    const raw = localStorage.getItem(key);
    if (copyId && fromUrl && location.hash.startsWith("#triangle="))
      return {
        key,
        copyId,
        e: parseTriangleLink(location.href),
        raw,
        recovery: null as string | null,
        message:
          "Worked copy. The original pupil resource stays in its own tab.",
        consume: true,
      };
    if (raw) {
      try {
        return {
          key,
          copyId,
          e: parseFile(raw),
          raw,
          recovery: null as string | null,
          message: "",
          consume: false,
        };
      } catch {
        return {
          key,
          copyId,
          e: create(),
          raw,
          recovery: raw,
          message:
            "Saved triangle data needs recovery. Its original data is protected.",
          consume: false,
        };
      }
    }
    return {
      key,
      copyId,
      e: create(),
      raw,
      recovery: null as string | null,
      message: "",
      consume: false,
    };
  } catch {
    return {
      key,
      copyId,
      e: create(),
      raw: null,
      recovery: null as string | null,
      message:
        "Device storage is unavailable. Save an editable file to keep your work.",
      consume: false,
    };
  }
}
type Drag = {
  kind: "vertex" | "label";
  id: string;
  start: Point;
  original: Envelope;
  metrics: Metrics;
  zoom: number;
  rect: DOMRect;
  moved: boolean;
  pointerId: number;
  threshold: number;
  latest: Envelope | null;
};
type Replacement = { e: Envelope; title: string; explanation: string };
const errorText = (err: unknown) =>
  err instanceof Error ? err.message : String(err);
export default function TrianglePage({ active = true }: { active?: boolean }) {
  const [startup] = useState(initial),
    [history, setHistory] = useState<{
      past: Envelope[];
      present: Envelope;
      future: Envelope[];
    }>({ past: [], present: startup.e, future: [] });
  const [recovery, setRecovery] = useState(startup.recovery),
    [protectedCopy, setProtectedCopy] = useState(false),
    [recoveryConfirm, setRecoveryConfirm] = useState(false),
    [saveState, setSaveState] = useState("Saved on this device"),
    [message, setMessage] = useState(startup.message),
    [selected, setSelected] = useState<string | null>(null),
    [draft, setDraft] = useState<Draft | null>(null),
    [draftError, setDraftError] = useState(""),
    [pending, setPending] = useState<Replacement | null>(null),
    [busy, setBusy] = useState(false),
    [menu, setMenu] = useState(false),
    [showAnswers, setShowAnswers] = useState(false),
    [structure, setStructure] = useState<{
      kind: "joined" | "split";
      edge: string;
      apex: string;
    } | null>(null),
    [choices, setChoices] = useState<string[]>([]),
    [editChoice, setEditChoice] = useState(false),
    [hoverAngle, setHoverAngle] = useState<string | null>(null),
    [calcTarget, setCalcTarget] = useState<string | null>(null),
    [hoverTriangle, setHoverTriangle] = useState<string | null>(null),
    [zoom, setZoom] = useState("fit"),
    [available, setAvailable] = useState(600),
    [availableHeight, setAvailableHeight] = useState(400),
    [dragged, setDragged] = useState<Envelope | null>(null),
    [widthDraft, setWidthDraft] = useState<string | null>(null),
    [positionDraft, setPositionDraft] = useState<{
      id: string;
      x: string;
      y: string;
    } | null>(null),
    [fieldError, setFieldError] = useState(""),
    [triangleId, setTriangleId] = useState(startup.e.document.triangles[0].id),
    [vertexId, setVertexId] = useState(startup.e.document.vertices[0].id);
  const expected = useRef(startup.raw),
    file = useRef<HTMLInputElement>(null),
    scroll = useRef<HTMLDivElement>(null),
    resource = useRef<HTMLDivElement>(null),
    drag = useRef<Drag | null>(null),
    suppressClick = useRef(false),
    touchHistory = useRef<{
      pointerId: number;
      start: Point;
      button: HTMLButtonElement;
      action: "Undo" | "Redo";
      moved: boolean;
    } | null>(null),
    handledTouchHistory = useRef<number | null>(null),
    structureControls = useRef<HTMLDivElement>(null),
    draftRef = useRef(draft),
    committed = useRef(startup.e),
    linkSeen = useRef(""),
    linkPending = useRef(false),
    initialCopy = useRef(startup.consume);
  draftRef.current = draft;
  const e = history.present,
    d = e.document,
    structurePreview = structure
      ? addTriangle(
          e,
          structure.kind,
          structure.kind === "split"
            ? oppositeEdge(e, structure.apex)
            : structure.edge,
        )
      : null,
    display = structurePreview ?? dragged ?? e,
    g = layout(display, showAnswers),
    exportMetrics = layout(e),
    pendingInput =
      draft !== null || widthDraft !== null || positionDraft !== null,
    labelBlocked =
      busy ||
      recovery !== null ||
      widthDraft !== null ||
      positionDraft !== null ||
      pending !== null ||
      recoveryConfirm ||
      dragged !== null ||
      structure !== null,
    blocked = labelBlocked || draft !== null;
  committed.current = e;
  const viewScale =
      zoom === "fit"
        ? fitResource(
            (g.width * 96) / 25.4,
            (g.height * 96) / 25.4,
            available,
            availableHeight,
            48,
            48,
          )
        : Number(zoom),
    px = (96 / 25.4) * viewScale;
  const labels = allLabels(e),
    chosen = labels.find((v) => v.ref === selected),
    selectedLabel = chosen?.label,
    t = d.triangles.find((t) => t.id === triangleId) ?? d.triangles[0],
    v = d.vertices.find((v) => v.id === vertexId) ?? d.vertices[0];
  const currentExample = [...sourceExamples, ...teachingExamples].find(
      (ex) => ex.sourceId && ex.sourceId === d.sourceId,
    ),
    notes = warnings(e);
  function commit(next: Envelope) {
    if (recovery !== null) return;
    const n = validate(next);
    committed.current = n;
    setHistory((h) =>
      canonical(h.present) === canonical(n)
        ? h
        : { past: [...h.past, h.present].slice(-60), present: n, future: [] },
    );
    setChoices([]);
    if (selected && !objects(n).some((o) => o.ref === selected))
      setSelected(null);
    if (calcTarget && !objects(n).some((o) => o.ref === calcTarget))
      setCalcTarget(null);
    setMessage("");
  }
  function selectObject(ref: string | null) {
    if (blocked) return;
    setSelected(ref);
    setChoices([]);
    if (!ref) return;
    if (ref.startsWith("v:")) setVertexId(ref.slice(2));
    const owners = owningTriangles(e, ref);
    if (owners.length === 1 || !owners.some((t) => t.id === triangleId))
      setTriangleId(owners[0]?.id ?? d.triangles[0].id);
    if (
      ref.startsWith("t:") &&
      owners[0] &&
      !owners[0].vertices.includes(vertexId)
    )
      setVertexId(owners[0].vertices[0]);
  }
  function choose(refs: string[], edit = false) {
    if (blocked && (!edit || labelBlocked)) return;
    if (edit && refs.length === 1 && draftRef.current?.ref === refs[0]) return;
    if (edit && draftRef.current && !applyDraft()) return;
    if (refs.length > 1) {
      setChoices(refs);
      setEditChoice(edit);
      return;
    }
    if (edit && refs[0]) open(refs[0]);
    else selectObject(refs[0] ?? null);
  }
  function beginStructure(kind: "joined" | "split") {
    if (blocked || d.layout !== "single") return;
    const apex = selected?.startsWith("v:")
      ? selected.slice(2)
      : d.triangles[0].vertices[0];
    const edge = selected?.startsWith("e:") ? selected.slice(2) : d.edges[0].id;
    setStructure({ kind, edge, apex });
    setChoices([]);
    requestAnimationFrame(() =>
      structureControls.current
        ?.querySelector<HTMLSelectElement>("select")
        ?.focus({ preventScroll: true }),
    );
  }
  function cancelDrag() {
    if (drag.current?.moved) suppressClick.current = true;
    drag.current = null;
    setDragged(null);
  }
  function change(update: (n: Envelope) => void) {
    if (blocked) return;
    try {
      const n = structuredClone(e);
      update(n);
      commit(n);
    } catch (err) {
      setMessage(errorText(err));
    }
  }
  function operation(update: () => Envelope) {
    if (blocked) return;
    try {
      commit(update());
    } catch (err) {
      setMessage(errorText(err));
    }
  }
  function replacement(
    next: Envelope,
    title: string,
    explanation = "This replaces the current diagram. You can undo the replacement.",
  ) {
    if (!blocked) setPending({ e: next, title, explanation });
  }
  function undo() {
    if (blocked) return;
    setHistory((h) =>
      h.past.length
        ? {
            past: h.past.slice(0, -1),
            present: h.past[h.past.length - 1],
            future: [h.present, ...h.future],
          }
        : h,
    );
    setSelected(null);
    setShowAnswers(false);
  }
  function redo() {
    if (blocked) return;
    setHistory((h) =>
      h.future.length
        ? {
            past: [...h.past, h.present],
            present: h.future[0],
            future: h.future.slice(1),
          }
        : h,
    );
    setSelected(null);
    setShowAnswers(false);
  }
  function closeDraft() {
    const ref = draftRef.current?.ref;
    draftRef.current = null;
    setDraft(null);
    setDraftError("");
    if (active && ref)
      requestAnimationFrame(() => {
        if (document.activeElement !== document.body) return;
        document
          .querySelector<HTMLButtonElement>(`[data-tr-anchor="${ref}"]`)
          ?.focus({ preventScroll: true });
      });
  }
  function open(ref: string) {
    if (labelBlocked) return;
    let source = committed.current;
    if (draftRef.current) {
      if (draftRef.current.ref === ref) return;
      const next = applyDraft();
      if (!next) return;
      source = next;
    }
    const next = labelDraft(source, ref);
    draftRef.current = next;
    setDraft(next);
    setDraftError("");
    setSelected(ref);
    setChoices([]);
  }
  function applyDraft(): Envelope | null {
    const current = draftRef.current;
    if (!current || recovery !== null) return null;
    try {
      const n = applyLabelDraft(committed.current, current);
      commit(n);
      closeDraft();
      return n;
    } catch (err) {
      setDraftError(errorText(err));
      return null;
    }
  }
  function updateDraft(update: Partial<Draft>) {
    setDraft((old) => {
      if (!old) return old;
      const n = { ...old, ...update };
      draftRef.current = n;
      return n;
    });
    setDraftError("");
  }
  async function run(action: () => Promise<void>, success: string) {
    if (blocked || exportMetrics.issues.length) return;
    setBusy(true);
    setMessage("");
    try {
      await action();
      setMessage(success);
    } catch (err) {
      setMessage(errorText(err));
    } finally {
      setBusy(false);
    }
  }
  function fork(next: Envelope) {
    if (blocked) return;
    try {
      const url = new URL(triangleEditorLink(workedCopy(next), location.href));
      url.searchParams.set("triangleCopy", crypto.randomUUID());
      const child = window.open("about:blank", "_blank");
      if (!child)
        throw Error(
          "The browser blocked a new tab. Allow this site's worked-copy tab, or save an editable file.",
        );
      child.opener = null;
      child.location.href = url.href;
      setMessage(
        "Worked copy opened in a separate tab. This pupil resource is unchanged.",
      );
    } catch (err) {
      setMessage(errorText(err));
    }
  }
  function dragStart(
    event: ReactPointerEvent<HTMLButtonElement>,
    kind: Drag["kind"],
    id: string,
  ) {
    if (blocked || !resource.current || event.button !== 0 || !event.isPrimary)
      return;
    suppressClick.current = false;
    if (event.pointerType !== "touch")
      event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = {
      kind,
      id,
      start: { x: event.clientX, y: event.clientY },
      original: e,
      metrics: g,
      zoom: px,
      rect: resource.current.getBoundingClientRect(),
      moved: false,
      pointerId: event.pointerId,
      threshold: event.pointerType === "touch" ? 8 : 4,
      latest: null,
    };
  }
  function dragMove(event: ReactPointerEvent<HTMLButtonElement>) {
    const start = drag.current;
    if (!start || start.pointerId !== event.pointerId) return;
    const dx = event.clientX - start.start.x,
      dy = event.clientY - start.start.y;
    if (!start.moved && Math.hypot(dx, dy) < start.threshold) return;
    start.moved = true;
    suppressClick.current = true;
    setSelected(start.kind === "vertex" ? `v:${start.id}` : start.id);
    if (start.kind === "vertex") setVertexId(start.id);
    try {
      const original =
        start.kind === "vertex" ? point(start.original, start.id) : null;
      const label =
        start.kind === "label" ? getLabel(start.original, start.id) : null;
      const next = original
        ? moveVertex(start.original, start.id, {
            x: original.x + dx / (start.zoom * start.metrics.scale),
            y: original.y + dy / (start.zoom * start.metrics.scale),
          })
        : editLabel(start.original, start.id, {
            dx: label!.dx + dx / start.zoom,
            dy: label!.dy + dy / start.zoom,
          });
      start.latest = next;
      setDragged(next);
      setMessage("");
    } catch (err) {
      setMessage(errorText(err));
    }
  }
  function dragEnd(event: ReactPointerEvent<HTMLButtonElement>) {
    const start = drag.current;
    if (!start || start.pointerId !== event.pointerId) return;
    if (start.moved) dragMove(event);
    const next = start.latest;
    drag.current = null;
    if (
      event.pointerType !== "touch" &&
      event.currentTarget.hasPointerCapture(event.pointerId)
    )
      event.currentTarget.releasePointerCapture(event.pointerId);
    if (start.moved) {
      suppressClick.current = true;
      if (next) commit(next);
    }
    setDragged(null);
  }
  function consumeLink() {
    if (linkPending.current && location.hash.startsWith("#triangle="))
      window.history.replaceState(
        null,
        "",
        location.pathname + location.search,
      );
    linkPending.current = false;
    linkSeen.current = "";
  }
  async function importFile(upload: File) {
    try {
      if (upload.size > 64000)
        throw Error("This editable file is larger than 64 KiB.");
      const incoming = parseFile(await upload.text());
      replacement(incoming, "Open this triangle diagram?");
    } catch (err) {
      setMessage(errorText(err));
    }
  }
  useEffect(() => {
    const el = scroll.current;
    if (!el) return;
    const measure = () => {
      setAvailable(el.clientWidth);
      const footerHeight =
        el.parentElement
          ?.querySelector(".tr-structure")
          ?.getBoundingClientRect().height ?? 70;
      setAvailableHeight(
        Math.max(
          260,
          Math.min(
            innerHeight * 0.65,
            innerHeight - el.getBoundingClientRect().top - footerHeight - 24,
          ),
        ),
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    if (el.parentElement) observer.observe(el.parentElement);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);
  useEffect(() => {
    if (recovery !== null) return;
    try {
      const raw = localStorage.getItem(startup.key),
        text = canonical(history.present);
      if (raw !== expected.current && raw !== text) {
        setRecovery(raw ?? "");
        setProtectedCopy(false);
        setMessage(
          "A different draft exists in another tab. Its saved data is protected.",
        );
        return;
      }
      if (raw !== text) localStorage.setItem(startup.key, text);
      expected.current = text;
      setSaveState("Saved on this device");
    } catch {
      setSaveState("Save unavailable — download editable file");
    }
  }, [history.present, recovery, startup.key]);
  useEffect(() => {
    const listener = (event: StorageEvent) => {
      if (event.key === startup.key && event.newValue !== expected.current) {
        setRecovery(event.newValue ?? "");
        setProtectedCopy(false);
        setMessage(
          "Saved triangle data changed in another tab. Download its data before replacing it.",
        );
      }
    };
    window.addEventListener("storage", listener);
    return () => window.removeEventListener("storage", listener);
  }, [startup.key]);
  useEffect(() => {
    if (!active) return;
    const key = (event: KeyboardEvent) => {
      if (document.querySelector('[aria-modal="true"]')) return;
      if (
        event.key === "Escape" &&
        (drag.current || structure || choices.length)
      ) {
        event.preventDefault();
        if (choices.length) setChoices([]);
        else if (drag.current) cancelDrag();
        else {
          setStructure(null);
          requestAnimationFrame(() =>
            structureControls.current
              ?.querySelector<HTMLButtonElement>("button")
              ?.focus(),
          );
        }
        return;
      }
      if (event.key === "Escape" && draftRef.current) {
        event.preventDefault();
        closeDraft();
        return;
      }
      if (
        event.target instanceof HTMLElement &&
        event.target.closest("input,textarea,select,[contenteditable]")
      )
        return;
      if (event.ctrlKey || event.metaKey) {
        if (event.key.toLowerCase() === "z") {
          event.preventDefault();
          if (event.shiftKey) redo();
          else undo();
        }
        if (event.key.toLowerCase() === "y") {
          event.preventDefault();
          redo();
        }
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });
  useEffect(() => {
    if (!active) return;
    if (initialCopy.current) {
      initialCopy.current = false;
      if (location.hash.startsWith("#triangle="))
        window.history.replaceState(
          null,
          "",
          location.pathname + location.search,
        );
    }
    const inspect = () => {
      if (
        !location.hash.startsWith("#triangle=") ||
        linkSeen.current === location.href ||
        blocked
      )
        return;
      linkSeen.current = location.href;
      try {
        const incoming = parseTriangleLink(location.href);
        linkPending.current = true;
        replacement(incoming, "Open the linked triangle diagram?");
      } catch (err) {
        setMessage(errorText(err));
      }
    };
    inspect();
    window.addEventListener("hashchange", inspect);
    return () => window.removeEventListener("hashchange", inspect);
  });
  useEffect(() => {
    if (!active) {
      setMenu(false);
      cancelDrag();
    }
  }, [active]);
  useEffect(() => {
    const cancel = () => cancelDrag();
    window.addEventListener("blur", cancel);
    return () => window.removeEventListener("blur", cancel);
  }, []);
  return (
    <div
      className="app-shell booklet-editor tr-editor"
      onPointerDownCapture={(event) => {
        if (event.pointerType !== "touch" || !event.isPrimary) return;
        handledTouchHistory.current = null;
        const button = (event.target as Element).closest<HTMLButtonElement>(
          ".editor-toolbar button",
        );
        const action = button?.getAttribute("aria-label");
        touchHistory.current =
          button && !button.disabled && (action === "Undo" || action === "Redo")
            ? {
                pointerId: event.pointerId,
                start: { x: event.clientX, y: event.clientY },
                button,
                action,
                moved: false,
              }
            : null;
      }}
      onPointerMoveCapture={(event) => {
        const start = touchHistory.current;
        if (
          start &&
          start.pointerId === event.pointerId &&
          Math.hypot(
            event.clientX - start.start.x,
            event.clientY - start.start.y,
          ) > 8
        )
          start.moved = true;
      }}
      onPointerCancelCapture={() => {
        touchHistory.current = null;
      }}
      onPointerUpCapture={(event) => {
        const start = touchHistory.current;
        if (!start || start.pointerId !== event.pointerId) return;
        touchHistory.current = null;
        const r = start.button.getBoundingClientRect();
        if (
          start.moved ||
          start.button.disabled ||
          event.clientX < r.left ||
          event.clientX > r.right ||
          event.clientY < r.top ||
          event.clientY > r.bottom
        )
          return;
        handledTouchHistory.current = event.pointerId;
        if (start.action === "Undo") undo();
        else redo();
      }}
      onClickCapture={(event) => {
        const pointer = event.nativeEvent as PointerEvent;
        if (
          pointer.pointerType === "touch" &&
          pointer.pointerId === handledTouchHistory.current
        ) {
          handledTouchHistory.current = null;
          event.preventDefault();
          event.stopPropagation();
        }
      }}
    >
      <main
        className="main-content"
        id={active ? "main-content" : undefined}
        tabIndex={-1}
      >
        <PageHeading
          title="Triangles"
          description={
            startup.copyId
              ? "Worked copy — your original pupil resource stays in its own tab."
              : "Create triangle diagrams for Pythagoras, trigonometry, sine rule, cosine rule and area."
          }
        >
          <ResourceSaveStatus text={saveState} />
        </PageHeading>
        <section className="workspace">
          <Panel className="editor-card">
            <EditorToolbar
              canUndo={!blocked && history.past.length > 0}
              canRedo={!blocked && history.future.length > 0}
              onUndo={undo}
              onRedo={redo}
              onReset={() =>
                replacement(create(), "Reset the triangle diagram?")
              }
              resetDisabled={blocked}
              exportDisabled={blocked || !!exportMetrics.issues.length}
              menuDisabled={blocked}
              busy={busy}
              onCopyClipboard={() =>
                void run(
                  () => copyPngToClipboard(() => printPng(e)),
                  "Image copied. Paste with Ctrl+V.",
                )
              }
              onCopy={() =>
                void run(
                  () => copyWord(e),
                  `Copied for Word at ${formatResourceSize(exportMetrics.width / 10, exportMetrics.height / 10)}. Paste with Ctrl+V.`,
                )
              }
              menuId="triangle-downloads"
              menuOpen={menu}
              onToggleMenu={() => setMenu(!menu)}
            />
            <EditorDownloadMenu
              id="triangle-downloads"
              open={menu}
              active={active}
              onClose={() => setMenu(false)}
              onBusyChange={setBusy}
              onMessage={setMessage}
              actions={[
                {
                  label: "Download SVG",
                  action: () => downloadImage(e, "svg"),
                  disabled: blocked || !!exportMetrics.issues.length,
                  success: "SVG download started.",
                },
                {
                  label: "Download PNG (600 ppi)",
                  action: () => downloadImage(e, "png"),
                  disabled: blocked || !!exportMetrics.issues.length,
                  success: "PNG download started.",
                },
                {
                  label: "Save editable file",
                  action: () => downloadEditable(e),
                  disabled: blocked,
                  success: "Editable file download started.",
                  separator: true,
                },
                {
                  label: "Open editable file",
                  action: () => file.current?.click(),
                  disabled: blocked,
                  picker: true,
                  success: "",
                },
                {
                  label: "Copy editable link",
                  action: () =>
                    navigator.clipboard.writeText(
                      triangleEditorLink(e, location.href),
                    ),
                  description: LINK_DESCRIPTION,
                  disabled: blocked,
                  success:
                    "Editable link copied, including any hidden answers.",
                },
              ]}
            />
            <input
              className="tr-file"
              ref={file}
              type="file"
              accept=".json,application/json"
              aria-label="Open triangle editable file"
              onChange={(ev) => {
                const upload = ev.target.files?.[0];
                ev.currentTarget.value = "";
                if (upload && !blocked) void importFile(upload);
              }}
            />
            <div className="tr-preview-bar">
              <PreviewControls
                zoom={zoom === "fit" ? 0 : Number(zoom)}
                onZoom={(value) => setZoom(value ? String(value) : "fit")}
              />

              <label>
                <input
                  type="checkbox"
                  checked={showAnswers}
                  disabled={blocked}
                  onChange={(ev) => setShowAnswers(ev.target.checked)}
                />{" "}
                Show saved answers
              </label>
              <ResourceSize
                width={exportMetrics.width / 10}
                height={exportMetrics.height / 10}
              />
              <button
                disabled={blocked || !labels.some((v) => v.label.answer)}
                onClick={() => fork(e)}
              >
                Open worked copy
              </button>
            </div>
            {showAnswers && (
              <p className="tr-banner">
                Answer preview only. Copy and image downloads use saved pupil
                visibility. Open a worked copy to export the answers.
              </p>
            )}
            <p className="tr-guidance">
              Click a wedge to edit an angle, or a label to edit its text. Drag
              a vertex to reshape. Select a triangle to add its area.
            </p>
            <div
              className="tr-scroll"
              ref={scroll}
              style={{ maxHeight: availableHeight }}
            >
              <div
                className="tr-stage"
                style={{
                  width: Math.max(g.width * px, available - 48),
                  minHeight: g.height * px,
                }}
              >
                <div
                  className="tr-resource"
                  ref={resource}
                  style={{ width: g.width * px, height: g.height * px }}
                  onClick={(event) => {
                    if (event.target === event.currentTarget && !draft)
                      setSelected(null);
                  }}
                >
                  <div
                    className="tr-art"
                    dangerouslySetInnerHTML={{ __html: g.svg }}
                  />
                  <svg
                    className="tr-geometry"
                    viewBox={`0 0 ${g.width} ${g.height}`}
                    aria-label="Triangle angle controls"
                    onClick={(ev) => {
                      if (labelBlocked) return;
                      const r = resource.current!.getBoundingClientRect();
                      const refs = geometryHits(
                        e,
                        g,
                        {
                          x: (ev.clientX - r.left) / px,
                          y: (ev.clientY - r.top) / px,
                        },
                        7 / px,
                      );
                      choose(
                        refs,
                        refs.length > 0 &&
                          refs.every((ref) => ref.startsWith("a:")),
                      );
                    }}
                    onPointerMove={(ev) => {
                      if (ev.pointerType === "touch") return;
                      if (blocked) return;
                      const r = resource.current!.getBoundingClientRect();
                      const refs = geometryHits(
                        e,
                        g,
                        {
                          x: (ev.clientX - r.left) / px,
                          y: (ev.clientY - r.top) / px,
                        },
                        4 / px,
                      );
                      setHoverAngle(
                        refs.length === 1 && refs[0].startsWith("a:")
                          ? refs[0]
                          : null,
                      );
                    }}
                    onPointerLeave={() => setHoverAngle(null)}
                  >
                    <rect
                      width={g.width}
                      height={g.height}
                      fill="transparent"
                    />
                    {display.document.triangles
                      .filter(
                        (t) =>
                          `t:${t.id}` === selected ||
                          t.id === hoverTriangle ||
                          (structure &&
                            t.id !== d.triangles[0].id &&
                            t.role === "component"),
                      )
                      .map((t) => (
                        <polygon
                          key={t.id}
                          points={t.vertices
                            .map(
                              (id) => `${g.vertices[id].x},${g.vertices[id].y}`,
                            )
                            .join(" ")}
                          className={
                            structure ? "tr-proposed" : "tr-triangle-selection"
                          }
                        />
                      ))}
                    {!structure &&
                      d.angles.map((a) => {
                        const ref = "a:" + a.id;
                        return (
                          <polygon
                            key={ref}
                            points={angleWedge(e, g, ref)!}
                            className={
                              "tr-angle-target" +
                              (hoverAngle === ref ? " tr-angle-active" : "")
                            }
                            data-tr-anchor={ref}
                            role="button"
                            tabIndex={labelBlocked ? -1 : 0}
                            aria-label={"Edit " + refName(e, ref).toLowerCase()}
                            aria-disabled={labelBlocked}
                            onKeyDown={(ev) => {
                              if (ev.key === "Enter" || ev.key === " ") {
                                ev.preventDefault();
                                ev.stopPropagation();
                                open(ref);
                              }
                            }}
                            onClick={(ev) => {
                              if (ev.detail === 0) {
                                ev.stopPropagation();
                                open(ref);
                              }
                            }}
                          >
                            <title>
                              {refName(e, ref)}: click to edit angle
                            </title>
                          </polygon>
                        );
                      })}
                    {selected?.startsWith("e:") &&
                      (() => {
                        const edge = display.document.edges.find(
                          (a) => `e:${a.id}` === selected,
                        );
                        return edge ? (
                          <line
                            x1={g.vertices[edge.from].x}
                            y1={g.vertices[edge.from].y}
                            x2={g.vertices[edge.to].x}
                            y2={g.vertices[edge.to].y}
                            className="tr-edge-selection"
                          />
                        ) : null;
                      })()}
                  </svg>
                  {!structure &&
                    g.anchors
                      .filter((a) => !a.ref.startsWith("a:"))
                      .map((a) => (
                        <button
                          key={a.ref}
                          type="button"
                          className={`tr-hit${selected === a.ref ? " tr-selected" : ""}`}
                          style={{
                            left: a.x * px,
                            top: a.y * px,
                            width: Math.max(28, a.w * px),
                            height: Math.max(28, a.h * px),
                          }}
                          data-tr-anchor={a.ref}
                          aria-label={`Edit ${refName(display, a.ref).toLowerCase()}`}
                          title={`${refName(display, a.ref)}: click to edit, drag to move label`}
                          disabled={labelBlocked && !drag.current}
                          onClick={(event) => {
                            if (suppressClick.current) {
                              suppressClick.current = false;
                              return;
                            }
                            if (a.ref.startsWith("a:") && event.detail > 0) {
                              const r =
                                resource.current!.getBoundingClientRect();
                              const marks = geometryHits(
                                e,
                                g,
                                {
                                  x: (event.clientX - r.left) / px,
                                  y: (event.clientY - r.top) / px,
                                },
                                7 / px,
                              ).filter((ref) => ref.startsWith("a:"));
                              if (marks.length) {
                                choose(marks, true);
                                return;
                              }
                            }
                            const overlaps = g.anchors
                              .filter((b) => !b.ref.startsWith("a:"))
                              .filter(
                                (b) =>
                                  Math.abs(b.x - a.x) * px < 12 &&
                                  Math.abs(b.y - a.y) * px < 12,
                              )
                              .filter(
                                (b) => getLabel(e, b.ref).state !== "hidden",
                              );
                            choose(
                              overlaps.length > 1
                                ? overlaps.map((b) => b.ref)
                                : [a.ref],
                              true,
                            );
                          }}
                          onPointerDown={(ev) => dragStart(ev, "label", a.ref)}
                          onPointerMove={dragMove}
                          onPointerUp={dragEnd}
                          onPointerCancel={cancelDrag}
                          onLostPointerCapture={() => {
                            if (drag.current) cancelDrag();
                          }}
                        />
                      ))}
                  {!structure &&
                    d.triangles
                      .filter(
                        (t) =>
                          !t.area ||
                          !g.anchors.some((a) => a.ref === "r:" + t.id),
                      )
                      .map((t) => {
                        const p = triangleCentre(e, g, t.id),
                          ref = "r:" + t.id;
                        return (
                          <button
                            key={ref}
                            type="button"
                            className={
                              "tr-area-add" +
                              (selected === "t:" + t.id || selected === ref
                                ? " tr-area-revealed"
                                : "")
                            }
                            style={{ left: p.x * px, top: p.y * px }}
                            data-tr-anchor={ref}
                            aria-label={"Add " + refName(e, ref).toLowerCase()}
                            title={refName(e, ref)}
                            disabled={labelBlocked}
                            onClick={() => open(ref)}
                          >
                            + Area{t.role === "outer" ? " (outer)" : ""}
                          </button>
                        );
                      })}
                  {!structure &&
                    Object.entries(g.vertices).map(([id, p]) => (
                      <button
                        key={id}
                        className={`tr-vertex${selected === `v:${id}` ? " tr-selected" : ""}`}
                        style={{
                          left: p.x * px,
                          top: p.y * px,
                          clipPath: vertexHandleClip(
                            { x: p.x * px, y: p.y * px },
                            (() => {
                              const a = g.anchors.find(
                                (a) => a.ref === `v:${id}`,
                              );
                              return a
                                ? { x: a.x * px, y: a.y * px }
                                : undefined;
                            })(),
                            matchMedia("(pointer:coarse)").matches ? 40 : 28,
                          ),
                        }}
                        aria-label={`Move vertex ${nameOf(display, id)}`}
                        title={`Vertex ${nameOf(display, id)}: drag to reshape`}
                        disabled={blocked && !drag.current}
                        onClick={() => {
                          if (suppressClick.current) {
                            suppressClick.current = false;
                            return;
                          }
                          selectObject(`v:${id}`);
                        }}
                        onPointerDown={(ev) => dragStart(ev, "vertex", id)}
                        onPointerMove={dragMove}
                        onPointerUp={dragEnd}
                        onPointerCancel={cancelDrag}
                        onLostPointerCapture={() => {
                          if (drag.current) cancelDrag();
                        }}
                        onKeyDown={(ev) => {
                          const delta = (
                            {
                              ArrowLeft: { x: -1, y: 0 },
                              ArrowRight: { x: 1, y: 0 },
                              ArrowUp: { x: 0, y: -1 },
                              ArrowDown: { x: 0, y: 1 },
                            } as Record<string, Point>
                          )[ev.key];
                          if (delta) {
                            ev.preventDefault();
                            const p = point(e, id);
                            operation(() =>
                              moveVertex(e, id, {
                                x: p.x + delta.x * (ev.shiftKey ? 5 : 1),
                                y: p.y + delta.y * (ev.shiftKey ? 5 : 1),
                              }),
                            );
                          }
                        }}
                      >
                        <span aria-hidden="true">•</span>
                      </button>
                    ))}
                </div>
              </div>
            </div>
            <div
              className="tr-structure"
              role="group"
              aria-label="Triangle structure"
              ref={structureControls}
            >
              {structure ? (
                <>
                  <div className="tr-structure-add">
                    {structure.kind === "joined" ? (
                      <label>
                        Attach on side
                        <select
                          aria-label="Attachment side"
                          value={structure.edge}
                          onChange={(ev) =>
                            setStructure({
                              ...structure,
                              edge: ev.target.value,
                            })
                          }
                        >
                          {d.edges.map((a) => (
                            <option key={a.id} value={a.id}>
                              {nameOf(e, a.from)}
                              {nameOf(e, a.to)}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : (
                      <label>
                        Split from vertex
                        <select
                          aria-label="Split apex"
                          value={structure.apex}
                          onChange={(ev) =>
                            setStructure({
                              ...structure,
                              apex: ev.target.value,
                            })
                          }
                        >
                          {d.triangles[0].vertices.map((id) => (
                            <option key={id} value={id}>
                              {nameOf(e, id)}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                    <button
                      className="tr-primary"
                      onClick={() => {
                        const next = structurePreview!;
                        commit(next);
                        setStructure(null);
                        const added = next.document.triangles
                          .filter((t) => t.role === "component")
                          .at(-1)!;
                        setSelected(`t:${added.id}`);
                        setTriangleId(added.id);
                        setMessage(
                          structure.kind === "split"
                            ? "Split applied. Drag the new point along the opposite side."
                            : `Triangle ${triangleName(next, added.id)} added. Its shared side keeps one label.`,
                        );
                      }}
                    >
                      {structure.kind === "split"
                        ? "Apply split"
                        : "Add triangle"}
                    </button>
                    <button
                      onClick={() => {
                        setStructure(null);
                        requestAnimationFrame(() =>
                          structureControls.current
                            ?.querySelector<HTMLButtonElement>("button")
                            ?.focus(),
                        );
                      }}
                    >
                      Cancel preview
                    </button>
                  </div>
                  <p className="tr-note" role="status">
                    {structure.kind === "split"
                      ? `Preview: split from ${nameOf(e, structure.apex)} to its opposite side. This is not automatically a height or bisector.`
                      : `Preview: attach outside side ${structure.edge}.`}{" "}
                    Apply or cancel before copying or changing the diagram.
                  </p>
                </>
              ) : d.layout === "single" ? (
                <div className="tr-structure-add">
                  <button
                    disabled={blocked}
                    onClick={() => beginStructure("joined")}
                  >
                    {selected?.startsWith("e:")
                      ? `Attach triangle to ${objectName(e, selected).replace("Side ", "")}`
                      : "Attach triangle"}
                  </button>
                  <button
                    disabled={blocked}
                    onClick={() => beginStructure("split")}
                  >
                    {selected?.startsWith("v:")
                      ? `Split triangle from ${nameOf(e, selected.slice(2))}`
                      : "Split triangle"}
                  </button>
                  <button
                    disabled={blocked}
                    onClick={() => {
                      try {
                        const next = addTriangle(e, "separate");
                        commit(next);
                        setSelected("t:T2");
                        setTriangleId("T2");
                        setMessage(
                          `Separate triangle ${triangleName(next, "T2")} added.`,
                        );
                      } catch (err) {
                        setMessage(errorText(err));
                      }
                    }}
                  >
                    Add separate triangle
                  </button>
                </div>
              ) : (
                <>
                  <p className="tr-note">
                    Two component triangles.{" "}
                    {d.layout === "joined"
                      ? "Select the shared side to edit its single label."
                      : d.layout === "split"
                        ? "Remove the split to restore the outer triangle."
                        : "The original triangle is retained when removing the added triangle."}
                  </p>
                  <button
                    disabled={blocked}
                    onMouseEnter={() =>
                      setHoverTriangle(
                        d.triangles
                          .filter((t) => t.role === "component")
                          .at(-1)!.id,
                      )
                    }
                    onMouseLeave={() => setHoverTriangle(null)}
                    onFocus={() =>
                      setHoverTriangle(
                        d.triangles
                          .filter((t) => t.role === "component")
                          .at(-1)!.id,
                      )
                    }
                    onBlur={() => setHoverTriangle(null)}
                    onClick={() => {
                      operation(() => removeSecond(e));
                      setSelected(null);
                      setHoverTriangle(null);
                      setMessage(
                        d.layout === "split"
                          ? "Split and its dependent annotations removed; outer triangle restored. Undo restores the split."
                          : "Added triangle and its dependent annotations removed. Original triangle retained; Undo restores the addition.",
                      );
                    }}
                  >
                    {d.layout === "split"
                      ? "Remove split"
                      : `Remove triangle ${triangleName(e, d.triangles[1].id)}`}
                  </button>
                </>
              )}
            </div>
            {!!choices.length && (
              <div
                className="tr-choice"
                role="group"
                aria-label="Choose overlapping object"
              >
                <p>Choose the object:</p>
                {choices.map((ref) => (
                  <button
                    key={ref}
                    onMouseEnter={() =>
                      setHoverAngle(ref.startsWith("a:") ? ref : null)
                    }
                    onFocus={() =>
                      setHoverAngle(ref.startsWith("a:") ? ref : null)
                    }
                    onMouseLeave={() => setHoverAngle(null)}
                    onBlur={() => setHoverAngle(null)}
                    onClick={() => {
                      setHoverAngle(null);
                      if (editChoice) open(ref);
                      else selectObject(ref);
                    }}
                  >
                    {objectName(e, ref)}
                  </button>
                ))}
                <button onClick={() => setChoices([])}>Cancel selection</button>
              </div>
            )}
            {currentExample && (
              <details className="tr-source-context">
                <summary>
                  Source:{" "}
                  <a
                    href={`https://mathsdock.co.uk/?tool=question-bank&question=${d.sourceId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {currentExample.source}
                  </a>
                </summary>
                <p>{currentExample.description}</p>
              </details>
            )}
            {pendingInput && (
              <div className="tr-banner" role="status">
                Finish the pending{" "}
                {draft
                  ? "label"
                  : widthDraft !== null
                    ? "print width"
                    : "vertex position"}{" "}
                edit with Apply or Cancel before copying, saving or changing the
                diagram.
              </div>
            )}
            {!!exportMetrics.issues.length && (
              <div className="tr-error tr-feedback" role="status">
                {exportMetrics.issues.join(" ")} Editable saving remains
                available.
              </div>
            )}
            {!!message && (
              <div className="tr-feedback" role="status">
                {message}
              </div>
            )}
            {!!notes.length && (
              <div className="tr-warnings">
                {notes.map((note) => (
                  <p key={note}>{note}</p>
                ))}
              </div>
            )}
            {recovery !== null && (
              <section className="tr-recovery">
                <h2>Protect saved data</h2>
                <p>
                  {message ||
                    "Saved data could not be read. Download the original before starting afresh."}
                </p>
                <button
                  onClick={() => {
                    downloadBlob(
                      new Blob([recovery], { type: "application/json" }),
                      "maths-triangle-recovery.json",
                    );
                    setProtectedCopy(true);
                    setMessage(
                      "Recovery download started. Keep this original file before starting afresh.",
                    );
                  }}
                >
                  Download original saved data
                </button>
                <button onClick={() => downloadEditable(e)}>
                  Download this diagram
                </button>
                <button
                  disabled={!protectedCopy}
                  onClick={() => setRecoveryConfirm(true)}
                >
                  Start a fresh diagram
                </button>
              </section>
            )}
          </Panel>
          <aside className="inspector-stack" aria-label="Triangle settings">
            <ExampleGallery
              examples={triangleGallery}
              active={active}
              disabled={blocked}
              onUse={(resource, title) =>
                replacement(resource, `Open ${title}?`)
              }
              onWorked={(resource) =>
                openWorkedDocument(
                  "triangle",
                  "maths-booklet-tools:triangle:v1",
                  canonical(resource),
                )
              }
            />
            <section className="panel-card tr-panel specialist-tools">
              <h2>Selected object</h2>
              <label>
                Select an object
                <select
                  aria-label="Selected object"
                  value={
                    objects(e).some((o) => o.ref === selected)
                      ? (selected ?? "")
                      : ""
                  }
                  disabled={blocked}
                  onChange={(ev) => selectObject(ev.target.value || null)}
                >
                  <option value="">
                    Choose a triangle, side, angle or label
                  </option>
                  {[
                    "Triangles",
                    "Vertices",
                    "Sides",
                    "Angles",
                    "Heights",
                    "Captions",
                    "Areas",
                  ].map((group) => (
                    <optgroup key={group} label={group}>
                      {objects(e)
                        .filter((o) => o.group === group)
                        .map((o) => (
                          <option key={o.ref} value={o.ref}>
                            {o.name}
                          </option>
                        ))}
                    </optgroup>
                  ))}
                </select>
              </label>
              {!selected && (
                <p className="tr-note">
                  Click a label to edit. Drag a vertex to reshape, or a label to
                  move it. Select a side to attach another triangle.
                </p>
              )}
              {selected?.startsWith("t:") && <h3>{objectName(e, selected)}</h3>}
              {selected?.startsWith("e:") &&
                owningTriangles(e, selected).length > 1 && (
                  <p className="tr-note">
                    Shared by{" "}
                    {owningTriangles(e, selected)
                      .map((t) => triangleName(e, t.id))
                      .join(" and ")}
                    ; one side label.
                  </p>
                )}
              <div className="tr-settings-body">
                {chosen && (
                  <div className="tr-context">
                    <h3>{refName(e, chosen.ref)}</h3>
                    {chosen.ref.startsWith("h:") && (
                      <button
                        disabled={blocked}
                        onClick={() =>
                          change((n) => {
                            n.document.heights = n.document.heights.filter(
                              (h) => `h:${h.id}` !== chosen.ref,
                            );
                          })
                        }
                      >
                        Remove selected height
                      </button>
                    )}
                    <p className="tr-note">
                      {chosen.label.state === "blank"
                        ? "Blank for pupils"
                        : chosen.label.state === "hidden"
                          ? "Hidden on the pupil resource"
                          : textOf(e, chosen.label) || chosen.label.state}
                      {chosen.label.shared ? " · linked symbol" : ""}
                    </p>
                    {!draft && (
                      <button
                        className="tr-primary"
                        disabled={blocked}
                        onClick={() => open(chosen.ref)}
                      >
                        Edit selected label
                      </button>
                    )}
                    {!draft && (
                      <details className="tr-inner-section">
                        <summary>Label position</summary>
                        <div
                          className="tr-nudges"
                          role="group"
                          aria-label="Move selected label"
                        >
                          {(
                            [
                              ["Left", -1, 0],
                              ["Right", 1, 0],
                              ["Up", 0, -1],
                              ["Down", 0, 1],
                            ] as const
                          ).map(([title, x, y]) => (
                            <button
                              key={title}
                              disabled={blocked}
                              onClick={() =>
                                operation(() =>
                                  editLabel(e, chosen.ref, {
                                    dx: chosen.label.dx + x,
                                    dy: chosen.label.dy + y,
                                  }),
                                )
                              }
                            >
                              {title}
                            </button>
                          ))}
                          <button
                            disabled={blocked}
                            onClick={() =>
                              operation(() =>
                                editLabel(e, chosen.ref, { dx: 0, dy: 0 }),
                              )
                            }
                          >
                            Auto position
                          </button>
                        </div>
                      </details>
                    )}
                    {!!selectedLabel?.answer && (
                      <details className="tr-inner-section">
                        <summary>Saved answer details</summary>
                        <p className="tr-note">
                          Saved answer: {selectedLabel.answer}{" "}
                          {selectedLabel.unit}
                          {isStale(e, selectedLabel) ? " (out of date)" : ""}
                        </p>
                        {selectedLabel.calculation && (
                          <p className="tr-note">
                            {selectedLabel.calculation.formula}
                          </p>
                        )}
                        <label>
                          <input
                            type="checkbox"
                            disabled={blocked || isStale(e, selectedLabel)}
                            checked={selectedLabel.answerVisible}
                            onChange={(ev) =>
                              operation(() =>
                                editLabel(e, chosen.ref, {
                                  answerVisible: ev.target.checked,
                                }),
                              )
                            }
                          />{" "}
                          Show answer in saved pupil resource
                        </label>
                        {isStale(e, selectedLabel) && (
                          <button
                            disabled={blocked}
                            onClick={() =>
                              operation(() =>
                                editLabel(e, chosen.ref, {
                                  calculation: null,
                                }),
                              )
                            }
                          >
                            Keep as a manual answer
                          </button>
                        )}
                        <button
                          disabled={blocked}
                          onClick={() =>
                            operation(() =>
                              editLabel(e, chosen.ref, {
                                answer: "",
                                answerVisible: false,
                                calculation: null,
                              }),
                            )
                          }
                        >
                          Clear saved answer
                        </button>
                      </details>
                    )}
                  </div>
                )}
                {selected &&
                  (selected.startsWith("e:") ||
                    selected.startsWith("a:") ||
                    selected.startsWith("h:") ||
                    selected.startsWith("c:") ||
                    selected.startsWith("r:")) && (
                    <button
                      disabled={blocked}
                      onClick={() => setCalcTarget(selected)}
                    >
                      Calculate{" "}
                      {objectName(e, selected).replace(/^./, (c) =>
                        c.toLowerCase(),
                      )}
                    </button>
                  )}
                {selected?.startsWith("t:") && (
                  <button
                    disabled={labelBlocked}
                    onClick={() => open("r:" + selected.slice(2))}
                  >
                    {d.triangles.find((t) => "t:" + t.id === selected)?.area
                      ? "Edit area label"
                      : "Add area label"}
                  </button>
                )}
                {selected &&
                  (selected.startsWith("v:") || selected.startsWith("t:")) && (
                    <>
                      <div className="tr-two">
                        <label>
                          Shape triangle
                          <select
                            value={t.id}
                            disabled={blocked}
                            onChange={(ev) => {
                              setTriangleId(ev.target.value);
                              if (selected?.startsWith("t:"))
                                setSelected(`t:${ev.target.value}`);
                            }}
                          >
                            {d.triangles.map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.vertices.map((id) => nameOf(e, id)).join("")}
                                {t.role === "outer" ? " (outer)" : ""}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          Selected vertex
                          <select
                            value={
                              t.vertices.includes(vertexId)
                                ? vertexId
                                : t.vertices[0]
                            }
                            disabled={blocked}
                            onChange={(ev) => {
                              setVertexId(ev.target.value);
                              setSelected(`v:${ev.target.value}`);
                            }}
                          >
                            {t.vertices.map((id) => (
                              <option key={id} value={id}>
                                {nameOf(e, id)}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                      {selected?.startsWith("v:") && (
                        <div
                          className="tr-nudges"
                          role="group"
                          aria-label="Move selected vertex"
                        >
                          {(
                            [
                              ["Left", -1, 0],
                              ["Right", 1, 0],
                              ["Up", 0, -1],
                              ["Down", 0, 1],
                            ] as const
                          ).map(([title, x, y]) => (
                            <button
                              key={title}
                              disabled={blocked}
                              onClick={() =>
                                operation(() =>
                                  moveVertex(e, v.id, {
                                    x: v.x + x,
                                    y: v.y + y,
                                  }),
                                )
                              }
                            >
                              {title} (shape)
                            </button>
                          ))}
                        </div>
                      )}
                      <p className="tr-note">
                        Rotation and reflection turn the complete diagram,
                        preserving its labels.
                      </p>
                      <div className="tr-two">
                        <button
                          disabled={blocked}
                          onClick={() => operation(() => transform(e, "left"))}
                        >
                          Rotate left
                        </button>
                        <button
                          disabled={blocked}
                          onClick={() => operation(() => transform(e, "right"))}
                        >
                          Rotate right
                        </button>
                        <button
                          disabled={blocked}
                          onClick={() =>
                            operation(() => transform(e, "reflect"))
                          }
                        >
                          Reflect horizontally
                        </button>
                        <button
                          disabled={blocked}
                          onClick={() =>
                            operation(() => transform(e, "vertical"))
                          }
                        >
                          Reflect vertically
                        </button>
                      </div>
                      <details className="tr-inner-section">
                        <summary>Shape locks</summary>
                        <div className="tr-inner-body">
                          <p className="tr-note">
                            These actions reshape the triangle. They replace its
                            existing geometry locks; printed measurements stay
                            as entered.
                          </p>
                          <div className="tr-two">
                            {(
                              [
                                ["right", "Make right angle"],
                                ["equal", "Make equal sides at apex"],
                                ["equilateral", "Make equilateral"],
                                ["none", "Release shape locks"],
                              ] as const
                            ).map(([kind, title]) => (
                              <button
                                key={kind}
                                disabled={blocked}
                                onClick={() =>
                                  operation(() =>
                                    setConstraint(
                                      e,
                                      t.id,
                                      kind,
                                      t.vertices.includes(vertexId)
                                        ? vertexId
                                        : t.vertices[0],
                                    ),
                                  )
                                }
                              >
                                {title}
                              </button>
                            ))}
                          </div>
                          <p className="tr-note">
                            Current locks:{" "}
                            {t.rightAt
                              ? `right angle at ${nameOf(e, t.rightAt)}`
                              : t.equilateral
                                ? "equilateral"
                                : t.equalAt
                                  ? `equal sides from ${nameOf(e, t.equalAt)}`
                                  : "none"}
                            .
                          </p>
                        </div>
                      </details>{" "}
                      <button
                        disabled={
                          blocked ||
                          d.heights.length >= 2 ||
                          d.heights.some((h) => h.triangleId === t.id)
                        }
                        onClick={() =>
                          operation(() =>
                            addHeight(
                              e,
                              t.id,
                              t.vertices.includes(vertexId)
                                ? vertexId
                                : t.vertices[0],
                            ),
                          )
                        }
                      >
                        Add perpendicular height from selected vertex
                      </button>
                      {d.heights.map((h) => (
                        <div className="tr-height-row" key={h.id}>
                          <span>
                            {refName(e, `h:${h.id}`)} from {nameOf(e, h.apex)}
                          </span>
                          <button
                            disabled={blocked}
                            onClick={() => {
                              operation(() => {
                                const n = structuredClone(e);
                                n.document.heights = n.document.heights.filter(
                                  (v) => v.id !== h.id,
                                );
                                return validate(n);
                              });
                              setSelected(null);
                            }}
                          >
                            Remove {refName(e, `h:${h.id}`).toLowerCase()}
                          </button>
                        </div>
                      ))}
                      <details
                        className="tr-inner-section"
                        open={positionDraft !== null || undefined}
                      >
                        <summary>Precise vertex position</summary>
                        <div className="tr-inner-body">
                          <label>
                            Vertex position
                            <select
                              value={v.id}
                              disabled={blocked}
                              onChange={(ev) => {
                                setVertexId(ev.target.value);
                                setSelected(`v:${ev.target.value}`);
                              }}
                            >
                              {d.vertices.map((v) => (
                                <option key={v.id}>{v.id}</option>
                              ))}
                            </select>
                          </label>
                          <p className="tr-note">
                            Shape positions do not change printed length labels.
                            Arrow keys on a vertex handle also move it.
                          </p>
                          <div className="tr-two">
                            <label>
                              Horizontal position
                              <input
                                inputMode="decimal"
                                disabled={
                                  busy ||
                                  recovery !== null ||
                                  draft !== null ||
                                  widthDraft !== null ||
                                  pending !== null ||
                                  structure !== null
                                }
                                value={
                                  positionDraft?.id === v.id
                                    ? positionDraft.x
                                    : Number(v.x.toFixed(4))
                                }
                                onChange={(ev) =>
                                  setPositionDraft({
                                    id: v.id,
                                    x: ev.target.value,
                                    y:
                                      positionDraft?.id === v.id
                                        ? positionDraft.y
                                        : String(v.y),
                                  })
                                }
                              />
                            </label>
                            <label>
                              Vertical position
                              <input
                                inputMode="decimal"
                                disabled={
                                  busy ||
                                  recovery !== null ||
                                  draft !== null ||
                                  widthDraft !== null ||
                                  pending !== null ||
                                  structure !== null
                                }
                                value={
                                  positionDraft?.id === v.id
                                    ? positionDraft.y
                                    : Number(v.y.toFixed(4))
                                }
                                onChange={(ev) =>
                                  setPositionDraft({
                                    id: v.id,
                                    x:
                                      positionDraft?.id === v.id
                                        ? positionDraft.x
                                        : String(v.x),
                                    y: ev.target.value,
                                  })
                                }
                              />
                            </label>
                          </div>
                          {positionDraft && (
                            <div className="tr-two">
                              <button
                                onClick={() => {
                                  try {
                                    commit(
                                      moveVertex(e, positionDraft.id, {
                                        x: numeric(positionDraft.x),
                                        y: numeric(positionDraft.y),
                                      }),
                                    );
                                    setPositionDraft(null);
                                    setFieldError("");
                                  } catch (err) {
                                    setFieldError(errorText(err));
                                  }
                                }}
                              >
                                Apply position
                              </button>
                              <button
                                onClick={() => {
                                  setPositionDraft(null);
                                  setFieldError("");
                                }}
                              >
                                Cancel position
                              </button>
                            </div>
                          )}
                          {fieldError && positionDraft && (
                            <p className="tr-error" role="status">
                              {fieldError}
                            </p>
                          )}
                        </div>
                      </details>
                    </>
                  )}
                <details className="tr-inner-section">
                  <summary>Captions and diagram notes</summary>
                  <div className="tr-section-body">
                    <p className="tr-note">
                      Edit a label to choose a given, symbol, blank, answer line
                      or hidden state. Numerical and algebraic labels are
                      supported. Equality marks are printing choices; they do
                      not fill in lengths.
                    </p>
                    <button
                      disabled={blocked || d.captions.length >= 2}
                      onClick={() =>
                        operation(() => caption(e, "", "answer-line"))
                      }
                    >
                      Add caption or answer line
                    </button>
                    {d.captions.map((c) => (
                      <div className="tr-height-row" key={c.id}>
                        <button
                          disabled={blocked}
                          onClick={() => open(`c:${c.id}`)}
                        >
                          Edit {refName(e, `c:${c.id}`).toLowerCase()}
                        </button>
                        <button
                          disabled={blocked}
                          onClick={() => {
                            change((n) => {
                              n.document.captions = n.document.captions.filter(
                                (v) => v.id !== c.id,
                              );
                            });
                            setSelected(null);
                          }}
                        >
                          Remove {refName(e, `c:${c.id}`).toLowerCase()}
                        </button>
                      </div>
                    ))}
                    <label>
                      <input
                        type="checkbox"
                        checked={d.notToScale}
                        disabled={blocked}
                        onChange={(ev) =>
                          change((n) => {
                            n.document.notToScale = ev.target.checked;
                          })
                        }
                      />{" "}
                      Print “Diagram not accurately drawn”
                    </label>
                  </div>
                </details>{" "}
              </div>
            </section>
            {calcTarget && (
              <ContextCalculation
                key={calcTarget}
                e={e}
                target={calcTarget}
                blocked={blocked}
                onClose={() => setCalcTarget(null)}
                onChange={(next) => {
                  if (!blocked) {
                    commit(next);
                    setMessage(
                      "Answer saved and hidden; pupil label retained.",
                    );
                  }
                }}
                onError={setMessage}
              />
            )}
            <details className="tr-section">
              <summary>Start a new triangle</summary>
              <div className="tr-section-body">
                <p className="tr-note">Start a new blank triangle:</p>
                <div className="tr-two">
                  {(
                    [
                      ["right", "Right-angled"],
                      ["scalene", "Scalene"],
                      ["isosceles", "Isosceles"],
                      ["equilateral", "Equilateral"],
                    ] as const
                  ).map(([shape, title]) => (
                    <button
                      key={shape}
                      disabled={blocked}
                      onClick={() =>
                        replacement(
                          create(shape),
                          `Start a ${title.toLowerCase()} triangle?`,
                        )
                      }
                    >
                      {title}
                    </button>
                  ))}
                </div>
              </div>
            </details>{" "}
            <details className="tr-section">
              <summary>Print size</summary>
              <div className="tr-section-body">
                <label>
                  Print width (cm)
                  <input
                    inputMode="decimal"
                    value={widthDraft ?? d.widthCm}
                    disabled={
                      busy ||
                      recovery !== null ||
                      draft !== null ||
                      positionDraft !== null ||
                      pending !== null ||
                      structure !== null
                    }
                    onChange={(ev) => {
                      setWidthDraft(
                        ev.target.value === String(d.widthCm)
                          ? null
                          : ev.target.value,
                      );
                      setFieldError("");
                    }}
                  />
                </label>
                <p className="tr-note">
                  6–18 cm. Text stays at 11 pt; preview zoom changes only the
                  view. Actual height follows the complete artwork and captions.
                </p>
                {widthDraft !== null && (
                  <div className="tr-two">
                    <button
                      onClick={() => {
                        try {
                          const n = structuredClone(e);
                          n.document.widthCm = numeric(widthDraft);
                          commit(validate(n));
                          setWidthDraft(null);
                          setFieldError("");
                        } catch (err) {
                          setFieldError(errorText(err));
                        }
                      }}
                    >
                      Apply print width
                    </button>
                    <button
                      onClick={() => {
                        setWidthDraft(null);
                        setFieldError("");
                      }}
                    >
                      Cancel print width
                    </button>
                  </div>
                )}
                {fieldError && widthDraft !== null && (
                  <p className="tr-error" role="status">
                    {fieldError}
                  </p>
                )}
              </div>
            </details>
            <details className="tr-section tr-more-tools">
              <summary>More tools</summary>
              <div className="tr-section-body">
                <MathsPanel
                  key={`maths-${d.layout}`}
                  e={e}
                  blocked={blocked}
                  onChange={(next) => {
                    if (!blocked) {
                      commit(next);
                      setMessage(
                        "Answer saved and hidden. Choose Show saved answers to preview it, or open a worked copy.",
                      );
                    }
                  }}
                  onError={setMessage}
                  selected={selected}
                />
                <ConstructionPanel
                  key={`construction-${d.layout}`}
                  e={e}
                  blocked={blocked}
                  onPreview={(next) =>
                    replacement(
                      next,
                      "Use this constructed shape?",
                      "The selected triangle's shape and geometry locks will change. Printed labels and pupil blanks are retained. Undo restores the previous shape.",
                    )
                  }
                  onError={setMessage}
                />
              </div>
            </details>
            <details className="tr-section">
              <summary>Editing help</summary>
              <div className="tr-section-body">
                <p className="tr-note">
                  Click labels to edit. Blank labels keep click targets; the
                  object chooser also lists every label for keyboard access.
                </p>
                <p className="tr-note">
                  Click an interior angle wedge or its arc, choose Arc in Angle
                  marker, and leave Label display as Blank for an unlabelled
                  arc. Marker and label choices are independent. None removes
                  only the mark.
                </p>
                <p className="tr-note">
                  Hover or select a triangle to reveal + Area at its centre. On
                  touch, tap inside the triangle first. Enter a given or an
                  unknown; the label follows that triangle as it reshapes.
                </p>
                <p className="tr-note">
                  Drag vertices to reshape while preserving geometry locks.
                  Printed lengths stay as entered. Drag labels to reposition
                  them. Arrow keys on a focused vertex and the contextual
                  position controls provide precise alternatives.
                </p>
                <p className="tr-note">
                  Enter applies and Escape cancels a label edit. Invalid drafts
                  stay available for correction. Preview zoom changes only the
                  view.
                </p>
                <p className="tr-note">
                  Show saved answers is a temporary preview. Downloads keep
                  saved pupil visibility; Open worked copy creates an
                  independent answer resource.
                </p>
              </div>
            </details>
          </aside>
        </section>
        {active && pending && (
          <RatioDialog
            title={pending.title}
            onCancel={() => {
              setPending(null);
              consumeLink();
            }}
            onConfirm={() => {
              commit(pending.e);
              setPending(null);
              setSelected(null);
              setShowAnswers(false);
              consumeLink();
            }}
            confirmLabel="Use this diagram"
          >
            <p>{pending.explanation}</p>
            <div
              className="tr-import-preview"
              dangerouslySetInnerHTML={{ __html: layout(pending.e).svg }}
            />
            <p className="tr-note">
              Editable data may contain hidden answers. Preview above uses saved
              pupil visibility.
            </p>
          </RatioDialog>
        )}
        {active && recoveryConfirm && (
          <RatioDialog
            title="Start a fresh triangle diagram?"
            confirmLabel="Start fresh"
            disabled={!protectedCopy}
            onCancel={() => setRecoveryConfirm(false)}
            onConfirm={() => {
              try {
                const raw = localStorage.getItem(startup.key) ?? "";
                if (!protectedCopy || raw !== recovery) {
                  setRecovery(raw);
                  setProtectedCopy(false);
                  setMessage(
                    "Saved data changed again. Download its latest data before starting afresh.",
                  );
                  setRecoveryConfirm(false);
                  return;
                }
                expected.current = localStorage.getItem(startup.key);
                setRecovery(null);
                setRecoveryConfirm(false);
                setHistory((h) => ({
                  past: [...h.past, h.present].slice(-60),
                  present: create(),
                  future: [],
                }));
                setSelected(null);
              } catch (err) {
                setMessage(errorText(err));
                setRecoveryConfirm(false);
              }
            }}
          >
            <p>
              {protectedCopy
                ? "This starts a blank triangle. The original saved data has been offered as a recovery download. Your current diagram remains in Undo for this session."
                : "Saved data changed again. Cancel and download its latest data before starting afresh."}
            </p>
          </RatioDialog>
        )}
        {draft && (
          <TriangleFloatingEditor
            anchor={draft.ref}
            title={`Edit ${refName(e, draft.ref)}`}
            active={active}
          >
            <form
              onSubmit={(ev) => {
                ev.preventDefault();
                applyDraft();
              }}
              onBlur={(ev) => {
                if (
                  ev.relatedTarget instanceof Node &&
                  !ev.currentTarget.contains(ev.relatedTarget) &&
                  !(
                    ev.relatedTarget instanceof Element &&
                    ev.relatedTarget.closest("[data-tr-anchor]")
                  )
                )
                  applyDraft();
              }}
            >
              {draft.ref.startsWith("r:") && (
                <p className="tr-note">
                  Area label for{" "}
                  {objectName(e, "t:" + draft.ref.slice(2)).replace(
                    /^Triangle /,
                    "triangle ",
                  )}
                  . Enter a given or an unknown; calculation is a separate
                  action.
                </p>
              )}
              <TriangleLabelFields
                e={e}
                draft={draft}
                showAnswers={showAnswers}
                update={updateDraft}
              />
              {draft.ref.startsWith("r:") &&
                d.triangles.some(
                  (t) => "r:" + t.id === draft.ref && t.area,
                ) && (
                  <button
                    type="button"
                    onClick={() => {
                      const n = structuredClone(committed.current);
                      delete n.document.triangles.find(
                        (t) => "r:" + t.id === draft.ref,
                      )!.area;
                      if (!n.document.triangles.some((t) => t.area)) {
                        n.schemaVersion = 1;
                        n.rendererVersion = "triangle-1";
                      }
                      commit(n);
                      closeDraft();
                      setSelected(null);
                    }}
                  >
                    Remove area label
                  </button>
                )}
              {draftError && (
                <p className="tr-error" role="alert">
                  {draftError}
                </p>
              )}
              <div className="tr-two tr-draft-actions">
                <button type="submit" className="tr-primary">
                  Apply label
                </button>
                <button type="button" onClick={closeDraft}>
                  Cancel label
                </button>
              </div>
            </form>
          </TriangleFloatingEditor>
        )}
      </main>
    </div>
  );
}
