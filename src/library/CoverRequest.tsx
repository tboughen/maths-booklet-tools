import { useCallback, useEffect, useRef, useState } from "react";
import { Paperclip } from "lucide-react";
import type { Library } from "./model";
import { COVER_ATTACHMENT_MAX, COVER_FILE_MAX_BYTES, COVER_TEXT_MAX, coverPlan, coverSuggestions, loadCoverLog, officeText, planSentence, sendCoverRequest, yearUnits, type CoverLogEntry } from "./cover";

type Attached = { name: string; text: string };
const stateWords: Record<CoverLogEntry["state"], string> = { waiting: "Saved, waiting to build", building: "Building", ready: "In the library", stopped: "Stopped" };

/** Text out of an attached file, read on the teacher's own device: PowerPoint, Word or PDF. */
async function readAttachment(file: File): Promise<Attached> {
  if (file.size > COVER_FILE_MAX_BYTES) throw new Error("That file is over 15 MB. Attach a smaller one, or describe it in the box.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  let text = "";
  if (/\.(pptx|docx)$/i.test(file.name)) text = await officeText(bytes);
  else if (/\.pdf$/i.test(file.name)) {
    const { readPdf } = await import("../export/pdfjs");
    const pdf = await (readPdf as unknown as (src: { data: Uint8Array }) => { promise: Promise<{ numPages: number; getPage(n: number): Promise<{ getTextContent(): Promise<{ items: { str?: string }[] }> }> }> })({ data: bytes }).promise;
    const pages: string[] = [];
    for (let n = 1; n <= Math.min(pdf.numPages, 30); n++) pages.push(`Page ${n}: ${(await (await pdf.getPage(n)).getTextContent()).items.map((i) => i.str ?? "").join(" ").replace(/\s+/g, " ").trim()}`);
    text = pages.join("\n");
  } else throw new Error("Attach a PowerPoint (.pptx), Word (.docx) or PDF file.");
  if (!text.trim()) throw new Error("No words could be read from that file. Describe what's on it in the box instead.");
  return { name: file.name.slice(0, 120), text: text.slice(0, COVER_ATTACHMENT_MAX) };
}

/** The "Request cover" view of the Resource library: an absent teacher describes one cover lesson and presses Build now. */
export default function CoverRequest({ list }: { list: Library }) {
  const [year, setYear] = useState(10);
  const [tier, setTier] = useState<"Foundation" | "Higher" | null>(null);
  const [text, setText] = useState("");
  const [attached, setAttached] = useState<Attached | null>(null);
  const [absent, setAbsent] = useState(false);
  const [checking, setChecking] = useState(false);
  const [upTo, setUpTo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState<{ number: number; started: boolean } | null>(null);
  const [log, setLog] = useState<CoverLogEntry[] | null>(null);
  const [logError, setLogError] = useState("");
  const box = useRef<HTMLTextAreaElement>(null);

  const tiered = year >= 9;
  const group = `Year ${year}${tiered && tier ? ` ${tier}` : ""}`;
  const plan = coverPlan(list, year, text, upTo);
  const sentence = planSentence(plan, group, attached?.name ?? null);
  const missing = !text.trim() ? "Describe what the lesson should revise." : tiered && !tier ? "Choose Foundation or Higher." : !absent ? "Tick the box to say you're absent." : "";

  const refresh = useCallback(() => {
    loadCoverLog().then((d) => { setLog(d.requests); setLogError(""); }, (e: Error) => setLogError(e.message));
  }, []);
  useEffect(refresh, [refresh]);
  // While one of the teacher's own requests is building, look again every minute.
  const building = !!log?.some((r) => r.mine && (r.state === "building" || r.state === "waiting"));
  useEffect(() => {
    if (!building) return;
    const t = window.setInterval(refresh, 60000);
    return () => window.clearInterval(t);
  }, [building, refresh]);

  function edit(fn: () => void) { fn(); setChecking(false); setUpTo(null); setSent(null); setMessage(""); }
  async function attach(file: File | undefined) {
    if (!file) return;
    setMessage("Reading the file…");
    try { const a = await readAttachment(file); edit(() => setAttached(a)); setMessage(""); }
    catch (e) { setMessage((e as Error).message); }
  }
  async function build() {
    if (missing || (plan.needsLesson && !upTo)) return;
    setBusy(true); setMessage("");
    try {
      const done = await sendCoverRequest({ year, tier: tiered ? tier : null, absent: true, text: text.trim(), plan: sentence, attachment: attached });
      // A fresh tick for any further request, so one press never sends twice.
      setSent(done); setChecking(false); setAbsent(false); refresh();
    } catch (e) { setMessage((e as Error).message); }
    finally { setBusy(false); }
  }

  return (
    <section className="cover-request" aria-labelledby="cover-title">
      <div className="cover-form">
        <h2 id="cover-title">Ask for a cover lesson</h2>
        <p className="library-hint">For when you're absent. Describe the lesson and it's built for you: one 8-side lesson marked <b>Cover lesson</b>, pupil and answers PDFs, in the library in about 15 minutes.</p>
        <div className="cover-row">
          <label>Year group
            <select value={year} onChange={(e) => edit(() => { setYear(Number(e.target.value)); if (Number(e.target.value) < 9) setTier(null); })}>
              {[7, 8, 9, 10, 11].map((y) => <option key={y} value={y}>Year {y}</option>)}
            </select>
          </label>
          {tiered && (
            <fieldset className="cover-tier">
              <legend>Tier</legend>
              {(["Foundation", "Higher"] as const).map((t) => (
                <label key={t}><input type="radio" name="cover-tier" checked={tier === t} onChange={() => edit(() => setTier(t))} />{t}</label>
              ))}
            </fieldset>
          )}
        </div>
        <label htmlFor="cover-text" className="cover-label">What should the lesson cover?</label>
        <div className="cover-suggestions" role="group" aria-label="Suggestions to begin with">
          {coverSuggestions.map((s) => (
            <button key={s.label} type="button" onClick={() => { edit(() => setText(s.text)); box.current?.focus(); }}>{s.label}</button>
          ))}
        </div>
        <textarea id="cover-text" ref={box} value={text} maxLength={COVER_TEXT_MAX} rows={4} placeholder="e.g. We're on NP17, lesson 3. Revise the lessons so far. No calculators in that room." onChange={(e) => edit(() => setText(e.target.value))} />
        <p className="library-hint">Year {year} units: {yearUnits(list, year).map((u) => u.code).join(", ") || "none listed"}.</p>
        <div className="cover-attach">
          <label className="cover-file"><Paperclip size={16} aria-hidden="true" />{attached ? `Attached: ${attached.name}` : "Attach a resource (optional): PowerPoint, Word or PDF"}
            <input type="file" accept=".pptx,.docx,.pdf" onChange={(e) => { void attach(e.target.files?.[0]); e.target.value = ""; }} />
          </label>
          {attached && <button type="button" className="cover-link" onClick={() => edit(() => setAttached(null))}>Remove</button>}
        </div>
        <p className="library-hint">Only the words in the file are read and sent, not its pictures. Don't attach anything with pupils' names or marks.</p>
        <p className="cover-fixed">One cover lesson · 8 sides · pupil and answers PDFs</p>
        <label className="cover-absent"><input type="checkbox" checked={absent} onChange={(e) => edit(() => setAbsent(e.target.checked))} />I'm absent, and this is cover for my own class.</label>
        <p className="library-hint">Requests are logged.</p>
        {!checking ? (
          <button type="button" className="cover-go" disabled={!!missing} onClick={() => setChecking(true)}>Check and build</button>
        ) : (
          <div className="cover-check" role="region" aria-label="Check before building">
            <p>{sentence}</p>
            {(plan.unit || upTo === "none") && (plan.needsLesson || plan.upTo || upTo === "none") && (
              <label>Up to and including
                <select value={upTo ?? plan.upTo ?? ""} onChange={(e) => setUpTo(e.target.value || null)}>
                  <option value="">Choose the lesson your class is on</option>
                  <option value="none">{plan.unit?.code ?? "That code"} isn't a unit here: follow my description</option>
                  {(plan.unit?.lessons ?? []).map((l) => <option key={l.code} value={l.code}>{l.code} {l.title}</option>)}
                </select>
              </label>
            )}
            <p className="library-hint">Is that right?</p>
            <div className="cover-row">
              <button type="button" className="cover-go" disabled={busy || (plan.needsLesson && !upTo)} onClick={() => void build()}>{busy ? "Sending…" : "Yes, build it"}</button>
              <button type="button" className="cover-link" onClick={() => { setChecking(false); setUpTo(null); }}>Change it</button>
            </div>
          </div>
        )}
        {missing && !checking && text && <p className="library-status">{missing}</p>}
        {message && <p className="library-status" role="alert">{message}</p>}
        {sent && <p className="cover-sent" role="status">{sent.started ? "Building your cover lesson now. It will appear here and in the library, usually within 15 minutes." : "Your request is saved. Your cover lesson will be built shortly and will appear here and in the library."}</p>}
      </div>
      <div className="cover-log">
        <h2>Recent requests</h2>
        {logError ? <p className="library-status">{logError}</p> : !log ? <p className="library-status">Loading…</p> : !log.length ? <p className="library-status">No requests yet.</p> : (
          <ul>
            {log.map((r) => (
              <li key={r.number} className={`cover-${r.state}`}>
                <span><b>Year {r.year}{r.tier ? ` ${r.tier}` : ""}</b> · {r.mine ? "You" : r.who} · {new Date(r.when).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                <span className="cover-state">{stateWords[r.state]}</span>
                <span className="cover-text">{r.text}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
