import { useTitleNote } from "../site/TitleNote";
import { useWorkedNotes } from "../site/WorkedNotes";
import { WORKED_STEP, withWorkedNotes } from "../site/workedNotesData";
import { answerSize, previewArt } from "../export/worked";
import { workedOf } from "../../packages/envelope-core/src/worked";
import { TITLE_NOTE_STEP, withAbout } from "../site/titleNoteData";
import { aboutOf } from "../../packages/envelope-core/src/about";
import { useResourceViewport, fitResource } from "../site/useResourceFit";
import { ExampleGallery, ReturnToDiagram } from "../examples/ExampleGallery";
import { algebraGallery } from "../examples/galleryCatalogue";
import { copyStorageKey } from "../site/copyDocument";
import { EditorFoot } from "../site/EditorFoot";
import { EditorHint } from "../site/EditorHint";
import { useEffect, useRef, useState } from "react";
import {
  answerBelow,
  canonical,
  collectAnswer,
  create,
  display,
  example,
  exportIssue,
  fillProducts,
  layout,
  MAX_TERMS,
  parseFile,
  renderSvg,
  resize,
  setCell,
  setSize,
  validate,
  warnings,
  workedCopy,
  type Envelope,
} from "../../packages/algebra-grid-core/src";
import { EditorToolbar } from "../site/EditorToolbar";
import { EditorDownloadMenu, type MenuKind } from "../site/EditorDownloadMenu";
import { diagramFileMenu } from "../site/fileMenu";
import { PageHeading, Panel } from "../site/PageHeading";
import { ResourceSize } from "../site/ResourceSize";
import { AnswerPreviewToggle } from "../site/AnswerPreviewToggle";
import { ResourceSaveStatus } from "../site/ResourceSaveStatus";
import { RatioDialog } from "../ratio-table/RatioDialog";
import { copyPngToClipboard, downloadBlob } from "../export/clipboard";
import { copyWord, downloadEditable, downloadImage, printPng } from "./export";
import { editorLink, parseLink } from "./links";
import { CellEditor } from "./CellEditor";
import { OptionsBox } from "../site/OptionsBox";
import { FoldCard } from "../site/CardHelp";
import { useMoreBelow } from "../site/useMoreBelow";
import { useCoarsePointer } from "../site/labelTargetHooks";
import { VisibilitySwitch } from "../site/VisibilitySwitch";
import { PupilSpaceHint } from "../site/LabelTargets";
import { LiveText } from "../site/LiveText";
import { TARGET_TIP, TARGET_TIP_SPACE, commonVisibility, togglePupilSpace, visibilityStep, type Visibility } from "../editor-kit/visibility";
import { Eye, Grid3X3, Ruler } from "lucide-react";
import "./algebra-grid.css";
import "../site/settings-kit.css";
import { createHistory, handleUndoKeys, pushHistory, useDocumentHistory, redoLabel as redoStepName, undoLabel as undoStepName, stepName } from "../editor-kit";
import { downloadName } from "../export/filenames";

const STORAGE = copyStorageKey("maths-booklet-tools:algebra-grid:v1");
const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));
function initial() {
  let key = STORAGE,
    raw: string | null = null;
  try {
    const id = new URL(location.href).searchParams.get("algebraCopy");
    if (id && /^[a-f0-9-]{36}$/.test(id)) key += ":copy:" + id;
    raw = localStorage.getItem(key);
    if (raw) {
      const old = parseFile(raw),
        source = JSON.parse(raw).document;
      const upgraded =
        !Object.hasOwn(source, "compactHeadings") ||
        !Object.hasOwn(source, "gridLineMm");
      const next = structuredClone(old);
      if (!Object.hasOwn(source, "compactHeadings"))
        next.document.compactHeadings = true;
      if (!Object.hasOwn(source, "gridLineMm")) next.document.gridLineMm = 0.5;
      return {
        key,
        raw,
        e: next,
        previous: upgraded ? old : null,
        recovery: null as string | null,
        message: upgraded
          ? "Updated this draft to compact headings and clearer grid lines. Undo restores its previous layout."
          : "",
      };
    }
    return {
      key,
      raw,
      e: example(),
      previous: null as Envelope | null,
      recovery: null as string | null,
      message: "",
    };
  } catch {
    return {
      key,
      raw,
      e: example(),
      previous: null as Envelope | null,
      recovery: raw,
      message: raw
        ? "Saved grid data needs recovery. Its original data is protected."
        : "Device storage is unavailable. Save an editable file to keep your work.",
    };
  }
}
/** What pupils see of a cell: an empty cell is a pupil space with no saved answer. */
type Cell = Envelope["document"]["rows"][number]["cells"][number];
const cellSees = (cell: Cell): Visibility => (cell.omit ? "omit" : cell.hidden || cell.value === null ? "hidden" : "show");
type Replacement = { e: Envelope; title: string; explanation: string };
export default function AlgebraGridPage({
  active = true,
}: {
  active?: boolean;
}) {
  const [startup] = useState(initial),
    documentHistory = useDocumentHistory<Envelope>(startup.e, {
      equals: (a, b) => canonical(a) === canonical(b),
      from: startup.previous
        ? pushHistory(createHistory(startup.previous), startup.e, {
            label: "open link",
          })
        : undefined,
    }),
    history = documentHistory.history;
  const e = history.present,
    d = e.document,
    g = layout(e);
  const [recovery, setRecovery] = useState(startup.recovery),
    [conflict, setConflict] = useState(false),
    [saveState, setSaveState] = useState("Saved on this device"),
    [message, setMessage] = useState(startup.message);
  const [cellBox, setCellBox] = useState<{ r: number; c: number } | null>(null),
    [boxAnchor, setBoxAnchor] = useState<HTMLElement | null>(null),
    [boxError, setBoxError] = useState("");
  // A typed entry the box refused keeps it open until it is fixed or Escape puts the saved value back. A ref, because
  // a press elsewhere commits (on blur) and asks the box to close in the same moment.
  const refused = useRef(false);
  const stackRef = useMoreBelow<HTMLElement>(),
    coarse = useCoarsePointer();
  const [field, setField] = useState<{ key: string; value: string } | null>(null),
    [questionEditor, setQuestionEditor] = useState(false),
    [inputError, setInputError] = useState(""),
    [pending, setPending] = useState<Replacement | null>(null),
    [menu, setMenu] = useState<MenuKind | false>(false),
    [busy, setBusy] = useState(false),
    [showAnswers, setShowAnswers] = useState(false),
    [zoom, setZoom] = useState("fit");
  const file = useRef<HTMLInputElement>(null),
    scroll = useRef<HTMLDivElement>(null),
    expected = useRef(startup.raw),
    linkSeen = useRef(""),
    blockedRef = useRef(false),
    fieldRef = useRef(field),
    documentRef = useRef(e),
    activeRef = useRef(active);
  fieldRef.current = field;
  documentRef.current = e;
  activeRef.current = active;
  const available = useResourceViewport(scroll);
  const pendingInput = !!field || !!boxError,
    blocked =
      pendingInput || recovery !== null || conflict || busy || !!pending;
  blockedRef.current = blocked;
  // What pupils see: the cells with a value, headings apart from products, and the pupil spaces among them.
  const withValue = d.rows.flatMap((row, r) => row.cells.flatMap((cell, c) => ((r || c) && cell.value !== null ? [{ r, c }] : []))),
    headingCells = withValue.filter(({ r, c }) => !r || !c),
    productCells = withValue.filter(({ r, c }) => r && c),
    spaceCells = withValue.filter(({ r, c }) => d.rows[r].cells[c].hidden),
    spaceSummary = spaceCells.length === 0 ? "No pupil spaces" : `${spaceCells.length} pupil ${spaceCells.length === 1 ? "space" : "spaces"}`;
  const issue = exportIssue(e),
    notes = warnings(e),
    scale =
      zoom === "fit"
        ? fitResource(
            (g.width * 96) / 25.4,
            (g.height * 96) / 25.4,
            available.width,
            available.height,
            150,
            140,
          )
        : Number(zoom),
    px = (scale * 96) / 25.4;
  function commit(next: Envelope, force = false, label?: string) {
    if (!force && (recovery !== null || conflict)) return;
    const n = validate(next);
    documentHistory.commit(n, label);
  }
  function change(fn: (n: Envelope) => void) {
    if (blocked) return;
    const n = structuredClone(e);
    fn(n);
    commit(n);
  }
  function undo() {
    if (blockedRef.current) return;
    documentHistory.undo();
  }
  function redo() {
    if (blockedRef.current) return;
    documentHistory.redo();
  }
  function replace(
    next: Envelope,
    title: string,
    explanation = "This replaces the current grid. You can undo the replacement.",
  ) {
    if (blockedRef.current) return;
    setPending({ e: next, title, explanation });
  }
  useEffect(() => {
    if (recovery !== null || conflict) return;
    try {
      const now = localStorage.getItem(startup.key);
      if (now !== expected.current) {
        setConflict(true);
        setSaveState("Newer work on this device is protected");
        return;
      }
      const text = canonical(e);
      if (text !== now) localStorage.setItem(startup.key, text);
      expected.current = text;
      setSaveState("Saved on this device");
    } catch {
      setSaveState("Not saved on device");
    }
  }, [e, recovery, conflict, startup.key]);
  useEffect(() => {
    if (!active) return;
    const keys = (event: KeyboardEvent) => {
      if (
        (event.target as HTMLElement).closest(
          "input,textarea,select,[contenteditable=true]",
        )
      )
        return;
      if (handleUndoKeys(event, { undo, redo })) return;
    };
    window.addEventListener("keydown", keys);
    return () => window.removeEventListener("keydown", keys);
  });
  useEffect(() => {
    if (!active) return;
    const read = () => {
      if (
        !location.hash.startsWith("#algebra-grid=") ||
        location.href === linkSeen.current
      )
        return;
      if (blockedRef.current) return;
      linkSeen.current = location.href;
      try {
        const linked = parseLink(location.href);
        window.history.replaceState(
          {},
          "",
          location.pathname + location.search,
        );
        window.dispatchEvent(new Event("maths-tools:route"));
        setPending({
          e: linked,
          title: "Open linked grid?",
          explanation:
            "Editable resources may include hidden answers. Opening is undoable; Cancel keeps your current work.",
        });
      } catch (err) {
        setMessage(errorText(err));
      }
    };
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, [active, blocked]);
  /** The live options box beside a cell: each change is one undo step, with no Apply. */
  function openCell(r: number, c: number, from?: HTMLElement) {
    if (blocked || refused.current) return;
    setCellBox({ r, c });
    setBoxAnchor(from ?? document.querySelector<HTMLElement>(`.ag-editor [data-ag-cell="${r}-${c}"]`));
    setBoxError("");
  }
  function closeBox() {
    refused.current = false;
    setCellBox(null);
    setBoxAnchor(null);
    setBoxError("");
  }
  const cellName = (r: number, c: number) => `row ${r + 1}, column ${c + 1}`;
  function editCell(r: number, c: number, text: string) {
    const cell = d.rows[r].cells[c];
    try {
      commit(setCell(e, r, c, text.trim() || null, cell.hidden, !!cell.omit), false, `edit ${cellName(r, c)}`);
      setBoxError("");
      refused.current = false;
      return true;
    } catch (err) {
      setBoxError(errorText(err));
      refused.current = true;
      return false;
    }
  }
  /** Cells set to Show, a pupil space or Leave out, in one undo step. An empty cell is a pupil space already. */
  function setSees(at: readonly { r: number; c: number }[], v: Visibility, what: string) {
    if (blocked && !boxError) return;
    const withValue = at.filter(({ r, c }) => d.rows[r].cells[c].value !== null);
    if (!withValue.length) {
      setMessage("Type a value first: an empty cell is a pupil space already.");
      return;
    }
    let n = e;
    try {
      for (const { r, c } of withValue) n = setCell(n, r, c, d.rows[r].cells[c].value, v === "hidden", v === "omit");
      commit(n, false, visibilityStep(v, what));
    } catch (err) {
      setMessage(errorText(err));
    }
  }
  /** Double-click: a pupil space, and again back to the value. */
  function toggleCell(r: number, c: number) {
    if (blocked) return;
    const cell = d.rows[r].cells[c];
    if (cell.value === null) return;
    setSees([{ r, c }], togglePupilSpace(cellSees(cell)), cellName(r, c));
  }
  function startField(key: string, value: string) {
    if (
      busy ||
      pending ||
      recovery !== null ||
      conflict ||
      (field && field.key !== key)
    )
      return;
    setField({ key, value });
    setInputError("");
  }
  function applyField() {
    if (!field || recovery !== null || conflict) return;
    try {
      const n = structuredClone(e),
        value = field.value;
      if (field.key === "expression") {
        n.document.expression = value;
        n.document.sourceId = null;
      } else if (field.key === "size") {
        if (!value.trim()) throw Error("Enter a cell size from 12 to 18 mm.");
        commit(setSize(n, Number(value)));
        setField(null);
        return;
      } else {
        if (!value.trim())
          throw Error("Enter a column width from 12 to 45 mm.");
        const column = n.document.columns[Number(field.key.slice(7))];
        column.widthMm = Number(value);
        column.fixed = true;
      }
      commit(n);
      cancelField();
    } catch (err) {
      setInputError(errorText(err));
    }
  }
  async function action(
    fn: () => void | Promise<void>,
    text: string,
    artwork = false,
  ) {
    if (blockedRef.current || (artwork && issue)) return;
    setBusy(true);
    try {
      await fn();
      if (activeRef.current) setMessage(text);
    } catch (err) {
      if (activeRef.current) setMessage(errorText(err));
    } finally {
      setBusy(false);
    }
  }
  function fill() {
    if (blocked) return;
    try {
      const next = fillProducts(e);
      if (
        d.rows
          .slice(1)
          .some((r) => r.cells.slice(1).some((c) => c.value !== null))
      )
        replace(
          next,
          "Replace the product cells?",
          "Fill products uses the saved headings and replaces all existing products. You can undo this action.",
        );
      else commit(next);
    } catch (err) {
      setMessage(errorText(err));
    }
  }
  function switchMode(mode: Envelope["document"]["mode"]) {
    if (blocked) return;
    const next = structuredClone(e);
    next.document.mode = mode;
    next.document.expression = "";
    next.document.sourceId = null;
    try {
      commit(next);
    } catch {
      // Algebra terms are not numbers (and the reverse), so the entries go.
      next.document.rows.forEach((row, r) =>
        row.cells.forEach((cell, c) => {
          if (r || c) Object.assign(cell, { value: null, hidden: false });
        }),
      );
      replace(
        next,
        mode === "multiply"
          ? "Switch to multiplying numbers?"
          : "Switch to algebra?",
        "The current entries do not fit this task, so the grid cells will be cleared. You can undo this.",
      );
    }
  }
  function collect() {
    if (blocked) return;
    try {
      const next = collectAnswer(e);
      if (d.answer) replace(next, "Replace the saved answer?");
      else commit(next);
    } catch (err) {
      setMessage(errorText(err));
    }
  }
  function toggleAnswer() {
    if (blocked) return;
    try {
      if (!d.answerVisible) commit(answerBelow(e));
      else
        change((n) => {
          n.document.answerVisible = false;
        });
    } catch (err) {
      setMessage(errorText(err));
    }
  }
  function openWorked() {
    if (blocked) return;
    try {
      commit(workedCopy(e), false, "use worked version");
      setMessage("Worked version applied. Undo restores your pupil resource.");
    } catch (err) {
      setMessage(errorText(err));
    }
  }
  function cancelField() {
    if (questionEditor) {
      requestAnimationFrame(() => {
        if (!activeRef.current) return;
        const target =
          document.querySelector<HTMLElement>(
            '.ag-editor [data-ag-cell="question"]',
          ) ??
          document.querySelector<HTMLElement>(
            '.ag-editor input[aria-label="Question expression"]',
          );
        target?.focus({ preventScroll: true });
      });
    }
    setField(null);
    setQuestionEditor(false);
    setInputError("");
  }
  function settingActions(key: string) {
    return field?.key === key ? (
      <div className="ag-setting-actions">
        {inputError && <p role="alert">{inputError}</p>}
        <div className="ag-actions">
          <button onClick={applyField}>Apply setting</button>
          <button
            onClick={() => {
              setField(null);
              setInputError("");
            }}
          >
            Cancel setting
          </button>
        </div>
      </div>
    ) : null;
  }
  function numeric(label: string, key: string, value: number) {
    return (
      <div>
        <label>
          {label}
          <input
            aria-label={label}
            inputMode="decimal"
            aria-invalid={field?.key === key && !!inputError}
            value={field?.key === key ? field.value : String(value)}
            disabled={blocked && field?.key !== key}
            onChange={(ev) => startField(key, ev.target.value)}
            onKeyDown={(ev) => {
              if (ev.key === "Enter") applyField();
              if (ev.key === "Escape") {
                setField(null);
                setInputError("");
              }
            }}
          />
        </label>
        {settingActions(key)}
      </div>
    );
  }
  const dimensionBlocked = blocked && field?.key !== "expression";
  const titleNote = useTitleNote({ active, about: aboutOf(e), disabled: blocked, onSave: (about) => commit(withAbout(e, about), false, TITLE_NOTE_STEP) });
  const worked = useWorkedNotes({ active, notes: workedOf(e), size: answerSize(renderSvg(e, true)), disabled: blocked, onSave: (notes) => commit(withWorkedNotes(e, notes), false, WORKED_STEP) });
  return (
    <div className="app-shell booklet-editor ag-editor">
      <main
        className="main-content"
        id={active ? "main-content" : undefined}
        tabIndex={-1}
      >
        <PageHeading
          title="Expanding and factorising"
          description="Make multiplication grids with space for pupils to write, try and improve."
        >
          <ResourceSaveStatus text={saveState} />
        </PageHeading>
        <section className="workspace">
          <Panel className="editor-card">
            <EditorToolbar
              examples={
                <ExampleGallery
                  examples={algebraGallery}
                  active={active}
                  disabled={blocked}
                  onUse={(resource, title) => replace(resource, `Open ${title}?`)}
                  onWorked={(resource) => commit(resource, false, "use worked version")}
                />
              }
              answers={
                <AnswerPreviewToggle
                  checked={showAnswers}
                  onChange={setShowAnswers}
                />
              }
              canUndo={history.past.length > 0 && !blocked}
              undoLabel={undoStepName(history)}
              resetStep={history.resetStep}
              active={active}
              redoLabel={redoStepName(history)}
              canRedo={history.future.length > 0 && !blocked}
              onUndo={undo}
              onRedo={redo}
              onReset={() => replace(example(), "Reset this grid?")}
              resetDisabled={blocked}
              exportDisabled={blocked || !!issue}
              menuDisabled={blocked}
              busy={busy}
              onCopy={() =>
                void action(
                  () => copyWord(e),
                  "Copied for Word at the stated physical size.",
                  true,
                )
              }
              onCopyClipboard={() =>
                void action(
                  async () => {
                    await copyPngToClipboard(() => printPng(e));
                  },
                  "Image copied to clipboard.",
                  true,
                )
              }
              menuOpen={menu}
              onMenuChange={setMenu}
              menuId="algebra-download-menu"
            />
            <EditorDownloadMenu
              wordHelp
              id="algebra-download-menu"
              open={menu}
              active={active}
              onClose={() => setMenu(false)}
              onMessage={setMessage}
              onBusyChange={setBusy}
              actions={diagramFileMenu({
                about: titleNote.item,
                worked: worked.item,
                svg: {
                  disabled: pendingInput || !!issue,
                  action: () => downloadImage(e, "svg"),
                  success: "SVG download started.",
                },
                png: {
                  disabled: pendingInput || !!issue,
                  action: () => downloadImage(e, "png"),
                  success: "PNG download started.",
                },
                pdf: {
                  disabled: pendingInput || !!issue,
                  action: () => downloadImage(e, "pdf"),
                  success: "PDF download started.",
                },
                save: {
                  disabled: pendingInput,
                  action: () => downloadEditable(e),
                  success: "Editable-file download started.",
                },
                open: {
                  disabled: pendingInput,
                  action: () => file.current?.click(),
                },
                link: {
                  disabled: pendingInput,
                  action: async () =>
                    navigator.clipboard.writeText(editorLink(e, location.href)),
                  success:
                    "Editable link copied, including any hidden answers.",
                },
              })}
            />
            {titleNote.dialog}
            {worked.dialog}
            <input
              type="file"
              hidden
              ref={file}
              accept=".json,application/json"
              aria-label="Open algebra grid file"
              onChange={async (ev) => {
                const selected = ev.target.files?.[0];
                ev.target.value = "";
                if (!selected || blockedRef.current) return;
                try {
                  if (selected.size > 64000)
                    throw Error("Use a file smaller than 64 KiB.");
                  replace(parseFile(await selected.text()), "Open this grid?");
                } catch (err) {
                  setMessage(errorText(err));
                }
              }}
            />
            <div
              className="ag-scroll editor-stage"
              ref={scroll}
              role="region"
              aria-label="Algebra grid workspace"
              tabIndex={0}
              onClick={(ev) => {
                if (ev.target === ev.currentTarget && !pendingInput)
                  setMessage("");
              }}
            >
              <div
                className="ag-placement-controls"
                style={{ width: g.width * px + 110 }}
                role="group"
                aria-label="Question placement"
              >
                <button
                  data-ag-cell="question-toggle"
                  disabled={blocked}
                  aria-pressed={d.questionVisible}
                  onClick={() => {
                    const visible = !d.questionVisible;
                    change((n) => {
                      n.document.questionVisible = visible;
                    });
                    if (visible && !d.expression) {
                      startField("expression", "");
                      setQuestionEditor(true);
                    }
                  }}
                >
                  {d.questionVisible
                    ? "Hide question above"
                    : "+ Question above"}
                </button>
              </div>
              <div className="ag-stage" style={{ width: g.width * px + 110 }}>
                <div
                  className="ag-resource"
                  data-testid="algebra-resource"
                  style={{ width: g.width * px, height: g.height * px }}
                >
                  <div
                    className="ag-art"
                    dangerouslySetInnerHTML={{
                      __html: previewArt(renderSvg(e, showAnswers), e, showAnswers),
                    }}
                  />
                  {g.question && (
                    <button
                      className="ag-cell"
                      data-ag-cell="question"
                      aria-label="Edit printed question"
                      title="Edit printed question"
                      disabled={blocked}
                      style={{
                        left: 0,
                        top: 0,
                        width: g.width * px,
                        height: g.gridY * px,
                      }}
                      onClick={() => {
                        if (blocked) return;
                        startField("expression", d.expression);
                        setQuestionEditor(true);
                      }}
                    />
                  )}
                  {d.gridVisible &&
                    g.cells.map((a) => (
                      <button
                        key={`${d.rows[a.r].id}:${d.columns[a.c].id}`}
                        className="ag-cell"
                        data-ag-cell={`${a.r}-${a.c}`}
                        data-options-anchor=""
                        aria-label={`Row ${a.r + 1}, column ${a.c + 1}: ${a.cell.omit ? "left out" : a.cell.hidden ? "pupil space" : a.cell.value ? display(a.cell.value) : "blank"}`}
                        title={a.cell.value === null ? "Click to type a value" : cellSees(a.cell) === "hidden" ? TARGET_TIP_SPACE : TARGET_TIP}
                        disabled={blocked}
                        style={{
                          left: a.x * px,
                          top: a.y * px,
                          width: a.w * px,
                          height: a.h * px,
                        }}
                        onClick={(ev) => openCell(a.r, a.c, ev.currentTarget)}
                        onDoubleClick={() => toggleCell(a.r, a.c)}
                      />
                    ))}
                </div>
                <div
                  className="ag-column-controls"
                  role="group"
                  aria-label="Grid columns"
                >
                  <button
                    disabled={blocked || d.columns.length >= MAX_TERMS + 1}
                    onClick={() => commit(resize(e, "column", true))}
                  >
                    + Column
                  </button>
                  <button
                    disabled={blocked || d.columns.length <= 2}
                    onClick={() => commit(resize(e, "column", false))}
                  >
                    − Column
                  </button>
                </div>
                <div
                  className="ag-row-controls"
                  role="group"
                  aria-label="Grid rows"
                >
                  <button
                    disabled={blocked || d.rows.length >= MAX_TERMS + 1}
                    onClick={() => commit(resize(e, "row", true))}
                  >
                    + Row
                  </button>
                  <button
                    disabled={blocked || d.rows.length <= 2}
                    onClick={() => commit(resize(e, "row", false))}
                  >
                    − Row
                  </button>
                </div>
              </div>
              <div
                className="ag-placement-controls ag-placement-below"
                style={{ width: g.width * px + 110 }}
                role="group"
                aria-label="Answer placement"
              >
                <button
                  disabled={blocked}
                  aria-pressed={d.answerVisible}
                  onClick={toggleAnswer}
                >
                  {d.answerVisible ? "Hide answer below" : "+ Answer below"}
                </button>
              </div>
            </div>
            <EditorFoot
              zoom={zoom === "fit" ? 0 : Number(zoom)}
              onZoom={(value) => setZoom(value ? String(value) : "fit")}
              scale={scale}
              size={<ResourceSize width={g.width / 10} height={g.height / 10} />}
              status={message}
              hint={
                <EditorHint tool="expanding-factorising">
                  Click a cell or the printed question to edit. Double-click a cell for a pupil space. Blank
                  cells stay blank until you choose to fill them.
                </EditorHint>
              }
            >
            </EditorFoot>
            <div className="ag-resource-footer">
              <span>
                Grid: {g.gridWidth.toFixed(1)} × {g.gridHeight.toFixed(1)} mm ·{" "}
                {d.rows.length} rows × {d.columns.length} columns
              </span>
            </div>
            {pendingInput && (
              <p className="ag-message">
                Apply or cancel the pending edit before changing or exporting
                the resource.
              </p>
            )}
            {issue && (
              <p className="ag-warning" role="status">
                {issue}
              </p>
            )}
            {notes.length > 0 && (
              <div className="ag-warning">
                <strong>Check the mathematics</strong>
                <ul>
                  {notes.map((v) => (
                    <li key={v}>{v}</li>
                  ))}
                </ul>
                <label>
                  <input
                    type="checkbox"
                    disabled={blocked}
                    checked={d.intentionalError}
                    onChange={(ev) =>
                      change((n) => {
                        n.document.intentionalError = ev.target.checked;
                      })
                    }
                  />
                  This is an intentional error-spotting task
                </label>
              </div>
            )}
            {(recovery !== null || conflict) && (
              <section className="ag-warning">
                <h2>Protect saved work</h2>
                <p>
                  {conflict
                    ? "Another tab has changed this saved grid. Save your current work before reloading."
                    : "The original saved data has been left untouched."}
                </p>
                <button
                  onClick={() =>
                    downloadBlob(
                      new Blob([recovery ?? canonical(e)], {
                        type: "application/json",
                      }),
                      downloadName("expanding-factorising", "json", { recovery: true }),
                    )
                  }
                >
                  Download recovery data
                </button>
                {recovery !== null && (
                  <button
                    onClick={() => {
                      if (
                        !window.confirm(
                          "Start a fresh grid? Download recovery data first if you need it.",
                        )
                      )
                        return;
                      try {
                        const now = localStorage.getItem(startup.key);
                        if (now !== expected.current) {
                          setConflict(true);
                          return;
                        }
                        localStorage.setItem(startup.key, canonical(example()));
                        expected.current = canonical(example());
                        setRecovery(null);
                        commit(example(), true);
                      } catch {
                        setMessage(
                          "Device storage is unavailable. Your recovery data is still protected.",
                        );
                      }
                    }}
                  >
                    Start fresh
                  </button>
                )}
              </section>
            )}
          </Panel>
          <aside ref={stackRef} className="inspector-stack md-kit md-kit--one" aria-label="Algebra grid settings">
            <ReturnToDiagram />
            {/* One folding column (the usability rollout, 22 Nov 2026): What pupils see, the task, then the print size. */}
            <FoldCard tool="algebra-grid" title="What pupils see" icon={Eye} defaultOpen summary={spaceSummary} help="Each cell prints its value, a pupil space or nothing. Click a cell on the grid for its own choice.">
              {(
                [
                  ["Headings", headingCells],
                  ["Products", productCells],
                ] as const
              ).map(
                ([group, at]) =>
                  at.length > 0 && (
                    <VisibilitySwitch
                      key={group}
                      name={group}
                      caption={group}
                      disabled={blocked}
                      value={commonVisibility(at.map(({ r, c }) => cellSees(d.rows[r].cells[c]))) ?? "show"}
                      onChange={(v) => setSees(at, v, `all ${group.toLowerCase()}`)}
                    />
                  ),
              )}
              {headingCells.length + productCells.length === 0 && <p className="md-kit-note">Type in a cell first.</p>}
              <PupilSpaceHint count={spaceCells.length} disabled={blocked} onClear={() => setSees(spaceCells, "show", "pupil spaces")}>
                Double-click a cell for a pupil space.
              </PupilSpaceHint>
            </FoldCard>
            <FoldCard tool="algebra-grid" title="Teaching resource" icon={Grid3X3} defaultOpen summary={d.mode === "expand" ? "Expanding" : d.mode === "factorise" ? "Factorising" : "Grid method"}>
              <label>
                Task
                <select
                  value={d.mode}
                  disabled={blocked}
                  onChange={(ev) =>
                    switchMode(ev.target.value as typeof d.mode)
                  }
                >
                  <option value="expand">Expanding</option>
                  <option value="factorise">Factorising</option>
                  <option value="multiply">
                    Multiplying numbers (grid method)
                  </option>
                </select>
              </label>
              <label>
                {d.mode === "factorise"
                  ? "Expression to factorise"
                  : d.mode === "multiply"
                    ? "Multiplication, such as 23 × 47"
                    : "Question expression"}
                <input
                  aria-label="Question expression"
                  aria-invalid={field?.key === "expression" && !!inputError}
                  disabled={dimensionBlocked || questionEditor}
                  value={
                    field?.key === "expression" ? field.value : d.expression
                  }
                  onChange={(ev) => startField("expression", ev.target.value)}
                  onKeyDown={(ev) => {
                    if (ev.key === "Enter") applyField();
                    if (ev.key === "Escape") {
                      setField(null);
                      setInputError("");
                    }
                  }}
                />
              </label>
              {!questionEditor && settingActions("expression")}
              <label>
                <input
                  type="checkbox"
                  disabled={blocked}
                  checked={d.questionVisible}
                  onChange={(ev) =>
                    change((n) => {
                      n.document.questionVisible = ev.target.checked;
                    })
                  }
                />
                Print question
              </label>
              <label>
                <input
                  type="checkbox"
                  disabled={blocked}
                  checked={d.gridVisible}
                  onChange={(ev) =>
                    change((n) => {
                      n.document.gridVisible = ev.target.checked;
                    })
                  }
                />
                Show grid (turn off for working space only)
              </label>
              <label>
                Answer lines
                <select
                  value={d.answerLines}
                  disabled={blocked}
                  onChange={(ev) =>
                    change((n) => {
                      n.document.answerLines = Number(ev.target.value);
                    })
                  }
                >
                  {[0, 1, 2, 3].map((v) => (
                    <option key={v} value={v}>
                      {v === 0 ? "None" : v === 1 ? "1 line" : `${v} lines`}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <input
                  type="checkbox"
                  disabled={blocked || !d.answer}
                  checked={d.answerVisible}
                  onChange={(ev) =>
                    change((n) => {
                      n.document.answerVisible = ev.target.checked;
                    })
                  }
                />
                Print the final answer below the grid
              </label>
              <div className="ag-actions">
                <button disabled={blocked} onClick={fill}>
                  Fill products
                </button>
                <button disabled={blocked} onClick={collect}>
                  {d.mode === "factorise"
                    ? "Read factors"
                    : d.mode === "multiply"
                      ? "Add the products"
                      : "Collect like terms"}
                </button>
                <button
                  disabled={blocked}
                  onClick={() =>
                    replace(
                      create(d.rows.length, d.columns.length),
                      "Open a blank grid?",
                    )
                  }
                >
                  Blank grid
                </button>
                <button disabled={blocked} onClick={openWorked}>
                  Use worked version
                </button>
              </div>
              <p>
                Calculations use saved entries, including hidden answers.
              </p>
            </FoldCard>
            <FoldCard tool="algebra-grid" title="Print size" icon={Ruler} summary={`${d.cellMm} mm cells · ${d.paper} ${d.orientation}`}>
              <div className="ag-presets">
                {[
                  [12, "Compact"],
                  [15, "Default"],
                  [18, "Larger"],
                ].map(([v, label]) => (
                  <button
                    key={v}
                    disabled={blocked}
                    aria-pressed={
                      d.cellMm === v && d.columns.every((c) => c.widthMm === v)
                    }
                    onClick={() => commit(setSize(e, Number(v)))}
                  >
                    {label}
                    <small>{v} mm</small>
                  </button>
                ))}
              </div>
              {numeric("Cell size (mm)", "size", d.cellMm)}
              <p>
                Product cells stay at the chosen size (12–18 mm). Applying a
                cell size resets individual column width overrides.
              </p>
              <label>
                <input
                  type="checkbox"
                  disabled={blocked}
                  checked={d.compactHeadings}
                  onChange={(ev) =>
                    change((n) => {
                      n.document.compactHeadings = ev.target.checked;
                    })
                  }
                />
                Automatically compact filled headings
              </label>
              <p>
                Blank or hidden headings keep full writing space. Product cells
                keep their chosen size. A custom first-column width is
                respected.
              </p>
              <p>
                Printed headings: {g.headingWidth} mm column width ·{" "}
                {g.headingHeight} mm row height.
              </p>
              <label>
                Grid lines
                <select
                  aria-label="Grid lines"
                  disabled={blocked}
                  value={d.gridLineMm}
                  onChange={(ev) =>
                    change((n) => {
                      n.document.gridLineMm = Number(
                        ev.target.value,
                      ) as typeof d.gridLineMm;
                    })
                  }
                >
                  {d.gridLineMm === 0.2 && (
                    <option value="0.2">Legacy · 0.2 mm</option>
                  )}
                  <option value="0.35">Light · 0.35 mm</option>
                  <option value="0.5">Standard · 0.5 mm</option>
                  <option value="0.79375">
                    Thick · 2.25 pt (ratio tables)
                  </option>
                </select>
              </label>
              <label>
                Paper
                <select
                  value={d.paper}
                  disabled={blocked}
                  onChange={(ev) =>
                    change((n) => {
                      n.document.paper = ev.target.value as typeof d.paper;
                    })
                  }
                >
                  <option>A4</option>
                  <option>A3</option>
                </select>
              </label>
              <label>
                Orientation
                <select
                  value={d.orientation}
                  disabled={blocked}
                  onChange={(ev) =>
                    change((n) => {
                      n.document.orientation = ev.target
                        .value as typeof d.orientation;
                    })
                  }
                >
                  <option value="portrait">Portrait</option>
                  <option value="landscape">Landscape</option>
                </select>
              </label>
              <details>
                <summary>Individual column widths</summary>
                {d.columns.map((c, i) => (
                  <div key={c.id}>
                    {numeric(
                      `Column ${i + 1} width (mm)`,
                      `column-${i}`,
                      c.widthMm,
                    )}
                  </div>
                ))}
              </details>
              <p>
                Print at actual size. A3 reduced to A4 makes a 15 mm cell about
                10.6 mm. Paper choice and preview zoom never resize cells.
              </p>
              <details>
                <summary>Notation and help</summary>
                <p>
                  Enter integer terms in x, for example x^2, -12x and +24. Powers
                  0–6 are supported. There are up to six terms on each edge; extra
                  rows and columns begin blank.
                </p>
                <p>
                  Multiplying numbers uses the same grid for the grid method:
                  enter plain numbers such as 20, 3 or 0.4. The worked version
                  splits each number by place value, so 23 × 47 needs two columns
                  and two rows of products.
                </p>
                <p>
                  Factorising uses trial and improvement. Check that the whole
                  expression matches. Automatic worked copies support monic
                  integer quadratics in a 3 × 3 grid, and a common factor in one
                  product row.
                </p>
                <p>
                  Clear removes a value. Hide retains an answer in editable files
                  and links; it leaves a blank in pupil artwork. Leave out keeps it too, but prints it in
                  neither copy. Exports always use pupil visibility.
                </p>
              </details>
            </FoldCard>
          </aside>
        </section>
        {questionEditor && field?.key === "expression" && (
          <CellEditor
            anchor={g.question ? "question" : "question-toggle"}
            active={active}
            title="Edit printed question"
          >
            <strong>Edit question</strong>
            <label>
              {d.mode === "factorise"
                ? "Expression to factorise"
                : d.mode === "multiply"
                  ? "Multiplication to work out"
                  : "Expression to expand"}
              <input
                aria-label="Printed question expression"
                aria-invalid={!!inputError}
                value={field.value}
                onChange={(ev) => startField("expression", ev.target.value)}
                onKeyDown={(ev) => {
                  if (ev.key === "Enter") applyField();
                  if (ev.key === "Escape") cancelField();
                }}
              />
            </label>
            {inputError && <p role="alert">{inputError}</p>}
            <div className="ag-actions">
              <button onClick={applyField}>Apply question</button>
              <button onClick={cancelField}>Cancel question</button>
            </div>
          </CellEditor>
        )}
        {cellBox && boxAnchor && (() => {
          const { r, c } = cellBox,
            cell = d.rows[r].cells[c];
          return (
            <OptionsBox
              anchor={boxAnchor}
              anchorKey={`${r}-${c}`}
              hidden={!active}
              focusField={!coarse}
              // Beside the whole grid, so it never covers a neighbouring cell, and never over the settings.
              placeBy={boxAnchor.closest<HTMLElement>(".ag-resource")}
              bounds={boxAnchor.closest<HTMLElement>(".editor-card")}
              title={`Row ${r + 1}, column ${c + 1}`}
              // A refused entry keeps the box open, so it stays visible until it is fixed.
              onClose={() => !refused.current && closeBox()}
            >
              <div className="ag-box">
                <label>
                  Cell entry
                  <LiveText key={`${r}-${c}`} label="Cell entry" value={cell.value ?? ""} invalid={!!boxError} onCommit={(text) => editCell(r, c, text)} onRevert={() => {
                      refused.current = false;
                      setBoxError("");
                    }}
                  />
                </label>
                <VisibilitySwitch
                  name="What pupils see"
                  caption="What pupils see"
                  value={cellSees(cell)}
                  disabled={(blocked && !boxError) || cell.value === null}
                  onChange={(v) => setSees([{ r, c }], v, cellName(r, c))}
                />
                {cell.value === null && <p>An empty cell is a pupil space. Type a value to keep an answer.</p>}
                {boxError && <p role="alert">{boxError}</p>}
                <div className="ag-actions">
                  <button
                    type="button"
                    disabled={cell.value === null}
                    onClick={() => {
                      if (editCell(r, c, "")) setBoxError("");
                    }}
                  >
                    Clear cell
                  </button>
                </div>
              </div>
            </OptionsBox>
          );
        })()}
        {pending && active && (
          <RatioDialog
            title={pending.title}
            confirmLabel="Apply replacement"
            onCancel={() => setPending(null)}
            onConfirm={() => {
              commit(pending.e, false, stepName(pending.title));
              setPending(null);
              setShowAnswers(false);
            }}
          >
            <p>{pending.explanation}</p>
          </RatioDialog>
        )}
      </main>
    </div>
  );
}
