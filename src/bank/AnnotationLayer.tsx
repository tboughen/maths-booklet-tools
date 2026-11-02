import { useEffect, useRef, useState } from "react";
import { addPoint, isFistTouch, isStylusEraser, strokePath, touchesStroke, type AnnotationTool, type Stroke, type StrokeKind } from "./annotations";

export interface AnnotationSettings {
  tool: AnnotationTool;
  penColour: string;
  highlighterColour: string;
  penSize: number;
  highlighterSize: number;
  straight: boolean;
  fistEraser: boolean;
}

interface Props {
  strokes: Stroke[];
  width: number;
  height: number;
  scale: number;
  /** The annotation bar is open: the layer takes drawing input. Ink stays visible either way. */
  active: boolean;
  settings: AnnotationSettings;
  onCommit: (strokes: Stroke[]) => void;
}

/** Marks a pointerdown the layer has taken, so the stage's pan gesture leaves it alone. */
export type ClaimedPointerEvent = PointerEvent & { qbClaimed?: boolean };

const ERASER_RADIUS = 9;
const LASER_LIFE = 900;
// Controls that sit on the stage (zoom bar, overview map, error messages) keep their own clicks.
const MARGIN_IGNORE = "button,a,input,select,textarea,summary,label,[role=alert],.qb-view-error,.qb-overview,.qb-zoom";
// Shared across layers: a stylus has been used here (fingers then pan instead of drawing), and Space is held (pan).
const device = { stylus: false, space: false };
if (typeof window !== "undefined") {
  window.addEventListener("keydown", event => { if (event.code === "Space" && !(event.target as HTMLElement)?.closest?.("input,select,textarea,button,summary,[contenteditable=true]")) device.space = true; });
  window.addEventListener("keyup", event => { if (event.code === "Space") device.space = false; });
  window.addEventListener("blur", () => { device.space = false; });
}
let strokeCount = 0;

type Draft =
  | { tool: "draw"; kind: StrokeKind; id: number; type: string; points: [number, number][]; start: [number, number] }
  | { tool: "erase"; id: number; type: string; radius: number; erased: Set<string> }
  | { tool: "laser"; id: number; type: string };

export function AnnotationLayer({ strokes, width, height, scale, active, settings, onCommit }: Props) {
  const svg = useRef<SVGSVGElement>(null);
  const [draft, setDraft] = useState<Draft>();
  const [trails, setTrails] = useState<{ id: number; points: [number, number, number][] }[]>([]);
  const live = useRef({ strokes, scale, settings, onCommit, draft });
  live.current = { strokes, scale, settings, onCommit, draft };

  useEffect(() => {
    const el = svg.current;
    if (!el || !active) return;
    let current: Draft | undefined;
    const set = (next: Draft | undefined) => { current = next; setDraft(next ? { ...next } as Draft : undefined); };
    const at = (event: PointerEvent): [number, number] => {
      const rect = el.getBoundingClientRect(), s = live.current.scale || 1;
      return [(event.clientX - rect.left) / s, (event.clientY - rect.top) / s];
    };
    const eraseAt = (draft: Extract<Draft, { tool: "erase" }>, point: [number, number]) => {
      let changed = false;
      for (const stroke of live.current.strokes) if (!draft.erased.has(stroke.id) && touchesStroke(stroke, point, draft.radius)) { draft.erased.add(stroke.id); changed = true; }
      if (changed) set(draft);
    };
    const down = (event: PointerEvent) => {
      const { settings: s } = live.current;
      if (event.pointerType === "pen") device.stylus = true;
      const stylusEraser = isStylusEraser(event);
      const fist = s.fistEraser && isFistTouch(event);
      if (event.pointerType === "mouse" && event.button !== 0) return;
      if (device.space && event.pointerType === "mouse") return;
      const tool = stylusEraser || fist ? "eraser" : s.tool;
      if (tool === "hand") return;
      if (event.pointerType === "touch" && !fist) {
        // Palm rejection: once a stylus is in use, fingers pan and pinch.
        if (device.stylus) return;
        // A second finger means a pinch: drop the stroke and let the stage zoom.
        if (current) { if (current.type === "touch") { if (current.tool === "laser") setTrails(t => t.filter(trail => trail.id !== current!.id)); set(undefined); } return; }
      }
      if (current) return;
      (event as ClaimedPointerEvent).qbClaimed = true;
      event.preventDefault();
      try { el.setPointerCapture(event.pointerId); } catch { /* Capture is optional. */ }
      const point = at(event);
      if (tool === "eraser") {
        const radius = fist ? Math.max(event.width, event.height) / 2 / (live.current.scale || 1) : ERASER_RADIUS;
        const draft: Draft = { tool: "erase", id: event.pointerId, type: event.pointerType, radius, erased: new Set() };
        set(draft); eraseAt(draft, point);
      } else if (tool === "laser") {
        set({ tool: "laser", id: event.pointerId, type: event.pointerType });
        setTrails(t => [...t, { id: event.pointerId, points: [[point[0], point[1], performance.now()]] }]);
      } else {
        set({ tool: "draw", kind: tool, id: event.pointerId, type: event.pointerType, points: [point], start: point });
      }
    };
    const move = (event: PointerEvent) => {
      if (!current || event.pointerId !== current.id) return;
      const events = event.getCoalescedEvents?.() ?? [];
      const points = (events.length ? events : [event]).map(at);
      if (current.tool === "erase") { for (const p of points) eraseAt(current, p); return; }
      if (current.tool === "laser") {
        const now = performance.now(), id = current.id;
        setTrails(t => t.map(trail => trail.id === id ? { ...trail, points: [...trail.points, ...points.map(p => [p[0], p[1], now] as [number, number, number])] } : trail));
        return;
      }
      if (live.current.settings.straight || event.shiftKey) { set({ ...current, points: [current.start, points[points.length - 1]] }); return; }
      let next = current.points;
      for (const p of points) next = addPoint(next, p, 0.6 / Math.max(1, live.current.scale));
      if (next !== current.points) set({ ...current, points: next });
    };
    const up = (event: PointerEvent) => {
      if (!current || event.pointerId !== current.id) return;
      const done = current; set(undefined);
      try { el.releasePointerCapture(event.pointerId); } catch { /* Capture is optional. */ }
      if (event.type === "pointercancel") return;
      const { strokes: existing, settings: s, onCommit: commit } = live.current;
      if (done.tool === "erase") { if (done.erased.size) commit(existing.filter(stroke => !done.erased.has(stroke.id))); return; }
      if (done.tool === "laser") return;
      const highlighter = done.kind === "highlighter";
      commit([...existing, { id: `s${Date.now().toString(36)}-${strokeCount++}`, kind: done.kind, colour: highlighter ? s.highlighterColour : s.penColour, size: highlighter ? s.highlighterSize : s.penSize, points: done.points }]);
    };
    // The white space around the page is part of the board too: a pen-down there draws on the nearest page,
    // whose layer then takes the pointer, so the stroke can run on and off the page freely.
    const stage = el.closest<HTMLElement>(".qb-stage");
    const margin = (event: PointerEvent) => {
      const target = event.target as Element | null;
      if (!stage || !target || target.closest(".qb-annotations") || target.closest(MARGIN_IGNORE)) return;
      let nearest: Element | undefined, best = Infinity;
      for (const layer of stage.querySelectorAll(".qb-annotations.qb-annotating")) {
        const r = layer.getBoundingClientRect();
        const d = Math.hypot(Math.max(r.left - event.clientX, 0, event.clientX - r.right), Math.max(r.top - event.clientY, 0, event.clientY - r.bottom));
        if (d < best) { best = d; nearest = layer; }
      }
      if (nearest === el) down(event);
    };
    stage?.addEventListener("pointerdown", margin, true);
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    return () => {
      stage?.removeEventListener("pointerdown", margin, true);
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
      setDraft(undefined);
    };
  }, [active]);

  // The laser trail fades out behind the pointer.
  useEffect(() => {
    if (!trails.length) return;
    const frame = requestAnimationFrame(() => {
      const cutoff = performance.now() - LASER_LIFE;
      setTrails(t => t.map(trail => ({ ...trail, points: trail.points.filter(p => p[2] >= cutoff) })).filter(trail => trail.points.length || live.current.draft?.id === trail.id));
    });
    return () => cancelAnimationFrame(frame);
  }, [trails]);

  const erased = draft?.tool === "erase" ? draft.erased : undefined;
  const visible = erased?.size ? strokes.filter(stroke => !erased.has(stroke.id)) : strokes;
  if (!active && !visible.length && !trails.length) return null;
  const s = settings;
  const pending = draft?.tool === "draw" ? { kind: draft.kind, colour: draft.kind === "highlighter" ? s.highlighterColour : s.penColour, size: draft.kind === "highlighter" ? s.highlighterSize : s.penSize, points: draft.points } : undefined;
  const path = (stroke: { colour: string; size: number; points: [number, number][] }, key: string) => <path key={key} d={strokePath(stroke.points)} stroke={stroke.colour} strokeWidth={stroke.size} fill="none" strokeLinecap="round" strokeLinejoin="round"/>;
  return <svg ref={svg} className={`qb-annotations${active ? ` qb-annotating qb-tool-${s.tool}` : ""}`} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true" data-strokes={visible.length}>
    <g className="qb-ink-highlighter">{visible.filter(stroke => stroke.kind === "highlighter").map(stroke => path(stroke, stroke.id))}{pending?.kind === "highlighter" && path(pending, "pending")}</g>
    <g className="qb-ink-pen">{visible.filter(stroke => stroke.kind === "pen").map(stroke => path(stroke, stroke.id))}{pending?.kind === "pen" && path(pending, "pending")}</g>
    <g className="qb-ink-laser">{trails.map(trail => <path key={trail.id} d={strokePath(trail.points.map(p => [p[0], p[1]]))} stroke="#ff2a2a" strokeWidth={5 / Math.max(scale, 0.01)} fill="none" strokeLinecap="round" strokeLinejoin="round"/>)}</g>
  </svg>;
}
