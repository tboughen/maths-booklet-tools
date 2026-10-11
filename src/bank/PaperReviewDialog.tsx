import { useEffect, useRef, useState } from "react";
import { makePapers, type ExportProgress, type ExportResult } from "./export";
import { assetUrl, downloadBlob } from "./pdf";
import type { PaperEntry } from "./paper-builder";

interface Props { open:boolean;active:boolean;entries:PaperEntry[];version:string;excluded:number;onClose:()=>void;onRemove:(key:string)=>void;onMove:(key:string,direction:number)=>void;onRestore:()=>void }
function QuestionPreview({entry}:{entry:PaperEntry}) {
  const [open,setOpen]=useState(false),[scheme,setScheme]=useState(false), q=entry.question;
  return <details className="qb-paper-preview" onToggle={e=>setOpen(e.currentTarget.open)}><summary>View complete question</summary>{open&&<><div>{q.questionViews.map(v=><figure key={v.id}><img loading="lazy" src={assetUrl(v.preview)} width={v.width} height={v.height} alt={`${q.source} — Question — ${v.label}`}/><figcaption>{v.label}</figcaption></figure>)}</div><details onToggle={e=>setScheme(e.currentTarget.open)}><summary>View mark scheme</summary>{scheme&&<>{q.schemeSourceNote&&<p className="qb-erratum">{q.schemeSourceNote}</p>}{q.schemeViews.map(v=><figure key={v.id}><img loading="lazy" src={assetUrl(v.preview)} width={v.width} height={v.height} alt={`${q.source} — Mark scheme — ${v.label}`}/><figcaption>{v.label}</figcaption></figure>)}</>}</details></>}</details>;
}

export function PaperReviewDialog({open,active,entries,version,excluded,onClose,onRemove,onMove,onRestore}:Props) {
  const dialog=useRef<HTMLDialogElement>(null), abort=useRef<AbortController|undefined>(undefined),generation=useRef(0);
  const [preset,setPreset]=useState<"compact"|"writing">("compact"),[progress,setProgress]=useState<ExportProgress>(),[result,setResult]=useState<ExportResult>(),[error,setError]=useState("");
  const [busy,setBusy]=useState(false);
  useEffect(()=>{
    generation.current++;abort.current?.abort();setResult(undefined);setProgress(undefined);setBusy(false);setError("");
    if(open&&active)dialog.current?.showModal();else dialog.current?.close();
  },[open,active,entries,preset,version]);
  useEffect(()=>()=>{generation.current++;abort.current?.abort();},[]);
  function cancel() {generation.current++;abort.current?.abort();setBusy(false);setProgress(undefined);setResult(undefined);setError("Export cancelled. Your selection is unchanged.");}
  async function prepare() {
    if(busy||!entries.length)return;
    const current=++generation.current,controller=new AbortController();abort.current=controller;setBusy(true);setResult(undefined);setError("");
    const questions=structuredClone(entries.map(e=>e.question));
    try {
      const next=await makePapers(questions,version,preset,p=>{if(current===generation.current)setProgress(p);},controller.signal);
      if(current===generation.current&&!controller.signal.aborted)setResult(next);
    } catch(e) {if(current===generation.current)setError(controller.signal.aborted?"Export cancelled. Your selection is unchanged.":e instanceof Error?e.message:"Export failed. Try again.");}
    finally {if(current===generation.current){setBusy(false);setProgress(undefined);}}
  }
  return <dialog ref={dialog} className="qb-dialog qb-paper-dialog" aria-labelledby="qb-paper-title" onCancel={e=>{e.preventDefault();onClose();}}>
    <div className="qb-dialog-heading"><h2 id="qb-paper-title">Review your paper</h2><button className="qb-button" aria-label="Close paper review" onClick={onClose}>Close</button></div>
    <p><strong>{entries.length} complete {entries.length===1?"question":"questions"} · {entries.reduce((n,e)=>n+e.question.marks,0)} marks</strong><br/>Both PDFs follow this order. Complete questions include parts mapped to other topics.</p>
    <ol className="qb-paper-review-list">{entries.map((entry,i)=>{const q=entry.question;return <li key={entry.key}><div className="qb-paper-review-row"><div><strong>{i+1}. {q.source}</strong><p>{q.marks} marks · {q.tier==="F"?"Foundation":"Higher"} · {q.calculator?"Calculator":"Non-calculator"}<br/>{entry.matchingCodes.length?`Matching selected codes: ${entry.matchingCodes.join(", ")}`:"Individually selected"}</p>{entry.otherParts.length>0&&<p className="qb-erratum">Additional parts included: {entry.otherParts.join(", ")}.</p>}{q.equivalentSource&&<p className="qb-small">Also appears as {q.equivalentSource}.</p>}{q.scaleSensitive&&<p className="qb-erratum">Scale drawing: print at Actual size / 100%.</p>}{q.sourceErrata?.map((n,j)=><p className="qb-erratum" key={j}>{n.note}</p>)}</div><div className="qb-paper-review-actions"><button className="qb-button" aria-label={`Move question ${i+1} up`} disabled={busy||i===0} onClick={()=>onMove(entry.key,-1)}>↑</button><button className="qb-button" aria-label={`Move question ${i+1} down`} disabled={busy||i===entries.length-1} onClick={()=>onMove(entry.key,1)}>↓</button><button className="qb-button" disabled={busy} aria-label={`Remove question ${i+1}`} onClick={()=>onRemove(entry.key)}>Remove</button></div></div><QuestionPreview entry={entry}/></li>;})}</ol>
    <div className="qb-paper-export-controls"><button className="qb-text-button" disabled={busy||!excluded} onClick={onRestore}>Restore individually removed questions ({excluded})</button><fieldset disabled={busy}><legend>Page layout</legend><label><input type="radio" name="paper-preset" checked={preset==="compact"} onChange={()=>setPreset("compact")}/> Compact practice</label><label><input type="radio" name="paper-preset" checked={preset==="writing"} onChange={()=>setPreset("writing")}/> Writing space</label></fieldset>
    {error&&<p className="qb-export-error" role="alert">{error}</p>}{progress&&<div role="status"><p>{progress.message}</p><progress value={progress.done} max={progress.total}/></div>}
    {result?<div className="qb-export-ready" role="status"><strong>Both PDFs are ready</strong><button className="qb-button qb-primary" onClick={()=>downloadBlob(result.questions,"practice-questions.pdf")}>Questions PDF</button><button className="qb-button" onClick={()=>downloadBlob(result.schemes,"practice-mark-schemes.pdf")}>Mark schemes PDF</button></div>:<div className="qb-dialog-actions">{busy&&<button className="qb-button" onClick={cancel}>Cancel export</button>}<button className="qb-button qb-primary" disabled={busy||!entries.length} onClick={()=>void prepare()}>Prepare both PDFs</button></div>}
    <p className="qb-small">Original question numbers remain visible. This custom paper has no official grade boundaries.</p></div>
  </dialog>;
}
