import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, ChevronDown, Copy, Download, ImagePlus, LoaderCircle, Plus, RotateCcw, Trash2 } from "lucide-react";
import { PageHeading, Panel } from "../site/PageHeading";
import { ResourceSaveStatus } from "../site/ResourceSaveStatus";
import { EditorDownloadMenu } from "../site/EditorDownloadMenu";
import { AnswerPreviewToggle } from "../site/AnswerPreviewToggle";
import { copyStorageKey } from "../site/copyDocument";
import { downloadBlob } from "../export/clipboard";
import { STARTER, STARTER_ICONS, STARTER_TEMPLATES, isExtensionSlot, renderStarterRun, validateStarterRun, type Item, type StarterIcon, type StarterRun, type StarterTemplate } from "../../packages/resource-core/src/index";
import { year9Run } from "../../packages/resource-core/src/starter-fixtures";
import { BesideToggle, Field, LeafEditor, type Leaf } from "../worksheet/fields";
import { withBeside } from "../worksheet/edit";
import { TEMPLATE_NAMES, addStarter, copySlotFromPrevious, copySlotToAll, moveStarter, readLogo, removeStarter, setTemplate } from "./edit";
import { downloadEditable, downloadStarterPdf, downloadStarterWord, editableName } from "./export";
import "../worksheet/worksheet.css";
import "./starter.css";
import { HistoryButtons } from "../site/HistoryButtons";
import { usePrintSize } from "../site/usePrintSize";
import { handleUndoKeys, pushHistory, useDocumentHistory, redoLabel as redoStepName, undoLabel as undoStepName, openDraft, STORAGE_UNAVAILABLE, useDraftAutosave } from "../editor-kit";

const STORAGE = copyStorageKey("maths-booklet-tools:starters:v1");
const MAX_FILE = 1_000_000;
const ICON_NAMES: Record<StarterIcon, string> = { none: "No icon", pencil: "Pencil", talk: "Speech bubbles", book: "Book", puzzle: "Puzzle piece" };

/**
 * Starter builder (docs/tools/SILENT-STARTER-TOOL.md): a run of up to six silent starters. The grid
 * shows every starter's question in each slot; the selected starter is previewed as its A5 card and
 * edited in the side panel. Downloads are Word (two cards on each A4 sheet) and PDF.
 */
function initial(): { run: StarterRun; message: string; recovery: string | null } {
  const start = openDraft({
    key: STORAGE,
    parse: (raw) => validateStarterRun(JSON.parse(raw)),
    fresh: () => year9Run,
    recoveryMessage: "Saved starter data needs recovery. Download it before starting again.",
  });
  const message = start.message === STORAGE_UNAVAILABLE ? "Device storage is unavailable. Save the editable file to keep your work." : start.message;
  return { run: start.document, message, recovery: start.recovery };
}

/** A short line for a grid cell: the instruction, then the first text the question prints. */
function summary(card: StarterRun["document"]["starters"][number]["cards"][number]): string {
  const first = card.items.find((i): i is Extract<Item, { text: string }> => "text" in i && typeof i.text === "string" && i.text.trim() !== "");
  const diagram = card.items.some((i) => i.type === "diagram");
  const text = [card.title, first?.text, diagram ? "(diagram)" : ""].filter(Boolean).join(" ") || "(empty)";
  // {3/4} reads as 3/4 in the grid; the card itself prints it stacked.
  return text.replace(/\{([^{}/]+)\/([^{}/]+)\}/g, "$1/$2").replace(/\*/g, "");
}

export default function StarterPage({ active = true }: { active?: boolean }) {
  const [startup] = useState(() => {
    let opened: string | null = null;
    try {
      opened = localStorage.getItem(STORAGE);
    } catch {
      /* Saving reports the failure. */
    }
    return { ...initial(), opened };
  });
  const documentHistory = useDocumentHistory<StarterRun>(startup.run, { equals: (a, b) => JSON.stringify(a) === JSON.stringify(b) });
  const { history, setHistory } = documentHistory;
  const [recovery, setRecovery] = useState<string | null>(startup.recovery);
  const [message, setMessage] = useState(startup.message);
  const [answers, setAnswers] = useState(false);
  const [selected, setSelected] = useState(0);
  const [menu, setMenu] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<{ run: StarterRun; title: string } | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const logo = useRef<HTMLInputElement>(null);
  const printSize = usePrintSize();
  const run = history.present;
  const d = run.document;
  const current = Math.min(selected, d.starters.length - 1);
  const blocked = busy || recovery !== null || pending !== null;
  const shown = useMemo(() => renderStarterRun(run, { view: answers ? "answers" : "pupil" }), [run, answers]);
  // Downloads follow the pupil copy's checks (the answers copy is checked again when it is made).
  const pupil = useMemo(() => (answers ? renderStarterRun(run, { view: "pupil" }) : shown), [run, answers, shown]);
  const issues = pupil.issues;

  function commit(next: StarterRun | string): boolean {
    if (recovery !== null) return false;
    if (typeof next === "string") {
      setMessage(next);
      return false;
    }
    try {
      documentHistory.commit(validateStarterRun(next));
      setMessage("");
      return true;
    } catch (e) {
      // Invalid drafts are refused with the specific reason; the last valid run stays.
      setMessage(e instanceof Error ? e.message : String(e));
      return false;
    }
  }
  function patch(update: (doc: StarterRun["document"]) => void) {
    if (blocked) return false;
    const next = structuredClone(run);
    update(next.document);
    return commit(next);
  }
  const step = (make: () => StarterRun | string) => !blocked && commit(make());
  const undo = () => !blocked && documentHistory.undo();
  const redo = () => !blocked && documentHistory.redo();

  const savedText = useMemo(() => JSON.stringify(history.present), [history.present]);
  const { saveState, keepStored } = useDraftAutosave({
    key: STORAGE,
    text: savedText,
    paused: recovery !== null,
    opened: startup.opened,
    onConflict: (raw, reason) => {
      setRecovery(raw);
      setMessage(reason === "newer" ? "A newer starter run was saved in another tab. Its saved data is protected." : "The saved starter run changed in another tab. Download it before replacing it.");
    },
  });
  useEffect(() => {
    if (!active) return;
    const key = (event: KeyboardEvent) => {
      if (document.querySelector('[aria-modal="true"]')) return;
      handleUndoKeys(event, { undo, redo });
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });

  async function importFile(upload: File) {
    try {
      if (upload.size > MAX_FILE) throw Error("This file is too large to be a starter run.");
      let parsed: unknown;
      try {
        parsed = JSON.parse(await upload.text());
      } catch {
        throw Error("This file is not a starter run file (it is not JSON).");
      }
      setPending({ run: validateStarterRun(parsed), title: "Open this starter run? It replaces the current one. You can undo it." });
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    }
  }
  async function act(action: () => Promise<void> | void, success: string) {
    if (blocked) return;
    setBusy(true);
    setMessage("");
    try {
      await action();
      setMessage(success);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const n = current + 1;
  const mine = issues.filter((i) => i.starter === n || i.starter === 0);
  const checks: { ok: boolean; text: string }[] = [
    {
      ok: issues.length === 0,
      text: issues.length ? `${issues.length} layout problem${issues.length > 1 ? "s" : ""}: ${issues.slice(0, 4).map((i) => i.message).join(" ")}` : `Every question fits its slot on all ${d.starters.length} starter${d.starters.length > 1 ? "s" : ""}.`,
    },
    { ok: true, text: "Text is 11 pt; nothing is shrunk to fit. Each A4 sheet holds two A5 copies with a cut line." },
    { ok: true, text: "Saved answers print only in the answers copy." },
  ];
  const slotLabel = (i: number) => `Question ${i + 1}${isExtensionSlot(d.template, i) ? " (extension)" : ""}`;
  const wordAll = () => act(() => downloadStarterWord(run, "pupil"), "Word download started. Print on A4 at 100% and cut along the dashed line.");

  return (
    <div className="app-shell booklet-editor ws-editor st-editor">
      <main className="main-content" id={active ? "main-content" : undefined} tabIndex={-1}>
        <PageHeading title="Starter builder" description="Make a run of up to six silent starters. Each question keeps its type across the run, so you only change the numbers. Print two A5 copies on each A4 sheet.">
          <ResourceSaveStatus text={saveState} />
        </PageHeading>
        <section className="workspace">
          <Panel className="editor-card">
            <div className="editor-toolbar" role="group" aria-label="Resource utilities">
              <div className="tool-group" role="group" aria-label="History and reset">
                <HistoryButtons canUndo={!blocked && !!history.past.length} canRedo={!blocked && !!history.future.length} onUndo={undo} onRedo={redo} undoLabel={undoStepName(history)} redoLabel={redoStepName(history)} />
                <button className="tool-button reset-button" disabled={blocked} aria-label="Open the example starter run" onClick={() => setPending({ run: year9Run, title: "Open the example starter run? It replaces the current one. You can undo it." })}>
                  <RotateCcw size={17} aria-hidden="true" />
                  <span>Example</span>
                </button>
              </div>
              <div className="editor-copy-actions">
                <div className="editor-file-actions">
                  <button className="copy-main" disabled={blocked || issues.length > 0} title="Download every starter as Word, two copies on each A4 sheet" onClick={() => void wordAll()}>
                    {busy ? <LoaderCircle className="spin" size={17} aria-hidden="true" /> : <Download size={17} aria-hidden="true" />}
                    {busy ? "Preparing…" : "Word"}
                  </button>
                  <button className="file-menu-button" disabled={blocked} aria-label="File" aria-haspopup="menu" aria-expanded={menu} aria-controls="starter-files" onClick={() => setMenu(!menu)}>
                    File <ChevronDown size={16} aria-hidden="true" />
                  </button>
                </div>
              </div>
            </div>
            <EditorDownloadMenu
              id="starter-files"
              open={menu}
              active={active}
              onClose={() => setMenu(false)}
              onBusyChange={setBusy}
              onMessage={(m) => setMessage(m)}
              actions={[
                { label: "Download Word, all starters", action: () => downloadStarterWord(run, "pupil"), disabled: blocked || issues.length > 0, success: "Word download started." },
                { label: `Download Word, starter ${n} only`, action: () => downloadStarterWord(run, "pupil", n), disabled: blocked || mine.length > 0, success: `Word download of starter ${n} started.` },
                { label: "Download answers Word", action: () => downloadStarterWord(run, "answers"), disabled: blocked || issues.length > 0, success: "Answers Word download started. Keep it away from pupils." },
                { label: "Download PDF, all starters", action: () => downloadStarterPdf(run, "pupil"), disabled: blocked || issues.length > 0, success: "PDF download started.", separator: true },
                { label: `Download PDF, starter ${n} only`, action: () => downloadStarterPdf(run, "pupil", n), disabled: blocked || mine.length > 0, success: `PDF download of starter ${n} started.` },
                { label: "Download answers PDF", action: () => downloadStarterPdf(run, "answers"), disabled: blocked || issues.length > 0, success: "Answers PDF download started. Keep it away from pupils." },
                { label: "Save editable file", action: () => downloadEditable(run), disabled: blocked, success: `Saved ${editableName(run)}.`, separator: true },
                { label: "Open starter run file", action: () => file.current?.click(), disabled: blocked, success: "", picker: true },
              ]}
            />
            <input
              ref={file}
              type="file"
              accept=".json,application/json"
              hidden
              onChange={(e) => {
                const upload = e.target.files?.[0];
                e.target.value = "";
                if (upload) void importFile(upload);
              }}
            />
            <input
              ref={logo}
              type="file"
              accept="image/png,image/jpeg"
              hidden
              onChange={(e) => {
                const upload = e.target.files?.[0];
                e.target.value = "";
                if (upload)
                  void readLogo(upload).then(
                    (url) => patch((x) => void (x.logo = url)),
                    (err: unknown) => setMessage(err instanceof Error ? err.message : String(err)),
                  );
              }}
            />
            <div className="ws-preview-bar">
              <span className="resource-size">A5 landscape card, two on each A4 sheet</span>
              <AnswerPreviewToggle checked={answers} disabled={recovery !== null} onChange={setAnswers} />
              {printSize.controls}
            </div>
            {message && (
              <p className="ws-message" role="status">
                {message}
              </p>
            )}
            {pending && (
              <div className="ws-confirm" role="alertdialog" aria-label={pending.title}>
                <p>{pending.title}</p>
                <button
                  className="tool-button"
                  onClick={() => {
                    const next = pending.run;
                    setPending(null);
                    setSelected(0);
                    setHistory((h) => pushHistory(h, next, { label: "open file" }));
                    setMessage("");
                  }}
                >
                  Open
                </button>
                <button className="tool-button" onClick={() => setPending(null)}>
                  Cancel
                </button>
              </div>
            )}
            {recovery !== null && (
              <div className="ws-confirm" role="alertdialog" aria-label="Recover saved starter data">
                <p>The saved starter run on this device is protected. Download it before starting again.</p>
                <button className="tool-button" onClick={() => {
                    // Not through act(): the page is blocked while recovery shows, and this download is the way out.
                    downloadBlob(new Blob([recovery], { type: "application/json" }), "starters-recovered.json");
                    setMessage("Saved data downloaded.");
                  }}>
                  Download saved data
                </button>
                <button
                  className="tool-button"
                  onClick={() => {
                    let unchanged = true;
                    try {
                      unchanged = keepStored(recovery);
                    } catch {
                      // Storage is unavailable: nothing on the device can be overwritten.
                    }
                    if (!unchanged) {
                      setRecovery(localStorage.getItem(STORAGE) ?? "");
                      setMessage("Saved data changed again. Download this latest copy first.");
                      return;
                    }
                    setRecovery(null);
                    setMessage("");
                  }}
                >
                  Start again
                </button>
              </div>
            )}
            <div className="st-run" role="group" aria-label="Starters in the run">
              <table className="st-grid">
                <thead>
                  <tr>
                    <th scope="col">Question</th>
                    {d.starters.map((_, s) => (
                      <th key={s} scope="col">
                        <button className="st-pick" aria-pressed={s === current} onClick={() => setSelected(s)}>
                          Starter {s + 1}
                          {issues.some((i) => i.starter === s + 1 || i.starter === 0) ? <span className="st-flag" title="A question does not fit"> !</span> : null}
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {d.slots.map((slot, i) => (
                    <tr key={i} className={isExtensionSlot(d.template, i) ? "st-ext" : undefined}>
                      <th scope="row">
                        {i + 1}
                        {slot.name ? ` ${slot.name}` : ""}
                      </th>
                      {d.starters.map((s, k) => (
                        <td key={k} className={k === current ? "st-current" : undefined}>
                          <button className="st-cell" onClick={() => setSelected(k)} title={`Starter ${k + 1}, question ${i + 1}`}>
                            {summary(s.cards[i])}
                          </button>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className={`ws-pages${printSize.actual ? " ws-actual" : ""}`} data-testid="starter-card">
              <figure className="ws-page">
                <figcaption>Starter {n} of {d.starters.length}</figcaption>
                <div className="ws-art" style={{ width: printSize.width(STARTER.card.width) }} dangerouslySetInnerHTML={{ __html: (shown.cards[current] ?? "").replace('font-family="Inter, sans-serif"', 'font-family="MathsDock Worksheet, Inter, sans-serif"') }} />
              </figure>
            </div>
          </Panel>
          <aside className="inspector-stack" aria-label="Starter settings">
            <section className="panel-card ws-checks" aria-label="Checks">
              <h2>Checks</h2>
              <ul>
                {checks.map((c, i) => (
                  <li key={i} className={c.ok ? "ok" : "problem"}>
                    <span aria-hidden="true">{c.ok ? "✓" : "!"}</span> {c.text}
                  </li>
                ))}
              </ul>
            </section>
            <section className="panel-card ws-outline" aria-label="Starter content">
              <details className="ws-side">
                <summary>Run settings</summary>
                <Field label="Run name (for files)" value={d.title} max={80} disabled={blocked} onCommit={(v) => patch((x) => void (x.title = v))} />
                <Field label="Year or class (not printed)" value={d.group} max={40} disabled={blocked} onCommit={(v) => patch((x) => void (x.group = v))} />
                <Field label="Topic (printed in the header)" value={d.topic} max={60} disabled={blocked} onCommit={(v) => patch((x) => void (x.topic = v))} />
                <label className="ws-field">
                  <span>Template</span>
                  <select aria-label="Template" value={d.template} disabled={blocked} onChange={(e) => step(() => setTemplate(run, e.target.value as StarterTemplate))}>
                    {STARTER_TEMPLATES.map((t) => (
                      <option key={t} value={t}>
                        {TEMPLATE_NAMES[t]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="ws-check">
                  <input type="checkbox" checked={d.notation === "maths"} disabled={blocked} onChange={(e) => patch((x) => void (x.notation = e.target.checked ? "maths" : "plain"))} />
                  Maths printing: stacked {"{3/4}"}, x², a true minus and italic x
                </label>
                <div className="ws-side-settings">
                  <button className="tool-button ws-small" disabled={blocked} onClick={() => logo.current?.click()}>
                    <ImagePlus size={15} aria-hidden="true" /> {d.logo ? "Change logo" : "Add logo"}
                  </button>
                  {d.logo && (
                    <button className="tool-button ws-small" disabled={blocked} onClick={() => patch((x) => void (x.logo = null))}>
                      <Trash2 size={15} aria-hidden="true" /> Remove logo
                    </button>
                  )}
                </div>
                <p className="ws-hint">The logo is kept in this run's file only, and prints in the header's right corner.</p>
                <h3 className="st-h3">Question types</h3>
                {d.slots.map((slot, i) => (
                  <div key={i} className="st-slot">
                    <Field label={`${slotLabel(i)} type (not printed)`} value={slot.name} max={40} disabled={blocked} onCommit={(v) => patch((x) => void (x.slots[i].name = v))} />
                    <label className="ws-field">
                      <span>Icon</span>
                      <select aria-label={`${slotLabel(i)} icon`} value={slot.icon} disabled={blocked} onChange={(e) => patch((x) => void (x.slots[i].icon = e.target.value as StarterIcon))}>
                        {STARTER_ICONS.map((icon) => (
                          <option key={icon} value={icon}>
                            {ICON_NAMES[icon]}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                ))}
              </details>
              <h2>Starter {n}</h2>
              <div className="ws-card-moves" role="group" aria-label={`Starter ${n}`}>
                <button className="icon-button" aria-label={`Move starter ${n} earlier`} disabled={blocked || current === 0} onClick={() => step(() => moveStarter(run, current, -1)) && setSelected(current - 1)}>
                  <ArrowLeft size={16} aria-hidden="true" />
                </button>
                <button className="icon-button" aria-label={`Move starter ${n} later`} disabled={blocked || current === d.starters.length - 1} onClick={() => step(() => moveStarter(run, current, 1)) && setSelected(current + 1)}>
                  <ArrowRight size={16} aria-hidden="true" />
                </button>
                <button className="tool-button ws-small" disabled={blocked || d.starters.length >= 6} onClick={() => step(() => addStarter(run, current)) && setSelected(current + 1)}>
                  <Plus size={15} aria-hidden="true" /> Add a copy
                </button>
                <button className="tool-button ws-small" disabled={blocked || d.starters.length <= 1} onClick={() => step(() => removeStarter(run, current)) && setSelected(Math.max(0, current - 1))}>
                  <Trash2 size={15} aria-hidden="true" /> Remove
                </button>
              </div>
              {d.starters[current].cards.map((card, i) => {
                const setCard = (update: (c: typeof card) => void) => patch((x) => update(x.starters[current].cards[i]));
                const setItem = (path: number[], next: Item | Leaf) =>
                  setCard((c) => {
                    if (path.length === 1) c.items[path[0]] = next as Item;
                    else (c.items[path[0]] as Extract<Item, { type: "part" }>).items[path[1]] = next as Leaf;
                  });
                const name = `question ${i + 1}`;
                return (
                  <details key={`${current}-${i}`} className="ws-card" open={i === 0}>
                    <summary>
                      <span className="ws-q">{i + 1}</span> {card.title || summary(card)}
                    </summary>
                    <div className="ws-card-moves" role="group" aria-label={`Copy ${name}`}>
                      <button className="tool-button ws-small" disabled={blocked || d.starters.length < 2} title={`Put this question in every starter's slot ${i + 1}, ready to change the numbers`} onClick={() => step(() => copySlotToAll(run, current, i)) && setMessage(`Question ${i + 1} copied to every starter.`)}>
                        <Copy size={15} aria-hidden="true" /> Copy to every starter
                      </button>
                      {current > 0 && (
                        <button className="tool-button ws-small" disabled={blocked} onClick={() => step(() => copySlotFromPrevious(run, current, i))}>
                          <Copy size={15} aria-hidden="true" /> Copy from starter {current}
                        </button>
                      )}
                    </div>
                    <Field label={`Question ${i + 1} instruction`} value={card.title} max={60} disabled={blocked} onCommit={(v) => setCard((c) => void (c.title = v))} />
                    {card.items.map((item, k) =>
                      item.type === "part" ? (
                        <div key={k} className="ws-part">
                          <Field label="Part" value={item.text} max={400} multiline disabled={blocked} onCommit={(text) => setItem([k], { ...item, text })} />
                          {item.items.map((leaf, j) => (
                            <LeafEditor key={j} item={leaf} set={(next) => setItem([k, j], next)} label="" disabled={blocked} />
                          ))}
                        </div>
                      ) : (
                        <div key={k}>
                          <LeafEditor item={item} set={(next) => setItem([k], next)} label="" disabled={blocked} />
                          <BesideToggle list={card.items} index={k} disabled={blocked} set={(on) => setItem([k], withBeside(item, on))} />
                        </div>
                      ),
                    )}
                  </details>
                );
              })}
            </section>
          </aside>
        </section>
      </main>
    </div>
  );
}
