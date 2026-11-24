import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Check, Copy, Download, LayoutGrid, Map as MapIcon, Search } from "lucide-react";
import { PageHeading } from "../site/PageHeading";
import { pageHref, readPage } from "../site/routes";
import {
  fileHref, fileLabel, isSchemeUnit, lessonRows, loadLibrary, readState, resourcesFor, searchLibrary, shelfOf, typeNames, unitLabel, unitOf, writeState,
  type Library, type LibraryState, type Resource, type Shelf,
} from "./model";
import "./library.css";

const YEAR_KEY = "mathsdock.libraryYear";
const savedYear = () => { try { return Number(localStorage.getItem(YEAR_KEY)) || 7; } catch { return 7; } };
const shelfNames: Record<Shelf, string> = { booklets: "Booklets", worksheets: "A3 worksheets", other: "Starters and skill sheets" };
const day = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

/**
 * Resource library (docs/content/RESOURCE-LIBRARY.md): pick a year, then a unit, and its booklets,
 * A3 worksheets and answers are on the right. The search above finds any resource in every year;
 * the Map view shows the whole scheme with what exists for each unit.
 */
export default function ResourceLibrary({ active = true }: { active?: boolean }) {
  const [list, setList] = useState<Library | null>(null);
  const [error, setError] = useState("");
  const [state, setStateValue] = useState<LibraryState>(() => readState(location.search, savedYear()));
  const box = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let live = true;
    loadLibrary().then((l) => live && setList(l), (e: Error) => live && setError(e.message));
    return () => { live = false; };
  }, []);
  // Back and Forward within the page restore its state from the address.
  useEffect(() => {
    if (!active) return;
    const back = () => { if (readPage() === "library") setStateValue(readState(location.search, savedYear())); };
    window.addEventListener("popstate", back);
    return () => window.removeEventListener("popstate", back);
  }, [active]);
  // Press / to search, as on Home and the Diagram builder.
  useEffect(() => {
    if (!active) return;
    function key(event: KeyboardEvent) {
      if (event.key !== "/" || event.ctrlKey || event.metaKey || event.altKey) return;
      if ((event.target as HTMLElement).closest("input, textarea, select, [contenteditable='true']")) return;
      event.preventDefault();
      box.current?.focus();
    }
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [active]);

  function setState(next: Partial<LibraryState>, push = false) {
    const value = { ...state, ...next };
    setStateValue(value);
    try { localStorage.setItem(YEAR_KEY, String(value.year)); } catch { /* The year is only a convenience. */ }
    const address = pageHref("library") + writeState(value);
    if (push) history.pushState({}, "", address); else history.replaceState({}, "", address);
    window.dispatchEvent(new Event("maths-tools:route"));
  }
  const openUnit = (year: number, unit: string) => setState({ year, unit, view: "shelves", q: "" }, true);
  const found = useMemo(() => (list ? searchLibrary(list, state.q) : []), [list, state.q]);

  return (
    <main className="resource-library" id="main-content" tabIndex={-1}>
      <PageHeading title="Resource library" description="Everything we have made, by year and unit, at its newest version. Send a colleague a unit's link: they sign in with their school email." />
      <div className="library-controls">
        <label className="library-search">
          <Search size={18} aria-hidden="true" />
          <span className="sr-only">Search the library</span>
          <input ref={box} type="search" value={state.q} placeholder="Search a code, title or topic: A7.03, gradient, pie charts…" onChange={(e) => setState({ q: e.target.value })} />
          {!state.q && <kbd aria-hidden="true">/</kbd>}
        </label>
        <div className="library-views" role="group" aria-label="View">
          <button type="button" aria-pressed={state.view === "shelves"} onClick={() => setState({ view: "shelves", q: "" })}><LayoutGrid size={16} aria-hidden="true" />Shelves</button>
          <button type="button" aria-pressed={state.view === "map"} onClick={() => setState({ view: "map", q: "" })}><MapIcon size={16} aria-hidden="true" />Map</button>
        </div>
      </div>
      {error ? <p className="library-message" role="alert">{error}</p>
        : !list ? <p className="library-message" role="status">Loading the library…</p>
        : state.q ? <Results list={list} found={found} query={state.q} open={openUnit} />
        : state.view === "map" ? <LibraryMap list={list} open={openUnit} />
        : <Shelves list={list} state={state} setState={setState} />}
    </main>
  );
}

function Shelves({ list, state, setState }: { list: Library; state: LibraryState; setState: (s: Partial<LibraryState>, push?: boolean) => void }) {
  const year = list.years.find((y) => y.year === state.year) ?? list.years[0];
  const unit = state.unit ? unitOf(list, year.year, state.unit) : undefined;
  return (
    <div className="library-shelves">
      <nav className="library-years" aria-label="Years">
        {list.years.map((y) => {
          const units = new Set(list.resources.filter((r) => r.year === y.year).map((r) => r.unit)).size;
          return <button key={y.year} type="button" aria-pressed={y.year === year.year} onClick={() => setState({ year: y.year, unit: undefined }, true)}>Year {y.year}<small>{units} {units === 1 ? "unit" : "units"}</small></button>;
        })}
      </nav>
      <section className="library-units" aria-label={`Year ${year.year} units`}>
        <h2>Year {year.year}</h2>
        <p className="library-hint">Units in teaching order. Grey units have nothing yet.</p>
        {year.sections.map((section) => (
          <div key={section.name} className="library-section">
            <h3>{section.name}</h3>
            <div className="library-unit-grid">
              {section.units.map((u) => {
                const items = resourcesFor(list, year.year, u.code);
                const waiting = items.filter((r) => r.status === "waiting").length;
                return (
                  <button key={u.code} type="button" className={`library-unit${items.length ? "" : " is-empty"}`} aria-pressed={u.code === unit?.code} onClick={() => setState({ unit: u.code }, true)}>
                    {isSchemeUnit(u.code) ? <><span className="library-unit-code">{u.code}</span><span className="library-unit-title">{u.title}</span></> : <span className="library-unit-code">{u.title}</span>}
                    <span className="library-unit-meta">{items.length ? `${items.length} ${items.length === 1 ? "resource" : "resources"}${waiting ? ` · ${waiting} waiting for check` : ""}` : "Nothing yet"}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </section>
      <aside className="library-detail" aria-label="Unit resources">
        {unit ? <UnitDetail list={list} year={year.year} code={unit.code} title={unit.title} /> : <p className="library-hint">Choose a unit to see its booklets, A3 worksheets and answers here.</p>}
      </aside>
    </div>
  );
}

function UnitDetail({ list, year, code, title }: { list: Library; year: number; code: string; title: string }) {
  const items = resourcesFor(list, year, code);
  const [message, setMessage] = useState("");
  useEffect(() => setMessage(""), [year, code]);
  const latest = items.map((r) => r.updated).sort().at(-1);
  async function copyLink() {
    const link = new URL(pageHref("library") + writeState({ year, unit: code, view: "shelves", q: "" }), location.origin).href;
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
      a.href = url; a.download = `Year-${year}-${code}-resources.zip`; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      setMessage("Download started.");
    } catch (e) { setMessage(`A file could not be downloaded (${(e as Error).message}). Try again, or open the files one at a time.`); }
  }
  return (
    <>
      <h2>{isSchemeUnit(code) ? `${code} ${title}` : title}</h2>
      <p className="library-hint">Year {year}{latest ? ` · Updated ${day(latest)}` : ""}</p>
      {items.length > 0 && (
        <div className="library-actions">
          <button type="button" className="primary" onClick={copyLink}><Copy size={15} aria-hidden="true" />Copy link</button>
          <button type="button" onClick={downloadUnit}><Download size={15} aria-hidden="true" />Download unit (zip)</button>
        </div>
      )}
      {message && <p className="library-status" role="status">{message}</p>}
      {items.length === 0 ? <p className="library-hint">Nothing has been made for this unit yet.</p> : (
        <ul className="library-rows">
          {lessonRows(items).map((row) => (
            <li key={row.lesson || row.items[0].id}>
              <p className="library-row-title">{row.lesson && <b>{row.lesson}</b>} {row.title}</p>
              {row.items.map((r) => <ResourceLine key={r.id} resource={r} />)}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function ResourceLine({ resource, showTitle = false }: { resource: Resource; showTitle?: boolean }) {
  return (
    <div className={`library-resource${resource.status === "waiting" ? " is-waiting" : ""}`}>
      <span className="library-type">{typeNames[resource.type]}{showTitle && <> · {resource.title}</>}</span>
      <span className="library-files">
        {resource.files.map((f) => (
          <a key={f.name} href={fileHref(f)} className={`library-file${f.role === "answers" ? " is-answers" : ""}`} target={f.format === "pdf" ? "_blank" : undefined} rel="noreferrer" download={f.format === "docx" ? f.name : undefined}>{fileLabel(f)}</a>
        ))}
      </span>
      {resource.status === "waiting"
        ? <span className="library-badge is-waiting"><AlertTriangle size={13} aria-hidden="true" />Waiting for check</span>
        : <span className="library-badge is-ready"><Check size={13} aria-hidden="true" />Ready</span>}
      <span className="library-updated">{day(resource.updated)}</span>
    </div>
  );
}

function Results({ list, found, query, open }: { list: Library; found: Resource[]; query: string; open: (year: number, unit: string) => void }) {
  if (!found.length) return <p className="library-message" role="status">Nothing matches “{query}”. Try a unit code such as A7, or one word from the title.</p>;
  return (
    <section className="library-results" aria-label="Search results">
      <p className="library-hint" role="status">{found.length} {found.length === 1 ? "resource" : "resources"} found</p>
      <ul className="library-rows">
        {found.map((r) => (
          <li key={r.id}>
            <p className="library-row-title">
              <button type="button" className="library-link" onClick={() => open(r.year, r.unit)}>Year {r.year} · {isSchemeUnit(r.unit) ? `${r.unit} ${unitOf(list, r.year, r.unit)?.title ?? ""}` : unitOf(list, r.year, r.unit)?.title ?? r.unit}</button>
              {r.lesson && <b> {r.lesson}</b>}
            </p>
            <ResourceLine resource={r} showTitle />
          </li>
        ))}
      </ul>
    </section>
  );
}

function LibraryMap({ list, open }: { list: Library; open: (year: number, unit: string) => void }) {
  return (
    <section className="library-map" aria-label="Scheme map">
      <p className="library-legend">
        {(Object.keys(shelfNames) as Shelf[]).map((s) => <span key={s}><i className={`library-dot is-${s}`} aria-hidden="true" />{shelfNames[s]}</span>)}
        <span><i className="library-dot" aria-hidden="true" />Nothing yet</span>
      </p>
      {list.years.map((y) => (
        <div key={y.year} className="library-map-year">
          <h2>Year {y.year}</h2>
          <div className="library-map-units">
            {y.sections.map((section) => (
              <div key={section.name} className="library-map-section">
                <h3>{section.name}</h3>
                <div className="library-map-cells">
                  {section.units.map((u) => {
                    const items = resourcesFor(list, y.year, u.code);
                    const shelves = new Set(items.map((r) => shelfOf(r.type)));
                    const summary = items.length ? (Object.keys(shelfNames) as Shelf[]).filter((s) => shelves.has(s)).map((s) => shelfNames[s]).join(", ") : "nothing yet";
                    return (
                      <button key={u.code} type="button" className={`library-map-cell${items.length ? "" : " is-empty"}`} title={u.title} aria-label={`${isSchemeUnit(u.code) ? `${u.code} ${u.title}` : u.title}: ${summary}`} onClick={() => open(y.year, u.code)}>
                        <b>{unitLabel(u)}</b>
                        <span className="library-dots" aria-hidden="true">{(Object.keys(shelfNames) as Shelf[]).map((s) => <i key={s} className={`library-dot${shelves.has(s) ? ` is-${s}` : ""}`} />)}</span>
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
