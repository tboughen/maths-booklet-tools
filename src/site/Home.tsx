import { useLayoutEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { ArrowRight, Search } from "lucide-react";
import { bookletTools, pageHref, siteSection, siteSections } from "./registry";
import { useFavouriteToolList } from "./favouriteTools";
import { searchHome, type Icon } from "./homeSearch";
import { useRecentWork, whenText, type RecentWork } from "./recentWork";
import "./home.css";

/** What a "Carry on" card says about a place, or nothing if the place no longer exists. */
function carryOn(work: RecentWork) {
  const tool = bookletTools.find((t) => t.id === work.id);
  if (tool) return { href: pageHref(tool.id), icon: tool.icon as Icon, kind: "Diagram builder", name: tool.name, action: "Open diagram" };
  if (work.id === "worksheets") return { ...pick("worksheets"), name: "Your worksheet", action: "Open worksheet" };
  if (work.id === "starters") return { ...pick("starters"), name: "Your silent starters", action: "Open starters" };
  if (work.id === "booklets") return { ...pick("booklets"), name: "Your booklet", action: "Open booklet" };
  if (work.id === "paper-builder") return { ...pick("paper-builder"), name: "Paper in progress", action: "Review paper" };
  return null;
}
const pick = (id: "worksheets" | "starters" | "booklets" | "paper-builder") => {
  const s = siteSection(id);
  return { href: s.href, icon: s.icon as Icon, kind: s.name as string };
};

/**
 * Home, the start page (docs/tools/APP-HOUSE-STYLE.md): one search box, the work to carry on
 * with, the seven pages as a row called Tools, and the teacher's favourite diagram tools as much
 * smaller picture cards. Card size carries meaning: a bigger card lets you do more.
 */
export default function Home() {
  const [query, setQuery] = useState("");
  const root = useRef<HTMLElement>(null);
  const box = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const favourites = useFavouriteToolList();
  const recent = useRecentWork().flatMap((work) => {
    const card = carryOn(work);
    return card ? [{ ...card, work }] : [];
  }).slice(0, 3);
  const found = searchHome(query);

  // Press / anywhere on this page to search, unless typing in a field already. A layout effect,
  // so the key works from the moment the box can be seen.
  useLayoutEffect(() => {
    function key(event: KeyboardEvent) {
      if (event.key !== "/" || event.ctrlKey || event.metaKey || event.altKey) return;
      if (!root.current || root.current.closest("[hidden]")) return;
      if ((event.target as HTMLElement).closest("input, textarea, select, [contenteditable='true']")) return;
      event.preventDefault();
      box.current?.focus();
    }
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);

  const links = () => [...(list.current?.querySelectorAll<HTMLAnchorElement>("a") ?? [])];
  function boxKeys(event: ReactKeyboardEvent<HTMLInputElement>) {
    // Enter that confirms composed text, or carries a modifier key, is not a request to open a result.
    if (event.nativeEvent.isComposing || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
    if (event.key === "Enter") links()[0]?.click();
    else if (event.key === "ArrowDown" && links().length) {
      event.preventDefault();
      links()[0].focus();
    } else if (event.key === "Escape" && query) {
      event.preventDefault();
      setQuery("");
    }
  }
  function listKeys(event: ReactKeyboardEvent<HTMLUListElement>) {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp" && event.key !== "Escape") return;
    event.preventDefault();
    const all = links(), at = all.indexOf(document.activeElement as HTMLAnchorElement);
    if (event.key === "Escape") {
      setQuery("");
      box.current?.focus();
    } else if (event.key === "ArrowDown") all[Math.min(at + 1, all.length - 1)]?.focus();
    else if (at <= 0) box.current?.focus();
    else all[at - 1].focus();
  }

  return (
    <main ref={root} className="site-home" id="main-content" aria-label="Home" tabIndex={-1}>
      <div className="home-start">
        <h1 tabIndex={-1}>What do you need today?</h1>
        <div className="home-search" role="search">
          <label>
            <span className="sr-only">Search MathsDock</span>
            <Search size={18} aria-hidden="true" />
            <input ref={box} type="search" value={query} placeholder="Search pages and diagram tools, or type a Sparx code" autoComplete="off" spellCheck={false} onChange={(event) => setQuery(event.target.value)} onKeyDown={boxKeys} />
            {!query && <kbd aria-hidden="true">/</kbd>}
          </label>
          <p className="sr-only" role="status">
            {query.trim() ? (found.length ? `${found.length} ${found.length === 1 ? "result" : "results"}` : "Nothing found") : ""}
          </p>
          {found.length > 0 && (
            <ul ref={list} className="home-results" aria-label="Search results" onKeyDown={listKeys}>
              {found.map((item) => (
                <li key={item.key}>
                  <a href={item.href}>
                    <item.icon size={20} aria-hidden="true" />
                    <span><b>{item.name}</b><small>{item.note}</small></span>
                  </a>
                </li>
              ))}
            </ul>
          )}
          {query.trim() && !found.length && (
            <p className="home-none">Nothing found. Try a tool’s name, a topic such as Pythagoras, or a Sparx code such as U332. To search exam questions by topic, open the Question bank.</p>
          )}
        </div>
      </div>

      {recent.length > 0 && (
        <section className="home-section" aria-labelledby="home-carry-on">
          <h2 id="home-carry-on">Carry on <small>saved on this device</small></h2>
          <div className="home-carry">
            {recent.map(({ work, href, icon: CardIcon, kind, name, action }) => (
              <a key={work.id} className="home-card home-carry-card" href={href}>
                <span className="home-kind"><CardIcon size={14} aria-hidden="true" />{kind}</span>
                <b>{name}</b>
                <span className="home-meta">{work.detail ? `${work.detail} · changed ${whenText(work.at)}` : `Changed ${whenText(work.at)}`}</span>
                <span className="home-action">{action} <ArrowRight size={15} aria-hidden="true" /></span>
              </a>
            ))}
          </div>
        </section>
      )}

      <section className="home-section" aria-labelledby="home-tools">
        <h2 id="home-tools">Tools</h2>
        <div className="home-tools">
          {siteSections.map((s) => (
            <a key={s.id} className="home-card home-tool" href={s.href}>
              <span className="home-tool-icon"><s.icon size={40} aria-hidden="true" /></span>
              <h3>{s.name}</h3>
              <p>{s.description}</p>
            </a>
          ))}
        </div>
      </section>

      <section className="home-section" aria-labelledby="home-favourites">
        <h2 id="home-favourites">Favourites <small>star a diagram tool to keep it here</small></h2>
        {favourites.length ? (
          <div className="home-favourites">
            {favourites.map((tool) => (
              <a key={tool.id} className="home-card home-favourite" href={pageHref(tool.id)}>
                <span className="home-picture"><img src={tool.preview.src} alt="" /></span>
                <b><tool.icon size={14} aria-hidden="true" />{tool.name}</b>
              </a>
            ))}
          </div>
        ) : (
          <p className="home-empty">No favourites yet. Open the <a href={pageHref("booklet-tools")}>Diagram builder</a> and press the star on any tool you use often.</p>
        )}
      </section>
    </main>
  );
}
