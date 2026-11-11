import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, ChevronDown, Download, LoaderCircle, Redo2, RotateCcw, Undo2 } from "lucide-react";
import { PageHeading, Panel } from "../site/PageHeading";
import { ResourceSaveStatus } from "../site/ResourceSaveStatus";
import { EditorDownloadMenu } from "../site/EditorDownloadMenu";
import { AnswerPreviewToggle } from "../site/AnswerPreviewToggle";
import { copyStorageKey } from "../site/copyDocument";
import { downloadBlob } from "../export/clipboard";
import { fileName, renderResource, stageLetters, validate, type Item, type Resource } from "../../packages/resource-core/src/index";
import { treeDiagrams } from "../../packages/resource-core/src/fixtures";
import { Field, LeafEditor, type Leaf } from "./fields";
import { downloadEditable, downloadPdf, editableName } from "./export";
import { moveCard, type Move } from "./edit";
import { AiPanel } from "./ai/AiPanel";
import "./worksheet.css";

const STORAGE = copyStorageKey("maths-booklet-tools:worksheet:v1");
const MAX_FILE = 400_000;

function initial(): { r: Resource; message: string; recovery: string | null } {
  try {
    const raw = localStorage.getItem(STORAGE);
    if (!raw) return { r: treeDiagrams, message: "", recovery: null };
    try {
      return { r: validate(JSON.parse(raw)), message: "", recovery: null };
    } catch {
      return { r: treeDiagrams, message: "Saved worksheet data needs recovery. Download it before starting again.", recovery: raw };
    }
  } catch {
    return { r: treeDiagrams, message: "Device storage is unavailable. Save the editable file to keep your work.", recovery: null };
  }
}

export default function WorksheetPage({ active = true }: { active?: boolean }) {
  const [startup] = useState(initial);
  const [history, setHistory] = useState<{ past: Resource[]; present: Resource; future: Resource[] }>({ past: [], present: startup.r, future: [] });
  const [recovery, setRecovery] = useState<string | null>(startup.recovery);
  const [message, setMessage] = useState(startup.message);
  const [saveState, setSaveState] = useState("Saved on this device");
  const [answers, setAnswers] = useState(false);
  const [menu, setMenu] = useState(false);
  const [busy, setBusy] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [pending, setPending] = useState<{ r: Resource; title: string } | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const r = history.present;
  const blocked = busy || aiBusy || recovery !== null || pending !== null;
  const shown = useMemo(() => renderResource(r, { view: answers ? "answers" : "pupil" }), [r, answers]);
  const issues = shown.issues;

  function commit(next: Resource) {
    if (recovery !== null) return;
    try {
      const valid = validate(next);
      setHistory((h) => (JSON.stringify(h.present) === JSON.stringify(valid) ? h : { past: [...h.past, h.present].slice(-80), present: valid, future: [] }));
      setMessage("");
    } catch (e) {
      // Invalid drafts are refused with the specific reason; the last valid sheet stays.
      setMessage(e instanceof Error ? e.message : String(e));
    }
  }
  function patch(update: (d: Resource["document"]) => void) {
    if (blocked) return;
    const next = structuredClone(r);
    update(next.document);
    commit(next);
  }
  const undo = () => !blocked && setHistory((h) => (h.past.length ? { past: h.past.slice(0, -1), present: h.past[h.past.length - 1], future: [h.present, ...h.future] } : h));
  const redo = () => !blocked && setHistory((h) => (h.future.length ? { past: [...h.past, h.present], present: h.future[0], future: h.future.slice(1) } : h));

  useEffect(() => {
    if (recovery !== null) return;
    try {
      localStorage.setItem(STORAGE, JSON.stringify(history.present));
      setSaveState("Saved on this device");
    } catch {
      setSaveState("Save unavailable — download editable file");
    }
  }, [history.present, recovery]);
  useEffect(() => {
    if (!active) return;
    const key = (event: KeyboardEvent) => {
      if (document.querySelector('[aria-modal="true"]')) return;
      if (!(event.ctrlKey || event.metaKey) || (event.target instanceof HTMLElement && event.target.closest("input,textarea,select,[contenteditable]"))) return;
      const k = event.key.toLowerCase();
      if (k === "z") {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
      } else if (k === "y") {
        event.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });

  async function importFile(upload: File) {
    try {
      if (upload.size > MAX_FILE) throw Error("This file is too large to be a worksheet.");
      let parsed: unknown;
      try {
        parsed = JSON.parse(await upload.text());
      } catch {
        throw Error("This file is not a worksheet file (it is not JSON).");
      }
      setPending({ r: validate(parsed), title: "Open this worksheet? It replaces the current one. You can undo it." });
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    }
  }
  async function run(action: () => Promise<void> | void, success: string) {
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
  const move = (side: number, column: number, card: number, how: Move) => {
    if (blocked) return;
    const next = moveCard(r, side, column, card, how);
    if (next) commit(next);
  };

  const d = r.document;
  let number = 0;
  const letters = stageLetters(r);
  const checks: { ok: boolean; text: string }[] = [
    { ok: issues.length === 0, text: issues.length ? `${issues.length} layout problem${issues.length > 1 ? "s" : ""}: ${issues.map((i) => i.message).join(" ")}` : "Fits exactly two A3 sides; no card is split or cut off." },
    { ok: true, text: "Text is 11 pt with nothing below 10 pt; nothing is shrunk to fit." },
    { ok: true, text: "Saved answers print only in the answers PDF." },
    { ok: d.code.trim() !== "" && d.objective.trim() !== "", text: d.code.trim() && d.objective.trim() ? `Files are named ${fileName(r)}.` : "Add the objective code and objective so the files are named by the guide." },
  ];

  const leafEditor = (item: Leaf, set: (next: Leaf) => void, label: string): ReactNode => <LeafEditor item={item} set={set} label={label} disabled={blocked} />;

  return (
    <div className="app-shell booklet-editor ws-editor">
      <main className="main-content" id={active ? "main-content" : undefined} tabIndex={-1}>
        <PageHeading title="Worksheets" description="Make an A3 worksheet from a learning objective with your own AI key, or open a worksheet file. Change its wording and answer spaces, and download the A3 PDFs.">
          <ResourceSaveStatus text={saveState} />
        </PageHeading>
        <section className="workspace">
          <Panel className="editor-card">
            <div className="editor-toolbar" role="group" aria-label="Resource utilities">
              <div className="tool-group" role="group" aria-label="History and reset">
                <button className="icon-button" disabled={blocked || !history.past.length} aria-label="Undo" title="Undo (Ctrl+Z)" onClick={undo}>
                  <Undo2 size={18} aria-hidden="true" />
                </button>
                <button className="icon-button" disabled={blocked || !history.future.length} aria-label="Redo" title="Redo (Ctrl+Y)" onClick={redo}>
                  <Redo2 size={18} aria-hidden="true" />
                </button>
                <button className="tool-button reset-button" disabled={blocked} aria-label="Open the example worksheet" onClick={() => setPending({ r: treeDiagrams, title: "Open the example worksheet? It replaces the current one. You can undo it." })}>
                  <RotateCcw size={17} aria-hidden="true" />
                  <span>Example</span>
                </button>
              </div>
              <div className="editor-copy-actions">
                <div className="editor-file-actions">
                  <button className="copy-main" disabled={blocked || issues.length > 0} title="Download the pupil PDF (A3, two sides)" onClick={() => void run(() => downloadPdf(r, "pupil"), "Pupil PDF download started. Print on A3 at 100%, double-sided, flip on the short edge.")}>
                    {busy ? <LoaderCircle className="spin" size={17} aria-hidden="true" /> : <Download size={17} aria-hidden="true" />}
                    {busy ? "Preparing…" : "Pupil PDF"}
                  </button>
                  <button className="file-menu-button" disabled={blocked} aria-label="File" aria-haspopup="menu" aria-expanded={menu} aria-controls="worksheet-files" onClick={() => setMenu(!menu)}>
                    File <ChevronDown size={16} aria-hidden="true" />
                  </button>
                </div>
              </div>
            </div>
            <EditorDownloadMenu
              id="worksheet-files"
              open={menu}
              active={active}
              onClose={() => setMenu(false)}
              onBusyChange={setBusy}
              onMessage={(m) => setMessage(m)}
              actions={[
                { label: "Download pupil PDF", action: () => downloadPdf(r, "pupil"), disabled: blocked || issues.length > 0, success: "Pupil PDF download started." },
                { label: "Download answers PDF", action: () => downloadPdf(r, "answers"), disabled: blocked || issues.length > 0, success: "Answers PDF download started. Keep it away from pupils." },
                { label: "Save editable file", action: () => downloadEditable(r), disabled: blocked, success: `Saved ${editableName(r)}.`, separator: true },
                { label: "Open worksheet file", action: () => file.current?.click(), disabled: blocked, success: "", picker: true },
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
            <div className="ws-preview-bar">
              <span className="resource-size">A3 landscape, 2 sides</span>
              <AnswerPreviewToggle checked={answers} disabled={recovery !== null} onChange={setAnswers} />
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
                    const next = pending.r;
                    setPending(null);
                    setHistory((h) => ({ past: [...h.past, h.present].slice(-80), present: next, future: [] }));
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
              <div className="ws-confirm" role="alertdialog" aria-label="Recover saved worksheet data">
                <p>The saved worksheet on this device could not be read. Download it before starting again.</p>
                <button className="tool-button" onClick={() => void run(() => downloadBlob(new Blob([recovery], { type: "application/json" }), "worksheet-recovered.json"), "Saved data downloaded.")}>
                  Download saved data
                </button>
                <button
                  className="tool-button"
                  onClick={() => {
                    setRecovery(null);
                    setMessage("");
                  }}
                >
                  Start again
                </button>
              </div>
            )}
            <div className="ws-pages" data-testid="worksheet-pages">
              {shown.pages.map((svg, i) => (
                <figure key={i} className="ws-page">
                  <figcaption>Side {i + 1}</figcaption>
                  <div className="ws-art" dangerouslySetInnerHTML={{ __html: svg.replace('font-family="Inter, sans-serif"', 'font-family="MathsDock Worksheet, Inter, sans-serif"') }} />
                </figure>
              ))}
            </div>
          </Panel>
          <aside className="inspector-stack" aria-label="Worksheet settings">
            <AiPanel
              current={r}
              disabled={busy || recovery !== null || pending !== null}
              onBusyChange={setAiBusy}
              onApply={(next, note) => {
                commit(next);
                setMessage(note);
              }}
            />
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
            <section className="panel-card ws-outline" aria-label="Worksheet content">
              <h2>Header</h2>
              <Field label="Title" value={d.title} max={80} disabled={blocked} onCommit={(v) => patch((x) => void (x.title = v))} />
              <Field label="Objective code" value={d.code} max={16} disabled={blocked} onCommit={(v) => patch((x) => void (x.code = v))} />
              <Field label="Objective" value={d.objective} max={200} multiline disabled={blocked} onCommit={(v) => patch((x) => void (x.objective = v))} />
              <Field label="Year or tier" value={d.group} max={40} disabled={blocked} onCommit={(v) => patch((x) => void (x.group = v))} />
              {d.sides.map((side, s) => (
                <details key={s} className="ws-side" open={s === 0}>
                  <summary>Side {s + 1}</summary>
                  <Field label="Instruction line" value={side.instruction} max={160} disabled={blocked} onCommit={(v) => patch((x) => void (x.sides[s].instruction = v))} />
                  {side.columns.map((col, c) => (
                    <div key={c} className="ws-column">
                      <Field label={`Column ${letters.columns[s][c]} heading`} value={col.heading} max={40} disabled={blocked} onCommit={(v) => patch((x) => void (x.sides[s].columns[c].heading = v))} />
                      {col.cards.map((card, k) => {
                        const q = ++number;
                        const setItem = (path: number[], next: Item | Leaf) =>
                          patch((x) => {
                            const items = x.sides[s].columns[c].cards[k].items;
                            if (path.length === 1) items[path[0]] = next as Item;
                            else (items[path[0]] as Extract<Item, { type: "part" }>).items[path[1]] = next as Leaf;
                          });
                        const linear = d.sides.slice(0, s).reduce((t, x) => t + x.columns.length, 0) + c;
                        return (
                          <details key={k} className="ws-card">
                            <summary>
                              <span className="ws-q">{q}</span> {card.title}
                            </summary>
                            <div className="ws-card-moves" role="group" aria-label={`Move question ${q}`}>
                              <button className="icon-button" aria-label={`Move question ${q} up`} disabled={blocked || k === 0} onClick={() => move(s, c, k, "up")}>
                                <ArrowUp size={16} aria-hidden="true" />
                              </button>
                              <button className="icon-button" aria-label={`Move question ${q} down`} disabled={blocked || k === col.cards.length - 1} onClick={() => move(s, c, k, "down")}>
                                <ArrowDown size={16} aria-hidden="true" />
                              </button>
                              <button className="icon-button" aria-label={`Move question ${q} to the previous column`} disabled={blocked || linear === 0} onClick={() => move(s, c, k, "previous")}>
                                <ArrowLeft size={16} aria-hidden="true" />
                              </button>
                              <button className="icon-button" aria-label={`Move question ${q} to the next column`} disabled={blocked || linear === d.sides.reduce((t, x) => t + x.columns.length, 0) - 1} onClick={() => move(s, c, k, "next")}>
                                <ArrowRight size={16} aria-hidden="true" />
                              </button>
                            </div>
                            <Field label={`Question ${q} title`} value={card.title} max={60} disabled={blocked} onCommit={(v) => patch((x) => void (x.sides[s].columns[c].cards[k].title = v))} />
                            {card.items.map((item, i) =>
                              item.type === "part" ? (
                                <div key={i} className="ws-part">
                                  <Field label={`Part ${String.fromCharCode(97 + card.items.slice(0, i).filter((x) => x.type === "part").length)}`} value={item.text} max={400} multiline disabled={blocked} onCommit={(text) => setItem([i], { ...item, text })} />
                                  {item.items.map((leaf, j) => (
                                    <div key={j}>{leafEditor(leaf, (next) => setItem([i, j], next), "")}</div>
                                  ))}
                                </div>
                              ) : (
                                <div key={i}>{leafEditor(item, (next) => setItem([i], next), "")}</div>
                              ),
                            )}
                          </details>
                        );
                      })}
                    </div>
                  ))}
                </details>
              ))}
            </section>
          </aside>
        </section>
      </main>
    </div>
  );
}
