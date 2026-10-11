import { useEffect, useRef, useState } from "react";
import { BookOpen, ChevronDown, Menu, Shapes, X } from "lucide-react";
import { bookletTools, pageHref, pageName, type PageId } from "./registry";

export function SiteHeader({ page }: { page: PageId }) {
  const [open, setOpen] = useState(false);
  const header = useRef<HTMLElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const booklet = page !== "question-bank" && page !== "home";
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
  return <header ref={header} className="site-navigation" onClick={event => {
    if ((event.target as HTMLElement).closest("a")) setOpen(false);
  }}>
    <div className="site-navigation-row">
      <a className="site-brand" href={pageHref("home")} aria-label="Maths Tools home"><span className="site-brand-icon"><BookOpen size={22} aria-hidden="true" /></span><strong>Maths Tools</strong></a>
      <button ref={button} type="button" className="site-menu-toggle" aria-expanded={open} aria-controls="site-sections" onClick={() => setOpen(!open)}>{open ? <X size={18} /> : <Menu size={18} />}<span>{page === "home" ? "Sections" : booklet ? "Booklet tools" : "Question bank"}</span><ChevronDown size={14} /></button>
      <nav id="site-sections" aria-label="Main sections" className={`site-sections${open ? " is-open" : ""}`}>
        <a href={pageHref("question-bank")} aria-current={page === "question-bank" ? "page" : undefined}><BookOpen size={17} aria-hidden="true" />Question bank</a>
        <a href={pageHref("booklet-tools")} aria-current={booklet ? (page === "booklet-tools" ? "page" : "true") : undefined}><Shapes size={17} aria-hidden="true" />Booklet tools</a>
      </nav>
      <span className="site-current">{pageName(page)}</span>
    </div>
    {booklet && <nav className="site-tool-navigation" aria-label="Booklet tools">
      <a href={pageHref("booklet-tools")} aria-current={page === "booklet-tools" ? "page" : undefined}>All tools</a>
      {bookletTools.map(tool => <a key={tool.id} href={pageHref(tool.id)} aria-current={page === tool.id ? "page" : undefined}><tool.icon size={16} aria-hidden="true" />{tool.name}</a>)}
    </nav>}
  </header>;
}
