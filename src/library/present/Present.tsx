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
import { annotationReducer, hasInk, HIGHLIGHTER_COLOURS, layerOf, PEN_COLOURS, readAnnotationPreferences, saveAnnotationPreferences, SIZES, toolCursor, withTool, type AnnotationPreferences, type AnnotationTool, type Stroke } from "../../bank/annotations";
import { overlayPreference, overlays, type Overlay } from "../../bank/overlays";
import type { Library } from "../model";
import { buildLabel, buildUrl, findBuild, fitScale, stepZoom, type PresentBuild, type ZoomFit } from "./presentModel";
import "./present.css";

type Size = { width: number; height: number };
type Props = { list: Library; id: string; at?: string; onClose: () => void; onPick: (id: string, at?: string) => void };

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

export default function Present({ list, id, at, onClose, onPick }: Props) {
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
  const [ink, dispatchInk] = useReducer(annotationReducer, {});
  const [side, setSide] = useState(1);
  const root = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const [stageSize, setStageSize] = useState<Size>({ width: 1200, height: 800 });

  const ready = docs.key === build?.key && !!docs.pupil;
  const showAnswers = answers && !!docs.answers;
  const pdf = showAnswers ? docs.answers : docs.pupil;
  const sizes = ready ? docs.sizes : [];
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
  const goTo = useCallback((n: number) => {
    const page = stage.current?.querySelector<HTMLElement>(`[data-side="${n}"]`);
    if (!page || !stage.current) return;
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
  useLayoutEffect(() => { if (performance.now() < settle.current) goTo(sideRef.current); }, [display, scale, goTo]);
  const changeZoom = useCallback((next: number | ((z: number) => number)) => { rememberPlace(); setZoom(next); }, []);
  const changeFit = (next: ZoomFit) => { rememberPlace(); setFit(next); setZoom(1); };

  // Ink: undo and redo walk back through the sides in the order they were drawn on.
  const undoKeys = useRef<string[]>([]), redoKeys = useRef<string[]>([]);
  const inkRef = useRef(ink); inkRef.current = ink;
  const commit = useCallback((key: string, strokes: Stroke[]) => { undoKeys.current.push(key); redoKeys.current = []; dispatchInk({ type: "set", key, strokes }); }, []);
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
  const leaveDisplay = useCallback(() => { setDisplay(false); if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined); }, []);
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
  }, [display, leaveDisplay, undoInk, redoInk, goTo, side, sizes.length, changeZoom, chooseTool, docs.answers]);

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
              : sizes.map((size, i) => <Side key={i + 1} pdf={pdf!} n={i + 1} size={size} scale={scale} tint={tint} label={`Side ${i + 1}${showAnswers ? " (answers)" : ""}`}
                  strokes={layerOf(ink, inkKey(i + 1)).strokes} active={annotating} settings={settings} onCommit={(s) => commit(inkKey(i + 1), s)} />)}
          </div>
          {annotating && <AnnotationBar preferences={prefs} onChange={setPrefs} canUndo={undoKeys.current.length > 0} canRedo={redoKeys.current.length > 0} hasInk={sideHasInk} anyInk={hasInk(buildInk)} onUndo={undoInk} onRedo={redoInk} onClear={clearSide} onClearAll={clearAll} onClose={() => setAnnotating(false)} />}
          {display && <div className="qb-display-dock present-dock">
            <span className="present-side-count">Side {side} of {sizes.length}</span>
            {build.answers && copySwitch}
            {annotateButton}
            <button type="button" className="qb-button" onClick={leaveDisplay}><X size={16} aria-hidden="true" />Exit Display <kbd>Esc</kbd></button>
          </div>}
        </div>
        {!display && <aside className="present-column" aria-label="Present settings">
          <details className="present-card" open>
            <summary>Sides</summary>
            <div className="present-sides">
              {sizes.map((_, i) => <button key={i} type="button" className="present-thumb" aria-current={side === i + 1 ? "true" : undefined} onClick={() => goTo(i + 1)} aria-label={`Side ${i + 1}${layerOf(ink, inkKey(i + 1)).strokes.length ? ", has ink" : ""}`}>
                {i + 1}{layerOf(ink, inkKey(i + 1)).strokes.length > 0 && <span className="present-ink-dot" aria-hidden="true" />}
              </button>)}
            </div>
            <p className="present-hint">A dot marks a side with ink on it.</p>
          </details>
          <details className="present-card" open>
            <summary>Pen</summary>
            <p className="present-hint">Press P or Annotate. Write anywhere, on a side or the grey around it. Draw and hold for a straight line or a shape; level and upright lines snap within 5°. A fist or the pen's other end rubs out.</p>
            <p className="present-hint">Ink is on this screen only. It never goes into a download, and Pupil and Answers share it.</p>
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
function Side({ pdf, n, size, scale, tint, label, strokes, active, settings, onCommit }: { pdf: PDFDocumentProxy; n: number; size: Size; scale: number; tint?: string; label: string; strokes: Stroke[]; active: boolean; settings: AnnotationSettings; onCommit: (s: Stroke[]) => void }) {
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
    <div ref={box} className="qb-pdf present-side" data-side={n} style={{ width: size.width * scale, height: size.height * scale }}>
      <div className="qb-canvas-surface">
        <div ref={host} className="qb-canvas-host" />
        {tint && <div className="qb-coloured-overlay" aria-hidden="true" style={{ backgroundColor: tint }} />}
        <AnnotationLayer strokes={strokes} width={size.width} height={size.height} scale={scale} active={active} settings={settings} onCommit={onCommit} />
      </div>
      {error && <div className="qb-view-error" role="alert"><p>Side {n} could not load.</p><button type="button" className="qb-button" onClick={() => setRetry((x) => x + 1)}><RotateCcw size={16} aria-hidden="true" />Retry</button></div>}
    </div>
  );
}
