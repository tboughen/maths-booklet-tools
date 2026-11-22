import { useEffect, useMemo, useState, type FormEvent } from "react";
import { bankPapers, type BankCatalogue, type BankListQuestion } from "./model";

const PAPER_NAMES: Record<string, string> = {"1": "Paper 1 (non-calculator)", "2": "Paper 2 (calculator)", "3": "Paper 3 (calculator)"};

/** Series, paper and tier: opens one paper whole, in paper order. */
export function PaperPicker({catalogue, current, onOpen}: {catalogue?: BankCatalogue<BankListQuestion>; current?: string; onOpen: (paperId: string) => void}) {
  const papers = useMemo(() => catalogue ? bankPapers(catalogue) : [], [catalogue]);
  const sets = useMemo(() => [...new Set(papers.map(p => p.set))], [papers]);
  const [set, setSet] = useState(""), [paper, setPaper] = useState("1"), [tier, setTier] = useState<"F" | "H">("H");
  // The picker shows the open paper, so the teacher can step to its other tier or number.
  useEffect(() => {
    const open = papers.find(p => p.id === current);
    if (open) {setSet(open.set); setPaper(open.paper); setTier(open.tier);}
  }, [papers, current]);
  const chosen = papers.find(p => p.set === set && p.paper === paper && p.tier === tier);
  const group = (mock: boolean) => sets.filter(s => papers.some(p => p.set === s && p.mock === mock)).map(s => <option key={s} value={s}>{s}</option>);
  function submit(event: FormEvent) {event.preventDefault(); if (chosen) onOpen(chosen.id);}
  return <form className="qb-paper-picker" aria-label="Open a paper" onSubmit={submit}>
    <span>Open a paper</span>
    <select aria-label="Series" value={set} disabled={!papers.length} onChange={e => setSet(e.target.value)}>
      <option value="" disabled>Series…</option>
      <optgroup label="Exam series">{group(false)}</optgroup>
      <optgroup label="Mock sets">{group(true)}</optgroup>
    </select>
    <select aria-label="Paper" value={paper} onChange={e => setPaper(e.target.value)}>{["1", "2", "3"].map(n => <option key={n} value={n}>{PAPER_NAMES[n]}</option>)}</select>
    <select aria-label="Tier" value={tier} onChange={e => setTier(e.target.value as "F" | "H")}><option value="F">Foundation</option><option value="H">Higher</option></select>
    <button className="qb-button" type="submit" disabled={!chosen || chosen.id === current}>Open</button>
  </form>;
}
