import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ChevronDown, Copy, Download, LoaderCircle, Plus, Redo2, RotateCcw, Trash2, Undo2 } from "lucide-react";
import { PageHeading, Panel } from "../site/PageHeading";
import { ResourceSaveStatus } from "../site/ResourceSaveStatus";
import { EditorDownloadMenu } from "../site/EditorDownloadMenu";
import { AnswerPreviewToggle } from "../site/AnswerPreviewToggle";
import { copyStorageKey } from "../site/copyDocument";
import { downloadBlob } from "../export/clipboard";
import {
  bookletFileName,
  lessonFileName,
  lessonPagesOf,
  issuePlace,
  singleLessonBooklet,
  renderBooklet,
  SECTION_KINDS,
  SECTION_TITLES,
  sectionTitle,
  UNNUMBERED,
  validateBooklet,
  type Booklet,
  type Card,
  type Item,
  type Lesson,
} from "../../packages/resource-core/src/index";
import { a7Booklet } from "../../packages/resource-core/src/booklet-fixtures";
import { Field, LeafEditor, WorkingField, type Leaf } from "../worksheet/fields";
import { pagesPdf } from "../worksheet/export";
import { DOCX_TYPE, wordKit } from "../export/word";
import { BookletAiPanel } from "./ai/BookletAiPanel";
import { isPlaceholder } from "./ai/make";
import * as edit from "./edit";
import "../worksheet/worksheet.css";
import "./booklet.css";

const STORAGE = copyStorageKey("maths-booklet-tools:booklet:v1");
const MAX_FILE = 4_000_000;
type BookletDoc = Booklet["document"];

function initial(): { b: Booklet; message: string; recovery: string | null } {
  try {
    const raw = localStorage.getItem(STORAGE);
    if (!raw) return { b: a7Booklet, message: "", recovery: null };
    try {
      return { b: validateBooklet(JSON.parse(raw)), message: "", recovery: null };
    } catch {
      return { b: a7Booklet, message: "Saved booklet data needs recovery. Download it before starting again.", recovery: raw };
    }
  } catch {
    return { b: a7Booklet, message: "Device storage is unavailable. Save the editable file to keep your work.", recovery: null };
  }
}

/** A list edited as lines of text: one item per line, applied on leaving the box. */
function ListField({ label, value, max, maxItems, onCommit, disabled }: { label: string; value: string[]; max: number; maxItems: number; onCommit: (v: string[]) => void; disabled?: boolean }) {
  const joined = value.join("\n");
  const [draft, setDraft] = useState(joined);
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    if (!editing) setDraft(joined);
  }, [joined, editing]);
  return (
    <label className="ws-field">
      <span>{label} (one per line)</span>
      <textarea
        rows={Math.min(6, Math.max(2, value.length + 1))}
        value={draft}
        disabled={disabled}
        onChange={(e) => {
          setEditing(true);
          setDraft(e.target.value);
        }}
        onBlur={() => {
          setEditing(false);
          const next = draft
            .split("\n")
            .map((l) => l.trim().slice(0, max))
            .filter(Boolean)
            .slice(0, maxItems);
          if (next.join("\n") !== joined) onCommit(next);
        }}
      />
    </label>
  );
}

const pdfName = (b: Booklet, view: "pupil" | "answers", lesson?: number) => (lesson === undefined ? bookletFileName(b, view) : lessonFileName(b, lesson, view));

export default function BookletPage({ active = true }: { active?: boolean }) {
  const [startup] = useState(initial);
  const [history, setHistory] = useState<{ past: Booklet[]; present: Booklet; future: Booklet[] }>({ past: [], present: startup.b, future: [] });
  const [recovery, setRecovery] = useState<string | null>(startup.recovery);
  const [message, setMessage] = useState(startup.message);
  const [saveState, setSaveState] = useState("Saved on this device");
  const [answers, setAnswers] = useState(false);
  const [menu, setMenu] = useState(false);
  const [busy, setBusy] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [pending, setPending] = useState<{ b: Booklet; title: string } | null>(null);
  const [focus, setFocus] = useState(0);
  const file = useRef<HTMLInputElement>(null);
  const pagesRef = useRef<HTMLDivElement>(null);
  const b = history.present;
  const d = b.document;
  const blocked = busy || aiBusy || recovery !== null || pending !== null;
  const shown = useMemo(() => renderBooklet(b, { view: answers ? "answers" : "pupil" }), [b, answers]);
  const issues = shown.issues;

  function commit(next: Booklet) {
    if (recovery !== null) return;
    try {
      const valid = validateBooklet(next);
      setHistory((h) => (JSON.stringify(h.present) === JSON.stringify(valid) ? h : { past: [...h.past, h.present].slice(-60), present: valid, future: [] }));
      setMessage("");
    } catch (e) {
      // Invalid edits are refused with the specific reason; the last valid booklet stays.
      setMessage(e instanceof Error ? e.message : String(e));
    }
  }
  function apply(f: (b: Booklet) => Booklet) {
    if (!blocked) commit(f(b));
  }
  function patch(update: (doc: BookletDoc) => void) {
    if (blocked) return;
    const next = structuredClone(b);
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
      if (upload.size > MAX_FILE) throw Error("This file is too large to be a booklet.");
      let parsed: unknown;
      try {
        parsed = JSON.parse(await upload.text());
      } catch {
        throw Error("This file is not a booklet file (it is not JSON).");
      }
      if ((parsed as { document?: { kind?: string } })?.document?.kind === "worksheet-a3") throw Error("This is a worksheet file. Open it on the Worksheets page.");
      setPending({ b: validateBooklet(parsed), title: "Open this booklet? It replaces the current one. You can undo it." });
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
  async function downloadPdf(view: "pupil" | "answers", lesson?: number) {
    const r = lesson === undefined ? renderBooklet(b, { view }) : lessonPagesOf(b, lesson, { view });
    if (r.issues.length) throw Error("Fix the layout checks before downloading.");
    const pages = r.pages;
    downloadBlob(await pagesPdf(pages, d.title), pdfName(b, view, lesson));
  }
  /** The Word file: the same pages as the PDF, written here with the connector's own writer. */
  async function downloadWord(view: "pupil" | "answers", lesson?: number) {
    const one = lesson === undefined ? null : singleLessonBooklet(b, lesson);
    const [{ writeBookletDocx }, kit] = await Promise.all([import("../../packages/resource-core/src/booklet-docx"), wordKit()]);
    const r = await writeBookletDocx(one ? one.booklet : b, { view, numbering: one?.numbering, fonts: kit.fonts, picture: kit.picture, version: "MathsDock booklet renderer, Word output 1" });
    if (r.issues.length) throw Error("Fix the layout checks before downloading.");
    downloadBlob(new Blob([r.bytes as BlobPart], { type: DOCX_TYPE }), pdfName(b, view, lesson).replace(/\.pdf$/, ".docx"));
  }
  const editableName = () => bookletFileName(b).replace(/_A4\.pdf$/, ".json");
  const showPage = (page: number) => pagesRef.current?.querySelector(`#bk-page-${page}`)?.scrollIntoView({ behavior: "smooth", block: "start" });

  const placeholders = d.lessons.filter(isPlaceholder).length;
  const checks: { ok: boolean; text: string }[] = [
    {
      ok: issues.length === 0,
      text: issues.length ? `${issues.length} layout problem${issues.length > 1 ? "s" : ""}: ${issues.slice(0, 4).map((i) => `${issuePlace(i)}: ${i.message}`).join(" ")}` : `Lays out on ${shown.pages.length} A4 pages; no card is split or cut off.`,
    },
    { ok: placeholders === 0, text: placeholders ? `${placeholders} lesson${placeholders > 1 ? "s" : ""} not made yet: rebuild under Change a lesson.` : "Every lesson is made." },
    { ok: true, text: "Text is 11 pt with nothing below 10 pt; nothing is shrunk to fit." },
    { ok: true, text: "Saved answers print only in the answers PDF and Word file." },
  ];

  const lessonEditor = (lesson: Lesson, li: number): ReactNode => {
    const setLesson = (f: (l: Lesson) => void) => patch((x) => f(x.lessons[li]));
    return (
      <details key={li} className="ws-side bk-lesson" open={focus === li} onToggle={(e) => (e.currentTarget as HTMLDetailsElement).open && setFocus(li)}>
        <summary>
          <span className="ws-q">{li + 1}</span> {lesson.title}
          {isPlaceholder(lesson) && <em className="bk-tag"> not made yet</em>}
        </summary>
        <div className="ws-card-moves" role="group" aria-label={`Lesson ${li + 1}`}>
          <button className="icon-button" aria-label={`Move lesson ${li + 1} up`} disabled={blocked || li === 0} onClick={() => apply((x) => edit.moveLesson(x, li, li - 1))}>
            <ArrowUp size={16} aria-hidden="true" />
          </button>
          <button className="icon-button" aria-label={`Move lesson ${li + 1} down`} disabled={blocked || li === d.lessons.length - 1} onClick={() => apply((x) => edit.moveLesson(x, li, li + 1))}>
            <ArrowDown size={16} aria-hidden="true" />
          </button>
          <button className="icon-button" aria-label={`Duplicate lesson ${li + 1}`} disabled={blocked || d.lessons.length >= 12} onClick={() => apply((x) => edit.duplicateLesson(x, li))}>
            <Copy size={16} aria-hidden="true" />
          </button>
          <button className="icon-button" aria-label={`Delete lesson ${li + 1}`} disabled={blocked || d.lessons.length < 2} onClick={() => apply((x) => edit.removeLesson(x, li))}>
            <Trash2 size={16} aria-hidden="true" />
          </button>
          <button className="tool-button bk-small" disabled={recovery !== null} onClick={() => showPage(shown.lessonPages[li])}>
            Show page {shown.lessonPages[li]}
          </button>
          <button className="tool-button bk-small" disabled={blocked || issues.length > 0} onClick={() => void run(() => downloadPdf("pupil", li), `Lesson ${li + 1} PDF download started.`)}>
            <Download size={15} aria-hidden="true" /> Lesson PDF
          </button>
          <button className="tool-button bk-small" disabled={blocked || issues.length > 0} onClick={() => void run(() => downloadWord("pupil", li), `Lesson ${li + 1} Word file download started.`)}>
            <Download size={15} aria-hidden="true" /> Lesson Word
          </button>
        </div>
        <Field label={`Lesson ${li + 1} title`} value={lesson.title} max={80} disabled={blocked} onCommit={(v) => setLesson((l) => void (l.title = v))} />
        <div className="ws-line-edit">
          <Field label="Objective code" value={lesson.code} max={16} disabled={blocked} onCommit={(v) => setLesson((l) => void (l.code = v))} />
        </div>
        <Field label="Objective" value={lesson.objective} max={200} multiline disabled={blocked} onCommit={(v) => setLesson((l) => void (l.objective = v))} />
        <Field label="Key idea" value={lesson.keyIdea} max={500} multiline disabled={blocked} onCommit={(v) => setLesson((l) => void (l.keyIdea = v))} />
        <details className="bk-notes">
          <summary>Teacher notes (not printed)</summary>
          <label className="ws-field">
            <span>Lesson plan, misconceptions and fading</span>
            <textarea
              rows={6}
              defaultValue={lesson.teacherNotes}
              key={lesson.teacherNotes}
              maxLength={6000}
              disabled={blocked}
              onBlur={(e) => e.target.value !== lesson.teacherNotes && setLesson((l) => void (l.teacherNotes = e.target.value))}
            />
          </label>
        </details>
        {lesson.sections.map((section, si) => {
          const numbered = !UNNUMBERED.has(section.kind);
          return (
            <div key={si} className="ws-column bk-section">
              <div className="bk-section-head">
                <strong>{sectionTitle(section)}</strong>
                <div className="ws-card-moves" role="group" aria-label={`Section ${sectionTitle(section)}`}>
                  <button className="icon-button" aria-label={`Move section ${si + 1} of lesson ${li + 1} up`} disabled={blocked || si === 0} onClick={() => apply((x) => edit.moveSection(x, li, si, si - 1))}>
                    <ArrowUp size={15} aria-hidden="true" />
                  </button>
                  <button className="icon-button" aria-label={`Move section ${si + 1} of lesson ${li + 1} down`} disabled={blocked || si === lesson.sections.length - 1} onClick={() => apply((x) => edit.moveSection(x, li, si, si + 1))}>
                    <ArrowDown size={15} aria-hidden="true" />
                  </button>
                  <button className="icon-button" aria-label={`Delete section ${si + 1} of lesson ${li + 1}`} disabled={blocked || lesson.sections.length < 2} onClick={() => apply((x) => edit.removeSection(x, li, si))}>
                    <Trash2 size={15} aria-hidden="true" />
                  </button>
                </div>
              </div>
              <div className="ws-line-edit">
                <label className="ws-field">
                  <span>Kind</span>
                  <select value={section.kind} disabled={blocked} onChange={(e) => setLesson((l) => void (l.sections[si].kind = e.target.value as (typeof SECTION_KINDS)[number]))}>
                    {SECTION_KINDS.map((k) => (
                      <option key={k} value={k}>
                        {SECTION_TITLES[k]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="ws-field">
                  <span>Cards per row</span>
                  <select value={section.columns} disabled={blocked} onChange={(e) => setLesson((l) => void (l.sections[si].columns = Number(e.target.value) as 1 | 2))}>
                    <option value={2}>Two</option>
                    <option value={1}>One (full width)</option>
                  </select>
                </label>
              </div>
              <Field label="Heading (empty uses the kind)" value={section.title} max={60} disabled={blocked} onCommit={(v) => setLesson((l) => void (l.sections[si].title = v))} />
              <Field label="Instruction line" value={section.instruction} max={160} disabled={blocked} onCommit={(v) => setLesson((l) => void (l.sections[si].instruction = v))} />
              {section.cards.map((card, ci) => {
                const label = numbered ? String(ci + 1) : "•";
                const setItem = (path: number[], next: Item | Leaf) =>
                  setLesson((l) => {
                    const items = l.sections[si].cards[ci].items;
                    if (path.length === 1) items[path[0]] = next as Item;
                    else (items[path[0]] as Extract<Item, { type: "part" }>).items[path[1]] = next as Leaf;
                  });
                return (
                  <details key={ci} className="ws-card">
                    <summary>
                      <span className="ws-q">{label}</span> {card.title || "(untitled)"}
                    </summary>
                    <div className="ws-card-moves" role="group" aria-label={`Card ${card.title}`}>
                      <button className="icon-button" aria-label={`Move ${card.title} up`} disabled={blocked || (ci === 0 && si === 0)} onClick={() => apply((x) => (ci === 0 ? edit.moveCardAcross(x, li, si, ci, -1) : edit.moveCardIn(x, li, si, ci, ci - 1)))}>
                        <ArrowUp size={15} aria-hidden="true" />
                      </button>
                      <button
                        className="icon-button"
                        aria-label={`Move ${card.title} down`}
                        disabled={blocked || (ci === section.cards.length - 1 && si === lesson.sections.length - 1)}
                        onClick={() => apply((x) => (ci === section.cards.length - 1 ? edit.moveCardAcross(x, li, si, ci, 1) : edit.moveCardIn(x, li, si, ci, ci + 1)))}
                      >
                        <ArrowDown size={15} aria-hidden="true" />
                      </button>
                      <button className="icon-button" aria-label={`Duplicate ${card.title}`} disabled={blocked || section.cards.length >= 16} onClick={() => apply((x) => edit.duplicateCard(x, li, si, ci))}>
                        <Copy size={15} aria-hidden="true" />
                      </button>
                      <button className="icon-button" aria-label={`Delete ${card.title}`} disabled={blocked || section.cards.length < 2} onClick={() => apply((x) => edit.removeCard(x, li, si, ci))}>
                        <Trash2 size={15} aria-hidden="true" />
                      </button>
                    </div>
                    <Field label="Card title" value={card.title} max={60} disabled={blocked} onCommit={(v) => setLesson((l) => void (l.sections[si].cards[ci].title = v))} />
                    {card.items.map((item, i) =>
                      item.type === "part" ? (
                        <div key={i} className="ws-part">
                          <Field label={`Part ${String.fromCharCode(97 + card.items.slice(0, i).filter((x) => x.type === "part").length)}`} value={item.text} max={400} multiline disabled={blocked} onCommit={(text) => setItem([i], { ...item, text })} />
                          {item.items.map((leaf, j) => (
                            <div key={j}>
                              <LeafEditor item={leaf} set={(next) => setItem([i, j], next)} label="" disabled={blocked} />
                            </div>
                          ))}
                          <WorkingField
                            label="Part hidden working"
                            value={item.working}
                            disabled={blocked}
                            onCommit={(v) =>
                              setLesson((l) => {
                                const part = l.sections[si].cards[ci].items[i] as Extract<Item, { type: "part" }>;
                                if (v === undefined) delete part.working;
                                else part.working = v;
                              })
                            }
                          />
                        </div>
                      ) : (
                        <div key={i}>
                          <LeafEditor item={item} set={(next) => setItem([i], next)} label="" disabled={blocked} />
                        </div>
                      ),
                    )}
                    <WorkingField
                      label="Card hidden working"
                      value={card.working}
                      disabled={blocked}
                      onCommit={(v) =>
                        setLesson((l) => {
                          const cd = l.sections[si].cards[ci];
                          if (v === undefined) delete cd.working;
                          else cd.working = v;
                        })
                      }
                    />
                  </details>
                );
              })}
              <button
                className="tool-button bk-small"
                disabled={blocked || section.cards.length >= 16}
                onClick={() => apply((x) => edit.addCard(x, li, si, { title: "New question", items: [{ type: "text", text: "Write the question here." }, { type: "space", kind: "working", heightMm: 20 }] } as Card))}
              >
                <Plus size={15} aria-hidden="true" /> Add a card
              </button>
            </div>
          );
        })}
      </details>
    );
  };

  return (
    <div className="app-shell booklet-editor ws-editor bk-editor">
      <main className="main-content" id={active ? "main-content" : undefined} tabIndex={-1}>
        <PageHeading title="Booklets" description="Make an A4 unit booklet from a scheme of work unit with your own AI key: a check-in, worked examples, practice and diagnostics for every lesson. Edit any question and download the pupil and answers PDFs or Word files.">
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
                <button className="tool-button reset-button" disabled={blocked} aria-label="Open the example booklet" onClick={() => setPending({ b: a7Booklet, title: "Open the example booklet? It replaces the current one. You can undo it." })}>
                  <RotateCcw size={17} aria-hidden="true" />
                  <span>Example</span>
                </button>
              </div>
              <div className="editor-copy-actions">
                <div className="editor-file-actions">
                  <button className="copy-main" disabled={blocked || issues.length > 0} title="Download the pupil booklet (A4 PDF)" onClick={() => void run(() => downloadPdf("pupil"), `Pupil booklet download started: ${shown.pages.length} A4 pages. Print at 100%, double-sided, flip on the long edge.`)}>
                    {busy ? <LoaderCircle className="spin" size={17} aria-hidden="true" /> : <Download size={17} aria-hidden="true" />}
                    {busy ? "Preparing…" : "Pupil PDF"}
                  </button>
                  <button className="file-menu-button" disabled={blocked} aria-label="File" aria-haspopup="menu" aria-expanded={menu} aria-controls="booklet-files" onClick={() => setMenu(!menu)}>
                    File <ChevronDown size={16} aria-hidden="true" />
                  </button>
                </div>
              </div>
            </div>
            <EditorDownloadMenu
              id="booklet-files"
              open={menu}
              active={active}
              onClose={() => setMenu(false)}
              onBusyChange={setBusy}
              onMessage={(m) => setMessage(m)}
              actions={[
                { label: "Download pupil PDF", action: () => downloadPdf("pupil"), disabled: blocked || issues.length > 0, success: "Pupil booklet download started." },
                { label: "Download answers PDF", action: () => downloadPdf("answers"), disabled: blocked || issues.length > 0, success: "Answers booklet download started. Keep it away from pupils." },
                { label: "Download pupil Word file", action: () => downloadWord("pupil"), disabled: blocked || issues.length > 0, success: "Pupil Word file download started: laid out page for page like the PDF, for small edits in Word.", separator: true },
                { label: "Download answers Word file", action: () => downloadWord("answers"), disabled: blocked || issues.length > 0, success: "Answers Word file download started. Keep it away from pupils. Editing it does not change the pupil file." },
                { label: "Save editable file", action: () => downloadBlob(new Blob([JSON.stringify(b, null, 2)], { type: "application/json" }), editableName()), disabled: blocked, success: `Saved ${editableName()}.`, separator: true },
                { label: "Open booklet file", action: () => file.current?.click(), disabled: blocked, success: "", picker: true },
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
              <span className="resource-size">
                A4 portrait, {shown.pages.length} pages
              </span>
              <span className="bk-jump">
                <select
                  aria-label="Go to a page"
                  value=""
                  onChange={(e) => {
                    const page = Number(e.target.value);
                    if (page) showPage(page);
                  }}
                >
                  <option value="">Go to…</option>
                  <option value={1}>Cover and contents</option>
                  {shown.introPage && <option value={shown.introPage}>Unit introduction</option>}
                  {d.lessons.map((l, i) => (
                    <option key={i} value={shown.lessonPages[i]}>
                      Lesson {i + 1}: {l.title}
                    </option>
                  ))}
                </select>
              </span>
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
                    const next = pending.b;
                    setPending(null);
                    setHistory((h) => ({ past: [...h.past, h.present].slice(-60), present: next, future: [] }));
                    setFocus(0);
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
              <div className="ws-confirm" role="alertdialog" aria-label="Recover saved booklet data">
                <p>The saved booklet on this device could not be read. Download it before starting again.</p>
                <button className="tool-button" onClick={() => void run(() => downloadBlob(new Blob([recovery], { type: "application/json" }), "booklet-recovered.json"), "Saved data downloaded.")}>
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
            <div className="bk-pages" data-testid="booklet-pages" ref={pagesRef}>
              {shown.pages.map((svg, i) => (
                <figure key={i} className="ws-page bk-page" id={`bk-page-${i + 1}`}>
                  <figcaption>Page {i + 1}</figcaption>
                  <div className="ws-art" dangerouslySetInnerHTML={{ __html: svg.replace('font-family="Inter, sans-serif"', 'font-family="MathsDock Worksheet, Inter, sans-serif"') }} />
                </figure>
              ))}
            </div>
          </Panel>
          <aside className="inspector-stack bk-outline" aria-label="Booklet settings">
            <BookletAiPanel
              current={b}
              focusLesson={focus}
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
            <section className="panel-card ws-outline" aria-label="Booklet content">
              <h2>Cover</h2>
              <Field label="Title" value={d.title} max={80} disabled={blocked} onCommit={(v) => patch((x) => void (x.title = v))} />
              <div className="ws-line-edit">
                <Field label="Unit code" value={d.code} max={16} disabled={blocked} onCommit={(v) => patch((x) => void (x.code = v))} />
                <Field label="Year or tier" value={d.group} max={40} disabled={blocked} onCommit={(v) => patch((x) => void (x.group = v))} />
              </div>
              <Field label="Cover note" value={d.coverNote} max={240} multiline disabled={blocked} onCommit={(v) => patch((x) => void (x.coverNote = v))} />
              <label className="ws-check">
                <input type="checkbox" checked={d.nameLine} disabled={blocked} onChange={(e) => patch((x) => void (x.nameLine = e.target.checked))} /> Name and class lines
              </label>
              <label className="ws-check">
                <input type="checkbox" checked={d.notation !== "plain"} disabled={blocked} onChange={(e) => patch((x) => void (x.notation = e.target.checked ? "maths" : "plain"))} /> Stacked fractions: {"{3/4}"} prints as a fraction
              </label>
              <label className="ws-check">
                <input type="checkbox" checked={d.notation === "typeset"} disabled={blocked} onChange={(e) => patch((x) => void (x.notation = e.target.checked ? "typeset" : "maths"))} /> Print maths as on a paper: x^2 as x², a true minus, {"<="} as ≤, italic x
              </label>
              <details className="ws-side">
                <summary>Unit introduction</summary>
                <label className="ws-check">
                  <input type="checkbox" checked={d.intro !== null} disabled={blocked} onChange={(e) => patch((x) => void (x.intro = e.target.checked ? { remember: [], learn: [], next: [], keywords: [] } : null))} /> Include a unit introduction page
                </label>
                {d.intro && (
                  <>
                    <ListField label="What do I need to remember?" value={d.intro.remember} max={120} maxItems={8} disabled={blocked} onCommit={(v) => patch((x) => void (x.intro!.remember = v))} />
                    <ListField label="What will I learn?" value={d.intro.learn} max={120} maxItems={8} disabled={blocked} onCommit={(v) => patch((x) => void (x.intro!.learn = v))} />
                    <ListField label="How does this progress?" value={d.intro.next} max={120} maxItems={8} disabled={blocked} onCommit={(v) => patch((x) => void (x.intro!.next = v))} />
                    <h3 className="bk-sub">Key words</h3>
                    {d.intro.keywords.map((k, i) => (
                      <div key={i} className="bk-keyword">
                        <Field label={`Word ${i + 1}`} value={k.word} max={40} disabled={blocked} onCommit={(v) => patch((x) => void (x.intro!.keywords[i].word = v))} />
                        <Field label="Meaning" value={k.meaning} max={160} disabled={blocked} onCommit={(v) => patch((x) => void (x.intro!.keywords[i].meaning = v))} />
                        <button className="icon-button" aria-label={`Remove key word ${i + 1}`} disabled={blocked} onClick={() => patch((x) => void x.intro!.keywords.splice(i, 1))}>
                          <Trash2 size={15} aria-hidden="true" />
                        </button>
                      </div>
                    ))}
                    <button className="tool-button bk-small" disabled={blocked || d.intro.keywords.length >= 16} onClick={() => patch((x) => void x.intro!.keywords.push({ word: "Word", meaning: "Its meaning." }))}>
                      <Plus size={15} aria-hidden="true" /> Add a key word
                    </button>
                  </>
                )}
              </details>
              <h2>Lessons</h2>
              {d.lessons.map(lessonEditor)}
            </section>
          </aside>
        </section>
      </main>
    </div>
  );
}
