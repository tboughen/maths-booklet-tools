import type { ReactNode } from "react";
import { Check, Star } from "lucide-react";
import { bookletTools, pageHref } from "./registry";
import { useFavouriteToolList } from "./favouriteTools";
import { catalogue, searchTool, strands } from "./toolCatalogue";
import "./tool-switcher.css";

type Tool = (typeof bookletTools)[number];

/**
 * What the tool finder holds: favourite tools, then every tool in a column for its strand, cut
 * down by a search. It drops down under a tool's name (ToolSwitcher) and under the Diagram
 * builder's search box, and looks and works the same in both (docs/tools/APP-HOUSE-STYLE.md).
 */
export function ToolFinder({ id, search, current, foot, quiet, arrowsOnly }: {
  id: string;
  search: string;
  /** The tool the finder was opened from, which is ticked. */
  current?: Tool["id"];
  /** A link for the foot of the panel, before the hint about the keys. */
  foot?: ReactNode;
  /** The page already says how many tools the search found, so the finder does not say it again. */
  quiet?: boolean;
  /** Under a search box on a page, the arrows reach the tools and Tab passes the finder by. */
  arrowsOnly?: boolean;
}) {
  const tab = arrowsOnly ? -1 : undefined;
  const favouriteTools = useFavouriteToolList();
  // A search of spaces alone is no search.
  const query = search.trim();
  const results = bookletTools.map((item) => ({ item, ...searchTool(item, search) })).filter((r) => r.found);
  // One column for each strand that still holds a tool, in the scheme's order.
  const groups = strands.map((strand) => ({ ...strand, list: results.filter((r) => catalogue[r.item.id].strand === strand.id) })).filter((group) => group.list.length);
  // While searching, Enter opens the first tool drawn.
  const first = query ? groups[0]?.list[0]?.item.id : undefined;

  const link = (item: Tool, matched: string) => (
    <li key={item.id}>
      <a data-switch="tool" tabIndex={tab} className={item.id === first ? "is-first" : undefined} href={pageHref(item.id)} aria-current={item.id === current ? "page" : undefined}>
        <item.icon size={16} aria-hidden="true" />
        <span>{item.name}{matched && <small>Matches “{matched}”</small>}</span>
        {item.id === current && <Check size={15} aria-hidden="true" />}
        {item.id === first && <kbd aria-hidden="true">Enter</kbd>}
      </a>
    </li>
  );

  return (
    <>
      {!query && (
        <div className="tool-switcher-favourites">
          <span><Star size={15} aria-hidden="true" />Favourites</span>
          {favouriteTools.length
            ? <ul aria-label="Favourite tools">{favouriteTools.map((item) => <li key={item.id}><a data-switch="favourite" tabIndex={tab} href={pageHref(item.id)}><item.icon size={14} aria-hidden="true" />{item.name}</a></li>)}</ul>
            : <small>Star a tool and it will wait for you here.</small>}
        </div>
      )}
      {results.length ? (
        <div className="tool-switcher-groups">
          {groups.map(({ id: strand, name, list }) => (
            <section key={strand} aria-labelledby={`${id}-${strand}`}>
              <h2 id={`${id}-${strand}`}>{name}</h2>
              <ul>{list.map((r) => link(r.item, r.matched))}</ul>
            </section>
          ))}
        </div>
      ) : (
        <p className="tool-switcher-empty">No tools found. Try a teaching topic, such as ratio or angles.</p>
      )}
      {!quiet && <p className="tool-switcher-status sr-only" role="status">{query ? `${results.length} ${results.length === 1 ? "tool" : "tools"} found` : ""}</p>}
      <div className={foot ? "tool-switcher-foot" : "tool-switcher-foot is-keys-only"}>
        {foot}
        <span aria-hidden="true"><kbd>↑</kbd><kbd>↓</kbd> to move, <kbd>Enter</kbd> to open</span>
      </div>
    </>
  );
}
