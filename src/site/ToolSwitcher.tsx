import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { Check, ChevronDown, ChevronRight, LayoutGrid, Search, Star } from "lucide-react";
import { bookletTools, pageHref } from "./registry";
import { toggleFavouriteTool, useFavouriteTools } from "./favouriteTools";
import { catalogue, searchTool, strands } from "./toolCatalogue";

type Tool = (typeof bookletTools)[number];

/** Strands share three columns; the two short ones stack in the first. */
const COLUMNS = [["number", "graphs"], ["geometry"], ["statistics"]] as const;

/**
 * A diagram tool's heading. The name is a button that opens a switcher: search, favourite tools
 * and every tool grouped by strand, so any tool is one click and one choice away
 * (docs/tools/APP-HOUSE-STYLE.md).
 */
export function ToolSwitcher({ tool, title }: { tool: Tool; title: string }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const favourites = useFavouriteTools();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const box = useRef<HTMLInputElement>(null);
  const panel = useId();
  const starred = favourites.includes(tool.id);

  const close = (returnFocus: boolean) => {
    setOpen(false);
    setSearch("");
    if (returnFocus) trigger.current?.focus();
  };
  useEffect(() => {
    if (!open) return;
    box.current?.focus();
    const shut = () => {
      setOpen(false);
      setSearch("");
    };
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
  const favouriteTools = favourites.map((id) => bookletTools.find((t) => t.id === id)).filter((t): t is Tool => !!t);
  // Columns that still hold a tool, each strand with its matches, in the order they are drawn.
  const columns = COLUMNS.map((column) => column.map((id) => ({ id, list: results.filter((r) => catalogue[r.item.id].strand === id) })).filter((group) => group.list.length)).filter((column) => column.length);
  // While searching, Enter opens the first tool drawn.
  const first = search.trim() ? columns[0]?.[0]?.list[0]?.item.id : undefined;

  function keys(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      // Editors listen for Escape too; this one only closes the switcher.
      event.stopPropagation();
      close(true);
      return;
    }
    const links = [...(root.current?.querySelectorAll<HTMLAnchorElement>("a[data-switch]") ?? [])];
    if (event.key === "Enter" && event.target === box.current) {
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
      <button type="button" className={`tool-switcher-star${starred ? " is-favourite" : ""}`} aria-pressed={starred} aria-label={`${starred ? "Remove" : "Add"} ${tool.name} ${starred ? "from" : "to"} favourite tools`} title={starred ? "Remove from favourite tools" : "Add to favourite tools"} onClick={() => toggleFavouriteTool(tool.id)}>
        <Star size={16} aria-hidden="true" />
      </button>
      {open && (
        <div
          id={panel}
          className="tool-switcher-panel"
          role="dialog"
          aria-label="Switch diagram tool"
          onClick={(event) => {
            if ((event.target as HTMLElement).closest("a")) close(false);
          }}
        >
          <label className="tool-switcher-search">
            <Search size={16} aria-hidden="true" />
            <span className="sr-only">Find a tool or topic</span>
            <input ref={box} type="search" value={search} placeholder="Find a tool or topic: Pythagoras, bearings, inequalities" onChange={(event) => setSearch(event.target.value)} />
          </label>
          {!search && (
            <div className="tool-switcher-favourites">
              <span><Star size={15} aria-hidden="true" />Favourites</span>
              {favouriteTools.length
                ? <ul aria-label="Favourite tools">{favouriteTools.map((item) => <li key={item.id}><a data-switch="favourite" href={pageHref(item.id)}><item.icon size={14} aria-hidden="true" />{item.name}</a></li>)}</ul>
                : <small>Star a tool and it will wait for you here.</small>}
            </div>
          )}
          {results.length ? (
            <div className="tool-switcher-groups">
              {columns.map((column) => (
                <div key={column[0].id}>
                  {column.map(({ id, list }) => {
                    const heading = `${panel}-${id}`;
                    return (
                      <section key={id} aria-labelledby={heading}>
                        <h2 id={heading}>{strands.find((s) => s.id === id)!.name}</h2>
                        <ul>{list.map((r) => link(r.item, r.matched))}</ul>
                      </section>
                    );
                  })}
                </div>
              ))}
            </div>
          ) : (
            <p className="tool-switcher-empty">No tools found. Try a teaching topic, such as ratio or angles.</p>
          )}
          <p className="tool-switcher-status sr-only" role="status">{search ? `${results.length} ${results.length === 1 ? "tool" : "tools"} found` : ""}</p>
          <div className="tool-switcher-foot">
            <a data-switch="all" href={pageHref("booklet-tools")}><LayoutGrid size={15} aria-hidden="true" />See all {bookletTools.length} tools with pictures</a>
            <span aria-hidden="true"><kbd>↑</kbd><kbd>↓</kbd> to move, <kbd>Enter</kbd> to open</span>
          </div>
        </div>
      )}
    </div>
  );
}
