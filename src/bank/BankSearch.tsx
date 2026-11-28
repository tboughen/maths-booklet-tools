import { useId, useMemo, useRef, useState, type FormEvent, type KeyboardEvent, type RefObject } from "react";
import { Search } from "lucide-react";
import { bankPapers, matchPapers, paperName, type BankCatalogue, type BankListQuestion, type BankTopic } from "./model";
import { formatCount } from "./format";

interface Option { id: string; kind: "paper" | "topic"; key: string; name: string; detail: string }

/**
 * The Question bank's one search box: Sparx codes, topics and papers. Typing a paper ("nov 23 2h")
 * lists matching papers first; "Browse all papers" shows every paper as a grid of series by paper.
 */
export function BankSearch({catalogue, value, onChange, topics, input, onTopic, onPaper, onFind}: {
  catalogue?: BankCatalogue<BankListQuestion>; value: string; onChange: (text: string) => void; topics: BankTopic[];
  input: RefObject<HTMLInputElement | null>; onTopic: (code: string) => void; onPaper: (paperId: string) => void; onFind: () => void;
}) {
  const grid = useRef<HTMLDivElement>(null), id = useId(), [open, setOpen] = useState(false), [browse, setBrowse] = useState(false), [active, setActive] = useState(-1);
  const papers = useMemo(() => catalogue ? bankPapers(catalogue) : [], [catalogue]);
  const matched = useMemo(() => matchPapers(papers, value), [papers, value]);
  const options: Option[] = [
    ...matched.slice(0, 8).map(p => ({id: `${id}-p-${p.id}`, kind: "paper" as const, key: p.id, name: paperName(p), detail: `${p.ks2 ? "KS2" : p.tier === "H" ? "Higher" : "Foundation"} · ${p.calculator ? "Calculator" : "Non-calculator"} · ${formatCount(p.questions)} questions · ${formatCount(p.marks)} marks`})),
    ...(matched.length ? [] : topics.slice(0, 12)).map(t => ({id: `${id}-t-${t.code}`, kind: "topic" as const, key: t.code, name: `${t.code} ${t.title}`, detail: `${formatCount(t.availableCount ?? t.pilotCount)} available`})),
  ];
  const close = () => {setOpen(false); setBrowse(false); setActive(-1);};
  const pick = (option: Option) => {close(); if (option.kind === "paper") onPaper(option.key); else onTopic(option.key);};
  function submit(event: FormEvent) {
    event.preventDefault();
    if (open && options[active]) pick(options[active]);
    else if (matched.length) {close(); onPaper(matched[0].id);}
    else {close(); onFind();}
  }
  function keys(event: KeyboardEvent) {
    if (event.key === "Escape" && (open || browse)) {event.preventDefault(); close(); input.current?.focus(); return;}
    if (event.target !== input.current || (event.key !== "ArrowDown" && event.key !== "ArrowUp")) return;
    event.preventDefault(); setOpen(true); setBrowse(false);
    const n = options.length, down = event.key === "ArrowDown";
    setActive(i => !n ? -1 : down ? (i + 1) % n : i <= 0 ? n - 1 : i - 1);
  }
  const sets = [...new Set(papers.map(p => p.set))];
  const head = (label: string) => <li role="presentation" className="qb-suggest-head">{label}</li>;
  return <form onSubmit={submit} className="qb-search-form" onKeyDown={keys} onBlur={e => {if (!e.currentTarget.contains(e.relatedTarget as Node | null)) close();}}>
    <label className="qb-search"><Search size={18}/><input ref={input} role="combobox" aria-label="Sparx code, topic or paper" aria-expanded={open && !browse && options.length > 0} aria-controls={`${id}-list`} aria-autocomplete="list" aria-activedescendant={open && options[active] ? options[active].id : undefined}
      value={value} placeholder="Sparx code, topic or paper" autoComplete="off" onFocus={() => setOpen(true)}
      onChange={e => {onChange(e.target.value); setOpen(true); setBrowse(false); setActive(-1);}}/></label>
    <button className="qb-button qb-primary" type="submit">Find</button>
    {open && !browse && <div className="qb-suggest">
      {options.length > 0 && <ul id={`${id}-list`} role="listbox" aria-label="Suggestions">
        {matched.length > 0 && head("Papers")}
        {!matched.length && options.length > 0 && head("Topics")}
        {options.map((option, i) => <li key={option.id} id={option.id} role="option" aria-selected={i === active} className={i === active ? "active" : undefined}
          onMouseDown={e => e.preventDefault()} onClick={() => pick(option)}><b>{option.name}</b><span>{option.detail}</span></li>)}
      </ul>}
      <button type="button" className="qb-text-button" onMouseDown={e => e.preventDefault()} onClick={() => {setBrowse(true); setActive(-1); requestAnimationFrame(() => grid.current?.querySelector("button")?.focus());}}>Browse all {formatCount(papers.length)} papers…</button>
    </div>}
    {browse && <div ref={grid} className="qb-suggest qb-browse" role="group" aria-label="All papers">
      {sets.map(set => <div key={set} className="qb-browse-row"><span>{set}</span>
        {papers.filter(p => p.set === set).map(p => <button type="button" key={p.id} className="qb-button" aria-label={paperName(p)} onMouseDown={e => e.preventDefault()} onClick={() => {close(); onPaper(p.id);}}>{p.paper}{p.tier}</button>)}
      </div>)}
    </div>}
  </form>;
}
