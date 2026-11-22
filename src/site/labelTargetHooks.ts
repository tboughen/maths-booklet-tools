import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { TARGET_TIP, type Visibility } from "../editor-kit/visibility";

/** A touch board or tablet: targets reach further. Follows a tablet docked or undocked while the page is open. */
const COARSE = "(pointer: coarse)";
export function useCoarsePointer() {
  return useSyncExternalStore(
    (change) => {
      if (typeof matchMedia !== "function") return () => {};
      const query = matchMedia(COARSE);
      query.addEventListener("change", change);
      return () => query.removeEventListener("change", change);
    },
    () => typeof matchMedia === "function" && matchMedia(COARSE).matches,
    () => false,
  );
}

export type QuickTipState = { key: string; text: string; x: number; y: number; edge: "left" | "right" | null; below: boolean };

/**
 * The hint beside a label under the pointer or keyboard. Pointer and keyboard keep their own, so a pointer passing by
 * never takes the focused label's hint away. Escape closes it.
 */
export function useQuickTip() {
  const [hover, setHover] = useState<QuickTipState | null>(null);
  const [focus, setFocus] = useState<QuickTipState | null>(null);
  const tip = hover ?? focus;
  useEffect(() => {
    if (!tip) return;
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setHover(null);
      setFocus(null);
    };
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, [tip]);
  const at = (key: string, state: Visibility, el: HTMLElement): QuickTipState => {
    const x = el.offsetLeft + el.offsetWidth / 2,
      width = el.offsetParent instanceof HTMLElement ? el.offsetParent.offsetWidth : Infinity;
    return {
      key,
      // The label's name already says "left out" or "pupil space"; the hint says what to do.
      text: state === "hidden" ? "Click to edit · double-click to show the value" : TARGET_TIP,
      x,
      y: el.offsetTop,
      // Kept inside the drawing: near an edge it lines up with the label instead of centring on it.
      edge: x < 170 ? "left" : x > width - 170 ? "right" : null,
      below: el.offsetTop < 36,
    };
  };
  return {
    tip,
    bind: (key: string, state: Visibility) => ({
      onPointerEnter: (ev: { currentTarget: HTMLElement }) => setHover(at(key, state, ev.currentTarget)),
      onPointerLeave: () => setHover(null),
      onFocus: (ev: { currentTarget: HTMLElement }) => setFocus(at(key, state, ev.currentTarget)),
      onBlur: () => setFocus(null),
    }),
  };
}

type Box = { x: number; y: number; width: number; height: number };
/**
 * Every target reaches at least 24 px across with a mouse and 44 px on a touch board. The extra reach is an invisible
 * margin (the button's ::before), so the outline still shows the label's real size, and it stops halfway to a
 * neighbouring label, so a press never lands on the wrong one. Sizes in mm; the result in px.
 */
export function useTargetReach(targets: readonly Box[], mmToPx: number, coarse: boolean) {
  const minTarget = coarse ? 44 : 24;
  return useMemo(() => {
    const need = minTarget / (mmToPx || 1);
    return targets.map((t, i) => {
      let gx = Math.max(0, (need - t.width) / 2),
        gy = Math.max(0, (need - t.height) / 2);
      targets.forEach((o, j) => {
        if (i === j) return;
        const overlapY = t.y - gy < o.y + o.height && o.y < t.y + t.height + gy;
        const overlapX = t.x - gx < o.x + o.width && o.x < t.x + t.width + gx;
        const gapX = Math.max(o.x - (t.x + t.width), t.x - (o.x + o.width));
        const gapY = Math.max(o.y - (t.y + t.height), t.y - (o.y + o.height));
        if (overlapY && gapX >= 0) gx = Math.min(gx, gapX / 2);
        if (overlapX && gapY >= 0) gy = Math.min(gy, gapY / 2);
      });
      return { x: gx * (mmToPx || 1), y: gy * (mmToPx || 1) };
    });
  }, [targets, minTarget, mmToPx]);
}
