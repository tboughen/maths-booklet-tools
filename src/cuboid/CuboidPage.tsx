import { useCallback, useEffect, useRef, useState } from "react";
import {
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
import { examples } from "../../packages/cuboid-core/src/examples";
import { EditorToolbar } from "../site/EditorToolbar";
import { PageHeading, Panel } from "../site/PageHeading";
import { RatioDialog as ResourceDialog } from "../ratio-table/RatioDialog";
import { copyPngToClipboard, downloadBlob } from "../export/clipboard";
import { printPng, downloadImage, copyWord, downloadEditable } from "./export";
import { CuboidField as Field } from "./CuboidField";
import "./cuboid.css";
const STORAGE = "maths-booklet-tools:cuboids:v1";
function initial() {
  try {
    const raw = localStorage.getItem(STORAGE);
    if (raw) {
      try {
        return { e: parseFile(raw), recovery: null, error: "" };
      } catch {
        return {
          e: create(),
          recovery: raw,
          error:
            "Saved cuboids need recovery. Download the original data before starting afresh.",
        };
      }
    }
  } catch {
    return {
      e: create(),
      recovery: null,
      error:
        "Device storage is unavailable. Save an editable file to keep your work.",
    };
  }
  return { e: create(), recovery: null, error: "" };
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
    [inline, setInline] = useState<LabelKey | null>(null),
    [showHidden, setShowHidden] = useState(false);
  const [pending, setPending] = useState<{ title: string; e: Envelope } | null>(
      null,
    ),
    [menu, setMenu] = useState(false),
    [busy, setBusy] = useState(false),
    [zoom, setZoom] = useState(1),
    [dirty, setDirty] = useState<Set<string>>(new Set());
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
  const blocked = busy || recovery !== null || dirty.size > 0,
    unit = (96 / 25.4) * zoom,
    issue = exportIssue(e);
  let m: ReturnType<typeof layout> | null = null;
  try {
    m = layout(e);
  } catch {
    /*Keep the document and correction controls available.*/
  }
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
    commit({
      ...prev,
      document: {
        ...prev.document,
        shapes: prev.document.shapes.map((x) =>
          x.id === s.id ? update(x) : x,
        ),
      },
    });
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
    changeShape((x) => ({ ...x, ...p }));
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
  async function run(action: () => Promise<void>) {
    if (blocked || issue) return;
    setBusy(true);
    try {
      await action();
      setMessage("Resource ready.");
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
  ) {
    return (
      <Field
        key={`${s.id}-${labelKey}-${label}`}
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
  function editTarget(shapeId: string, k: LabelKey) {
    if (blocked) return;
    setSelected(shapeId);
    setLabelKey(k);
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
  const labelValue =
    l.mode === "text"
      ? l.text
      : l.mode === "value"
        ? s.dimensions[labelKey as (typeof axes)[number]]
        : labelText(s, labelKey);
  function inlineApply(v: string) {
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
          <span role="status">{saveState}</span>
        </PageHeading>
        <section className="workspace">
          <Panel className="editor-card">
            <EditorToolbar
              canUndo={!blocked && history.past.length > 0}
              canRedo={!blocked && history.future.length > 0}
              onUndo={undo}
              onRedo={redo}
              onReset={() => replacement(create(), "Reset these cuboids?")}
              resetDisabled={blocked}
              exportDisabled={blocked || !!issue}
              busy={busy}
              onCopy={() => void run(() => copyWord(e))}
              onCopyClipboard={() =>
                void run(() => copyPngToClipboard(() => printPng(e)))
              }
              menuOpen={menu}
              onToggleMenu={() => setMenu(!menu)}
            />
            {menu && (
              <div className="cb-downloads">
                <button
                  disabled={blocked || !!issue}
                  onClick={() => void run(() => downloadImage(e, "png"))}
                >
                  Download PNG (600 ppi)
                </button>
                <button
                  disabled={blocked || !!issue}
                  onClick={() => void run(() => downloadImage(e, "svg"))}
                >
                  Download SVG
                </button>
                <button
                  disabled={busy || dirty.size > 0}
                  onClick={() => downloadEditable(e)}
                >
                  Save editable file
                </button>
                <button
                  disabled={blocked}
                  onClick={() => file.current?.click()}
                >
                  Open editable file
                </button>
                <button
                  disabled={blocked}
                  onClick={() => {
                    void navigator.clipboard
                      .writeText(
                        editorLink(e, location.origin + location.pathname),
                      )
                      .then(
                        () => setMessage("Editor link copied."),
                        () =>
                          setMessage(
                            "Copying the link was blocked. Save an editable file instead.",
                          ),
                      );
                  }}
                >
                  Copy editor link
                </button>
              </div>
            )}
            <div className="cb-preview-bar">
              <label>
                Preview zoom{" "}
                <select
                  aria-label="Preview zoom"
                  value={zoom}
                  onChange={(ev) => setZoom(Number(ev.target.value))}
                >
                  {[0.75, 1, 1.25, 1.5].map((n) => (
                    <option key={n} value={n}>
                      {n * 100}%
                    </option>
                  ))}
                </select>
              </label>
              <span>
                {m
                  ? `${(m.width / 10).toFixed(1)} × ${(m.height / 10).toFixed(1)} cm print size`
                  : "Adjust settings to restore the diagram"}
              </span>
              <span>Click a label to edit</span>
            </div>
            {issue && (
              <p className="cb-export-warning" role="alert">
                {issue}
              </p>
            )}
            <div
              className="cb-scroll"
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
                          labelText(
                            d.shapes.find((s) => s.id === t.shapeId)!,
                            t.key,
                          ),
                      )
                      .map((t) => (
                        <button
                          key={`${t.shapeId}-${t.key}`}
                          className="cb-hit"
                          aria-label={`Edit ${t.key} label on ${t.shapeId}`}
                          disabled={blocked}
                          style={{
                            left: t.x * unit,
                            top: t.y * unit,
                            width: t.width * unit,
                            height: 6 * unit,
                          }}
                          onClick={() => editTarget(t.shapeId, t.key)}
                        />
                      ))}
                    {inline && currentTarget && (
                      <div
                        className="cb-inline"
                        style={{
                          left: Math.max(
                            65,
                            Math.min(
                              m.width * unit - 65,
                              currentTarget.x * unit,
                            ),
                          ),
                          top: Math.max(24, currentTarget.y * unit),
                        }}
                      >
                        {field(`Edit ${inline}`, labelValue, inlineApply)}
                        <button
                          disabled={dirty.size > 0}
                          onClick={() => setInline(null)}
                        >
                          Finish editing
                        </button>
                      </div>
                    )}
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
              <p className="cb-message" role="status">
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
                    setHistory({ past: [], present: create(), future: [] });
                    setSelected("cuboid-1");
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
            <section className="panel-card specialist-tools">
              <h2>Diagram view</h2>
              <label>
                Selected cuboid
                <select
                  aria-label="Selected cuboid"
                  disabled={blocked}
                  value={s.id}
                  onChange={(ev) => selectShape(ev.target.value)}
                >
                  {d.shapes.map((s, i) => (
                    <option key={s.id} value={s.id}>
                      {s.title || `Cuboid ${i + 1}`}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                View
                <select
                  aria-label="View"
                  value={s.view}
                  disabled={blocked}
                  onChange={(ev) => view(ev.target.value as Shape["view"])}
                >
                  <option value="plain">Exam diagram</option>
                  <option value="cubes">Show cubes</option>
                  <option value="layers">Separate layers</option>
                </select>
              </label>
              <button
                className="secondary-panel-button"
                disabled={blocked}
                onClick={() =>
                  safe(() => patch({ view: "cubes", cubeSideCm: "1" }))
                }
              >
                Show 1 cm³ cubes
              </button>
              <p className="cb-note">
                Black lines on white. The grid shows visible faces; separate
                layers reveals the interior cubes.
              </p>
              <details open={s.view !== "plain"}>
                <summary>Cube size and counts</summary>
                {field("Cube side length", cubeSideInUnit(s), (v) =>
                  changeShape((x) => setCubeSide(x, v)),
                )}
                <p className="cb-note">
                  Side length in {s.unit}. A 2 cm cube is 8 cm³; a 4 cm cube is
                  64 cm³.
                </p>
                {s.view !== "plain" && (
                  <>
                    <p className="cb-note">{cubes}</p>
                    {check("Show cube counts", s.counts, (v) =>
                      patch({ counts: v }),
                    )}
                    {s.view === "layers" &&
                      check("Number the layers", s.layerNumbers, (v) =>
                        patch({ layerNumbers: v }),
                      )}
                  </>
                )}
              </details>
              {warnings(s).map((w) => (
                <p key={w} className="cb-note">
                  {w}
                </p>
              ))}
            </section>
            <section className="panel-card">
              <h2>Dimensions</h2>
              {field("Cuboid title", s.title, (v) => patch({ title: v }))}
              <label>
                Units
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
              {axes.map((a) =>
                field(a[0].toUpperCase() + a.slice(1), s.dimensions[a], (v) =>
                  changeShape((x) => setDimension(x, a, v)),
                ),
              )}
              <p className="cb-note">
                Dimensions describe the shape. Labels can be blank or contain an
                expression without changing these proportions.
              </p>
            </section>
            <section className="panel-card">
              <h2>Labels</h2>
              <label>
                Edge or face
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
                Label appearance
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
              {s.view === "layers" && labelKey === "height" ? (
                <p className="cb-note">
                  The full height has a fixed position below the separated
                  layers.
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
              <p className="cb-note">
                Offsets are in mm, up to 8 in either direction. Hidden labels
                are retained. Changing a view never fills a blank.
              </p>
              {check(
                "Show editing targets for hidden labels",
                showHidden,
                (v) => setShowHidden(v),
              )}
            </section>
            <section className="panel-card">
              <details>
                <summary>Drawing and print settings</summary>
                <label>
                  Receding direction
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
                  Drawing depth
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
                {check("Dashed hidden edges (exam view)", s.hiddenEdges, (v) =>
                  patch({ hiddenEdges: v }),
                )}
                {check("Dimension arrows (exam view)", s.arrows, (v) =>
                  patch({ arrows: v }),
                )}
                {check("Schematic proportions (exam view)", s.schematic, (v) =>
                  patch({ schematic: v }),
                )}
                {s.schematic &&
                  axes.map((a) =>
                    field(`Drawing ${a} ratio`, s.proportions[a], (v) =>
                      patch({
                        proportions: { ...s.proportions, [a]: dimension(v) },
                      }),
                    ),
                  )}
                {field("Print width (cm)", d.widthCm, (v) =>
                  commit({ ...e, document: { ...d, widthCm: Number(v) } }),
                )}
                <p className="cb-note">
                  4–18 cm including labels. Print cubes represent real
                  centimetres; their printed edges are scaled to fit. Cube cells
                  must print at least 2 mm across.
                </p>
              </details>
            </section>
            <section className="panel-card">
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
                  Worked values use the dimensions, not custom label text. Only
                  request them when the dimensions are intended to be known.
                  Captions and answer lines are never overwritten.
                </p>
              </details>
            </section>
            <section className="panel-card">
              <details>
                <summary>Examples</summary>
                {examples
                  .filter((x) => !x.source)
                  .map((ex) => (
                    <article className="cb-example" key={ex.id}>
                      <h3>{ex.title}</h3>
                      <p>{ex.description}</p>
                      <div className="cb-panel-actions">
                        <button
                          disabled={blocked}
                          onClick={() =>
                            replacement(
                              ex.create(false),
                              `Use ${ex.title.toLowerCase()}?`,
                            )
                          }
                        >
                          Use scaffold
                        </button>
                        <button
                          disabled={blocked}
                          onClick={() =>
                            replacement(
                              ex.create(true),
                              `Use worked ${ex.title.toLowerCase()}?`,
                            )
                          }
                        >
                          Use worked example
                        </button>
                      </div>
                    </article>
                  ))}
              </details>
            </section>
            <section className="panel-card">
              <details>
                <summary>Past-paper examples</summary>
                <p className="cb-note">
                  Editable starting diagrams. Scaffold and worked choices are
                  separate; the source question opens alongside the editor.
                </p>
                {examples
                  .filter((x) => x.source)
                  .map((ex) => (
                    <article className="cb-example" key={ex.id}>
                      <h3>{ex.title}</h3>
                      <p>{ex.source}</p>
                      <p>{ex.description}</p>
                      <a
                        href={`https://mathsdock.co.uk/?tool=question-bank&question=${ex.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        View source question
                      </a>
                      <div className="cb-panel-actions">
                        <button
                          disabled={blocked}
                          onClick={() =>
                            replacement(
                              ex.create(false),
                              `Use ${ex.title.toLowerCase()}?`,
                            )
                          }
                        >
                          Use scaffold
                        </button>
                        <button
                          disabled={blocked}
                          onClick={() =>
                            replacement(
                              ex.create(true),
                              `Use worked ${ex.title.toLowerCase()}?`,
                            )
                          }
                        >
                          Use worked example
                        </button>
                      </div>
                    </article>
                  ))}
              </details>
            </section>
          </aside>
        </section>
      </main>
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
