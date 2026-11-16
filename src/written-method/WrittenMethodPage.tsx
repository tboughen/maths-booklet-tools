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
import { writtenMethodGallery } from "../examples/galleryCatalogue";
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
  addNumber,
  addRow,
  canonical,
  complete,
  forView,
  hasHidden,
  isDivision,
  layout,
  MAX_DIGITS,
  MAX_ROWS,
  METHODS,
  METHOD_NAMES,
  parseFile,
  removeNumber,
  removeRow,
  renderSvg,
  rowValue,
  rowValues,
  setMark,
  setMethod,
  setRemainder,
  setRow,
  shiftRow,
  validate,
  warnings,
  type Envelope,
  type Method,
} from "../../packages/written-method-core/src";
import { examples } from "../../packages/written-method-core/src/examples";
import { LINK_PREFIX, parseWrittenMethodLink, writtenMethodLink } from "./links";
import { copyWord, downloadEditable, downloadImage, printPng, downloadBoth } from "./export";
import { handleUndoKeys, useDocumentHistory, redoLabel as redoStepName, undoLabel as undoStepName, stepName } from "../editor-kit";
const STORAGE = copyStorageKey("maths-booklet-tools:written-method:v1");
type Doc = Envelope["document"];
/** Place-value column names for the small-digit inputs. */
const PLACE_NAMES: Record<number, string> = {
  [-3]: "thousandths",
  [-2]: "hundredths",
  [-1]: "tenths",
  0: "ones",
  1: "tens",
  2: "hundreds",
  3: "thousands",
  4: "ten thousands",
  5: "hundred thousands",
  6: "millions",
};
const placeName = (p: number) => PLACE_NAMES[p] ?? `10^${p}`;

/** A new diagram starts from the house style's lines (U111). */
function fresh() {
  // A column addition with its numbers given and the answer left for pupils: a blank method shows only lines.
  const e = examples.find((x) => x.id === "column-add")!.make(false);
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
        return { e: fresh(), recovery: raw, message: "Saved written method data needs recovery. Download the original before starting afresh." };
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

export default function WrittenMethodPage({ active = true }: { active?: boolean }) {
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
    [selected, setSelected] = useState<string | null>(null),
    [hideFilled, setHideFilled] = useState(true),
    [decimals, setDecimals] = useState(false),
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
  const selectedValue = selected ? rowValue(d, selected) : null;
  const selectedWork = selected ? d.working.find((w) => w.id === selected) : undefined;
  const division = isDivision(d.method);
  const marksOf = (row: string) => d.marks.filter((m) => m.row === row);
  /** The columns a row's small digits can go in: every column of the method. */
  const columns = (row: string) => {
    const places = Array.from({ length: g.maxPlace - g.minPlace + 1 }, (_, i) => g.maxPlace - i);
    // A small digit outside the columns (from a file or the connector) is listed too, so it can be removed.
    for (const m of marksOf(row)) if (!places.includes(m.place)) places.push(m.place);
    return places.sort((x, y) => y - x);
  };

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
  const rowName = (row: string) => {
    if (row === "answer") return division ? "the answer (above the bus stop)" : "the answer";
    if (row === "remainder") return "the remainder";
    if (row === "extend") return "the zeros after the point";
    if (row === "n1" && division) return "the number to divide";
    if (row === "n2" && division) return "the number to divide by";
    const n = d.numbers.findIndex((x) => x.id === row);
    if (n >= 0) return `number ${n + 1}`;
    return `working row ${d.working.findIndex((w) => w.id === row) + 1}`;
  };
  function choose(row: string) {
    setSelected(row);
    requestAnimationFrame(() => {
      const field = document.getElementById("wm-selected-value") as HTMLInputElement | null;
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
        setMessage("Saved written method data changed in another tab. Download its data before replacing it.");
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
        const incoming = parseWrittenMethodLink(location.href);
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
    <div className="app-shell booklet-editor pt-editor wm-editor">
      <main className="main-content" id={active ? "main-content" : undefined} tabIndex={-1}>
        <PageHeading title="Written methods" description="Set out column addition and subtraction, long multiplication and short or long division, with digits, carries and rows left blank or hidden for pupils.">
          <ResourceSaveStatus text={saveState} />
        </PageHeading>
        <section className="workspace">
          <Panel className="editor-card">
            <EditorToolbar
              examples={
                <ExampleGallery
                  examples={writtenMethodGallery}
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
              menuId="wm-downloads"
              menuOpen={menu}
              onMenuChange={setMenu}
            />
            <EditorDownloadMenu
              wordHelp
              id="wm-downloads"
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
                  action: () => navigator.clipboard.writeText(writtenMethodLink(e, location.href)),
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
                  data-testid="written-method-resource"
                  style={{ width: ((g.width * 96) / 25.4) * fitted.scale, height: ((g.height * 96) / 25.4) * fitted.scale }}
                >
                  <div className="pt-art" dangerouslySetInnerHTML={{ __html: previewArt(renderSvg(displayed), e, view === "answer") }} />
                  {g.hits.map((h) => {
                    const v = rowValue(d, h.row),
                      hiddenHere = view === "pupil" && v?.show === "hidden";
                    return (
                      <button
                        key={h.row}
                        type="button"
                        className={`pt-hit ${selected === h.row ? "pt-selected" : ""} ${hiddenHere ? "pt-hidden-answer" : ""}`}
                        aria-label={`Edit ${rowName(h.row)}`}
                        title={hiddenHere ? "Hidden answer (pupils fill this in)" : undefined}
                        disabled={blocked}
                        style={{ left: px(h.x, g.width), top: px(h.y, g.height), width: px(h.width, g.width), height: px(h.height, g.height) }}
                        onClick={() => choose(h.row)}
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
                <EditorHint tool="written-method">Click a row of digits to edit it and its small digits. Enter applies; Escape restores.</EditorHint>
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
          <aside className="inspector-stack" aria-label="Written method settings">
            <ReturnToDiagram />
            <section className="panel-card pt-panel" aria-label="Selected row">
              <h2>{selected && selectedValue ? `Selected: ${rowName(selected)}` : "Selected row"}</h2>
              {selected && selectedValue ? (
                <>
                  <div className="pt-fields">
                    <label>
                      Digits
                      <DraftField
                        key={selected}
                        id="wm-selected-value"
                        label="Selected row"
                        value={selectedValue.text}
                        maxLength={MAX_DIGITS + 2}
                        inputMode="decimal"
                        disabled={blocked}
                        onCommit={(v) => commit(() => setRow(e, selected, { text: v }))}
                      />
                    </label>
                  </div>
                  <label className="pt-hide" title="Hidden rows are saved answers; pupils see empty squares.">
                    <input
                      type="checkbox"
                      disabled={blocked || !selectedValue.text}
                      checked={selectedValue.show === "hidden"}
                      onChange={(ev) => commit(() => setRow(e, selected, { show: ev.target.checked ? "hidden" : "show" }))}
                    />
                    Hide for pupils (keep as an answer)
                  </label>
                  {!selectedValue.text && <p className="pt-note">This row is blank for pupils. Enter its digits first to hide them as an answer.</p>}
                  {selectedWork && (
                    <div className="pt-row">
                      <button type="button" disabled={blocked} onClick={() => commit(() => shiftRow(e, selected, 1), "move row left")}>
                        Move one column left
                      </button>
                      <button type="button" disabled={blocked} onClick={() => commit(() => shiftRow(e, selected, -1), "move row right")}>
                        Move one column right
                      </button>
                      <button
                        type="button"
                        disabled={blocked}
                        onClick={() => {
                          if (commit(() => removeRow(e, selected), "remove working row")) setSelected(null);
                        }}
                      >
                        Remove this row
                      </button>
                    </div>
                  )}
                  {d.method === "add" && d.numbers.length > 2 && d.numbers.some((n) => n.id === selected) && (
                    <div className="pt-row">
                      <button
                        type="button"
                        disabled={blocked}
                        onClick={() => {
                          if (commit(() => removeNumber(e, selected), "remove number")) setSelected(null);
                        }}
                      >
                        Remove this number
                      </button>
                    </div>
                  )}
                  {selected !== "remainder" && !(division && selected === "n2") && (
                    <fieldset className="wm-marks">
                      <legend>Small digits (carries and exchanges)</legend>
                      <div className="wm-mark-grid">
                        {columns(selected).map((p) => {
                          const m = marksOf(selected).find((x) => x.place === p);
                          return (
                            <label key={p} className="wm-mark">
                              <span>{placeName(p)}</span>
                              <DraftField
                                key={`${selected}-${p}-${m?.text ?? ""}`}
                                label={`Small digit in the ${placeName(p)} column`}
                                value={m?.text ?? ""}
                                maxLength={2}
                                inputMode="decimal"
                                disabled={blocked}
                                onCommit={(v) => commit(() => setMark(e, selected, p, v.trim() ? { text: v } : null), v.trim() ? "set small digit" : "remove small digit")}
                              />
                              {d.numbers.some((n) => n.id === selected) && (
                                <span className="wm-cross">
                                  <input
                                    type="checkbox"
                                    aria-label={`Cross out the ${placeName(p)} digit`}
                                    disabled={blocked || !m}
                                    checked={!!m?.cross}
                                    onChange={(ev) => commit(() => setMark(e, selected, p, { cross: ev.target.checked }), "cross out digit")}
                                  />
                                  cross out
                                </span>
                              )}
                            </label>
                          );
                        })}
                      </div>
                      <label className="pt-hide">
                        <input
                          type="checkbox"
                          disabled={blocked || marksOf(selected).length === 0}
                          checked={marksOf(selected).length > 0 && marksOf(selected).every((m) => m.show === "hidden")}
                          onChange={(ev) =>
                            patch((n) => {
                              for (const m of n.marks) if (m.row === selected) m.show = ev.target.checked ? "hidden" : "show";
                            })
                          }
                        />
                        Hide this row&apos;s small digits for pupils
                      </label>
                      <p className="pt-note">
                        {d.numbers.some((n) => n.id === selected)
                          ? "On a number, a small digit sits before its digit, as a carried remainder or an exchanged ten. Cross out marks an exchange: the digit is struck through and the small digit is its new value."
                          : "On a result row, small digits sit above it, as carries."}
                      </p>
                    </fieldset>
                  )}
                </>
              ) : (
                <p className="pt-note">Click a row of digits to choose it: a number, a working row or the answer.</p>
              )}
              <div className="pt-row">
                <button
                  type="button"
                  disabled={blocked || !hasHidden(e)}
                  onClick={() =>
                    patch((n) => {
                      for (const v of [...rowValues(n), ...n.marks]) v.show = "show";
                    })
                  }
                >
                  Show all
                </button>
              </div>
            </section>
            <section className="panel-card pt-panel">
              <h2>Method</h2>
              <div className="pt-fields">
                <label>
                  Method
                  <select
                    aria-label="Method"
                    value={d.method}
                    disabled={blocked}
                    onChange={(ev) => {
                      if (commit(() => setMethod(e, ev.target.value as Method), "change method")) setSelected(null);
                    }}
                  >
                    {METHODS.map((m) => (
                      <option key={m} value={m}>
                        {METHOD_NAMES[m]}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <p className="pt-note">Changing the method keeps the numbers and clears the working, answer and small digits. It can be undone.</p>
              <div className="pt-row">
                {d.method === "add" && (
                  <button type="button" disabled={blocked || d.numbers.length >= 4} onClick={() => commit(() => addNumber(e), "add number")}>
                    Add a number
                  </button>
                )}
                {(d.method === "multiply" || d.method === "long-division") && (
                  <button type="button" disabled={blocked || d.working.length >= MAX_ROWS} onClick={() => commit(() => addRow(e), "add working row")}>
                    Add a working row
                  </button>
                )}
              </div>
              {division && (
                <label className="pt-hide">
                  <input type="checkbox" disabled={blocked} checked={!!d.remainder} onChange={(ev) => commit(() => setRemainder(e, ev.target.checked), "change remainder")} />
                  Space for a remainder (r …) after the answer
                </label>
              )}
            </section>
            <section className="panel-card pt-panel">
              <h2>Work the method out</h2>
              <p className="pt-note">
                Work out fills the answer, the working rows and the small digits from the numbers. What you entered is kept. Nothing
                happens until you press the button, and it can be undone.
              </p>
              {division && (
                <label className="pt-hide">
                  <input type="checkbox" disabled={blocked} checked={decimals} onChange={(ev) => setDecimals(ev.target.checked)} />
                  Keep dividing past the point with zeros, instead of a remainder
                </label>
              )}
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
                      const r = complete(e, hideFilled, division && decimals);
                      if (r.filled) commit(r.envelope, "work out method");
                      else setMessage("There is nothing to work out. Enter the numbers first; filled rows are kept as they are.");
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
                  Squares
                  <select aria-label="Square size" value={d.cellMm} disabled={blocked} onChange={(ev) => patch((n) => void (n.cellMm = Number(ev.target.value)))}>
                    {[5, 6, 7, 8, 9, 10].map((v) => (
                      <option key={v} value={v}>
                        {v} mm
                      </option>
                    ))}
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
              <label className="pt-hide" title="For a spot-the-mistake task: rows that do not follow raise no teacher note.">
                <input type="checkbox" disabled={blocked} checked={d.intentionalError} onChange={(ev) => patch((n) => void (n.intentionalError = ev.target.checked))} />
                This method has a deliberate error
              </label>
              <details>
                <summary>Editing and printing help</summary>
                <p className="pt-note">
                  Click a row to edit its digits and small digits. Enter applies; Escape restores. Digits line up by place value, and
                  decimals line up on the point. An answer that does not follow adds a teacher note; it is never corrected for you.
                </p>
                <p className="pt-note">
                  Copy for Word carries the physical size shown under the method; preview zoom never changes it. Download PNG (600 ppi) if
                  your browser blocks copying.
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
                downloadBlob(new Blob([recovery], { type: "application/json" }), downloadName("written-method", "json", { recovery: true }));
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
