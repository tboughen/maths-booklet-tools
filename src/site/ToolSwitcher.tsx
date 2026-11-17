import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { ChevronDown, ChevronRight, LayoutGrid, Search } from "lucide-react";
import { FavouriteStar } from "./FavouriteStar";
import { bookletTools, pageHref } from "./registry";
import { ToolFinder } from "./ToolFinder";
import { finderKeys, focusLeft, useFinderDismiss } from "./toolFinderBehaviour";

type Tool = (typeof bookletTools)[number];

/**
 * A diagram tool's heading. The name is a button that opens a switcher: search, favourite tools
 * and every tool grouped by strand, so any tool is one click and one choice away
 * (docs/tools/APP-HOUSE-STYLE.md).
 */
export function ToolSwitcher({ tool, title }: { tool: Tool; title: string }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const box = useRef<HTMLInputElement>(null);
  const panel = useId();

  const close = (returnFocus: boolean) => {
    setOpen(false);
    setSearch("");
    if (returnFocus) trigger.current?.focus();
  };
  useEffect(() => {
    if (open) box.current?.focus();
  }, [open]);
  useFinderDismiss(open, root, () => close(false));

  function keys(event: KeyboardEvent<HTMLDivElement>) {
    // Editors listen for keys on the window (arrows nudge, Delete removes, Escape deselects).
    // While the switcher is open its keys are its own and never reach the diagram behind it.
    event.stopPropagation();
    if (event.key === "Escape") {
      close(true);
      return;
    }
    finderKeys(event, root.current, box.current);
  }

  return (
    <div
      ref={root}
      className="tool-switcher"
      onKeyDown={open ? keys : undefined}
      onBlur={(event) => {
        // Tabbing out of the switcher closes it; a click elsewhere is handled above.
        if (open && focusLeft(event, root.current)) close(false);
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
          <ToolFinder
            id={panel}
            search={search}
            current={tool.id}
            foot={<a data-switch="all" href={pageHref("booklet-tools")}><LayoutGrid size={15} aria-hidden="true" />See all {bookletTools.length} tools with pictures</a>}
          />
        </div>
      )}
    </div>
  );
}
