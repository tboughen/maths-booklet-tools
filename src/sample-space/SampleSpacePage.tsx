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
import { sampleSpaceGallery } from "../examples/galleryCatalogue";
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
  addColumn,
  addRow,
  canonical,
  cellAt,
  create,
  fillCells,
  FONT,
  forView,
  layout,
  MAX_CELL,
  MAX_HEADING,
  MAX_OUTCOMES,
  MAX_TITLE,
  OPERATIONS,
  parseFile,
  removeColumn,
  removeRow,
  renderSvg,
  setCell,
  setHeading,
  validate,
  warnings,
  type Envelope,
  type Operation,
} from "../../packages/sample-space-core/src";
import { LINK_PREFIX, parseSampleSpaceLink, sampleSpaceLink } from "./links";
import { copyWord, downloadEditable, downloadImage, printPng, downloadBoth } from "./export";
import { handleUndoKeys, useDocumentHistory, redoLabel as redoStepName, undoLabel as undoStepName, stepName } from "../editor-kit";
import "../site/settings-kit.css";
import { FoldCard } from "../site/CardHelp";
import { useMoreBelow } from "../site/useMoreBelow";
import { OptionsBox } from "../site/OptionsBox";
import { VisibilitySwitch } from "../site/VisibilitySwitch";
import { LabelHit, PupilSpaceHint, QuickTip } from "../site/LabelTargets";
import { useCoarsePointer, useQuickTip, useTargetReach } from "../site/labelTargetHooks";
import { commonVisibility, visibilityStep, type Visibility } from "../editor-kit/visibility";
import { Eye, Ruler, Wand2 } from "lucide-react";

const STORAGE = copyStorageKey("maths-booklet-tools:sample-space:v1");
type Doc = Envelope["document"];
/** A cell address: a row ID and a column ID. */
type Address = { row: string; column: string };
const OPERATION_NAMES: Record<Operation, string> = { sum: "Sums", product: "Products", difference: "Differences", pair: "Pairs, such as (H, 3)" };

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
        return { e: fresh(), recovery: raw, message: "Saved diagram data needs recovery. Download the original before starting afresh." };
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
  onHistory,
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
  /** With nothing typed, Ctrl+Z / Ctrl+Y go to the diagram's undo; return true when handled. */
  onHistory?: (event: ReactKeyboardEvent<HTMLInputElement>) => boolean;
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
        if (draft === value && !invalid && onHistory?.(ev)) return;
        if (ev.key === "Enter") {
          ev.preventDefault();
          commit();
        }
        // Escape undoes typing; with nothing typed it passes on, so it closes the options box.
        if (ev.key === "Escape" && (draft !== value || invalid)) {
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

export default function SampleSpacePage({ active = true }: { active?: boolean }) {
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
    [boxAnchor, setBoxAnchor] = useState<HTMLElement | null>(null),
    [hideFilled, setHideFilled] = useState(true),
    [operation, setOperation] = useState<Operation>("sum"),
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
  const columnIds = d.columns.map((c) => c.id);
  const rowIds = d.rows.map((r) => r.id);
  const selectedCell = selected && rowIds.includes(selected.row) && columnIds.includes(selected.column) ? cellAt(d, selected.row, selected.column) : null;
  const stackRef = useMoreBelow<HTMLElement>();
  const quick = useQuickTip(),
    tip = quick.tip;
  const coarse = useCoarsePointer();
  const cellBoxes = rowIds.flatMap((_, i) => columnIds.map((__, j) => ({ x: g.x[j + 1], y: g.y[i + 1], width: g.x[j + 2] - g.x[j + 1], height: g.y[i + 2] - g.y[i + 1] })));
  const reach = useTargetReach(cellBoxes, (96 / 25.4) * fitted.scale, coarse);
  const spaceCount = d.rows.reduce((n, r) => n + r.cells.filter((c) => c.show === "hidden").length, 0);

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
  const rowName = (id: string) => d.rows.find((r) => r.id === id)?.heading || `row ${d.rows.findIndex((r) => r.id === id) + 1}`;
  const columnName = (id: string) => d.columns.find((c) => c.id === id)?.heading || `column ${d.columns.findIndex((c) => c.id === id) + 1}`;
  const cellId = (a: Address) => `ss-cell-${a.row}-${a.column}`;
  function choose(a: Address, anchor: HTMLElement) {
    setSelected(a);
    setBoxAnchor(anchor);
  }
  /** What pupils see of one cell: one undo step. A blank cell is already a space for pupils. */
  function setVisibility(a: Address, v: Visibility) {
    const c = cellAt(d, a.row, a.column);
    if (blocked || c.show === v) return;
    if (v === "hidden" && !c.text) return setMessage("This cell is a blank with no answer: pupils already see a space. Type the answer first.");
    commit(() => setCell(e, a.row, a.column, { show: v }), visibilityStep(v, c.text || "blank cell"));
  }
  /** Every cell at once: one undo step. Blank cells stay blank spaces. */
  function setAll(v: Visibility) {
    patch((n) => {
      for (const r of n.rows) for (const c of r.cells) c.show = v === "hidden" && !c.text ? "show" : v;
    });
  }
  function clearSpaces() {
    patch((n) => {
      for (const r of n.rows) for (const c of r.cells) if (c.show === "hidden") c.show = "show";
    });
  }
  // The box closes when its cell goes (a smaller table, a new diagram, or Reset).
  const selectedDrawn = !!selectedCell;
  useEffect(() => {
    if (boxAnchor && (!selectedDrawn || !boxAnchor.isConnected)) setBoxAnchor(null);
  }, [boxAnchor, selectedDrawn]);

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
        setMessage("Saved diagram data changed in another tab. Download its data before replacing it.");
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
        const incoming = parseSampleSpaceLink(location.href);
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
    <div className="app-shell booklet-editor pt-editor ss-editor">
      <main className="main-content" id={active ? "main-content" : undefined} tabIndex={-1}>
        <PageHeading title="Sample space diagrams" description="Draw sample space diagrams for two dice, spinners and coins, with outcomes left blank, hidden or circled.">
          <ResourceSaveStatus text={saveState} />
        </PageHeading>
        <section className="workspace">
          <Panel className="editor-card">
            <EditorToolbar
              examples={
                <ExampleGallery
                  examples={sampleSpaceGallery}
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
              menuId="ss-downloads"
              menuOpen={menu}
              onMenuChange={setMenu}
            />
            <EditorDownloadMenu
              wordHelp
              id="ss-downloads"
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
                  action: () => navigator.clipboard.writeText(sampleSpaceLink(e, location.href)),
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
                  data-testid="sample-space-resource"
                  style={{ width: ((g.width * 96) / 25.4) * fitted.scale, height: ((g.height * 96) / 25.4) * fitted.scale }}
                >
                  <div className="pt-art" dangerouslySetInnerHTML={{ __html: previewArt(renderSvg(displayed), e, view === "answer") }} />
                  {rowIds.map((row, i) =>
                    columnIds.map((column, j) => {
                      const c = cellAt(d, row, column),
                        key = `${row}:${column}`;
                      return (
                        <LabelHit
                          key={key}
                          what={`the cell for ${rowName(row)}, ${columnName(column)}`}
                          state={c.show}
                          text={c.text}
                          selected={selected?.row === row && selected.column === column}
                          boxOpen={boxAnchor !== null}
                          pupilView={view === "pupil"}
                          tipId="ss-quick-tip"
                          tipShown={tip?.key === key}
                          tipHandlers={quick.bind(key, c.show)}
                          disabled={blocked}
                          coarse={coarse}
                          reach={reach[i * columnIds.length + j]}
                          ghostFontPx={((FONT * 96) / 25.4) * fitted.scale}
                          style={{ left: px(g.x[j + 1], g.width), top: px(g.y[i + 1], g.height), width: px(g.x[j + 2] - g.x[j + 1], g.width), height: px(g.y[i + 2] - g.y[i + 1], g.height) }}
                          onOpen={(anchor) => choose({ row, column }, anchor)}
                          onVisibility={(v) => setVisibility({ row, column }, v)}
                        />
                      );
                    }),
                  )}
                  <QuickTip id="ss-quick-tip" tip={tip && !(boxAnchor && selected && `${selected.row}:${selected.column}` === tip.key) ? tip : null} />
                </div>
                {boxAnchor && selected && selectedCell && (
                  <OptionsBox
                    anchor={boxAnchor}
                    anchorKey={`${selected.row}:${selected.column}`}
                    focusField={!coarse}
                    title={`The cell for ${rowName(selected.row)}, ${columnName(selected.column)}`}
                    onClose={() => setBoxAnchor(null)}
                  >
                    <VisibilitySwitch name="What pupils see" caption="What pupils see" value={selectedCell.show} disabled={blocked} onChange={(v) => setVisibility(selected, v)} />
                    <div className="pt-fields">
                      <label>
                        Cell
                        <DraftField
                          key={`${selected.row}-${selected.column}`}
                          onHistory={(ev) => handleUndoKeys(ev.nativeEvent, { undo, redo }, { inField: true })}
                          label={`Text of the cell for ${rowName(selected.row)}, ${columnName(selected.column)}`}
                          value={selectedCell.text}
                          maxLength={MAX_CELL}
                          disabled={blocked}
                          onCommit={(v) => commit(() => setCell(e, selected.row, selected.column, { text: v }))}
                        />
                      </label>
                    </div>
                    <label className="pt-hide" title="A circled outcome, such as one that answers the question.">
                      <input
                        type="checkbox"
                        disabled={blocked || !selectedCell.text}
                        checked={!!selectedCell.ring}
                        onChange={(ev) => commit(() => setCell(e, selected.row, selected.column, { ring: ev.target.checked }))}
                      />
                      Circle this outcome
                    </label>
                    {selectedCell.ring ? (
                      <label className="pt-hide" title="Pupils circle this outcome themselves; the circle prints on the answers copy.">
                        <input
                          type="checkbox"
                          disabled={blocked}
                          checked={selectedCell.ring === "hidden"}
                          onChange={(ev) => commit(() => setCell(e, selected.row, selected.column, { ring: ev.target.checked ? "hidden" : true }))}
                        />
                        Circle only on the answers copy
                      </label>
                    ) : null}
                    {!selectedCell.text && <p className="pt-note">This cell is a blank with no answer: pupils already see a space. Type the outcome to circle it.</p>}
                  </OptionsBox>
                )}
              </div>
            </div>
            <EditorFoot
              zoom={zoom}
              onZoom={setZoom}
              scale={fitted.scale}
              size={<ResourceSize width={g.width / 10} height={g.height / 10} />}
              status={shownMessage}
              hint={
                <EditorHint tool="sample-space">Click a cell to type a new value. Double-click it for a pupil space.</EditorHint>
              }
            >
            </EditorFoot>
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
            <div className="pt-fields ss-titles">
              <label>
                Event down the side
                <DraftField label="Event down the side" value={d.rowTitle} maxLength={MAX_TITLE} disabled={blocked} onCommit={(v) => commit(() => setHeading(e, "rowTitle", v))} />
              </label>
              <label>
                Event across the top
                <DraftField label="Event across the top" value={d.columnTitle} maxLength={MAX_TITLE} disabled={blocked} onCommit={(v) => commit(() => setHeading(e, "columnTitle", v))} />
              </label>
            </div>
            <div className="ss-grid-wrap">
              <table className="ss-grid" aria-label="Diagram entries">
                <thead>
                  <tr>
                    <th scope="col">
                      <DraftField label="Corner sign" value={d.corner} maxLength={4} disabled={blocked} onCommit={(v) => commit(() => setHeading(e, "corner", v))} />
                    </th>
                    {d.columns.map((c, j) => (
                      <th key={c.id} scope="col">
                        <DraftField
                          label={`Outcome for column ${j + 1}`}
                          value={c.heading}
                          maxLength={MAX_HEADING}
                          disabled={blocked}
                          onCommit={(v) => commit(() => setHeading(e, c.id, v))}
                        />
                        <button
                          type="button"
                          className="ss-remove"
                          aria-label={`Remove column ${c.heading || j + 1}`}
                          title="Remove column"
                          disabled={blocked || d.columns.length <= 1}
                          onClick={() => commit(() => removeColumn(e, c.id))}
                        >
                          ×
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {d.rows.map((r, i) => (
                    <tr key={r.id}>
                      <th scope="row">
                        <DraftField
                          label={`Outcome for row ${i + 1}`}
                          value={r.heading}
                          maxLength={MAX_HEADING}
                          disabled={blocked}
                          onCommit={(v) => commit(() => setHeading(e, r.id, v))}
                        />
                        <button
                          type="button"
                          className="ss-remove"
                          aria-label={`Remove row ${r.heading || i + 1}`}
                          title="Remove row"
                          disabled={blocked || d.rows.length <= 1}
                          onClick={() => commit(() => removeRow(e, r.id))}
                        >
                          ×
                        </button>
                      </th>
                      {d.columns.map((col, j) => {
                        const c = r.cells[j],
                          here = selected?.row === r.id && selected.column === col.id;
                        return (
                          <td key={col.id} className={`${c.show === "hidden" ? "ss-hidden" : ""} ${c.show === "omit" ? "ss-omit" : ""} ${c.ring ? "ss-ring" : ""} ${here ? "ss-current" : ""}`}>
                            <DraftField
                              id={cellId({ row: r.id, column: col.id })}
                              label={`Cell for ${rowName(r.id)}, ${columnName(col.id)}`}
                              value={c.text}
                              maxLength={MAX_CELL}
                              disabled={blocked}
                              onFocus={() => setSelected({ row: r.id, column: col.id })}
                              onCommit={(v) => commit(() => setCell(e, r.id, col.id, { text: v }))}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="pt-row">
              <button type="button" disabled={blocked || d.rows.length >= MAX_OUTCOMES} onClick={() => commit(() => addRow(e))}>
                Add row
              </button>
              <button type="button" disabled={blocked || d.columns.length >= MAX_OUTCOMES} onClick={() => commit(() => addColumn(e))}>
                Add column
              </button>
            </div>
          </Panel>
          <aside ref={stackRef} className="inspector-stack md-kit md-kit--one" aria-label="Sample space settings">
            <ReturnToDiagram />
            {/* One column (the usability pilot, rolled out 22 Nov 2026): the main card open, the rarer groups folded. */}
            <FoldCard
              tool="sample-space"
              title="What pupils see"
              icon={Eye}
              defaultOpen
              summary={spaceCount === 0 ? "Every cell shows" : `${spaceCount} pupil space${spaceCount === 1 ? "" : "s"}`}
              help={
                <>
                  <p className="pt-note">Pupil space: an empty cell for pupils to fill in; the answers copy shows the outcome. Leave out: nothing prints, in either copy.</p>
                  <p className="pt-note">An empty cell is a blank with no answer, and is always a space. Cells take short text such as 7, 1/36, H3 or (H, 3); fractions print stacked.</p>
                </>
              }
            >
              {(() => {
                const cells = commonVisibility(d.rows.flatMap((r) => r.cells.map((c) => c.show)));
                return cells && <VisibilitySwitch name="Cells" caption="Cells" value={cells} disabled={blocked} onChange={setAll} />;
              })()}
              <PupilSpaceHint count={spaceCount} disabled={blocked} onClear={clearSpaces}>
                Double-click a cell on the diagram for a pupil space.
              </PupilSpaceHint>
            </FoldCard>
            <FoldCard
              tool="sample-space"
              title="Fill the cells"
              icon={Wand2}
              summary={`${OPERATION_NAMES[operation].replace(/, such as.*/, "")}${hideFilled ? ", as pupil spaces" : ""}`}
              help={
                <p className="pt-note">
                  Fill puts the sum, product, difference or pair of each row and column outcome in every empty cell, exactly: fractions stay
                  fractions. Cells that already hold something are kept. Nothing is filled until you press the button, and it can be undone.
                </p>
              }
            >
              <div className="pt-fields">
                <label>
                  Fill with
                  <select aria-label="Fill with" value={operation} disabled={blocked} onChange={(ev) => setOperation(ev.target.value as Operation)}>
                    {OPERATIONS.map((o) => (
                      <option key={o} value={o}>
                        {OPERATION_NAMES[o]}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="pt-hide">
                <input type="checkbox" disabled={blocked} checked={hideFilled} onChange={(ev) => setHideFilled(ev.target.checked)} />
                Make the cells it fills pupil spaces
              </label>
              <div className="pt-row">
                <button
                  type="button"
                  disabled={blocked}
                  onClick={() => {
                    try {
                      const r = fillCells(e, operation, hideFilled);
                      if (r.filled) commit(r.envelope, "fill cells");
                      else setMessage("Every cell already holds something. Clear the cells to fill first.");
                    } catch (err) {
                      setMessage(err instanceof Error ? err.message : String(err));
                    }
                  }}
                >
                  Fill empty cells
                </button>
              </div>
            </FoldCard>
            <FoldCard
              tool="sample-space"
              title="Layout"
              icon={Ruler}
              summary={`${d.cellMm} mm columns${d.lines === "bold" ? " · bold lines" : ""}`}
              help={
                <>
                  <p className="pt-note">
                    Up to {MAX_OUTCOMES} outcomes each way. A corner sign of +, × or − checks every number you type against the outcomes and
                    adds a teacher note when one disagrees. Nothing is calculated or filled in for you.
                  </p>
                  <p className="pt-note">
                    Copy for Word carries the physical size shown above the diagram; preview zoom never changes it. Download PNG (600 ppi)
                    if your browser blocks copying.
                  </p>
                </>
              }
            >
              <div className="pt-fields">
                <label>
                  Column width (mm)
                  <select aria-label="Column width" value={d.cellMm} disabled={blocked} onChange={(ev) => patch((n) => void (n.cellMm = Number(ev.target.value)))}>
                    {[...new Set([10, 12, 14, 16, 18, 20, 22, 24, 27, 30, d.cellMm])].sort((a, b) => a - b).map((x) => (
                      <option key={x} value={x}>
                        {x}
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
              <label className="pt-hide" title="For a spot-the-mistake task: cells that disagree with the corner sign raise no teacher note.">
                <input type="checkbox" disabled={blocked} checked={d.intentionalError} onChange={(ev) => patch((n) => void (n.intentionalError = ev.target.checked))} />
                This diagram has a deliberate error
              </label>
            </FoldCard>
          </aside>
        </section>
        {recovery !== null && (
          <section className="panel-card pt-recovery" role="alert">
            <h2>Protect saved data</h2>
            <p>{message}</p>
            <button
              onClick={() => {
                downloadBlob(new Blob([recovery], { type: "application/json" }), downloadName("sample-space", "json", { recovery: true }));
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
              setBoxAnchor(null);
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
