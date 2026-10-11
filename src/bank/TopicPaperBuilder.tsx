import { useMemo, useState } from "react";
import { normalizeCode, type BankCatalogue, type BankRoute } from "./model";
import type { Coverage, PaperFilters } from "./coverage";
import type { PaperDraft, PaperEntry } from "./paper-builder";

interface Props { catalogue: BankCatalogue; coverage: Coverage; overall: Coverage; filters: PaperFilters; draft: PaperDraft; entries: PaperEntry[]; onCode: (code:string,checked:boolean)=>void; onFilters: (filters:PaperFilters)=>void; onBrowse: (code:string)=>void }
type Sort = "code" | "title" | "available" | "included" | "foundation" | "higher";
export function TopicPaperBuilder({catalogue,coverage,overall,filters,draft,entries,onCode,onFilters,onBrowse}: Props) {
  const [search,setSearch] = useState(""), [show,setShow] = useState("all"), [sort,setSort] = useState<Sort>("code"), [direction,setDirection] = useState(1);
  const included = useMemo(() => new Set(entries.map(e=>e.key)),[entries]);
  const selected = new Set(draft.codes);
  const rows = useMemo(() => catalogue.topics.map(topic => {
    const available = coverage.codes.get(topic.code) || new Set<string>();
    return {...topic, aliases:Object.entries(catalogue.aliases).filter(([,code])=>code===topic.code).map(([alias])=>alias), available:available.size, included:[...available].filter(key=>included.has(key)).length, foundation:coverage.foundation.get(topic.code)?.size||0, higher:coverage.higher.get(topic.code)?.size||0};
  }),[catalogue,coverage,included]);
  const term = search.trim().toLowerCase(), exactAlias = catalogue.aliases[normalizeCode(search)];
  const found = rows.filter(r => (!term || `${r.code} ${r.title} ${r.aliases.join(" ")}`.toLowerCase().includes(term) || r.code===exactAlias) && (show==="all" || show==="covered"&&r.available>0 || show==="zero"&&r.available===0 || show==="one"&&r.available===1)).sort((a,b)=> {
    const x=a[sort],y=b[sort];return direction*(typeof x==="number"&&typeof y==="number"?x-y:String(x).localeCompare(String(y),undefined,{numeric:true}))||a.code.localeCompare(b.code,undefined,{numeric:true});
  });
  function sortBy(key:Sort) {if(sort===key)setDirection(d=>-d);else {setSort(key);setDirection(key==="code"||key==="title"?1:-1);}}
  const columns: {key:Sort;label:string}[] = [{key:"code",label:"Sparx code"},{key:"title",label:"Topic"},{key:"available",label:"Available"},{key:"included",label:"Included"},...(filters.tier==="all"?[{key:"foundation" as const,label:"Foundation"},{key:"higher" as const,label:"Higher"}]:[])];
  return <section className="qb-topic-builder" aria-label="Build a paper by topic">
    <div className="qb-coverage-cards"><p><strong>{overall.examSeries} exam series</strong><span>{overall.examPapers} papers in the bank</span></p><p><strong>{overall.mockSeries} mock series</strong><span>{overall.mockPapers} papers in the bank</span></p><p><strong>{overall.groups.size.toLocaleString()} distinct questions</strong><span>Shared Foundation/Higher questions counted once</span></p></div>
    <div className="qb-topic-controls">
      <label>Search codes or topics<input aria-label="Search codes or topics" type="search" placeholder="For example U538 or fractions" value={search} onChange={e=>setSearch(e.target.value)}/></label>
      <label>Tier<select value={filters.tier} onChange={e=>onFilters({...filters,tier:e.target.value as BankRoute["tier"]})}><option value="all">Both tiers</option><option value="F">Foundation</option><option value="H">Higher</option></select></label>
      <label>Paper type<select value={filters.collection} onChange={e=>onFilters({...filters,collection:e.target.value as BankRoute["collection"]})}><option value="all">Exam and mock</option><option value="past">Exam</option><option value="mock">Mock</option></select></label>
      <label>Calculator<select value={filters.calculator} onChange={e=>onFilters({...filters,calculator:e.target.value as BankRoute["calculator"]})}><option value="all">Either</option><option value="yes">Calculator</option><option value="no">Non-calculator</option></select></label>
      <label>Show<select value={show} onChange={e=>setShow(e.target.value)}><option value="all">All codes</option><option value="covered">With questions</option><option value="zero">Without questions</option><option value="one">Exactly one question</option></select></label>
    </div>
    <p className="qb-small" role="status">{found.length} {found.length===1?"code":"codes"} listed · {rows.filter(r=>r.available>0).length} with questions · {rows.filter(r=>!r.available).length} without questions · {rows.filter(r=>r.available===1).length} with one question.<br/>Current filters: {coverage.examSeries} exam series / {coverage.examPapers} papers + {coverage.mockSeries} mock series / {coverage.mockPapers} papers · {coverage.groups.size.toLocaleString()} distinct questions.</p>
    <div className="qb-topic-table-scroll" tabIndex={0} aria-label="Topic table, scroll for more codes">
      <table className="qb-topic-table"><caption>Tick a code to include all matching complete questions. A question matching several codes appears once in your paper.</caption><thead><tr><th scope="col">Include</th>{columns.map(c=><th key={c.key} scope="col" aria-sort={sort===c.key?(direction===1?"ascending":"descending"):"none"}><button onClick={()=>sortBy(c.key)}>{c.label} {sort===c.key?(direction===1?"↑":"↓"):"↕"}</button></th>)}</tr></thead><tbody>{found.map(r=><tr key={r.code} className={selected.has(r.code)?"qb-topic-chosen":""}><td><input type="checkbox" aria-label={`Include questions for ${r.code}`} checked={selected.has(r.code)} disabled={!r.available&&!selected.has(r.code)} onChange={e=>onCode(r.code,e.target.checked)}/></td><td><button className="qb-text-button" onClick={()=>onBrowse(r.code)}>{r.code}</button>{r.aliases.length>0&&<small>Also {r.aliases.join(", ")}</small>}</td><td>{r.title}</td><td>{r.available}</td><td>{r.included}</td>{filters.tier==="all"&&<><td>{r.foundation}</td><td>{r.higher}</td></>}</tr>)}</tbody></table>
      {!found.length&&<p>No codes match this search and Show filter.</p>}
    </div>
    <p className="qb-small">Available and Included counts can overlap between codes. Foundation + Higher can exceed the distinct count because of shared questions.</p>
  </section>;
}
