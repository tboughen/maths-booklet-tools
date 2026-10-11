import type { PaperDraft, PaperEntry } from "./paper-builder";
export function PaperSummary({draft,entries,onUntick,onClear,onReview}:{draft:PaperDraft;entries:PaperEntry[];onUntick:(code:string)=>void;onClear:()=>void;onReview:()=>void}) {
  const intent=!!(draft.codes.length||Object.keys(draft.manual).length);
  return <section className="qb-paper-summary" aria-label="Your paper">
    <div><strong role="status">{draft.codes.length} selected code{draft.codes.length===1?"":"s"} · {entries.length} distinct question{entries.length===1?"":"s"} · {entries.reduce((n,e)=>n+e.question.marks,0)} marks</strong><div className="qb-code-chips">{draft.codes.map(code=><button key={code} onClick={()=>onUntick(code)} aria-label={`Untick ${code}`}>{code} ×</button>)}</div><p className="qb-small">Shared questions count once. Your paper stays while you navigate this site; refresh clears it.</p>{intent&&!entries.length&&<p role="status">No selected questions match these filters. Widen the filters or change your codes.</p>}</div>
    <div className="qb-summary-actions"><button className="qb-button" disabled={!intent} onClick={onClear}>Clear paper</button><button className="qb-button qb-primary" disabled={!entries.length} onClick={onReview}>Review paper</button></div>
  </section>;
}
