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
import { functionMachineGallery } from "../examples/galleryCatalogue";
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
  addInverse,
  addMachine,
  addStep,
  canonical,
  complete,
  create,
  forView,
  hasHidden,
  layout,
  MAX_MACHINES,
  MAX_STEPS,
  MAX_TEXT,
  parseFile,
  removeMachine,
  removeStep,
  renderSvg,
  setDirection,
  setSlot,
  slotValue,
  validate,
  values,
  warnings,
  type Envelope,
  type Slot,
} from "../../packages/function-machine-core/src";
import { LINK_PREFIX, parseFunctionMachineLink, functionMachineLink } from "./links";
import { copyWord, downloadEditable, downloadImage, printPng, downloadBoth } from "./export";
import { handleUndoKeys, useDocumentHistory, redoLabel as redoStepName, undoLabel as undoStepName, stepName } from "../editor-kit";
import "../site/settings-kit.css";
const STORAGE = copyStorageKey("maths-booklet-tools:function-machine:v1");
type Doc = Envelope["document"];
/** An item on the diagram: its machine and its place on the machine. */
type Address = { machine: string; slot: Slot };

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
        return { e: fresh(), recovery: raw, message: "Saved function machine data needs recovery. Download the original before starting afresh." };
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

export default function FunctionMachinePage({ active = true }: { active?: boolean }) {
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
    [hideFilled, setHideFilled] = useState(true),
    [between, setBetween] = useState(true),
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
  const selectedMachine = selected ? d.machines.find((m) => m.id === selected.machine) : undefined;
  let selectedValue: ReturnType<typeof slotValue> | undefined;
  try {
    selectedValue = selectedMachine && selected ? slotValue(selectedMachine, selected.slot) : undefined;
  } catch {
    selectedValue = undefined;
  }
  const selectedNumber = (slot: string) => Number(slot.split(":")[1]);
  const selectedIndex = selected && /^(op|out):/.test(selected.slot) ? selectedNumber(selected.slot) : -1;

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
  function patch(update: (n: Doc) => void) {
    if (blocked) return false;
    const n = structuredClone(e);
    update(n.document);
    return commit(n);
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
  const machineName = (machineId: string) => (d.machines.length > 1 ? `machine ${d.machines.findIndex((m) => m.id === machineId) + 1}, ` : "");
  const slotName = (a: Address) => {
    const where = a.slot === "start" ? "start" : a.slot === "end" ? "end" : a.slot.startsWith("op:") ? `box ${selectedNumber(a.slot) + 1}` : `value after box ${selectedNumber(a.slot) + 1}`;
    return `${machineName(a.machine)}${where}`;
  };
  function choose(a: Address) {
    setSelected(a);
    requestAnimationFrame(() => {
      const field = document.getElementById("fm-selected-value") as HTMLInputElement | null;
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
        setMessage("Saved function machine data changed in another tab. Download its data before replacing it.");
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
        const incoming = parseFunctionMachineLink(location.href);
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

  const titleNote = useTitleNote({ active, about: aboutOf(e), disabled: blocked, onSave: (about) => commit(withAbout(e, about), TITLE_NOTE_STEP) });
  const worked = useWorkedNotes({ active, notes: workedOf(e), size: answerSize(answerSvg), disabled: blocked, onSave: (notes) => commit(withWorkedNotes(e, notes), WORKED_STEP) });
  return (
    <FieldErrors.Provider value={fieldErrorContext}>
    <div className="app-shell booklet-editor pt-editor fm-editor">
      <main className="main-content" id={active ? "main-content" : undefined} tabIndex={-1}>
        <PageHeading title="Function machines" description="Draw input and output machines with operations, values or boxes left blank or hidden for pupils, and their inverse machines.">
          <ResourceSaveStatus text={saveState} />
        </PageHeading>
        <section className="workspace">
          <Panel className="editor-card">
            <EditorToolbar
              examples={
                <ExampleGallery
                  examples={functionMachineGallery}
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
              menuId="fm-downloads"
              menuOpen={menu}
              onMenuChange={setMenu}
            />
            <EditorDownloadMenu
              wordHelp
              id="fm-downloads"
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
                  action: () => navigator.clipboard.writeText(functionMachineLink(e, location.href)),
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
                  data-testid="function-machine-resource"
                  style={{ width: ((g.width * 96) / 25.4) * fitted.scale, height: ((g.height * 96) / 25.4) * fitted.scale }}
                >
                  <div className="pt-art" dangerouslySetInnerHTML={{ __html: previewArt(renderSvg(displayed), e, view === "answer") }} />
                  {g.hits.map((h) => {
                    const a = { machine: h.machineId, slot: h.slot },
                      m = d.machines.find((x) => x.id === h.machineId),
                      v = m ? slotValue(m, h.slot) : null,
                      hiddenHere = view === "pupil" && v?.show === "hidden";
                    return (
                      <button
                        key={`${h.machineId}-${h.slot}`}
                        type="button"
                        className={`pt-hit ${selected?.machine === h.machineId && selected.slot === h.slot ? "pt-selected" : ""} ${hiddenHere ? "pt-hidden-answer" : ""}`}
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
              hint={
                <EditorHint tool="function-machine">Click a box, the start, the end or a value on an arrow to edit it. Enter applies; Escape restores.</EditorHint>
              }
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
          <aside className="inspector-stack md-kit" aria-label="Function machine settings">
            <ReturnToDiagram />
            <div className="md-kit-cards">
            <div>
            <section className="panel-card pt-panel" aria-label="Selected item">
              <h2>{selected && selectedValue ? `Selected: ${slotName(selected)}` : "Selected item"}</h2>
              {selected && selectedMachine && selectedValue ? (
                <>
                  <div className="pt-fields">
                    <label>
                      {selected.slot.startsWith("op:") ? "Operation" : "Text or number"}
                      <DraftField
                        key={`${selected.machine}-${selected.slot}`}
                        id="fm-selected-value"
                        label={selected.slot.startsWith("op:") ? "Selected operation" : "Selected value"}
                        value={selectedValue.text}
                        maxLength={MAX_TEXT}
                        disabled={blocked}
                        onCommit={(v) => commit(() => setSlot(e, selected.machine, selected.slot, { text: v }))}
                      />
                    </label>
                  </div>
                  <label className="pt-hide" title="Hidden items are saved answers; pupils see a blank.">
                    <input
                      type="checkbox"
                      disabled={blocked || !selectedValue.text}
                      checked={selectedValue.show === "hidden"}
                      onChange={(ev) => commit(() => setSlot(e, selected.machine, selected.slot, { show: ev.target.checked ? "hidden" : "show" }))}
                    />
                    Hide for pupils (keep as an answer)
                  </label>
                  {!selectedValue.text && <p className="pt-note">This is a blank with no answer. Enter the answer first to hide it.</p>}
                  {selected.slot.startsWith("op:") && (
                    <div className="pt-row">
                      {selectedIndex < selectedMachine.steps.length - 1 && !selectedMachine.steps[selectedIndex].out && (
                        <button type="button" disabled={blocked} onClick={() => commit(() => setSlot(e, selected.machine, `out:${selectedIndex}`, {}), "add value on arrow")}>
                          Add a value after this box
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={blocked || selectedMachine.steps.length >= MAX_STEPS}
                        onClick={() => commit(() => addStep(e, selected.machine, selectedIndex), "add box")}
                      >
                        Add a box after it
                      </button>
                      <button
                        type="button"
                        disabled={blocked || selectedMachine.steps.length <= 1}
                        onClick={() => {
                          if (commit(() => removeStep(e, selected.machine, selectedIndex), "remove box")) setSelected(null);
                        }}
                      >
                        Remove this box
                      </button>
                    </div>
                  )}
                  {selected.slot.startsWith("out:") && (
                    <div className="pt-row">
                      <button
                        type="button"
                        disabled={blocked}
                        onClick={() => {
                          if (commit(() => setSlot(e, selected.machine, selected.slot, null), "remove value on arrow")) setSelected(null);
                        }}
                      >
                        Remove this value
                      </button>
                    </div>
                  )}
                  <p className="pt-note">Type operations such as x3, -8, /2 or + 1/2: they print as × 3, − 8, ÷ 2 and a stacked fraction. Letters print in italic.</p>
                </>
              ) : (
                <p className="pt-note">Click a box, the start, the end or a value on an arrow to choose it.</p>
              )}
              <div className="pt-row">
                <button
                  type="button"
                  disabled={blocked || !hasHidden(e)}
                  onClick={() =>
                    patch((n) => {
                      for (const m of n.machines) for (const v of values(m)) v.show = "show";
                    })
                  }
                >
                  Show all
                </button>
              </div>
            </section>
            <section className="panel-card pt-panel">
              <h2>Machines</h2>
              {d.machines.map((m, i) => (
                <fieldset key={m.id} className="md-kit-group">
                  <legend>{d.machines.length > 1 ? `Machine ${i + 1}` : "The machine"}</legend>
                  <label className="pt-hide" title="A machine that runs backwards, for working out an input from an output.">
                    <input
                      type="checkbox"
                      disabled={blocked}
                      checked={m.direction === "left"}
                      onChange={(ev) => commit(() => setDirection(e, m.id, ev.target.checked ? "left" : "right"), "change direction")}
                    />
                    Arrows right to left
                  </label>
                  <div className="pt-row">
                    <button type="button" disabled={blocked || m.steps.length >= MAX_STEPS} onClick={() => commit(() => addStep(e, m.id), "add box")}>
                      Add a box
                    </button>
                    <button
                      type="button"
                      disabled={blocked || d.machines.length >= MAX_MACHINES}
                      title="The boxes in reverse order with inverse operations, arrows right to left."
                      onClick={() => commit(() => addInverse(e, m.id), "add inverse machine")}
                    >
                      Add the inverse machine
                    </button>
                    {d.machines.length > 1 && (
                      <button
                        type="button"
                        disabled={blocked}
                        onClick={() => {
                          if (commit(() => removeMachine(e, m.id), "remove machine")) setSelected(null);
                        }}
                      >
                        Remove {`machine ${i + 1}`}
                      </button>
                    )}
                  </div>
                </fieldset>
              ))}
              <div className="pt-row">
                <button type="button" disabled={blocked || d.machines.length >= MAX_MACHINES} onClick={() => commit(() => addMachine(e), "add machine")}>
                  Add a different machine
                </button>
              </div>
            </section>
            </div>
            <div>
            <section className="panel-card pt-panel">
              <h2>Work the machines out</h2>
              <p className="pt-note">
                Work out goes forwards from a number at the start, or backwards from a number at the end when the start is blank. It
                fills blanks and can write the value on each arrow. What you entered is kept. Nothing happens until you press the button,
                and it can be undone.
              </p>
              <label className="pt-hide">
                <input type="checkbox" disabled={blocked} checked={between} onChange={(ev) => setBetween(ev.target.checked)} />
                Write the values between the boxes
              </label>
              <label className="pt-hide">
                <input type="checkbox" disabled={blocked} checked={hideFilled} onChange={(ev) => setHideFilled(ev.target.checked)} />
                Hide what it fills (keep as answers)
              </label>
              <div className="pt-row">
                <button
                  type="button"
                  disabled={blocked}
                  onClick={() => {
                    try {
                      const r = complete(e, undefined, hideFilled, between);
                      if (r.filled) commit(r.envelope, "work out machines");
                      else setMessage("There is nothing to work out. Put a number at the start (or at the end, with a blank start) and fill every box.");
                    } catch (err) {
                      setMessage(err instanceof Error ? err.message : String(err));
                    }
                  }}
                >
                  Work out
                </button>
              </div>
            </section>
            <section className="panel-card pt-panel">
              <h2>Layout</h2>
              <div className="pt-fields">
                <label>
                  Boxes
                  <select aria-label="Box shape" value={d.boxShape} disabled={blocked} onChange={(ev) => patch((n) => void (n.boxShape = ev.target.value as Doc["boxShape"]))}>
                    <option value="pentagon">Arrow-shaped</option>
                    <option value="rectangle">Rectangles</option>
                  </select>
                </label>
                <label>
                  Lines
                  <select aria-label="Lines" value={d.lines ?? "normal"} disabled={blocked} onChange={(ev) => patch((n) => setLines(n, ev.target.value as LineWeight))}>
                    {LINE_WEIGHTS.map((v) => (
                      <option key={v} value={v}>
                        {LINE_WEIGHT_NAMES[v]}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="pt-hide" title="For a spot-the-mistake task: values that do not follow raise no teacher note.">
                <input type="checkbox" disabled={blocked} checked={d.intentionalError} onChange={(ev) => patch((n) => void (n.intentionalError = ev.target.checked))} />
                This diagram has a deliberate error
              </label>
              <details>
                <summary>Editing and printing help</summary>
                <p className="pt-note">
                  Click an item on the machine to edit it. Enter applies; Escape restores. Up to {MAX_MACHINES} machines with {MAX_STEPS}{" "}
                  boxes each. Values that do not follow from the machine add a teacher note; they are never corrected for you.
                </p>
                <p className="pt-note">
                  Copy for Word carries the physical size shown under the machine; preview zoom never changes it. Download PNG (600 ppi) if
                  your browser blocks copying.
                </p>
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
                downloadBlob(new Blob([recovery], { type: "application/json" }), downloadName("function-machine", "json", { recovery: true }));
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
