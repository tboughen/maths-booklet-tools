import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import type { BankListQuestion, BankQuestion } from "./model";
import type { PaperDraft, PaperEntry } from "./paper-builder";
import { assetUrl } from "./pdf";
import { formatCount } from "./format";

type LoadDetails = <Q extends BankListQuestion>(questions:Q[])=>Promise<(Q&BankQuestion)[]>;
/** The top of the question, fetched from its paper file when the row first comes near the screen. */
function Picture({question,loadDetails}:{question:BankListQuestion;loadDetails:LoadDetails}) {
  const box=useRef<HTMLSpanElement>(null),[src,setSrc]=useState("");
  useEffect(()=>{
    const el=box.current;if(!el||typeof IntersectionObserver==="undefined")return;
    let current=true;
    const near=new IntersectionObserver(found=>{
      if(!found.some(f=>f.isIntersecting))return;
      near.disconnect();
      loadDetails([question]).then(([full])=>{if(current)setSrc(assetUrl(full.questionViews[0].preview));}).catch(()=>{});
    },{rootMargin:"300px"});
    near.observe(el);
    return()=>{current=false;near.disconnect();};
  },[question,loadDetails]);
  return <span ref={box} className="qb-paper-picture">{src&&<img src={src} alt=""/>}</span>;
}

/** Your paper: a bar under the Question bank, or with `panel` the list of questions beside the Paper builder's codes. */
export function PaperSummary({draft,entries,revisionHidden=0,onIncludeRevision,onUntick,onClear,onReview,panel}:{draft:PaperDraft;entries:PaperEntry[];revisionHidden?:number;onIncludeRevision?:()=>void;onUntick:(code:string)=>void;onClear:()=>void;onReview:()=>void;panel?:{loadDetails:LoadDetails;onRemove:(key:string)=>void;onRestore:()=>void}}) {
  const intent=!!(draft.codes.length||Object.keys(draft.manual).length),removed=draft.excluded.length;
  const saved=<p className="qb-small">{panel&&!entries.length&&"Each code you tick adds its questions here straight away. "}Shared questions count once. Your paper is saved on this device until you clear it.</p>;
  return <section className={`qb-paper-summary${panel?" qb-paper-panel":""}`} aria-label="Your paper">
    <div>{panel&&<h2>Your paper</h2>}<strong role="status">{draft.codes.length} selected code{draft.codes.length===1?"":"s"} · {formatCount(entries.length)} distinct question{entries.length===1?"":"s"} · {formatCount(entries.reduce((n,e)=>n+e.question.marks,0))} marks</strong><div className="qb-code-chips">{draft.codes.map(code=><button key={code} onClick={()=>onUntick(code)} aria-label={`Untick ${code}`}>{code} ×</button>)}</div>{!panel&&saved}{revisionHidden>0&&<p className="qb-small" role="status">{formatCount(revisionHidden)} matching question{revisionHidden===1?" is":"s are"} from Year 11 revision papers and left out.{onIncludeRevision&&<> <button className="qb-text-button" onClick={onIncludeRevision}>Include them</button></>}</p>}{intent&&!entries.length&&<p role="status">No selected questions match these filters. Widen the filters or change your codes.</p>}</div>
    {panel&&<><ol className="qb-paper-list">{entries.map(entry=>{const q=entry.question;return <li key={entry.key}><Picture question={q} loadDetails={panel.loadDetails}/><span><strong>{q.source}</strong><span>{q.tier==="F"?"Foundation":"Higher"} · {q.calculator?"Calculator":"Non-calculator"}</span><span><i>{entry.matchingCodes.join(", ")||"Picked"}</i> {q.marks} mark{q.marks===1?"":"s"}</span></span><button className="qb-text-button" aria-label={`Remove ${q.source}`} onClick={()=>panel.onRemove(entry.key)}><X size={16}/></button></li>;})}</ol>{saved}</>}
    <div className="qb-summary-actions"><button className="qb-button" disabled={!intent} onClick={onClear}>Clear paper</button>{panel&&removed>0&&<button className="qb-text-button" onClick={panel.onRestore}>Restore {removed} removed</button>}<button className="qb-button qb-primary" disabled={!entries.length} onClick={onReview}>Review paper</button></div>
  </section>;
}
