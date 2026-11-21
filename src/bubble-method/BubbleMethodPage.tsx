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
import { bubbleMethodGallery } from "../examples/galleryCatalogue";
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
  addStep,
  canonical,
  create,
  forView,
  hasHidden,
  isBubble,
  layout,
  lineIndexOf,
  MAX_OP,
  MAX_SIDE,
  MAX_STEPS,
  parseFile,
  RELATIONS,
  removeStep,
  renderSvg,
  setBubbles,
  setRelation,
  setSlot,
  setUnder,
  slotValue,
  typesetSide,
  validate,
  values,
  warnings,
  type Envelope,
  type Relation,
  type Slot,
  type Under,
} from "../../packages/bubble-method-core/src";
import { terms } from "../../packages/bubble-method-core/src/maths";
import { LINK_PREFIX, parseBubbleMethodLink, bubbleMethodLink } from "./links";
import { copyWord, downloadEditable, downloadImage, printPng, downloadBoth } from "./export";
import { handleUndoKeys, useDocumentHistory, redoLabel as redoStepName, undoLabel as undoStepName, stepName } from "../editor-kit";
import "../site/settings-kit.css";
const STORAGE = copyStorageKey("maths-booklet-tools:bubble-method:v1");
type Doc = Envelope["document"];

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
        return { e: fresh(), recovery: raw, message: "Saved bubble method data needs recovery. Download the original before starting afresh." };
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

/** Plain words for a slot, as screen readers and the inspector say it. */
function slotName(slot: Slot): string {
  if (slot === "first:lhs") return "left side of the first line";
  if (slot === "first:rhs") return "right side of the first line";
  const [, at, part] = slot.split(":"),
    n = Number(at) + 1;
  if (part === "left" || part === "right") return `${part} bubble of step ${n}`;
  return `${part === "lhs" ? "left" : "right"} side of line ${n + 1}`;
}
/** The text of the line above a step's bubbles, on one side. */
function sideAbove(d: Doc, step: number, side: "left" | "right") {
  const l = step === 0 ? d.first : d.steps[step - 1].line;
  return side === "left" ? l.lhs.text : l.rhs.text;
}

export default function BubbleMethodPage({ active = true }: { active?: boolean }) {
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
    [selected, setSelected] = useState<Slot | null>(null),
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
  let selectedValue: ReturnType<typeof slotValue> | undefined;
  try {
    selectedValue = selected ? slotValue(d, selected) : undefined;
  } catch {
    selectedValue = undefined;
  }
  const selectedLine = selected ? lineIndexOf(selected) : null;
  const selectedStep = selected && selected.startsWith("step:") ? Number(selected.split(":")[1]) : -1;
  const selectedSide = selected?.endsWith(":left") ? "left" : selected?.endsWith(":right") ? "right" : null;

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
  function choose(slot: Slot) {
    setSelected(slot);
    requestAnimationFrame(() => {
      const field = document.getElementById("bm-selected-value") as HTMLInputElement | null;
      field?.focus();
      field?.select();
    });
  }
  const lineName = (at: "first" | number) => (at === "first" ? "the first line" : `line ${at + 2}`);
  const relationOf = (at: "first" | number) => (at === "first" ? d.first.rel : d.steps[at].line.rel);
  const underOf = (step: number, side: "left" | "right") => d.steps[step][side].under;
  const termChoices = (step: number, side: "left" | "right") => terms(typesetSide(sideAbove(d, step, side)));

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
        setMessage("Saved bubble method data changed in another tab. Download its data before replacing it.");
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
        const incoming = parseBubbleMethodLink(location.href);
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
    <div className="app-shell booklet-editor pt-editor bub-editor">
      <main className="main-content" id={active ? "main-content" : undefined} tabIndex={-1}>
        <PageHeading title="Bubble method" description="Set out solving equations and inequalities and changing the subject with the bubble method, with lines and bubbles left blank or hidden for pupils.">
          <ResourceSaveStatus text={saveState} />
        </PageHeading>
        <section className="workspace">
          <Panel className="editor-card">
            <EditorToolbar
              examples={
                <ExampleGallery
                  examples={bubbleMethodGallery}
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
              menuId="bm-downloads"
              menuOpen={menu}
              onMenuChange={setMenu}
            />
            <EditorDownloadMenu
              wordHelp
              id="bm-downloads"
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
                  action: () => navigator.clipboard.writeText(bubbleMethodLink(e, location.href)),
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
                  data-testid="bubble-method-resource"
                  style={{ width: ((g.width * 96) / 25.4) * fitted.scale, height: ((g.height * 96) / 25.4) * fitted.scale }}
                >
                  <div className="pt-art" dangerouslySetInnerHTML={{ __html: previewArt(renderSvg(displayed), e, view === "answer") }} />
                  {g.hits.map((h) => {
                    const v = slotValue(d, h.slot),
                      hiddenHere = view === "pupil" && v.show === "hidden";
                    return (
                      <button
                        key={h.slot}
                        type="button"
                        className={`pt-hit ${isBubble(h.slot) ? "" : "bub-line-hit"} ${selected === h.slot ? "pt-selected" : ""} ${hiddenHere ? "pt-hidden-answer" : ""}`}
                        aria-label={`Edit the ${slotName(h.slot)}`}
                        title={hiddenHere ? "Hidden answer (pupils fill this in)" : undefined}
                        disabled={blocked}
                        style={{ left: px(h.x, g.width), top: px(h.y, g.height), width: px(h.width, g.width), height: px(h.height, g.height) }}
                        onClick={() => choose(h.slot)}
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
              hint={<EditorHint tool="bubble-method">Click a side of a line or a bubble to edit it. Enter applies; Escape restores.</EditorHint>}
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
          <aside className="inspector-stack md-kit" aria-label="Bubble method settings">
            <ReturnToDiagram />
            <div className="md-kit-cards">
            <div>
            <section className="panel-card pt-panel" aria-label="Selected item">
              <h2>{selected && selectedValue ? `Selected: ${slotName(selected)}` : "Selected item"}</h2>
              {selected && selectedValue ? (
                <>
                  <div className="pt-fields">
                    <label>
                      {selectedSide ? "Operation" : "Expression"}
                      <DraftField
                        key={selected}
                        id="bm-selected-value"
                        label={selectedSide ? "Selected bubble" : "Selected side"}
                        value={selectedValue.text}
                        maxLength={selectedSide ? MAX_OP : MAX_SIDE}
                        disabled={blocked}
                        onCommit={(v) => commit(() => setSlot(e, selected, { text: v }))}
                      />
                    </label>
                    {selectedSide && selectedStep >= 0 && (
                      <label>
                        Sits under
                        <select
                          aria-label="Bubble sits under"
                          value={String(underOf(selectedStep, selectedSide))}
                          disabled={blocked}
                          onChange={(ev) => {
                            const raw = ev.target.value,
                              under: Under = raw === "auto" || raw === "whole" ? raw : Number(raw);
                            commit(() => setUnder(e, selectedStep, selectedSide, under), "move bubble");
                          }}
                        >
                          <option value="auto">Its term (+ and − under the last term)</option>
                          <option value="whole">The whole side</option>
                          {termChoices(selectedStep, selectedSide).map((t, i) => (
                            <option key={i} value={i}>
                              {t.text}
                            </option>
                          ))}
                          {(() => {
                            const u = underOf(selectedStep, selectedSide);
                            return typeof u === "number" && u >= termChoices(selectedStep, selectedSide).length ? (
                              <option value={u}>Term {u + 1} (not on the line above: shown under its last term)</option>
                            ) : null;
                          })()}
                        </select>
                      </label>
                    )}
                    {!selectedSide && selectedLine !== null && (
                      <label>
                        Sign of {lineName(selectedLine)}
                        <select
                          aria-label="Sign"
                          value={relationOf(selectedLine)}
                          disabled={blocked}
                          onChange={(ev) => commit(() => setRelation(e, selectedLine, ev.target.value as Relation), "change sign")}
                        >
                          {RELATIONS.map((r) => (
                            <option key={r} value={r}>
                              {r}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                  </div>
                  <label className="pt-hide" title="Hidden items are saved answers; pupils see a blank.">
                    <input
                      type="checkbox"
                      disabled={blocked || !selectedValue.text}
                      checked={selectedValue.show === "hidden"}
                      onChange={(ev) => commit(() => setSlot(e, selected, { show: ev.target.checked ? "hidden" : "show" }))}
                    />
                    Hide for pupils (keep as an answer)
                  </label>
                  {!selectedValue.text && (
                    <p className="pt-note">
                      This is a blank with no answer: {selectedSide ? "an empty bubble" : "a dotted line"} for pupils. Enter the answer first to hide it.
                    </p>
                  )}
                  {selectedSide && selectedStep >= 0 && selectedValue.text && (
                    <div className="pt-row">
                      <button type="button" disabled={blocked} onClick={() => commit(() => setBubbles(e, selectedStep, selectedValue.text), "write both bubbles")}>
                        Write it in both bubbles
                      </button>
                    </div>
                  )}
                  <p className="pt-note">
                    {selectedSide
                      ? "Type operations such as -2, /3, x3 or +5: they print as −2, ÷3, ×3 and +5."
                      : "Type 3x+2, y-2 or (y-2)/3: signs print as on a paper, letters in italic and fractions stacked. For a half of x type x/2 or (1/2)x; 1/2x stacks as 1 over 2x."}
                  </p>
                </>
              ) : (
                <p className="pt-note">Click a side of a line or a bubble to choose it.</p>
              )}
              <div className="pt-row">
                <button
                  type="button"
                  disabled={blocked || !hasHidden(e)}
                  onClick={() =>
                    patch((n) => {
                      for (const v of values(n)) v.show = "show";
                    })
                  }
                >
                  Show all
                </button>
              </div>
            </section>
            </div>
            <div>
            <section className="panel-card pt-panel">
              <h2>Steps</h2>
              <p className="pt-note">Each step is a pair of bubbles and the line they lead to. Nothing is worked out for you.</p>
              {d.steps.map((s, i) => (
                <fieldset key={i} className="md-kit-group">
                  <legend>Step {i + 1}</legend>
                  <div className="pt-row">
                    <button type="button" disabled={blocked || d.steps.length >= MAX_STEPS} onClick={() => commit(() => addStep(e, i), "add step")}>
                      Add a step after it
                    </button>
                    <button
                      type="button"
                      disabled={blocked}
                      onClick={() => {
                        if (commit(() => removeStep(e, i), "remove step")) setSelected(null);
                      }}
                    >
                      Remove step {i + 1}
                    </button>
                  </div>
                  {s.left.op.text === "" && s.right.op.text === "" && <p className="pt-note">Both bubbles are empty for pupils.</p>}
                </fieldset>
              ))}
              <div className="pt-row">
                <button type="button" disabled={blocked || d.steps.length >= MAX_STEPS} onClick={() => commit(() => addStep(e), "add step")}>
                  Add a step
                </button>
              </div>
            </section>
            </div>
            <div>
            <section className="panel-card pt-panel">
              <h2>Layout</h2>
              <div className="pt-fields">
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
              <label className="pt-hide" title="For a spot-the-mistake task: bubbles that differ raise no teacher note.">
                <input type="checkbox" disabled={blocked} checked={d.intentionalError} onChange={(ev) => patch((n) => void (n.intentionalError = ev.target.checked))} />
                This working has a deliberate error
              </label>
              <details>
                <summary>Editing and printing help</summary>
                <p className="pt-note">
                  Click a side of a line or a bubble to edit it. Enter applies; Escape restores. Up to {MAX_STEPS} steps. A + or − bubble
                  sits under the last term of the line above and any other bubble under the whole side; choose a term to move it. Bubbles
                  that differ add a teacher note; nothing is corrected for you.
                </p>
                <p className="pt-note">
                  Copy for Word carries the physical size shown under the working; preview zoom never changes it. Download PNG (600 ppi) if
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
                downloadBlob(new Blob([recovery], { type: "application/json" }), downloadName("bubble-method", "json", { recovery: true }));
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
