import { useDeferredValue, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ChevronDown, Copy, Download, LibraryBig, LoaderCircle, Plus, RotateCcw, Trash2, X } from "lucide-react";
import { siteBase } from "../site/routes";
import { PageHeading, Panel } from "../site/PageHeading";
import { ResourceSaveStatus } from "../site/ResourceSaveStatus";
import { EditorDownloadMenu } from "../site/EditorDownloadMenu";
import { AnswerPreviewToggle } from "../site/AnswerPreviewToggle";
import { copyStorageKey } from "../site/copyDocument";
import { downloadBlob } from "../export/clipboard";
import {
  A4,
  bookletFileName,
  lessonFileName,
  lessonNotesFileName,
  lessonPagesOf,
  renderLessonNotes,
  issuePlace,
  singleLessonBooklet,
  renderBooklet,
  SECTION_KINDS,
  SECTION_TITLES,
  sectionTitle,
  lessonLabels,
  lessonShift,
  validateBooklet,
  lessonChecks,
  type Booklet,
  type CardSpot,
  type LessonSource,
  type Card,
  type Item,
  type Lesson,
  type Numbering,
} from "../../packages/resource-core/src/index";
import { a7Booklet } from "../../packages/resource-core/src/booklet-fixtures";
import { diagramEnvelope } from "../../packages/resource-core/src/schema";
import type { DiagramKind } from "../../packages/diagram-core/src/registry";
import { DiagramDialog } from "./DiagramDialog";
import { sweepDiagramCopies } from "./diagramTools";
import { BesideToggle, Field, LeafEditor, WorkingField, type Leaf } from "../worksheet/fields";
import { withBeside } from "../worksheet/edit";
import { pagesPdf } from "../worksheet/export";
import { DOCX_TYPE, wordKit } from "../export/word";
import { BookletAiPanel } from "./ai/BookletAiPanel";
import { isPlaceholder } from "./ai/make";
import * as edit from "./edit";
import "../site/settings-kit.css";
import "../worksheet/worksheet.css";
import "./booklet.css";
import { HistoryButtons } from "../site/HistoryButtons";
import { usePrintSize } from "../site/usePrintSize";
import { handleUndoKeys, pushHistory, useDocumentHistory, redoLabel as redoStepName, undoLabel as undoStepName, openDraft, STORAGE_UNAVAILABLE, useDraftAutosave } from "../editor-kit";

const STORAGE = copyStorageKey("maths-booklet-tools:booklet:v1");
/** The rest of a lesson source file (stored working, sides, plan), kept beside the booklet it was opened with. */
const SOURCE_STORAGE = `${STORAGE}:source`;
type SourceExtras = Omit<LessonSource, "booklet"> & { library?: LibraryOrigin };
/** The Resource library booklet a source was opened from, so Save to library adds the edit to it. */
type LibraryOrigin = { resource: string; version: string; title: string };
/** Only a lesson source served by the library opens from a link. */
const LIBRARY_SOURCE = /^library-data\/(?:files|edits)\/[a-f0-9]{64}\/[a-z0-9][a-z0-9._-]{0,150}\.json$/;
const readExtras = (): SourceExtras | null => {
  try {
    const raw = localStorage.getItem(SOURCE_STORAGE);
    return raw ? (JSON.parse(raw) as SourceExtras) : null;
  } catch {
    return null;
  }
};
const writeExtras = (extras: SourceExtras | null) => {
  try {
    if (extras) localStorage.setItem(SOURCE_STORAGE, JSON.stringify(extras));
    else localStorage.removeItem(SOURCE_STORAGE);
  } catch {
    /* The editable file still carries them. */
  }
};
type Spot = Pick<CardSpot, "lesson" | "section" | "card">;
const withoutMatch = ({ library: _library, ...rest }: SourceExtras & { lessons?: unknown }): Omit<LessonSource, "booklet"> => rest;
/** A file's parsed JSON as a booklet and the rest of its lesson source (null for a plain booklet file). */
function readBookletFile(parsed: unknown): { b: Booklet; rest: Omit<LessonSource, "booklet"> | null } {
  const wrapped = parsed && typeof parsed === "object" && "booklet" in parsed && !("document" in parsed);
  if (!wrapped) return { b: validateBooklet(parsed), rest: null };
  const { booklet, ...rest } = parsed as LessonSource;
  return { b: validateBooklet(booklet), rest };
}
const sameSpot = (a: Spot | null, b: Spot) => !!a && a.lesson === b.lesson && a.section === b.section && a.card === b.card;
const MAX_FILE = 4_000_000;
type BookletDoc = Booklet["document"];

function initial(): { b: Booklet; message: string; recovery: string | null } {
  const start = openDraft({
    key: STORAGE,
    parse: (raw) => validateBooklet(JSON.parse(raw)),
    fresh: () => a7Booklet,
    recoveryMessage: "Saved booklet data needs recovery. Download it before starting again.",
  });
  // Kept: this page's own wording for unavailable storage.
  const message = start.message === STORAGE_UNAVAILABLE ? "Device storage is unavailable. Save the editable file to keep your work." : start.message;
  return { b: start.document, message, recovery: start.recovery };
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
  const [startup] = useState(() => {
    let opened: string | null = null;
    try {
      opened = localStorage.getItem(STORAGE);
    } catch {
      /* Saving reports the failure. */
    }
    return { ...initial(), opened };
  });
  const documentHistory = useDocumentHistory<Booklet>(startup.b, { equals: (a, b) => JSON.stringify(a) === JSON.stringify(b) });
  const { history, setHistory } = documentHistory;
  const [recovery, setRecovery] = useState<string | null>(startup.recovery);
  const [message, setMessage] = useState(startup.message);
  const [answers, setAnswers] = useState(false);
  const printSize = usePrintSize();
  const [menu, setMenu] = useState(false);
  const [busy, setBusy] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [pending, setPending] = useState<{ b: Booklet; title: string; extras?: SourceExtras | null } | null>(null);
  const [extras, setExtrasState] = useState<SourceExtras | null>(readExtras);
  const setExtras = (next: SourceExtras | null) => {
    setExtrasState(next);
    writeExtras(next);
  };
  // The booklet the lesson source came with. Undoing its open puts it in the redo list, and the source then
  // stands aside; a new edit after that drops the source, so it never travels with a different booklet.
  const opened = useRef<Booklet | null>(startup.b);
  /** The note for Save to library while its box is open. */
  const [saving, setSaving] = useState<string | null>(null);
  /** The card being edited on the page, if any. */
  const [selected, setSelected] = useState<Spot | null>(null);
  /** A card's diagram open in its own tool (stage 4): where it sits in the card, and the envelope it opened with. */
  /** The button that opened the diagram dialog: focus goes back to it when the dialog closes. */
  const diagramOpener = useRef<HTMLElement | null>(null);
  const [diagramEdit, setDiagramEdit] = useState<{ kind: DiagramKind; envelope: unknown; lesson: number; section: number; card: number; path: number[] } | null>(null);
  const [focus, setFocus] = useState(0);
  const file = useRef<HTMLInputElement>(null);
  const pagesRef = useRef<HTMLDivElement>(null);
  const b = history.present;
  const d = b.document;
  const blocked = busy || aiBusy || recovery !== null || pending !== null || diagramEdit !== null;
  const shown = useMemo(() => renderBooklet(b, { view: answers ? "answers" : "pupil" }), [b, answers]);
  const issues = shown.issues;

  function commit(next: Booklet): boolean {
    if (recovery !== null) return false;
    try {
      const valid = validateBooklet(next);
      if (extras && opened.current && history.future.includes(opened.current)) {
        setExtras(null);
        opened.current = null;
      }
      documentHistory.commit(valid);
      setMessage("");
      return true;
    } catch (e) {
      // Invalid edits are refused with the specific reason; the last valid booklet stays.
      setMessage(e instanceof Error ? e.message : String(e));
      return false;
    }
  }
  function apply(f: (b: Booklet) => Booklet) {
    if (!blocked) commit(f(b));
  }
  function patch(update: (doc: BookletDoc) => void) {
    if (blocked) return false;
    const next = structuredClone(b);
    update(next.document);
    return commit(next);
  }
  /**
   * The diagram back from its tool, as one undo step. The page is blocked only by the dialog itself here. Returns why
   * it could not go back ("" when it did), so the dialog stays open with the reason and the teacher's edit is kept.
   */
  function putDiagram(at: NonNullable<typeof diagramEdit>, envelope: unknown): string {
    if (recovery !== null) return "The saved booklet changed in another tab. Close this, deal with the protected copy, then edit the diagram again.";
    if (busy || aiBusy || pending !== null) return "The booklet is busy. Wait a moment and press Done again.";
    const next = structuredClone(b);
    const items = next.document.lessons[at.lesson]?.sections[at.section]?.cards[at.card]?.items;
    const list = at.path.length === 1 ? items : (items?.[at.path[0]] as Extract<Item, { type: "part" }> | undefined)?.items;
    const leaf = list?.[at.path[at.path.length - 1]];
    if (leaf?.type !== "diagram" || leaf.diagram.tool !== at.kind) return "The diagram is no longer in this card.";
    leaf.diagram = { tool: at.kind, envelope: envelope as Record<string, unknown> };
    try {
      validateBooklet(next);
    } catch (e) {
      return e instanceof Error ? e.message : String(e);
    }
    return commit(next) ? "" : "The diagram could not go back in the card.";
  }
  const undo = () => !blocked && documentHistory.undo();
  const redo = () => !blocked && documentHistory.redo();

  // Autosave with protection for another tab's booklet, guarded from the draft this tab opened.
  const savedText = useMemo(() => JSON.stringify(history.present), [history.present]);
  const { saveState, keepStored } = useDraftAutosave({
    key: STORAGE,
    text: savedText,
    paused: recovery !== null,
    opened: startup.opened,
    onConflict: (raw, reason) => {
      setRecovery(raw);
      setMessage(
        reason === "newer"
          ? "A newer booklet was saved in another tab. Its saved data is protected."
          : "The saved booklet changed in another tab. Download it before replacing it.",
      );
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
      if (upload.size > MAX_FILE) throw Error("This file is too large to be a booklet.");
      let parsed: unknown;
      try {
        parsed = JSON.parse(await upload.text());
      } catch {
        throw Error("This file is not a booklet file (it is not JSON).");
      }
      if ((parsed as { document?: { kind?: string } })?.document?.kind === "worksheet-a3") throw Error("This is a worksheet file. Open it in the Worksheet builder.");
      // A lesson source as booklet builds write it: the booklet sits under "booklet" beside its stored working.
      const { b: file, rest } = readBookletFile(parsed);
      if (rest) setPending({ b: file, extras: rest, title: "Open this lesson source? It replaces the current booklet. You can undo it." });
      else setPending({ b: file, extras: null, title: "Open this booklet? It replaces the current one. You can undo it." });
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    }
  }
  // Edit from the Resource library: its Edit button links here with the lesson source to open.
  useEffect(() => {
    // A protected draft is downloaded or set aside first; the link is opened after that.
    if (!active || recovery !== null) return;
    const q = new URLSearchParams(location.search);
    const open = q.get("open");
    if (!open) return;
    const origin: LibraryOrigin = { resource: q.get("resource") ?? "", version: q.get("version") || "Main", title: (q.get("title") ?? "").slice(0, 120) };
    for (const k of ["open", "resource", "version", "title"]) q.delete(k);
    window.history.replaceState(window.history.state, "", location.pathname + (q.size ? `?${q}` : "") + location.hash);
    if (!LIBRARY_SOURCE.test(open)) {
      setMessage("That link does not name a booklet in the Resource library.");
      return;
    }
    setMessage("Opening the booklet from the Resource library…");
    void (async () => {
      try {
        const response = await fetch(siteBase() + open, { cache: "no-cache" });
        if (!response.ok) throw Error(response.status === 403 ? "Sign in again, then press Edit in the library once more." : "The booklet could not be fetched from the library. Try again.");
        const { b: file, rest } = readBookletFile(await response.json());
        const name = origin.title || file.document.lessons[0]?.title || "this booklet";
        setPending({ b: file, extras: { ...(rest ?? {}), library: origin.resource ? origin : undefined }, title: `Open "${name}" (${origin.version}) from the Resource library? It replaces the booklet on this page. You can undo it.` });
        setMessage("");
      } catch (e) {
        setMessage(e instanceof Error && !(e instanceof SyntaxError) ? e.message : "The library file is not a booklet.");
      }
    })();
  }, [active, recovery]);

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
    downloadBlob(await pagesPdf(pages, d.title, "Page"), pdfName(b, view, lesson));
  }
  /** The Word file: the same pages as the PDF, written here with the connector's own writer. */
  async function downloadWord(view: "pupil" | "answers", lesson?: number) {
    const one = lesson === undefined ? null : singleLessonBooklet(b, lesson);
    const [{ writeBookletDocx }, kit] = await Promise.all([import("../../packages/resource-core/src/booklet-docx"), wordKit()]);
    const r = await writeBookletDocx(one ? one.booklet : b, { view, numbering: one?.numbering, fonts: kit.fonts, picture: kit.picture, version: "MathsDock booklet renderer, Word output 1" });
    if (r.issues.length) throw Error("Fix the layout checks before downloading.");
    downloadBlob(new Blob([r.bytes as BlobPart], { type: DOCX_TYPE }), pdfName(b, view, lesson).replace(/\.pdf$/, ".docx"));
  }
  /** A lesson's teaching notes as their own PDF or Word file; the booklet copies never print them. */
  async function downloadNotes(lesson: number, format: "pdf" | "docx") {
    const name = lessonNotesFileName(b, lesson);
    if (format === "pdf") {
      const r = renderLessonNotes(b, lesson);
      if (r.issues.length) throw Error(r.issues[0].message);
      downloadBlob(await pagesPdf(r.pages, `${d.title} teaching notes`, "Page"), name);
      return;
    }
    const [{ writeLessonNotesDocx }, kit] = await Promise.all([import("../../packages/resource-core/src/booklet-docx"), wordKit()]);
    const r = await writeLessonNotesDocx(b, lesson, { fonts: kit.fonts, picture: kit.picture, version: "MathsDock booklet renderer, Word output 1" });
    if (r.issues.length) throw Error(r.issues[0].message);
    downloadBlob(new Blob([r.bytes as BlobPart], { type: DOCX_TYPE }), name.replace(/\.pdf$/, ".docx"));
  }
  const editableName = () => bookletFileName(b).replace(/_A4\.pdf$/, ".json");
  const showPage = (page: number) => pagesRef.current?.querySelector(`#bk-page-${page}`)?.scrollIntoView({ behavior: "smooth", block: "start" });

  // The build's own lesson checks (booklet-checks.ts), live on the lesson being edited, for a lesson source file.
  const source = extras && !(opened.current && history.future.includes(opened.current)) ? extras : null;
  const later = useDeferredValue(b);
  const checkLesson = Math.min(focus, d.lessons.length - 1);
  const build = useMemo(() => {
    if (!source || later.document.lessons.length <= checkLesson) return null;
    try {
      const r = lessonChecks({ ...withoutMatch(source), booklet: later }, checkLesson);
      return { findings: r.findings, warnings: r.warnings };
    } catch (e) {
      return { findings: [{ check: "SC", where: "lesson", message: `The build checks could not run: ${e instanceof Error ? e.message : String(e)}` }], warnings: [] };
    }
  }, [source, later, checkLesson]);
  const spotsByPage = useMemo(() => {
    const m = new Map<number, CardSpot[]>();
    for (const c of shown.cards) m.set(c.page, [...(m.get(c.page) ?? []), c]);
    return m;
  }, [shown]);
  const editing = selected && d.lessons[selected.lesson]?.sections[selected.section]?.cards[selected.card] ? selected : null;
  const selectedName = (c: Spot) => {
    const label = lessonLabels(d.lessons[c.lesson])[c.section][c.card];
    return label === null ? d.lessons[c.lesson].sections[c.section].cards[c.card].title || sectionTitle(d.lessons[c.lesson].sections[c.section]) : `Question ${label}`;
  };
  const selectedRef = useRef<HTMLElement>(null);
  // Diagram copies a closed tab left open in storage (stage 4) go after a day.
  useEffect(() => sweepDiagramCopies(), []);
  useEffect(() => {
    if (editing) selectedRef.current?.scrollIntoView({ block: "nearest" });
  }, [editing?.lesson, editing?.section, editing?.card]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    // While a diagram is open in its tool, Escape belongs to that dialog.
    if (!editing || diagramEdit) return;
    const key = (e: KeyboardEvent) => e.key === "Escape" && setSelected(null);
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [editing, diagramEdit]);

  const fromLibrary = source?.library ?? null;
  /** The build check problems on the booklet as it is saved (the panel may lag a keystroke behind). */
  const failingNow = () => {
    if (!source) return null;
    try {
      return b.document.lessons.reduce((n, _l, li) => n + lessonChecks({ ...withoutMatch(source), booklet: b }, li).findings.length, 0);
    } catch {
      return null;
    }
  };
  async function saveToLibrary(note: string) {
    if (!source || !fromLibrary) return;
    if (issues.length) throw Error("Fix the layout checks before saving to the library.");
    const response = await fetch(`${siteBase()}api/library/edit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...fromLibrary, note, failing: failingNow(), source: JSON.stringify({ ...withoutMatch(source), booklet: b }) }),
    });
    const reply = (await response.json().catch(() => ({}))) as { error?: string; alerted?: boolean };
    if (!response.ok) throw Error(reply.error ?? "The booklet could not be saved to the library. Save the file and send it to Tim.");
    setSaving(null);
    return reply.alerted;
  }

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

  /** A card's moves and fields: the same editor in the outline and on the page. */
  const cardBody = (li: number, si: number, ci: number): ReactNode => {
    const lesson = d.lessons[li];
    const section = lesson.sections[si];
    const card = section.cards[ci];
    const setLesson = (f: (l: Lesson) => void) => patch((x) => f(x.lessons[li]));
    /** A move or delete; the card being edited on the page keeps its editor as it moves. */
    const move = (next: Booklet, to: Spot | null) => {
      if (blocked || next === b || !commit(next)) return;
      if (sameSpot(selected, { lesson: li, section: si, card: ci })) setSelected(to);
      // Another card's place in these sections may have shifted: put its editor away rather than show the wrong card.
      else if (selected && selected.lesson === li && (selected.section === si || selected.section === to?.section)) setSelected(null);
    };
    const setItem = (path: number[], next: Item | Leaf) =>
      setLesson((l) => {
        const items = l.sections[si].cards[ci].items;
        if (path.length === 1) items[path[0]] = next as Item;
        else (items[path[0]] as Extract<Item, { type: "part" }>).items[path[1]] = next as Leaf;
      });
    /** The leaf's diagram in its own tool; Done puts the envelope back at the same place in the card. */
    const editDiagram = (path: number[], leaf: Leaf) => {
      if (leaf.type !== "diagram") return undefined;
      return () => {
        let envelope: unknown;
        try {
          envelope = diagramEnvelope(leaf.diagram);
        } catch (err) {
          setMessage(`This diagram cannot open in its tool: ${err instanceof Error ? err.message : String(err)}`);
          return;
        }
        diagramOpener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        setDiagramEdit({ kind: leaf.diagram.tool, envelope, lesson: li, section: si, card: ci, path });
      };
    };
    return (
      <>
                    <div className="ws-card-moves" role="group" aria-label={`Card ${card.title}`}>
                      <button className="icon-button" aria-label={`Move ${card.title} up`} disabled={blocked || (ci === 0 && si === 0)} onClick={() => move(ci === 0 ? edit.moveCardAcross(b, li, si, ci, -1) : edit.moveCardIn(b, li, si, ci, ci - 1), ci === 0 ? { lesson: li, section: si - 1, card: lesson.sections[si - 1]?.cards.length ?? 0 } : { lesson: li, section: si, card: ci - 1 })}>
                        <ArrowUp size={15} aria-hidden="true" />
                      </button>
                      <button
                        className="icon-button"
                        aria-label={`Move ${card.title} down`}
                        disabled={blocked || (ci === section.cards.length - 1 && si === lesson.sections.length - 1)}
                        onClick={() => move(ci === section.cards.length - 1 ? edit.moveCardAcross(b, li, si, ci, 1) : edit.moveCardIn(b, li, si, ci, ci + 1), ci === section.cards.length - 1 ? { lesson: li, section: si + 1, card: 0 } : { lesson: li, section: si, card: ci + 1 })}
                      >
                        <ArrowDown size={15} aria-hidden="true" />
                      </button>
                      <button className="icon-button" aria-label={`Duplicate ${card.title}`} disabled={blocked || section.cards.length >= 16} onClick={() => apply((x) => edit.duplicateCard(x, li, si, ci))}>
                        <Copy size={15} aria-hidden="true" />
                      </button>
                      <button className="icon-button" aria-label={`Delete ${card.title}`} disabled={blocked || section.cards.length < 2} onClick={() => move(edit.removeCard(b, li, si, ci), null)}>
                        <Trash2 size={15} aria-hidden="true" />
                      </button>
                    </div>
                    <Field label="Card title" value={card.title} max={60} disabled={blocked} onCommit={(v) => setLesson((l) => void (l.sections[si].cards[ci].title = v))} />
                    {(section.columns === 2 || card.wide || card.tall) && (
                      <label className="ws-field">
                        <span>Card shape</span>
                        <select
                          value={card.wide ? "wide" : card.tall ? `tall-${card.tallSide ?? "left"}-${card.tall}` : "half"}
                          disabled={blocked}
                          onChange={(e) =>
                            setLesson((l) => {
                              const c = l.sections[si].cards[ci];
                              delete c.wide;
                              delete c.tall;
                              delete c.tallSide;
                              const [kind, side, count] = e.target.value.split("-");
                              if (kind === "wide") c.wide = true;
                              if (kind === "tall") {
                                c.tall = Number(count);
                                if (side === "right") c.tallSide = "right";
                              }
                            })
                          }
                        >
                          <option value="half">Half width</option>
                          <option value="wide">Wide: across both columns</option>
                          {(["left", "right"] as const).flatMap((side) =>
                            [2, 3, 4, 5, 6].map((k) => (
                              <option key={`${side}-${k}`} value={`tall-${side}-${k}`}>
                                Tall on the {side}, beside the next {k} cards
                              </option>
                            )),
                          )}
                        </select>
                      </label>
                    )}
                    {card.items.map((item, i) =>
                      item.type === "part" ? (
                        <div key={i} className="ws-part">
                          <Field label={`Part ${String.fromCharCode(97 + card.items.slice(0, i).filter((x) => x.type === "part").length)}`} value={item.text} max={400} multiline disabled={blocked} onCommit={(text) => setItem([i], { ...item, text })} />
                          {item.items.map((leaf, j) => (
                            <div key={j} className="ws-item">
                              <LeafEditor item={leaf} set={(next) => setItem([i, j], next)} label="" disabled={blocked} editDiagram={editDiagram([i, j], leaf)} />
                              <BesideToggle list={item.items} index={j} disabled={blocked} set={(on) => setItem([i, j], withBeside(leaf, on))} />
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
                        <div key={i} className="ws-item">
                          <LeafEditor item={item} set={(next) => setItem([i], next)} label="" disabled={blocked} editDiagram={editDiagram([i], item)} />
                          <BesideToggle list={card.items} index={i} disabled={blocked} set={(on) => setItem([i], withBeside(item, on))} />
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
      </>
    );
  };

  const lessonEditor = (lesson: Lesson, li: number): ReactNode => {
    const shift = lessonShift(d);
    const setLesson = (f: (l: Lesson) => void) => patch((x) => f(x.lessons[li]));
    return (
      <details key={li} className="ws-side bk-lesson" open={focus === li} onToggle={(e) => (e.currentTarget as HTMLDetailsElement).open && setFocus(li)}>
        <summary>
          <span className="ws-q">{li + 1 + shift}</span> {lesson.title}
          {isPlaceholder(lesson) && <em className="bk-tag"> not made yet</em>}
        </summary>
        <div className="ws-card-moves" role="group" aria-label={`Lesson ${li + 1 + shift}`}>
          <button className="icon-button" aria-label={`Move lesson ${li + 1 + shift} up`} disabled={blocked || li === 0} onClick={() => apply((x) => edit.moveLesson(x, li, li - 1))}>
            <ArrowUp size={16} aria-hidden="true" />
          </button>
          <button className="icon-button" aria-label={`Move lesson ${li + 1 + shift} down`} disabled={blocked || li === d.lessons.length - 1} onClick={() => apply((x) => edit.moveLesson(x, li, li + 1))}>
            <ArrowDown size={16} aria-hidden="true" />
          </button>
          <button className="icon-button" aria-label={`Duplicate lesson ${li + 1 + shift}`} disabled={blocked || d.lessons.length >= 16} onClick={() => apply((x) => edit.duplicateLesson(x, li))}>
            <Copy size={16} aria-hidden="true" />
          </button>
          <button className="icon-button" aria-label={`Delete lesson ${li + 1 + shift}`} disabled={blocked || d.lessons.length < 2} onClick={() => apply((x) => edit.removeLesson(x, li))}>
            <Trash2 size={16} aria-hidden="true" />
          </button>
          <button className="tool-button bk-small" disabled={recovery !== null} onClick={() => showPage(shown.lessonPages[li])}>
            Show page {shown.lessonPages[li]}
          </button>
          <button className="tool-button bk-small" disabled={blocked || issues.length > 0} onClick={() => void run(() => downloadPdf("pupil", li), `Lesson ${li + 1 + shift} PDF download started.`)}>
            <Download size={15} aria-hidden="true" /> Lesson PDF
          </button>
          <button className="tool-button bk-small" disabled={blocked || issues.length > 0} onClick={() => void run(() => downloadWord("pupil", li), `Lesson ${li + 1 + shift} Word file download started.`)}>
            <Download size={15} aria-hidden="true" /> Lesson Word
          </button>
        </div>
        <Field label={`Lesson ${li + 1 + shift} title`} value={lesson.title} max={80} disabled={blocked} onCommit={(v) => setLesson((l) => void (l.title = v))} />
        <div className="ws-line-edit">
          <Field label="Objective code" value={lesson.code} max={16} disabled={blocked} onCommit={(v) => setLesson((l) => void (l.code = v))} />
        </div>
        <Field label="Objective" value={lesson.objective} max={200} multiline disabled={blocked} onCommit={(v) => setLesson((l) => void (l.objective = v))} />
        <Field label="Key idea" value={lesson.keyIdea} max={500} multiline disabled={blocked} onCommit={(v) => setLesson((l) => void (l.keyIdea = v))} />
        <Field label="Did you know?" value={lesson.didYouKnow} max={160} disabled={blocked} onCommit={(v) => setLesson((l) => void (l.didYouKnow = v))} />
        <details className="bk-notes">
          <summary>Teacher notes (their own file, never in the booklet)</summary>
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
          <p className="ws-hint">Start a line with "- " for a bullet; a blank line leaves a gap.</p>
          <div className="bk-notes-actions">
            <button className="tool-button bk-small" disabled={blocked || !lesson.teacherNotes.trim()} onClick={() => void run(() => downloadNotes(li, "pdf"), `Lesson ${li + 1 + shift} teaching notes PDF download started.`)}>
              <Download size={15} aria-hidden="true" /> Notes PDF
            </button>
            <button className="tool-button bk-small" disabled={blocked || !lesson.teacherNotes.trim()} onClick={() => void run(() => downloadNotes(li, "docx"), `Lesson ${li + 1 + shift} teaching notes Word file download started.`)}>
              <Download size={15} aria-hidden="true" /> Notes Word
            </button>
          </div>
        </details>
        {lesson.sections.map((section, si) => {
          const labels = lessonLabels(lesson)[si];
          return (
            <div key={si} className="ws-column bk-section">
              <div className="bk-section-head">
                <strong>{sectionTitle(section)}</strong>
                <div className="ws-card-moves" role="group" aria-label={`Section ${sectionTitle(section)}`}>
                  <button className="icon-button" aria-label={`Move section ${si + 1} of lesson ${li + 1 + shift} up`} disabled={blocked || si === 0} onClick={() => apply((x) => edit.moveSection(x, li, si, si - 1))}>
                    <ArrowUp size={15} aria-hidden="true" />
                  </button>
                  <button className="icon-button" aria-label={`Move section ${si + 1} of lesson ${li + 1 + shift} down`} disabled={blocked || si === lesson.sections.length - 1} onClick={() => apply((x) => edit.moveSection(x, li, si, si + 1))}>
                    <ArrowDown size={15} aria-hidden="true" />
                  </button>
                  <button className="icon-button" aria-label={`Delete section ${si + 1} of lesson ${li + 1 + shift}`} disabled={blocked || lesson.sections.length < 2} onClick={() => apply((x) => edit.removeSection(x, li, si))}>
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
                <label className="ws-field">
                  <span>Question labels</span>
                  <select value={section.numbering} disabled={blocked} onChange={(e) => setLesson((l) => void (l.sections[si].numbering = e.target.value as Numbering))}>
                    <option value="continue">Numbers, carrying on</option>
                    <option value="restart">Numbers, from 1 again</option>
                    <option value="letters">Letters A, B, C</option>
                  </select>
                </label>
              </div>
              <Field label="Heading (empty uses the kind)" value={section.title} max={60} disabled={blocked} onCommit={(v) => setLesson((l) => void (l.sections[si].title = v))} />
              <Field label="Instruction line" value={section.instruction} max={160} disabled={blocked} onCommit={(v) => setLesson((l) => void (l.sections[si].instruction = v))} />
              {section.cards.map((card, ci) => {
                const label = labels[ci] === null ? "•" : String(labels[ci]);
                return (
                  <details key={ci} className="ws-card">
                    <summary>
                      <span className="ws-q">{label}</span> {card.title || "(untitled)"}
                    </summary>
                    {cardBody(li, si, ci)}
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
        <PageHeading title="Booklet builder" description="Make an A4 unit booklet from a scheme of work unit with your own AI key: a check-in, worked examples, practice and diagnostics for every lesson. Edit any question and download the pupil and answers PDFs or Word files.">
          <ResourceSaveStatus text={saveState} />
        </PageHeading>
        <section className="workspace">
          <Panel className="editor-card">
            <div className="editor-toolbar" role="group" aria-label="Resource utilities">
              <div className="tool-group" role="group" aria-label="History and reset">
                <HistoryButtons
                  canUndo={!blocked && !!history.past.length}
                  canRedo={!blocked && !!history.future.length}
                  onUndo={undo}
                  onRedo={redo}
                  undoLabel={undoStepName(history)}
                  redoLabel={redoStepName(history)}
                />
                <button className="tool-button reset-button" disabled={blocked} aria-label="Open the example booklet" onClick={() => setPending({ b: a7Booklet, extras: null, title: "Open the example booklet? It replaces the current one. You can undo it." })}>
                  <RotateCcw size={17} aria-hidden="true" />
                  <span>Example</span>
                </button>
              </div>
              <div className="editor-copy-actions">
                <div className="editor-file-actions">
                  {fromLibrary && (
                    <button className="tool-button bk-save-library" disabled={blocked || saving !== null} title={`Save your changes to the Resource library as an edit of ${fromLibrary.title || "this booklet"} (${fromLibrary.version})`} onClick={() => setSaving("")}>
                      <LibraryBig size={17} aria-hidden="true" /> Save to library
                    </button>
                  )}
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
                { label: source ? "Save lesson source file" : "Save editable file", action: () => downloadBlob(new Blob([JSON.stringify(source ? { ...withoutMatch(source), booklet: b } : b, null, 2)], { type: "application/json" }), editableName()), disabled: blocked, success: `Saved ${editableName()}.`, separator: true },
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
              {printSize.controls}
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
                    setHistory((h) => pushHistory(h, next, { label: "open file" }));
                    if (pending.extras !== undefined) setExtras(pending.extras);
                    opened.current = next;
                    setSelected(null);
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
            {saving !== null && fromLibrary && (
              <form
                className="ws-confirm bk-save-box"
                aria-label="Save to library"
                onSubmit={(e) => {
                  e.preventDefault();
                  const note = saving.trim();
                  if (!note) return setMessage("Say in a few words what you changed.");
                  setBusy(true);
                  setMessage("");
                  saveToLibrary(note)
                    .then((alerted) => setMessage(alerted ? "Saved to the library. Tim has been told: the edit is built with the booklet checks and added as a new version marked waiting until he checks it." : "Saved to the library, but Tim was not told automatically. Let him know."))
                    .catch((err) => setMessage(err instanceof Error ? err.message : String(err)))
                    .finally(() => setBusy(false));
                }}
              >
                <p>
                  Save to the Resource library as an edit of <strong>{fromLibrary.title || "this booklet"}</strong> ({fromLibrary.version}). The library keeps the current version until the edit is built and checked.
                  {build && build.findings.length > 0 && ` The build checks show ${build.findings.length} problem${build.findings.length === 1 ? "" : "s"}; you can still save, and Tim sees them.`}
                </p>
                <label className="ws-field">
                  <span>What did you change?</span>
                  <textarea id="bk-save-note" rows={2} maxLength={500} value={saving} onChange={(e) => setSaving(e.target.value)} autoFocus />
                </label>
                <button className="tool-button" type="submit" disabled={busy}>
                  {busy ? "Saving…" : "Save to library"}
                </button>
                <button className="tool-button" type="button" disabled={busy} onClick={() => setSaving(null)}>
                  Cancel
                </button>
              </form>
            )}
            {diagramEdit && (
              <DiagramDialog
                kind={diagramEdit.kind}
                envelope={diagramEdit.envelope}
                onDone={(next) => {
                  const problem = putDiagram(diagramEdit, next);
                  if (!problem) setMessage("The diagram is back in the card. Undo puts the old one back.");
                  return problem;
                }}
                onClose={() => {
                  setDiagramEdit(null);
                  // The button is enabled again once the page redraws; then keyboard users are back where they were.
                  const opener = diagramOpener.current;
                  window.requestAnimationFrame(() => opener?.isConnected && opener.focus());
                }}
              />
            )}
            {recovery !== null && (
              <div className="ws-confirm" role="alertdialog" aria-label="Recover saved booklet data">
                <p>The saved booklet on this device is protected. Download it before starting again.</p>
                <button className="tool-button" onClick={() => {
                    // Not through run(): the page is blocked while recovery shows, and this download is the way out.
                    downloadBlob(new Blob([recovery], { type: "application/json" }), "booklet-recovered.json");
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
            <div className={`bk-pages${printSize.actual ? " ws-actual" : ""}`} data-testid="booklet-pages" ref={pagesRef}>
              {shown.pages.map((svg, i) => (
                <figure key={i} className={`ws-page bk-page${editing && (spotsByPage.get(i + 1) ?? []).some((c) => sameSpot(editing, c)) ? " editing" : ""}`} id={`bk-page-${i + 1}`}>
                  <figcaption>Page {i + 1}</figcaption>
                  <div className="bk-art-wrap" style={{ width: printSize.width(A4.page.width) }}>
                    <div className="ws-art" dangerouslySetInnerHTML={{ __html: svg.replace('font-family="Inter, sans-serif"', 'font-family="MathsDock Worksheet, Inter, sans-serif"') }} />
                    {/* Click a card to edit it here. These are page controls only: the SVG, PDF and Word files never hold them. */}
                    {(spotsByPage.get(i + 1) ?? []).map((c) => {
                      const on = sameSpot(editing, c);
                      const label = lessonLabels(d.lessons[c.lesson])[c.section][c.card];
                      const name = `${label === null ? sectionTitle(d.lessons[c.lesson].sections[c.section]) : `question ${label}`}, lesson ${c.lesson + 1 + lessonShift(d)}`;
                      return (
                        <button
                          key={`${c.lesson}-${c.section}-${c.card}`}
                          type="button"
                          className={`bk-spot${on ? " on" : ""}`}
                          style={{ left: `${(c.x / A4.page.width) * 100}%`, top: `${(c.y / A4.page.height) * 100}%`, width: `${(c.w / A4.page.width) * 100}%`, height: `${(c.h / A4.page.height) * 100}%` }}
                          aria-label={`Edit ${name}`}
                          aria-pressed={on}
                          disabled={recovery !== null || pending !== null}
                          onClick={() => {
                            setSelected(on ? null : { lesson: c.lesson, section: c.section, card: c.card });
                            setFocus(c.lesson);
                          }}
                        />
                      );
                    })}
                  </div>
                </figure>
              ))}
            </div>
          </Panel>
          <aside className="inspector-stack md-kit bk-outline" aria-label="Booklet settings">
            {editing && (
              <section className="panel-card ws-outline bk-selected" aria-label={`Edit ${selectedName(editing)}`} ref={selectedRef}>
                <div className="bk-selected-head">
                  <h2>{selectedName(editing)}</h2>
                  <button type="button" className="icon-button" aria-label="Close the card editor" onClick={() => setSelected(null)}>
                    <X size={16} aria-hidden="true" />
                  </button>
                </div>
                <p className="ws-hint">
                  Lesson {editing.lesson + 1 + lessonShift(d)}, {sectionTitle(d.lessons[editing.lesson].sections[editing.section])}. Changes show on the page at once; Undo takes back each one.
                </p>
                {cardBody(editing.lesson, editing.section, editing.card)}
              </section>
            )}
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
              {build && (
                <div className="bk-build-checks" data-testid="build-checks">
                  <h3>
                    Build checks, lesson {Number(source?.lessonNumber ?? 1) + checkLesson}
                    {later !== b && <span className="bk-tag"> updating…</span>}
                  </h3>
                  <p className="ws-hint">The same checks the booklet build runs. Problems must be fixed before the lesson goes in the library; warnings are for you to look at.</p>
                  <ul>
                    {build.findings.length === 0 && (
                      <li className="ok">
                        <span aria-hidden="true">✓</span> No problems.
                      </li>
                    )}
                    {build.findings.map((f, i) => (
                      <li key={`f${i}`} className="problem">
                        <span aria-hidden="true">!</span> <strong>{f.check}</strong> {f.where}: {f.message}
                      </li>
                    ))}
                    {build.warnings.map((f, i) => (
                      <li key={`w${i}`} className="warn">
                        <span aria-hidden="true">?</span> <strong>{f.check}</strong> {f.where}: {f.message}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
            <section className="panel-card ws-outline" aria-label="Booklet content">
              <h2>Cover</h2>
              <Field label="Title" value={d.title} max={80} disabled={blocked} onCommit={(v) => patch((x) => void (x.title = v))} />
              <div className="ws-line-edit">
                <Field label="Unit code" value={d.code} max={16} disabled={blocked} onCommit={(v) => patch((x) => void (x.code = v))} />
                <Field label="Year or tier" value={d.group} max={40} disabled={blocked} onCommit={(v) => patch((x) => void (x.group = v))} />
              </div>
              <div className="ws-line-edit">
                <Field label="Each part is called" value={d.lessonName} max={30} disabled={blocked} onCommit={(v) => patch((x) => void (x.lessonName = v))} />
                <Field label="Badge word" value={d.lessonBadge} max={12} disabled={blocked} onCommit={(v) => patch((x) => void (x.lessonBadge = v))} />
              </div>
              <p className="ws-hint">Empty means "Lesson". "Mock revision" prints "End of mock revision 1" and a "Revision" badge.</p>
              <label className="ws-check">
                <input type="checkbox" checked={d.lessonNumbered} disabled={blocked} onChange={(e) => patch((x) => void (x.lessonNumbered = e.target.checked))} /> Number each part (off for a one-off such as "Cover lesson")
              </label>
              <Field label="Cover note" value={d.coverNote} max={240} multiline disabled={blocked} onCommit={(v) => patch((x) => void (x.coverNote = v))} />
              <label className="ws-check">
                <input type="checkbox" checked={d.nameLine} disabled={blocked} onChange={(e) => patch((x) => void (x.nameLine = e.target.checked))} /> Name and class lines
              </label>
              <label className="ws-check">
                <input type="checkbox" checked={d.notation === "maths"} disabled={blocked} onChange={(e) => patch((x) => void (x.notation = e.target.checked ? "maths" : "plain"))} /> Maths printing: stacked {"{3/4}"}, x², a true minus, ≤ and italic x
              </label>
              <details className="ws-side">
                <summary>Unit introduction</summary>
                <label className="ws-check">
                  <input type="checkbox" checked={d.intro !== null} disabled={blocked} onChange={(e) => patch((x) => void (x.intro = e.target.checked ? { remember: [], learn: [], next: [], keywords: [], lessons: [], highlight: [] } : null))} /> Include a unit introduction page
                </label>
                {d.intro && (
                  <>
                    <ListField label="What do I need to remember?" value={d.intro.remember} max={120} maxItems={8} disabled={blocked} onCommit={(v) => patch((x) => void (x.intro!.remember = v))} />
                    <ListField label="What will I learn?" value={d.intro.learn} max={120} maxItems={8} disabled={blocked} onCommit={(v) => patch((x) => void (x.intro!.learn = v))} />
                    <ListField label="How does this progress?" value={d.intro.next} max={120} maxItems={8} disabled={blocked} onCommit={(v) => patch((x) => void (x.intro!.next = v))} />
                    <h3>Key words</h3>
                    {d.intro.keywords.map((k, i) => (
                      <div key={i} className="bk-keyword">
                        <Field label={`Word ${i + 1}`} value={k.word} max={40} disabled={blocked} onCommit={(v) => patch((x) => void (x.intro!.keywords[i].word = v))} />
                        <Field label="Meaning" value={k.meaning} max={160} disabled={blocked} onCommit={(v) => patch((x) => void (x.intro!.keywords[i].meaning = v))} />
                        <button className="icon-button" aria-label={`Remove key word ${i + 1}`} disabled={blocked} onClick={() => patch((x) => void x.intro!.keywords.splice(i, 1))}>
                          <Trash2 size={15} aria-hidden="true" />
                        </button>
                      </div>
                    ))}
                    <button className="tool-button bk-small" disabled={blocked || d.intro.keywords.length >= 24} onClick={() => patch((x) => void x.intro!.keywords.push({ word: "Word", meaning: "Its meaning." }))}>
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
