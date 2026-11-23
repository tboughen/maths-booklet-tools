import { useTitleNote } from "../site/TitleNote";
import { TITLE_NOTE_STEP, withAbout } from "../site/titleNoteData";
import { aboutOf } from "../../packages/envelope-core/src/about";
import { pathLink, readPage } from "../site/routes";
import { housePreference, setLines } from "../site/houseStyle";
import { LINE_WEIGHTS, LINE_WEIGHT_NAMES, type LineWeight } from "../../packages/envelope-core/src/house-style";
import { useResourceFit } from "../site/useResourceFit";
import { ExampleGallery, ReturnToDiagram } from "../examples/ExampleGallery";
import { cuboidGallery } from "../examples/galleryCatalogue";
import { copyStorageKey } from "../site/copyDocument";
import { EditorFoot } from "../site/EditorFoot";
import { StructureStepper } from "../site/StructureStepper";
import { EditorHint } from "../site/EditorHint";
import { ResourceSaveStatus } from "../site/ResourceSaveStatus";
import {
  EditorDownloadMenu,
  type MenuKind,
} from "../site/EditorDownloadMenu";
import { diagramFileMenu } from "../site/fileMenu";
import { ResourceSize } from "../site/ResourceSize";
import { formatResourceSize } from "../site/resourceSizeFormat";
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import {
  appearance,
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
import { OptionsBox } from "../site/OptionsBox";
import { FoldCard } from "../site/CardHelp";
import { useMoreBelow } from "../site/useMoreBelow";
import { useCoarsePointer } from "../site/labelTargetHooks";
import { VisibilitySwitch } from "../site/VisibilitySwitch";
import { PupilSpaceHint } from "../site/LabelTargets";
import { TARGET_TIP, TARGET_TIP_SPACE, commonVisibility, togglePupilSpace, visibilityStep, type Visibility } from "../editor-kit/visibility";
import { Box, Eye, Paintbrush, Printer, Tag } from "lucide-react";
import { CuboidField as Field, type FieldHandle } from "./CuboidField";
import "./cuboid.css";
import "../site/settings-kit.css";
import { createHistory, handleUndoKeys, openDraft, useDocumentHistory, useDraftAutosave, redoLabel as redoStepName, undoLabel as undoStepName, stepName } from "../editor-kit";
import { downloadName } from "../export/filenames";
const STORAGE = copyStorageKey("maths-booklet-tools:cuboids:v1");
/** A new drawing starts from the house style's lines (U111); its text is always 11 pt. */
const newDocument = () => {
  const e = create();
  if (housePreference().lines === "bold") e.document.lines = "bold";
  return e;
};
function initial() {
  const start = openDraft({ key: STORAGE, parse: parseFile, fresh: newDocument, recoveryMessage: "Saved cuboids need recovery. Download the original data before starting afresh." });
  return { e: start.document, recovery: start.recovery, error: start.message };
}
/**
 * What pupils see of a label, in the one vocabulary: a blank (dotted) label is a pupil space and a hidden one is left
 * out. What a shown label shows (its dimension, face area or own text) is kept while it is a pupil space or left out.
 */
type Shown = "value" | "area" | "text";
const labelSees = (mode: Label["mode"] | Appearance["area"]["mode"]): Visibility =>
  mode === "hidden" ? "omit" : mode === "blank" ? "hidden" : "show";
const isEdge = (k: string) => (axes as readonly string[]).includes(k);
const KEY_NAMES: Record<Target["key"], string> = { width: "Width", depth: "Depth", height: "Height", front: "Front face", top: "Top face", side: "Side face", area: "Face area" };

export default function CuboidPage({ active = true }: { active?: boolean }) {
  const [startup] = useState(initial),
    documentHistory = useDocumentHistory<Envelope>(startup.e, { equals: (a, b) => canonical(a) === canonical(b) }),
    { history, setHistory } = documentHistory;
  const [message, setMessage] = useState(startup.error),
    [recovery, setRecovery] = useState<string | null>(startup.recovery),
    [recoverySaved, setRecoverySaved] = useState(false);
  const [selected, setSelected] = useState(startup.e.document.shapes[0].id),
    [labelKey, setLabelKey] = useState<LabelKey>("width"),
    [inline, setInline] = useState<LabelKey | "area" | null>(null),
    [showHidden, setShowHidden] = useState(false),
    [boxAnchor, setBoxAnchor] = useState<HTMLElement | null>(null);
  const stackRef = useMoreBelow<HTMLElement>(),
    coarse = useCoarsePointer();
  // What each label showed before it became a pupil space or was left out, so Show brings it back exactly.
  const shownBefore = useRef(new Map<string, Shown>()),
    [, remembered] = useReducer((n: number) => n + 1, 0);
  const [pending, setPending] = useState<{ title: string; e: Envelope } | null>(
      null,
    ),
    [menu, setMenu] = useState<MenuKind | false>(false),
    [busy, setBusy] = useState(false),
    [zoom, setZoom] = useState(0),
    [dirty, setDirty] = useState<Set<string>>(new Set());
  const [inputEpoch, setInputEpoch] = useState(0);
  const inlineField = useRef<FieldHandle>(null);
  const file = useRef<HTMLInputElement>(null),
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
  function commit(value: Envelope, label?: string) {
    if (recovery !== null)
      throw Error("Protect recovery data before starting afresh.");
    const valid = validate(value);
    documentHistory.commit(valid, label);
    setMessage("");
  }
  function changeShape(update: (shape: Shape) => Shape, label?: string, id = s.id) {
    const prev = current.current;
    const next = {
      ...prev,
      document: {
        ...prev.document,
        shapes: prev.document.shapes.map((x) =>
          x.id === id ? update(x) : x,
        ),
      },
    };
    commit(next, label);
  }
  /** What a label shows when it is shown: what it showed last, else its own text, else its dimension or area. */
  function shownMode(shape: Shape, k: Target["key"]): Shown {
    const kept = shownBefore.current.get(`${shape.id}:${k}`);
    const text = k === "area" ? appearance(shape).area.text : shape.labels[k].text;
    const allowed: Shown[] = isEdge(k) || k === "area" ? ["value", "text"] : ["area", "text"];
    if (kept && allowed.includes(kept)) return kept;
    return text.trim() ? "text" : allowed[0];
  }
  function seesOf(shape: Shape, k: Target["key"]): Visibility {
    return labelSees(k === "area" ? appearance(shape).area.mode : shape.labels[k].mode);
  }
  /** One shape's labels set to Show, a pupil space or Leave out, in one undo step. */
  function setSees(shapeId: string, ks: readonly Target["key"][], v: Visibility, what: string) {
    safe(() =>
      changeShape(
        (x) => {
          let next = x;
          for (const k of ks) {
            const was = k === "area" ? appearance(next).area.mode : next.labels[k].mode;
            if (labelSees(was) === v) continue;
            if (labelSees(was) === "show") shownBefore.current.set(`${x.id}:${k}`, was as Shown);
            const mode = v === "hidden" ? "blank" : v === "omit" ? "hidden" : shownMode(next, k);
            next =
              k === "area"
                ? { ...next, appearance: { ...appearance(next), area: { ...appearance(next).area, mode: mode as Appearance["area"]["mode"] } } }
                : { ...next, labels: { ...next.labels, [k]: { ...next.labels[k], mode: mode as Label["mode"] } } };
          }
          return next;
        },
        visibilityStep(v, what),
        shapeId,
      ),
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
    documentHistory.undo();
    closeEditor();
  }
  function redo() {
    if (blocked) return;
    documentHistory.redo();
    closeEditor();
  }
  function replacement(next: Envelope, title: string) {
    if (blocked) {
      setMessage(
        "Apply or cancel unfinished input before replacing your cuboids.",
      );
      return;
    }
    closeEditor();
    setPending({ e: next, title });
  }
  // Autosave with protection for another tab's newer draft.
  const savedText = useMemo(() => canonical(history.present), [history.present]);
  const { saveState, keepStored } = useDraftAutosave({
    key: STORAGE,
    text: savedText,
    paused: recovery !== null,
    onConflict: (raw, reason) => {
      setRecovery(raw);
      setRecoverySaved(false);
      setMessage(reason === "newer" ? "A newer draft exists in another tab. Its data is protected." : "Saved cuboids changed in another tab. Download its data before replacing it.");
    },
  });
  useEffect(() => {
    if (!active) return;
    const handle = () => {
      if (readPage() !== "cuboids") return;
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
      if (event.key === "Escape" && !dirty.size) closeEditor();
      if (handleUndoKeys(event, { undo, redo })) return;
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });
  // A box whose label has gone (a removed cuboid, undo, a label left out) closes.
  useEffect(() => {
    if (inline && boxAnchor && !boxAnchor.isConnected) closeEditor();
  });
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
    closeEditor();
    setShowHidden(false);
  }
  function editTarget(shapeId: string, k: Target["key"], from?: HTMLElement) {
    if (blocked) return;
    setSelected(shapeId);
    if (k !== "area") setLabelKey(k);
    setInline(k);
    setBoxAnchor(from ?? document.querySelector<HTMLElement>(`[data-cb-anchor="${shapeId}-${k}"]`));
  }
  /** Double-click: a pupil space, and again back to what it showed. */
  function toggleTarget(shapeId: string, k: Target["key"]) {
    if (blocked) return;
    const shape = d.shapes.find((x) => x.id === shapeId);
    if (!shape) return;
    setSees(shapeId, [k], togglePupilSpace(seesOf(shape, k)), `${KEY_NAMES[k].toLowerCase()} label`);
  }
  function view(value: Shape["view"]) {
    safe(() => patch({ view: value }));
  }
  function addShape() {
    safe(() => {
      const next = newShape(`cuboid-${crypto.randomUUID().slice(0, 8)}`);
      commit({ ...e, document: { ...d, shapes: [...d.shapes, next] } });
      setSelected(next.id);
      closeEditor();
    });
  }
  function removeShape() {
    safe(() => {
      const shapes = d.shapes.filter((x) => x.id !== s.id);
      commit({ ...e, document: { ...d, shapes } });
      setSelected(shapes[0].id);
      closeEditor();
    });
  }
  const currentTarget = m?.targets.find(
    (t) => t.shapeId === s.id && t.key === inline,
  );
  function closeEditor() {
    setInline(null);
    setBoxAnchor(null);
  }
  /** The live options box beside a label: what it says, what pupils see, and what it shows. Each change is one undo step. */
  function labelBox(k: Target["key"]) {
    const sees = seesOf(s, k),
      edge = isEdge(k),
      name = KEY_NAMES[k].toLowerCase();
    const shows: Shown = k === "area" ? (a.area.mode === "text" ? "text" : sees === "show" ? "value" : shownMode(s, k)) : sees === "show" ? (l.mode as Shown) : shownMode(s, k);
    const setShows = (next: Shown) =>
      safe(() => {
        if (sees !== "show") shownBefore.current.set(`${s.id}:${k}`, next);
        if (sees !== "show") remembered();
        else if (k === "area") area({ mode: next as Appearance["area"]["mode"] });
        else patchLabel({ mode: next });
      });
    const computed =
      k === "area"
        ? faceAreaLabel({ ...s, appearance: { ...a, area: { ...a.area, mode: "value" } } })
        : labelText({ ...s, labels: { ...s.labels, [k]: { ...s.labels[k], mode: "area" } } }, k);
    const typeText = (v: string) => {
      if (sees !== "show") shownBefore.current.set(`${s.id}:${k}`, "text");
      const mode = sees === "show" ? { mode: "text" as const } : {};
      if (k === "area") area({ ...mode, text: v });
      else patchLabel({ ...mode, text: v });
    };
    return (
      <div className="cb-box">
        {edge && shows === "value"
          ? field(`Edit ${k}`, s.dimensions[k as (typeof axes)[number]], (v) => changeShape((x) => setDimension(x, k as (typeof axes)[number], v)))
          : // A face area is worked out from the dimensions; typing over it makes it the label's own text.
            field(`Edit ${k === "area" ? "face area" : k}`, shows === "text" ? (k === "area" ? a.area.text : l.text) : computed, (v) => typeText(v))}
        <VisibilitySwitch name="What pupils see" caption="What pupils see" value={sees} disabled={blocked} onChange={(v) => setSees(s.id, [k], v, `${name} label`)} />
        <label>
          Shows{" "}
          <select aria-label="Shows" value={shows} disabled={blocked} onChange={(ev) => setShows(ev.target.value as Shown)}>
            <option value={edge || k === "area" ? "value" : "area"}>{edge ? "Dimension" : k === "area" ? "Calculated value" : "Face area"}</option>
            <option value="text">Own text</option>
          </select>
        </label>
        {sees === "hidden" && <p>Pupils see a dotted line to write on.</p>}
      </div>
    );
  }
  // What pupils see: the selected cuboid's pupil spaces.
  const spaces = ([...keys, ...(a.mode === "one" ? (["area"] as const) : [])] as Target["key"][]).filter((k) => seesOf(s, k) === "hidden"),
    spaceSummary = spaces.length === 0 ? "No pupil spaces" : `${spaces.length} pupil ${spaces.length === 1 ? "space" : "spaces"}`;
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
  const titleNote = useTitleNote({ active, about: aboutOf(e), disabled: blocked, onSave: (about) => commit(withAbout(e, about), TITLE_NOTE_STEP) });
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
              examples={
                <ExampleGallery
                  examples={cuboidGallery}
                  active={active}
                  disabled={blocked || !!pending}
                  onUse={(resource, title) =>
                    replacement(resource, `Open ${title}?`)
                  }
                  onWorked={(resource) => commit(resource, "use worked version")}
                />
              }
              canUndo={!blocked && history.past.length > 0}
              undoLabel={undoStepName(history)}
              resetStep={history.resetStep}
              active={active}
              redoLabel={redoStepName(history)}
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
              onMenuChange={setMenu}
            />
            <EditorDownloadMenu
              wordHelp
              id="cuboids-downloads"
              open={menu}
              active={active}
              onClose={() => setMenu(false)}
              onBusyChange={setBusy}
              onMessage={setMessage}
              actions={diagramFileMenu({
                about: titleNote.item,
                svg: {
                  action: () => downloadImage(e, "svg"),
                  disabled: blocked || !!issue,
                  success: "SVG download started.",
                },
                png: {
                  action: () => downloadImage(e, "png"),
                  disabled: blocked || !!issue,
                  success: "PNG download started.",
                },
                pdf: {
                  action: () => downloadImage(e, "pdf"),
                  disabled: blocked || !!issue,
                  success: "PDF download started.",
                },
                save: {
                  action: () => downloadEditable(e),
                  disabled: blocked,
                  success: "Editable file download started.",
                },
                open: {
                  action: () => file.current?.click(),
                  disabled: blocked,
                  success: "",
                },
                link: {
                  action: () =>
                    navigator.clipboard.writeText(
                      pathLink(editorLink(e, location.origin + location.pathname)),
                    ),
                  disabled: blocked,
                  success: "Editable link copied.",
                },
              })}
            />
            {titleNote.dialog}
            {issue && (
              <p className="cb-export-warning" role="alert">
                {issue}
              </p>
            )}
            <div
              className="cb-scroll editor-stage"
              ref={fitted.ref}
              onClick={(ev) => {
                if (ev.target === ev.currentTarget && !dirty.size)
                  closeEditor();
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
                        closeEditor();
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
                          // The label whose box is open keeps its target, so Leave out leaves the box in place.
                          (t.shapeId === s.id && t.key === inline) ||
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
                          data-options-anchor=""
                          aria-label={`Edit ${t.key} label on ${t.shapeId}`}
                          title={seesOf(d.shapes.find((x) => x.id === t.shapeId)!, t.key) === "hidden" ? TARGET_TIP_SPACE : TARGET_TIP}
                          disabled={blocked}
                          style={{
                            left: t.x * unit,
                            top: t.y * unit,
                            width: t.width * unit,
                            height: (t.height ?? 6) * unit,
                          }}
                          onClick={(ev) => editTarget(t.shapeId, t.key, ev.currentTarget)}
                          onDoubleClick={() => toggleTarget(t.shapeId, t.key)}
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
            <EditorFoot
              zoom={zoom}
              onZoom={setZoom}
              scale={fitted.scale}
              size={
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
              }
              status={message}
              hint={
                <EditorHint tool="cuboids">Click a label to edit it. Double-click one for a pupil space.</EditorHint>
              }
            />
            <div className="cb-structure" aria-label="Cuboid structure">
              <StructureStepper
                className="cb-structure-group"
                name="Cuboids"
                add={{
                  label: "Add cuboid",
                  disabled: blocked || d.shapes.length >= 3,
                  onClick: addShape,
                }}
                remove={{
                  label: "Remove selected cuboid",
                  disabled: blocked || d.shapes.length <= 1,
                  onClick: removeShape,
                }}
              />
              {s.view !== "plain" &&
                axes.map((a) => (
                  <StructureStepper
                    key={a}
                    className="cb-structure-group"
                    name={a[0].toUpperCase() + a.slice(1)}
                    add={{
                      label: `Add one cube to ${a}`,
                      disabled: blocked,
                      onClick: () =>
                        safe(() => changeShape((x) => grow(x, a, 1))),
                    }}
                    remove={{
                      label: `Remove one cube from ${a}`,
                      disabled: blocked,
                      onClick: () =>
                        safe(() => changeShape((x) => grow(x, a, -1))),
                    }}
                  />
                ))}
            </div>
            {dirty.size > 0 && (
              <p className="cb-message cb-error" role="status">
                Apply or cancel unfinished input before exporting or changing
                other settings.
              </p>
            )}
            {recovery !== null && (
              <div className="cb-message">
                <p>Protect the recovery data before starting afresh.</p>
                <button
                  onClick={() => {
                    downloadBlob(
                      new Blob([recovery], { type: "application/json" }),
                      downloadName("cuboids", "json", { recovery: true }),
                    );
                    setRecoverySaved(true);
                  }}
                >
                  Download recovery data
                </button>
                <button
                  disabled={!recoverySaved}
                  onClick={() => {
                    let unchanged = true;
                    try {
                      unchanged = keepStored(recovery);
                    } catch {
                      // Storage is unavailable: nothing on the device can be overwritten.
                    }
                    if (!unchanged) {
                      setRecovery(localStorage.getItem(STORAGE) ?? "");
                      setRecoverySaved(false);
                      setMessage("Saved data changed again. Download this latest copy first.");
                      return;
                    }
                    setRecovery(null);
                    setHistory(createHistory(newDocument()));
                    setSelected("cuboid-1");
                    closeEditor();
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
          <aside ref={stackRef} className="inspector-stack cb-inspector md-kit md-kit--one" aria-label="Cuboid settings">
            <ReturnToDiagram />
            {/* One folding column (the usability rollout, 22 Nov 2026): What pupils see, the shape, then the rest. */}
            {d.shapes.length > 1 && (
                  <section className="panel-card cb-pick" aria-label="Cuboids">
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
                  </section>
                )}
            <FoldCard tool="cuboids" title="What pupils see" icon={Eye} defaultOpen summary={spaceSummary} help="Each label prints its value, a dotted pupil space or nothing. Click a label on the drawing for its own choice.">
              {(
                [
                  ["Edge labels", ["width", "depth", "height"]],
                  ["Face labels", ["front", "top", "side"]],
                  ...(a.mode === "one" ? ([["Shaded face area", ["area"]]] as const) : []),
                ] as const
              ).map(([group, ks]) => (
                <VisibilitySwitch
                  key={group}
                  name={group}
                  caption={group}
                  disabled={blocked}
                  value={commonVisibility(ks.map((k) => seesOf(s, k))) ?? "show"}
                  onChange={(v) => setSees(s.id, ks, v, group.toLowerCase())}
                />
              ))}
              <PupilSpaceHint count={spaces.length} disabled={blocked} onClear={() => setSees(s.id, spaces, "show", "pupil spaces")}>
                Double-click a label on the drawing for a pupil space.
              </PupilSpaceHint>
            </FoldCard>
            <FoldCard tool="cuboids" title="Shape" icon={Box} defaultOpen summary={`${s.dimensions.width} × ${s.dimensions.depth} × ${s.dimensions.height} ${s.unit}`}>
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
                    <div className="cb-view-row">
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
                        disabled={blocked}
                        onClick={() =>
                          safe(() => patch({ view: "cubes", cubeSideCm: "1" }))
                        }
                      >
                        Show 1 cm³ cubes
                      </button>
                    </div>
                    {
                      <details>
                        <summary>Cube size and counts</summary>
                        {field("Cube side length", cubeSideInUnit(s), (v) =>
                          changeShape((x) => setCubeSide(x, v)),
                        )}
                        <p>{cubes}</p>
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
                      <p key={w}>
                        {w}
                      </p>
                    ))}
            </FoldCard>
            <FoldCard tool="cuboids" title="Labels" icon={Tag} summary={`${KEY_NAMES[labelKey]} · position and captions`}>
                    <div className="cb-grid">
                    <label>
                      Edge or face{" "}
                      <select
                        aria-label="Edge or face"
                        disabled={blocked}
                        value={labelKey}
                        onChange={(ev) => {
                          setLabelKey(ev.target.value as LabelKey);
                          closeEditor();
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
                        <option value="hidden">Leave out</option>
                        {axes.includes(labelKey as (typeof axes)[number]) ? (
                          <option value="value">Dimension</option>
                        ) : (
                          <option value="area">Face area</option>
                        )}
                        <option value="blank">Pupil space (dotted line)</option>
                        <option value="text">Custom text</option>
                      </select>
                    </label>
                    </div>
                    {l.mode === "text" &&
                      field("Label text", l.text, (v) => patchLabel({ text: v }))}
                    <details>
                      <summary>Position and advanced</summary>
                      {s.view === "layers" && labelKey === "height" ? (
                        <p>
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
                        "Show editing targets for left-out labels",
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
                      <p>
                        Calculations use the actual dimensions. Pupil blanks and
                        custom labels remain unchanged.
                      </p>
                    </details>
            </FoldCard>
            <FoldCard tool="cuboids" title="Shading" icon={Paintbrush} summary={a.mode === "one" ? "One face" : a.mode === "faces" ? "Grey faces" : "Outline"}>
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
                      <p>
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
                        <p>
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
                            <option value="hidden">Leave out</option>
                            <option value="blank">Pupil space (dotted line)</option>
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
            </FoldCard>
            <FoldCard tool="cuboids" title="Print settings" icon={Printer} summary={`${d.widthCm} cm wide`}>
                    <p>
                      {m
                        ? `${(m.width / 10).toFixed(1)} × ${(m.height / 10).toFixed(1)} cm layout size; actual export crops closely around the artwork.`
                        : "Review the resource settings."}
                    </p>
                    {field("Print width (cm)", d.widthCm, (v) =>
                      commit({ ...e, document: { ...d, widthCm: Number(v) } }),
                    )}
                    <label>
                      Lines
                      <select
                        aria-label="Lines"
                        value={d.lines ?? "normal"}
                        onChange={(ev) => {
                          const next = { ...d };
                          setLines(next, ev.target.value as LineWeight);
                          commit({ ...e, document: next });
                        }}
                      >
                        {LINE_WEIGHTS.map((v) => (
                          <option key={v} value={v}>
                            {LINE_WEIGHT_NAMES[v]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <p>
                      Width before trimming. Images keep their scale and trim unused
                      outer space. Preview zoom does not change printing.
                    </p>
            </FoldCard>
          </aside>
        </section>
      </main>
      {inline && currentTarget && boxAnchor && (
        <OptionsBox
          anchor={boxAnchor}
          anchorKey={`${s.id}-${inline}`}
          hidden={!active}
          focusField={!coarse}
          // Beside the whole drawing, so it never covers another label, and never over the settings.
          placeBy={boxAnchor.closest<HTMLElement>(".cb-resource")}
          bounds={boxAnchor.closest<HTMLElement>(".editor-card")}
          title={KEY_NAMES[inline]}
          // A refused value keeps the box open, so it stays visible until it is fixed.
          onClose={() => !dirty.size && closeEditor()}
        >
          {labelBox(inline)}
        </OptionsBox>
      )}
      {active && pending && (
        <ResourceDialog
          title={pending.title}
          confirmLabel="Use these cuboids"
          disabled={blocked}
          onCancel={() => setPending(null)}
          onConfirm={() => {
            commit(pending.e, stepName(pending.title));
            setSelected(pending.e.document.shapes[0].id);
            closeEditor();
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
