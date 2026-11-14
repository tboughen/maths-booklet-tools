import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { useResourceFit } from "../site/useResourceFit";
import { ExampleGallery } from "../examples/ExampleGallery";
import { twoWayTableGallery } from "../examples/galleryCatalogue";
import { copyStorageKey } from "../site/copyDocument";
import { PreviewControls } from "../site/PreviewControls";
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
  addColumn,
  addRow,
  canonical,
  cellAt,
  completeTotals,
  create,
  forView,
  hasHidden,
  layout,
  MAX_CATEGORIES,
  MAX_HEADING,
  parseFile,
  removeColumn,
  removeRow,
  renderSvg,
  setCell,
  setHeading,
  setTotals,
  validate,
  warnings,
  type Envelope,
} from "../../packages/two-way-table-core/src";
import { LINK_PREFIX, parseTwoWayTableLink, twoWayTableLink } from "./links";
import { copyWord, downloadEditable, downloadImage, printPng } from "./export";
import { handleUndoKeys, useDocumentHistory } from "../editor-kit";

const STORAGE = copyStorageKey("maths-booklet-tools:two-way-table:v1");
type Doc = Envelope["document"];
/** A cell address: a row ID (or "total") and a column ID (or "total"). */
type Address = { row: string; column: string };

function initial() {
  try {
    const raw = localStorage.getItem(STORAGE);
    if (raw) {
      try {
        return { e: parseFile(raw), recovery: null, message: "" };
      } catch {
        return { e: create(), recovery: raw, message: "Saved table data needs recovery. Download the original before starting afresh." };
      }
    }
  } catch {
    return { e: create(), recovery: null, message: "Device storage is unavailable. Save an editable file to keep your work." };
  }
  return { e: create(), recovery: null, message: "" };
}

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
  useEffect(() => {
    if (!editing && !invalid) setDraft(value);
  }, [value, editing, invalid]);
  const commit = () => {
    setEditing(false);
    if (draft === value) return setInvalid(false);
    setInvalid(!onCommit(draft));
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
        }
      }}
    />
  );
}

export default function TwoWayTablePage({ active = true }: { active?: boolean }) {
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
    [hideFilled, setHideFilled] = useState(true),
    [pending, setPending] = useState<{ e: Envelope; title: string; explanation: string } | null>(null);
  const file = useRef<HTMLInputElement>(null),
    expected = useRef<string | null>(null);
  const e = history.present,
    d = e.document,
    displayed = forView(e, view),
    g = layout(displayed),
    blocked = busy || recovery !== null || pending !== null;
  const fitted = useResourceFit((g.width * 96) / 25.4, (g.height * 96) / 25.4, zoom, (w) => (w < 500 ? 72 : 120));
  const issue = g.issues.join(" ");
  const notes = warnings(e);
  const columnIds = [...d.columns.map((c) => c.id), ...(d.totalColumn ? ["total"] : [])];
  const rowIds = [...d.rows.map((r) => r.id), ...(d.totalRow ? ["total"] : [])];
  const selectedCell = selected && rowIds.includes(selected.row) && columnIds.includes(selected.column) ? cellAt(d, selected.row, selected.column) : null;

  function commit(next: Envelope | (() => Envelope)): boolean {
    if (recovery !== null) return false;
    try {
      const valid = validate(typeof next === "function" ? next() : next);
      documentHistory.commit(valid);
      setMessage("");
      return true;
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err));
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
  function replace(next: Envelope, title: string, explanation = "This replaces the current table. You can undo the replacement.") {
    if (!blocked) setPending({ e: next, title, explanation });
  }
  const rowName = (id: string) => (id === "total" ? "Total" : d.rows.find((r) => r.id === id)?.heading || `row ${d.rows.findIndex((r) => r.id === id) + 1}`);
  const columnName = (id: string) =>
    id === "total" ? "Total" : d.columns.find((c) => c.id === id)?.heading || `column ${d.columns.findIndex((c) => c.id === id) + 1}`;
  const cellId = (a: Address) => `twt-cell-${a.row}-${a.column}`;
  function focusCell(a: Address) {
    setSelected(a);
    requestAnimationFrame(() => {
      const field = document.getElementById(cellId(a)) as HTMLInputElement | null;
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
        setMessage("Saved table data changed in another tab. Download its data before replacing it.");
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
        const incoming = parseTwoWayTableLink(location.href);
        linkPending.current = true;
        replace(incoming, "Open the linked table?");
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
      if (upload.size > 30000) throw Error("This editable file is too large.");
      replace(parseFile(await upload.text()), "Open this table?");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err));
    }
  }
  const px = (mm: number, of: number) => `${(mm / of) * 100}%`;

  return (
    <div className="app-shell booklet-editor pt-editor twt-editor">
      <main className="main-content" id={active ? "main-content" : undefined} tabIndex={-1}>
        <PageHeading title="Two-way tables" description="Draw exam-style two-way tables with totals, and cells left blank or hidden for pupils.">
          <ResourceSaveStatus text={saveState} />
        </PageHeading>
        <section className="workspace">
          <Panel className="editor-card">
            <EditorToolbar
              canUndo={!blocked && history.past.length > 0}
              canRedo={!blocked && history.future.length > 0}
              onUndo={undo}
              onRedo={redo}
              onReset={() => replace(create(), "Reset the table?")}
              resetDisabled={blocked}
              exportDisabled={blocked || !!issue}
              menuDisabled={blocked}
              busy={busy}
              onCopy={() => void run(() => copyWord(displayed), "Copied for Word at " + formatResourceSize(g.width / 10, g.height / 10) + ". Paste with Ctrl+V.")}
              onCopyClipboard={() => void run(() => copyPngToClipboard(() => printPng(displayed)))}
              menuId="twt-downloads"
              menuOpen={menu}
              onToggleMenu={() => setMenu(!menu)}
            />
            <EditorDownloadMenu
              wordHelp
              id="twt-downloads"
              open={menu}
              active={active}
              onClose={() => setMenu(false)}
              onBusyChange={setBusy}
              onMessage={setMessage}
              actions={diagramFileMenu({
                svg: { action: () => downloadImage(displayed, "svg"), disabled: blocked || !!issue, success: "SVG download started." },
                png: { action: () => downloadImage(displayed, "png"), disabled: blocked || !!issue, success: "PNG download started." },
                pdf: { action: () => downloadImage(displayed, "pdf"), disabled: blocked || !!issue, success: "PDF download started." },
                save: { action: () => downloadEditable(e), disabled: blocked, success: "Editable file download started." },
                open: { action: () => file.current?.click(), disabled: blocked, success: "" },
                link: {
                  action: () => navigator.clipboard.writeText(twoWayTableLink(e, location.href)),
                  disabled: blocked,
                  success: "Editable link copied.",
                },
              })}
            />
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
            <div className="pt-scroll" ref={fitted.ref}>
              <div className="pt-stage">
                <div
                  className="pt-resource"
                  data-testid="two-way-table-resource"
                  style={{ width: ((g.width * 96) / 25.4) * fitted.scale, height: ((g.height * 96) / 25.4) * fitted.scale }}
                >
                  <div className="pt-art" dangerouslySetInnerHTML={{ __html: renderSvg(displayed) }} />
                  {rowIds.map((row, i) =>
                    columnIds.map((column, j) => {
                      const c = cellAt(d, row, column),
                        hiddenHere = view === "pupil" && c.show === "hidden";
                      return (
                        <button
                          key={`${row}-${column}`}
                          type="button"
                          className={`pt-hit ${selected?.row === row && selected.column === column ? "pt-selected" : ""} ${hiddenHere ? "pt-hidden-answer" : ""}`}
                          aria-label={`Edit the cell for ${rowName(row)}, ${columnName(column)}`}
                          title={hiddenHere ? "Hidden answer (pupils fill this in)" : undefined}
                          disabled={blocked}
                          style={{ left: px(g.x[j + 1], g.width), top: px(g.y[i + 1], g.height), width: px(g.x[j + 2] - g.x[j + 1], g.width), height: px(g.y[i + 2] - g.y[i + 1], g.height) }}
                          onClick={() => focusCell({ row, column })}
                        />
                      );
                    }),
                  )}
                </div>
              </div>
            </div>
            {(message || issue || notes.length > 0) && (
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
                {notes.map((x) => (
                  <p key={x}>Teacher note: {x}</p>
                ))}
              </div>
            )}
            <div className="twt-grid-wrap">
              <table className="twt-grid" aria-label="Table entries">
                <thead>
                  <tr>
                    <th scope="col">
                      <DraftField
                        label="Corner heading"
                        value={d.corner}
                        maxLength={MAX_HEADING}
                        disabled={blocked}
                        onCommit={(v) => commit(() => setHeading(e, "corner", v))}
                      />
                    </th>
                    {d.columns.map((c, j) => (
                      <th key={c.id} scope="col">
                        <DraftField
                          label={`Heading for column ${j + 1}`}
                          value={c.heading}
                          maxLength={MAX_HEADING}
                          disabled={blocked}
                          onCommit={(v) => commit(() => setHeading(e, c.id, v))}
                        />
                        <button
                          type="button"
                          className="twt-remove"
                          aria-label={`Remove column ${c.heading || j + 1}`}
                          title="Remove column"
                          disabled={blocked || d.columns.length <= 1}
                          onClick={() => commit(() => removeColumn(e, c.id))}
                        >
                          ×
                        </button>
                      </th>
                    ))}
                    {d.totalColumn && (
                      <th scope="col" className="twt-total-heading">
                        Total
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {rowIds.map((row, i) => (
                    <tr key={row}>
                      <th scope="row">
                        {row === "total" ? (
                          <span className="twt-total-heading">Total</span>
                        ) : (
                          <>
                            <DraftField
                              label={`Heading for row ${i + 1}`}
                              value={d.rows[i].heading}
                              maxLength={MAX_HEADING}
                              disabled={blocked}
                              onCommit={(v) => commit(() => setHeading(e, row, v))}
                            />
                            <button
                              type="button"
                              className="twt-remove"
                              aria-label={`Remove row ${d.rows[i].heading || i + 1}`}
                              title="Remove row"
                              disabled={blocked || d.rows.length <= 1}
                              onClick={() => commit(() => removeRow(e, row))}
                            >
                              ×
                            </button>
                          </>
                        )}
                      </th>
                      {columnIds.map((column) => {
                        const c = cellAt(d, row, column),
                          here = selected?.row === row && selected.column === column;
                        return (
                          <td key={column} className={`${c.show === "hidden" ? "twt-hidden" : ""} ${here ? "twt-current" : ""}`}>
                            <DraftField
                              id={cellId({ row, column })}
                              label={`Cell for ${rowName(row)}, ${columnName(column)}`}
                              value={c.text}
                              maxLength={16}
                              inputMode="decimal"
                              disabled={blocked}
                              onFocus={() => setSelected({ row, column })}
                              onCommit={(v) => commit(() => setCell(e, row, column, v, v.trim() ? c.show : "show"))}
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
              <button type="button" disabled={blocked || d.rows.length >= MAX_CATEGORIES} onClick={() => commit(() => addRow(e))}>
                Add row
              </button>
              <button type="button" disabled={blocked || d.columns.length >= MAX_CATEGORIES} onClick={() => commit(() => addColumn(e))}>
                Add column
              </button>
            </div>
          </Panel>
          <aside className="inspector-stack" aria-label="Two-way table settings">
            <ExampleGallery
              examples={twoWayTableGallery}
              active={active}
              disabled={blocked}
              onUse={(resource, title) => replace(resource, `Open ${title}?`)}
              onWorked={(resource) => commit(resource)}
            />
            <section className="panel-card pt-panel" aria-label="Selected cell">
              <h2>{selectedCell && selected ? `Cell: ${rowName(selected.row)}, ${columnName(selected.column)}` : "Selected cell"}</h2>
              {selectedCell && selected ? (
                <>
                  <label className="pt-hide" title="Hidden values are saved answers; pupils see an empty cell.">
                    <input
                      type="checkbox"
                      disabled={blocked || !selectedCell.text}
                      checked={selectedCell.show === "hidden"}
                      onChange={(ev) => commit(() => setCell(e, selected.row, selected.column, selectedCell.text, ev.target.checked ? "hidden" : "show"))}
                    />
                    Hide for pupils (keep as an answer)
                  </label>
                  {!selectedCell.text && <p className="pt-note">This cell is a blank with no answer. Enter the answer first to hide it.</p>}
                </>
              ) : (
                <p className="pt-note">Click a cell on the table or in the entries to choose it.</p>
              )}
              <p className="pt-note">
                Hide keeps a number as a saved answer and leaves its cell empty for pupils. An empty cell is a blank with no answer.
                Cells take whole numbers, decimals, fractions such as 3/20 and mixed numbers such as 2 1/2; fractions print stacked.
              </p>
              <div className="pt-row">
                <button
                  type="button"
                  disabled={blocked || !hasHidden(e)}
                  onClick={() =>
                    patch((n) => {
                      for (const r of [...n.rows.map((x) => x.cells), ...(n.totalRow ? [n.totalRow] : [])]) for (const c of r) c.show = "show";
                    })
                  }
                >
                  Show all
                </button>
              </div>
            </section>
            <section className="panel-card pt-panel">
              <h2>Totals</h2>
              <label className="pt-hide">
                <input type="checkbox" disabled={blocked} checked={d.totalColumn} onChange={(ev) => commit(() => setTotals(e, { column: ev.target.checked }))} />
                Total column
              </label>
              <label className="pt-hide">
                <input type="checkbox" disabled={blocked} checked={!!d.totalRow} onChange={(ev) => commit(() => setTotals(e, { row: ev.target.checked }))} />
                Total row
              </label>
              <p className="pt-note">
                Complete totals fills each empty total whose parts are all entered, exactly: fractions stay fractions and decimals stay
                decimals. Nothing is filled until you press the button, and it can be undone.
              </p>
              <label className="pt-hide">
                <input type="checkbox" disabled={blocked} checked={hideFilled} onChange={(ev) => setHideFilled(ev.target.checked)} />
                Hide the totals it fills (keep them as answers)
              </label>
              <div className="pt-row">
                <button
                  type="button"
                  disabled={blocked || (!d.totalColumn && !d.totalRow)}
                  onClick={() => {
                    const r = completeTotals(e, hideFilled);
                    if (r.filled) commit(r.envelope);
                    else setMessage("No empty total has all of its parts yet. Enter more numbers first.");
                  }}
                >
                  Complete totals
                </button>
              </div>
            </section>
            <section className="panel-card pt-panel">
              <h2>Layout</h2>
              <div className="pt-fields">
                <label>
                  Column width (mm)
                  <select aria-label="Column width" value={d.cellMm} disabled={blocked} onChange={(ev) => patch((n) => void (n.cellMm = Number(ev.target.value)))}>
                    {[...new Set([16, 18, 20, 22, 24, 26, 28, 30, 33, 36, d.cellMm])].sort((a, b) => a - b).map((x) => (
                      <option key={x} value={x}>
                        {x}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="pt-hide" title="For a spot-the-mistake task: totals that disagree raise no teacher note.">
                <input type="checkbox" disabled={blocked} checked={d.intentionalError} onChange={(ev) => patch((n) => void (n.intentionalError = ev.target.checked))} />
                This table has a deliberate error
              </label>
              <details>
                <summary>Editing and printing help</summary>
                <p className="pt-note">
                  Click a cell on the table to edit it. Enter applies; Escape restores. A number the table cannot read stays in its box
                  with the reason above. Up to {MAX_CATEGORIES} rows and {MAX_CATEGORIES} columns; headings widen their column when
                  needed. Nothing is calculated or filled in for you.
                </p>
                <p className="pt-note">
                  Copy for Word carries the physical size shown above the table; preview zoom never changes it. Download PNG (600 ppi)
                  if your browser blocks copying.
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
                downloadBlob(new Blob([recovery], { type: "application/json" }), "two-way-table-recovery.json");
                setProtectedCopy(true);
              }}
            >
              Download protected data
            </button>
            <button onClick={() => downloadEditable(e)}>Save current table</button>
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
              Keep this table and start saving
            </button>
          </section>
        )}
        {active && pending && (
          <RatioDialog
            title={pending.title}
            confirmLabel="Use this table"
            onCancel={() => {
              consumeLink();
              setPending(null);
            }}
            onConfirm={() => {
              if (busy || recovery !== null) return;
              consumeLink();
              commit(pending.e);
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
