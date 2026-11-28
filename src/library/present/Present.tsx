/**
 * Present a booklet from the Resource library (docs/tools/PRESENT-BOOKLETS.md, Tim's option A, 28 Nov 2026):
 * the delivered PDF sides in one scrolling column on a light surround that is writable too, with the Question
 * Bank's pen rail, zoom, coloured overlays and Display. Pupil | Answers swaps the page underneath: the answers copy
 * has the pupil copy's layout, so the ink on a side stays put. Ink is screen-only and never reaches a download.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { ArrowLeft, ArrowRight, ChevronLeft, Download, LoaderCircle, Maximize2, Minus, Pencil, Plus, RotateCcw, X } from "lucide-react";
import { loadPdfUrl, renderPdfPage } from "../../bank/pdf";
import { AnnotationBar } from "../../bank/AnnotationBar";
import { AnnotationLayer, type AnnotationSettings } from "../../bank/AnnotationLayer";
import { annotationReducer, hasInk, type AnnotationAction, type AnnotationState, HIGHLIGHTER_COLOURS, layerOf, PEN_COLOURS, readAnnotationPreferences, saveAnnotationPreferences, SIZES, toolCursor, withTool, type AnnotationPreferences, type AnnotationTool, type Stroke } from "../../bank/annotations";
import { overlayPreference, overlays, type Overlay } from "../../bank/overlays";
import type { Library, Resource } from "../model";
import { className, lastBuildFor, loadClass, recentClasses, rememberClass, saveClass, type Stopped } from "./presentStore";
import { hasNotes, sideNotes, type SideNotes } from "./teacherNotes";
import { buildLabel, buildUrl, findBuild, fitScale, stepZoom, type PresentBuild, type ZoomFit } from "./presentModel";
import "./present.css";

type Size = { width: number; height: number };
type InkAction = AnnotationAction | { type: "replace"; state: AnnotationState };
/** The Question Bank's ink history, plus loading a class's saved ink in one go. */
const inkReducer = (state: AnnotationState, action: InkAction) => (action.type === "replace" ? action.state : annotationReducer(state, action));
/** Sends one comment on this booklet to the library feedback queue; `off` says why feedback is unavailable. */
export type PresentFeedback = { off?: string; send: (resource: Resource, text: string) => Promise<string> };
type Props = { list: Library; id: string; at?: string; onClose: () => void; onPick: (id: string, at?: string) => void; feedback?: PresentFeedback };
/** A comment pinned to a spot on a side (PDF points from the top left). Quick notes come from N during a lesson. */
type Pin = { id: number; side: number; x: number; y: number; text: string; quick: boolean };

/** Both copies of one build, opened together so switching is instant. */
function useBuildDocs(build?: PresentBuild, retry = 0) {
  const [docs, setDocs] = useState<{ key: string; pupil?: PDFDocumentProxy; answers?: PDFDocumentProxy; sizes: Size[]; error?: string }>({ key: "", sizes: [] });
  useEffect(() => {
    if (!build) return;
    let live = true;
    setDocs({ key: build.key, sizes: [] });
    (async () => {
      const pupil = await loadPdfUrl(buildUrl(build.pupil), retry > 0);
      const sizes: Size[] = [];
      for (let n = 1; n <= pupil.numPages; n++) { const v = (await pupil.getPage(n)).getViewport({ scale: 1 }); sizes.push({ width: v.width, height: v.height }); }
      const answers = build.answers ? await loadPdfUrl(buildUrl(build.answers), retry > 0).catch(() => undefined) : undefined;
      if (live) setDocs({ key: build.key, pupil, answers, sizes });
    })().catch(() => { if (live) setDocs({ key: build.key, sizes: [], error: "This booklet could not load. Check your connection and try again." }); });
    return () => { live = false; };
  }, [build, retry]);
  return docs;
}

export default function Present({ list, id, at, onClose, onPick, feedback }: Props) {
  const { builds, build } = useMemo(() => findBuild(list, id, at), [list, id, at]);
  const [retry, setRetry] = useState(0);
  const docs = useBuildDocs(build, retry);
  const [answers, setAnswers] = useState(false);
  const [fit, setFit] = useState<ZoomFit>("width");
  const [zoom, setZoom] = useState(1);
  const [overlay, setOverlay] = useState<Overlay>(overlayPreference);
  useEffect(() => { try { localStorage.setItem("qb-overlay", overlay); } catch { /* Optional device preference, shared with the Question Bank. */ } }, [overlay]);
  const [display, setDisplay] = useState(false);
  const [annotating, setAnnotating] = useState(false);
  const [prefs, setPrefs] = useState<AnnotationPreferences>(readAnnotationPreferences);
  useEffect(() => saveAnnotationPreferences(prefs), [prefs]);
  const [ink, dispatchInk] = useReducer(inkReducer, {});
  const [side, setSide] = useState(1);
  // The class being taught: its ink and place are saved for each exact build. No class means nothing is saved.
  const [cls, setCls] = useState<string>();
  const [recent, setRecent] = useState(recentClasses);
  const [classOpen, setClassOpen] = useState(true);
  const [stopped, setStopped] = useState<Stopped>();
  const [resume, setResume] = useState<Stopped>();
  const [saveError, setSaveError] = useState(false);
  const [typed, setTyped] = useState("");
  // Teacher notes from the answers copy, shown on the pupil copy on screen only (T hides them).
  const [notesOn, setNotesOn] = useState(true);
  const [notes, setNotes] = useState<Record<number, SideNotes>>({});
  // Feedback: comments pinned to a spot on a side, sent together; never shown or offered in Display except N's flag.
  const [pins, setPins] = useState<Pin[]>([]);
  const [pinMode, setPinMode] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [sentMessage, setSentMessage] = useState("");
  const [askSend, setAskSend] = useState(false);
  const lastPoint = useRef<{ side: number; x: number; y: number } | null>(null);
  const pinCount = useRef(0);
  const root = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const [stageSize, setStageSize] = useState<Size>({ width: 1200, height: 800 });

  const ready = docs.key === build?.key && !!docs.pupil;
  const showAnswers = answers && !!docs.answers;
  const pdf = showAnswers ? docs.answers : docs.pupil;
  const sizes = useMemo(() => (ready ? docs.sizes : []), [ready, docs.sizes]);
  useEffect(() => {
    setNotes({});
    const answers = docs.answers;
    if (!answers || docs.key !== build?.key) return;
    let live = true;
    (async () => { for (let n = 1; n <= answers.numPages && live; n++) { const found = await sideNotes(answers, n).catch(() => undefined); if (live && found) setNotes((old) => ({ ...old, [n]: found })); } })();
    return () => { live = false; };
  }, [docs.answers, docs.key, build?.key]);
  const mismatch = ready && !!docs.answers && docs.answers.numPages !== docs.pupil!.numPages;
  const scale = sizes.length ? fitScale(fit, sizes[0], stageSize) * zoom : 1;
  const inkKey = (n: number) => `${build?.key}|${n}`;

  useLayoutEffect(() => {
    const el = stage.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setStageSize({ width: el.clientWidth, height: el.clientHeight }));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // The side under the middle of the stage is the current side.
  const onScroll = useCallback(() => {
    const el = stage.current;
    if (!el) return;
    const middle = el.getBoundingClientRect().top + el.clientHeight / 2;
    let best = 1, distance = Infinity;
    el.querySelectorAll<HTMLElement>("[data-side]").forEach((page) => {
      const r = page.getBoundingClientRect();
      const d = middle < r.top ? r.top - middle : middle > r.bottom ? middle - r.bottom : 0;
      if (d < distance) { distance = d; best = Number(page.dataset.side); }
    });
    setSide(best);
  }, []);
  // A side asked for before the booklet has opened is shown as soon as it has.
  const pendingSide = useRef<number | null>(null);
  const goTo = useCallback((n: number) => {
    const page = stage.current?.querySelector<HTMLElement>(`[data-side="${n}"]`);
    if (!page || !stage.current) { pendingSide.current = n; return; }
    pendingSide.current = null;
    stage.current.scrollTo({ top: page.offsetTop - 16, behavior: "auto" });
    setSide(n);
  }, []);
  // A zoom keeps the same place in the booklet in view.
  const place = useRef<number | null>(null);
  const rememberPlace = () => { const el = stage.current; if (el && el.scrollHeight) place.current = (el.scrollTop + el.clientHeight / 2) / el.scrollHeight; };
  useLayoutEffect(() => {
    const el = stage.current;
    if (!el || place.current === null) return;
    el.scrollTop = place.current * el.scrollHeight - el.clientHeight / 2;
    place.current = null;
  }, [scale]);
  // Going in or out of Display resizes the stage: the current side comes back to the top once the new size settles.
  const sideRef = useRef(side); sideRef.current = side;
  const settle = useRef(0);
  useLayoutEffect(() => { settle.current = performance.now() + 400; }, [display]);
  useLayoutEffect(() => { if (pendingSide.current) goTo(pendingSide.current); else if (performance.now() < settle.current) goTo(sideRef.current); }, [display, scale, ready, goTo]);
  const changeZoom = useCallback((next: number | ((z: number) => number)) => { rememberPlace(); setZoom(next); }, []);
  const changeFit = (next: ZoomFit) => { rememberPlace(); setFit(next); setZoom(1); };

  // Ink: undo and redo walk back through the sides in the order they were drawn on.
  const undoKeys = useRef<string[]>([]), redoKeys = useRef<string[]>([]);
  const inkRef = useRef(ink); inkRef.current = ink;
  const commit = useCallback((key: string, strokes: Stroke[]) => { undoKeys.current.push(key); redoKeys.current = []; dispatchInk({ type: "set", key, strokes }); }, []);

  // Choosing a class (or another build) loads that class's ink and place; its last place is offered, never forced.
  const loaded = useRef("");
  useEffect(() => {
    const key = build?.key;
    if (!key) return;
    const record = cls ? loadClass(cls, key) : undefined;
    const state: AnnotationState = {};
    for (const [n, strokes] of Object.entries(record?.sides ?? {})) state[`${key}|${n}`] = { strokes, past: [], future: [] };
    undoKeys.current = []; redoKeys.current = [];
    dispatchInk({ type: "replace", state });
    setStopped(record?.stopped); setResume(record?.stopped); setSaveError(false);
    loaded.current = cls ? `${cls}|${key}` : "";
  }, [cls, build?.key]);
  // The place moves with the teacher unless they set the flag by hand.
  useEffect(() => { if (cls && ready) setStopped((old) => (old?.flag ? old : { side, at: new Date().toISOString(), flag: false })); }, [cls, side, ready]);
  useEffect(() => {
    const key = build?.key;
    if (!cls || !key || loaded.current !== `${cls}|${key}`) return;
    const timer = window.setTimeout(() => {
      const sides: Record<string, Stroke[]> = {};
      for (const [k, layer] of Object.entries(ink)) if (k.startsWith(`${key}|`)) sides[k.slice(key.length + 1)] = layer.strokes;
      setSaveError(!saveClass(cls, key, sides, stopped));
    }, 400);
    return () => window.clearTimeout(timer);
  }, [ink, stopped, cls, build?.key]);
  const chooseClass = (text: string) => { const name = className(text); if (!name) return; setRecent(rememberClass(name)); setCls(name); setTyped(""); };
  const newerBuild = useMemo(() => { if (!cls || !build) return undefined; const k = lastBuildFor(cls, builds.map((b) => b.key)); return k && k !== build.key ? builds.find((b) => b.key === k) : undefined; }, [cls, build, builds]);
  const undoInk = useCallback(() => { const key = undoKeys.current.pop(); if (key && layerOf(inkRef.current, key).past.length) { redoKeys.current.push(key); dispatchInk({ type: "undo", key }); } }, []);
  const redoInk = useCallback(() => { const key = redoKeys.current.pop(); if (key && layerOf(inkRef.current, key).future.length) { undoKeys.current.push(key); dispatchInk({ type: "redo", key }); } }, []);
  const clearSide = () => { const key = inkKey(side); if (layerOf(ink, key).strokes.length) commit(key, []); };
  const clearAll = () => { for (let n = 1; n <= sizes.length; n++) { const key = inkKey(n); if (layerOf(ink, key).strokes.length) commit(key, []); } };
  const buildInk = useMemo(() => Object.fromEntries(Object.entries(ink).filter(([k]) => k.startsWith(`${build?.key}|`))), [ink, build?.key]);

  const penSize = SIZES.find((s) => s.value === prefs.penSize)!.pen, highlighterSize = SIZES.find((s) => s.value === prefs.highlighterSize)!.highlighter;
  const settings = useMemo<AnnotationSettings>(() => ({ tool: prefs.tool, penColour: prefs.penColour, highlighterColour: prefs.highlighterColour, penSize, highlighterSize, straight: prefs.straight }), [prefs, penSize, highlighterSize]);
  const now = useRef({ annotating, tool: prefs.tool }); now.current = { annotating, tool: prefs.tool };
  const chooseTool = useCallback((tool: AnnotationTool) => { now.current = { annotating: true, tool }; setPrefs((p) => withTool(p, tool)); setAnnotating(true); }, []);
  const drawing = annotating && prefs.tool !== "hand";

  const enterDisplay = () => { setDisplay(true); void root.current?.requestFullscreen?.().catch(() => undefined); (document.activeElement as HTMLElement | null)?.blur(); };
  const pinsRef = useRef(pins); pinsRef.current = pins;
  const leaveDisplay = useCallback(() => { setDisplay(false); if (pinsRef.current.some((p) => p.quick)) setAskSend(true); if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined); }, []);
  const addPin = useCallback((side: number, x: number, y: number, quick: boolean) => { const pin = { id: ++pinCount.current, side, x, y, text: "", quick }; setPins((old) => [...old, pin]); return pin; }, []);
  const sendPins = async () => {
    if (!feedback || !build || !pins.length) return;
    setSending(true); setSentMessage("");
    const lines = pins.map((p) => `Side ${p.side} (${Math.round((p.x / (sizes[p.side - 1]?.width || 1)) * 100)}% across, ${Math.round((p.y / (sizes[p.side - 1]?.height || 1)) * 100)}% down): ${p.text.trim() || "flagged during a lesson, no words added"}`);
    try {
      const warning = await feedback.send(build.resource, [`From Present (${buildLabel(build)}${showAnswers ? ", answers copy" : ""}):`, ...lines].join("\n"));
      setPins([]); setAskSend(false); setSentMessage(warning || `Sent ${lines.length} comment${lines.length === 1 ? "" : "s"} to the library feedback.`);
    } catch (e) { setSentMessage((e as Error).message); }
    setSending(false);
  };
  useEffect(() => { const off = () => { if (!document.fullscreenElement) setDisplay(false); }; document.addEventListener("fullscreenchange", off); return () => document.removeEventListener("fullscreenchange", off); }, []);

  // Keys, as in the Question Bank: arrows or Page Up/Down step sides, + − 0 zoom, P pen, A answers, Escape puts
  // the pen down first and then leaves Display.
  useEffect(() => {
    function key(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (target.closest("input, select, textarea, [contenteditable='true']")) return;
      const k = e.key.toLowerCase();
      if (e.key === "Escape") { if (now.current.annotating) { setAnnotating(false); return; } if (display) leaveDisplay(); return; }
      if (now.current.annotating && (e.ctrlKey || e.metaKey) && !e.altKey && (k === "z" || k === "y")) { e.preventDefault(); if (k === "y" || e.shiftKey) redoInk(); else undoInk(); return; }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (target.closest(".qb-annotate-bar") && e.key.startsWith("Arrow")) return;
      if (e.key === "ArrowRight" || e.key === "PageDown" || (e.key === "ArrowDown" && !e.shiftKey && !target.closest("button"))) { e.preventDefault(); goTo(Math.min(sizes.length, side + 1)); return; }
      if (e.key === "ArrowLeft" || e.key === "PageUp" || (e.key === "ArrowUp" && !e.shiftKey && !target.closest("button"))) { e.preventDefault(); goTo(Math.max(1, side - 1)); return; }
      if (e.key === "+" || e.key === "=") { e.preventDefault(); changeZoom((z) => stepZoom(z, 1)); return; }
      if (e.key === "-" || e.key === "_") { e.preventDefault(); changeZoom((z) => stepZoom(z, -1)); return; }
      if (e.key === "0") { e.preventDefault(); changeZoom(1); return; }
      if (k === "n") { e.preventDefault(); const at = lastPoint.current?.side === side ? lastPoint.current : { side, x: (sizes[side - 1]?.width ?? 595) - 40, y: 60 }; addPin(at.side, at.x, at.y, true); return; }
      if (k === "t" && !now.current.annotating) { e.preventDefault(); setNotesOn((v) => !v); return; }
      if (k === "a" && docs.answers) { e.preventDefault(); setAnswers((v) => !v); return; }
      if (k === "p") { e.preventDefault(); if (now.current.annotating && now.current.tool === "pen") setAnnotating(false); else chooseTool("pen"); return; }
      if (now.current.annotating) {
        const tool = ({ h: "highlighter", e: "eraser", l: "laser", v: "hand" } as Record<string, AnnotationTool>)[k];
        if (tool) { e.preventDefault(); chooseTool(tool); return; }
        const n = Number(e.key);
        const colours = now.current.tool === "highlighter" ? HIGHLIGHTER_COLOURS : PEN_COLOURS;
        if (n >= 1 && colours[n - 1]) { e.preventDefault(); const c = colours[n - 1]; setPrefs((p) => (p.tool === "highlighter" ? { ...p, highlighterColour: c.value } : { ...withTool(p, "pen"), penColour: c.value })); }
      }
    }
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [display, leaveDisplay, undoInk, redoInk, goTo, side, sizes, changeZoom, chooseTool, docs.answers, addPin]);

  // Ctrl + wheel or a trackpad pinch zooms; an ordinary wheel scrolls the booklet.
  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const wheel = (e: WheelEvent) => { if (!e.ctrlKey && !e.metaKey) return; e.preventDefault(); changeZoom((z) => Math.min(4, Math.max(0.5, z * Math.exp(-e.deltaY / 300)))); };
    el.addEventListener("wheel", wheel, { passive: false });
    return () => el.removeEventListener("wheel", wheel);
  }, [changeZoom]);

  if (!build) return <div className="present present-missing" role="alert"><p>This booklet is no longer in the library.</p><button type="button" className="qb-button" onClick={onClose}><ChevronLeft size={16} aria-hidden="true" />Back to the library</button></div>;
  const title = build.resource.lesson ? `${build.resource.lesson} ${build.resource.title}` : build.resource.title;
  const file = showAnswers ? build.answers! : build.pupil;
  const tint = overlay === "off" ? undefined : overlays.find((o) => o.value === overlay)?.colour;
  const cursor = annotating ? toolCursor(prefs.tool, prefs.tool === "highlighter" ? prefs.highlighterColour : prefs.penColour, prefs.tool === "highlighter" ? highlighterSize : penSize, scale) : undefined;
  const sideHasInk = layerOf(ink, inkKey(side)).strokes.length > 0;
  const annotateButton = <button type="button" className="qb-button qb-annotate-toggle" aria-pressed={annotating} title="Annotate on screen · P" onClick={() => (annotating ? setAnnotating(false) : chooseTool(prefs.tool === "hand" ? "pen" : prefs.tool))}><Pencil size={16} aria-hidden="true" />Annotate</button>;
  const copySwitch = <div className="qb-segment present-copy" role="group" aria-label="Copy">
    <button type="button" className="qb-button" aria-pressed={!showAnswers} onClick={() => setAnswers(false)}>Pupil</button>
    <button type="button" className="qb-button" aria-pressed={showAnswers} disabled={!build.answers} title={build.answers ? "Answers · A" : "This booklet has no answers copy"} onClick={() => setAnswers(true)}>Answers</button>
  </div>;

  return (
    <div ref={root} className={`present${display ? " is-display" : ""}`} role="region" aria-label={`Present ${title}`}>
      {!display && <header className="present-top">
        <button type="button" className="qb-button" onClick={onClose}><ChevronLeft size={16} aria-hidden="true" />Library</button>
        <h1 className="present-title">{title}</h1>
        <button type="button" className="present-class-pill" aria-expanded={classOpen} onClick={() => setClassOpen(true)}>{cls ? `Teaching ${cls}` : "Choose a class"}</button>
        <label className="present-version">Version <select value={build.key} onChange={(e) => { const b = builds.find((x) => x.key === e.target.value); if (b) onPick(b.resource.id, b.current ? undefined : b.updated); }}>
          {builds.map((b) => <option key={b.key} value={b.key}>{buildLabel(b)}</option>)}
        </select></label>
        {copySwitch}
        <a className="qb-button" href={buildUrl(file)} target="_blank" rel="noreferrer"><Download size={16} aria-hidden="true" />{showAnswers ? "Answers PDF" : "Pupil PDF"}</a>
        <button type="button" className="qb-button qb-primary" disabled={!ready} onClick={enterDisplay}><Maximize2 size={16} aria-hidden="true" />Display</button>
      </header>}
      <div className="present-body">
        <div className="qb-stage-frame present-frame">
          <div ref={stage} className={`qb-stage present-stage${drawing ? " is-drawing" : ""}`} style={{ cursor }} onScroll={onScroll} tabIndex={-1} aria-label="Booklet sides">
            {docs.error ? <div className="qb-view-error" role="alert"><p>{docs.error}</p><button type="button" className="qb-button" onClick={() => setRetry((n) => n + 1)}><RotateCcw size={16} aria-hidden="true" />Try again</button><a className="qb-button" href={buildUrl(build.pupil)} target="_blank" rel="noreferrer">Open PDF</a></div>
              : !ready ? <p className="qb-view-status" role="status"><LoaderCircle className="spin" size={18} aria-hidden="true" /> Opening the booklet…</p>
              : sizes.map((size, i) => <Side key={i + 1} pdf={pdf!} n={i + 1} size={size} scale={scale} tint={tint} label={`Side ${i + 1}${showAnswers ? " (answers)" : ""}`} notes={notes[i + 1]} notesFrom={!showAnswers && notesOn && !mismatch ? docs.answers : undefined}
                  strokes={layerOf(ink, inkKey(i + 1)).strokes} active={annotating} settings={settings} onCommit={(s) => commit(inkKey(i + 1), s)}
                  pins={pins.filter((p) => p.side === i + 1)} pinMode={pinMode && !annotating} onPin={(x, y) => { addPin(i + 1, x, y, false); setPinMode(false); setFeedbackOpen(true); }} onPoint={(x, y) => { lastPoint.current = { side: i + 1, x, y }; }} />)}
          </div>
          {annotating && <AnnotationBar preferences={prefs} onChange={setPrefs} canUndo={undoKeys.current.length > 0} canRedo={redoKeys.current.length > 0} hasInk={sideHasInk} anyInk={hasInk(buildInk)} onUndo={undoInk} onRedo={redoInk} onClear={clearSide} onClearAll={clearAll} onClose={() => setAnnotating(false)} />}
          {display && <div className="qb-display-dock present-dock">
            <span className="present-side-count">Side {side} of {sizes.length}</span>
            {build.answers && copySwitch}
            {annotateButton}
            <button type="button" className="qb-button" onClick={leaveDisplay}><X size={16} aria-hidden="true" />Exit Display <kbd>Esc</kbd></button>
          </div>}
        </div>
        {!display && askSend && pins.some((p) => p.quick) && <div className="present-ask-send" role="status">
          <span>Send {pins.length} note{pins.length === 1 ? "" : "s"} as feedback?</span>
          <button type="button" className="qb-button qb-primary" disabled={sending || !!feedback?.off || !feedback} onClick={() => void sendPins()}>Send</button>
          <button type="button" className="qb-button" onClick={() => { setAskSend(false); setFeedbackOpen(true); }}>Not now</button>
        </div>}
        {!display && <aside className="present-column" aria-label="Present settings">
          <details className="present-card present-class" open={classOpen} onToggle={(e) => setClassOpen(e.currentTarget.open)}>
            <summary>{cls ? <>Class {cls}{stopped && <span className="present-summary-note"> · {stopped.flag ? "stopped at" : "on"} side {stopped.side}</span>}</> : "Class"}</summary>
            {!cls ? <>
              <p className="present-hint">Teaching which class? Your ink and where you got to are saved for each class.</p>
              {recent.length > 0 && <div className="present-recent" role="group" aria-label="Recent classes">{recent.map((c) => <button key={c.name} type="button" className="qb-button" onClick={() => chooseClass(c.name)}>{c.name}</button>)}</div>}
              <form className="present-class-form" onSubmit={(e) => { e.preventDefault(); chooseClass(typed); }}>
                <label><span className="sr-only">Class</span><input value={typed} maxLength={12} placeholder="For example 9X" onChange={(e) => setTyped(e.target.value)} /></label>
                <button type="submit" className="qb-button" disabled={!className(typed)}>Teach</button>
              </form>
              <p className="present-hint">Without a class, ink is kept until you leave.</p>
            </> : <>
              {resume && resume.side > 1 && <div className="present-resume">
                <b>Last time {new Date(resume.at).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}</b>
                <span>{resume.flag ? "You stopped" : "You were"} at side {resume.side}</span>
                <button type="button" className="qb-button qb-primary" onClick={() => { goTo(resume.side); setResume(undefined); }}>Go to where we stopped</button>
              </div>}
              {newerBuild && <p className="present-warning">{cls} has ink on the {buildLabel(newerBuild)} build. <button type="button" className="library-link" onClick={() => onPick(newerBuild.resource.id, newerBuild.current ? undefined : newerBuild.updated)}>Open that build</button></p>}
              <button type="button" className="qb-button" aria-pressed={!!stopped?.flag && stopped.side === side} onClick={() => setStopped({ side, at: new Date().toISOString(), flag: true })}>⚑ We stopped here</button>
              <p className="present-hint">Ink is saved in this browser for {cls}, for this version only. Another class has its own.</p>
              {saveError && <p className="present-warning" role="alert">This browser would not save the ink. It stays until you leave.</p>}
              <button type="button" className="library-link" onClick={() => setCls(undefined)}>Change class</button>
            </>}
          </details>
          <details className="present-card" open>
            <summary>Sides</summary>
            <div className="present-sides">
              {sizes.map((_, i) => <button key={i} type="button" className="present-thumb" aria-current={side === i + 1 ? "true" : undefined} onClick={() => goTo(i + 1)} aria-label={`Side ${i + 1}${layerOf(ink, inkKey(i + 1)).strokes.length ? ", has ink" : ""}`}>
                {stopped?.flag && stopped.side === i + 1 && <span className="present-flag" aria-label="(where you stopped)" />}{i + 1}{layerOf(ink, inkKey(i + 1)).strokes.length > 0 && <span className="present-ink-dot" aria-hidden="true" />}
              </button>)}
            </div>
            <p className="present-hint">A dot marks a side with ink on it; the flag marks where you stopped.</p>
          </details>
          <details className="present-card present-notes" open>
            <summary>Teacher notes on this side</summary>
            {!docs.answers ? <p className="present-hint">This booklet has no answers copy, so it has no teacher notes.</p>
              : !hasNotes(notes[side]) ? <p className="present-hint">None on side {side}.</p>
              : <>
                {notes[side].links.map((l) => <a key={l.url + l.box.x + l.box.y} className="present-note-link" href={l.url} target="_blank" rel="noreferrer"><span>{l.label ?? `NCETM ${l.url.replace(/^https?:\/\/(www\.)?/, "")}`}</span> ↗</a>)}
                {notes[side].watch && <p className="present-note-watch"><b>Watch for</b> {notes[side].watch}</p>}
                {notes[side].ask && <p className="present-note-ask"><b>Ask</b> {notes[side].ask}</p>}
              </>}
            <label className="present-check"><input type="checkbox" checked={notesOn} onChange={(e) => setNotesOn(e.target.checked)} /> Show them on the pupil copy · T</label>
          </details>
          <details className="present-card present-feedback" open={feedbackOpen} onToggle={(e) => setFeedbackOpen(e.currentTarget.open)}>
            <summary>Feedback on this booklet{pins.length > 0 && <span className="present-summary-note"> · {pins.length} to send</span>}</summary>
            {feedback?.off ? <p className="present-hint">{feedback.off}</p> : <>
              <button type="button" className="qb-button" aria-pressed={pinMode} onClick={() => setPinMode((v) => !v)}>{pinMode ? "Tap a spot on a side…" : "Pin a comment"}</button>
              {pins.map((p, i) => <div key={p.id} className="present-pin-row">
                <button type="button" className="present-pin-number" title={`Go to side ${p.side}`} onClick={() => goTo(p.side)}>{i + 1}</button>
                <label><span className="present-pin-where">Side {p.side}{p.quick ? " · quick note" : ""}</span>
                  <textarea rows={2} value={p.text} placeholder="What should change here?" onChange={(e) => setPins((old) => old.map((x) => (x.id === p.id ? { ...x, text: e.target.value } : x)))} /></label>
                <button type="button" className="library-link" aria-label={`Remove comment ${i + 1}`} onClick={() => setPins((old) => old.filter((x) => x.id !== p.id))}>Remove</button>
              </div>)}
              {pins.length > 0 && <button type="button" className="qb-button qb-primary" disabled={sending || !feedback} onClick={() => void sendPins()}>{sending ? "Sending…" : `Send ${pins.length} comment${pins.length === 1 ? "" : "s"}`}</button>}
              <p className="present-hint">Comments go to the library feedback for this lesson. In a lesson, press N to drop a quick note on the side and carry on.</p>
            </>}
            {sentMessage && <p className="library-status" role="status">{sentMessage}</p>}
          </details>
          <details className="present-card" open>
            <summary>Pen</summary>
            <p className="present-hint">Press P or Annotate. Write anywhere, on a side or the grey around it. Draw and hold for a straight line or a shape; level and upright lines snap within 5°. A fist or the pen's other end rubs out.</p>
            <p className="present-hint">Ink never goes into a download. Pupil and Answers share it. With a class chosen it is saved for that class.</p>
          </details>
          <details className="present-card">
            <summary>Keys</summary>
            <p className="present-hint">← → or Page Up / Down: sides · A: answers · + − 0: zoom · Ctrl + wheel or pinch: zoom · P: pen · H E L V: highlighter, eraser, laser, move · 1–8: colour · Esc: put the pen down, then leave Display</p>
          </details>
          {mismatch && <p className="present-warning" role="status">The answers copy has a different number of sides, so ink may not line up when you switch.</p>}
        </aside>}
      </div>
      {!display && <footer className="present-foot">
        <button type="button" className="qb-button" disabled={side <= 1} onClick={() => goTo(side - 1)}><ArrowLeft size={16} aria-hidden="true" />Previous</button>
        <strong className="present-side-count">Side {side} of {sizes.length || "…"}</strong>
        <button type="button" className="qb-button" disabled={side >= sizes.length} onClick={() => goTo(side + 1)}>Next<ArrowRight size={16} aria-hidden="true" /></button>
        <span className="present-spacer" />
        <div className="present-overlays" role="group" aria-label="Coloured overlay">
          <span>Overlay</span>
          {overlays.map((o) => <button key={o.value} type="button" aria-pressed={overlay === o.value} style={{ backgroundColor: o.colour }} onClick={() => setOverlay(o.value)}>{o.label}</button>)}
        </div>
        <div className="present-zoom" role="group" aria-label="Zoom">
          <button type="button" className="qb-button" aria-label="Zoom out" onClick={() => changeZoom((z) => stepZoom(z, -1))}><Minus size={16} aria-hidden="true" /></button>
          <button type="button" className="qb-button present-zoom-level" title="Back to fit · 0" onClick={() => changeZoom(1)}>{Math.round(zoom * 100)}%</button>
          <button type="button" className="qb-button" aria-label="Zoom in" onClick={() => changeZoom((z) => stepZoom(z, 1))}><Plus size={16} aria-hidden="true" /></button>
          <button type="button" className="qb-button" aria-pressed={fit === "width" && zoom === 1} onClick={() => changeFit("width")}>Fit width</button>
          <button type="button" className="qb-button" aria-pressed={fit === "side" && zoom === 1} onClick={() => changeFit("side")}>Fit side</button>
        </div>
        {annotateButton}
      </footer>}
    </div>
  );
}

/** One side: drawn when it is near the view, kept stretched at the old size while a zoom redraws it sharp. */
function Side({ pdf, n, size, scale, tint, label, strokes, active, settings, onCommit, notes, notesFrom, pins, pinMode, onPin, onPoint }: { pdf: PDFDocumentProxy; n: number; size: Size; scale: number; tint?: string; label: string; strokes: Stroke[]; active: boolean; settings: AnnotationSettings; onCommit: (s: Stroke[]) => void; notes?: SideNotes; notesFrom?: PDFDocumentProxy; pins: Pin[]; pinMode: boolean; onPin: (x: number, y: number) => void; onPoint: (x: number, y: number) => void }) {
  const box = useRef<HTMLDivElement>(null), host = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(n <= 2);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const drawn = useRef<PDFDocumentProxy | null>(null);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) setNear(true); }, { root: el.closest(".present-stage"), rootMargin: "150% 0px" });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  useLayoutEffect(() => {
    const canvas = host.current?.querySelector("canvas");
    if (canvas && drawn.current === pdf) { canvas.style.width = `${size.width * scale}px`; canvas.style.height = `${size.height * scale}px`; }
  }, [pdf, size, scale]);
  useEffect(() => {
    if (!near) return;
    const controller = new AbortController();
    // A new copy (Pupil to Answers) removes the old picture at once, so an answer never lingers on the pupil copy.
    const keep = drawn.current === pdf;
    if (!keep) { host.current?.replaceChildren(); drawn.current = null; }
    setError(false);
    const draw = () => void renderPdfPage(pdf, n, scale * Math.min(window.devicePixelRatio || 1, 3), controller.signal).then((canvas) => {
      if (controller.signal.aborted || !host.current) return;
      canvas.style.width = `${size.width * scale}px`; canvas.style.height = `${size.height * scale}px`;
      canvas.setAttribute("role", "img"); canvas.setAttribute("aria-label", label);
      host.current.replaceChildren(canvas); drawn.current = pdf;
    }).catch(() => { if (!controller.signal.aborted) setError(true); });
    const timer = keep ? window.setTimeout(draw, 140) : undefined;
    if (!keep) draw();
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [near, pdf, n, scale, size, label, retry]);
  return (
    <div ref={box} className={`qb-pdf present-side${pinMode ? " is-pinning" : ""}`} data-side={n} style={{ width: size.width * scale, height: size.height * scale }}
      onPointerMove={(e) => { const r = e.currentTarget.getBoundingClientRect(); onPoint((e.clientX - r.left) / scale, (e.clientY - r.top) / scale); }}
      onClick={pinMode ? (e) => { const r = e.currentTarget.getBoundingClientRect(); onPin((e.clientX - r.left) / scale, (e.clientY - r.top) / scale); } : undefined}>
      <div className="qb-canvas-surface">
        <div ref={host} className="qb-canvas-host" />
        {near && notesFrom && hasNotes(notes) && <NotesCrop pdf={notesFrom} n={n} size={size} scale={scale} notes={notes!} />}
        {tint && <div className="qb-coloured-overlay" aria-hidden="true" style={{ backgroundColor: tint }} />}
        <AnnotationLayer strokes={strokes} width={size.width} height={size.height} scale={scale} active={active} settings={settings} onCommit={onCommit} />
        {pins.map((p) => <span key={p.id} className={`present-pin${p.quick ? " is-quick" : ""}`} style={{ left: p.x * scale, top: p.y * scale }} aria-label={`Comment on side ${n}`} />)}
        {!active && !pinMode && notes?.links.map((l) => <a key={l.url + l.box.x + l.box.y} className="present-link-spot" href={l.url} target="_blank" rel="noreferrer" title={l.url} aria-label="NCETM link" style={{ left: l.box.x * scale, top: l.box.y * scale, width: l.box.w * scale, height: l.box.h * scale }} />)}
      </div>
      {error && <div className="qb-view-error" role="alert"><p>Side {n} could not load.</p><button type="button" className="qb-button" onClick={() => setRetry((x) => x + 1)}><RotateCcw size={16} aria-hidden="true" />Retry</button></div>}
    </div>
  );
}

/**
 * The answers copy's teacher notes laid over the pupil side: the answers page drawn at the same size and clipped to
 * the NCETM chips and the misconception band, so they look exactly as printed and nothing else of the answers shows.
 */
function NotesCrop({ pdf, n, size, scale, notes }: { pdf: PDFDocumentProxy; n: number; size: Size; scale: number; notes: SideNotes }) {
  const host = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const controller = new AbortController();
    const ratio = Math.min(window.devicePixelRatio || 1, 3);
    const timer = window.setTimeout(() => void renderPdfPage(pdf, n, scale * ratio, controller.signal).then((source) => {
      const out = host.current;
      if (controller.signal.aborted || !out) return;
      out.width = source.width; out.height = source.height;
      const k = source.width / size.width;
      const context = out.getContext("2d");
      if (!context) return;
      const boxes = [...notes.links.map((l) => l.box), ...(notes.band ? [notes.band] : [])];
      for (const b of boxes) { const pad = 1; context.drawImage(source, (b.x - pad) * k, (b.y - pad) * k, (b.w + 2 * pad) * k, (b.h + 2 * pad) * k, (b.x - pad) * k, (b.y - pad) * k, (b.w + 2 * pad) * k, (b.h + 2 * pad) * k); }
    }).catch(() => undefined), 60);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [pdf, n, size, scale, notes]);
  return <canvas ref={host} className="present-notes-crop" aria-hidden="true" style={{ width: size.width * scale, height: size.height * scale }} />;
}
