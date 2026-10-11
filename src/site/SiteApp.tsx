import { useEffect, useRef, useState, type MouseEvent } from "react";
import QuestionBank from "../bank/QuestionBank";
import { Overview } from "./Overview";
import { SiteHeader } from "./SiteHeader";
import { bookletTools, pageName, readPage, type PageId } from "./registry";
import "./site.css";

/** Editors mount on first use and remain mounted so drafts and undo survive navigation. */
export default function SiteApp() {
  const [page, setPage] = useState(() => readPage(location.search));
  const [visited, setVisited] = useState<PageId[]>([page]);
  const remembered = useRef<Partial<Record<PageId, string>>>({});
  const host = useRef<HTMLDivElement>(null);
  const firstPage = useRef(true);
  useEffect(() => {
    const back = () => {
      const next = readPage(location.search);
      setPage(next);
      setVisited(previous => previous.includes(next) ? previous : [...previous, next]);
    };
    const remember = () => { remembered.current[readPage(location.search)] = location.search + location.hash; };
    window.addEventListener("maths-tools:route", remember);
    window.addEventListener("popstate", back);
    return () => { window.removeEventListener("popstate", back); window.removeEventListener("maths-tools:route", remember); };
  }, []);
  useEffect(() => {
    document.title = `${pageName(page)} · Maths Tools`;
    if (firstPage.current) { firstPage.current = false; return; }
    if (host.current?.querySelector(".site-page:not([hidden]) [aria-modal=true]")) return;
    host.current?.querySelector<HTMLElement>(".site-page:not([hidden]) h1")?.focus({ preventScroll: true });
  }, [page]);
  function navigate(event: MouseEvent<HTMLDivElement>) {
    if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    const link = (event.target as HTMLElement).closest<HTMLAnchorElement>("a[href]");
    if (!link || link.target || link.hasAttribute("download")) return;
    if (link.classList.contains("site-skip")) {
      event.preventDefault();
      host.current?.querySelector<HTMLElement>("#main-content")?.focus();
      return;
    }
    const url = new URL(link.href, location.href);
    const id = url.searchParams.get("tool");
    if (url.origin !== location.origin || url.pathname !== location.pathname || !id || readPage(url.search) !== id) return;
    event.preventDefault();
    remembered.current[page] = location.search + location.hash;
    const next = id as PageId;
    const href = url.searchParams.size === 1 && !url.hash ? remembered.current[next] ?? url.search : url.search + url.hash;
    if (location.search + location.hash !== href) window.history.pushState({}, "", location.pathname + href);
    setVisited(previous => previous.includes(next) ? previous : [...previous, next]);
    setPage(next);
    // Existing question and diagram routes already listen for these browser events.
    window.dispatchEvent(new PopStateEvent("popstate"));
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  }
  return <div className="site-app" ref={host} onClick={navigate}>
    <a className="site-skip" href="#main-content">Skip to content</a>
    <SiteHeader key={page} page={page} />
    {(page === "home" || page === "booklet-tools") && <div className="site-page"><Overview home={page === "home"} /></div>}
    {bookletTools.map(tool => visited.includes(tool.id) && <div key={tool.id} className="site-page" hidden={page !== tool.id}><tool.component active={page === tool.id} /></div>)}
    {visited.includes("question-bank") && <div className="site-page" hidden={page !== "question-bank"}><QuestionBank active={page === "question-bank"} /></div>}
  </div>;
}
