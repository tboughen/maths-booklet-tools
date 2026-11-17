import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import type { DetailLoader } from "./catalogueLoader";
import type { BankListQuestion } from "./model";
import type { PaperDraft, PaperEntry } from "./paper-builder";
import { assetUrl } from "./pdf";
import { formatCount } from "./format";

/** The top of the question, fetched from its paper file when the row first comes near the visible part of the list. */
function Picture({question,loadDetails}:{question:BankListQuestion;loadDetails:DetailLoader["load"]}) {
  const box=useRef<HTMLSpanElement>(null),[src,setSrc]=useState("");
  useEffect(()=>{
    const el=box.current;if(!el||typeof IntersectionObserver==="undefined")return;
    let current=true,again=0;
    const near=new IntersectionObserver(found=>{
      if(!found.some(f=>f.isIntersecting))return;
      near.disconnect();
      // A failed fetch is tried again a little later, while the row is still near.
      loadDetails([question]).then(([full])=>{if(current)setSrc(assetUrl(full.questionViews[0].preview));}).catch(()=>{if(current)again=window.setTimeout(()=>near.observe(el),5000);});
    },{root:el.closest("ol"),rootMargin:"300px"});
    near.observe(el);
    return()=>{current=false;window.clearTimeout(again);near.disconnect();};
  },[question,loadDetails]);
  return <span ref={box} className="qb-paper-picture">{src&&<img src={src} alt=""/>}</span>;
}

interface Panel { loadDetails:DetailLoader["load"]; /** Questions removed by hand that would otherwise be on the paper. */ removed:number; onRemove:(key:string)=>void; onRestore:()=>void }
/** Your paper: a bar under the Question bank, or with `panel` the list of questions beside the Paper builder's codes. */
export function PaperSummary({draft,entries,revisionHidden=0,onIncludeRevision,onUntick,onClear,onReview,panel}:{draft:PaperDraft;entries:PaperEntry[];revisionHidden?:number;onIncludeRevision?:()=>void;onUntick:(code:string)=>void;onClear:()=>void;onReview:()=>void;panel?:Panel}) {
  const intent=!!(draft.codes.length||Object.keys(draft.manual).length);
  const saved=<p className="qb-small">{panel&&!entries.length&&"Each code you tick adds its questions here straight away. "}Shared questions count once. Your paper is saved on this device until you clear it.</p>;
  // Removing a row keeps the keyboard in the list: on the next row, else the row before, else Clear paper.
  function remove(button:HTMLElement,key:string) {
    const row=button.parentElement!,next=(row.nextElementSibling||row.previousElementSibling)?.querySelector("button")||row.closest("section")?.querySelector<HTMLElement>(".qb-summary-actions button");
    panel!.onRemove(key);next?.focus();
  }
  return <section className={`qb-paper-summary${panel?" qb-paper-panel":""}`} aria-label="Your paper">
    <div>{panel&&<h2>Your paper</h2>}<strong role="status">{draft.codes.length} selected code{draft.codes.length===1?"":"s"} · {formatCount(entries.length)} distinct question{entries.length===1?"":"s"} · {formatCount(entries.reduce((n,e)=>n+e.question.marks,0))} marks</strong><div className="qb-code-chips">{draft.codes.map(code=><button key={code} onClick={()=>onUntick(code)} aria-label={`Untick ${code}`}>{code} ×</button>)}</div>{!panel&&saved}{revisionHidden>0&&<p className="qb-small" role="status">{formatCount(revisionHidden)} matching question{revisionHidden===1?" is":"s are"} from Year 11 revision papers and left out.{onIncludeRevision&&<> <button className="qb-text-button" onClick={onIncludeRevision}>Include them</button></>}</p>}{intent&&!entries.length&&<p role="status">{panel?.removed?"Every matching question has been removed. Restore them, widen the filters or change your codes.":"No selected questions match these filters. Widen the filters or change your codes."}</p>}</div>
    {panel&&<><ol className="qb-paper-list">{entries.map(entry=>{const q=entry.question;return <li key={entry.key}><Picture question={q} loadDetails={panel.loadDetails}/><span><strong>{q.source}</strong><span>{q.tier==="F"?"Foundation":"Higher"} · {q.calculator?"Calculator":"Non-calculator"}</span><span><i>{entry.matchingCodes.join(", ")||"Picked"}</i> {draft.partsOnly&&entry.otherParts.length>0?"matching parts only":`${q.marks} mark${q.marks===1?"":"s"}`}</span></span><button className="qb-text-button" aria-label={`Remove ${q.source}`} onClick={e=>remove(e.currentTarget,entry.key)}><X size={16}/></button></li>;})}</ol>{saved}</>}
    <div className="qb-summary-actions"><button className="qb-button" disabled={!intent} onClick={onClear}>Clear paper</button>{panel&&panel.removed>0&&<button className="qb-text-button" onClick={panel.onRestore}>Restore {panel.removed} removed</button>}<button className="qb-button qb-primary" disabled={!entries.length} onClick={onReview}>Review paper</button></div>
  </section>;
}
