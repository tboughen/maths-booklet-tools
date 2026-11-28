import { useCallback, useEffect, useRef, useState } from "react";
import { FileText, Info, Paperclip, Trash2 } from "lucide-react";
import { fileHref, type Library, type Resource } from "./model";
import { buildProgress, COVER_ATTACHMENT_MAX, COVER_FIELD_MAX, COVER_FILE_MAX_BYTES, COVER_TEXT_MAX, coverLibrary, coverPlan, coverSuggestions, lastCoverDate, loadCoverLog, localToday, nextSchoolDay, officeText, planSentence, sendCoverRequest, ukDay, yearUnits, type CoverEntry, type CoverLogEntry } from "./cover";

type Attached = { name: string; text: string };
const stateWords: Record<CoverLogEntry["state"], string> = { waiting: "Saved, waiting to start", building: "Building", ready: "Ready", stopped: "Stopped" };
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
  const sentence = planSentence(plan, group, attached?.name ?? null, text);
  const pickLesson = (plan.unit || upTo === "none") && (plan.needsLesson || plan.upTo || upTo === "none");
  const today = localToday();
  const missing = tiered && !tier ? "Choose Foundation or Higher."
    : !className.trim() ? "Give the class name."
    : !room.trim() ? "Give the room."
    : !date || date < today || date > lastCoverDate() ? "Choose the date of the lesson: today or up to 30 days ahead."
    : !text.trim() ? "Describe what the lesson should revise."
    : plan.needsLesson && !upTo ? "Choose the lesson your class is on."
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

  function edit(fn: () => void) { fn(); setSent(null); setMessage(""); }
  async function attach(file: File | undefined) {
    if (!file) return;
    setMessage("Reading the file…");
    try { const a = await readAttachment(file); edit(() => setAttached(a)); setMessage(""); }
    catch (e) { setMessage((e as Error).message); }
  }
  async function build() {
    if (missing || busy) return;
    setBusy(true); setMessage("");
    try {
      const done = await sendCoverRequest({ year, tier: tiered ? tier : null, className: className.trim(), room: room.trim(), date, absent: true, text: text.trim(), plan: sentence, attachment: attached });
      // A fresh tick for any further request, so one press never sends twice.
      setSent(done); setAbsent(false); refresh();
    } catch (e) { setMessage((e as Error).message); }
    finally { setBusy(false); }
  }

  return (
    <section className="cover-request" aria-labelledby="cover-title">
      <div className="cover-form">
        <h2 id="cover-title">Create cover booklet</h2>
        <p className="library-hint">Fill in the class, room and date, and say what to revise. Pupil and answers PDFs in about 15 minutes.</p>
        <div className="cover-row">
          <label>Year group
            <select value={year} onChange={(e) => edit(() => { setYear(Number(e.target.value)); setUpTo(null); if (Number(e.target.value) < 9) setTier(null); })}>
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
          <label>Class<input type="text" required maxLength={COVER_FIELD_MAX} placeholder="e.g. 10X2" value={className} onChange={(e) => edit(() => setClassName(e.target.value))} /></label>
          <label>Room<input type="text" required maxLength={COVER_FIELD_MAX} placeholder="e.g. M4" value={room} onChange={(e) => edit(() => setRoom(e.target.value))} /></label>
          <label>Cover for (date)<input type="date" required min={today} max={lastCoverDate()} value={date} onChange={(e) => edit(() => setDate(e.target.value))} /></label>
        </div>
        <div className="cover-label"><label htmlFor="cover-text">What should the lesson revise?</label>
          <InfoTip label="What you can ask for">
            <b>You can ask for:</b>
            <ul><li>a unit up to the lesson the class is on, e.g. <b>NP17 lesson 3</b></li><li><b>Sparx codes</b>, e.g. U449, U638</li><li>a mock paper, e.g. <b>Mock Paper 3</b></li><li>the topics in a file you attach</li></ul>
            Nothing after the lesson you name is taught. Year {year} units: {yearUnits(list, year).map((u) => u.code).join(", ") || "none listed"}.
          </InfoTip>
        </div>
        <div className="cover-suggestions" role="group" aria-label="Suggestions to begin with">
          {coverSuggestions.map((s) => (
            <button key={s.label} type="button" onClick={() => { edit(() => setText(s.text)); box.current?.focus(); }}>{s.label}</button>
          ))}
        </div>
        <textarea id="cover-text" ref={box} value={text} maxLength={COVER_TEXT_MAX} rows={3} placeholder="e.g. NP17 lesson 3 · Sparx U449, U638 · Mock Paper 3 revision" onChange={(e) => edit(() => setText(e.target.value))} />
        {text.trim() && <p className="cover-plan" aria-live="polite">{sentence}</p>}
        {pickLesson && (
          <label className="cover-upto">Up to and including
            <select value={upTo ?? plan.upTo ?? ""} onChange={(e) => edit(() => setUpTo(e.target.value || null))}>
              <option value="">Choose the lesson your class is on</option>
              <option value="none">{plan.unit?.code ?? "That code"} isn't a unit here: follow my description</option>
              {(plan.unit?.lessons ?? []).map((l) => <option key={l.code} value={l.code}>{l.code} {l.title}</option>)}
            </select>
          </label>
        )}
        <div className="cover-attach">
          <label className="cover-file"><Paperclip size={16} aria-hidden="true" />{attached ? `Attached: ${attached.name}` : "Attach a resource (optional)"}
            <input type="file" accept=".pptx,.docx,.pdf" onChange={(e) => { void attach(e.target.files?.[0]); e.target.value = ""; }} />
          </label>
          {attached && <button type="button" className="cover-link" onClick={() => edit(() => setAttached(null))}>Remove</button>}
          <InfoTip label="About attaching a file">PowerPoint, Word or PDF. Only the words in the file are read and sent, not its pictures. Don't attach anything with pupils' names or marks.</InfoTip>
        </div>
        <p className="cover-fixed">One cover lesson · 8 sides · pupil and answers PDFs
          <InfoTip label="What the booklet looks like">Marked <b>Cover lesson</b>, with the class, room and date on its first side. It opens with a Silent starter (questions 1 to 8), then worked examples with questions straight after.</InfoTip>
        </p>
        <label className="cover-absent"><input type="checkbox" checked={absent} onChange={(e) => edit(() => setAbsent(e.target.checked))} />This is cover work for myself or a colleague.</label>
        <button type="button" className="cover-go" disabled={!!missing || busy} onClick={() => void build()}>{busy ? "Sending…" : "Check and build"}</button>
        {missing && !sent && (text || className || room) && <p className="library-status">{missing}</p>}
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
  const { today, coming, recent, older } = coverLibrary(log ?? [], covers, removed);
  const item = (e: CoverEntry) => <CoverItem key={e.key} entry={e} canDelete={canDelete} remove={remove} />;
  return (
    <div className="cover-log" aria-labelledby="cover-library-title">
      <h2 id="cover-library-title">Cover library</h2>
      {logError && <p className="library-status">{logError}</p>}
      {!log && !logError ? <p className="library-status">Loading…</p> : !today.length && !coming.length && !recent.length && !older.length ? <p className="library-status">No cover booklets yet.</p> : (
        <>
          {([["Today", today], ["Coming up", coming], ["Last 7 days", recent]] as const).map(([name, list]) => list.length > 0 && (
            <section key={name} className="cover-group" aria-label={name}><h3>{name}</h3><ul>{list.map(item)}</ul></section>
          ))}
          {older.length > 0 && (
            <details className="cover-older">
              <summary>Older cover ({older.length})</summary>
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
      <span className="cover-where-line"><b className="cover-for">Cover for {ukDay(e.date)}</b> · {e.className || e.room ? <>{e.className && <b>Class {e.className}</b>}{e.className && e.room && " · "}{e.room && `Room ${e.room}`}</> : "class and room not recorded"}</span>
      <span className="cover-asked">Year {e.year}{e.tier ? ` ${e.tier}` : ""}{e.who ? ` · asked by ${e.who === "You" ? "you" : e.who}${e.asked ? `, ${ukDay(localToday(new Date(e.asked)))}` : ""}` : ` · ${e.text}`} · <span className="cover-state">{stateWords[e.state]}</span></span>
      {e.who && e.text && <span className="cover-text">{e.text}</span>}
      {e.state === "building" && e.since && <BuildBar since={e.since} />}
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

/** A small (i) that shows a note on hover, keyboard focus or a tap, so the form stays short (Tim, 28 Nov). */
function InfoTip({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <span className={`cover-tip${open ? " is-open" : ""}`} onMouseLeave={() => setOpen(false)}>
      <button type="button" aria-label={label} aria-expanded={open} onClick={() => setOpen(!open)} onKeyDown={(e) => { if (e.key === "Escape") setOpen(false); }}><Info size={15} aria-hidden="true" /></button>
      <span className="cover-tip-box" role="tooltip">{children}</span>
    </span>
  );
}

/** The build bar: fills to 90% over 16 minutes from when the build started, then waits; the entry turns Ready when it is done. */
function BuildBar({ since }: { since: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = window.setInterval(() => setNow(Date.now()), 15000); return () => window.clearInterval(t); }, []);
  const p = buildProgress(since, now);
  return (
    <span className="cover-bar-wrap">
      <span className="cover-bar" role="progressbar" aria-label="Building" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(p.fraction * 100)}><span style={{ width: `${p.fraction * 100}%` }} /></span>
      <span className="cover-bar-words">{p.words}</span>
    </span>
  );
}
