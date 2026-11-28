import { useCallback, useEffect, useRef, useState } from "react";
import { FileText, Paperclip, Trash2 } from "lucide-react";
import { fileHref, type Library, type Resource } from "./model";
import { COVER_ATTACHMENT_MAX, COVER_FIELD_MAX, COVER_FILE_MAX_BYTES, COVER_TEXT_MAX, coverLibrary, coverPlan, coverSuggestions, lastCoverDate, loadCoverLog, localToday, nextSchoolDay, officeText, planSentence, sendCoverRequest, ukDay, yearUnits, type CoverEntry, type CoverLogEntry } from "./cover";

type Attached = { name: string; text: string };
const stateWords: Record<CoverLogEntry["state"], string> = { waiting: "Saved", building: "Building", ready: "Ready", stopped: "Stopped" };
type CoverProps = { list: Library; covers: Resource[]; removed: Set<string>; canDelete: boolean; remove: (id: string) => Promise<void> };

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

/** The "Create cover booklet" view of the Resource library: a teacher describes one cover lesson and presses Build now; the Cover library beside it lists every cover booklet. */
export default function CoverRequest({ list, covers, removed, canDelete, remove }: CoverProps) {
  const [year, setYear] = useState(10);
  const [tier, setTier] = useState<"Foundation" | "Higher" | null>(null);
  const [className, setClassName] = useState("");
  const [room, setRoom] = useState("");
  const [date, setDate] = useState(() => nextSchoolDay());
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
  const today = localToday();
  const missing = tiered && !tier ? "Choose Foundation or Higher."
    : !className.trim() ? "Give the class name."
    : !room.trim() ? "Give the room."
    : !date || date < today || date > lastCoverDate() ? "Choose the date of the lesson: today or up to 30 days ahead."
    : !text.trim() ? "Describe what the lesson should revise."
    : !absent ? "Tick the box to say this is cover work." : "";

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
      const done = await sendCoverRequest({ year, tier: tiered ? tier : null, className: className.trim(), room: room.trim(), date, absent: true, text: text.trim(), plan: sentence, attachment: attached });
      // A fresh tick for any further request, so one press never sends twice.
      setSent(done); setChecking(false); setAbsent(false); refresh();
    } catch (e) { setMessage((e as Error).message); }
    finally { setBusy(false); }
  }

  return (
    <section className="cover-request" aria-labelledby="cover-title">
      <div className="cover-form">
        <h2 id="cover-title">Create cover booklet</h2>
        <p className="library-hint">Describe the lesson and it's built for you: one 8-side lesson marked <b>Cover lesson</b>, with the class, room and date on its first side, pupil and answers PDFs, in the Cover library in about 15 minutes.</p>
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
        <div className="cover-row cover-where">
          <label>Class (e.g. 10X2)<input type="text" required maxLength={COVER_FIELD_MAX} value={className} onChange={(e) => edit(() => setClassName(e.target.value))} /></label>
          <label>Room (e.g. M4)<input type="text" required maxLength={COVER_FIELD_MAX} value={room} onChange={(e) => edit(() => setRoom(e.target.value))} /></label>
          <label>Date<input type="date" required min={today} max={lastCoverDate()} value={date} onChange={(e) => edit(() => setDate(e.target.value))} /></label>
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
        <label className="cover-absent"><input type="checkbox" checked={absent} onChange={(e) => edit(() => setAbsent(e.target.checked))} />This is cover work for myself or a colleague.</label>
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
        {missing && !checking && !sent && (text || className || room) && <p className="library-status">{missing}</p>}
        {message && <p className="library-status" role="alert">{message}</p>}
        {sent && <p className="cover-sent" role="status">{sent.started ? "Building your cover booklet now. It will appear in the Cover library, usually within 15 minutes." : "Your request is saved. Your cover booklet will be built shortly and will appear in the Cover library."}</p>}
      </div>
      <CoverLibrary log={log} logError={logError} covers={covers} removed={removed} canDelete={canDelete} remove={remove} />
    </section>
  );
}

/** The Cover library (Tim, 27 Nov): every cover booklet and request, by lesson date, most recent first; older than 7 days folds away. */
function CoverLibrary({ log, logError, covers, removed, canDelete, remove }: { log: CoverLogEntry[] | null; logError: string } & Omit<CoverProps, "list">) {
  // Built booklets still show when the request log can't be loaded.
  const { recent, older } = coverLibrary(log ?? [], covers, removed);
  const item = (e: CoverEntry) => <CoverItem key={e.key} entry={e} canDelete={canDelete} remove={remove} />;
  return (
    <div className="cover-log" aria-labelledby="cover-library-title">
      <h2 id="cover-library-title">Cover library</h2>
      {logError && <p className="library-status">{logError}</p>}
      {!log && !logError ? <p className="library-status">Loading…</p> : !recent.length && !older.length ? <p className="library-status">No cover booklets yet.</p> : (
        <>
          {recent.length ? <ul>{recent.map(item)}</ul> : <p className="library-status">None in the last 7 days.</p>}
          {older.length > 0 && (
            <details className="cover-older">
              <summary>Older cover booklets ({older.length})</summary>
              <ul>{older.map(item)}</ul>
            </details>
          )}
        </>
      )}
    </div>
  );
}

function CoverItem({ entry: e, canDelete, remove }: { entry: CoverEntry; canDelete: boolean; remove: (id: string) => Promise<void> }) {
  const [sure, setSure] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const r = e.resource;
  const pdfs = (r?.files ?? []).filter((f) => f.format === "pdf").sort((a, b) => (a.role === b.role ? 0 : a.role === "pupil" ? -1 : 1));
  async function go(id: string) {
    setBusy(true); setMessage("");
    try { await remove(id); } catch (err) { setMessage((err as Error).message); setBusy(false); setSure(false); }
  }
  return (
    <li className={`cover-${e.state}`}>
      <span className="cover-where-line">{e.className || e.room ? <>{e.className && <b>Class {e.className}</b>}{e.className && e.room && " · "}{e.room && `Room ${e.room}`}</> : "Class and room not recorded"} · <b>{ukDay(e.date)}</b></span>
      <span>Year {e.year}{e.tier ? ` ${e.tier}` : ""}{e.who ? ` · ${e.who}` : ""} · <span className="cover-state">{stateWords[e.state]}</span></span>
      {e.text && <span className="cover-text">{e.text}</span>}
      {pdfs.length > 0 && (
        <span className="cover-files">
          {pdfs.map((f) => <a key={f.href} href={fileHref(f)} target="_blank" rel="noreferrer"><FileText size={14} aria-hidden="true" />{f.role === "answers" ? "Answers PDF" : "Pupil PDF"}</a>)}
        </span>
      )}
      {r && canDelete && (
        <span className="library-actions">
          {!sure ? <button type="button" className="library-chip" onClick={() => setSure(true)}><Trash2 size={13} aria-hidden="true" />Delete cover booklet</button>
            : <><span className="library-hint">Delete it from the Cover library?</span><button type="button" className="library-chip" disabled={busy} onClick={() => void go(r.id)}>Yes, delete it</button><button type="button" className="library-chip" disabled={busy} onClick={() => setSure(false)}>Keep it</button></>}
        </span>
      )}
      {message && <p className="library-status" role="alert">{message}</p>}
    </li>
  );
}
