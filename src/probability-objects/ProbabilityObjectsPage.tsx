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
import { probabilityObjectsGallery } from "../examples/galleryCatalogue";
import { housePreference, setLines } from "../site/houseStyle";
import { LINE_WEIGHTS, LINE_WEIGHT_NAMES, type LineWeight } from "../../packages/envelope-core/src/house-style";
import { copyStorageKey } from "../site/copyDocument";
import { EditorFoot } from "../site/EditorFoot";
import { ResourceSaveStatus } from "../site/ResourceSaveStatus";
import { EditorDownloadMenu } from "../site/EditorDownloadMenu";
import { diagramFileMenu } from "../site/fileMenu";
import { ResourceSize } from "../site/ResourceSize";
import { AnswerCopyToggle } from "../site/AnswerPreviewToggle";
import { formatResourceSize } from "../site/resourceSizeFormat";
import { EditorToolbar } from "../site/EditorToolbar";
import { PageHeading, Panel } from "../site/PageHeading";
import { RatioDialog } from "../ratio-table/RatioDialog";
import { copyPngToClipboard, downloadBlob } from "../export/clipboard";
import {
  addObject,
  addSector,
  canonical,
  create,
  DICE_MM,
  FILL_NAMES,
  FILLS,
  forView,
  hasHidden,
  labels,
  layout,
  MAX_CAPTION,
  MAX_COUNTERS,
  MAX_FACES,
  MAX_GROUPS,
  MAX_OBJECTS,
  MAX_SECTORS,
  MIN_SECTORS,
  MAX_TEXT,
  moveObject,
  parseFile,
  removeObject,
  removeSector,
  renderSvg,
  sectorAngles,
  setLabel,
  slotValue,
  SPINNER_MM,
  updateObject,
  validate,
  value,
  warnings,
  type Envelope,
  type Fill,
  type ProbabilityObject,
  type Slot,
} from "../../packages/probability-objects-core/src";
import { LINK_PREFIX, parseProbabilityObjectsLink, probabilityObjectsLink } from "./links";
import { copyWord, downloadEditable, downloadImage, printPng, downloadBoth } from "./export";
import { handleUndoKeys, useDocumentHistory, redoLabel as redoStepName, undoLabel as undoStepName, stepName } from "../editor-kit";
const STORAGE = copyStorageKey("maths-booklet-tools:probability-objects:v1");
/** A label on the diagram: its object and its place on the object. */
type Address = { object: string; slot: Slot };

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
        return { e: fresh(), recovery: raw, message: "Saved spinners, dice and bags data needs recovery. Download the original before starting afresh." };
      }
    }
  } catch {
    return { e: fresh(), recovery: null, message: "Device storage is unavailable. Save an editable file to keep your work." };
  }
  return { e: fresh(), recovery: null, message: "" };
}

/** Lets each refused draft keep its reason on screen until that field is fixed or restored. */
const FieldErrors = createContext<{ lastError: () => string; report: (field: string, error: string | null) => void }>({
  lastError: () => "",
  report: () => undefined,
});
/**
 * Keeps its draft while typing; Enter or leaving applies, Escape restores. A draft the table
 * refuses stays in the box, marked invalid, with the reason beside the table.
 */
function DraftField({
  id,
  label,
  value,
  onCommit,
  disabled,
  maxLength,
  className,
  inputMode,
  onFocus,
}: {
  id?: string;
  label: string;
  value: string;
  onCommit: (value: string) => boolean;
  disabled?: boolean;
  maxLength: number;
  className?: string;
  inputMode?: "decimal" | "text";
  onFocus?: () => void;
}) {
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
      className={className}
      aria-label={label}
      aria-invalid={invalid || undefined}
      value={draft}
      disabled={disabled}
      maxLength={maxLength}
      inputMode={inputMode}
      onFocus={onFocus}
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

const TYPE_NAMES: Record<ProbabilityObject["type"], string> = { spinner: "spinner", dice: "dice", bag: "bag" };
const SLOT_NAMES = { sector: "sector", face: "face", group: "group of counters" } as const;
const CUBE_FACES = ["front face", "top face", "right face"];

/** A number typed in a field: refused unless it is a number within its limits. */
function readNumber(text: string, min: number, max: number, what: string): number {
  const v = Number(text.trim());
  if (!text.trim() || !Number.isFinite(v)) throw Error(`Enter a number for ${what}.`);
  if (v < min || v > max) throw Error(`${what[0].toUpperCase()}${what.slice(1)} is ${min} to ${max}.`);
  return v;
}

export default function ProbabilityObjectsPage({ active = true }: { active?: boolean }) {
  const [startup] = useState(initial),
    documentHistory = useDocumentHistory<Envelope>(startup.e, { equals: (a, b) => canonical(a) === canonical(b) }),
    history = documentHistory.history;
  const [recovery, setRecovery] = useState<string | null>(startup.recovery),
    [protectedCopy, setProtectedCopy] = useState(false),
    [message, setMessage] = useState(startup.message),
    [saveState, setSaveState] = useState("Saved on this device"),
    [zoom, setZoom] = useState(0),
    [view, setView] = useState<"pupil" | "answer">("pupil"),
    [menu, setMenu] = useState(false),
    [busy, setBusy] = useState(false),
    [selected, setSelected] = useState<Address | null>(null),
    [pending, setPending] = useState<{ e: Envelope; title: string; explanation: string } | null>(null);
  const file = useRef<HTMLInputElement>(null),
    expected = useRef<string | null>(null);
  const e = history.present,
    d = e.document,
    displayed = forView(e, view),
    g = layout(displayed),
    blocked = busy || recovery !== null || pending !== null;
  const fitted = useResourceFit((g.width * 96) / 25.4, (g.height * 96) / 25.4, zoom, (w) => (w < 500 ? 72 : 120));
  const answerSvg = renderSvg(forView(e, "answer"));
  const issue = [...g.issues, workedIssue(answerSvg, e)].filter(Boolean).join(" ");
  const notes = warnings(e);
  const selectedObject = selected ? d.objects.find((o) => o.id === selected.object) : undefined;
  let selectedValue: ReturnType<typeof slotValue> | undefined;
  try {
    selectedValue = selectedObject && selected ? slotValue(selectedObject, selected.slot) : undefined;
  } catch {
    selectedValue = undefined;
  }
  const slotIndex = (slot: string) => Number(slot.split(":")[1]);

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
  /** One undoable change to an object's settings. */
  function change(objectId: string, label: string, update: (o: ProbabilityObject) => void) {
    if (blocked) return false;
    return commit(() => updateObject(e, objectId, update), label);
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
  const objectName = (objectId: string) => {
    const o = d.objects.find((x) => x.id === objectId);
    if (!o) return "";
    const same = d.objects.filter((x) => x.type === o.type);
    return same.length > 1 ? `${TYPE_NAMES[o.type]} ${same.indexOf(o) + 1}` : TYPE_NAMES[o.type];
  };
  const slotName = (a: Address) => {
    const o = d.objects.find((x) => x.id === a.object),
      [kind] = a.slot.split(":") as [keyof typeof SLOT_NAMES],
      i = slotIndex(a.slot);
    const where = o?.type === "dice" && o.view === "cube" ? CUBE_FACES[i] : `${SLOT_NAMES[kind]} ${i + 1}`;
    return `${objectName(a.object)}, ${where}`;
  };
  function choose(a: Address) {
    setSelected(a);
    requestAnimationFrame(() => {
      const field = document.getElementById("po-selected-value") as HTMLInputElement | null;
      field?.focus();
      field?.select();
    });
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
        setMessage("Saved spinners, dice and bags data changed in another tab. Download its data before replacing it.");
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
        const incoming = parseProbabilityObjectsLink(location.href);
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
      if (upload.size > 40000) throw Error("This editable file is too large.");
      replace(parseFile(await upload.text()), "Open this diagram?");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err));
    }
  }
  const px = (mm: number, of: number) => `${(mm / of) * 100}%`;
  /** A number field that applies on Enter or leaving, refusing values outside its limits. */
  const numberField = (o: ProbabilityObject, label: string, current: number, min: number, max: number, set: (o: ProbabilityObject, v: number) => void) => (
    <label>
      {label}
      <DraftField
        key={`${o.id}-${label}-${current}`}
        label={`${objectName(o.id)}: ${label}`}
        value={String(Math.round(current * 100) / 100)}
        maxLength={6}
        inputMode="decimal"
        disabled={blocked}
        onCommit={(text) => {
          try {
            const v = readNumber(text, min, max, label.toLowerCase());
            return change(o.id, `change ${label.toLowerCase()}`, (x) => set(x, v));
          } catch (err) {
            lastError.current = err instanceof Error ? err.message : String(err);
            setMessage(lastError.current);
            return false;
          }
        }}
      />
    </label>
  );
  const captionField = (o: ProbabilityObject) => (
    <label>
      Caption
      <DraftField
        key={`${o.id}-caption`}
        label={`${objectName(o.id)}: caption`}
        value={o.caption}
        maxLength={MAX_CAPTION}
        disabled={blocked}
        onCommit={(text) => change(o.id, "change caption", (x) => void (x.caption = text.trim()))}
      />
    </label>
  );
  const fillSelect = (label: string, current: Fill, set: (f: Fill) => void) => (
    <label>
      {label}
      <select aria-label={label} value={current} disabled={blocked} onChange={(ev) => set(ev.target.value as Fill)}>
        {FILLS.map((f) => (
          <option key={f} value={f}>
            {FILL_NAMES[f]}
          </option>
        ))}
      </select>
    </label>
  );
  const emptySelect = (o: Extract<ProbabilityObject, { emptyLabels: unknown }>) => (
    <label>
      Empty labels
      <select
        aria-label={`${objectName(o.id)}: empty labels`}
        value={o.emptyLabels}
        disabled={blocked}
        onChange={(ev) => change(o.id, "change empty labels", (x) => void ((x as typeof o).emptyLabels = ev.target.value as typeof o.emptyLabels))}
      >
        <option value="blank">Dotted line</option>
        <option value="none">Nothing</option>
      </select>
    </label>
  );

  const titleNote = useTitleNote({ active, about: aboutOf(e), disabled: blocked, onSave: (about) => commit(withAbout(e, about), TITLE_NOTE_STEP) });
  const worked = useWorkedNotes({ active, notes: workedOf(e), size: answerSize(answerSvg), disabled: blocked, onSave: (notes) => commit(withWorkedNotes(e, notes), WORKED_STEP) });
  const selectedSector = selectedObject?.type === "spinner" && selected ? selectedObject.sectors[slotIndex(selected.slot)] : undefined;
  const selectedGroup = selectedObject?.type === "bag" && selected ? selectedObject.groups[slotIndex(selected.slot)] : undefined;
  return (
    <FieldErrors.Provider value={fieldErrorContext}>
    <div className="app-shell booklet-editor pt-editor po-editor">
      <main className="main-content" id={active ? "main-content" : undefined} tabIndex={-1}>
        <PageHeading title="Spinners, dice and bags" description="Draw spinners with equal or unequal sectors, dice and bags of counters, with labels left blank or hidden for pupils.">
          <ResourceSaveStatus text={saveState} />
        </PageHeading>
        <section className="workspace">
          <Panel className="editor-card">
            <EditorToolbar
              examples={
                <ExampleGallery
                  examples={probabilityObjectsGallery}
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
              menuId="po-downloads"
              menuOpen={menu}
              onToggleMenu={() => setMenu(!menu)}
            />
            <EditorDownloadMenu
              wordHelp
              id="po-downloads"
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
                link: {
                  action: () => navigator.clipboard.writeText(probabilityObjectsLink(e, location.href)),
                  disabled: blocked,
                  success: "Editable link copied.",
                },
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
                <div
                  className="pt-resource"
                  data-testid="probability-objects-resource"
                  style={{ width: ((g.width * 96) / 25.4) * fitted.scale, height: ((g.height * 96) / 25.4) * fitted.scale }}
                >
                  <div className="pt-art" dangerouslySetInnerHTML={{ __html: previewArt(renderSvg(displayed), e, view === "answer") }} />
                  {g.hits.map((h, k) => {
                    const a = { object: h.objectId, slot: h.slot },
                      o = d.objects.find((x) => x.id === h.objectId);
                    let v: ReturnType<typeof slotValue> | null = null;
                    try {
                      v = o ? slotValue(o, h.slot) : null;
                    } catch {
                      v = null;
                    }
                    const hiddenHere = view === "pupil" && v?.show === "hidden";
                    return (
                      <button
                        key={`${h.objectId}-${h.slot}-${k}`}
                        type="button"
                        className={`pt-hit ${selected?.object === h.objectId && selected.slot === h.slot ? "pt-selected" : ""} ${hiddenHere ? "pt-hidden-answer" : ""}`}
                        aria-label={`Edit the ${slotName(a)}`}
                        title={hiddenHere ? "Hidden answer (pupils fill this in)" : undefined}
                        disabled={blocked}
                        style={{ left: px(h.x, g.width), top: px(h.y, g.height), width: px(h.width, g.width), height: px(h.height, g.height) }}
                        onClick={() => choose(a)}
                      />
                    );
                  })}
                </div>
              </div>
            </div>
            <EditorFoot
              zoom={zoom}
              onZoom={setZoom}
              scale={fitted.scale}
              size={<ResourceSize width={g.width / 10} height={g.height / 10} />}
              status={shownMessage}
              hint={<EditorHint tool="probability-objects">Click a sector, a dice face or a counter to edit its label. Enter applies; Escape restores.</EditorHint>}
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
          <aside className="inspector-stack" aria-label="Spinners, dice and bags settings">
            <ReturnToDiagram />
            <section className="panel-card pt-panel" aria-label="Selected label">
              <h2>{selected && selectedValue ? `Selected: ${slotName(selected)}` : "Selected label"}</h2>
              {selected && selectedObject && selectedValue ? (
                <>
                  <div className="pt-fields">
                    <label>
                      Label
                      <DraftField
                        key={`${selected.object}-${selected.slot}`}
                        id="po-selected-value"
                        label="Selected label"
                        value={selectedValue.text}
                        maxLength={MAX_TEXT}
                        disabled={blocked}
                        onCommit={(v) => commit(() => setLabel(e, selected.object, selected.slot, { text: v }))}
                      />
                    </label>
                  </div>
                  <label className="pt-hide" title="Hidden labels are saved answers; pupils see a blank.">
                    <input
                      type="checkbox"
                      disabled={blocked || !selectedValue.text}
                      checked={selectedValue.show === "hidden"}
                      onChange={(ev) => commit(() => setLabel(e, selected.object, selected.slot, { show: ev.target.checked ? "hidden" : "show" }))}
                    />
                    Hide for pupils (keep as an answer)
                  </label>
                  {!selectedValue.text && <p className="pt-note">This label is blank with no answer. Enter the answer first to hide it.</p>}
                  {selectedSector && selectedObject.type === "spinner" && (
                    <>
                      <div className="pt-fields">
                        {fillSelect("Sector fill", selectedSector.fill, (f) =>
                          change(selectedObject.id, "change sector fill", (x) => void ((x as typeof selectedObject).sectors[slotIndex(selected.slot)].fill = f)),
                        )}
                        <label>
                          Angle (°)
                          <DraftField
                            key={`${selected.object}-${selected.slot}-angle-${selectedSector.angle}`}
                            label="Sector angle"
                            value={selectedSector.angle === null ? "" : String(selectedSector.angle)}
                            maxLength={6}
                            inputMode="decimal"
                            disabled={blocked || selectedObject.shape === "polygon"}
                            onCommit={(text) => {
                              try {
                                const angle = text.trim() ? readNumber(text, 1, 359, "a sector angle") : null;
                                return change(selectedObject.id, "change sector angle", (x) => void ((x as typeof selectedObject).sectors[slotIndex(selected.slot)].angle = angle));
                              } catch (err) {
                                lastError.current = err instanceof Error ? err.message : String(err);
                                setMessage(lastError.current);
                                return false;
                              }
                            }}
                          />
                        </label>
                      </div>
                      <p className="pt-note">
                        Leave the angle empty to share what is left equally (now {Math.round(sectorAngles(selectedObject)[slotIndex(selected.slot)] * 100) / 100}°).
                      </p>
                      <div className="pt-row">
                        <button type="button" disabled={blocked || selectedObject.sectors.length >= MAX_SECTORS} onClick={() => commit(() => addSector(e, selectedObject.id, slotIndex(selected.slot)), "add sector")}>
                          Add a sector after it
                        </button>
                        <button
                          type="button"
                          disabled={blocked || selectedObject.sectors.length <= MIN_SECTORS}
                          onClick={() => {
                            if (commit(() => removeSector(e, selectedObject.id, slotIndex(selected.slot)), "remove sector")) setSelected(null);
                          }}
                        >
                          Remove this sector
                        </button>
                      </div>
                    </>
                  )}
                  {selectedGroup && selectedObject.type === "bag" && (
                    <>
                      <div className="pt-fields">
                        {fillSelect("Counter fill", selectedGroup.fill, (f) =>
                          change(selectedObject.id, "change counter fill", (x) => void ((x as typeof selectedObject).groups[slotIndex(selected.slot)].fill = f)),
                        )}
                        {numberField(selectedObject, "Counters", selectedGroup.count, 1, MAX_COUNTERS, (x, v) => void ((x as typeof selectedObject).groups[slotIndex(selected.slot)].count = Math.round(v)))}
                      </div>
                      <div className="pt-row">
                        <button
                          type="button"
                          disabled={blocked || selectedObject.groups.length <= 1}
                          onClick={() => {
                            if (change(selectedObject.id, "remove group", (x) => void (x as typeof selectedObject).groups.splice(slotIndex(selected.slot), 1))) setSelected(null);
                          }}
                        >
                          Remove this group
                        </button>
                      </div>
                    </>
                  )}
                  <p className="pt-note">Write colours as words or letters (Red, R) and give them different fills, so they read in black and white.</p>
                </>
              ) : (
                <p className="pt-note">Click a sector, a dice face or a counter to choose its label.</p>
              )}
              <div className="pt-row">
                <button
                  type="button"
                  disabled={blocked || !hasHidden(e)}
                  onClick={() =>
                    commit(() => {
                      const n = structuredClone(e);
                      for (const o of n.document.objects) for (const v of labels(o)) v.show = "show";
                      return n;
                    }, "show all")
                  }
                >
                  Show all
                </button>
              </div>
            </section>
            <section className="panel-card pt-panel">
              <h2>Objects</h2>
              {d.objects.map((o, i) => (
                <fieldset key={o.id} className="po-object">
                  <legend>{objectName(o.id).replace(/^./, (c) => c.toUpperCase())}</legend>
                  {o.type === "spinner" && (
                    <div className="pt-fields">
                      <label>
                        Shape
                        <select
                          aria-label={`${objectName(o.id)}: shape`}
                          value={o.shape}
                          disabled={blocked}
                          onChange={(ev) =>
                            change(o.id, "change spinner shape", (x) => {
                              const s = x as typeof o;
                              s.shape = ev.target.value as typeof o.shape;
                              if (s.shape === "polygon") {
                                for (const sec of s.sectors) sec.angle = null;
                                s.rightAngles = false;
                                if (s.pointer === "arrow") s.pointer = "stick";
                              }
                            })
                          }
                        >
                          <option value="circle">Circle</option>
                          <option value="polygon">Polygon ({o.sectors.length} sides)</option>
                        </select>
                      </label>
                      <label>
                        Pointer
                        <select
                          aria-label={`${objectName(o.id)}: pointer`}
                          value={o.pointer}
                          disabled={blocked}
                          onChange={(ev) => change(o.id, "change pointer", (x) => void ((x as typeof o).pointer = ev.target.value as typeof o.pointer))}
                        >
                          <option value="arrow">Arrow</option>
                          <option value="stick">Stick</option>
                          <option value="none">None</option>
                        </select>
                      </label>
                      {numberField(o, "Pointer direction (°)", o.pointerAngle, 0, 359, (x, v) => void ((x as typeof o).pointerAngle = v))}
                      {numberField(o, "Turn (°)", o.rotation, 0, 359, (x, v) => void ((x as typeof o).rotation = v))}
                      {numberField(o, "Size (mm)", o.sizeMm, SPINNER_MM.min, SPINNER_MM.max, (x, v) => void ((x as typeof o).sizeMm = v))}
                      {emptySelect(o)}
                      {captionField(o)}
                    </div>
                  )}
                  {o.type === "spinner" && (
                    <>
                      {o.shape === "circle" && (
                        <label className="pt-hide">
                          <input type="checkbox" disabled={blocked} checked={o.rightAngles} onChange={(ev) => change(o.id, "change right angles", (x) => void ((x as typeof o).rightAngles = ev.target.checked))} />
                          Mark right angles
                        </label>
                      )}
                      <div className="pt-row">
                        <button type="button" disabled={blocked || o.sectors.length >= MAX_SECTORS} onClick={() => commit(() => addSector(e, o.id), "add sector")}>
                          Add a sector
                        </button>
                        <button type="button" disabled={blocked || o.sectors.length <= MIN_SECTORS} onClick={() => commit(() => removeSector(e, o.id, o.sectors.length - 1), "remove sector")}>
                          Remove the last sector
                        </button>
                      </div>
                    </>
                  )}
                  {o.type === "dice" && (
                    <>
                      <div className="pt-fields">
                        <label>
                          View
                          <select
                            aria-label={`${objectName(o.id)}: view`}
                            value={o.view}
                            disabled={blocked}
                            onChange={(ev) =>
                              change(o.id, "change dice view", (x) => {
                                const dice = x as typeof o;
                                dice.view = ev.target.value as typeof o.view;
                                if (dice.view === "cube") dice.faces = [...dice.faces, value(), value()].slice(0, 3);
                              })
                            }
                          >
                            <option value="cube">Cube (three faces)</option>
                            <option value="faces">Faces in a row</option>
                          </select>
                        </label>
                        <label>
                          Marks
                          <select aria-label={`${objectName(o.id)}: marks`} value={o.marks} disabled={blocked} onChange={(ev) => change(o.id, "change dice marks", (x) => void ((x as typeof o).marks = ev.target.value as typeof o.marks))}>
                            <option value="pips">Pips (1 to 6)</option>
                            <option value="numbers">Numbers</option>
                          </select>
                        </label>
                        {numberField(o, "Size (mm)", o.sizeMm, DICE_MM.min, DICE_MM.max, (x, v) => void ((x as typeof o).sizeMm = v))}
                        {emptySelect(o)}
                        {captionField(o)}
                      </div>
                      {o.view === "faces" && (
                        <div className="pt-row">
                          <button type="button" disabled={blocked || o.faces.length >= MAX_FACES} onClick={() => change(o.id, "add face", (x) => void (x as typeof o).faces.push(value()))}>
                            Add a face
                          </button>
                          <button type="button" disabled={blocked || o.faces.length <= 1} onClick={() => change(o.id, "remove face", (x) => void (x as typeof o).faces.pop())}>
                            Remove the last face
                          </button>
                        </div>
                      )}
                    </>
                  )}
                  {o.type === "bag" && (
                    <>
                      <div className="pt-fields">{captionField(o)}</div>
                      <p className="pt-note">
                        {o.groups.map((gr) => `${gr.count} ${gr.label.text || "plain"}`).join(", ")}. Click a counter to change its group.
                      </p>
                      <div className="pt-row">
                        <button
                          type="button"
                          disabled={blocked || o.groups.length >= MAX_GROUPS}
                          onClick={() => change(o.id, "add group", (x) => void (x as typeof o).groups.push({ label: value(), fill: FILLS[(x as typeof o).groups.length % FILLS.length], count: 1 }))}
                        >
                          Add a group of counters
                        </button>
                      </div>
                    </>
                  )}
                  <div className="pt-row">
                    <button type="button" disabled={blocked || i === 0} onClick={() => commit(() => moveObject(e, o.id, -1), "move left")}>
                      Move left
                    </button>
                    <button type="button" disabled={blocked || i === d.objects.length - 1} onClick={() => commit(() => moveObject(e, o.id, 1), "move right")}>
                      Move right
                    </button>
                    {d.objects.length > 1 && (
                      <button
                        type="button"
                        disabled={blocked}
                        onClick={() => {
                          if (commit(() => removeObject(e, o.id), `remove ${TYPE_NAMES[o.type]}`)) setSelected(null);
                        }}
                      >
                        Remove {objectName(o.id)}
                      </button>
                    )}
                  </div>
                </fieldset>
              ))}
              <div className="pt-row">
                {(["spinner", "dice", "bag"] as const).map((t) => (
                  <button key={t} type="button" disabled={blocked || d.objects.length >= MAX_OBJECTS} onClick={() => commit(() => addObject(e, t), `add ${t}`)}>
                    Add a {t}
                  </button>
                ))}
              </div>
            </section>
            <section className="panel-card pt-panel">
              <h2>Layout</h2>
              <div className="pt-fields">
                <label>
                  Lines
                  <select
                    aria-label="Lines"
                    value={d.lines ?? "normal"}
                    disabled={blocked}
                    onChange={(ev) =>
                      commit(() => {
                        const n = structuredClone(e);
                        setLines(n.document, ev.target.value as LineWeight);
                        return n;
                      }, "change lines")
                    }
                  >
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
                  Up to {MAX_OBJECTS} objects side by side: spinners with {MIN_SECTORS} to {MAX_SECTORS} sectors, dice and bags of up to {MAX_COUNTERS} counters. An
                  empty label is a blank for pupils; a hidden label is a saved answer that only the answers copy prints. Nothing is ever worked out for you.
                </p>
                <p className="pt-note">Copy for Word carries the physical size shown under the diagram; preview zoom never changes it. Download PNG (600 ppi) if your browser blocks copying.</p>
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
                downloadBlob(new Blob([recovery], { type: "application/json" }), downloadName("probability-objects", "json", { recovery: true }));
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
