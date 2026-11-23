import { flushSync } from "react-dom";
import { useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import { LayoutGrid, Grid3X3, Tags, Settings2, Star, ZoomIn, X } from "lucide-react";
import { PageHeading } from "./PageHeading";
import { bookletTools, pageHref } from "./registry";
import { setHousePreference, useHousePreference } from "./houseStyle";
import { FavouriteStar } from "./FavouriteStar";
import { ToolFinder } from "./ToolFinder";
import { finderKeys, focusLeft, useFinderDismiss } from "./toolFinderBehaviour";
import { useFavouriteToolList } from "./favouriteTools";
import { catalogue, isNew, searchTool, strands, type StrandId } from "./toolCatalogue";
import { HOUSE_STYLES, HOUSE_STYLE_NAMES, LINE_WEIGHTS, LINE_WEIGHT_NAMES, type HouseStyle, type LineWeight } from "../../packages/envelope-core/src/house-style";
import { EXAMPLE_PARAM, previewUrl } from "../examples/examplePreviews";
import { searchExamples, type ExampleIndexEntry } from "../examples/galleryTools";
import exampleIndexUrl from "../examples/exampleIndex.json?url";
import "./diagram-builder.css";

type Tool = (typeof bookletTools)[number];
type View = "pictures" | "compact" | "topics";
const VIEWS: { id: View; name: string; icon: ReactNode }[] = [
  { id: "pictures", name: "Pictures", icon: <LayoutGrid size={15} aria-hidden="true" /> },
  { id: "compact", name: "Compact", icon: <Grid3X3 size={15} aria-hidden="true" /> },
  { id: "topics", name: "Topics", icon: <Tags size={15} aria-hidden="true" /> },
];
const VIEW_KEY = "mathsdock.toolsView";

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

/** Examples shown before "Show all": two rows of tiles on a 1920-wide screen. */
const EXAMPLES_SHOWN = 12;
let exampleIndexLoad: Promise<ExampleIndexEntry[]> | null = null;
/** Every tool's gallery examples, fetched once on the first search (a data file, not page code). */
function useExampleIndex(wanted: boolean) {
  const [index, setIndex] = useState<ExampleIndexEntry[]>([]);
  useEffect(() => {
    if (!wanted) return;
    let live = true;
    exampleIndexLoad ??= fetch(exampleIndexUrl)
      .then((response) => (response.ok ? (response.json() as Promise<ExampleIndexEntry[]>) : []))
      .catch(() => {
        exampleIndexLoad = null;
        return [];
      });
    void exampleIndexLoad.then((list) => live && setIndex(list));
    return () => {
      live = false;
    };
  }, [wanted]);
  return index;
}


/** The Diagram builder page: every diagram tool as a picture, grouped by GCSE strand. */
export function DiagramBuilder() {
  const [search, setSearch] = useState("");
  const [strand, setStrand] = useState<StrandId | "all">("all");
  const [view, setViewState] = useState<View>(() => load(VIEW_KEY, isView, "pictures"));
  const favouriteTools = useFavouriteToolList();
  const [peek, setPeek] = useState<Tool | null>(null);
  const root = useRef<HTMLElement>(null);
  const searchBox = useRef<HTMLInputElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  // The tool finder drops down under the search box, as it does under a tool's name.
  const [finder, setFinder] = useState(false);
  const finderRoot = useRef<HTMLDivElement>(null);
  const finderId = useId();

  const setView = (next: View) => { setViewState(next); save(VIEW_KEY, next); };

  // Press / anywhere on this page to search, unless typing in a field already.
  useEffect(() => {
    function key(event: KeyboardEvent) {
      if (event.key !== "/" || event.ctrlKey || event.metaKey || event.altKey) return;
      if (!root.current || root.current.closest("[hidden]") || dialog.current?.open) return;
      const target = event.target as HTMLElement;
      if (target.closest("input, textarea, select, [contenteditable='true']")) return;
      event.preventDefault();
      searchBox.current?.focus();
      setFinder(true);
    }
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  useEffect(() => {
    if (peek && dialog.current && !dialog.current.open) dialog.current.showModal?.();
  }, [peek]);
  useFinderDismiss(finder, finderRoot, () => setFinder(false));
  function finderKey(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (!finder) {
      // Closed, or not yet open, with the search box in focus: the down arrow opens it.
      if (event.key === "ArrowDown" && event.target === searchBox.current) {
        event.preventDefault();
        setFinder(true);
      }
      return;
    }
    if (event.key === "Escape") {
      // The search stays, so the pictures behind are still the ones it found.
      event.preventDefault();
      setFinder(false);
      searchBox.current?.focus();
      return;
    }
    finderKeys(event, finderRoot.current, searchBox.current);
  }

  const results = bookletTools.map((tool) => ({ tool, ...searchTool(tool, search) })).filter((r) => r.found);
  const exampleIndex = useExampleIndex(!!search.trim());
  const [allExamples, setAllExamples] = useState(false);
  useEffect(() => setAllExamples(false), [search, strand]);
  const toolNames = new Map(bookletTools.map((tool) => [tool.id as string, tool.name]));
  const examples = searchExamples(exampleIndex, search).filter((e) => toolNames.has(e.tool) && (strand === "all" || catalogue[e.tool as Tool["id"]].strand === strand));
  const shownExamples = allExamples ? examples : examples.slice(0, EXAMPLES_SHOWN);
  const shownStrands = strand === "all" ? strands : strands.filter((s) => s.id === strand);
  const showFavourites = !search && strand === "all";

  const tile = (tool: Tool, matched: string, place: string) => {
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
          <FavouriteStar tool={tool} className="tool-icon-button" size={15} />
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
          <div
            ref={finderRoot}
            className="tool-search"
            onKeyDown={finderKey}
            onBlur={(event) => {
              // Tabbing out of the finder closes it; a click elsewhere is handled above.
              if (finder && focusLeft(event, finderRoot.current)) setFinder(false);
            }}
          >
            <label>
              <span className="sr-only">Search tools</span>
              <input
                ref={searchBox}
                type="search"
                value={search}
                placeholder="Search a topic: Pythagoras, bearings, inequalities…"
                aria-controls={finder ? finderId : undefined}
                aria-describedby={finder ? `${finderId}-keys` : undefined}
                // A click or typing opens the finder. Tab into the box does not, and an emptied box
                // (the browser clears it on a second Escape) leaves it as it is.
                onChange={(event) => {
                  setSearch(event.target.value);
                  if (event.target.value) setFinder(true);
                }}
                onClick={() => setFinder(true)}
              />
              {!search && <kbd aria-hidden="true">/</kbd>}
            </label>
            {finder && (
              <div
                id={finderId}
                className="tool-switcher-panel"
                role="region"
                aria-label="Every diagram tool"
                // A click on the panel's own padding or headings keeps focus, and so the keys, inside it.
                tabIndex={-1}
                onClick={(event) => {
                  if ((event.target as HTMLElement).closest("a")) setFinder(false);
                }}
              >
                <p id={`${finderId}-keys`} className="sr-only">The tool finder is open. The down arrow moves through the tools, Enter opens the first tool found and Escape closes the finder.</p>
                <ToolFinder id={finderId} search={search} quiet arrowsOnly />
              </div>
            )}
            {search && (
              <button
                type="button"
                onClick={() => {
                  // The button goes with the search, so focus returns to the box and the keys still work.
                  setSearch("");
                  searchBox.current?.focus();
                }}
              >
                Clear search
              </button>
            )}
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
            {results.length || examples.length
              ? [examples.length && `${examples.length} ${examples.length === 1 ? "example" : "examples"}`, results.length && `${results.length} ${results.length === 1 ? "tool" : "tools"}`].filter(Boolean).join(" and ") + " found"
              : "No tools found. Try a teaching topic or clear your search."}
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
        {examples.length > 0 && (
          <section className="tool-strand tool-examples" aria-labelledby="search-examples">
            <h2 id="search-examples">Examples to start from<small>{examples.length} {examples.length === 1 ? "example" : "examples"}</small></h2>
            <div className="tool-grid">
              {shownExamples.map((e) => {
                const href = `${pageHref(e.tool as Tool["id"])}?${EXAMPLE_PARAM}=${encodeURIComponent(e.id)}`;
                const tool = toolNames.get(e.tool);
                return (
                  <article key={e.id} className="tool-tile example-tile">
                    <a className="overview-example-card" href={href} aria-label={`Open ${e.title} in ${tool}`}>
                      <span className="tool-picture"><img className="overview-tool-preview" src={previewUrl(e.id)} alt="" loading="lazy" /></span>
                      <span className="tool-tile-text">
                        <h3>{e.title}{e.plain && <>{" "}<span className="tool-plain">Plain</span></>}</h3>
                        <span className="tool-match">Opens in {tool}</span>
                        <span className="tool-tile-description">{e.description}</span>
                      </span>
                    </a>
                  </article>
                );
              })}
            </div>
            {examples.length > shownExamples.length && (
              <button
                type="button"
                className="tool-examples-more"
                onClick={(event) => {
                  // The button goes once every example shows, so focus moves to the first one it revealed.
                  const grid = event.currentTarget.previousElementSibling;
                  flushSync(() => setAllExamples(true));
                  grid?.querySelectorAll<HTMLAnchorElement>("a")[EXAMPLES_SHOWN]?.focus();
                }}
              >Show all {examples.length} examples</button>
            )}
          </section>
        )}
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
              <a className="tool-peek-open" href={pageHref(peek.id)} onClick={() => dialog.current?.close?.()}>Open {peek.name}</a>
              <button type="button" className="tool-peek-close" onClick={() => dialog.current?.close?.()}><X size={15} aria-hidden="true" />Close</button>
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
      {/* A group with its title as the first line. A fieldset would set its title across the top edge, half outside the panel. */}
      <div className="house-style" role="group" aria-labelledby="house-style-title">
        <strong id="house-style-title">House style for new diagrams</strong>
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
      </div>
    </details>
  );
}
