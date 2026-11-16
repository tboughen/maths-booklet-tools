import { useMemo, useState } from "react";
import { normalizeCode, type BankCatalogue, type BankListQuestion } from "./model";
import type { Coverage, PaperFilters } from "./coverage";
import type { PaperDraft, PaperEntry } from "./paper-builder";
import { formatCount } from "./format";
import "./paper-builder.css";

interface Props { catalogue: BankCatalogue<BankListQuestion>; coverage: Coverage; overall: Coverage; filters: PaperFilters; draft: PaperDraft; entries: PaperEntry[]; onCode: (code:string,checked:boolean)=>void; onFilters: (filters:PaperFilters)=>void; onBrowse: (code:string)=>void }
type Sort = "code" | "title" | "available" | "included" | "foundation" | "higher";
export function TopicPaperBuilder({catalogue,coverage,overall,filters,draft,entries,onCode,onFilters,onBrowse}: Props) {
  const [search,setSearch] = useState(""), [show,setShow] = useState("covered"), [sort,setSort] = useState<Sort>("code"), [direction,setDirection] = useState(1);
  const included = useMemo(() => new Set(entries.map(e=>e.key)),[entries]);
  const selected = new Set(draft.codes);
  const rows = useMemo(() => catalogue.topics.map(topic => {
    const available = coverage.codes.get(topic.code) || new Set<string>();
    return {...topic, aliases:Object.entries(catalogue.aliases).filter(([,code])=>code===topic.code).map(([alias])=>alias), available:available.size, included:[...available].filter(key=>included.has(key)).length, foundation:coverage.foundation.get(topic.code)?.size||0, higher:coverage.higher.get(topic.code)?.size||0};
  }),[catalogue,coverage,included]);
  const term = search.trim().toLowerCase(), exactAlias = catalogue.aliases[normalizeCode(search)];
  const uncovered = rows.filter(r => !r.available).length;
  const matchesSearch = (r: (typeof rows)[number]) => !term || `${r.code} ${r.title} ${r.aliases.join(" ")}`.toLowerCase().includes(term) || r.code===exactAlias;
  const hidden = show==="covered" ? rows.filter(r => matchesSearch(r) && !r.available && !selected.has(r.code)).length : 0;
  const found = rows.filter(r => matchesSearch(r) && (show==="all" || show==="covered"&&(r.available>0||selected.has(r.code)) || show==="zero"&&r.available===0 || show==="one"&&r.available===1)).sort((a,b)=> {
    const x=a[sort],y=b[sort];return direction*(typeof x==="number"&&typeof y==="number"?x-y:String(x).localeCompare(String(y),undefined,{numeric:true}))||a.code.localeCompare(b.code,undefined,{numeric:true});
  });
  function sortBy(key:Sort) {if(sort===key)setDirection(d=>-d);else {setSort(key);setDirection(key==="code"||key==="title"?1:-1);}}
  const columns: {key:Sort;label:string}[] = [{key:"code",label:"Sparx code"},{key:"title",label:"Topic"},{key:"available",label:"Available"},{key:"included",label:"In paper"},...(filters.tier==="all"?[{key:"foundation" as const,label:"Foundation"},{key:"higher" as const,label:"Higher"}]:[])];
  const pick = <K extends keyof PaperFilters>(key: K, label: string, options: [PaperFilters[K], string][]) => <select aria-label={label} title={label} value={filters[key]} onChange={e=>onFilters({...filters,[key]:e.target.value} as PaperFilters)}>{options.map(([value,text])=><option key={value} value={value}>{text}</option>)}</select>;
  return <section className="qb-topic-builder" aria-label="Build a paper by topic">
    <div className="qb-topic-controls">
      <input aria-label="Search codes or topics" type="search" placeholder="Search codes or topics" value={search} onChange={e=>setSearch(e.target.value)}/>
      {pick("tier","Tier",[["all","Both tiers"],["F","Foundation"],["H","Higher"]])}
      {pick("collection","Paper type",[["all","Exam and mock"],["past","Exam papers"],["mock","Mock papers"]])}
      {pick("calculator","Calculator",[["all","Any calculator"],["yes","Calculator"],["no","Non-calculator"]])}
      {pick("crossover","Crossover",[["all","All questions"],["only","On both tiers only"]])}
      {pick("revision","Year 11 revision papers",[["hide","No revision papers"],["include","With revision papers"]])}
      <select aria-label="Show" title="Show" value={show} onChange={e=>setShow(e.target.value)}><option value="covered">With questions</option><option value="all">All codes, including {uncovered} without questions</option><option value="zero">Without questions ({uncovered})</option><option value="one">Exactly one question</option></select>
    </div>
    <p className="qb-topic-status"><span role="status" title={`${coverage.examSeries} exam series and ${coverage.mockSeries} mock series under these filters. The whole bank has ${overall.examSeries} exam series and ${overall.mockSeries} mock series.`}><strong>{found.length} {found.length===1?"code":"codes"}</strong> listed · {formatCount(coverage.groups.size)} distinct questions from {formatCount(coverage.examPapers+coverage.mockPapers)} papers · whole bank {formatCount(overall.groups.size)} from {formatCount(overall.examPapers+overall.mockPapers)} papers</span><span>A question that matches several codes appears once in your paper.</span></p>
    <div className="qb-topic-table-scroll" tabIndex={0} aria-label="Topic table, scroll for more codes">
      <table className="qb-topic-table"><caption className="sr-only">Tick a code to include all matching complete questions. Available and In paper counts can overlap between codes. Foundation + Higher can exceed the distinct count because of shared questions.</caption><thead><tr><th scope="col"><span className="sr-only">Include</span></th>{columns.map(c=><th key={c.key} scope="col" aria-sort={sort===c.key?(direction===1?"ascending":"descending"):"none"}><button onClick={()=>sortBy(c.key)}>{c.label}{sort===c.key&&(direction===1?" ↑":" ↓")}</button></th>)}</tr></thead><tbody>{found.map(r=><tr key={r.code} className={selected.has(r.code)?"qb-topic-chosen":""}><td><input type="checkbox" aria-label={`Include questions for ${r.code}`} checked={selected.has(r.code)} disabled={!r.available&&!selected.has(r.code)} onChange={e=>onCode(r.code,e.target.checked)}/></td><td><button className="qb-text-button" onClick={()=>onBrowse(r.code)}>{r.code}</button>{r.aliases.length>0&&<small>Also {r.aliases.join(", ")}</small>}</td><td>{r.title}</td><td>{r.available}</td><td>{r.included}</td>{filters.tier==="all"&&<><td>{r.foundation}</td><td>{r.higher}</td></>}</tr>)}</tbody></table>
      {!found.length&&<p>{show==="covered"?"No codes with questions match this search.":"No codes match this search and Show filter."}</p>}{term&&hidden>0&&<p className="qb-small">{hidden} matching {hidden===1?"code has":"codes have"} no questions under these filters. Choose Show: All codes to see {hidden===1?"it":"them"}.</p>}
    </div>
  </section>;
}
