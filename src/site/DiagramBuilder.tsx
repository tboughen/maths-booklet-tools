import { useEffect, useRef, useState, type ReactNode } from "react";
import { LayoutGrid, Grid3X3, Tags, Settings2, Star, ZoomIn, X } from "lucide-react";
import { PageHeading } from "./PageHeading";
import { bookletTools, pageHref } from "./registry";
import { setHousePreference, useHousePreference } from "./houseStyle";
import { catalogue, isNew, searchTool, strands, type StrandId } from "./toolCatalogue";
import { HOUSE_STYLES, HOUSE_STYLE_NAMES, LINE_WEIGHTS, LINE_WEIGHT_NAMES, type HouseStyle, type LineWeight } from "../../packages/envelope-core/src/house-style";
import "./diagram-builder.css";

type Tool = (typeof bookletTools)[number];
type View = "pictures" | "compact" | "topics";
const VIEWS: { id: View; name: string; icon: ReactNode }[] = [
  { id: "pictures", name: "Pictures", icon: <LayoutGrid size={15} aria-hidden="true" /> },
  { id: "compact", name: "Compact", icon: <Grid3X3 size={15} aria-hidden="true" /> },
  { id: "topics", name: "Topics", icon: <Tags size={15} aria-hidden="true" /> },
];
const VIEW_KEY = "mathsdock.toolsView";
const FAVOURITES_KEY = "mathsdock.favouriteTools";

function load<T>(key: string, check: (value: unknown) => value is T, fallback: T): T {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) ?? "null");
    return check(value) ? value : fallback;
  } catch {
    return fallback;
  }
}
function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* Private windows may refuse storage: the choice still applies until the page closes. */
  }
}
const isView = (v: unknown): v is View => VIEWS.some((view) => view.id === v);
const isIds = (v: unknown): v is string[] => Array.isArray(v) && v.every((id) => typeof id === "string");

/** The Diagram builder page: every diagram tool as a picture, grouped by GCSE strand. */
export function DiagramBuilder() {
  const [search, setSearch] = useState("");
  const [strand, setStrand] = useState<StrandId | "all">("all");
  const [view, setViewState] = useState<View>(() => load(VIEW_KEY, isView, "pictures"));
  const [favourites, setFavourites] = useState<string[]>(() => load(FAVOURITES_KEY, isIds, []));
  const [peek, setPeek] = useState<Tool | null>(null);
  const root = useRef<HTMLElement>(null);
  const searchBox = useRef<HTMLInputElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);

  const setView = (next: View) => { setViewState(next); save(VIEW_KEY, next); };
  const toggleFavourite = (id: string) => {
    const next = favourites.includes(id) ? favourites.filter((f) => f !== id) : [...favourites, id];
    setFavourites(next);
    save(FAVOURITES_KEY, next);
  };

  // Press / anywhere on this page to search, unless typing in a field already.
  useEffect(() => {
    function key(event: KeyboardEvent) {
      if (event.key !== "/" || event.ctrlKey || event.metaKey || event.altKey) return;
      if (!root.current || root.current.closest("[hidden]") || dialog.current?.open) return;
      const target = event.target as HTMLElement;
      if (target.closest("input, textarea, select, [contenteditable='true']")) return;
      event.preventDefault();
      searchBox.current?.focus();
    }
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  useEffect(() => {
    if (peek && dialog.current && !dialog.current.open) dialog.current.showModal?.();
  }, [peek]);

  const results = bookletTools.map((tool) => ({ tool, ...searchTool(tool, search) })).filter((r) => r.found);
  const shownStrands = strand === "all" ? strands : strands.filter((s) => s.id === strand);
  const favouriteTools = favourites.map((id) => bookletTools.find((t) => t.id === id)).filter((t): t is Tool => !!t);
  const showFavourites = !search && strand === "all";

  const tile = (tool: Tool, matched: string, place: string) => {
    const starred = favourites.includes(tool.id);
    return (
      <article key={`${place}-${tool.id}`} className="tool-tile">
        <a className="overview-tool-card" href={pageHref(tool.id)} aria-label={`Open ${tool.name}`}>
          <span className="tool-picture"><img className="overview-tool-preview" src={tool.preview.src} alt={tool.preview.alt} /></span>
          <span className="tool-tile-text">
            <h3>{tool.name}{isNew(tool.id) && <span className="tool-new">New</span>}</h3>
            {matched && <span className="tool-match">Matches “{matched}”</span>}
            <span className="tool-tile-description">{tool.description}</span>
          </span>
        </a>
        <span className="tool-tile-actions">
          <button type="button" className="tool-icon-button" aria-label={`Preview ${tool.name}`} title="Preview" onClick={() => setPeek(tool)}><ZoomIn size={15} aria-hidden="true" /></button>
          <button type="button" className={`tool-icon-button${starred ? " is-favourite" : ""}`} aria-pressed={starred} aria-label={`${starred ? "Remove" : "Add"} ${tool.name} ${starred ? "from" : "to"} favourite tools`} title={starred ? "Remove from favourite tools" : "Add to favourite tools"} onClick={() => toggleFavourite(tool.id)}><Star size={15} aria-hidden="true" /></button>
        </span>
      </article>
    );
  };
  const topicRow = (tool: Tool) => {
    const words = search.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
    return (
      <article key={tool.id} className="tool-topic-row">
        <a className="tool-picture" href={pageHref(tool.id)} tabIndex={-1} aria-hidden="true"><img src={tool.preview.src} alt="" /></a>
        <div className="tool-topic-text">
          <h3><a className="overview-tool-card" href={pageHref(tool.id)} aria-label={`Open ${tool.name}`}>{tool.name}</a>{isNew(tool.id) && <span className="tool-new">New</span>}</h3>
          <ul className="tool-topics" aria-label={`${tool.name} topics`}>
            {catalogue[tool.id].topics.map((topic) => (
              <li key={topic}><button type="button" className={words.length && words.some((w) => topic.toLocaleLowerCase().includes(w)) ? "is-match" : undefined} onClick={() => setSearch(topic)}>{topic}</button></li>
            ))}
          </ul>
        </div>
      </article>
    );
  };

  return (
    <main ref={root} className={`site-overview site-overview-tools diagram-builder is-${view}`} id="main-content" tabIndex={-1}>
      <PageHeading title="Diagram builder" description="Create clear diagrams for lesson resources, then copy them into Word." />
      <div className="tool-controls">
        <div className="tool-search-row">
          <div className="tool-search">
            <label>
              <span className="sr-only">Search tools</span>
              <input ref={searchBox} type="search" value={search} placeholder="Search a topic: Pythagoras, bearings, inequalities…" onChange={(event) => setSearch(event.target.value)} />
              {!search && <kbd aria-hidden="true">/</kbd>}
            </label>
            {search && <button type="button" onClick={() => setSearch("")}>Clear search</button>}
          </div>
          <div className="tool-views" role="group" aria-label="View">
            {VIEWS.map((v) => (
              <button key={v.id} type="button" aria-pressed={view === v.id} onClick={() => setView(v.id)}>{v.icon}{v.name}</button>
            ))}
          </div>
          <HouseStyleMenu />
        </div>
        <div className="tool-strands" role="group" aria-label="GCSE strand">
          <button type="button" aria-pressed={strand === "all"} onClick={() => setStrand("all")}>All tools<small>{results.length}</small></button>
          {strands.map((s) => (
            <button key={s.id} type="button" aria-pressed={strand === s.id} onClick={() => setStrand(s.id)}>{s.name}<small>{results.filter((r) => catalogue[r.tool.id].strand === s.id).length}</small></button>
          ))}
        </div>
        {search && (
          <p className="tool-search-status" role="status">
            {results.length ? `${results.length} ${results.length === 1 ? "tool" : "tools"} found` : "No tools found. Try a teaching topic or clear your search."}
          </p>
        )}
      </div>
      <div className="tool-sections">
        {showFavourites && (favouriteTools.length ? (
          <section className="tool-favourites" aria-labelledby="favourite-tools">
            <h2 id="favourite-tools"><Star size={17} aria-hidden="true" />Favourite tools<small>{favouriteTools.length} {favouriteTools.length === 1 ? "tool" : "tools"}</small></h2>
            <div className="tool-grid">{favouriteTools.map((tool) => tile(tool, "", "favourite"))}</div>
          </section>
        ) : (
          <section className="tool-favourites is-empty" aria-labelledby="favourite-tools">
            <h2 id="favourite-tools"><Star size={16} aria-hidden="true" />Favourite tools</h2>
            <p>Star any tool below and it will wait for you here.</p>
          </section>
        ))}
        {shownStrands.map((s) => {
          const list = results.filter((r) => catalogue[r.tool.id].strand === s.id);
          if (!list.length) return null;
          return (
            <section key={s.id} className="tool-strand" aria-labelledby={`strand-${s.id}`}>
              <h2 id={`strand-${s.id}`}>{s.name}<small>{list.length} {list.length === 1 ? "tool" : "tools"}</small></h2>
              {view === "topics"
                ? <div className="tool-topic-grid">{list.map((r) => topicRow(r.tool))}</div>
                : <div className="tool-grid">{list.map((r) => tile(r.tool, r.matched, "strand"))}</div>}
            </section>
          );
        })}
      </div>
      <p className="overview-note">Your diagrams stay in your browser. Use an editable file to keep a copy for later.</p>
      <dialog ref={dialog} className="tool-peek" aria-label={peek ? `${peek.name} preview` : "Preview"} onClose={() => setPeek(null)}>
        {peek && (
          <div className="tool-peek-body">
            <span className="tool-picture"><img src={peek.preview.src} alt={peek.preview.alt} /></span>
            <div className="tool-peek-text">
              <h2>{peek.name}</h2>
              <p>{peek.description}</p>
              <a className="tool-peek-open" href={pageHref(peek.id)} onClick={() => dialog.current?.close()}>Open {peek.name}</a>
              <button type="button" className="tool-peek-close" onClick={() => dialog.current?.close()}><X size={15} aria-hidden="true" />Close</button>
            </div>
          </div>
        )}
      </dialog>
    </main>
  );
}

/** House style for new diagrams, tucked into a small menu because it is rarely changed. */
function HouseStyleMenu() {
  const house = useHousePreference();
  const menu = useRef<HTMLDetailsElement>(null);
  // The menu closes on Escape or a click elsewhere, like the site menu.
  useEffect(() => {
    function dismiss(event: PointerEvent) {
      if (menu.current?.open && !menu.current.contains(event.target as Node)) menu.current.open = false;
    }
    function key(event: KeyboardEvent) {
      if (event.key !== "Escape" || !menu.current?.open) return;
      menu.current.open = false;
      menu.current.querySelector("summary")?.focus();
    }
    window.addEventListener("pointerdown", dismiss);
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("pointerdown", dismiss);
      window.removeEventListener("keydown", key);
    };
  }, []);
  return (
    <details ref={menu} className="house-style-menu">
      <summary><Settings2 size={16} aria-hidden="true" />House style</summary>
      <fieldset className="house-style">
        <legend>House style for new diagrams</legend>
        <label>
          Text
          <select value={house.style} onChange={(event) => setHousePreference({ ...house, style: event.target.value as HouseStyle })}>
            {HOUSE_STYLES.map((s) => <option key={s} value={s}>{s === "large" ? `${HOUSE_STYLE_NAMES[s]} (12 pt)` : `${HOUSE_STYLE_NAMES[s]} (11 pt)`}</option>)}
          </select>
        </label>
        <label>
          Lines
          <select value={house.lines} onChange={(event) => setHousePreference({ ...house, lines: event.target.value as LineWeight })}>
            {LINE_WEIGHTS.map((w) => <option key={w} value={w}>{LINE_WEIGHT_NAMES[w]}</option>)}
          </select>
        </label>
        <p>Each diagram keeps its own settings, which you can still change in its editor. Saved files do not change.</p>
      </fieldset>
    </details>
  );
}
