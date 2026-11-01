import { useEffect, useRef, useState } from "react";
import { ChevronDown, Menu, X } from "lucide-react";
import { bookletTools, pageHref, sectionName, siteSections, type PageId, type SectionId } from "./registry";

export function SiteHeader({ page, section }: { page: PageId; section: SectionId }) {
  const [open, setOpen] = useState(false);
  const header = useRef<HTMLElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const tools = useRef<HTMLElement>(null);
  const [more, setMore] = useState({ start: false, end: false });
  const booklet = page !== "question-bank" && page !== "home" && page !== "assessment-follow-up" && page !== "not-found";
  useEffect(() => {
    if (!open) return;
    function dismiss(event: PointerEvent) {
      if (!header.current?.contains(event.target as Node)) setOpen(false);
    }
    function key(event: KeyboardEvent) {
      if (event.key === "Escape") { setOpen(false); button.current?.focus(); }
    }
    window.addEventListener("pointerdown", dismiss);
    window.addEventListener("keydown", key);
    return () => { window.removeEventListener("pointerdown", dismiss); window.removeEventListener("keydown", key); };
  }, [open]);
  useEffect(() => {
    const row = tools.current;
    if (!row) return;
    // Bring the current tool into view, then show edge fades wherever more tools are hidden.
    const current = row.querySelector<HTMLElement>('[aria-current="page"]');
    if (current && row.scrollWidth > row.clientWidth)
      row.scrollLeft = Math.max(0, current.offsetLeft - (row.clientWidth - current.offsetWidth) / 2);
    const measure = () => {
      const next = { start: row.scrollLeft > 1, end: row.scrollLeft + row.clientWidth < row.scrollWidth - 1 };
      setMore(old => old.start === next.start && old.end === next.end ? old : next);
    };
    measure();
    row.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);
    return () => { row.removeEventListener("scroll", measure); window.removeEventListener("resize", measure); };
  }, [page, booklet]);
  return <header ref={header} className="site-navigation" onClick={event => {
    if ((event.target as HTMLElement).closest("a")) setOpen(false);
  }}>
    <div className="site-navigation-row">
      <a className="site-brand" href={pageHref("home")} aria-label="Maths Dock home"><img className="site-brand-logo" src={`${import.meta.env.BASE_URL}brand/mathsdock-logo.svg?v=2189ff58a13f`} width="1501" height="326" alt="Maths Dock" /></a>
      <button ref={button} type="button" className="site-menu-toggle" aria-expanded={open} aria-controls="site-sections" onClick={() => setOpen(!open)}>{open ? <X size={18} /> : <Menu size={18} />}<span>{page === "home" ? "Sections" : booklet ? "Booklet tools" : sectionName(section)}</span><ChevronDown size={14} /></button>
      <nav id="site-sections" aria-label="Main sections" className={`site-sections${open ? " is-open" : ""}`}>
        {siteSections.map(item => <a key={item.id} href={item.href} aria-current={section === item.id ? "page" : item.id === "booklet-tools" && booklet ? "true" : undefined}><item.icon size={17} aria-hidden="true" />{item.name}</a>)}
      </nav>
    </div>
    {booklet && <nav ref={tools} className={`site-tool-navigation${more.start ? " has-more-start" : ""}${more.end ? " has-more-end" : ""}`} aria-label="Booklet tools">
      <a href={pageHref("booklet-tools")} aria-current={page === "booklet-tools" ? "page" : undefined}>All tools</a>
      {bookletTools.map(tool => <a key={tool.id} href={pageHref(tool.id)} aria-current={page === tool.id ? "page" : undefined}><tool.icon size={16} aria-hidden="true" />{tool.name}</a>)}
    </nav>}
  </header>;
}
