import { useEffect, useRef, useState, type FormEvent } from "react";

export const REPORT_LIMIT = 2000;
export interface ReportDetails { question:string;source:string;showing:string;code:string;version:string;link:string }
interface Props { details?:ReportDetails;onClose:()=>void;onSent:()=>void }

// Sends a problem with one question to the site Worker, which files it for Tim (scripts/cloudflare/site-worker.mjs).
export function ReportDialog({details,onClose,onSent}:Props) {
  const dialog=useRef<HTMLDialogElement>(null);
  const [message,setMessage]=useState(""),[busy,setBusy]=useState(false),[error,setError]=useState("");
  const question=details?.question;
  // A new question starts with an empty box; a native close (a second Escape) still tells the page.
  useEffect(()=>{setMessage("");setError("");if(question)dialog.current?.showModal();else dialog.current?.close();},[question]);
  async function send(e:FormEvent) {
    e.preventDefault();
    if(!details||busy)return;
    if(!message.trim()){setError("Describe the problem before sending.");return;}
    setBusy(true);setError("");
    try {
      const response=await fetch("/api/report",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...details,message})});
      const reply=await response.json().catch(()=>({})) as {error?:string};
      if(!response.ok)throw new Error(reply.error||"The report could not be sent. Try again later.");
      setMessage("");onSent();
    } catch(failure) {setError(failure instanceof Error&&failure.message!=="Failed to fetch"?failure.message:"The report could not be sent. Check your connection and try again.");}
    finally {setBusy(false);}
  }
  return <dialog ref={dialog} className="qb-dialog qb-report-dialog" aria-labelledby="qb-report-title" onCancel={e=>{e.preventDefault();if(!busy)onClose();}} onClose={()=>{if(details)onClose();}}>
    <form onSubmit={e=>void send(e)}>
      <div className="qb-dialog-heading"><h2 id="qb-report-title">Report a problem</h2><button type="button" className="qb-button" disabled={busy} onClick={onClose}>Close</button></div>
      {details&&<p><strong>{details.source}</strong><br/>Showing: {details.showing}</p>}
      <label className="qb-report-label" htmlFor="qb-report-message">What is wrong?</label>
      <textarea id="qb-report-message" className="qb-report-message" rows={6} maxLength={REPORT_LIMIT} value={message} disabled={busy} placeholder="For example: part (b) is cut off, or the mark scheme shows a different question." onChange={e=>setMessage(e.target.value)} aria-describedby="qb-report-note"/>
      <p id="qb-report-note" className="qb-small">{message.length} of {REPORT_LIMIT} characters. The question, view and your sign-in email are sent with it.</p>
      {error&&<p className="qb-export-error" role="alert">{error}</p>}
      <div className="qb-dialog-actions"><button type="button" className="qb-button" disabled={busy} onClick={onClose}>Cancel</button><button type="submit" className="qb-button qb-primary" disabled={busy}>{busy?"Sending…":"Send report"}</button></div>
    </form>
  </dialog>;
}
