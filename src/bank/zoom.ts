/** Screen-only zoom for the question viewer. 1 means "fits the stage"; print and export sizes never use it. */
export const ZOOM_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3, 4] as const;
export const MIN_ZOOM = ZOOM_STEPS[0];
export const MAX_ZOOM = ZOOM_STEPS[ZOOM_STEPS.length - 1];
/** Double-click and double-tap zoom to this level, or back to fit from here or above. */
export const DETAIL_ZOOM = 2;

export const clampZoom = (zoom: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Number.isFinite(zoom) ? zoom : 1));

/** The next preset step above (direction 1) or below (direction -1), so a gesture-made 1.37 steps to 1.5 or 1.25. */
export function stepZoom(zoom: number, direction: 1 | -1): number {
  const epsilon = 0.001;
  if (direction > 0) return ZOOM_STEPS.find(step => step > zoom + epsilon) ?? MAX_ZOOM;
  return [...ZOOM_STEPS].reverse().find(step => step < zoom - epsilon) ?? MIN_ZOOM;
}

/** Wheel or trackpad-pinch delta to a zoom factor; large mouse-wheel notches are capped so one notch is one gentle step. */
export function wheelFactor(deltaY: number, deltaMode = 0): number {
  const pixels = deltaMode === 1 ? deltaY * 16 : deltaMode === 2 ? deltaY * 400 : deltaY;
  return Math.exp(-Math.max(-20, Math.min(20, pixels)) * 0.01);
}

export interface Point { x: number; y: number }
export interface ScrollState { left: number; top: number }

/**
 * Keeps the content point under `anchor` (stage client coordinates) fixed across a scale change.
 * `offset` is where the scaled content starts inside the scroll area (it is centred when smaller than the stage).
 */
export function anchoredScroll(scroll: ScrollState, anchor: Point, before: { scale: number; offset: Point }, after: { scale: number; offset: Point }, anchorAfter: Point = anchor): ScrollState {
  // anchorAfter differs from anchor during a pinch, when the fingers also move: the content follows them.
  const ratio = after.scale / before.scale;
  const contentX = scroll.left + anchor.x - before.offset.x;
  const contentY = scroll.top + anchor.y - before.offset.y;
  return { left: Math.max(0, contentX * ratio + after.offset.x - anchorAfter.x), top: Math.max(0, contentY * ratio + after.offset.y - anchorAfter.y) };
}

/** What double-click or double-tap does from the current zoom. */
export const toggleDetailZoom = (zoom: number) => (zoom < DETAIL_ZOOM - 0.001 ? DETAIL_ZOOM : 1);

/** A horizontal swipe that changes question: long, mostly sideways, and only when nothing is wider than the stage. */
export function swipeDirection(dx: number, dy: number, overflowsSideways: boolean): 1 | -1 | 0 {
  if (overflowsSideways || Math.abs(dx) <= 90 || Math.abs(dy) >= 60) return 0;
  return dx < 0 ? 1 : -1;
}
