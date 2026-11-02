import { useCallback, useEffect, useLayoutEffect, useRef, type RefObject } from "react";
import { anchoredScroll, clampZoom, swipeDirection, toggleDetailZoom, wheelFactor, type Point, type ScrollState } from "./zoom";

interface Options {
  stage: RefObject<HTMLDivElement | null>;
  zoom: number;
  scale: number;
  setZoom: (zoom: number) => void;
  onSwipe: (direction: 1 | -1) => void;
  /** Changes whenever the stage shows different content, so a pending scroll lands after that layout. */
  layoutKey: string;
  enabled: boolean;
}

type Pending = { kind: "anchor"; anchor: Point; anchorAfter: Point; scale: number; offset: Point; scroll: ScrollState } | { kind: "scroll"; scroll: ScrollState };

const interactive = "button,a,input,select,textarea,summary,label,[role=alert],.qb-view-error";

/** Where the scaled views start inside the stage's scrollable area. */
function contentOffset(stage: HTMLElement): Point {
  const group = stage.querySelector<HTMLElement>(".qb-view-group");
  if (!group) return { x: 0, y: 0 };
  const a = stage.getBoundingClientRect(), b = group.getBoundingClientRect();
  return { x: b.left - a.left + stage.scrollLeft, y: b.top - a.top + stage.scrollTop };
}
function stagePoint(stage: HTMLElement, clientX: number, clientY: number): Point {
  const rect = stage.getBoundingClientRect();
  return { x: clientX - rect.left - stage.clientLeft, y: clientY - rect.top - stage.clientTop };
}
const centre = (stage: HTMLElement): Point => ({ x: stage.clientWidth / 2, y: stage.clientHeight / 2 });

/**
 * Zoom and pan gestures for the question stage: Ctrl/Cmd + wheel and trackpad pinch, two-finger touch pinch,
 * drag to pan (mouse and one finger), double-click or double-tap, and swipe to change question at fit.
 * Every change is screen-only and anchored, so the point under the pointer or fingers stays put.
 */
export function useStageZoom({ stage, zoom, scale, setZoom, onSwipe, layoutKey, enabled }: Options) {
  const live = useRef({ zoom, scale, setZoom, onSwipe });
  live.current = { zoom, scale, setZoom, onSwipe };
  const pending = useRef<Pending | undefined>(undefined);

  /** Zooms to `next`, keeping the content under `anchor` fixed (or moving it to `anchorAfter`). */
  const requestZoom = useCallback((next: number, anchor?: Point, anchorAfter?: Point) => {
    const el = stage.current; const target = clampZoom(next);
    if (!el) { live.current.setZoom(target); return; }
    const at = anchor ?? centre(el);
    const before = { scale: live.current.scale, offset: contentOffset(el) };
    const scroll = { left: el.scrollLeft, top: el.scrollTop };
    if (Math.abs(target - live.current.zoom) < 1e-4) {
      // Nothing to re-lay out (for example at the zoom limit): only follow the fingers.
      const moved = anchoredScroll(scroll, at, before, before, anchorAfter ?? at);
      el.scrollLeft = moved.left; el.scrollTop = moved.top;
      return;
    }
    pending.current = { kind: "anchor", anchor: at, anchorAfter: anchorAfter ?? at, scale: before.scale, offset: before.offset, scroll };
    live.current.zoom = target;
    live.current.setZoom(target);
  }, [stage]);

  /** Scroll to an absolute position once the next layout is in place (used to restore a question's view). */
  const restoreScroll = useCallback((scroll: ScrollState) => { pending.current = { kind: "scroll", scroll }; }, []);

  useLayoutEffect(() => {
    const el = stage.current, next = pending.current;
    if (!el || !next) return;
    pending.current = undefined;
    const scroll = next.kind === "scroll" ? next.scroll : anchoredScroll(next.scroll, next.anchor, { scale: next.scale, offset: next.offset }, { scale, offset: contentOffset(el) }, next.anchorAfter);
    el.scrollLeft = scroll.left; el.scrollTop = scroll.top;
  }, [scale, layoutKey, stage]);

  useEffect(() => {
    const el = stage.current;
    if (!el || !enabled) return;
    let frame = 0; let queued: { zoom: number; anchor: Point; anchorAfter: Point } | undefined;
    const flush = () => { frame = 0; if (queued) { const q = queued; queued = undefined; requestZoom(q.zoom, q.anchor, q.anchorAfter); } };
    // Coalesce gesture updates to one layout per frame.
    const queue = (zoomValue: number, anchor: Point, anchorAfter = anchor) => {
      queued = { zoom: zoomValue, anchor: queued?.anchor ?? anchor, anchorAfter };
      if (!frame) frame = requestAnimationFrame(flush);
    };
    const queuedZoom = () => queued?.zoom ?? live.current.zoom;

    const wheel = (event: WheelEvent) => {
      // A plain wheel keeps scrolling; Ctrl/Cmd + wheel and trackpad pinch (sent as Ctrl + wheel) zoom.
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      queue(clampZoom(queuedZoom() * wheelFactor(event.deltaY, event.deltaMode)), stagePoint(el, event.clientX, event.clientY));
    };

    // Safari trackpad pinch.
    let gestureStart = 1;
    type Gesture = Event & { scale: number; clientX: number; clientY: number };
    const gestureStartHandler = (event: Event) => { event.preventDefault(); gestureStart = live.current.zoom; };
    const gestureChange = (event: Event) => { const g = event as Gesture; event.preventDefault(); queue(clampZoom(gestureStart * g.scale), stagePoint(el, g.clientX, g.clientY)); };

    const pointers = new Map<number, Point>();
    let gesture: { kind: "pan" | "pinch"; start: Point; last: Point; startZoom: number; startDistance: number; lastMid: Point; moved: number; pointerType: string; pinched: boolean } | undefined;
    let lastTap: { time: number; at: Point } | undefined;
    const distance = () => { const [a, b] = [...pointers.values()]; return Math.hypot(a.x - b.x, a.y - b.y) || 1; };
    const midpoint = (): Point => { const [a, b] = [...pointers.values()]; return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; };
    const overflow = () => ({ x: el.scrollWidth > el.clientWidth + 1, y: el.scrollHeight > el.clientHeight + 1 });

    let lastPointerType = "mouse";
    const down = (event: PointerEvent) => {
      lastPointerType = event.pointerType;
      if ((event.target as HTMLElement).closest(interactive)) return;
      if (event.pointerType === "mouse" && event.button !== 0) return;
      const at = stagePoint(el, event.clientX, event.clientY);
      if (event.pointerType === "mouse") {
        const o = overflow();
        if (!o.x && !o.y) return;
        event.preventDefault();
      }
      pointers.set(event.pointerId, at);
      try { el.setPointerCapture(event.pointerId); } catch { /* Capture is optional. */ }
      if (pointers.size === 1) gesture = { kind: "pan", start: at, last: at, startZoom: live.current.zoom, startDistance: 1, lastMid: at, moved: 0, pointerType: event.pointerType, pinched: false };
      else if (pointers.size === 2 && gesture) {
        Object.assign(gesture, { kind: "pinch", startZoom: queuedZoom(), startDistance: distance(), lastMid: midpoint(), pinched: true });
      }
      if (event.pointerType === "mouse") el.classList.add("qb-grabbing");
    };
    const move = (event: PointerEvent) => {
      if (!gesture || !pointers.has(event.pointerId)) return;
      const at = stagePoint(el, event.clientX, event.clientY);
      const previous = pointers.get(event.pointerId)!;
      pointers.set(event.pointerId, at);
      if (gesture.kind === "pinch" && pointers.size >= 2) {
        const mid = midpoint();
        queue(clampZoom(gesture.startZoom * distance() / gesture.startDistance), gesture.lastMid, mid);
        gesture.lastMid = mid;
        return;
      }
      const dx = at.x - previous.x, dy = at.y - previous.y;
      gesture.moved += Math.hypot(dx, dy); gesture.last = at;
      const o = overflow();
      if (o.x) el.scrollLeft -= dx;
      if (o.y) el.scrollTop -= dy;
      // Nothing to pan vertically: let a finger still scroll the page around the viewer.
      else if (event.pointerType !== "mouse") window.scrollBy(0, -dy);
    };
    const up = (event: PointerEvent) => {
      if (!pointers.has(event.pointerId)) return;
      pointers.delete(event.pointerId);
      try { el.releasePointerCapture(event.pointerId); } catch { /* Capture is optional. */ }
      if (!gesture) return;
      if (pointers.size === 1 && gesture.kind === "pinch") {
        // One finger lifted: carry on panning with the other.
        const [remaining] = [...pointers.values()];
        Object.assign(gesture, { kind: "pan", last: remaining });
        return;
      }
      if (pointers.size > 0) return;
      const g = gesture; gesture = undefined;
      el.classList.remove("qb-grabbing");
      if (event.type === "pointercancel" || g.pointerType === "mouse" || g.pinched) return;
      const at = stagePoint(el, event.clientX, event.clientY);
      const direction = swipeDirection(at.x - g.start.x, at.y - g.start.y, overflow().x);
      if (direction) { lastTap = undefined; live.current.onSwipe(direction); return; }
      if (g.moved < 12) {
        const now = performance.now();
        if (lastTap && now - lastTap.time < 320 && Math.hypot(at.x - lastTap.at.x, at.y - lastTap.at.y) < 40) {
          lastTap = undefined; requestZoom(toggleDetailZoom(live.current.zoom), at);
        } else lastTap = { time: now, at };
      }
    };
    const doubleClick = (event: MouseEvent) => {
      // Touch double-taps are handled above; browsers also report them as a double-click.
      if (lastPointerType !== "mouse") return;
      if ((event.target as HTMLElement).closest(interactive)) return;
      event.preventDefault();
      requestZoom(toggleDetailZoom(live.current.zoom), stagePoint(el, event.clientX, event.clientY));
    };

    el.addEventListener("wheel", wheel, { passive: false });
    el.addEventListener("gesturestart", gestureStartHandler);
    el.addEventListener("gesturechange", gestureChange);
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    el.addEventListener("dblclick", doubleClick);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      el.removeEventListener("wheel", wheel);
      el.removeEventListener("gesturestart", gestureStartHandler);
      el.removeEventListener("gesturechange", gestureChange);
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
      el.removeEventListener("dblclick", doubleClick);
      el.classList.remove("qb-grabbing");
    };
  }, [stage, enabled, requestZoom]);

  /** Pans by a fraction of the stage (keyboard). */
  const panBy = useCallback((x: number, y: number) => {
    const el = stage.current; if (!el) return;
    el.scrollBy({ left: x * el.clientWidth, top: y * el.clientHeight });
  }, [stage]);

  return { requestZoom, restoreScroll, panBy };
}
