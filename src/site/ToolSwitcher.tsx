import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { Check, ChevronDown, ChevronRight, LayoutGrid, Search, Star } from "lucide-react";
import { FavouriteStar } from "./FavouriteStar";
import { bookletTools, pageHref } from "./registry";
import { useFavouriteToolList } from "./favouriteTools";
import { catalogue, searchTool, strands } from "./toolCatalogue";
import "./tool-switcher.css";

type Tool = (typeof bookletTools)[number];

/**
 * A diagram tool's heading. The name is a button that opens a switcher: search, favourite tools
 * and every tool grouped by strand, so any tool is one click and one choice away
 * (docs/tools/APP-HOUSE-STYLE.md).
 */
export function ToolSwitcher({ tool, title }: { tool: Tool; title: string }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const favouriteTools = useFavouriteToolList();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const box = useRef<HTMLInputElement>(null);
  const panel = useId();
  // A search of spaces alone is no search.
  const query = search.trim();

  const close = (returnFocus: boolean) => {
    setOpen(false);
    setSearch("");
    if (returnFocus) trigger.current?.focus();
  };
  useEffect(() => {
    if (!open) return;
    box.current?.focus();
    const shut = () => close(false);
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) shut();
    };
    // Leaving the page, by a link or the browser's Back button, closes it too: the page stays
    // mounted while hidden, and should not come back with the switcher still open.
    window.addEventListener("pointerdown", outside);
    window.addEventListener("popstate", shut);
    return () => {
      window.removeEventListener("pointerdown", outside);
      window.removeEventListener("popstate", shut);
    };
  }, [open]);

  const results = bookletTools.map((item) => ({ item, ...searchTool(item, search) })).filter((r) => r.found);
  // One column for each strand that still holds a tool, in the scheme's order.
  const groups = strands.map((strand) => ({ ...strand, list: results.filter((r) => catalogue[r.item.id].strand === strand.id) })).filter((group) => group.list.length);
  // While searching, Enter opens the first tool drawn.
  const first = query ? groups[0]?.list[0]?.item.id : undefined;

  function keys(event: KeyboardEvent<HTMLDivElement>) {
    // Editors listen for keys on the window (arrows nudge, Delete removes, Escape deselects).
    // While the switcher is open its keys are its own and never reach the diagram behind it.
    event.stopPropagation();
    if (event.key === "Escape") {
      close(true);
      return;
    }
    const links = [...(root.current?.querySelectorAll<HTMLAnchorElement>("a[data-switch]") ?? [])];
    if (event.key === "Enter" && event.target === box.current) {
      // Enter that confirms a word from an input method editor is not a choice of tool.
      if (event.nativeEvent.isComposing) return;
      // Enter in the search box opens the first tool found.
      event.preventDefault();
      root.current?.querySelector<HTMLAnchorElement>("a.is-first")?.click();
      return;
    }
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    const at = links.indexOf(document.activeElement as HTMLAnchorElement);
    const next = event.key === "ArrowDown" ? at + 1 : at - 1;
    if (next < 0 || next >= links.length) box.current?.focus();
    else links[next].focus();
  }

  const link = (item: Tool, matched: string) => (
    <li key={item.id}>
      <a data-switch="tool" className={item.id === first ? "is-first" : undefined} href={pageHref(item.id)} aria-current={item.id === tool.id ? "page" : undefined}>
        <item.icon size={16} aria-hidden="true" />
        <span>{item.name}{matched && <small>Matches “{matched}”</small>}</span>
        {item.id === tool.id && <Check size={15} aria-hidden="true" />}
        {item.id === first && <kbd aria-hidden="true">Enter</kbd>}
      </a>
    </li>
  );

  return (
    <div
      ref={root}
      className="tool-switcher"
      onKeyDown={open ? keys : undefined}
      onBlur={(event) => {
        // Tabbing out of the switcher closes it; a click elsewhere is handled above.
        if (open && event.relatedTarget && !root.current?.contains(event.relatedTarget as Node)) close(false);
      }}
    >
      <a className="tool-switcher-crumb" href={pageHref("booklet-tools")}>Diagram builder</a>
      <ChevronRight className="tool-switcher-sep" size={15} aria-hidden="true" />
      <h1 tabIndex={-1}>
        <button ref={trigger} type="button" className="tool-switcher-button" aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? panel : undefined} title="Switch to another diagram tool" onClick={() => (open ? close(false) : setOpen(true))}>
          <tool.icon size={20} aria-hidden="true" />
          {title}
          <ChevronDown size={16} aria-hidden="true" />
        </button>
      </h1>
      <FavouriteStar tool={tool} className="tool-switcher-star" size={16} />
      {open && (
        <div
          id={panel}
          className="tool-switcher-panel"
          role="dialog"
          aria-label="Switch diagram tool"
          // A click on the panel's own padding or headings keeps focus, and so the keys, inside it.
          tabIndex={-1}
          onClick={(event) => {
            if ((event.target as HTMLElement).closest("a")) close(false);
          }}
        >
          <label className="tool-switcher-search">
            <Search size={16} aria-hidden="true" />
            <span className="sr-only">Find a tool or topic</span>
            <input ref={box} type="search" value={search} placeholder="Find a tool or topic: Pythagoras, bearings, inequalities" onChange={(event) => setSearch(event.target.value)} />
          </label>
          {!query && (
            <div className="tool-switcher-favourites">
              <span><Star size={15} aria-hidden="true" />Favourites</span>
              {favouriteTools.length
                ? <ul aria-label="Favourite tools">{favouriteTools.map((item) => <li key={item.id}><a data-switch="favourite" href={pageHref(item.id)}><item.icon size={14} aria-hidden="true" />{item.name}</a></li>)}</ul>
                : <small>Star a tool and it will wait for you here.</small>}
            </div>
          )}
          {results.length ? (
            <div className="tool-switcher-groups">
              {groups.map(({ id, name, list }) => (
                <section key={id} aria-labelledby={`${panel}-${id}`}>
                  <h2 id={`${panel}-${id}`}>{name}</h2>
                  <ul>{list.map((r) => link(r.item, r.matched))}</ul>
                </section>
              ))}
            </div>
          ) : (
            <p className="tool-switcher-empty">No tools found. Try a teaching topic, such as ratio or angles.</p>
          )}
          <p className="tool-switcher-status sr-only" role="status">{query ? `${results.length} ${results.length === 1 ? "tool" : "tools"} found` : ""}</p>
          <div className="tool-switcher-foot">
            <a data-switch="all" href={pageHref("booklet-tools")}><LayoutGrid size={15} aria-hidden="true" />See all {bookletTools.length} tools with pictures</a>
            <span aria-hidden="true"><kbd>↑</kbd><kbd>↓</kbd> to move, <kbd>Enter</kbd> to open</span>
          </div>
        </div>
      )}
    </div>
  );
}
