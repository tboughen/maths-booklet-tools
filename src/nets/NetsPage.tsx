import { EditorHint } from "../site/EditorHint";
import { downloadName } from "../export/filenames";
import { useTitleNote } from "../site/TitleNote";
import { useWorkedNotes } from "../site/WorkedNotes";
import { WORKED_STEP, withWorkedNotes } from "../site/workedNotesData";
import { answerSize, previewArt, workedIssue } from "../export/worked";
import { workedOf } from "../../packages/envelope-core/src/worked";
import { TITLE_NOTE_STEP, withAbout } from "../site/titleNoteData";
import { aboutOf } from "../../packages/envelope-core/src/about";
import { createContext, useContext, useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { useResourceFit } from "../site/useResourceFit";
import { ExampleGallery, ReturnToDiagram } from "../examples/ExampleGallery";
import { netsGallery } from "../examples/galleryCatalogue";
import { housePreference, setLines } from "../site/houseStyle";
import { LINE_WEIGHTS, LINE_WEIGHT_NAMES, type LineWeight } from "../../packages/envelope-core/src/house-style";
import { copyStorageKey } from "../site/copyDocument";
import { EditorFoot } from "../site/EditorFoot";
import { ResourceSaveStatus } from "../site/ResourceSaveStatus";
import { EditorDownloadMenu, type MenuKind } from "../site/EditorDownloadMenu";
import { diagramFileMenu } from "../site/fileMenu";
import { ResourceSize } from "../site/ResourceSize";
import { AnswerCopyToggle } from "../site/AnswerPreviewToggle";
import { formatResourceSize } from "../site/resourceSizeFormat";
import { EditorToolbar } from "../site/EditorToolbar";
import { PageHeading, Panel } from "../site/PageHeading";
import { RatioDialog } from "../ratio-table/RatioDialog";
import { copyPngToClipboard, downloadBlob } from "../export/clipboard";
import {
  addNet,
  addSquare,
  canonical,
  create,
  CUBE_NET_NAMES,
  DEFAULT_PRESETS,
  foldNet,
  forView,
  hasHidden,
  layout,
  makeNet,
  markOpposite,
  MAX_NETS,
  MAX_TEXT,
  moveNet,
  parseFile,
  PRESET_TYPES,
  removeFace,
  removeNet,
  renderSvg,
  setEdge,
  setFace,
  setNet,
  setVertex,
  SOLID_NAMES,
  SOLIDS,
  validate,
  warnings,
  type Envelope,
  type Mark,
  type Preset,
  type PresetType,
  type Pt,
  type Solid,
} from "../../packages/net-core/src";
import { LINK_PREFIX, parseNetsLink, netsLink } from "./links";
import { copyWord, downloadEditable, downloadImage, printPng, downloadBoth } from "./export";
import { handleUndoKeys, useDocumentHistory, redoLabel as redoStepName, undoLabel as undoStepName, stepName } from "../editor-kit";
import "../site/settings-kit.css";
const STORAGE = copyStorageKey("maths-booklet-tools:nets:v1");
type Doc = Envelope["document"];
/** A face on the diagram: its net and its ID. */
type Address = { net: string; face: string };

/** A new diagram starts from the house style's lines (U111). */
function fresh() {
  const e = create();
  if (housePreference().lines === "bold") e.document.lines = "bold";
  return e;
}
function initial() {
  try {
    const raw = localStorage.getItem(STORAGE);
    if (raw) {
      try {
        return { e: parseFile(raw), recovery: null, message: "" };
      } catch {
        return { e: fresh(), recovery: raw, message: "Saved nets data needs recovery. Download the original before starting afresh." };
      }
    }
  } catch {
    return { e: fresh(), recovery: null, message: "Device storage is unavailable. Save an editable file to keep your work." };
  }
  return { e: fresh(), recovery: null, message: "" };
}

const PRESET_NAMES: Record<PresetType, string> = {
  cube: "Cube",
  cuboid: "Cuboid",
  "triangular-prism": "Triangular prism",
  "square-pyramid": "Square-based pyramid",
  tetrahedron: "Tetrahedron",
};
/** The numbers each preset takes, with their labels and limits. */
const PRESET_FIELDS: Record<PresetType, { key: string; label: string; min: number; max: number; step: number }[]> = {
  cube: [
    { key: "net", label: "Net (1 to 11)", min: 1, max: 11, step: 1 },
    { key: "side", label: "Squares across a face", min: 1, max: 4, step: 1 },
  ],
  cuboid: [
    { key: "length", label: "Length", min: 0.5, max: 12, step: 0.5 },
    { key: "width", label: "Width", min: 0.5, max: 12, step: 0.5 },
    { key: "height", label: "Height", min: 0.5, max: 12, step: 0.5 },
  ],
  "triangular-prism": [
    { key: "a", label: "Triangle side a", min: 0.5, max: 12, step: 0.5 },
    { key: "b", label: "Triangle side b", min: 0.5, max: 12, step: 0.5 },
    { key: "length", label: "Length", min: 0.5, max: 12, step: 0.5 },
  ],
  "square-pyramid": [
    { key: "base", label: "Base", min: 0.5, max: 12, step: 0.5 },
    { key: "slant", label: "Triangle height", min: 0.5, max: 12, step: 0.5 },
  ],
  tetrahedron: [{ key: "side", label: "Side", min: 0.5, max: 12, step: 0.5 }],
};
const MARK_NAMES: Record<Mark, string> = { none: "None", dot: "Dot", cross: "Cross", shade: "Shading" };

/** Lets each refused draft keep its reason on screen until that field is fixed or restored. */
const FieldErrors = createContext<{ lastError: () => string; report: (field: string, error: string | null) => void }>({
  lastError: () => "",
  report: () => undefined,
});
/** Keeps its draft while typing; Enter or leaving applies, Escape restores. A refused draft stays, marked invalid. */
function DraftField({ id, label, value, onCommit, disabled }: { id?: string; label: string; value: string; onCommit: (value: string) => boolean; disabled?: boolean }) {
  const [draft, setDraft] = useState(value);
  const [editing, setEditing] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const errors = useContext(FieldErrors);
  useEffect(() => {
    if (!editing && !invalid) setDraft(value);
  }, [value, editing, invalid]);
  const commit = () => {
    setEditing(false);
    if (draft === value) {
      errors.report(label, null);
      return setInvalid(false);
    }
    const ok = onCommit(draft);
    setInvalid(!ok);
    errors.report(label, ok ? null : `${label}: ${errors.lastError()}`);
  };
  return (
    <input
      id={id}
      aria-label={label}
      aria-invalid={invalid || undefined}
      value={draft}
      disabled={disabled}
      maxLength={MAX_TEXT}
      onChange={(ev) => {
        setEditing(true);
        setDraft(ev.target.value);
      }}
      onBlur={commit}
      onKeyDown={(ev: ReactKeyboardEvent<HTMLInputElement>) => {
        if (ev.key === "Enter") {
          ev.preventDefault();
          commit();
        }
        if (ev.key === "Escape") {
          ev.preventDefault();
          ev.stopPropagation();
          setDraft(value);
          setEditing(false);
          setInvalid(false);
          errors.report(label, null);
        }
      }}
    />
  );
}
const ptName = (p: Pt) => `(${p[0]}, ${p[1]})`;

export default function NetsPage({ active = true }: { active?: boolean }) {
  const [startup] = useState(initial),
    documentHistory = useDocumentHistory<Envelope>(startup.e, { equals: (a, b) => canonical(a) === canonical(b) }),
    history = documentHistory.history;
  const [recovery, setRecovery] = useState<string | null>(startup.recovery),
    [protectedCopy, setProtectedCopy] = useState(false),
    [message, setMessage] = useState(startup.message),
    [saveState, setSaveState] = useState("Saved on this device"),
    [zoom, setZoom] = useState(0),
    [view, setView] = useState<"pupil" | "answer">("pupil"),
    [menu, setMenu] = useState<MenuKind | false>(false),
    [busy, setBusy] = useState(false),
    [selected, setSelected] = useState<Address | null>(null),
    [adding, setAdding] = useState(false),
    [preset, setPreset] = useState<Preset>(DEFAULT_PRESETS.cube),
    [target, setTarget] = useState("n1"),
    [pending, setPending] = useState<{ e: Envelope; title: string; explanation: string } | null>(null);
  const file = useRef<HTMLInputElement>(null),
    expected = useRef<string | null>(null);
  const e = history.present,
    d = e.document,
    displayed = forView(e, view, true),
    g = layout(displayed),
    blocked = busy || recovery !== null || pending !== null;
  const fitted = useResourceFit((g.width * 96) / 25.4, (g.height * 96) / 25.4, zoom, (w) => (w < 500 ? 72 : 120));
  const answerSvg = renderSvg(forView(e, "answer"));
  const issue = [...g.issues, workedIssue(answerSvg, e)].filter(Boolean).join(" ");
  const notes = warnings(e);
  const selectedNet = selected ? d.nets.find((n) => n.id === selected.net) : undefined;
  const selectedFace = selectedNet && selected ? selectedNet.faces.find((f) => f.id === selected.face) : undefined;
  const targetNet = d.nets.find((n) => n.id === target) ?? d.nets[0];

  const lastError = useRef("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const fieldErrorContext = useRef({
    lastError: () => lastError.current,
    report: (field: string, error: string | null) =>
      setFieldErrors((all) => {
        if ((all[field] ?? null) === error) return all;
        const next = { ...all };
        if (error) next[field] = error;
        else delete next[field];
        return next;
      }),
  }).current;
  const shownMessage = message || Object.values(fieldErrors)[0] || "";
  function commit(next: Envelope | (() => Envelope), label?: string): boolean {
    if (recovery !== null) return false;
    try {
      const valid = validate(typeof next === "function" ? next() : next);
      documentHistory.commit(valid, label);
      setMessage("");
      return true;
    } catch (err) {
      lastError.current = err instanceof Error ? err.message : String(err);
      setMessage(lastError.current);
      return false;
    }
  }
  function patch(update: (n: Doc) => void, label?: string) {
    if (blocked) return false;
    const n = structuredClone(e);
    update(n.document);
    return commit(n, label);
  }
  function undo() {
    if (blocked) return;
    documentHistory.undo();
  }
  function redo() {
    if (blocked) return;
    documentHistory.redo();
  }
  function replace(next: Envelope, title: string, explanation = "This replaces the current diagram. You can undo the replacement.") {
    if (!blocked) setPending({ e: next, title, explanation });
  }
  const netName = (netId: string) => {
    const i = d.nets.findIndex((n) => n.id === netId),
      n = d.nets[i];
    return n?.caption.text ? `net ${n.caption.text}` : d.nets.length > 1 ? `net ${i + 1}` : "the net";
  };
  const faceName = (a: Address) => {
    const n = d.nets.find((x) => x.id === a.net),
      i = n ? n.faces.findIndex((f) => f.id === a.face) : -1,
      f = n?.faces[i];
    return `face ${i + 1}${f?.label.text ? ` (${f.label.text})` : ""}${d.nets.length > 1 ? ` of ${netName(a.net)}` : ""}`;
  };
  function choose(a: Address) {
    setSelected(a);
    setTarget(a.net);
    requestAnimationFrame(() => (document.getElementById("nets-face-label") as HTMLInputElement | null)?.focus());
  }

  // Autosave with protection for another tab's newer draft.
  useEffect(() => {
    if (recovery !== null) return;
    try {
      const raw = localStorage.getItem(STORAGE),
        text = canonical(history.present);
      if (expected.current !== null && raw !== expected.current && raw !== text) {
        setRecovery(raw ?? "");
        setProtectedCopy(false);
        setMessage("A newer draft exists in another tab. Its saved data is protected.");
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
        setProtectedCopy(false);
        setMessage("Saved nets data changed in another tab. Download its data before replacing it.");
      }
    };
    window.addEventListener("storage", listener);
    return () => window.removeEventListener("storage", listener);
  }, []);
  useEffect(() => {
    if (!active) return;
    const key = (event: KeyboardEvent) => {
      if (document.querySelector('[aria-modal="true"]')) return;
      if (handleUndoKeys(event, { undo, redo })) return;
      const typing = (event.target as HTMLElement | null)?.closest("input, select, textarea");
      if (typing) return;
      if (event.key === "Escape" && (selected || adding)) {
        setSelected(null);
        setAdding(false);
        return;
      }
      if (event.key === "Delete" && selected && !blocked) {
        event.preventDefault();
        if (commit(() => removeFace(e, selected.net, selected.face), "remove face")) setSelected(null);
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });
  async function run(action: () => Promise<void>, success = "Image copied. Paste with Ctrl+V.") {
    if (blocked || issue) return;
    setBusy(true);
    setMessage("");
    try {
      await action();
      setMessage(success);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }
  const linkPending = useRef(false),
    linkSeen = useRef("");
  useEffect(() => {
    if (!active) return;
    const inspect = () => {
      if (!location.hash.startsWith(LINK_PREFIX) || linkSeen.current === location.href || blocked) return;
      linkSeen.current = location.href;
      try {
        const incoming = parseNetsLink(location.href);
        linkPending.current = true;
        replace(incoming, "Open the linked diagram?");
      } catch (error) {
        setMessage(error instanceof Error ? error.message : String(error));
      }
    };
    inspect();
    window.addEventListener("hashchange", inspect);
    return () => window.removeEventListener("hashchange", inspect);
  });
  function consumeLink() {
    if (linkPending.current && location.hash.startsWith(LINK_PREFIX)) window.history.replaceState(null, "", location.pathname + location.search);
    linkPending.current = false;
    linkSeen.current = "";
  }
  async function importFile(upload: File) {
    try {
      if (upload.size > 60000) throw Error("This editable file is too large.");
      replace(parseFile(await upload.text()), "Open this diagram?");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err));
    }
  }

  const titleNote = useTitleNote({ active, about: aboutOf(e), disabled: blocked, onSave: (about) => commit(withAbout(e, about), TITLE_NOTE_STEP) });
  const worked = useWorkedNotes({ active, notes: workedOf(e), size: answerSize(answerSvg), disabled: blocked, onSave: (notes) => commit(withWorkedNotes(e, notes), WORKED_STEP) });
  const folded = selectedNet ? foldNet(selectedNet) : null;
  const vertexText = (p: Pt) => selectedNet?.vertices.find((v) => v.at[0] === p[0] && v.at[1] === p[1])?.label;
  const edgeText = (a: Pt, b: Pt) =>
    selectedNet?.edges.find((v) => (v.from[0] === a[0] && v.from[1] === a[1] && v.to[0] === b[0] && v.to[1] === b[1]) || (v.from[0] === b[0] && v.from[1] === b[1] && v.to[0] === a[0] && v.to[1] === a[1]))?.label;
  const setPresetField = (key: string, value: number) => setPreset((p) => ({ ...p, [key]: value }) as Preset);

  return (
    <FieldErrors.Provider value={fieldErrorContext}>
      <div className="app-shell booklet-editor pt-editor nets-editor">
        <main className="main-content" id={active ? "main-content" : undefined} tabIndex={-1}>
          <PageHeading title="Nets of 3D shapes" description="Draw nets of cubes, cuboids, prisms and pyramids on centimetre squares, with letters, dots and shading, and faces hidden for pupils.">
            <ResourceSaveStatus text={saveState} />
          </PageHeading>
          <section className="workspace">
            <Panel className="editor-card">
              <EditorToolbar
                examples={
                  <ExampleGallery
                    examples={netsGallery}
                    active={active}
                    disabled={blocked}
                    onUse={(resource, title) => replace(resource, `Open ${title}?`)}
                    onWorked={(resource) => commit(resource, "use worked version")}
                  />
                }
                answers={<AnswerCopyToggle checked={view === "answer"} disabled={blocked} onChange={(checked) => setView(checked ? "answer" : "pupil")} />}
                canUndo={!blocked && history.past.length > 0}
                canRedo={!blocked && history.future.length > 0}
                onUndo={undo}
                onRedo={redo}
                undoLabel={undoStepName(history)}
                redoLabel={redoStepName(history)}
                resetStep={history.resetStep}
                active={active}
                onReset={() => replace(fresh(), "Reset the diagram?")}
                resetDisabled={blocked}
                exportDisabled={blocked || !!issue}
                menuDisabled={blocked}
                busy={busy}
                onCopy={() => void run(() => copyWord(displayed, view === "answer"), "Copied for Word at " + formatResourceSize(g.width / 10, g.height / 10) + ". Paste with Ctrl+V.")}
                onCopyClipboard={() => void run(() => copyPngToClipboard(() => printPng(displayed, view === "answer")))}
                menuId="nets-downloads"
                menuOpen={menu}
                onMenuChange={setMenu}
              />
              <EditorDownloadMenu
                wordHelp
                id="nets-downloads"
                open={menu}
                active={active}
                onClose={() => setMenu(false)}
                onBusyChange={setBusy}
                onMessage={setMessage}
                actions={diagramFileMenu({
                  about: titleNote.item,
                  worked: worked.item,
                  both: { action: () => downloadBoth(e), disabled: blocked || !!issue, success: "Pupil and answers ZIP download started." },
                  svg: { action: () => downloadImage(displayed, "svg", view === "answer"), disabled: blocked || !!issue, success: "SVG download started." },
                  png: { action: () => downloadImage(displayed, "png", view === "answer"), disabled: blocked || !!issue, success: "PNG download started." },
                  pdf: { action: () => downloadImage(displayed, "pdf", view === "answer"), disabled: blocked || !!issue, success: "PDF download started." },
                  save: { action: () => downloadEditable(e), disabled: blocked, success: "Editable file download started." },
                  open: { action: () => file.current?.click(), disabled: blocked, success: "" },
                  link: { action: () => navigator.clipboard.writeText(netsLink(e, location.href)), disabled: blocked, success: "Editable link copied." },
                })}
              />
              {titleNote.dialog}
              {worked.dialog}
              <input
                ref={file}
                type="file"
                accept=".json,application/json"
                hidden
                onChange={(ev) => {
                  const upload = ev.target.files?.[0];
                  ev.target.value = "";
                  if (upload) void importFile(upload);
                }}
              />
              <div className="pt-scroll editor-stage" ref={fitted.ref}>
                <div className="pt-stage">
                  <div className="pt-resource" data-testid="nets-resource" style={{ width: ((g.width * 96) / 25.4) * fitted.scale, height: ((g.height * 96) / 25.4) * fitted.scale }}>
                    <div className="pt-art" dangerouslySetInnerHTML={{ __html: previewArt(renderSvg(displayed), e, view === "answer") }} />
                    <svg className="nets-overlay" viewBox={`0 0 ${g.width} ${g.height}`} preserveAspectRatio="none" aria-label="Faces of the nets">
                      {g.panels.map((p) => {
                        const net = d.nets.find((n) => n.id === p.net.id)!;
                        const X = (x: number) => p.x + x * g.unit,
                          Y = (y: number) => p.y + y * g.unit;
                        const cells: Pt[] = [];
                        if (adding && net.id === targetNet.id)
                          for (let i = 0; i < p.across; i++) for (let j = 0; j < p.down; j++) if (!net.faces.some((f) => inside([i + 0.5, j + 0.5], f.points))) cells.push([i, j]);
                        return (
                          <g key={net.id}>
                            {cells.map(([i, j]) => (
                              <rect
                                key={`${i}-${j}`}
                                className="nets-cell"
                                role="button"
                                tabIndex={blocked ? -1 : 0}
                                aria-label={`Add a square at column ${i + 1}, row ${j + 1}`}
                                x={X(i)}
                                y={Y(j)}
                                width={g.unit}
                                height={g.unit}
                                onClick={() => !blocked && commit(() => addSquare(e, net.id, i, j), "add square")}
                                onKeyDown={(ev) => {
                                  if ((ev.key === "Enter" || ev.key === " ") && !blocked) {
                                    ev.preventDefault();
                                    commit(() => addSquare(e, net.id, i, j), "add square");
                                  }
                                }}
                              />
                            ))}
                            {net.faces.map((f, k) => {
                              const a = { net: net.id, face: f.id },
                                hiddenHere = view === "pupil" && f.show === "hidden";
                              const isSelected = selected?.net === net.id && selected.face === f.id;
                              return (
                                <polygon
                                  key={f.id}
                                  className={`nets-face${isSelected ? " nets-selected" : ""}${hiddenHere ? " nets-hidden-face" : ""}`}
                                  points={f.points.map((q) => `${X(q[0])},${Y(q[1])}`).join(" ")}
                                  role="button"
                                  tabIndex={blocked ? -1 : 0}
                                  aria-label={`Edit face ${k + 1}${d.nets.length > 1 ? ` of ${netName(net.id)}` : ""}`}
                                  aria-pressed={isSelected}
                                  onClick={() => !blocked && choose(a)}
                                  onKeyDown={(ev) => {
                                    if ((ev.key === "Enter" || ev.key === " ") && !blocked) {
                                      ev.preventDefault();
                                      choose(a);
                                    }
                                  }}
                                >
                                  {hiddenHere && <title>Hidden face (pupils draw this)</title>}
                                </polygon>
                              );
                            })}
                          </g>
                        );
                      })}
                    </svg>
                  </div>
                </div>
              </div>
              <EditorFoot
                zoom={zoom}
                onZoom={setZoom}
                scale={fitted.scale}
                size={<ResourceSize width={g.width / 10} height={g.height / 10} />}
                status={shownMessage}
                hint={<EditorHint tool="nets">Click a face to label, mark or hide it. Turn on Add squares, then click empty squares to build a net.</EditorHint>}
              ></EditorFoot>
              {(issue || notes.length > 0) && (
                <div className="pt-status" aria-live="polite">
                  {g.issues.map((x) => (
                    <p key={x} className="pt-error" role="alert">
                      {x}
                    </p>
                  ))}
                  {notes.map((x) => (
                    <p key={x}>Teacher note: {x}</p>
                  ))}
                </div>
              )}
            </Panel>
            <aside className="inspector-stack md-kit" aria-label="Nets settings">
              <ReturnToDiagram />
              <div className="md-kit-cards">
              <div>
              <section className="panel-card pt-panel" aria-label="Selected face">
                <h2>{selected && selectedFace ? `Selected: ${faceName(selected)}` : "Selected face"}</h2>
                {selected && selectedNet && selectedFace ? (
                  <>
                    <div className="pt-fields">
                      <label>
                        Letter or word
                        <DraftField
                          key={`${selected.net}-${selected.face}`}
                          id="nets-face-label"
                          label="Face label"
                          value={selectedFace.label.text}
                          disabled={blocked}
                          onCommit={(v) => commit(() => setFace(e, selected.net, selected.face, { label: { text: v, ...(v.trim() ? {} : { show: "show" }) } }), "label face")}
                        />
                      </label>
                      <label>
                        Mark
                        <select
                          aria-label="Face mark"
                          value={selectedFace.mark.kind}
                          disabled={blocked}
                          onChange={(ev) => commit(() => setFace(e, selected.net, selected.face, { mark: { kind: ev.target.value as Mark } }), "mark face")}
                        >
                          {(Object.keys(MARK_NAMES) as Mark[]).map((m) => (
                            <option key={m} value={m}>
                              {MARK_NAMES[m]}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <label className="pt-hide" title="A hidden face prints nothing for pupils; the answers copy draws it.">
                      <input
                        type="checkbox"
                        disabled={blocked}
                        checked={selectedFace.show === "hidden"}
                        onChange={(ev) => commit(() => setFace(e, selected.net, selected.face, { show: ev.target.checked ? "hidden" : "show" }), "hide face")}
                      />
                      Hide this face for pupils (they draw it)
                    </label>
                    <label className="pt-hide">
                      <input
                        type="checkbox"
                        disabled={blocked || !selectedFace.label.text}
                        checked={selectedFace.label.show === "hidden"}
                        onChange={(ev) => commit(() => setFace(e, selected.net, selected.face, { label: { show: ev.target.checked ? "hidden" : "show" } }), "hide label")}
                      />
                      Hide the letter (keep as an answer)
                    </label>
                    <label className="pt-hide">
                      <input
                        type="checkbox"
                        disabled={blocked || selectedFace.mark.kind === "none"}
                        checked={selectedFace.mark.show === "hidden"}
                        onChange={(ev) => commit(() => setFace(e, selected.net, selected.face, { mark: { show: ev.target.checked ? "hidden" : "show" } }), "hide mark")}
                      />
                      Hide the mark (keep as an answer)
                    </label>
                    <div className="pt-row">
                      <button
                        type="button"
                        disabled={blocked || !folded?.ok}
                        title={
                          !folded
                            ? "Only nets of cubes and cuboids can be folded."
                            : !folded.ok
                              ? `This net does not fold: ${folded.reason}.`
                              : "Marks the face that ends up opposite, as a hidden answer."
                        }
                        onClick={() => commit(() => markOpposite(e, selected.net, selected.face, selectedFace.mark.kind === "none" ? undefined : (selectedFace.mark.kind as Exclude<Mark, "none">)), "mark opposite face")}
                      >
                        Mark the opposite face
                      </button>
                      <button
                        type="button"
                        disabled={blocked}
                        onClick={() => {
                          if (commit(() => removeFace(e, selected.net, selected.face), "remove face")) setSelected(null);
                        }}
                      >
                        Remove this face
                      </button>
                    </div>
                    <details>
                      <summary>Corner letters and lengths</summary>
                      <div className="nets-corners">
                        {selectedFace.points.map((p, k) => {
                          const v = vertexText(p);
                          const q = selectedFace.points[(k + 1) % selectedFace.points.length];
                          const len = edgeText(p, q);
                          return (
                            <div key={`${p[0]},${p[1]}`} className="nets-corner-row">
                              <label>
                                Corner {ptName(p)}
                                <DraftField
                                  label={`Corner ${ptName(p)} letter`}
                                  value={v?.text ?? ""}
                                  disabled={blocked}
                                  onCommit={(t) => commit(() => setVertex(e, selected.net, p, { text: t, ...(t.trim() ? {} : { show: "show" }) }), "corner letter")}
                                />
                              </label>
                              <label className="pt-hide">
                                <input
                                  type="checkbox"
                                  disabled={blocked || !v?.text}
                                  checked={v?.show === "hidden"}
                                  onChange={(ev) => commit(() => setVertex(e, selected.net, p, { show: ev.target.checked ? "hidden" : "show" }), "hide corner letter")}
                                />
                                Hide
                              </label>
                              <label>
                                Edge to {ptName(q)}
                                <DraftField
                                  label={`Edge ${ptName(p)} to ${ptName(q)} label`}
                                  value={len?.text ?? ""}
                                  disabled={blocked}
                                  onCommit={(t) => commit(() => setEdge(e, selected.net, p, q, { text: t, ...(t.trim() ? {} : { show: "show" }) }), "edge label")}
                                />
                              </label>
                              <label className="pt-hide">
                                <input
                                  type="checkbox"
                                  disabled={blocked || !len?.text}
                                  checked={len?.show === "hidden"}
                                  onChange={(ev) => commit(() => setEdge(e, selected.net, p, q, { show: ev.target.checked ? "hidden" : "show" }), "hide edge label")}
                                />
                                Hide
                              </label>
                            </div>
                          );
                        })}
                      </div>
                      <p className="pt-note">Corners are in grid squares from the panel&apos;s top-left corner. Letters and lengths print outside the net.</p>
                    </details>
                  </>
                ) : (
                  <p className="pt-note">Click a face to choose it.</p>
                )}
                <div className="pt-row">
                  <button
                    type="button"
                    disabled={blocked || !hasHidden(e)}
                    onClick={() =>
                      patch((n) => {
                        for (const net of n.nets) {
                          net.caption.show = "show";
                          for (const f of net.faces) [f, f.label, f.mark].forEach((o) => (o.show = "show"));
                          [...net.vertices, ...net.edges].forEach((v) => (v.label.show = "show"));
                        }
                      }, "show all")
                    }
                  >
                    Show all
                  </button>
                </div>
              </section>
              <section className="panel-card pt-panel" aria-label="Shape">
                <h2>Shape</h2>
                <div className="pt-fields">
                  <label>
                    Net of a
                    <select aria-label="Shape" value={preset.type} disabled={blocked} onChange={(ev) => setPreset(DEFAULT_PRESETS[ev.target.value as PresetType])}>
                      {PRESET_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {PRESET_NAMES[t]}
                        </option>
                      ))}
                    </select>
                  </label>
                  {PRESET_FIELDS[preset.type].map((f) => (
                    <label key={f.key}>
                      {f.label}
                      <input
                        type="number"
                        aria-label={f.label}
                        min={f.min}
                        max={f.max}
                        step={f.step}
                        disabled={blocked}
                        value={(preset as unknown as Record<string, number>)[f.key]}
                        onChange={(ev) => {
                          const v = Number(ev.target.value);
                          if (Number.isFinite(v)) setPresetField(f.key, Math.min(f.max, Math.max(f.min, v)));
                        }}
                      />
                    </label>
                  ))}
                </div>
                {preset.type === "cube" && <p className="pt-note">Net {preset.net}: {CUBE_NET_NAMES[preset.net - 1]}.</p>}
                <div className="pt-row">
                  <button
                    type="button"
                    disabled={blocked}
                    onClick={() => {
                      if (commit(() => makeNet(e, targetNet.id, preset), "replace net")) setSelected(null);
                    }}
                  >
                    Replace {netName(targetNet.id)}
                  </button>
                  <button
                    type="button"
                    disabled={blocked || d.nets.length >= MAX_NETS}
                    onClick={() => {
                      const caption = d.nets.length === 1 && !d.nets[0].caption.text ? "B" : "";
                      if (commit(() => addNet(caption ? setNet(e, d.nets[0].id, { caption: { text: "A" } }) : e, preset, caption), "add net")) setTarget(`n${d.nets.length + 1}`);
                    }}
                  >
                    Add as another net
                  </button>
                </div>
                <label className="pt-hide" title="Click empty squares to add square faces, for building a net or one that is not a net.">
                  <input type="checkbox" disabled={blocked} checked={adding} onChange={(ev) => setAdding(ev.target.checked)} />
                  Add squares to {netName(targetNet.id)} by clicking the grid
                </label>
              </section>
              </div>
              <div>
              <section className="panel-card pt-panel" aria-label="Nets">
                <h2>Nets</h2>
                {d.nets.map((net, i) => (
                  <fieldset key={net.id} className="md-kit-group">
                    <legend>{d.nets.length > 1 ? `Net ${i + 1}` : "The net"}</legend>
                    <div className="pt-fields">
                      <label>
                        Caption
                        <DraftField
                          label={`Net ${i + 1} caption`}
                          value={net.caption.text}
                          disabled={blocked}
                          onCommit={(t) => commit(() => setNet(e, net.id, { caption: { text: t, ...(t.trim() ? {} : { show: "show" }) } }), "caption")}
                        />
                      </label>
                      <label>
                        Folds into a
                        <select aria-label={`Net ${i + 1} solid`} value={net.solid} disabled={blocked} onChange={(ev) => commit(() => setNet(e, net.id, { solid: ev.target.value as Solid }), "solid")}>
                          {SOLIDS.map((s) => (
                            <option key={s} value={s}>
                              {SOLID_NAMES[s]}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Squares across (0 fits)
                        <input
                          type="number"
                          min={0}
                          max={40}
                          aria-label={`Net ${i + 1} squares across`}
                          disabled={blocked}
                          value={net.size.across}
                          onChange={(ev) => commit(() => setNet(e, net.id, { size: { ...net.size, across: Math.max(0, Math.min(40, Math.round(Number(ev.target.value) || 0))) } }), "panel size")}
                        />
                      </label>
                      <label>
                        Squares down (0 fits)
                        <input
                          type="number"
                          min={0}
                          max={40}
                          aria-label={`Net ${i + 1} squares down`}
                          disabled={blocked}
                          value={net.size.down}
                          onChange={(ev) => commit(() => setNet(e, net.id, { size: { ...net.size, down: Math.max(0, Math.min(40, Math.round(Number(ev.target.value) || 0))) } }), "panel size")}
                        />
                      </label>
                    </div>
                    <label className="pt-hide">
                      <input
                        type="checkbox"
                        disabled={blocked || !net.caption.text}
                        checked={net.caption.show === "hidden"}
                        onChange={(ev) => commit(() => setNet(e, net.id, { caption: { show: ev.target.checked ? "hidden" : "show" } }), "hide caption")}
                      />
                      Hide the caption (keep as an answer)
                    </label>
                    <label className="pt-hide">
                      <input
                        type="checkbox"
                        disabled={blocked || !net.faces.length}
                        checked={net.faces.length > 0 && net.faces.every((f) => f.show === "hidden")}
                        onChange={(ev) => patch((n) => n.nets[i].faces.forEach((f) => (f.show = ev.target.checked ? "hidden" : "show")), "hide net")}
                      />
                      Hide the whole net (pupils draw it)
                    </label>
                    <div className="pt-row" role="group" aria-label={`Move net ${i + 1}`}>
                      {(
                        [
                          ["Left", -1, 0],
                          ["Right", 1, 0],
                          ["Up", 0, -1],
                          ["Down", 0, 1],
                        ] as const
                      ).map(([name, dx, dy]) => (
                        <button key={name} type="button" disabled={blocked} onClick={() => commit(() => moveNet(e, net.id, dx, dy), "move net")}>
                          {name}
                        </button>
                      ))}
                      {d.nets.length > 1 && (
                        <button
                          type="button"
                          disabled={blocked}
                          onClick={() => {
                            if (commit(() => removeNet(e, net.id), "remove net")) {
                              setSelected(null);
                              setTarget(d.nets[0].id === net.id ? d.nets[1].id : d.nets[0].id);
                            }
                          }}
                        >
                          Remove net {i + 1}
                        </button>
                      )}
                    </div>
                  </fieldset>
                ))}
              </section>
              </div>
              <div>
              <section className="panel-card pt-panel" aria-label="Paper">
                <h2>Paper</h2>
                <div className="pt-fields">
                  <label className="pt-wide">
                    Grid
                    <select aria-label="Grid" value={d.grid} disabled={blocked} onChange={(ev) => patch((n) => void (n.grid = ev.target.value as Doc["grid"]), "grid")}>
                      <option value="squares">Centimetre squares</option>
                      <option value="dots">Dots</option>
                      <option value="none">Plain paper</option>
                    </select>
                  </label>
                  <label>
                    Square size
                    <select aria-label="Square size" value={d.unitCm} disabled={blocked} onChange={(ev) => patch((n) => void (n.unitCm = Number(ev.target.value) as Doc["unitCm"]), "square size")}>
                      <option value={1}>1 cm</option>
                      <option value={0.5}>0.5 cm</option>
                    </select>
                  </label>
                  <label>
                    Lines
                    <select aria-label="Lines" value={d.lines ?? "normal"} disabled={blocked} onChange={(ev) => patch((n) => setLines(n, ev.target.value as LineWeight), "lines")}>
                      {LINE_WEIGHTS.map((v) => (
                        <option key={v} value={v}>
                          {LINE_WEIGHT_NAMES[v]}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <details>
                  <summary>Editing and printing help</summary>
                  <p className="pt-note">
                    Cube and cuboid nets are checked: a teacher note says when one does not fold, and which lettered faces end up opposite. Nothing is
                    marked for you unless you press Mark the opposite face.
                  </p>
                  <p className="pt-note">Copy for Word carries the physical size shown under the nets; preview zoom never changes it.</p>
                </details>
              </section>
              </div>
              </div>
            </aside>
          </section>
          {recovery !== null && (
            <section className="panel-card pt-recovery" role="alert">
              <h2>Protect saved data</h2>
              <p>{message}</p>
              <button
                onClick={() => {
                  downloadBlob(new Blob([recovery], { type: "application/json" }), downloadName("nets", "json", { recovery: true }));
                  setProtectedCopy(true);
                }}
              >
                Download protected data
              </button>
              <button onClick={() => downloadEditable(e)}>Save current diagram</button>
              <button
                disabled={!protectedCopy}
                onClick={() => {
                  try {
                    const raw = localStorage.getItem(STORAGE);
                    if (raw !== recovery) {
                      setRecovery(raw ?? "");
                      setProtectedCopy(false);
                      setMessage("Saved data changed again. Download this latest copy first.");
                      return;
                    }
                    expected.current = raw;
                    setRecovery(null);
                    setMessage("");
                  } catch {
                    setMessage("Storage is unavailable. Keep your downloaded files.");
                  }
                }}
              >
                Keep this diagram and start saving
              </button>
            </section>
          )}
          {active && pending && (
            <RatioDialog
              title={pending.title}
              confirmLabel="Use this diagram"
              onCancel={() => {
                consumeLink();
                setPending(null);
              }}
              onConfirm={() => {
                if (busy || recovery !== null) return;
                consumeLink();
                commit(pending.e, stepName(pending.title));
                setPending(null);
                setSelected(null);
                setAdding(false);
                setTarget(pending.e.document.nets[0].id);
                setView("pupil");
              }}
            >
              <p>{pending.explanation}</p>
              <div className="ratio-import-preview" dangerouslySetInnerHTML={{ __html: renderSvg(pending.e) }} />
            </RatioDialog>
          )}
        </main>
      </div>
    </FieldErrors.Provider>
  );
}
function inside(p: Pt, poly: readonly Pt[]) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i],
      [xj, yj] = poly[j];
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}
