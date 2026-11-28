import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, CalendarPlus, Check, Clock, Copy, Download, Hand, History, Moon, LayoutGrid, Map as MapIcon, MessageSquare, PencilLine, Search, SlidersHorizontal, Trash2, X } from "lucide-react";
import { PageHeading } from "../site/PageHeading";
import { pageHref, readPage } from "../site/routes";
import {
  adaptationPlan, applyChecks, bookletName, downloads, editHref, countState, fileHref, predictFeedback, fileLabel, isSchemeUnit, lessonPlan, loadFeedback, loadLibrary, partRanges, readState, resourcesFor, ringLabel, searchLibrary, sendFeedback,
  summary, threadKey, threadMap, typeNames, unitBooklets, unitLabel, unitOf, versionsOf, writeState,
  type Feedback, type FeedbackAction, type LessonRow, type LessonState, type Library, type LibraryFile, type LibraryState, type LibraryUnit, type Resource, type Thread,
} from "./model";
import "./library.css";
import CoverRequest from "./CoverRequest";
import { isCoverWork, loadCoverRemoved, removeCoverLesson } from "./cover";
import AdaptForm from "./AdaptForm";
import { loadAdaptRequests, type AdaptAsked, type AdaptKind } from "./adapt";

const YEAR_KEY = "mathsdock.libraryYear";
const savedYear = () => { try { return Number(localStorage.getItem(YEAR_KEY)) || 7; } catch { return 7; } };
const day = (iso: string) => new Date(iso.length === 10 ? `${iso}T12:00:00` : iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
/** M, F, or what is in brackets: "Extra challenge (9X)" is 9X. */
const shortVersion = (v: string) => /\(([^)]+)\)/.exec(v)?.[1] ?? v.split(/\s+/).map((w) => w[0]).join("").toUpperCase().slice(0, 3);
const stateNames: Record<LessonState, string> = { none: "Not made yet", waiting: "Waiting for check", feedback: "Feedback to act on", ready: "Ready" };

type FeedbackTools = { threads: Map<string, Thread>; all: Thread[]; canAct: boolean; off?: string; act: (a: FeedbackAction) => Promise<string> };
const FeedbackContext = createContext<FeedbackTools>({ threads: new Map(), all: [], canAct: false, off: "Loading feedback…", act: async () => "" });
/** Deleting a cover lesson (library editors only): it leaves the list, its files stay in the private store. */

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
  const [removed, setRemoved] = useState<{ ids: Set<string>; canDelete: boolean }>({ ids: new Set(), canDelete: false });
  const [state, setStateValue] = useState<LibraryState>(() => readState(location.search, savedYear()));
  const box = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let live = true;
    loadLibrary().then((l) => live && setList(l), (e: Error) => live && setError(e.message));
    loadFeedback().then((f) => live && setFeedback(f), () => live && setFeedback({ off: "Feedback could not be loaded." }));
    loadCoverRemoved().then((c) => live && setRemoved({ ids: new Set(c.removed), canDelete: c.canDelete }), () => { /* Cover lessons then simply all show. */ });
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
  // A booklet an editor has ticked ✓ Checked at its current version shows green everywhere. Cover work lives only in
  // the Cover library on the Create cover booklet page (Tim, 27 Nov), never on the shelves, search or Map.
  const list = useMemo(() => (raw ? applyChecks({ ...raw, resources: raw.resources.filter((r) => !isCoverWork(r)) }, "off" in feedback ? {} : feedback.checks) : null), [raw, feedback]);
  const covers = useMemo(() => raw?.resources.filter(isCoverWork) ?? [], [raw]);
  const removeCover = useCallback(async (id: string) => { const ids = await removeCoverLesson(id); setRemoved((old) => ({ ...old, ids: new Set([...ids, id]) })); }, []);
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
        <PageHeading title="Resource library" description="Every booklet we have made, by year and unit, at its newest version. Send a colleague a unit's link: they sign in with their school email.">
          {/* Its own colour and place, apart from the Shelves and Map switch (Tim, 27 Nov). */}
          <button type="button" className="library-cover-button" aria-pressed={state.view === "cover"} onClick={() => setState({ view: "cover", q: "" })}><CalendarPlus size={16} aria-hidden="true" />Cover</button>
        </PageHeading>
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
          : state.view === "cover" ? <CoverRequest list={list} covers={covers} removed={removed.ids} canDelete={removed.canDelete} remove={removeCover} />
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
      {/* Clicking the open unit again, or empty space among the units, closes it (Tim, 26 Nov). */}
      <section className="library-units" aria-label={`Year ${year.year} units`} onClick={(e) => { if (unit && !(e.target as HTMLElement).closest("button, a, input") && !window.getSelection()?.toString()) setState({ unit: undefined, version: undefined }, true); }}>
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
                  <button key={u.code} type="button" className={`library-unit${empty ? " is-empty" : ""}${now ? " has-now" : ""}`} aria-pressed={u.code === unit?.code} onClick={() => setState({ unit: u.code === unit?.code ? undefined : u.code, version: undefined }, true)}>
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

function FileLinks({ files, resource }: { files: LibraryFile[]; resource?: Resource }) {
  const edit = resource ? editHref(resource) : null;
  return (
    <span className="library-files">
      {edit && <a href={edit} className="library-file is-edit" aria-label={`Edit ${resource!.title} in the Booklet builder`}><PencilLine size={13} aria-hidden="true" /> Edit</a>}
      {downloads(files).map((f) => (
        <a key={f.href} href={fileHref(f)} className={`library-file${f.role === "answers" ? " is-answers" : ""}`} target={f.format === "pdf" ? "_blank" : undefined} rel="noreferrer" download={f.format === "docx" ? f.name : undefined}>{fileLabel(f)}</a>
      ))}
    </span>
  );
}

function UnitDetail({ list, year, unit, version: asked, setVersion }: { list: Library; year: number; unit: LibraryUnit; version?: string; setVersion: (v: string) => void }) {
  const fb = useContext(FeedbackContext);
  const versions = versionsOf(list, year, unit.code);
  const version = asked && versions.includes(asked) ? asked : "Main";
  const rows = adaptationPlan(list, year, unit.code, version, fb.threads);
  const ranges = partRanges(unit, rows);
  const booklets = unitBooklets(list, year, unit.code, version);
  const items = resourcesFor(list, year, unit.code).filter((r) => r.version === version);
  const unitThread = fb.threads.get(threadKey(year, unit.code, version, null));
  const [message, setMessage] = useState("");
  const [unitBox, setUnitBox] = useState<boolean | null>(null);
  // Adaptations (Tim, 28 Nov): which lesson's form is open (null is the whole unit), and the open requests.
  const [adapt, setAdapt] = useState<{ lesson: string | null } | null>(null);
  const [requests, setRequests] = useState<AdaptAsked[]>([]);
  useEffect(() => { setMessage(""); setAdapt(null); }, [version]);
  useEffect(() => {
    if (!isSchemeUnit(unit.code)) return;
    let live = true;
    loadAdaptRequests(year, unit.code).then((a) => live && setRequests(a), () => { /* The asked-for list is only a help. */ });
    return () => { live = false; };
  }, [year, unit.code]);
  const others = versions.filter((v) => v !== "Main");
  const kinds = Object.fromEntries(others.map((v) => [v, resourcesFor(list, year, unit.code).find((r) => r.version === v && r.adaptation)?.adaptation?.kind as AdaptKind | undefined]));
  const form = (lesson: string | null, title: string) => (
    <AdaptForm key={lesson ?? "unit"} year={year} unit={unit.code} lesson={lesson} title={title} existing={others} current={version} kinds={kinds}
      onCancel={() => setAdapt(null)} onSent={(a, words) => { setRequests((old) => [...old, a]); setAdapt(null); setMessage(words); }} />
  );
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
      for (const r of items) for (const f of downloads(r.files)) {
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
          <div className="library-tabs" role="group" aria-label="Adaptations">
            {versions.map((v) => {
              const flagged = lessonPlan(list, year, unit.code, v, fb.threads).some((r) => r.state === "feedback");
              return <button key={v} type="button" aria-pressed={v === version} onClick={() => setVersion(v)}>{v}{flagged && <i className="library-dot" aria-label="has feedback" />}</button>;
            })}
          </div>
          <p className="library-hint">{version === "Main" ? "Each adaptation sits beside Main and is checked on its own." : "Each adaptation sits beside Main and is checked on its own. Lessons it leaves as they are show Main, greyed."}</p>
        </>
      )}
      <div className="library-actions">
        <button type="button" className="primary" onClick={copyLink}><Copy size={15} aria-hidden="true" />Copy link</button>
        {items.length > 0 && <button type="button" onClick={downloadUnit}><Download size={15} aria-hidden="true" />Download all (zip)</button>}
        {scheme && <button type="button" aria-expanded={adapt?.lesson === null} onClick={() => setAdapt(adapt?.lesson === null ? null : { lesson: null })}><SlidersHorizontal size={15} aria-hidden="true" />Adapt whole unit</button>}
        {scheme && !fb.off && <button type="button" className="violet" aria-expanded={showUnitBox} onClick={() => setUnitBox(!showUnitBox)}><MessageSquare size={15} aria-hidden="true" />Feedback on this unit{unitThread ? ` (${unitThread.comments.length})` : ""}</button>}
      </div>
      {fb.off && fb.off !== "Loading feedback…" && <p className="library-hint">{fb.off}</p>}
      {message && <p className="library-status" role="status">{message}</p>}
      {adapt?.lesson === null && form(null, unit.title)}
      {requests.length > 0 && (
        <div className="library-asked">
          <p className="library-adapt-label">Adaptations asked for</p>
          <ul>{requests.map((a) => <li key={`${a.number}-${a.name}-${a.lesson}`}><b>{a.name}</b> · {a.lesson ?? "whole unit"} · {a.mine ? "you" : a.who}, {day(a.when)}</li>)}</ul>
        </div>
      )}
      {showUnitBox && <ThreadView target={{ year, unit: unit.code, version, lesson: null }} thread={unitThread} />}
      {(ranges ?? [{ name: "", start: 0, end: rows.length - 1, from: "", to: "" }]).map((p) => {
        const booklet = booklets.find((b) => (p.name ? b.part === p.name : !b.part)) ?? (ranges ? undefined : booklets[0]);
        if (!booklet) return null;
        return (
          <div key={p.name || "whole"} className="library-part">
            <div className="library-part-head"><span>{p.name ? `${p.name} · ${p.from} to ${p.to}` : "Unit booklet"}</span><Squares rows={rows.slice(p.start, p.end + 1)} /></div>
            <BookletLine booklet={booklet} year={year} unit={unit.code} version={version} heading={p.name ? "" : unit.title} />
          </div>
        );
      })}
      {!items.length && <p className="library-hint">Nothing made yet for this {version === "Main" ? "unit" : "adaptation"}. Its lessons are listed below.</p>}
      <ul className="library-rows">
        {rows.map((row, i) => {
          const canAdapt = scheme && !!row.code && !!(row.resource || row.main);
          return <LessonLine key={row.code || row.resource?.id} row={row} year={year} unit={unit.code} version={version} part={ranges?.find((p) => p.start === i)?.name}
            onAdapt={canAdapt ? () => setAdapt(adapt?.lesson === row.code ? null : { lesson: row.code }) : undefined} adapting={canAdapt && adapt?.lesson === row.code ? form(row.code, row.title) : null} />;
        })}
      </ul>
    </>
  );
}

type Target = { year: number; unit: string; version: string; lesson: string | null; booklet?: string | null };
type Ask = null | "waiting" | "checked";

/**
 * The status switch (Tim, 25 Nov): Waiting (clock) · Feedback (speech bubble, a moon when queued) · Checked (tick), the lit part always in the row's
 * colour. Editors tap a part to set it; colleagues see the lit part as a label. Feedback lights at once and opens the comment
 * box and sticks once a comment is sent; Waiting is the undo. On narrow screens only the lit part keeps its word.
 */
function StatusSwitch({ status, queued, canAct, busy, label, onPick }: { status: "waiting" | "feedback" | "ready"; queued: boolean; canAct: boolean; busy: boolean; label: string; onPick: (to: "waiting" | "feedback" | "ready") => void }) {
  const parts = [
    { to: "waiting", Icon: Clock, word: "Waiting" },
    { to: "feedback", Icon: queued ? Moon : MessageSquare, word: "Feedback" },
    { to: "ready", Icon: Check, word: "Checked" },
  ] as const;
  if (!canAct) {
    const on = parts.find((p) => p.to === status)!;
    return <span className={`library-switch is-label is-${status}`}><span className="on"><on.Icon size={14} aria-hidden="true" />{on.word}</span></span>;
  }
  return (
    <span className={`library-switch is-${status}`} role="group" aria-label={`Status of ${label}`}>
      {parts.map((p) => (
        <button key={p.to} type="button" className={p.to === status ? "on" : ""} aria-pressed={p.to === status} disabled={busy} onClick={() => onPick(p.to)}>
          <p.Icon size={14} aria-hidden="true" /><span className="word">{p.word}</span>
        </button>
      ))}
    </span>
  );
}

/**
 * Everything a made lesson or unit booklet row does with its status: the switch, the line saying who set
 * it, the confirm before closing comments or cancelling a rebuild, and the comment thread.
 */
function useStatus(t: Target, r: Resource, thread: Thread | undefined) {
  const fb = useContext(FeedbackContext);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [ask, setAsk] = useState<Ask>(null);
  const [open, setOpen] = useState<boolean | null>(null);
  // Tapping Feedback lights it at once while the comment is written; cancelling goes back.
  const [draft, setDraft] = useState(false);
  const status: "waiting" | "feedback" | "ready" = thread || draft ? "feedback" : r.status;
  async function run(...actions: FeedbackAction[]) {
    setBusy(true); setMessage(""); setAsk(null);
    try { let warning = ""; for (const a of actions) warning = (await fb.act(a)) || warning; setMessage(warning); }
    catch (e) { setMessage((e as Error).message); }
    finally { setBusy(false); }
  }
  const base = { year: t.year, unit: t.unit, version: t.version, lesson: t.lesson, booklet: t.booklet ?? null, id: r.id, updated: r.updated };
  const toChecked = (cancelQueued = false) => run({ action: "check", ...base, close: !!thread, cancelQueued });
  const toWaiting = () => run(...[thread && { action: "no-change", ...base } as FeedbackAction, r.checked && { action: "uncheck", ...base } as FeedbackAction].filter((a): a is FeedbackAction => !!a));
  function pick(to: "waiting" | "feedback" | "ready") {
    // While unsent feedback is being written, Waiting cancels it and Checked replaces it.
    if (draft && !thread && to !== "feedback") { setDraft(false); setOpen(false); if (to === "waiting") return; }
    if (to === status) { if (to === "feedback") setOpen(true); return; }
    if (to === "feedback") { setDraft(true); setOpen(true); setMessage(""); return; }
    if (to === "ready") { if (thread?.queued) setAsk("checked"); else void toChecked(); return; }
    if (thread) setAsk("waiting");
    else if (r.checked) void toWaiting();
    else setMessage("This booklet was published as ready, so it can't be put back to waiting here. Ask Claude to change it.");
  }
  // The Worker takes any check off when a comment arrives, so the colour says Feedback after the reload.
  const onSent = () => { setMessage(""); setDraft(false); };
  // Closing the box without sending takes back an unsent Feedback.
  const close = () => { setDraft(false); setOpen(false); };
  const [Icon, words] = thread?.queued ? [Moon, `Queued for tonight · ${thread.comments.length} comment${thread.comments.length === 1 ? "" : "s"}`]
    : draft && !thread ? [MessageSquare, "Feedback: say what needs changing, then Send"]
    : thread ? [MessageSquare, `Feedback from ${thread.comments[0]?.who ?? "a colleague"} · ${day(thread.opened)}`]
    : r.checked ? [Check, `Checked by ${r.checked.by} · ${day(r.checked.at || r.checked.updated)}`]
    : r.status === "ready" ? [Check, `Ready · ${day(r.updated)}`] : [Clock, `Waiting for a check · made ${day(r.updated)}`];
  const who = <><Icon size={13} aria-hidden="true" />{words}</>;
  const confirm = ask && (
    <div className="library-confirm" role="group" aria-label="Confirm">
      {ask === "checked" ? <p>This is queued for a rebuild tonight. Mark it Checked and cancel the rebuild?</p> : <p>Close the {thread?.comments.length ?? 0} comment{thread?.comments.length === 1 ? "" : "s"}{thread?.queued ? " and cancel tonight's rebuild" : ""}{r.status === "ready" && !r.checked ? "?" : " and put it back to Waiting?"}</p>}
      <div className="library-actions">
        {ask === "checked" ? <button type="button" className="green-fill" onClick={() => toChecked(true)}>Yes, it's fine</button> : <button type="button" className="primary" onClick={toWaiting}>Yes, close them</button>}
        <button type="button" onClick={() => setAsk(null)}>{ask === "checked" ? "Keep the rebuild" : "Keep the comments"}</button>
      </div>
    </div>
  );
  return { status, busy, message, confirm, who, pick, onSent, close, open: open ?? !!thread, setOpen: (v: boolean) => (v ? setOpen(true) : close()) };
}

function CommentCount({ thread, open, setOpen }: { thread?: Thread; open: boolean; setOpen: (v: boolean) => void }) {
  const n = thread?.comments.length ?? 0;
  return <button type="button" className="library-count" aria-expanded={open} aria-label={`${n} comment${n === 1 ? "" : "s"}`} onClick={() => setOpen(!open)}><MessageSquare size={14} aria-hidden="true" />{n}</button>;
}

function LessonLine({ row, year, unit, version, part, onAdapt, adapting }: { row: LessonRow; year: number; unit: string; version: string; part?: string; onAdapt?: () => void; adapting?: React.ReactNode }) {
  const fb = useContext(FeedbackContext);
  const r = row.resource;
  const [history, setHistory] = useState(false);
  return (
    <li className={`library-row is-${row.main ? "main" : row.state}`}>
      {part && <p className="library-part-label">{part}</p>}
      {row.main ? <MainRow row={row} main={row.main} onAdapt={onAdapt} />
        : r && row.code && !fb.off ? <MadeRow t={{ year, unit, version, lesson: row.code }} r={r} thread={row.thread} title={<><b>{row.code}</b> {row.title}</>} history={history} setHistory={setHistory} onAdapt={onAdapt} />
        : <PlainRow row={row} t={{ year, unit, version, lesson: row.code || null }} history={history} setHistory={setHistory} onAdapt={onAdapt} />}
      {adapting}
    </li>
  );
}

const AdaptLink = ({ onAdapt }: { onAdapt?: () => void }) => (onAdapt ? <>{" · "}<button type="button" className="library-link" onClick={onAdapt}><SlidersHorizontal size={13} aria-hidden="true" />Adapt</button></> : null);

/** A lesson an adaptation leaves as it is: Main's booklet, greyed, so the whole unit reads in one list. */
function MainRow({ row, main, onAdapt }: { row: LessonRow; main: Resource; onAdapt?: () => void }) {
  return (
    <>
      <div className="library-row-main">
        <i className={`library-sq is-${main.status}`} aria-hidden="true" />
        <span className="library-row-text">
          <span className="library-row-title"><b>{row.code}</b> {row.title}</span>
          <span className="library-row-state">Same as Main · {stateNames[main.status]}<AdaptLink onAdapt={onAdapt} /></span>
        </span>
      </div>
      <FileLinks files={main.files} />
    </>
  );
}

function MadeRow({ t, r, thread, title, history, setHistory, onAdapt }: { t: Target; r: Resource; thread?: Thread; title: React.ReactNode; history?: boolean; setHistory?: (v: boolean) => void; onAdapt?: () => void }) {
  const fb = useContext(FeedbackContext);
  const s = useStatus(t, r, thread);
  const label = t.lesson ?? t.booklet ?? r.title;
  return (
    <>
      <div className="library-row-main">
        <i className={`library-sq is-${s.status}`} aria-hidden="true" />
        <span className="library-row-text">
          <span className="library-row-title">{title}</span>
          <span className={`library-row-state is-${s.status}`}>{s.who}{setHistory && <>{" · "}<button type="button" className="library-link" aria-expanded={history} onClick={() => setHistory(!history)}><History size={13} aria-hidden="true" />{r.history.length ? `${r.history.length} earlier version${r.history.length === 1 ? "" : "s"}` : "History"}</button></>}<AdaptLink onAdapt={onAdapt} /></span>
        </span>
        <StatusSwitch status={s.status} queued={!!thread?.queued} canAct={fb.canAct} busy={s.busy} label={label} onPick={s.pick} />
        <CommentCount thread={thread} open={s.open} setOpen={s.setOpen} />
      </div>
      <FileLinks files={r.files} resource={r} />
      {history && <HistoryList resource={r} year={t.year} unit={t.unit} version={t.version} />}
      {s.confirm}
      {s.message && <p className="library-status" role="status">{s.message}</p>}
      {s.open && <ThreadView target={t} thread={thread} onSent={s.onSent} onClose={s.close} />}
    </>
  );
}

/** A lesson not made yet (anyone can ask for it), a starter, or a row when feedback is off. */
function PlainRow({ row, t, history, setHistory, onAdapt }: { row: LessonRow; t: Target; history: boolean; setHistory: (v: boolean) => void; onAdapt?: () => void }) {
  const fb = useContext(FeedbackContext);
  const r = row.resource;
  const [open, setOpen] = useState<boolean | null>(null);
  const canAsk = !r && !!row.code && !fb.off;
  const shown = canAsk && (open ?? !!row.thread);
  return (
    <>
      <div className="library-row-main">
        <i className={`library-sq is-${row.state}`} aria-hidden="true" />
        <span className="library-row-text">
          <span className="library-row-title">{row.code && <b>{row.code}</b>} {row.title}</span>
          {r && <span className="library-row-state">{stateNames[r.status]} · {day(r.updated)} <button type="button" className="library-link" aria-expanded={history} onClick={() => setHistory(!history)}><History size={13} aria-hidden="true" />{r.history.length ? `${r.history.length} earlier version${r.history.length === 1 ? "" : "s"}` : "History"}</button><AdaptLink onAdapt={onAdapt} /></span>}
          {!r && row.thread && <span className="library-row-state"><Hand size={13} aria-hidden="true" />Asked for by {row.thread.comments[0]?.who ?? "a colleague"}</span>}
        </span>
        {canAsk && (row.thread ? <CommentCount thread={row.thread} open={!!shown} setOpen={setOpen} /> : <button type="button" className="library-chip" aria-expanded={!!shown} onClick={() => setOpen(!shown)}><Hand size={14} aria-hidden="true" />Ask for this</button>)}
      </div>
      {r && <FileLinks files={r.files} resource={r} />}
      {r && history && <HistoryList resource={r} year={t.year} unit={t.unit} version={t.version} />}
      {shown && <ThreadView target={t} thread={row.thread} ask />}
    </>
  );
}

/** A unit booklet: its own cover, contents, topic pages and assembly, checked and commented on apart from its lessons. */
function BookletLine({ booklet, year, unit, version, heading }: { booklet: Resource; year: number; unit: string; version: string; heading: string }) {
  const fb = useContext(FeedbackContext);
  const name = bookletName(booklet);
  const thread = fb.threads.get(threadKey(year, unit, version, null, name));
  if (fb.off) return <FileLinks files={booklet.files} resource={booklet} />;
  return (
    <div className={`library-row is-booklet is-${thread ? "feedback" : booklet.status}`}>
      <MadeRow t={{ year, unit, version, lesson: null, booklet: name }} r={booklet} thread={thread} title={<><BookOpen size={15} aria-hidden="true" /> <b>Unit booklet</b> {heading}</>} />
    </div>
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

function ThreadView({ target, thread, onSent, onClose, ask = false }: { target: Target; thread?: Thread; onSent?: () => void; onClose?: () => void; ask?: boolean }) {
  const fb = useContext(FeedbackContext);
  const { year, unit, version, lesson } = target;
  const booklet = target.booklet ?? null;
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  // A deleted comment hides at once and is only sent after a few seconds, so Undo is instant.
  const [gone, setGone] = useState<number[]>([]);
  const timers = useRef(new Map<number, number>());
  // Closing the comments (or leaving the unit) sends any pending delete at once rather than dropping it.
  const pending = useRef(new Map<number, () => void>());
  useEffect(() => () => { for (const [id, t] of timers.current) { window.clearTimeout(t); pending.current.get(id)?.(); } }, []);
  async function run(action: FeedbackAction["action"], done: string) {
    setBusy(true); setMessage("");
    try { await fb.act({ action, year, unit, version, lesson, booklet, text: action === "comment" ? text : undefined }); if (action === "comment") { setText(""); onSent?.(); } setMessage(done); }
    catch (e) { setMessage((e as Error).message); }
    finally { setBusy(false); }
  }
  function remove(id: number) {
    setGone((g) => [...g, id]);
    const send = () => {
      timers.current.delete(id); pending.current.delete(id);
      fb.act({ action: "delete", year, unit, version, lesson, booklet, comment: id }).then(() => setGone((g) => g.filter((x) => x !== id)), (e: Error) => { setGone((g) => g.filter((x) => x !== id)); setMessage(e.message); });
    };
    pending.current.set(id, send);
    timers.current.set(id, window.setTimeout(send, 5000));
  }
  function undo(id: number) { window.clearTimeout(timers.current.get(id)); timers.current.delete(id); pending.current.delete(id); setGone((g) => g.filter((x) => x !== id)); }
  const forUnit = lesson === null && !booklet;
  const name = forUnit ? "this unit" : booklet ? `the unit booklet${booklet === "Unit booklet" ? "" : ` (${booklet})`}` : lesson;
  return (
    <div className={`library-thread${forUnit ? " is-unit" : ""}`} role="group" aria-label={forUnit ? "Feedback on this unit" : booklet ? `Feedback on ${name}` : `Feedback on ${lesson}`}>
      {forUnit && <p className="library-thread-label">Unit structure: objectives, lesson order, combining or splitting lessons, where the unit sits</p>}
      {booklet && <p className="library-thread-label">The unit booklet's own pages: cover, contents, topic introduction, Know it, Do it, and how the lessons are put together</p>}
      {thread?.comments.length ? thread.comments.map((c, i) => c.id !== undefined && gone.includes(c.id)
        ? <div key={c.id} className="library-comment is-gone"><span className="library-who">Comment deleted · <button type="button" className="library-link" onClick={() => undo(c.id!)}>Undo</button></span></div>
        : <div key={c.id ?? i} className="library-comment"><span className="library-who"><b>{c.who}</b> · {day(c.when)}{c.mine && c.id !== undefined && <button type="button" className="library-link library-delete" onClick={() => remove(c.id!)} aria-label={`Delete your comment from ${day(c.when)}`}><Trash2 size={12} aria-hidden="true" />Delete</button>}</span><p>{c.text}</p></div>
      ) : <p className="library-hint">{ask ? "Ask for this lesson to be made: say which class needs it, and by when." : `No comments on ${name} yet. Anyone signed in can read them.`}</p>}
      <label className="library-say">
        <span className="sr-only">Add a comment</span>
        <textarea rows={2} value={text} maxLength={2000} autoFocus={!thread} placeholder={forUnit ? "Suggest a change to how this unit is put together…" : ask ? "Which class needs it, and by when?" : "Add a comment: what to change, and where (page, question)…"} onChange={(e) => setText(e.target.value)} />
      </label>
      <div className="library-actions">
        <button type="button" className="primary" disabled={busy || !text.trim()} onClick={() => run("comment", ask && !thread ? "Asked. It shows in Feedback to act on." : "Comment added.")}>Send</button>
        {onClose && <button type="button" disabled={busy} onClick={onClose}>{thread ? "Close" : "Cancel"}</button>}
        {fb.canAct && thread && !forUnit && !thread.queued && <button type="button" className="violet-fill" disabled={busy} onClick={() => run("queue", "Queued for tonight's run.")}><Moon size={14} aria-hidden="true" />Queue for tonight</button>}
        {fb.canAct && thread && !forUnit && thread.queued && <button type="button" disabled={busy} onClick={() => run("unqueue", "Taken out of the queue.")}>Take out of the queue</button>}
        {fb.canAct && thread && ask && <button type="button" disabled={busy} onClick={() => run("no-change", "Closed.")}>Close the request</button>}
        {fb.canAct && thread && forUnit && !thread.agreed && <button type="button" disabled={busy} onClick={() => run("agree", "Agreed. Plan the change in a thread with Claude.")}>Agree: plan the change</button>}
        {fb.canAct && thread && forUnit && <button type="button" disabled={busy} onClick={() => run("keep", "Closed: the unit stays as it is.")}>Keep as it is</button>}
      </div>
      {thread?.queued && <p className="library-toast">Queued for tonight's run. At 10 PM Claude asks Tim whether to run it; if he says yes, it is rebuilt from these comments, comes back here amber, waiting for a check, and the comments are closed.</p>}
      {forUnit && <p className="library-hint">{thread?.agreed ? "Agreed: waiting to be planned. " : ""}Unit comments never go in the nightly queue: they wait for a decision.</p>}
      {message && <p className="library-status" role="status">{message}</p>}
    </div>
  );
}

function Drawer({ list, close, open }: { list: Library; close: () => void; open: (year: number, unit: string, version?: string) => void }) {
  const fb = useContext(FeedbackContext);
  const [message, setMessage] = useState("");
  const made = (t: Thread) => t.kind === "booklet" || list.resources.some((r) => r.year === t.year && r.unit === t.unit && r.version === t.version && r.lesson === t.lesson);
  const lessons = fb.all.filter((t) => t.kind !== "unit" && made(t)), asks = fb.all.filter((t) => t.kind === "lesson" && !made(t)), units = fb.all.filter((t) => t.kind === "unit");
  const queued = lessons.filter((t) => t.queued).length;
  const title = (t: Thread) => {
    const u = unitOf(list, t.year, t.unit);
    const name = t.lesson ? u?.lessons?.find((l) => l.code === t.lesson)?.title ?? list.resources.find((r) => r.year === t.year && r.unit === t.unit && r.lesson === t.lesson)?.title ?? "" : u?.title ?? "";
    if (t.booklet) return `Y${t.year} · ${t.unit} unit booklet${t.booklet === "Unit booklet" ? "" : ` · ${t.booklet}`}${t.version === "Main" ? "" : ` · ${t.version}`}`;
    return `Y${t.year} · ${t.lesson ?? t.unit} ${name}${t.version === "Main" ? "" : ` · ${t.version}`}`;
  };
  const queue = (t: Thread) => fb.act({ action: "queue", year: t.year, unit: t.unit, version: t.version, lesson: t.lesson, booklet: t.booklet ?? null });
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
          <button type="button" onClick={() => open(t.year, t.unit, t.version)}>Open {t.kind === "lesson" ? "lesson" : "unit"}</button>
          {fb.canAct && t.kind !== "unit" && made(t) && !t.queued && <button type="button" className="violet-fill" onClick={() => queue(t).catch((e: Error) => setMessage(e.message))}>Queue for tonight</button>}
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
        <h3>Asked for · {asks.length}</h3>
        <p className="library-hint">Lessons colleagues have asked to be made.</p>
        {asks.length ? <ul className="library-items">{asks.map(item)}</ul> : <p className="library-hint">Nobody has asked for a lesson.</p>}
        <h3>Unit structure · {units.length}</h3>
        <p className="library-hint">Questions about objectives, order and where units sit. These wait for a decision.</p>
        {units.length ? <ul className="library-items">{units.map(item)}</ul> : <p className="library-hint">No unit comments are open.</p>}
        <p className="library-hint">Tonight's queue: {queued} lesson{queued === 1 ? "" : "s"}. At 10 PM Claude asks Tim whether to run it; the run publishes each rebuilt lesson as a new version waiting for a check. Earlier versions are kept.</p>
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
            <FileLinks files={r.files} resource={r} />
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
