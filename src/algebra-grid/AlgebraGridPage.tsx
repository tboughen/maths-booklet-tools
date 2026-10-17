import { useResourceViewport, fitResource } from "../site/useResourceFit";
import { ExampleGallery } from "../examples/ExampleGallery";
import { algebraGallery } from "../examples/galleryCatalogue";
import { openWorkedDocument, copyStorageKey } from "../site/copyDocument";
import { PreviewControls } from "../site/PreviewControls";
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
import {
  EditorDownloadMenu,
  LINK_DESCRIPTION,
} from "../site/EditorDownloadMenu";
import { PageHeading, Panel } from "../site/PageHeading";
import { ResourceSize } from "../site/ResourceSize";
import { ResourceSaveStatus } from "../site/ResourceSaveStatus";
import { RatioDialog } from "../ratio-table/RatioDialog";
import { copyPngToClipboard, downloadBlob } from "../export/clipboard";
import { copyWord, downloadEditable, downloadImage, printPng } from "./export";
import { editorLink, parseLink } from "./links";
import { CellEditor } from "./CellEditor";
import "./algebra-grid.css";

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
type Draft = { r: number; c: number; text: string; hidden: boolean };
type Replacement = { e: Envelope; title: string; explanation: string };
export default function AlgebraGridPage({
  active = true,
}: {
  active?: boolean;
}) {
  const [startup] = useState(initial),
    [history, setHistory] = useState({
      past: startup.previous ? [startup.previous] : ([] as Envelope[]),
      present: startup.e,
      future: [] as Envelope[],
    });
  const e = history.present,
    d = e.document,
    g = layout(e);
  const [recovery, setRecovery] = useState(startup.recovery),
    [conflict, setConflict] = useState(false),
    [saveState, setSaveState] = useState("Saved on this device"),
    [message, setMessage] = useState(startup.message);
  const [draft, setDraft] = useState<Draft | null>(null),
    [field, setField] = useState<{ key: string; value: string } | null>(null),
    [questionEditor, setQuestionEditor] = useState(false),
    [inputError, setInputError] = useState(""),
    [pending, setPending] = useState<Replacement | null>(null),
    [menu, setMenu] = useState(false),
    [busy, setBusy] = useState(false),
    [showAnswers, setShowAnswers] = useState(false),
    [zoom, setZoom] = useState("fit");
  const file = useRef<HTMLInputElement>(null),
    scroll = useRef<HTMLDivElement>(null),
    expected = useRef(startup.raw),
    linkSeen = useRef(""),
    draftRef = useRef(draft),
    blockedRef = useRef(false),
    fieldRef = useRef(field),
    documentRef = useRef(e),
    activeRef = useRef(active);
  draftRef.current = draft;
  fieldRef.current = field;
  documentRef.current = e;
  activeRef.current = active;
  const available = useResourceViewport(scroll);
  const pendingInput = !!draft || !!field,
    blocked =
      pendingInput || recovery !== null || conflict || busy || !!pending;
  blockedRef.current = blocked;
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
  function commit(next: Envelope, force = false) {
    if (!force && (recovery !== null || conflict)) return;
    const n = validate(next);
    setHistory((h) =>
      canonical(n) === canonical(h.present)
        ? h
        : { past: [...h.past, h.present].slice(-60), present: n, future: [] },
    );
  }
  function change(fn: (n: Envelope) => void) {
    if (blocked) return;
    const n = structuredClone(e);
    fn(n);
    commit(n);
  }
  function undo() {
    if (blockedRef.current) return;
    setHistory((h) =>
      h.past.length
        ? {
            past: h.past.slice(0, -1),
            present: h.past[h.past.length - 1],
            future: [h.present, ...h.future],
          }
        : h,
    );
  }
  function redo() {
    if (blockedRef.current) return;
    setHistory((h) =>
      h.future.length
        ? {
            past: [...h.past, h.present],
            present: h.future[0],
            future: h.future.slice(1),
          }
        : h,
    );
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
      if (
        (event.ctrlKey || event.metaKey) &&
        ["z", "y"].includes(event.key.toLowerCase())
      ) {
        event.preventDefault();
        if (event.key.toLowerCase() === "y" || event.shiftKey) redo();
        else undo();
      }
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
  function openCell(r: number, c: number) {
    if (blocked) return;
    const cell = d.rows[r].cells[c];
    setInputError("");
    setDraft({ r, c, text: cell.value ?? "", hidden: cell.hidden });
  }
  function applyCell() {
    if (!draft || recovery !== null || conflict) return;
    try {
      commit(
        setCell(e, draft.r, draft.c, draft.text.trim() || null, draft.hidden),
      );
      setDraft(null);
      setInputError("");
      restoreCellFocus(draft.r, draft.c);
    } catch (err) {
      setInputError(errorText(err));
    }
  }
  function startField(key: string, value: string) {
    if (
      draft ||
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
      const n = workedCopy(e),
        id = crypto.randomUUID(),
        key = STORAGE + ":copy:" + id;
      localStorage.setItem(key, canonical(n));
      const url = new URL(location.href);
      url.search = `?tool=expanding-factorising&algebraCopy=${id}`;
      url.hash = "";
      if (!window.open(url.href, "_blank")) {
        setMessage(
          "The worked copy is saved. Allow pop-ups and try again, or download its editable file.",
        );
        downloadEditable(n);
      } else
        setMessage(
          "Worked copy opened in a separate tab. Your pupil scaffold is preserved.",
        );
    } catch (err) {
      setMessage(errorText(err));
    }
  }
  function restoreCellFocus(r: number, c: number) {
    requestAnimationFrame(() => {
      if (activeRef.current)
        document
          .querySelector<HTMLButtonElement>(
            `.ag-editor [data-ag-cell="${r}-${c}"]`,
          )
          ?.focus({ preventScroll: true });
    });
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
  const cancelDraft = () => {
    if (draft) restoreCellFocus(draft.r, draft.c);
    setDraft(null);
    setInputError("");
  };
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
            disabled={!!draft || (blocked && field?.key !== key)}
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
  const dimensionBlocked = !!draft || (blocked && field?.key !== "expression");
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
              canUndo={history.past.length > 0 && !blocked}
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
              onToggleMenu={() => setMenu((v) => !v)}
              menuId="algebra-download-menu"
            />
            <EditorDownloadMenu
              id="algebra-download-menu"
              open={menu}
              active={active}
              onClose={() => setMenu(false)}
              onMessage={setMessage}
              onBusyChange={setBusy}
              actions={[
                {
                  label: "Download SVG",
                  disabled: pendingInput || !!issue,
                  action: () => downloadImage(e, "svg"),
                  success: "SVG download started.",
                },
                {
                  label: "Download PNG (600 ppi)",
                  disabled: pendingInput || !!issue,
                  action: () => downloadImage(e, "png"),
                  success: "PNG download started.",
                },
                {
                  label: "Save editable file",
                  disabled: pendingInput,
                  description: "Includes hidden answers.",
                  action: () => downloadEditable(e),
                  success: "Editable-file download started.",
                },
                {
                  label: "Open editable file",
                  disabled: pendingInput,
                  action: () => file.current?.click(),
                  picker: true,
                },
                {
                  label: "Copy editable link",
                  disabled: pendingInput,
                  description: LINK_DESCRIPTION,
                  action: async () =>
                    navigator.clipboard.writeText(editorLink(e, location.href)),
                  success:
                    "Editable link copied, including any hidden answers.",
                },
              ]}
            />
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
            <div className="ag-preview-bar">
              <PreviewControls
                zoom={zoom === "fit" ? 0 : Number(zoom)}
                onZoom={(value) => setZoom(value ? String(value) : "fit")}
              />
              <ResourceSize width={g.width / 10} height={g.height / 10} />
            </div>
            <p className="ag-guidance">
              Click a cell or the printed question to edit. Blank cells stay
              blank until you choose to fill them.
            </p>
            <div
              className="ag-scroll"
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
                      __html: renderSvg(e, showAnswers),
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
                        aria-label={`Row ${a.r + 1}, column ${a.c + 1}: ${a.cell.hidden ? "hidden answer" : a.cell.value ? display(a.cell.value) : "blank"}`}
                        disabled={blocked}
                        style={{
                          left: a.x * px,
                          top: a.y * px,
                          width: a.w * px,
                          height: a.h * px,
                        }}
                        onClick={() => openCell(a.r, a.c)}
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
            <div className="ag-resource-footer">
              <span>
                Grid: {g.gridWidth.toFixed(1)} × {g.gridHeight.toFixed(1)} mm ·{" "}
                {d.rows.length} rows × {d.columns.length} columns
              </span>
              <label>
                <input
                  type="checkbox"
                  checked={showAnswers}
                  onChange={(ev) => setShowAnswers(ev.target.checked)}
                />
                Preview saved hidden answers
              </label>
            </div>
            {message && (
              <p className="ag-message" role="status">
                {message}
              </p>
            )}
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
                      "algebra-grid-recovery.json",
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
          <aside className="inspector-stack" aria-label="Algebra grid settings">
            <ExampleGallery
              examples={algebraGallery}
              active={active}
              disabled={blocked}
              onUse={(resource, title) => replace(resource, `Open ${title}?`)}
              onWorked={(resource) =>
                openWorkedDocument(
                  "expanding-factorising",
                  "maths-booklet-tools:algebra-grid:v1",
                  canonical(resource),
                )
              }
            />
            <section className="panel-card ag-panel">
              <h2>Teaching resource</h2>
              <label>
                Task
                <select
                  value={d.mode}
                  disabled={blocked}
                  onChange={(ev) =>
                    change((n) => {
                      n.document.mode = ev.target.value as typeof d.mode;
                      n.document.expression = "";
                      n.document.sourceId = null;
                    })
                  }
                >
                  <option value="expand">Expanding</option>
                  <option value="factorise">Factorising</option>
                </select>
              </label>
              <label>
                {d.mode === "factorise"
                  ? "Expression to factorise"
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
                Include question
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
                      {v}
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
                Show saved final answer
              </label>
              <div className="ag-actions">
                <button disabled={blocked} onClick={fill}>
                  Fill products
                </button>
                <button disabled={blocked} onClick={collect}>
                  {d.mode === "factorise"
                    ? "Read factors"
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
                  Create worked copy ↗
                </button>
              </div>
              <p className="ag-note">
                Calculations use saved entries, including hidden answers. A
                worked copy opens separately.
              </p>
            </section>
            <section className="panel-card ag-panel">
              <h2>Print size</h2>
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
              <p className="ag-note">
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
              <p className="ag-note">
                Blank or hidden headings keep full writing space. Product cells
                keep their chosen size. A custom first-column width is
                respected.
              </p>
              <p className="ag-note">
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
              <p className="ag-note">
                Print at actual size. A3 reduced to A4 makes a 15 mm cell about
                10.6 mm. Paper choice and preview zoom never resize cells.
              </p>
            </section>

            <details className="panel-card ag-panel">
              <summary>Notation and help</summary>
              <p>
                Enter integer terms in x, for example x^2, -12x and +24. Powers
                0–6 are supported. There are up to six terms on each edge; extra
                rows and columns begin blank.
              </p>
              <p>
                Factorising uses trial and improvement. Check that the whole
                expression matches. Automatic worked copies support monic
                integer quadratics in a 3 × 3 grid, and a common factor in one
                product row.
              </p>
              <p>
                Clear removes a value. Hide retains an answer in editable files
                and links; it leaves a blank in pupil artwork. Exports always
                use pupil visibility.
              </p>
            </details>
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
        {draft && (
          <CellEditor anchor={`${draft.r}-${draft.c}`} active={active}>
            <strong>
              Row {draft.r + 1}, column {draft.c + 1}
            </strong>
            <label>
              Cell entry
              <input
                aria-label="Cell entry"
                value={draft.text}
                aria-invalid={!!inputError}
                onChange={(ev) => {
                  setDraft({ ...draft, text: ev.target.value });
                  setInputError("");
                }}
                onKeyDown={(ev) => {
                  if (ev.key === "Enter") applyCell();
                  if (ev.key === "Escape") cancelDraft();
                }}
              />
            </label>
            <label>
              <input
                type="checkbox"
                checked={draft.hidden}
                disabled={!draft.text}
                onChange={(ev) =>
                  setDraft({ ...draft, hidden: ev.target.checked })
                }
              />
              Hide saved answer from pupils
            </label>
            {inputError && <p role="alert">{inputError}</p>}
            <div className="ag-actions">
              <button onClick={applyCell}>Apply cell</button>
              <button onClick={cancelDraft}>Cancel cell</button>
              <button
                onClick={() => {
                  setDraft({ ...draft, text: "", hidden: false });
                  setInputError("");
                }}
              >
                Clear cell
              </button>
            </div>
          </CellEditor>
        )}
        {pending && active && (
          <RatioDialog
            title={pending.title}
            confirmLabel="Apply replacement"
            onCancel={() => setPending(null)}
            onConfirm={() => {
              commit(pending.e);
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
