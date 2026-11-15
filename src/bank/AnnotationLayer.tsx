import { memo, useEffect, useRef, useState } from "react";
import { addPoint, isStylusEraser, polylinePath, strokePath, touchesStroke, type AnnotationTool, type Stroke, type StrokeKind } from "./annotations";
import { highlighterLine, penOutline } from "./inkShape";
import { HOLD_MS, HOLD_PX, isRoughlyStraight, recogniseShape, snapLevel } from "./inkSnap";

export interface AnnotationSettings {
  tool: AnnotationTool;
  penColour: string;
  highlighterColour: string;
  penSize: number;
  highlighterSize: number;
  straight: boolean;
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
// Points closer than this on screen to the last kept one are skipped; the shaping smooths between them.
const CAPTURE_SPACING = 2;
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
// Each layer's way to abandon a finger's stroke, so a stylus landing on any page beats a palm on every page.
const touchDrops = new Set<() => void>();

type Draft =
  | { tool: "draw"; kind: StrokeKind; id: number; type: string; points: [number, number][]; start: [number, number]; ruled: boolean; predicted: [number, number][]; snapped?: "line" | "shape"; anchor: [number, number] }
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
    let settle = 0, hold = 0;
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
    // Abandons a stroke without committing it: no ink, no undo step.
    // A pinch keeps the finger's capture, so the stage zoom still follows it off the stage.
    const drop = (draft: Draft, release = true) => {
      if (draft.tool === "laser") setTrails(t => t.filter(trail => trail.id !== draft.id));
      clearTimeout(hold);
      if (release) try { el.releasePointerCapture(draft.id); } catch { /* Capture is optional. */ }
      set(undefined);
    };
    const dropTouch = () => { if (current?.type === "touch") drop(current); };
    touchDrops.add(dropTouch);
    const down = (event: PointerEvent) => {
      const { settings: s } = live.current;
      // A stylus beats a finger: a palm that landed first, on any page, loses its stroke and the stylus draws.
      if (event.pointerType === "pen") { device.stylus = true; for (const dropOne of touchDrops) dropOne(); }
      const stylusEraser = isStylusEraser(event);
      if (event.pointerType === "mouse" && event.button !== 0) return;
      if (device.space && event.pointerType === "mouse") return;
      const tool = stylusEraser ? "eraser" : s.tool;
      if (tool === "hand") return;
      if (event.pointerType === "touch") {
        // Palm rejection: once a stylus is in use, fingers pan and pinch.
        if (device.stylus) return;
        // A second finger means a pinch: drop the stroke and let the stage zoom.
        if (current) { if (current.type === "touch") drop(current, false); return; }
      }
      if (current) return;
      (event as ClaimedPointerEvent).qbClaimed = true;
      event.preventDefault();
      try { el.setPointerCapture(event.pointerId); } catch { /* Capture is optional. */ }
      const point = at(event);
      if (tool === "eraser") {
        const draft: Draft = { tool: "erase", id: event.pointerId, type: event.pointerType, radius: ERASER_RADIUS, erased: new Set() };
        set(draft); eraseAt(draft, point);
      } else if (tool === "laser") {
        set({ tool: "laser", id: event.pointerId, type: event.pointerType });
        setTrails(t => [...t, { id: event.pointerId, points: [[point[0], point[1], performance.now()]] }]);
      } else {
        set({ tool: "draw", kind: tool, id: event.pointerId, type: event.pointerType, points: [point], start: point, ruled: false, predicted: [], anchor: point });
        holdStill();
      }
    };
    // Draw and hold: when the pen stays still for HOLD_MS at the end of a freehand stroke, a rough shape snaps to a
    // circle, ellipse, triangle, quadrilateral, pentagon or hexagon, and a rough line snaps straight.
    const snap = () => {
      if (current?.tool !== "draw" || current.ruled) return;
      const scale = live.current.scale || 1, shape = recogniseShape(current.points, scale);
      if (shape) { set({ ...current, points: shape.points, ruled: true, predicted: [], snapped: "shape" }); return; }
      if (isRoughlyStraight(current.points, scale)) set({ ...current, points: [current.start, snapLevel(current.start, current.points[current.points.length - 1])], ruled: true, predicted: [], snapped: "line" });
    };
    const holdStill = () => { clearTimeout(hold); hold = window.setTimeout(snap, HOLD_MS); };
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
      const end = points[points.length - 1];
      // A snapped shape stays put until the pen lifts; a snapped or ruled line follows the pen, level when nearly level.
      if (current.snapped === "shape") return;
      if (current.snapped === "line" || live.current.settings.straight || event.shiftKey) { set({ ...current, points: [current.start, snapLevel(current.start, end)], ruled: true, predicted: [] }); return; }
      const scale = live.current.scale || 1;
      if (Math.hypot(end[0] - current.anchor[0], end[1] - current.anchor[1]) * scale > HOLD_PX) { current = { ...current, anchor: end }; holdStill(); }
      let next = current.points;
      for (const p of points) next = addPoint(next, p, CAPTURE_SPACING / Math.max(live.current.scale, 0.01));
      // The browser's guess at where the pen goes next is drawn on the end of the live stroke to hide lag, and is
      // replaced by each new reading, so it is never kept.
      const predicted = (event.getPredictedEvents?.() ?? []).slice(0, 2).map(at);
      if (next !== current.points || predicted.length || current.predicted.length || current.ruled) set({ ...current, points: next, ruled: false, predicted });
      // If the pen comes to rest, take the guess away rather than leave it overshooting until the pen lifts.
      clearTimeout(settle);
      if (predicted.length) settle = window.setTimeout(() => { if (current?.tool === "draw" && current.predicted.length) set({ ...current, predicted: [] }); }, 60);
    };
    const up = (event: PointerEvent) => {
      if (!current || event.pointerId !== current.id) return;
      const done = current; set(undefined);
      clearTimeout(hold);
      try { el.releasePointerCapture(event.pointerId); } catch { /* Capture is optional. */ }
      if (event.type === "pointercancel") return;
      const { strokes: existing, settings: s, onCommit: commit } = live.current;
      if (done.tool === "erase") { if (done.erased.size) commit(existing.filter(stroke => !done.erased.has(stroke.id))); return; }
      if (done.tool === "laser") return;
      const highlighter = done.kind === "highlighter";
      // The pen's last position is kept even when it was too close to the previous point to be captured.
      const last = at(event), points = done.ruled ? done.points : [...done.points];
      if (!done.ruled && points.length > 1) { const end = points[points.length - 1]; if (end[0] !== last[0] || end[1] !== last[1]) points.push(last); }
      commit([...existing, { id: `s${Date.now().toString(36)}-${strokeCount++}`, kind: done.kind, colour: highlighter ? s.highlighterColour : s.penColour, size: highlighter ? s.highlighterSize : s.penSize, scale: live.current.scale || 1, points, ...(done.ruled ? { ruled: true } : {}) }]);
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
    // A pen lifted over the toolbar, or anywhere capture did not reach, still ends its stroke.
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      clearTimeout(settle);
      clearTimeout(hold);
      touchDrops.delete(dropTouch);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
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
  const pending: Stroke | undefined = draft?.tool === "draw" ? { id: "pending", kind: draft.kind, colour: draft.kind === "highlighter" ? s.highlighterColour : s.penColour, size: draft.kind === "highlighter" ? s.highlighterSize : s.penSize, scale: scale || 1, points: draft.predicted.length ? [...draft.points, ...draft.predicted] : draft.points, ruled: draft.ruled } : undefined;
  const path = (stroke: Stroke, key: string) => <InkPath key={key} stroke={stroke}/>;
  return <svg ref={svg} className={`qb-annotations${active ? ` qb-annotating qb-tool-${s.tool}` : ""}`} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true" data-strokes={visible.length}>
    <g className="qb-ink-highlighter">{visible.filter(stroke => stroke.kind === "highlighter").map(stroke => path(stroke, stroke.id))}{pending?.kind === "highlighter" && path(pending, "pending")}</g>
    <g className="qb-ink-pen">{visible.filter(stroke => stroke.kind === "pen").map(stroke => path(stroke, stroke.id))}{pending?.kind === "pen" && path(pending, "pending")}</g>
    <g className="qb-ink-laser">{trails.map(trail => <path key={trail.id} d={strokePath(trail.points.map(p => [p[0], p[1]]))} stroke="#ff2a2a" strokeWidth={5 / Math.max(scale, 0.01)} fill="none" strokeLinecap="round" strokeLinejoin="round"/>)}</g>
  </svg>;
}

/**
 * One stroke of ink. Freehand pen ink is a filled, smoothed outline that is thicker when slow and tapers at the ends,
 * with a hairline edge so it looks crisp; the highlighter is a smoothed even line; ruled strokes go exactly through
 * their points. Finished strokes are memoised, so only the stroke being drawn is reshaped on each move.
 */
const InkPath = memo(function InkPath({ stroke }: { stroke: Stroke }) {
  if (stroke.ruled) return <path d={polylinePath(stroke.points)} stroke={stroke.colour} strokeWidth={stroke.size} fill="none" strokeLinecap="round" strokeLinejoin="round"/>;
  if (stroke.kind === "highlighter") return <path d={highlighterLine(stroke.points)} stroke={stroke.colour} strokeWidth={stroke.size} fill="none" strokeLinecap="round" strokeLinejoin="round"/>;
  return <path d={penOutline(stroke.points, stroke.size, stroke.scale)} fill={stroke.colour} stroke={stroke.colour} strokeWidth={0.5} vectorEffect="non-scaling-stroke" strokeLinejoin="round"/>;
});
