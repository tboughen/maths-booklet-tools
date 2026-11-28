import { useState } from "react";
import { ADAPT_CLASS_MAX, ADAPT_NAME_MAX, ADAPT_TEXT_MAX, adaptKinds, adaptName, kindOf, sendAdaptRequest, type AdaptAsked, type AdaptKind } from "./adapt";

/**
 * Asks for an adaptation of one lesson, or a whole unit (Tim, 28 Nov): easier, harder or a different approach, for a
 * class, saying what should change. It can join an adaptation the unit already has, or start a new one named by kind
 * and class. The request goes to Tim; the booklet arrives beside Main as waiting.
 */
export default function AdaptForm({ year, unit, lesson, title, existing, current, kinds, onSent, onCancel }: {
  year: number; unit: string; lesson: string | null; title: string; existing: string[]; current: string;
  kinds: Record<string, AdaptKind | undefined>; onSent: (asked: AdaptAsked, words: string) => void; onCancel: () => void;
}) {
  const [target, setTarget] = useState(existing.includes(current) ? current : "");
  const [kind, setKind] = useState<AdaptKind>("easier");
  const [className, setClassName] = useState("");
  const [own, setOwn] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const name = target || adaptName(kind, className, own);
  const sentKind = target ? kindOf(target, kinds[target]) : kind;
  const id = `adapt-${lesson ?? unit}`;
  async function send() {
    setBusy(true); setError("");
    try {
      const { number } = await sendAdaptRequest({ year, unit, lesson, kind: sentKind, name, text: text.trim() });
      onSent({ number: number ?? 0, when: new Date().toISOString(), lesson, kind: sentKind, name, who: "You", mine: true }, `Sent to Tim. ${lesson ?? `The whole of ${unit}`} arrives under “${name}” as waiting.`);
    } catch (e) { setError((e as Error).message); setBusy(false); }
  }
  return (
    <div className="library-adapt" role="group" aria-label={`Adapt ${lesson ?? `the whole of ${unit}`}`}>
      <p className="library-adapt-label">Adapt {lesson ? `${lesson} ${title}` : `the whole of ${unit} ${title}`}</p>
      {existing.length > 0 && (
        <fieldset>
          <legend>Add to</legend>
          {existing.map((v) => <label key={v}><input type="radio" name={`${id}-to`} checked={target === v} onChange={() => setTarget(v)} />{v}</label>)}
          <label><input type="radio" name={`${id}-to`} checked={!target} onChange={() => setTarget("")} />A new adaptation</label>
        </fieldset>
      )}
      {!target && (
        <>
          <fieldset>
            <legend>What kind?</legend>
            {(Object.keys(adaptKinds) as AdaptKind[]).map((k) => <label key={k}><input type="radio" name={`${id}-kind`} checked={kind === k} onChange={() => setKind(k)} />{adaptKinds[k]}</label>)}
          </fieldset>
          <div className="library-adapt-row">
            <label><span>For which class? <small>(optional)</small></span><input type="text" value={className} maxLength={ADAPT_CLASS_MAX} placeholder="9X" onChange={(e) => setClassName(e.target.value)} /></label>
            {kind === "different" && <label><span>Short name <small>(optional)</small></span><input type="text" value={own} maxLength={ADAPT_NAME_MAX} placeholder="Bar models first" onChange={(e) => setOwn(e.target.value)} /></label>}
          </div>
          <p className="library-hint">It will sit beside Main as “{name}”.</p>
        </>
      )}
      <label className="library-say">
        <span>What should change?</span>
        <textarea rows={3} value={text} maxLength={ADAPT_TEXT_MAX} autoFocus placeholder="For example: more whole-number questions first, no fraction gradients, scaled axes in stage 2." onChange={(e) => setText(e.target.value)} />
      </label>
      <div className="library-actions">
        <button type="button" className="primary" disabled={busy || !text.trim()} onClick={() => void send()}>{busy ? "Sending…" : "Send request"}</button>
        <button type="button" disabled={busy} onClick={onCancel}>Cancel</button>
      </div>
      <p className="library-hint">The booklet arrives here as waiting.</p>
      {error && <p className="library-status" role="alert">{error}</p>}
    </div>
  );
}
