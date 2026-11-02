import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from "react";
import { Map as MapIcon, Minus, Plus, Scan, X } from "lucide-react";
import { MAX_ZOOM, MIN_ZOOM } from "./zoom";

interface ZoomProps {
  zoom: number;
  onStep: (direction: 1 | -1) => void;
  onFit: () => void;
  /** The footer adds the fit-mode choice; the floating Display bar leaves it out. */
  fitMode?: { value: "page" | "width"; onChange: (value: "page" | "width") => void };
  floating?: boolean;
}

/** Zoom buttons shared by the footer and the floating bar in Display mode. */
export function ZoomControls({ zoom, onStep, onFit, fitMode, floating }: ZoomProps) {
  const percent = `${Math.round(zoom * 100)}%`;
  return <div className={floating ? "qb-zoom qb-display-zoom" : "qb-zoom"} role="group" aria-label="Zoom">
    <button className="qb-button qb-icon" aria-label="Zoom out" title="Zoom out · minus key" disabled={zoom <= MIN_ZOOM + 0.001} onClick={() => onStep(-1)}><Minus size={16}/></button>
    <button className="qb-zoom-level" title="Fit to screen · 0 key" aria-label={`Zoom ${percent}. Fit to screen`} onClick={onFit}><output aria-live="polite">{percent}</output></button>
    <button className="qb-button qb-icon" aria-label="Zoom in" title="Zoom in · plus key" disabled={zoom >= MAX_ZOOM - 0.001} onClick={() => onStep(1)}><Plus size={16}/></button>
    {fitMode ? <>
      <select aria-label="Fit mode" value={fitMode.value} onChange={event => fitMode.onChange(event.target.value as "page" | "width")}><option value="page">Fit view</option><option value="width">Fit width</option></select>
      <button className="qb-text-button" onClick={onFit}>Reset</button>
    </> : <button className="qb-button" onClick={onFit} title="Fit to screen · 0 key"><Scan size={16}/> Fit</button>}
  </div>;
}

const OVERVIEW_SIZE = 168;
const overviewPreference = () => { try { return localStorage.getItem("qb-overview") !== "hidden"; } catch { return true; } };

/**
 * A small map of the whole stage while zoomed in, with a box for the part on screen. Click or drag to move.
 * It copies only the canvases already on the stage, so it never shows anything the viewer is not showing.
 */
export function ZoomOverview({ stage, active, redrawKey }: { stage: RefObject<HTMLDivElement | null>; active: boolean; redrawKey: string }) {
  const [open, setOpen] = useState(overviewPreference);
  const [needed, setNeeded] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const ratio = useRef(1);
  useEffect(() => { try { localStorage.setItem("qb-overview", open ? "shown" : "hidden"); } catch { /* Optional device preference. */ } }, [open]);

  const draw = useCallback((full: boolean) => {
    const el = stage.current, map = canvas.current, frame = box.current;
    if (!el) return;
    const overflowing = el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1;
    setNeeded(overflowing);
    if (!overflowing || !map || !frame) return;
    const r = Math.min(OVERVIEW_SIZE / el.scrollWidth, OVERVIEW_SIZE / el.scrollHeight);
    ratio.current = r;
    frame.style.left = `${el.scrollLeft * r}px`; frame.style.top = `${el.scrollTop * r}px`;
    frame.style.width = `${el.clientWidth * r}px`; frame.style.height = `${el.clientHeight * r}px`;
    if (!full) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.round(el.scrollWidth * r)), height = Math.max(1, Math.round(el.scrollHeight * r));
    map.style.width = `${width}px`; map.style.height = `${height}px`;
    map.width = Math.round(width * dpr); map.height = Math.round(height * dpr);
    const context = map.getContext("2d");
    if (!context) return;
    context.setTransform(dpr * r, 0, 0, dpr * r, 0, 0);
    context.fillStyle = "#e9eef4"; context.fillRect(0, 0, el.scrollWidth, el.scrollHeight);
    const origin = el.getBoundingClientRect();
    for (const page of el.querySelectorAll<HTMLCanvasElement>(".qb-canvas-host canvas")) {
      const rect = page.getBoundingClientRect();
      try { context.drawImage(page, rect.left - origin.left - el.clientLeft + el.scrollLeft, rect.top - origin.top - el.clientTop + el.scrollTop, rect.width, rect.height); } catch { /* A canvas still being drawn. */ }
    }
  }, [stage]);

  useEffect(() => {
    const el = stage.current;
    if (!el || !active) { setNeeded(false); return; }
    let frame = 0, full = true;
    const schedule = (redraw: boolean) => { full ||= redraw; if (!frame) frame = requestAnimationFrame(() => { frame = 0; draw(full); full = false; }); };
    const onScroll = () => schedule(false);
    const resize = new ResizeObserver(() => schedule(true));
    const mutation = new MutationObserver(() => schedule(true));
    resize.observe(el); mutation.observe(el, { childList: true, subtree: true, attributes: true, attributeFilter: ["style"] });
    el.addEventListener("scroll", onScroll, { passive: true });
    schedule(true);
    return () => { if (frame) cancelAnimationFrame(frame); resize.disconnect(); mutation.disconnect(); el.removeEventListener("scroll", onScroll); };
  }, [stage, active, draw, redrawKey, open, needed]);

  const moveTo = (event: ReactPointerEvent<HTMLDivElement>) => {
    const el = stage.current; if (!el) return;
    const rect = event.currentTarget.getBoundingClientRect(), r = ratio.current;
    el.scrollLeft = (event.clientX - rect.left) / r - el.clientWidth / 2;
    el.scrollTop = (event.clientY - rect.top) / r - el.clientHeight / 2;
  };

  if (!active || !needed) return null;
  if (!open) return <button className="qb-button qb-overview-toggle" onClick={() => setOpen(true)} aria-label="Show overview map" title="Show overview map"><MapIcon size={16}/></button>;
  return <div className="qb-overview" role="group" aria-label="Overview map">
    <button className="qb-overview-close" onClick={() => setOpen(false)} aria-label="Hide overview map" title="Hide overview map"><X size={14}/></button>
    <div className="qb-overview-map" aria-hidden="true"
      onPointerDown={event => { event.currentTarget.setPointerCapture(event.pointerId); moveTo(event); }}
      onPointerMove={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) moveTo(event); }}>
      <canvas ref={canvas}/>
      <div ref={box} className="qb-overview-box"/>
    </div>
  </div>;
}
