import { useResourceFit } from "../site/useResourceFit";
import { ExampleGallery } from "../examples/ExampleGallery";
import { cuboidGallery } from "../examples/galleryCatalogue";
import { openWorkedDocument, copyStorageKey } from "../site/copyDocument";
import { PreviewControls } from "../site/PreviewControls";
import { ResourceSaveStatus } from "../site/ResourceSaveStatus";
import {
  EditorDownloadMenu,
  LINK_DESCRIPTION,
} from "../site/EditorDownloadMenu";
import { ResourceSize } from "../site/ResourceSize";
import { formatResourceSize } from "../site/resourceSizeFormat";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  appearance,
  upgrade,
  faceNames,
  faceAreaLabel,
  type Appearance,
  type Target,
  axes,
  keys,
  create,
  newShape,
  validate,
  canonical,
  parseFile,
  decode,
  editorLink,
  dimension,
  layout,
  exportIssue,
  labelText,
  setDimension,
  setUnit,
  setCubeSide,
  cubeSideInUnit,
  grow,
  warnings,
  decomposition,
  type Envelope,
  type Shape,
  type LabelKey,
  type Label,
} from "../../packages/cuboid-core/src";
import { EditorToolbar } from "../site/EditorToolbar";
import { PageHeading, Panel } from "../site/PageHeading";
import { RatioDialog as ResourceDialog } from "../ratio-table/RatioDialog";
import { copyPngToClipboard, downloadBlob } from "../export/clipboard";
import {
  prepareImage,
  printPng,
  downloadImage,
  copyWord,
  downloadEditable,
} from "./export";
import { FloatingEditor } from "./FloatingEditor";
import { CuboidField as Field, type FieldHandle } from "./CuboidField";
import "./cuboid.css";
const STORAGE = copyStorageKey("maths-booklet-tools:cuboids:v1");
const newDocument = () => upgrade(create());
function initial() {
  try {
    const raw = localStorage.getItem(STORAGE);
    if (raw) {
      try {
        return { e: parseFile(raw), recovery: null, error: "" };
      } catch {
        return {
          e: newDocument(),
          recovery: raw,
          error:
            "Saved cuboids need recovery. Download the original data before starting afresh.",
        };
      }
    }
  } catch {
    return {
      e: newDocument(),
      recovery: null,
      error:
        "Device storage is unavailable. Save an editable file to keep your work.",
    };
  }
  return { e: newDocument(), recovery: null, error: "" };
}
export default function CuboidPage({ active = true }: { active?: boolean }) {
  const [startup] = useState(initial),
    [history, setHistory] = useState<{
      past: Envelope[];
      present: Envelope;
      future: Envelope[];
    }>({ past: [], present: startup.e, future: [] });
  const [message, setMessage] = useState(startup.error),
    [saveState, setSaveState] = useState("Saved on this device"),
    [recovery, setRecovery] = useState<string | null>(startup.recovery),
    [recoverySaved, setRecoverySaved] = useState(false);
  const [selected, setSelected] = useState(startup.e.document.shapes[0].id),
    [labelKey, setLabelKey] = useState<LabelKey>("width"),
    [inline, setInline] = useState<LabelKey | "area" | null>(null),
    [showHidden, setShowHidden] = useState(false);
  const [pending, setPending] = useState<{ title: string; e: Envelope } | null>(
      null,
    ),
    [menu, setMenu] = useState(false),
    [busy, setBusy] = useState(false),
    [zoom, setZoom] = useState(0),
    [dirty, setDirty] = useState<Set<string>>(new Set());
  const [tab, setTab] = useState<"shape" | "labels" | "shading">("shape");
  const [inputEpoch, setInputEpoch] = useState(0);
  const inlineField = useRef<FieldHandle>(null);
  const file = useRef<HTMLInputElement>(null),
    expected = useRef<string | null>(null),
    current = useRef(history.present);
  current.current = history.present;
  const inputPending = useCallback(
    (label: string, value: boolean) =>
      setDirty((old) => {
        if (old.has(label) === value) return old;
        const n = new Set(old);
        if (value) n.add(label);
        else n.delete(label);
        return n;
      }),
    [],
  );
  const e = history.present,
    d = e.document,
    s = d.shapes.find((x) => x.id === selected) ?? d.shapes[0],
    l = s.labels[labelKey];
  const a = appearance(s);
  const blocked = busy || recovery !== null || dirty.size > 0,
    issue = exportIssue(e);
  let m: ReturnType<typeof layout> | null = null;
  try {
    m = layout(e);
  } catch {
    /*Keep the document and correction controls available.*/
  }
  const fitted = useResourceFit(
    ((m?.width ?? 1) * 96) / 25.4,
    ((m?.height ?? 1) * 96) / 25.4,
    zoom,
  );
  const unit = (96 / 25.4) * fitted.scale;
  const cropCache = useRef(
    new Map<string, Promise<{ width: number; height: number }>>(),
  );
  const [cropSize, setCropSize] = useState<{
    key: string;
    width?: number;
    height?: number;
    error?: boolean;
  }>({ key: "" });
  const cropKey = canonical(e);
  useEffect(() => {
    if (!active || issue) return;
    let alive = true;
    setCropSize({ key: cropKey });
    let measured = cropCache.current.get(cropKey);
    if (!measured) {
      measured = prepareImage(e).then(({ width, height }) => ({
        width,
        height,
      }));
      cropCache.current.set(cropKey, measured);
      if (cropCache.current.size > 12)
        cropCache.current.delete(cropCache.current.keys().next().value!);
    }
    measured.then(
      (size) => {
        if (alive) setCropSize({ key: cropKey, ...size });
      },
      () => {
        cropCache.current.delete(cropKey);
        if (alive) setCropSize({ key: cropKey, error: true });
      },
    );
    return () => {
      alive = false;
    };
  }, [active, cropKey, e, issue]);
  function commit(value: Envelope) {
    if (recovery !== null)
      throw Error("Protect recovery data before starting afresh.");
    const valid = validate(value);
    setHistory((h) =>
      canonical(valid) === canonical(h.present)
        ? h
        : {
            past: [...h.past, h.present].slice(-60),
            present: valid,
            future: [],
          },
    );
    setMessage("");
  }
  function changeShape(update: (shape: Shape) => Shape) {
    const prev = current.current;
    const next = {
      ...prev,
      document: {
        ...prev.document,
        shapes: prev.document.shapes.map((x) =>
          x.id === s.id ? update(x) : x,
        ),
      },
    };
    commit(
      prev.schemaVersion === 1 && next.document.shapes.some((x) => x.appearance)
        ? upgrade(next)
        : next,
    );
  }
  function paint(p: Partial<Appearance>) {
    changeShape((x) => ({ ...x, appearance: { ...appearance(x), ...p } }));
  }
  function area(p: Partial<Appearance["area"]>) {
    paint({ area: { ...a.area, ...p } });
  }
  function safe(action: () => void) {
    if (blocked) return;
    try {
      action();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err));
    }
  }
  function patch(p: Partial<Shape>) {
    changeShape((x) => ({
      ...x,
      ...p,
      ...(p.arrows ? { appearance: appearance(x) } : {}),
    }));
  }
  function patchLabel(p: Partial<Label>) {
    changeShape((x) => ({
      ...x,
      labels: { ...x.labels, [labelKey]: { ...x.labels[labelKey], ...p } },
    }));
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
    setInline(null);
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
    setInline(null);
  }
  function replacement(next: Envelope, title: string) {
    if (blocked) {
      setMessage(
        "Apply or cancel unfinished input before replacing your cuboids.",
      );
      return;
    }
    setPending({ e: next, title });
  }
  useEffect(() => {
    if (recovery !== null) return;
    try {
      const raw = localStorage.getItem(STORAGE),
        text = canonical(history.present);
      if (
        expected.current !== null &&
        raw !== expected.current &&
        raw !== text
      ) {
        setRecovery(raw ?? "");
        setRecoverySaved(false);
        setMessage(
          "A newer draft exists in another tab. Its data is protected.",
        );
        return;
      }
      localStorage.setItem(STORAGE, text);
      expected.current = text;
      setSaveState("Saved on this device");
    } catch {
      setSaveState("Save unavailable — download editable file");
    }
  }, [history.present, recovery]);
  useEffect(() => {
    const listener = (event: StorageEvent) => {
      if (event.key === STORAGE && event.newValue !== expected.current) {
        setRecovery(event.newValue ?? "");
        setRecoverySaved(false);
        setMessage(
          "Saved cuboids changed in another tab. Download its data before replacing it.",
        );
      }
    };
    window.addEventListener("storage", listener);
    return () => window.removeEventListener("storage", listener);
  }, []);
  useEffect(() => {
    if (!active) return;
    const handle = () => {
      if (new URLSearchParams(location.search).get("tool") !== "cuboids")
        return;
      const value = new URLSearchParams(location.hash.slice(1)).get("cuboids");
      if (!value) return;
      try {
        setPending({ e: decode(value), title: "Open the linked cuboids?" });
      } catch (err) {
        setMessage(err instanceof Error ? err.message : String(err));
      }
    };
    handle();
    window.addEventListener("hashchange", handle);
    return () => window.removeEventListener("hashchange", handle);
  }, [active]);
  useEffect(() => {
    if (!active) return;
    const key = (event: KeyboardEvent) => {
      if (document.querySelector('[aria-modal="true"]')) return;
      if (event.key === "Escape" && !dirty.size) setInline(null);
      if (
        (event.ctrlKey || event.metaKey) &&
        !(
          event.target instanceof HTMLElement &&
          event.target.closest("input,textarea,select,[contenteditable]")
        )
      ) {
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
    if (active && inline)
      document.querySelector<HTMLInputElement>(".cb-inline input")?.focus();
  }, [inline, selected, active]);
  async function run(action: () => Promise<void | string>) {
    if (blocked || issue) return;
    setBusy(true);
    try {
      const success = await action();
      setMessage(success || "Image copied. Paste with Ctrl+V.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }
  function field(
    label: string,
    value: string | number,
    onApply: (v: string) => void,
    floating = false,
  ) {
    return (
      <Field
        key={`${inputEpoch}-${s.id}-${labelKey}-${label}`}
        controlRef={floating ? inlineField : undefined}
        onApplied={floating ? closeEditor : undefined}
        onCancelled={floating ? closeEditor : undefined}
        label={label}
        value={value}
        onApply={onApply}
        pending={inputPending}
        disabled={
          busy || recovery !== null || (dirty.size > 0 && !dirty.has(label))
        }
      />
    );
  }
  function selectShape(id: string) {
    if (blocked) return;
    setSelected(id);
    setInline(null);
    setShowHidden(false);
  }
  function editTarget(shapeId: string, k: Target["key"]) {
    if (blocked) return;
    setSelected(shapeId);
    if (k !== "area") setLabelKey(k);
    setTab(k === "area" ? "shading" : "labels");
    setInline(k);
  }
  function view(value: Shape["view"]) {
    safe(() => patch({ view: value }));
  }
  function addShape() {
    safe(() => {
      const next = newShape(`cuboid-${crypto.randomUUID().slice(0, 8)}`);
      commit({ ...e, document: { ...d, shapes: [...d.shapes, next] } });
      setSelected(next.id);
      setInline(null);
    });
  }
  function removeShape() {
    safe(() => {
      const shapes = d.shapes.filter((x) => x.id !== s.id);
      commit({ ...e, document: { ...d, shapes } });
      setSelected(shapes[0].id);
      setInline(null);
    });
  }
  const currentTarget = m?.targets.find(
    (t) => t.shapeId === s.id && t.key === inline,
  );
  function closeEditor() {
    const anchor = `${s.id}-${inline}`;
    setInline(null);
    requestAnimationFrame(() =>
      document
        .querySelector<HTMLElement>(`[data-cb-anchor="${anchor}"]`)
        ?.focus({ preventScroll: true }),
    );
  }
  const labelValue =
    inline === "area"
      ? a.area.mode === "text"
        ? a.area.text
        : faceAreaLabel(s)
      : l.mode === "text"
        ? l.text
        : l.mode === "value"
          ? s.dimensions[labelKey as (typeof axes)[number]]
          : labelText(s, labelKey);
  function inlineApply(v: string) {
    if (inline === "area") {
      area({ mode: "text", text: v });
      return;
    }
    if (l.mode === "value" && axes.includes(labelKey as (typeof axes)[number]))
      changeShape((x) => setDimension(x, labelKey as (typeof axes)[number], v));
    else patchLabel({ mode: "text", text: v });
  }
  let cubes = "";
  try {
    const c = decomposition(s);
    cubes = `${c.width} across × ${c.depth} deep × ${c.height} high; cube side ${cubeSideInUnit(s)} ${s.unit}.`;
  } catch (err) {
    cubes = err instanceof Error ? err.message : String(err);
  }
  const check = (
    label: string,
    value: boolean,
    onChange: (v: boolean) => void,
  ) => (
    <label>
      <input
        type="checkbox"
        checked={value}
        disabled={blocked}
        onChange={(ev) => safe(() => onChange(ev.target.checked))}
      />
      {label}
    </label>
  );
  return (
    <div className="app-shell booklet-editor cb-editor">
      <main
        className="main-content"
        id={active ? "main-content" : undefined}
        tabIndex={-1}
      >
        <PageHeading
          title="Cuboids"
          description="Draw and label cuboids, show their cubes, and reveal each layer."
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
              onReset={() => replacement(newDocument(), "Reset these cuboids?")}
              resetDisabled={blocked}
              exportDisabled={blocked || !!issue}
              menuDisabled={blocked}
              busy={busy}
              onCopy={() =>
                void run(async () => {
                  const m = await prepareImage(e);
                  await copyWord(e);
                  return (
                    "Copied for Word at " +
                    formatResourceSize(m.width, m.height) +
                    ". Paste with Ctrl+V."
                  );
                })
              }
              onCopyClipboard={() =>
                void run(() => copyPngToClipboard(() => printPng(e)))
              }
              menuId="cuboids-downloads"
              menuOpen={menu}
              onToggleMenu={() => setMenu(!menu)}
            />
            <EditorDownloadMenu
              id="cuboids-downloads"
              open={menu}
              active={active}
              onClose={() => setMenu(false)}
              onBusyChange={setBusy}
              onMessage={setMessage}
              actions={[
                {
                  label: "Download SVG",
                  action: () => downloadImage(e, "svg"),
                  disabled: blocked || !!issue,
                  success: "SVG download started.",
                },
                {
                  label: "Download PNG (600 ppi)",
                  action: () => downloadImage(e, "png"),
                  disabled: blocked || !!issue,
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
                  success: "",
                  picker: true,
                },
                {
                  label: "Copy editable link",
                  action: () =>
                    navigator.clipboard.writeText(
                      editorLink(e, location.origin + location.pathname),
                    ),
                  disabled: blocked,
                  success: "Editable link copied.",
                  description: LINK_DESCRIPTION,
                },
              ]}
            />
            <div className="cb-preview-bar">
              <label>
                View{" "}
                <select
                  aria-label="View"
                  value={s.view}
                  disabled={blocked}
                  onChange={(ev) => view(ev.target.value as Shape["view"])}
                >
                  <option value="plain">Exam diagram</option>
                  <option value="cubes">Show cubes</option>
                  <option value="layers" disabled={a.mode === "one"}>
                    Separate layers
                  </option>
                </select>
              </label>
              <button
                className="cb-quick-cubes"
                disabled={blocked}
                onClick={() =>
                  safe(() => patch({ view: "cubes", cubeSideCm: "1" }))
                }
              >
                Show 1 cm³ cubes
              </button>

              <PreviewControls zoom={zoom} onZoom={setZoom} />
              <ResourceSize
                width={cropSize.key === cropKey ? cropSize.width : undefined}
                height={cropSize.key === cropKey ? cropSize.height : undefined}
                pending={
                  !issue &&
                  (cropSize.key !== cropKey ||
                    (!cropSize.error && cropSize.width === undefined))
                }
                error={!!issue || cropSize.error}
              />
              <span>Click a label to edit</span>
            </div>
            {issue && (
              <p className="cb-export-warning" role="alert">
                {issue}
              </p>
            )}
            <div
              className="cb-scroll"
              ref={fitted.ref}
              onClick={(ev) => {
                if (ev.target === ev.currentTarget && !dirty.size)
                  setInline(null);
              }}
            >
              {m ? (
                <div
                  className="cb-stage"
                  style={{ width: m.width * unit, height: m.height * unit }}
                >
                  <div
                    className="cb-resource"
                    data-testid="cuboid-resource"
                    style={{ width: m.width * unit, height: m.height * unit }}
                    onClick={(ev) => {
                      if (ev.target instanceof SVGElement && !dirty.size)
                        setInline(null);
                    }}
                  >
                    <div
                      className="cb-art"
                      dangerouslySetInnerHTML={{ __html: m.svg }}
                    />
                    {m.targets
                      .filter(
                        (t) =>
                          showHidden ||
                          (t.key === "area"
                            ? faceAreaLabel(
                                d.shapes.find((s) => s.id === t.shapeId)!,
                              )
                            : labelText(
                                d.shapes.find((s) => s.id === t.shapeId)!,
                                t.key,
                              )),
                      )
                      .map((t) => (
                        <button
                          key={`${t.shapeId}-${t.key}`}
                          className="cb-hit"
                          data-cb-anchor={`${t.shapeId}-${t.key}`}
                          aria-label={`Edit ${t.key} label on ${t.shapeId}`}
                          disabled={blocked}
                          style={{
                            left: t.x * unit,
                            top: t.y * unit,
                            width: t.width * unit,
                            height: (t.height ?? 6) * unit,
                          }}
                          onClick={() => editTarget(t.shapeId, t.key)}
                        />
                      ))}
                  </div>
                </div>
              ) : (
                <div className="cb-empty">
                  The diagram cannot fit these labels. Increase Print width or
                  shorten labels. Your work is retained.
                </div>
              )}
            </div>
            <div className="cb-structure" aria-label="Cuboid structure">
              <div className="cb-structure-group">
                <button
                  disabled={blocked || d.shapes.length >= 3}
                  onClick={addShape}
                  aria-label="Add cuboid"
                >
                  + Cuboid
                </button>
                <button
                  disabled={blocked || d.shapes.length <= 1}
                  onClick={removeShape}
                  aria-label="Remove selected cuboid"
                >
                  − Cuboid
                </button>
              </div>
              {s.view !== "plain" &&
                axes.map((a) => (
                  <div className="cb-structure-group" key={a}>
                    <span>{a[0].toUpperCase() + a.slice(1)}</span>
                    <button
                      aria-label={`Remove one cube from ${a}`}
                      disabled={blocked}
                      onClick={() =>
                        safe(() => changeShape((x) => grow(x, a, -1)))
                      }
                    >
                      −
                    </button>
                    <button
                      aria-label={`Add one cube to ${a}`}
                      disabled={blocked}
                      onClick={() =>
                        safe(() => changeShape((x) => grow(x, a, 1)))
                      }
                    >
                      +
                    </button>
                  </div>
                ))}
            </div>
            {dirty.size > 0 && (
              <p className="cb-message cb-error" role="status">
                Apply or cancel unfinished input before exporting or changing
                other settings.
              </p>
            )}
            {message && (
              <p className="resource-feedback" role="status">
                {message}
              </p>
            )}
            {recovery !== null && (
              <div className="cb-message">
                <p>Protect the recovery data before starting afresh.</p>
                <button
                  onClick={() => {
                    downloadBlob(
                      new Blob([recovery], { type: "application/json" }),
                      "cuboids-recovery.json",
                    );
                    setRecoverySaved(true);
                  }}
                >
                  Download recovery data
                </button>
                <button
                  disabled={!recoverySaved}
                  onClick={() => {
                    expected.current = null;
                    setRecovery(null);
                    setHistory({
                      past: [],
                      present: newDocument(),
                      future: [],
                    });
                    setSelected("cuboid-1");
                    setInline(null);
                    setDirty(new Set());
                    setInputEpoch((n) => n + 1);
                    setMessage("");
                  }}
                >
                  Start afresh
                </button>
              </div>
            )}
            <input
              ref={file}
              aria-label="Open cuboids file"
              type="file"
              accept=".json,application/json"
              hidden
              onChange={(ev) => {
                const f = ev.target.files?.[0];
                ev.target.value = "";
                if (f)
                  void f.text().then((raw) => {
                    try {
                      replacement(parseFile(raw), "Open these cuboids?");
                    } catch (err) {
                      setMessage(
                        err instanceof Error ? err.message : String(err),
                      );
                    }
                  });
              }}
            />
          </Panel>
          <aside
            className="inspector-stack cb-inspector"
            aria-label="Cuboid settings"
          >
            <ExampleGallery
              examples={cuboidGallery}
              active={active}
              disabled={blocked || !!pending}
              onUse={(resource, title) =>
                replacement(resource, `Open ${title}?`)
              }
              onWorked={(resource) =>
                openWorkedDocument(
                  "cuboids",
                  "maths-booklet-tools:cuboids:v1",
                  canonical(resource),
                )
              }
            />
            <section className="panel-card cb-settings">
              {d.shapes.length > 1 && (
                <label>
                  Selected cuboid{" "}
                  <select
                    aria-label="Selected cuboid"
                    disabled={blocked}
                    value={s.id}
                    onChange={(ev) => selectShape(ev.target.value)}
                  >
                    {d.shapes.map((shape, i) => (
                      <option key={shape.id} value={shape.id}>
                        {shape.title || `Cuboid ${i + 1}`}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <div
                className="cb-tabs"
                role="tablist"
                aria-label="Cuboid settings sections"
              >
                {(["shape", "labels", "shading"] as const).map((t) => (
                  <button
                    key={t}
                    role="tab"
                    id={`cb-tab-${t}`}
                    aria-selected={tab === t}
                    tabIndex={tab === t ? 0 : -1}
                    onKeyDown={(ev) => {
                      const tabs = ["shape", "labels", "shading"] as const;
                      const index = tabs.indexOf(t);
                      const next =
                        ev.key === "ArrowRight"
                          ? tabs[(index + 1) % 3]
                          : ev.key === "ArrowLeft"
                            ? tabs[(index + 2) % 3]
                            : ev.key === "Home"
                              ? tabs[0]
                              : ev.key === "End"
                                ? tabs[2]
                                : null;
                      if (next) {
                        ev.preventDefault();
                        setTab(next);
                        document.getElementById(`cb-tab-${next}`)?.focus();
                      }
                    }}
                    aria-controls={`cb-panel-${t}`}
                    onClick={() => setTab(t)}
                  >
                    {t[0].toUpperCase() + t.slice(1)}
                  </button>
                ))}
              </div>
              <div
                role="tabpanel"
                id="cb-panel-shape"
                aria-labelledby="cb-tab-shape"
                hidden={tab !== "shape"}
              >
                <div className="cb-dimensions">
                  {axes.map((axis) =>
                    field(
                      axis[0].toUpperCase() + axis.slice(1),
                      s.dimensions[axis],
                      (v) => changeShape((x) => setDimension(x, axis, v)),
                    ),
                  )}
                </div>
                <div className="cb-units-row">
                  <label>
                    Units{" "}
                    <select
                      aria-label="Units"
                      disabled={blocked}
                      value={s.unit}
                      onChange={(ev) =>
                        safe(() =>
                          changeShape((x) =>
                            setUnit(x, ev.target.value as Shape["unit"]),
                          ),
                        )
                      }
                    >
                      <option>cm</option>
                      <option>mm</option>
                      <option>m</option>
                    </select>
                  </label>
                  {check("Cube (equal edges)", s.cube, (v) =>
                    patch({
                      cube: v,
                      ...(v
                        ? {
                            dimensions: {
                              width: s.dimensions.width,
                              depth: s.dimensions.width,
                              height: s.dimensions.width,
                            },
                          }
                        : {}),
                    }),
                  )}
                </div>
                {
                  <details>
                    <summary>Cube size and counts</summary>
                    {field("Cube side length", cubeSideInUnit(s), (v) =>
                      changeShape((x) => setCubeSide(x, v)),
                    )}
                    <p className="cb-note">{cubes}</p>
                    {check("Show cube counts", s.counts, (v) =>
                      patch({ counts: v }),
                    )}
                    {s.view === "layers" &&
                      check("Number the layers", s.layerNumbers, (v) =>
                        patch({ layerNumbers: v }),
                      )}
                  </details>
                }
                <details>
                  <summary>More shape options</summary>
                  {field("Cuboid title", s.title, (v) => patch({ title: v }))}
                  <label>
                    Receding direction{" "}
                    <select
                      aria-label="Receding direction"
                      disabled={blocked}
                      value={s.direction}
                      onChange={(ev) =>
                        safe(() =>
                          patch({
                            direction: ev.target.value as Shape["direction"],
                          }),
                        )
                      }
                    >
                      <option value="right">Right</option>
                      <option value="left">Left</option>
                    </select>
                  </label>
                  <label>
                    Drawing depth{" "}
                    <select
                      aria-label="Drawing depth"
                      disabled={blocked}
                      value={s.projection}
                      onChange={(ev) =>
                        safe(() =>
                          patch({
                            projection: ev.target.value as Shape["projection"],
                          }),
                        )
                      }
                    >
                      <option value="compact">Compact</option>
                      <option value="standard">Standard</option>
                      <option value="deep">Deep</option>
                    </select>
                  </label>
                  {check(
                    "Dashed hidden edges (exam view)",
                    s.hiddenEdges,
                    (v) => patch({ hiddenEdges: v }),
                  )}
                  {check("Dimension arrows (exam view)", s.arrows, (v) =>
                    patch({ arrows: v }),
                  )}
                  {e.schemaVersion === 1 && (
                    <>
                      <p className="cb-note">
                        Original saved layout is retained.
                      </p>
                      <button
                        className="cb-action"
                        disabled={blocked}
                        onClick={() => safe(() => commit(upgrade(e)))}
                      >
                        Use current exam layout
                      </button>
                    </>
                  )}
                  {check(
                    "Schematic proportions (exam view)",
                    s.schematic,
                    (v) => patch({ schematic: v }),
                  )}
                  {s.schematic &&
                    axes.map((axis) =>
                      field(`Drawing ${axis} ratio`, s.proportions[axis], (v) =>
                        patch({
                          proportions: {
                            ...s.proportions,
                            [axis]: dimension(v),
                          },
                        }),
                      ),
                    )}
                </details>
                {warnings(s).map((w) => (
                  <p className="cb-note" key={w}>
                    {w}
                  </p>
                ))}
              </div>
              <div
                role="tabpanel"
                id="cb-panel-labels"
                aria-labelledby="cb-tab-labels"
                hidden={tab !== "labels"}
              >
                <label>
                  Edge or face{" "}
                  <select
                    aria-label="Edge or face"
                    disabled={blocked}
                    value={labelKey}
                    onChange={(ev) => {
                      setLabelKey(ev.target.value as LabelKey);
                      setInline(null);
                    }}
                  >
                    {keys.map((k) => (
                      <option key={k} value={k}>
                        {k[0].toUpperCase() + k.slice(1)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Label appearance{" "}
                  <select
                    aria-label="Label appearance"
                    disabled={blocked}
                    value={l.mode}
                    onChange={(ev) =>
                      safe(() =>
                        patchLabel({ mode: ev.target.value as Label["mode"] }),
                      )
                    }
                  >
                    <option value="hidden">Hidden</option>
                    {axes.includes(labelKey as (typeof axes)[number]) ? (
                      <option value="value">Dimension</option>
                    ) : (
                      <option value="area">Face area</option>
                    )}
                    <option value="blank">Answer line</option>
                    <option value="text">Custom text</option>
                  </select>
                </label>
                {l.mode === "text" &&
                  field("Label text", l.text, (v) => patchLabel({ text: v }))}
                <details>
                  <summary>Position and advanced</summary>
                  {s.view === "layers" && labelKey === "height" ? (
                    <p className="cb-note">
                      Full height is fixed below the complete layers.
                    </p>
                  ) : (
                    <div className="cb-grid">
                      {field("Label horizontal offset", l.x, (v) =>
                        patchLabel({ x: Number(v) }),
                      )}
                      {field("Label vertical offset", l.y, (v) =>
                        patchLabel({ y: Number(v) }),
                      )}
                    </div>
                  )}
                  {check(
                    "Show editing targets for hidden labels",
                    showHidden,
                    (v) => setShowHidden(v),
                  )}
                </details>
                <details>
                  <summary>Worked values and captions</summary>
                  {check("Show worked volume", s.workedVolume, (v) =>
                    patch({ workedVolume: v }),
                  )}
                  {check("Show worked surface area", s.workedArea, (v) =>
                    patch({ workedArea: v }),
                  )}
                  {field("Caption", s.caption, (v) => patch({ caption: v }))}
                  <p className="cb-note">
                    Calculations use the actual dimensions. Pupil blanks and
                    custom labels remain unchanged.
                  </p>
                </details>
              </div>
              <div
                role="tabpanel"
                id="cb-panel-shading"
                aria-labelledby="cb-tab-shading"
                hidden={tab !== "shading"}
              >
                <div className="cb-shade-options" aria-label="Shading style">
                  {(
                    [
                      ["outline", "Outline"],
                      ["faces", "Grey faces"],
                      ["one", "One face"],
                    ] as const
                  ).map(([mode, name]) => (
                    <button
                      key={mode}
                      className="cb-action"
                      aria-pressed={a.mode === mode}
                      disabled={blocked}
                      onClick={() =>
                        safe(() =>
                          changeShape((x) => ({
                            ...x,
                            ...(mode === "one" && x.view === "layers"
                              ? { view: "plain" as const }
                              : {}),
                            appearance: { ...appearance(x), mode },
                          })),
                        )
                      }
                    >
                      {name}
                    </button>
                  ))}
                </div>
                {a.mode !== "outline" && (
                  <label>
                    Print tones{" "}
                    <select
                      aria-label="Print tones"
                      disabled={blocked}
                      value={a.tone}
                      onChange={(ev) =>
                        safe(() =>
                          paint({
                            tone: ev.target.value as Appearance["tone"],
                          }),
                        )
                      }
                    >
                      <option value="light">Light</option>
                      <option value="strong">Strong</option>
                    </select>
                  </label>
                )}
                {a.mode === "faces" && (
                  <p className="cb-note">
                    Three neutral face tones, with black outlines and cube
                    grids.
                  </p>
                )}
                {a.mode === "one" && (
                  <>
                    <label>
                      Shaded face{" "}
                      <select
                        aria-label="Shaded face"
                        disabled={blocked}
                        value={a.face}
                        onChange={(ev) =>
                          safe(() =>
                            paint({
                              face: ev.target.value as Appearance["face"],
                            }),
                          )
                        }
                      >
                        {faceNames.map((face) => (
                          <option key={face} value={face}>
                            {face === "bottom"
                              ? "Bottom (base)"
                              : face[0].toUpperCase() + face.slice(1)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <p className="cb-note">
                      An existing face, shown through the unshaded outline. Use
                      an assembled view; choose Outline or Grey faces to
                      separate layers.
                    </p>
                    <label>
                      Area label{" "}
                      <select
                        aria-label="Area label"
                        disabled={blocked}
                        value={a.area.mode}
                        onChange={(ev) =>
                          safe(() =>
                            area({
                              mode: ev.target
                                .value as Appearance["area"]["mode"],
                            }),
                          )
                        }
                      >
                        <option value="hidden">Hidden</option>
                        <option value="blank">Answer line</option>
                        <option value="value">Calculated value</option>
                        <option value="text">Custom text</option>
                      </select>
                    </label>
                    {a.area.mode !== "hidden" && (
                      <label>
                        Area heading{" "}
                        <select
                          aria-label="Area heading"
                          disabled={blocked}
                          value={a.area.heading}
                          onChange={(ev) =>
                            safe(() =>
                              area({
                                heading: ev.target
                                  .value as Appearance["area"]["heading"],
                              }),
                            )
                          }
                        >
                          {[
                            "Base area",
                            "Cross-sectional area",
                            "Face area",
                          ].map((h) => (
                            <option key={h}>{h}</option>
                          ))}
                        </select>
                      </label>
                    )}
                    {a.area.mode === "text" &&
                      field("Area text", a.area.text, (v) => area({ text: v }))}
                    {a.area.mode === "value" &&
                      check(
                        "Show area multiplication",
                        a.area.expression,
                        (v) => area({ expression: v }),
                      )}
                  </>
                )}
              </div>
              <details className="cb-settings-footer">
                <summary>Print settings</summary>
                <p className="cb-note">
                  {m
                    ? `${(m.width / 10).toFixed(1)} × ${(m.height / 10).toFixed(1)} cm layout size; actual export crops closely around the artwork.`
                    : "Review the resource settings."}
                </p>
                {field("Print width (cm)", d.widthCm, (v) =>
                  commit({ ...e, document: { ...d, widthCm: Number(v) } }),
                )}
                <p className="cb-note">
                  Width before trimming. Images keep their scale and trim unused
                  outer space. Preview zoom does not change printing.
                </p>
              </details>
            </section>
          </aside>
        </section>
      </main>
      {inline && currentTarget && (
        <FloatingEditor
          active={active && !pending && recovery === null}
          anchor={`${s.id}-${inline}`}
          title={inline === "area" ? "Edit face area" : `Edit ${inline}`}
        >
          {field(
            inline === "area" ? "Edit face area" : `Edit ${inline}`,
            labelValue,
            inlineApply,
            true,
          )}
          <div className="cb-floating-actions">
            <button
              onClick={() => {
                if (inlineField.current?.apply()) closeEditor();
              }}
            >
              Apply
            </button>
            <button
              onClick={() => {
                inlineField.current?.cancel();
                closeEditor();
              }}
            >
              Cancel
            </button>
          </div>
        </FloatingEditor>
      )}
      {active && pending && (
        <ResourceDialog
          title={pending.title}
          confirmLabel="Use these cuboids"
          disabled={blocked}
          onCancel={() => setPending(null)}
          onConfirm={() => {
            commit(pending.e);
            setSelected(pending.e.document.shapes[0].id);
            setInline(null);
            setPending(null);
            if (location.hash.includes("cuboids="))
              window.history.replaceState(
                {},
                "",
                location.pathname + location.search,
              );
          }}
        >
          <p>Your current diagram will be replaced. Undo can restore it.</p>
          <div
            className="ratio-import-preview"
            dangerouslySetInnerHTML={{ __html: layout(pending.e).svg }}
          />
        </ResourceDialog>
      )}
    </div>
  );
}
