import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Check, Copy, Download, History, LayoutGrid, Map as MapIcon, MessageSquare, Search, X } from "lucide-react";
import { PageHeading } from "../site/PageHeading";
import { pageHref, readPage } from "../site/routes";
import {
  applyChecks, countState, fileHref, predictFeedback, fileLabel, isSchemeUnit, lessonPlan, loadFeedback, loadLibrary, partRanges, readState, resourcesFor, ringLabel, searchLibrary, sendFeedback,
  summary, threadKey, threadMap, typeNames, unitBooklets, unitLabel, unitOf, versionsOf, writeState,
  type Feedback, type FeedbackAction, type LessonRow, type LessonState, type Library, type LibraryFile, type LibraryState, type LibraryUnit, type Resource, type Thread,
} from "./model";
import "./library.css";

const YEAR_KEY = "mathsdock.libraryYear";
const savedYear = () => { try { return Number(localStorage.getItem(YEAR_KEY)) || 7; } catch { return 7; } };
const day = (iso: string) => new Date(iso.length === 10 ? `${iso}T12:00:00` : iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
/** M, F, or what is in brackets: "Extra challenge (9X)" is 9X. */
const shortVersion = (v: string) => /\(([^)]+)\)/.exec(v)?.[1] ?? v.split(/\s+/).map((w) => w[0]).join("").toUpperCase().slice(0, 3);
const stateNames: Record<LessonState, string> = { none: "Not made yet", waiting: "Waiting for check", feedback: "Feedback to act on", ready: "Ready" };

type FeedbackTools = { threads: Map<string, Thread>; all: Thread[]; canAct: boolean; off?: string; act: (a: FeedbackAction) => Promise<string> };
const FeedbackContext = createContext<FeedbackTools>({ threads: new Map(), all: [], canAct: false, off: "Loading feedback…", act: async () => "" });

/**
 * Resource library (docs/content/RESOURCE-LIBRARY.md): pick a year, then a unit. Each unit card has a
 * ring with one segment per lesson (grey not made, amber waiting for check, violet feedback to act
 * on, green ready); the unit panel on the right has its versions, parts, lessons, history and the
 * feedback threads every signed-in colleague can read. The search finds any booklet in every year;
 * the Map shows the whole scheme as squares.
 */
export default function ResourceLibrary({ active = true }: { active?: boolean }) {
  const [raw, setList] = useState<Library | null>(null);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState<Feedback>({ off: "Loading feedback…" });
  const [drawer, setDrawer] = useState(false);
  const [state, setStateValue] = useState<LibraryState>(() => readState(location.search, savedYear()));
  const box = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let live = true;
    loadLibrary().then((l) => live && setList(l), (e: Error) => live && setError(e.message));
    loadFeedback().then((f) => live && setFeedback(f), () => live && setFeedback({ off: "Feedback could not be loaded." }));
    return () => { live = false; };
  }, []);
  useEffect(() => {
    if (!active) return;
    const back = () => { if (readPage() === "library") setStateValue(readState(location.search, savedYear())); };
    window.addEventListener("popstate", back);
    return () => window.removeEventListener("popstate", back);
  }, [active]);
  // Press / to search, as on Home and the Diagram builder; Escape closes the feedback drawer.
  useEffect(() => {
    if (!active) return;
    function key(event: KeyboardEvent) {
      if (event.key === "Escape") { setDrawer(false); return; }
      if (event.key !== "/" || event.ctrlKey || event.metaKey || event.altKey) return;
      if ((event.target as HTMLElement).closest("input, textarea, select, [contenteditable='true']")) return;
      event.preventDefault();
      box.current?.focus();
    }
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [active]);

  // The page changes at once and the fresh feedback loads in the background. Only the newest load
  // or action counts, so an older answer never overwrites a newer change. If the Worker refuses,
  // the page reloads what is really saved (or, if that fails too, goes back) and the error shows.
  const seq = useRef(0);
  const reload = useCallback((fallback?: Feedback) => {
    const n = ++seq.current;
    loadFeedback().then(
      (next) => { if (n === seq.current) setFeedback((old) => ("off" in next && !("off" in old) ? fallback ?? old : next)); },
      () => { if (n === seq.current && fallback) setFeedback(fallback); });
  }, []);
  const act = useCallback(async (a: FeedbackAction) => {
    let before: Feedback | undefined;
    seq.current++;
    setFeedback((old) => { before = old; return predictFeedback(old, a); });
    let warning: string;
    try { warning = await sendFeedback(a); }
    catch (e) { reload(before); throw e; }
    reload();
    return warning;
  }, [reload]);
  // A booklet an editor has ticked ✓ Checked at its current version shows green everywhere.
  const list = useMemo(() => (raw ? applyChecks(raw, "off" in feedback ? {} : feedback.checks) : null), [raw, feedback]);
  const tools = useMemo<FeedbackTools>(() => ("off" in feedback
    ? { threads: new Map(), all: [], canAct: false, off: feedback.off, act }
    : { threads: threadMap(feedback.threads), all: feedback.threads, canAct: feedback.canAct, act }), [feedback, act]);

  function setState(next: Partial<LibraryState>, push = false) {
    const value = { ...state, ...next };
    setStateValue(value);
    try { localStorage.setItem(YEAR_KEY, String(value.year)); } catch { /* The year is only a convenience. */ }
    const address = pageHref("library") + writeState(value);
    if (push) history.pushState({}, "", address); else history.replaceState({}, "", address);
    window.dispatchEvent(new Event("maths-tools:route"));
  }
  const openUnit = (year: number, unit: string, version?: string) => { setDrawer(false); setState({ year, unit, version, view: "shelves", q: "" }, true); };
  const found = useMemo(() => (list ? searchLibrary(list, state.q) : []), [list, state.q]);

  return (
    <FeedbackContext.Provider value={tools}>
      <main className="resource-library" id="main-content" tabIndex={-1}>
        <PageHeading title="Resource library" description="Every booklet we have made, by year and unit, at its newest version. Send a colleague a unit's link: they sign in with their school email." />
        <div className="library-controls">
          <label className="library-search">
            <Search size={18} aria-hidden="true" />
            <span className="sr-only">Search the library</span>
            <input ref={box} type="search" value={state.q} placeholder="Search a code, title or topic: A7.03, gradient, pie charts…" onChange={(e) => setState({ q: e.target.value })} />
            {!state.q && <kbd aria-hidden="true">/</kbd>}
          </label>
          {!tools.off && (
            <button type="button" className="library-inbox" aria-expanded={drawer} onClick={() => setDrawer(true)}>
              <MessageSquare size={16} aria-hidden="true" />Feedback to act on<b>{tools.all.length}</b>
            </button>
          )}
          <div className="library-views" role="group" aria-label="View">
            <button type="button" aria-pressed={state.view === "shelves"} onClick={() => setState({ view: "shelves", q: "" })}><LayoutGrid size={16} aria-hidden="true" />Shelves</button>
            <button type="button" aria-pressed={state.view === "map"} onClick={() => setState({ view: "map", q: "" })}><MapIcon size={16} aria-hidden="true" />Map</button>
          </div>
        </div>
        <Key />
        {error ? <p className="library-message" role="alert">{error}</p>
          : !list ? <p className="library-message" role="status">Loading the library…</p>
          : state.q ? <Results list={list} found={found} query={state.q} open={openUnit} />
          : state.view === "map" ? <LibraryMap list={list} open={openUnit} />
          : <Shelves list={list} state={state} setState={setState} />}
        {drawer && list && <Drawer list={list} close={() => setDrawer(false)} open={openUnit} />}
      </main>
    </FeedbackContext.Provider>
  );
}

function Key() {
  return (
    <p className="library-legend">
      {(["none", "waiting", "feedback", "ready"] as LessonState[]).map((s) => <span key={s}><i className={`library-sq is-${s}`} aria-hidden="true" />{stateNames[s]}</span>)}
    </p>
  );
}

/** One segment per lesson, with a gap where each later part starts. */
function Ring({ rows, starts, label }: { rows: LessonRow[]; starts: number[]; label: string }) {
  const n = Math.max(rows.length, 1), r = 22, c = 2 * Math.PI * r, partGap = 7, gap = n > 14 ? 1.4 : 2.2;
  const seg = (c - starts.length * partGap) / n;
  const segments: { state: LessonState; at: number }[] = [];
  let at = 0;
  (rows.length ? rows : [{ state: "none" as LessonState }]).forEach((row, i) => {
    if (starts.includes(i)) at += partGap;
    segments.push({ state: row.state, at });
    at += seg;
  });
  const dash = rows.length ? `${Math.max(seg - gap, 0.5)} ${c - seg + gap}` : `${c} 0`;
  return (
    <svg className="library-ring" viewBox="0 0 56 56" aria-hidden="true">
      {segments.map((s, i) => <circle key={i} cx="28" cy="28" r={r} className={`is-${s.state}`} strokeDasharray={dash} strokeDashoffset={-s.at} transform="rotate(-90 28 28)" />)}
      <text x="28" y="32" textAnchor="middle" className={label.length > 3 ? "is-long" : undefined}>{label}</text>
    </svg>
  );
}
function Squares({ rows, starts = [] }: { rows: LessonRow[]; starts?: number[] }) {
  return (
    <span className="library-squares" aria-hidden="true">
      {rows.map((row, i) => <span key={`${row.code}-${i}`} className="library-sq-wrap">{starts.includes(i) && <i className="library-gap" />}<i className={`library-sq is-${row.state}`} title={`${row.code || row.title}: ${stateNames[row.state]}`} /></span>)}
    </span>
  );
}
const partStarts = (unit: LibraryUnit | undefined, rows: LessonRow[]) => (partRanges(unit, rows) ?? []).slice(1).map((p) => p.start);

function Shelves({ list, state, setState }: { list: Library; state: LibraryState; setState: (s: Partial<LibraryState>, push?: boolean) => void }) {
  const fb = useContext(FeedbackContext);
  const year = list.years.find((y) => y.year === state.year) ?? list.years[0];
  const unit = state.unit ? unitOf(list, year.year, state.unit) : undefined;
  return (
    <div className="library-shelves">
      <nav className="library-years" aria-label="Years">
        {list.years.map((y) => {
          const units = new Set(list.resources.filter((r) => r.year === y.year).map((r) => r.unit)).size;
          return <button key={y.year} type="button" aria-pressed={y.year === year.year} onClick={() => setState({ year: y.year, unit: undefined, version: undefined }, true)}>Year {y.year}<small>{units} {units === 1 ? "unit" : "units"}</small></button>;
        })}
      </nav>
      <section className="library-units" aria-label={`Year ${year.year} units`}>
        <h2>Year {year.year}</h2>
        <p className="library-hint">Units in teaching order. {year.sections.some((s) => s.estimate) ? "The term headings are estimates from where classes are now." : "This year group follows its own list of units."}</p>
        {year.sections.map((section) => (
          <div key={section.name} className="library-section">
            <h3>{section.name}{section.estimate && <em> (estimate)</em>}</h3>
            <div className="library-unit-grid">
              {section.units.map((u) => {
                const rows = lessonPlan(list, year.year, u.code, "Main", fb.threads);
                const empty = !resourcesFor(list, year.year, u.code).length;
                const versions = versionsOf(list, year.year, u.code).slice(1);
                const lessonFb = fb.all.filter((t) => t.year === year.year && t.unit === u.code && t.kind === "lesson").length;
                const unitFb = fb.all.filter((t) => t.year === year.year && t.unit === u.code && t.kind === "unit").length;
                const now = year.now === u.code;
                return (
                  <button key={u.code} type="button" className={`library-unit${empty ? " is-empty" : ""}${now ? " has-now" : ""}`} aria-pressed={u.code === unit?.code} onClick={() => setState({ unit: u.code, version: undefined }, true)}>
                    {now && <span className="library-now">Now</span>}
                    <Ring rows={rows} starts={partStarts(u, rows)} label={ringLabel(u)} />
                    <span className="library-unit-text">
                      <span className="library-unit-code">{isSchemeUnit(u.code) ? u.code : u.title}</span>
                      {isSchemeUnit(u.code) && <span className="library-unit-title">{u.title}</span>}
                      <span className="library-unit-meta">
                        {summary(rows)}
                        {lessonFb > 0 && <> · <span className="library-fb">{lessonFb} feedback</span></>}
                        {unitFb > 0 && <> · <span className="library-fb">{unitFb} unit comment{unitFb === 1 ? "" : "s"}</span></>}
                      </span>
                      {versions.length > 0 && <span className="library-pills">{versions.map((v) => <span key={v}>{v}</span>)}</span>}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </section>
      <aside className="library-detail" aria-label="Unit resources">
        {unit ? <UnitDetail key={`${year.year}/${unit.code}`} list={list} year={year.year} unit={unit} version={state.version} setVersion={(v) => setState({ version: v })} />
          : <p className="library-hint">Choose a unit to see its booklets, answers and feedback here.</p>}
      </aside>
    </div>
  );
}

function FileLinks({ files }: { files: LibraryFile[] }) {
  return (
    <span className="library-files">
      {files.map((f) => (
        <a key={f.href} href={fileHref(f)} className={`library-file${f.role === "answers" ? " is-answers" : ""}`} target={f.format === "pdf" ? "_blank" : undefined} rel="noreferrer" download={f.format === "docx" ? f.name : undefined}>{fileLabel(f)}</a>
      ))}
    </span>
  );
}

function UnitDetail({ list, year, unit, version: asked, setVersion }: { list: Library; year: number; unit: LibraryUnit; version?: string; setVersion: (v: string) => void }) {
  const fb = useContext(FeedbackContext);
  const versions = versionsOf(list, year, unit.code);
  const version = asked && versions.includes(asked) ? asked : "Main";
  const rows = lessonPlan(list, year, unit.code, version, fb.threads);
  const ranges = partRanges(unit, rows);
  const booklets = unitBooklets(list, year, unit.code, version);
  const items = resourcesFor(list, year, unit.code).filter((r) => r.version === version);
  const unitThread = fb.threads.get(threadKey(year, unit.code, version, null));
  const [message, setMessage] = useState("");
  const [unitBox, setUnitBox] = useState<boolean | null>(null);
  useEffect(() => setMessage(""), [version]);
  async function copyLink() {
    const link = new URL(pageHref("library") + writeState({ year, unit: unit.code, version, view: "shelves", q: "" }), location.origin).href;
    try { await navigator.clipboard.writeText(link); setMessage("Link copied. Colleagues sign in with their school email to open it."); }
    catch { setMessage(`Copy this link: ${link}`); }
  }
  async function downloadUnit() {
    setMessage("Gathering the files…");
    try {
      const { zipSync } = await import("fflate");
      const entries: Record<string, Uint8Array> = {};
      for (const r of items) for (const f of r.files) {
        const response = await fetch(fileHref(f));
        if (!response.ok) throw new Error(f.name);
        // Two files with one name would overwrite each other in the zip.
        let name = f.name;
        for (let n = 2; name in entries; n++) name = f.name.replace(/(\.\w+)$/, `-${n}$1`);
        entries[name] = new Uint8Array(await response.arrayBuffer());
      }
      const url = URL.createObjectURL(new Blob([zipSync(entries, { level: 0 }) as BlobPart], { type: "application/zip" }));
      const a = document.createElement("a");
      a.href = url; a.download = `Year-${year}-${unit.code}${version === "Main" ? "" : `-${version.replace(/\W+/g, "-")}`}-booklets.zip`; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      setMessage("Download started.");
    } catch (e) { setMessage(`A file could not be downloaded (${(e as Error).message}). Try again, or open the files one at a time.`); }
  }
  const scheme = isSchemeUnit(unit.code);
  const showUnitBox = scheme && !fb.off && (unitBox ?? !!unitThread);
  return (
    <>
      <h2>{scheme ? `${unit.code} ${unit.title}` : unit.title}</h2>
      <p className="library-hint">Year {year} · {rows.length} {scheme ? "lessons" : "booklets"} · {summary(rows)}</p>
      {versions.length > 1 && (
        <>
          <div className="library-tabs" role="group" aria-label="Versions">
            {versions.map((v) => {
              const flagged = lessonPlan(list, year, unit.code, v, fb.threads).some((r) => r.state === "feedback");
              return <button key={v} type="button" aria-pressed={v === version} onClick={() => setVersion(v)}>{v}{flagged && <i className="library-dot" aria-label="has feedback" />}</button>;
            })}
          </div>
          <p className="library-hint">Each version sits alongside the main one and is checked on its own.</p>
        </>
      )}
      <div className="library-actions">
        <button type="button" className="primary" onClick={copyLink}><Copy size={15} aria-hidden="true" />Copy link</button>
        {items.length > 0 && <button type="button" onClick={downloadUnit}><Download size={15} aria-hidden="true" />Download all (zip)</button>}
        {scheme && !fb.off && <button type="button" className="violet" aria-expanded={showUnitBox} onClick={() => setUnitBox(!showUnitBox)}><MessageSquare size={15} aria-hidden="true" />Feedback on this unit{unitThread ? ` (${unitThread.comments.length})` : ""}</button>}
      </div>
      {fb.off && fb.off !== "Loading feedback…" && <p className="library-hint">{fb.off}</p>}
      {message && <p className="library-status" role="status">{message}</p>}
      {showUnitBox && <ThreadView year={year} unit={unit.code} version={version} lesson={null} thread={unitThread} />}
      {(ranges ?? [{ name: "", start: 0, end: rows.length - 1, from: "", to: "" }]).map((p) => {
        const booklet = booklets.find((b) => (p.name ? b.part === p.name : !b.part)) ?? (ranges ? undefined : booklets[0]);
        if (!booklet) return null;
        return (
          <div key={p.name || "whole"} className="library-part">
            <div className="library-part-head"><span>{p.name ? `${p.name} · ${p.from} to ${p.to}` : "Unit booklet"}</span><Squares rows={rows.slice(p.start, p.end + 1)} /></div>
            <FileLinks files={booklet.files} />
          </div>
        );
      })}
      {!items.length && <p className="library-hint">Nothing made yet for this {versions.length > 1 ? "version" : "unit"}. Its lessons are listed below.</p>}
      <ul className="library-rows">
        {rows.map((row, i) => <LessonLine key={row.code || row.resource?.id} row={row} year={year} unit={unit.code} version={version} part={ranges?.find((p) => p.start === i)?.name} />)}
      </ul>
    </>
  );
}

function LessonLine({ row, year, unit, version, part }: { row: LessonRow; year: number; unit: string; version: string; part?: string }) {
  const fb = useContext(FeedbackContext);
  const [open, setOpen] = useState<boolean | null>(null);
  const [history, setHistory] = useState(false);
  const r = row.resource;
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  // ✓ Checked turns this version green at once (and closes any open comments on it); Undo takes it back.
  async function tick(action: "check" | "uncheck") {
    if (!r) return;
    setBusy(true); setMessage("");
    try { setMessage(await fb.act({ action, year, unit, version, lesson: row.code, id: r.id, updated: r.updated, close: action === "check" && !!row.thread && !row.thread.queued })); }
    catch (e) { setMessage((e as Error).message); }
    finally { setBusy(false); }
  }
  // Open feedback shows straight away; anyone can open an empty thread on a made lesson.
  const shown = !!row.code && !fb.off && (r || row.thread) && (open ?? !!row.thread);
  return (
    <li className={`library-row is-${row.state}`}>
      {part && <p className="library-part-label">{part}</p>}
      <div className="library-row-main">
        <i className={`library-sq is-${row.state}`} aria-hidden="true" />
        <span className="library-row-text">
          <span className="library-row-title">{row.code && <b>{row.code}</b>} {row.title}</span>
          {r && (
            <span className="library-row-state">
              {stateNames[row.state]}{r.checked ? ` · checked by ${r.checked.by}` : ""}{fb.canAct && r.checked && <> <button type="button" className="library-link" disabled={busy} onClick={() => tick("uncheck")}>Undo</button></>}{row.thread?.queued ? " · queued for tonight" : ""}{row.state === "feedback" ? ` (current version ${r.status === "ready" ? "ready" : "waiting for check"})` : ""} · {day(r.updated)}{" "}
              <button type="button" className="library-link" aria-expanded={history} onClick={() => setHistory(!history)}><History size={13} aria-hidden="true" />{r.history.length ? `${r.history.length} earlier version${r.history.length === 1 ? "" : "s"}` : "History"}</button>
            </span>
          )}
        </span>
        {fb.canAct && r && row.code && r.status === "waiting" && <button type="button" className="library-chip is-check" disabled={busy} title="You have looked at this version and it needs no changes" onClick={() => tick("check")}><Check size={14} aria-hidden="true" />Checked</button>}
        {(r || row.thread) && row.code && !fb.off && <button type="button" className="library-chip" aria-expanded={!!shown} onClick={() => setOpen(!shown)}>{row.thread ? `${row.thread.comments.length} comment${row.thread.comments.length === 1 ? "" : "s"}` : "Feedback"}</button>}
      </div>
      {r && <FileLinks files={r.files} />}
      {r && history && <HistoryList resource={r} year={year} unit={unit} version={version} />}
      {message && <p className="library-status" role="status">{message}</p>}
      {shown && <ThreadView year={year} unit={unit} version={version} lesson={row.code} thread={row.thread} />}
    </li>
  );
}

function HistoryList({ resource: r, year, unit, version }: { resource: Resource; year: number; unit: string; version: string }) {
  const fb = useContext(FeedbackContext);
  const [message, setMessage] = useState("");
  async function restore(updated: string) {
    setMessage("Asking for it back…");
    try { await fb.act({ action: "restore", year, unit, version, lesson: r.lesson, updated }); setMessage("Queued for tonight's run: it comes back as the newest version, waiting for a check."); }
    catch (e) { setMessage((e as Error).message); }
  }
  return (
    <div className="library-history">
      <div className="library-history-row"><span><b>{day(r.updated)}</b> <span className="library-current">Current</span>{r.note && <small>{r.note}</small>}</span></div>
      {r.history.map((old) => (
        <div key={old.updated + (old.files[0]?.href ?? "")} className="library-history-row">
          <span><b>{day(old.updated)}</b>{old.note && <small>{old.note}</small>}</span>
          <FileLinks files={old.files} />
          {fb.canAct && r.lesson && <button type="button" className="library-chip" onClick={() => restore(old.updated)}>Make current again</button>}
        </div>
      ))}
      <p className="library-hint">{r.history.length ? "Every replaced version stays here, so a change can always be undone." : "No earlier versions. When this booklet is replaced, the old one stays here."}</p>
      {message && <p className="library-status" role="status">{message}</p>}
    </div>
  );
}

function ThreadView({ year, unit, version, lesson, thread }: { year: number; unit: string; version: string; lesson: string | null; thread?: Thread }) {
  const fb = useContext(FeedbackContext);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function run(action: FeedbackAction["action"], done: string) {
    setBusy(true); setMessage("");
    try { await fb.act({ action, year, unit, version, lesson, text: action === "comment" ? text : undefined }); if (action === "comment") setText(""); setMessage(done); }
    catch (e) { setMessage((e as Error).message); }
    finally { setBusy(false); }
  }
  const forUnit = lesson === null;
  return (
    <div className={`library-thread${forUnit ? " is-unit" : ""}`} role="group" aria-label={forUnit ? "Feedback on this unit" : `Feedback on ${lesson}`}>
      {forUnit && <p className="library-thread-label">Unit structure: objectives, lesson order, combining or splitting lessons, where the unit sits</p>}
      {thread?.comments.length ? thread.comments.map((c, i) => (
        <div key={i} className="library-comment"><span className="library-who"><b>{c.who}</b> · {day(c.when)}</span><p>{c.text}</p></div>
      )) : <p className="library-hint">No comments on this {forUnit ? "unit" : "lesson"} yet. Anyone signed in can read them.</p>}
      <label className="library-say">
        <span className="sr-only">Add a comment</span>
        <textarea rows={2} value={text} maxLength={2000} placeholder={forUnit ? "Suggest a change to how this unit is put together…" : "Add a comment: what to change, and where (page, question)…"} onChange={(e) => setText(e.target.value)} />
      </label>
      <div className="library-actions">
        <button type="button" className="primary" disabled={busy || !text.trim()} onClick={() => run("comment", "Comment added.")}>Send</button>
        {fb.canAct && thread && !forUnit && !thread.queued && <button type="button" className="violet-fill" disabled={busy} onClick={() => run("queue", "Queued for tonight's run.")}>Queue for tonight</button>}
        {fb.canAct && thread && !forUnit && thread.queued && <button type="button" disabled={busy} onClick={() => run("unqueue", "Taken out of the queue.")}>Take out of the queue</button>}
        {fb.canAct && thread && !forUnit && <button type="button" disabled={busy} onClick={() => run("no-change", "Closed: no change needed.")}>No change needed</button>}
        {fb.canAct && thread && forUnit && !thread.agreed && <button type="button" disabled={busy} onClick={() => run("agree", "Agreed. Plan the change in a thread with Claude.")}>Agree: plan the change</button>}
        {fb.canAct && thread && forUnit && <button type="button" disabled={busy} onClick={() => run("keep", "Closed: the unit stays as it is.")}>Keep as it is</button>}
      </div>
      {thread?.queued && <p className="library-toast">Queued for tonight's run. At 10 PM Claude asks Tim whether to run it; if he says yes, the lesson is rebuilt from these comments, comes back here amber, waiting for a check, and the comments are closed.</p>}
      {forUnit && <p className="library-hint">{thread?.agreed ? "Agreed: waiting to be planned. " : ""}Unit comments never go in the nightly queue: they wait for a decision.</p>}
      {message && <p className="library-status" role="status">{message}</p>}
    </div>
  );
}

function Drawer({ list, close, open }: { list: Library; close: () => void; open: (year: number, unit: string, version?: string) => void }) {
  const fb = useContext(FeedbackContext);
  const [message, setMessage] = useState("");
  const lessons = fb.all.filter((t) => t.kind === "lesson"), units = fb.all.filter((t) => t.kind === "unit");
  const queued = lessons.filter((t) => t.queued).length;
  const title = (t: Thread) => {
    const u = unitOf(list, t.year, t.unit);
    const name = t.lesson ? u?.lessons?.find((l) => l.code === t.lesson)?.title ?? list.resources.find((r) => r.year === t.year && r.unit === t.unit && r.lesson === t.lesson)?.title ?? "" : u?.title ?? "";
    return `Y${t.year} · ${t.lesson ?? t.unit} ${name}${t.version === "Main" ? "" : ` · ${t.version}`}`;
  };
  const queue = (t: Thread) => fb.act({ action: "queue", year: t.year, unit: t.unit, version: t.version, lesson: t.lesson });
  async function queueAll() {
    setMessage("Queueing…");
    try { for (const t of lessons.filter((x) => !x.queued)) await queue(t); setMessage("All lesson feedback is queued for tonight."); }
    catch (e) { setMessage((e as Error).message); }
  }
  const item = (t: Thread) => {
    const last = t.comments.at(-1);
    return (
      <li key={t.number} className="library-item">
        <span className="library-where">{title(t)}</span>
        {last && <span className="library-what">{last.who}, {day(last.when)}: {last.text}</span>}
        {t.queued && <span className="library-toast">Queued for tonight</span>}
        {t.agreed && <span className="library-toast">Agreed: to plan</span>}
        <span className="library-actions">
          <button type="button" onClick={() => open(t.year, t.unit, t.version)}>Open {t.kind === "unit" ? "unit" : "lesson"}</button>
          {fb.canAct && t.kind === "lesson" && !t.queued && <button type="button" className="violet-fill" onClick={() => queue(t).catch((e: Error) => setMessage(e.message))}>Queue for tonight</button>}
        </span>
      </li>
    );
  };
  return (
    <div className="library-drawer-shade" onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className="library-drawer" role="dialog" aria-modal="true" aria-label="Feedback to act on">
        <div className="library-drawer-head"><h2>Feedback to act on · {fb.all.length}</h2><button type="button" className="library-chip" onClick={close} autoFocus><X size={15} aria-hidden="true" />Close</button></div>
        <p className="library-hint">Open comments across the whole library, newest first. Anyone signed in can read them.</p>
        <h3>Lessons · {lessons.length}</h3>
        {lessons.length ? <ul className="library-items">{lessons.map(item)}</ul> : <p className="library-hint">No lesson feedback is open.</p>}
        {fb.canAct && lessons.some((t) => !t.queued) && <div className="library-actions"><button type="button" className="violet-fill" onClick={queueAll}>Queue all lesson feedback for tonight</button></div>}
        <h3>Unit structure · {units.length}</h3>
        <p className="library-hint">Questions about objectives, order and where units sit. These wait for a decision.</p>
        {units.length ? <ul className="library-items">{units.map(item)}</ul> : <p className="library-hint">No unit comments are open.</p>}
        <p className="library-hint">Tonight's queue: {queued} lesson{queued === 1 ? "" : "s"}. A scheduled Claude run at about 2 AM works through the queue and publishes each rebuilt lesson as a new version waiting for a check. Earlier versions are kept.</p>
        {message && <p className="library-status" role="status">{message}</p>}
      </div>
    </div>
  );
}

function Results({ list, found, query, open }: { list: Library; found: Resource[]; query: string; open: (year: number, unit: string, version?: string) => void }) {
  if (!found.length) return <p className="library-message" role="status">Nothing matches “{query}”. Try a unit code such as A7, or one word from the title.</p>;
  return (
    <section className="library-results" aria-label="Search results">
      <p className="library-hint" role="status">{found.length} {found.length === 1 ? "booklet" : "booklets"} found</p>
      <ul className="library-rows">
        {found.map((r) => (
          <li key={r.id} className={`library-row is-${r.status}`}>
            <p className="library-row-title">
              <button type="button" className="library-link" onClick={() => open(r.year, r.unit, r.version)}>Year {r.year} · {isSchemeUnit(r.unit) ? `${r.unit} ${unitOf(list, r.year, r.unit)?.title ?? ""}` : unitOf(list, r.year, r.unit)?.title ?? r.unit}</button>
              {r.lesson && <b> {r.lesson}</b>} {r.title}
            </p>
            <span className="library-row-state">{typeNames[r.type]}{r.version !== "Main" ? ` · ${r.version}` : ""} · {r.status === "ready" ? "Ready" : "Waiting for check"} · {day(r.updated)}</span>
            <FileLinks files={r.files} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function LibraryMap({ list, open }: { list: Library; open: (year: number, unit: string, version?: string) => void }) {
  const fb = useContext(FeedbackContext);
  return (
    <section className="library-map" aria-label="Scheme map">
      <p className="library-hint">Every unit's lessons as squares, one row per version, in teaching order.</p>
      {list.years.map((y) => (
        <div key={y.year} className="library-map-year">
          <h2>Year {y.year}</h2>
          <div className="library-map-units">
            {y.sections.map((section) => (
              <div key={section.name} className="library-map-section">
                <h3>{section.name.replace(/ term$/, "")}{section.estimate && <em> (estimate)</em>}</h3>
                <div className="library-map-cells">
                  {section.units.map((u) => {
                    const versions = versionsOf(list, y.year, u.code);
                    const main = lessonPlan(list, y.year, u.code, "Main", fb.threads);
                    const empty = !resourcesFor(list, y.year, u.code).length;
                    return (
                      <button key={u.code} type="button" className={`library-map-cell${empty ? " is-empty" : ""}`} title={u.title} aria-label={`${isSchemeUnit(u.code) ? `${u.code} ${u.title}` : u.title}: ${summary(main).toLowerCase()}`} onClick={() => open(y.year, u.code)}>
                        <b>{unitLabel(u)}</b>
                        {versions.map((v) => {
                          const rows = v === "Main" ? main : lessonPlan(list, y.year, u.code, v, fb.threads);
                          return <span key={v} className="library-map-version">{versions.length > 1 && <small>{shortVersion(v)}</small>}<Squares rows={rows} starts={partStarts(u, rows)} /></span>;
                        })}
                        {countState(main, "feedback") > 0 && <span className="library-fb">{countState(main, "feedback")} feedback</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
