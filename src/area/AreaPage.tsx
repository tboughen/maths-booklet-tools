import { useTitleNote } from "../site/TitleNote";
import { useWorkedNotes } from "../site/WorkedNotes";
import { WORKED_STEP, withWorkedNotes } from "../site/workedNotesData";
import { answerSize, previewArt, workedIssue } from "../export/worked";
import { workedOf } from "../../packages/envelope-core/src/worked";
import { TITLE_NOTE_STEP, withAbout } from "../site/titleNoteData";
import { aboutOf } from "../../packages/envelope-core/src/about";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { useResourceFit } from "../site/useResourceFit";
import { ExampleGallery } from "../examples/ExampleGallery";
import { areaGallery } from "../examples/galleryCatalogue";
import { copyStorageKey } from "../site/copyDocument";
import { PreviewControls } from "../site/PreviewControls";
import { ResourceSaveStatus } from "../site/ResourceSaveStatus";
import { EditorDownloadMenu } from "../site/EditorDownloadMenu";
import { diagramFileMenu } from "../site/fileMenu";
import { ResourceSize } from "../site/ResourceSize";
import { AnswerCopyToggle } from "../site/AnswerPreviewToggle";
import { formatResourceSize } from "../site/resourceSizeFormat";
import { EditorToolbar } from "../site/EditorToolbar";
import { EditorHint } from "../site/EditorHint";
import { PageHeading, Panel } from "../site/PageHeading";
import { RatioDialog } from "../ratio-table/RatioDialog";
import { copyPngToClipboard, downloadBlob } from "../export/clipboard";
import { housePreference, setLines } from "../site/houseStyle";
import { LINE_WEIGHTS, LINE_WEIGHT_NAMES, MIN_TEXT_PT, startingTextPt, type LineWeight } from "../../packages/envelope-core/src/house-style";
import {
  ARCS,
  canonical,
  extent,
  hasHidden,
  heightFoot,
  hitAnchors,
  holeFor,
  label as makeLabel,
  layout,
  MAX_CORNERS,
  parseFile,
  PART_NAMES,
  PARTS,
  PRESET_NAMES,
  PRESETS,
  presetShape,
  printed,
  prune,
  renderSvg,
  starter,
  stretch,
  validate,
  type AreaDocument,
  type ArcKind,
  type CirclePart,
  type Envelope,
  type Hole,
  type Label,
  type LabelState,
  type Polygon,
  type Preset,
  type Shape,
} from "../../packages/area-core/src";
import { areaLink, LINK_PREFIX, parseAreaLink } from "./links";
import { copyWord, downloadBoth, downloadEditable, downloadImage, printPng } from "./export";
import { handleUndoKeys, objectKeyCommand, openDraft, redoLabel as redoStepName, stepName, undoLabel as undoStepName, useDocumentHistory, useDraftAutosave } from "../editor-kit";
import { downloadName } from "../export/filenames";
import "../probability-tree/probability-tree.css";
import "./area.css";

const STORAGE = copyStorageKey("maths-booklet-tools:area:v1");
type View = "pupil" | "answer";
const STATE_NAMES: Record<LabelState, string> = {
  value: "Given",
  symbol: "Letter",
  blank: "Blank (nothing printed)",
  "answer-line": "Answer line",
  hidden: "Hidden",
};
const ARC_NAMES: Record<ArcKind, string> = { none: "Straight", out: "Semicircle added", in: "Semicircle cut out" };
const pointName = (id: string) => (id === "o" ? "The centre" : id === "a" ? "End A of the line" : id === "b" ? "End B of the line" : /^v\d+$/.test(id) ? `Corner ${id.slice(1)}` : id);

/** A new diagram starts at the teacher's house style (U111); saved diagrams keep their own settings. */
function housed(e: Envelope): Envelope {
  const house = housePreference(),
    n = structuredClone(e);
  const pt = startingTextPt(house.style, 11, { max: 14 });
  n.document.fontPt = pt === 11 ? undefined : pt;
  n.document.lines = house.lines === "bold" ? "bold" : undefined;
  return validate(n);
}
const fresh = () => housed(starter("l-shape"));

function initial() {
  const start = openDraft({ key: STORAGE, parse: parseFile, fresh, recoveryMessage: "Saved area and perimeter data needs recovery. Download the original before starting afresh." });
  return { e: start.document, recovery: start.recovery, message: start.message };
}

/** Keeps its draft while typing; Enter or leaving applies, Escape restores. */
function DraftField({ label, value, onCommit, disabled, maxLength = 24, inputMode }: {
  label: string;
  value: string;
  onCommit: (value: string) => boolean | void;
  disabled?: boolean;
  maxLength?: number;
  inputMode?: "decimal" | "text";
}) {
  const [draft, setDraft] = useState(value);
  const [editing, setEditing] = useState(false);
  const [refused, setRefused] = useState(false);
  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);
  const commit = () => {
    if (draft === value) {
      setEditing(false);
      setRefused(false);
      return;
    }
    // A refused value stays in the box, marked, so the teacher can correct it.
    const ok = onCommit(draft) !== false;
    setRefused(!ok);
    if (ok) setEditing(false);
  };
  return (
    <input
      aria-label={label}
      aria-invalid={refused || undefined}
      value={draft}
      disabled={disabled}
      maxLength={maxLength}
      inputMode={inputMode}
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
          setRefused(false);
        }
      }}
    />
  );
}

const num = (s: string) => (/^-?\d+(\.\d+)?$/.test(s.trim()) ? Number(s) : NaN);
const round = (v: number) => Math.round(v * 10) / 10;

export default function AreaPage({ active = true }: { active?: boolean }) {
  const [startup] = useState(initial),
    documentHistory = useDocumentHistory<Envelope>(startup.e, { equals: (a, b) => canonical(a) === canonical(b) }),
    history = documentHistory.history;
  const [recovery, setRecovery] = useState<string | null>(startup.recovery),
    [protectedCopy, setProtectedCopy] = useState(false),
    [message, setMessage] = useState(startup.message),
    [zoom, setZoom] = useState(0),
    [view, setView] = useState<View>("pupil"),
    [menu, setMenu] = useState(false),
    [busy, setBusy] = useState(false),
    [selected, setSelected] = useState<string | null>(null),
    [pending, setPending] = useState<{ e: Envelope; title: string; explanation: string } | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const e = history.present,
    d = e.document,
    s = d.shape,
    g = useMemo(() => layout(e), [e]),
    blocked = busy || recovery !== null || pending !== null;
  const fitted = useResourceFit((g.width * 96) / 25.4, (g.height * 96) / 25.4, zoom, (w) => (w < 500 ? 72 : 120));
  const answerSvg = useMemo(() => renderSvg(e, "answer"), [e]);
  const viewSvg = useMemo(() => (view === "answer" ? answerSvg : renderSvg(e, "pupil")), [e, view, answerSvg]);
  const issue = [...g.issues, workedIssue(answerSvg, e)].filter(Boolean).join(" ");
  const slots = g.geometry.slots;
  const current = selected && slots.some((x) => x.id === selected) ? selected : null;
  const chosen = current ? d.labels.find((l) => l.id === current) : undefined;
  const pxPerMm = (96 / 25.4) * fitted.scale;

  function commit(next: Envelope | null | (() => Envelope), label?: string) {
    if (recovery !== null || !next) return false;
    try {
      const valid = validate(typeof next === "function" ? next() : next);
      documentHistory.commit(valid, label);
      setMessage("");
      return true;
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err));
      return false;
    }
  }
  function patch(update: (n: AreaDocument) => void, label?: string) {
    if (blocked) return false;
    const n = structuredClone(e);
    update(n.document);
    return commit(n, label);
  }
  /** Changes the selected label, adding it first if the place has none yet. */
  function setLabel(id: string, update: (l: Label) => void, label?: string) {
    return patch((n) => {
      let l = n.labels.find((x) => x.id === id);
      if (!l) {
        l = makeLabel(id);
        n.labels.push(l);
      }
      update(l);
    }, label);
  }
  function removeLabel(id: string) {
    if (!d.labels.some((l) => l.id === id)) return;
    patch((n) => void (n.labels = n.labels.filter((l) => l.id !== id)), "remove label");
  }
  /** A new shape keeps every label it still has a place for; Undo brings back any it lost. */
  function setShape(update: (n: AreaDocument) => void, label: string) {
    if (blocked) return false;
    const n = structuredClone(e);
    update(n.document);
    if (!n.document.hole && n.document.shaded === "hole") n.document.shaded = "none";
    const kept = prune(n);
    const lostLabels = d.labels.length - kept.document.labels.length,
      lostNames = d.names.length - kept.document.names.length;
    const ok = commit(kept, label);
    const parts = [...(lostLabels ? [lostLabels === 1 ? "One label" : `${lostLabels} labels`] : []), ...(lostNames ? [lostNames === 1 ? "one point name" : `${lostNames} point names`] : [])];
    if (ok && parts.length) {
      const one = lostLabels + lostNames === 1;
      const list = parts.join(" and ");
      setMessage(`${list[0].toUpperCase()}${list.slice(1)} ${one ? "has" : "have"} no place on the new shape and ${one ? "was" : "were"} removed. Undo brings ${one ? "it" : "them"} back.`);
    }
    return ok;
  }
  function setPolygon(update: (p: Polygon) => void, label: string) {
    if (s.type !== "polygon") return false;
    return setShape((n) => update(n.shape as Polygon), label);
  }
  function setCircle(update: (c: Extract<Shape, { type: "circle" }>) => void, label: string) {
    if (s.type !== "circle") return false;
    return setShape((n) => update(n.shape as Extract<Shape, { type: "circle" }>), label);
  }
  const undo = () => !blocked && documentHistory.undo();
  const redo = () => !blocked && documentHistory.redo();
  function replace(next: Envelope, title: string, explanation = "This replaces the current diagram. You can undo the replacement.") {
    if (!blocked) setPending({ e: next, title, explanation });
  }

  // Autosave with protection for another tab's newer draft (the shared device-draft adapter).
  const savedText = useMemo(() => canonical(history.present), [history.present]);
  const { saveState, keepStored } = useDraftAutosave({
    key: STORAGE,
    text: savedText,
    paused: recovery !== null,
    onConflict: (raw, reason) => {
      setRecovery(raw);
      setProtectedCopy(false);
      setMessage(reason === "newer" ? "A newer draft exists in another tab. Its saved data is protected." : "Saved data changed in another tab. Download its data before replacing it.");
    },
  });
  useEffect(() => {
    if (!active) return;
    const key = (event: KeyboardEvent) => {
      if (document.querySelector('[aria-modal="true"]')) return;
      if (handleUndoKeys(event, { undo, redo })) return;
      // U9: Escape deselects; Delete removes the selected label, as one undo step.
      const command = objectKeyCommand(event);
      if (!command || !current || blocked) return;
      if (command.kind === "deselect") setSelected(null);
      else if (command.kind === "delete" && chosen) {
        event.preventDefault();
        removeLabel(current);
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
        const incoming = parseAreaLink(location.href);
        linkPending.current = true;
        replace(incoming, "Open the linked area and perimeter diagram?");
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
      if (upload.size > 200000) throw Error("This editable file is too large.");
      replace(parseFile(await upload.text()), "Open this area and perimeter diagram?");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err));
    }
  }

  /* ---------- Shape editing ---------- */

  const size = s.type === "polygon" ? extent(s) : null;
  function resize(axis: "width" | "height", text: string) {
    if (!size) return false;
    const v = num(text);
    if (!(v >= 10 && v <= 150)) {
      setMessage("Give a size from 10 to 150 mm.");
      return false;
    }
    const k = v / size[axis];
    return setShape((n) => Object.assign(n, stretch(n, axis === "width" ? k : 1, axis === "height" ? k : 1)), axis === "width" ? "change width" : "change height");
  }
  function applyPreset(p: Preset) {
    setShape((n) => Object.assign(n, presetShape(p)), "change shape");
  }
  function setHole(next: Hole | null) {
    setShape((n) => {
      n.hole = next;
      if (next && n.shaded === "none") n.shaded = "shape";
    }, next ? "add hole" : "remove hole");
  }
  const titleNote = useTitleNote({ active, about: aboutOf(e), disabled: blocked, onSave: (about) => commit(withAbout(e, about), TITLE_NOTE_STEP) });
  const worked = useWorkedNotes({ active, notes: workedOf(e), size: answerSize(answerSvg), disabled: blocked, onSave: (notes) => commit(withWorkedNotes(e, notes), WORKED_STEP) });
  const anchors = hitAnchors(e, g);
  const slotName = (id: string) => slots.find((x) => x.id === id)?.name ?? id;
  const mmField = (labelText: string, value: number, apply: (v: number) => boolean, min: number, max: number) => (
    <DraftField
      label={labelText}
      value={String(round(value))}
      inputMode="decimal"
      maxLength={7}
      disabled={blocked}
      onCommit={(v) => {
        const x = num(v);
        if (!(x >= min && x <= max)) {
          setMessage(`Give a number from ${min} to ${max}.`);
          return false;
        }
        return apply(x);
      }}
    />
  );
  return (
    <div className="app-shell booklet-editor pt-editor area-editor">
      <main className="main-content" id={active ? "main-content" : undefined} tabIndex={-1}>
        <PageHeading title="Area and perimeter" description="Draw compound shapes, triangles, trapeziums, circles, semicircles and sectors, with lengths given or left for pupils.">
          <ResourceSaveStatus text={saveState} />
        </PageHeading>
        <section className="workspace">
          <Panel className="editor-card">
            <EditorToolbar
              canUndo={!blocked && history.past.length > 0}
              undoLabel={undoStepName(history)}
              resetStep={history.resetStep}
              active={active}
              redoLabel={redoStepName(history)}
              canRedo={!blocked && history.future.length > 0}
              onUndo={undo}
              onRedo={redo}
              onReset={() => replace(fresh(), "Reset the area and perimeter diagram?")}
              resetDisabled={blocked}
              exportDisabled={blocked || !!issue}
              menuDisabled={blocked}
              busy={busy}
              onCopy={() => void run(() => copyWord(e, view), "Copied for Word at " + formatResourceSize(g.width / 10, g.height / 10) + ". Paste with Ctrl+V.")}
              onCopyClipboard={() => void run(() => copyPngToClipboard(() => printPng(e, view)))}
              menuId="area-downloads"
              menuOpen={menu}
              onToggleMenu={() => setMenu(!menu)}
            />
            <EditorDownloadMenu
              wordHelp
              id="area-downloads"
              open={menu}
              active={active}
              onClose={() => setMenu(false)}
              onBusyChange={setBusy}
              onMessage={setMessage}
              actions={diagramFileMenu({
                about: titleNote.item,
                worked: worked.item,
                both: { action: () => downloadBoth(e), disabled: blocked || !!issue, success: "Pupil and answers ZIP download started." },
                svg: { action: () => downloadImage(e, "svg", view), disabled: blocked || !!issue, success: "SVG download started." },
                png: { action: () => downloadImage(e, "png", view), disabled: blocked || !!issue, success: "PNG download started." },
                pdf: { action: () => downloadImage(e, "pdf", view), disabled: blocked || !!issue, success: "PDF download started." },
                save: { action: () => downloadEditable(e), disabled: blocked, success: "Editable file download started." },
                open: { action: () => file.current?.click(), disabled: blocked, success: "" },
                link: { action: () => navigator.clipboard.writeText(areaLink(e, location.href)), disabled: blocked, success: "Editable link copied." },
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
            <div className="pt-preview-bar">
              <PreviewControls zoom={zoom} onZoom={setZoom} />
              <ResourceSize width={g.width / 10} height={g.height / 10} />
              <AnswerCopyToggle checked={view === "answer"} disabled={blocked} onChange={(checked) => setView(checked ? "answer" : "pupil")} />
            </div>
            <EditorHint tool="area">Click a side, line or the middle of the shape to label it. Change the shape in the settings.</EditorHint>
            <div className="pt-scroll" ref={fitted.ref}>
              <div className="pt-stage">
                <div
                  className="pt-resource"
                  data-testid="area-resource"
                  style={{ width: ((g.width * 96) / 25.4) * fitted.scale, height: ((g.height * 96) / 25.4) * fitted.scale }}
                  onClick={(ev) => {
                    if (ev.target === ev.currentTarget) setSelected(null);
                  }}
                >
                  <div className="pt-art" dangerouslySetInnerHTML={{ __html: previewArt(viewSvg, e, view === "answer") }} />
                  {anchors.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      className={`area-hit${a.id === current ? " area-current" : ""}${d.labels.some((x) => x.id === a.id) ? "" : " area-unmarked"}`}
                      style={{ left: a.at.x * pxPerMm, top: a.at.y * pxPerMm }}
                      aria-label={`Select the label on ${a.name} (${a.id})`}
                      aria-pressed={a.id === current}
                      disabled={blocked}
                      onClick={() => setSelected(a.id)}
                    />
                  ))}
                </div>
              </div>
            </div>
            {(message || issue || g.notes.length > 0) && (
              <div className="pt-status" aria-live="polite">
                {message && (
                  <p className="resource-feedback" role="status">
                    {message}
                  </p>
                )}
                {g.issues.map((x) => (
                  <p key={x} className="pt-error" role="alert">
                    {x}
                  </p>
                ))}
                {g.notes.map((x) => (
                  <p key={x}>Teacher note: {x}</p>
                ))}
              </div>
            )}
          </Panel>
          <aside className="inspector-stack" aria-label="Area and perimeter settings">
            <ExampleGallery
              examples={areaGallery}
              active={active}
              disabled={blocked}
              onUse={(resource, title) => replace(resource, `Open ${title}?`)}
              onWorked={(resource) => commit(resource, "use worked version")}
            />
            <section className="panel-card pt-panel" aria-label="Selected label">
              <h2>{current ? `Label: ${slotName(current)}` : "Selected label"}</h2>
              <div className="pt-fields">
                <label>
                  Place
                  <select aria-label="Label to edit" value={current ?? ""} disabled={blocked} onChange={(ev) => setSelected(ev.target.value || null)}>
                    <option value="">Choose a place</option>
                    {slots.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.name} ({x.id}){d.labels.some((l) => l.id === x.id) ? " ✓" : ""}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              {current ? (
                <>
                  <div className="pt-fields">
                    <label>
                      Label
                      <select
                        aria-label="Label shows"
                        value={chosen?.state ?? "blank"}
                        disabled={blocked}
                        onChange={(ev) => {
                          const state = ev.target.value as LabelState;
                          if (state === "value" && chosen?.answer) {
                            setMessage("A given length prints on both copies, so it cannot keep a saved answer. Clear the saved answer first.");
                            return;
                          }
                          if ((state === "value" || state === "symbol") && !chosen?.text) {
                            setMessage(state === "value" ? "Type the length first, such as 8 cm." : "Type the letter first, such as x.");
                            return;
                          }
                          setLabel(current, (l) => void (l.state = state), "change label");
                        }}
                      >
                        {(Object.keys(STATE_NAMES) as LabelState[]).map((x) => (
                          <option key={x} value={x}>
                            {STATE_NAMES[x]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Text
                      <DraftField
                        label="Label text"
                        value={chosen?.text ?? ""}
                        disabled={blocked}
                        onCommit={(v) =>
                          setLabel(current, (l) => {
                            l.text = v.trim();
                            // Typing a length or a letter shows it; clearing it leaves the place blank.
                            if (!l.text && (l.state === "value" || l.state === "symbol")) l.state = l.answer ? "hidden" : "blank";
                            else if (l.text && l.state === "blank") l.state = /\d/.test(l.text) && !l.answer ? "value" : "symbol";
                          }, "edit label")
                        }
                      />
                    </label>
                    <label>
                      Saved answer
                      <DraftField
                        label="Saved answer (answers copy only)"
                        value={chosen?.answer ?? ""}
                        disabled={blocked || chosen?.state === "value"}
                        onCommit={(v) =>
                          setLabel(current, (l) => {
                            l.answer = v.trim();
                            // An answer on an empty place is hidden from pupils.
                            if (l.answer && l.state === "blank") l.state = "hidden";
                          }, "edit answer")
                        }
                      />
                    </label>
                  </div>
                  <p className="pt-note">Type lengths with their units (8 cm). 1/2 prints as a stacked fraction, ^2 as ² and pi as π. A saved answer prints only on the answers copy, so “25π cm²” stays exact.</p>
                  {chosen?.state === "value" && <p className="pt-note">A given length is printed on both copies, so it has no saved answer.</p>}
                  {chosen && chosen.state !== "value" && chosen.answer && <p className="pt-note">The answers copy prints {printed(chosen, "answer").text} here in pink; the pupil copy never shows it.</p>}
                  <div className="pt-row">
                    <button type="button" disabled={blocked || !chosen} onClick={() => removeLabel(current)}>
                      Remove label
                    </button>
                  </div>
                </>
              ) : (
                <p className="pt-note">Click a place on the diagram, or choose one above, to label it.</p>
              )}
              <div className="pt-row">
                <button
                  type="button"
                  disabled={blocked || !hasHidden(e)}
                  onClick={() =>
                    patch((n) => {
                      for (const l of n.labels)
                        if (l.state !== "value" && l.answer) {
                          l.text = l.answer;
                          l.state = "value";
                          l.answer = "";
                        }
                    }, "show all")
                  }
                >
                  Print every saved answer on the pupil copy
                </button>
              </div>
            </section>
            <section className="panel-card pt-panel" aria-label="Shape">
              <h2>Shape</h2>
              <div className="pt-fields">
                <label>
                  Start from
                  <select
                    aria-label="Start from a shape"
                    value=""
                    disabled={blocked}
                    onChange={(ev) => {
                      if (ev.target.value) applyPreset(ev.target.value as Preset);
                    }}
                  >
                    <option value="">Choose a shape…</option>
                    {PRESETS.map((p) => (
                      <option key={p} value={p}>
                        {PRESET_NAMES[p]}
                      </option>
                    ))}
                  </select>
                </label>
                {size && (
                  <>
                    <label>
                      Width (mm)
                      {mmField("Shape width", size.width, (v) => resize("width", String(v)), 10, 150)}
                    </label>
                    <label>
                      Height (mm)
                      {mmField("Shape height", size.height, (v) => resize("height", String(v)), 10, 150)}
                    </label>
                  </>
                )}
              </div>
              <p className="pt-note">Labels stay on their sides when the shape changes. The drawing does not have to match the lengths you print.</p>
              {s.type === "circle" && (
                <>
                  <div className="pt-fields">
                    <label>
                      Part
                      <select aria-label="Part of a circle" value={s.part} disabled={blocked} onChange={(ev) => setCircle((c) => {
                        c.part = ev.target.value as CirclePart;
                        if (c.part !== "full") c.line = "none";
                        c.centre = c.part === "full";
                      }, "change part")}>
                        {PARTS.map((p) => (
                          <option key={p} value={p}>
                            {PART_NAMES[p]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Radius (mm)
                      {mmField("Radius", s.radiusMm, (v) => setCircle((c) => void (c.radiusMm = v), "change radius"), 10, 80)}
                    </label>
                    {s.part === "sector" && (
                      <label>
                        Angle (°)
                        {mmField("Sector angle", s.angleDeg, (v) => setCircle((c) => void (c.angleDeg = v), "change angle"), 5, 355)}
                      </label>
                    )}
                    {s.part === "full" && (
                      <label>
                        Line
                        <select aria-label="Line across the circle" value={s.line} disabled={blocked} onChange={(ev) => setCircle((c) => void (c.line = ev.target.value as typeof c.line), "change line")}>
                          <option value="radius">Radius</option>
                          <option value="diameter">Diameter</option>
                          <option value="none">None</option>
                        </select>
                      </label>
                    )}
                  </div>
                  <label className="pt-hide">
                    <input type="checkbox" disabled={blocked} checked={s.centre} onChange={(ev) => setCircle((c) => void (c.centre = ev.target.checked), "centre dot")} />
                    Dot at the centre
                  </label>
                </>
              )}
              {s.type === "polygon" && (
                <details>
                  <summary>Corners, sides and heights</summary>
                  <p className="pt-note">Corners go anticlockwise. Positions are in mm (up is positive). A side can be a semicircle added to the shape or cut out of it.</p>
                  <table className="area-corner-table">
                    <thead>
                      <tr>
                        <th scope="col">Corner</th>
                        <th scope="col">Across</th>
                        <th scope="col">Up</th>
                        <th scope="col">Next side</th>
                        <th scope="col">Right angle</th>
                      </tr>
                    </thead>
                    <tbody>
                      {s.corners.map((c, k) => (
                        <tr key={k}>
                          <th scope="row">{k + 1}</th>
                          {(["x", "y"] as const).map((axis) => (
                            <td key={axis}>
                              {mmField(`Corner ${k + 1} ${axis === "x" ? "across" : "up"}`, c[axis], (v) => setPolygon((p) => void (p.corners[k] = { ...p.corners[k], [axis]: v }), "move corner"), -150, 150)}
                            </td>
                          ))}
                          <td>
                            <select aria-label={`Side ${k + 1}`} value={s.arcs[k]} disabled={blocked} onChange={(ev) => setPolygon((p) => void (p.arcs[k] = ev.target.value as ArcKind), "change side")}>
                              {ARCS.map((a) => (
                                <option key={a} value={a}>
                                  {ARC_NAMES[a]}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <input
                              type="checkbox"
                              aria-label={`Right-angle mark at corner ${k + 1}`}
                              disabled={blocked}
                              checked={s.rightAngles.includes(k + 1)}
                              onChange={(ev) =>
                                setPolygon((p) => void (p.rightAngles = ev.target.checked ? [...p.rightAngles, k + 1].sort((a, b) => a - b) : p.rightAngles.filter((x) => x !== k + 1)), "right angle")
                              }
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="pt-row">
                    <button
                      type="button"
                      disabled={blocked || s.corners.length >= MAX_CORNERS}
                      onClick={() =>
                        setPolygon((p) => {
                          // Split the last side in two, so nothing else moves.
                          const a = p.corners[p.corners.length - 1],
                            b = p.corners[0];
                          p.corners.push({ x: round((a.x + b.x) / 2), y: round((a.y + b.y) / 2) });
                          // Both halves of the split side are straight; a semicircle on it would change size.
                          p.arcs[p.arcs.length - 1] = "none";
                          // A height to the split side would now meet only its first half.
                          p.heights = p.heights.filter((h) => h.side !== p.arcs.length);
                          p.arcs.push("none");
                        }, "add corner")
                      }
                    >
                      Add a corner
                    </button>
                    <button
                      type="button"
                      disabled={blocked || s.corners.length <= 3}
                      onClick={() =>
                        setPolygon((p) => {
                          const n = p.corners.length;
                          p.corners.pop();
                          p.arcs.pop();
                          // The new closing side is straight, and the corners at its ends have new angles.
                          p.arcs[p.arcs.length - 1] = "none";
                          p.rightAngles = p.rightAngles.filter((k) => k < n - 1 && k !== 1);
                          p.heights = p.heights.filter((h) => h.corner < n && h.side < n - 1);
                        }, "remove corner")
                      }
                    >
                      Remove the last corner
                    </button>
                  </div>
                  <h3 className="area-sub">Dashed heights</h3>
                  {s.heights.map((h, i) => (
                    <div key={i} className="pt-row area-row">
                      <label>
                        From corner
                        <select aria-label={`Height ${i + 1} from corner`} value={h.corner} disabled={blocked} onChange={(ev) => setPolygon((p) => void (p.heights[i] = { ...p.heights[i], corner: Number(ev.target.value) }), "move height")}>
                          {s.corners.map((_, k) => (
                            <option key={k} value={k + 1}>
                              {k + 1}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        To side
                        <select aria-label={`Height ${i + 1} to side`} value={h.side} disabled={blocked} onChange={(ev) => setPolygon((p) => void (p.heights[i] = { ...p.heights[i], side: Number(ev.target.value) }), "move height")}>
                          {s.corners.map((_, k) => (
                            <option key={k} value={k + 1}>
                              {k + 1}
                            </option>
                          ))}
                        </select>
                      </label>
                      <button type="button" aria-label={`Remove height ${i + 1}`} disabled={blocked} onClick={() => setPolygon((p) => void p.heights.splice(i, 1), "remove height")}>
                        Remove
                      </button>
                    </div>
                  ))}
                  <div className="pt-row">
                    <button
                      type="button"
                      disabled={blocked || s.heights.length >= 4 || s.corners.length < 3}
                      onClick={() => {
                        // From the highest corner to the lowest straight side across from it, as exam diagrams draw it.
                        const c = s.corners,
                          n = c.length,
                          top = c.reduce((best, q, k) => (q.y > c[best].y ? k : best), 0);
                        const sides = c
                          .map((a, k) => {
                            const foot = heightFoot(c, top + 1, k + 1),
                              b = c[(k + 1) % n];
                            // A foot on a corner would draw the height along a side.
                            const clear = Math.min(Math.hypot(foot.x - a.x, foot.y - a.y), Math.hypot(foot.x - b.x, foot.y - b.y)) > 1;
                            return { side: k + 1, y: (a.y + b.y) / 2, clear };
                          })
                          .filter((x) => x.clear && x.side !== top + 1 && x.side % n !== top && s.arcs[x.side - 1] === "none")
                          .sort((a, b) => a.y - b.y);
                        if (!sides.length) setMessage("This shape has no side across from its top corner for a height to meet.");
                        else if (s.heights.some((h) => h.corner === top + 1 && h.side === sides[0].side)) setMessage("That height is already drawn. Change its corner or side below.");
                        else setPolygon((p) => void p.heights.push({ corner: top + 1, side: sides[0].side }), "add height");
                      }}
                    >
                      Add a dashed height
                    </button>
                  </div>
                </details>
              )}
            </section>
            <section className="panel-card pt-panel" aria-label="Hole and shading">
              <h2>Hole and shading</h2>
              <div className="pt-fields">
                <label>
                  Hole
                  <select aria-label="Hole" value={d.hole?.type ?? "none"} disabled={blocked} onChange={(ev) => setHole(ev.target.value === "none" ? null : holeFor(d, ev.target.value as Hole["type"]))}>
                    <option value="none">None</option>
                    <option value="rectangle">Rectangle</option>
                    <option value="circle">Circle</option>
                  </select>
                </label>
                <label>
                  Shading
                  <select aria-label="Shading" value={d.shaded} disabled={blocked} onChange={(ev) => patch((n) => void (n.shaded = ev.target.value as AreaDocument["shaded"]), "change shading")}>
                    <option value="none">None</option>
                    <option value="shape">{d.hole ? "The shape around the hole" : "The shape"}</option>
                    {d.hole && <option value="hole">The hole</option>}
                  </select>
                </label>
                {d.hole &&
                  (["x", "y", ...(d.hole.type === "rectangle" ? ["w", "h"] : ["r"])] as const).map((k) => (
                    <label key={k}>
                      {({ x: d.hole!.type === "circle" ? "Centre across" : "Left", y: d.hole!.type === "circle" ? "Centre up" : "Bottom", w: "Width", h: "Height", r: "Radius" } as Record<string, string>)[k]} (mm)
                      {mmField(`Hole ${k}`, (d.hole as Record<string, number | string>)[k] as number, (v) => setShape((n) => void ((n.hole as Record<string, number | string>)[k] = v), "change hole"), k === "x" || k === "y" ? -150 : 2, k === "x" || k === "y" ? 150 : 250)}
                    </label>
                  ))}
              </div>
            </section>
            <section className="panel-card pt-panel" aria-label="Point names">
              <details>
                <summary>Point names (A, B, C …)</summary>
                <p className="pt-note">Letters print upright beside their corners, for questions such as “ABCD is a trapezium”.</p>
                <div className="pt-fields">
                  {Object.keys(g.geometry.points).map((id) => (
                    <label key={id}>
                      {pointName(id)}
                      <DraftField
                        label={`Name of ${pointName(id).toLowerCase()}`}
                        value={d.names.find((x) => x.id === id)?.text ?? ""}
                        maxLength={3}
                        disabled={blocked}
                        onCommit={(v) =>
                          patch((n) => {
                            n.names = n.names.filter((x) => x.id !== id);
                            if (v.trim()) n.names.push({ id, text: v.trim() });
                          }, "name point")
                        }
                      />
                    </label>
                  ))}
                </div>
              </details>
            </section>
            <section className="panel-card pt-panel">
              <h2>Printing</h2>
              <div className="pt-fields">
                <label>
                  Text size
                  <select aria-label="Text size" value={d.fontPt ?? 11} disabled={blocked} onChange={(ev) => patch((n) => void (n.fontPt = Number(ev.target.value)), "change text size")}>
                    {[10, 11, 12, 13, 14].filter((v) => v >= MIN_TEXT_PT).map((v) => (
                      <option key={v} value={v}>
                        {v} pt
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Lines
                  <select aria-label="Lines" value={d.lines ?? "normal"} disabled={blocked} onChange={(ev) => patch((n) => setLines(n, ev.target.value as LineWeight), "change lines")}>
                    {LINE_WEIGHTS.map((v) => (
                      <option key={v} value={v}>
                        {LINE_WEIGHT_NAMES[v]}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="pt-hide">
                <input type="checkbox" disabled={blocked} checked={d.grid} onChange={(ev) => patch((n) => void (n.grid = ev.target.checked), "grid")} />
                Centimetre squares behind the shape (true size, for counting squares)
              </label>
              <label className="pt-hide">
                <input type="checkbox" disabled={blocked} checked={d.notToScale} onChange={(ev) => patch((n) => void (n.notToScale = ev.target.checked), "not accurately drawn")} />
                Print “Diagram NOT accurately drawn”
              </label>
              <details>
                <summary>Editing and printing help</summary>
                <p className="pt-note">
                  The drawing never has to match the lengths: exam diagrams are not accurately drawn. When the sides of a rectilinear shape cannot
                  fit together, or the two radii of a sector differ, a teacher note says so. Leave it if the error is deliberate.
                </p>
                <p className="pt-note">
                  Copy for Word carries the physical size shown above the diagram; preview zoom never changes it. Download PNG (600 ppi) or PDF if
                  your browser blocks copying, and print at 100% (actual size) so grid squares measure 1 cm.
                </p>
              </details>
            </section>
          </aside>
        </section>
        {recovery !== null && (
          <section className="panel-card pt-recovery" role="alert">
            <h2>Protect saved data</h2>
            <p>{message}</p>
            <button
              onClick={() => {
                downloadBlob(new Blob([recovery], { type: "application/json" }), downloadName("area", "json", { recovery: true }));
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
                  if (!keepStored(recovery)) {
                    setRecovery(localStorage.getItem(STORAGE) ?? "");
                    setProtectedCopy(false);
                    setMessage("Saved data changed again. Download this latest copy first.");
                    return;
                  }
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
              setView("pupil");
            }}
          >
            <p>{pending.explanation}</p>
            <div className="ratio-import-preview" dangerouslySetInnerHTML={{ __html: renderSvg(pending.e) }} />
          </RatioDialog>
        )}
      </main>
    </div>
  );
}
