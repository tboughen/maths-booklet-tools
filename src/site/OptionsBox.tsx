import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { modalOpen } from "../editor-kit/shortcuts";
import "./options-box.css";

/**
 * The small options box beside a clicked label (the 21 Nov 2026 usability plan): one open at a time, never over the
 * label it belongs to, kept inside the window, and live (no Apply or Cancel: each change is one undo step).
 * Escape or a press elsewhere closes it. It opens with the cursor in its text field, and focus goes back to the label when it closes.
 * Enter, with the box itself focused, moves to its text field. It is a screen control, never part of an export.
 *
 * Click targets that open it carry `data-options-anchor`, so pressing another one moves the box rather than closing it.
 */
/** The box's text field: the first text input or text area. */
const FIELD = "input:not([type=checkbox]):not([disabled]), textarea:not([disabled])";

export function OptionsBox({
  anchor,
  anchorKey,
  focusField = true,
  takeFocus = true,
  bounds,
  placeBy,
  hidden = false,
  title,
  onClose,
  children,
}: {
  /** The click target the box belongs to. */
  anchor: HTMLElement | SVGElement | null;
  /** Changes when the box moves to another label, so focus moves in again. */
  anchorKey: string;
  /** Open with the cursor in the text field (the default). False: the box itself takes focus, as on a touch screen. */
  focusField?: boolean;
  /** False: focus stays where it is, for a box beside a field typed in on the drawing itself (ratio table cells). */
  takeFocus?: boolean;
  /** Keep the box across this element (the editor's drawing area) rather than the whole window, so it never covers the settings. */
  bounds?: HTMLElement | null;
  /** Sit beside this element (a whole diagram) rather than the anchor, so the box never covers the anchor's
   * neighbours. Focus still goes back to the anchor. */
  placeBy?: HTMLElement | null;
  /** Kept but out of sight while its page is not the one showing, so a draft in it survives a visit elsewhere. */
  hidden?: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [place, setPlace] = useState<{ left: number; top: number } | null>(null);
  const close = useRef(onClose);
  close.current = onClose;

  const measure = () => {
    const el = box.current;
    if (!el || !anchor || !anchor.isConnected) return;
    const w = el.offsetWidth,
      h = el.offsetHeight,
      gap = 8,
      edge = 8;
    const b = bounds?.isConnected ? bounds.getBoundingClientRect() : null,
      lo = Math.max(0, b?.left ?? 0) + edge,
      hi = Math.min(innerWidth, b?.right ?? innerWidth) - edge;
    // Beside the drawing: to its right, else its left, else under or over it where the whole box fits in the window.
    // With no room round a whole drawing, beside the label itself, else under or over it, always inside the window.
    const side = (a: DOMRect) =>
      a.right + gap + w <= hi ? a.right + gap : a.left - gap - w >= lo ? a.left - gap - w : -1;
    const across = (a: DOMRect) => Math.min(Math.max(lo, a.left), hi - w);
    let left = -1,
      top = 0;
    const whole = placeBy?.isConnected ? placeBy.getBoundingClientRect() : null;
    if (whole && (whole.width || whole.height)) {
      left = side(whole);
      if (left >= 0) top = Math.min(Math.max(edge, whole.top - 4), innerHeight - edge - h);
      else if (whole.bottom + gap + h <= innerHeight - edge) [left, top] = [across(whole), whole.bottom + gap];
      else if (whole.top - gap - h >= edge) [left, top] = [across(whole), whole.top - gap - h];
    }
    if (left < 0) {
      const a = anchor.getBoundingClientRect();
      if (!a.width && !a.height) return;
      left = side(a);
      if (left >= 0) top = Math.min(Math.max(edge, a.top - 4), innerHeight - edge - h);
      else {
        left = across(a);
        top = a.bottom + gap + h <= innerHeight - edge ? a.bottom + gap : Math.max(edge, Math.min(a.top - gap - h, innerHeight - edge - h));
      }
    }
    setPlace((p) => (p && Math.abs(p.left - left) < 0.5 && Math.abs(p.top - top) < 0.5 ? p : { left, top }));
  };
  useLayoutEffect(measure);
  useEffect(() => {
    const again = () => measure();
    addEventListener("scroll", again, true);
    addEventListener("resize", again);
    // The box can grow after it is placed (a note or an error appears, a font arrives), so it is placed again.
    const grown = new ResizeObserver(again);
    if (box.current) grown.observe(box.current);
    return () => {
      removeEventListener("scroll", again, true);
      removeEventListener("resize", again);
      grown.disconnect();
    };
  });

  // Focus moves in on opening, and back to the label on closing.
  // (Once placed: a box still hidden for measuring cannot take focus.)
  const placed = place !== null;
  // Typing comes first (Tim, 21 Nov 2026): the cursor goes straight into the box's text field, its text selected, so
  // typing replaces the value. A box with no text field takes the focus itself.
  useEffect(() => {
    if (!placed || !takeFocus) return;
    const field = focusField ? box.current?.querySelector<HTMLInputElement | HTMLTextAreaElement>(FIELD) : null;
    if (field) {
      field.focus({ preventScroll: true });
      field.select();
    } else box.current?.focus({ preventScroll: true });
  }, [anchorKey, placed, focusField, takeFocus]);
  // Whether focus was in the box, kept as it moves: by the time React removes the box, focus has already left it.
  const hadFocus = useRef(false);
  useEffect(() => {
    const anchorNow = anchor;
    return () => {
      const lost = document.activeElement === null || document.activeElement === document.body;
      if (hadFocus.current && lost && anchorNow?.isConnected) anchorNow.focus({ preventScroll: true });
      hadFocus.current = false;
    };
  }, [anchor]);

  useEffect(() => {
    if (hidden) return;
    const away = (event: PointerEvent) => {
      const t = event.target as Element | null;
      if (!t || box.current?.contains(t) || t.closest("[data-options-anchor]")) return;
      if (modalOpen()) return;
      // A field still being typed in commits first: a field removed with focus never gets its blur.
      if (box.current?.contains(document.activeElement)) (document.activeElement as HTMLElement).blur();
      close.current();
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented || modalOpen()) return;
      if (document.querySelector('[role="menu"]')) return;
      event.preventDefault();
      // A field may have let go of the focus on Escape already (it puts its value back); the label takes it either way.
      const lost = document.activeElement === null || document.activeElement === document.body;
      if ((lost || box.current?.contains(document.activeElement)) && anchor?.isConnected) anchor.focus({ preventScroll: true });
      close.current();
    };
    document.addEventListener("pointerdown", away, true);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", away, true);
      document.removeEventListener("keydown", escape);
    };
  }, [anchor, hidden]);

  return createPortal(
    <div
      ref={box}
      className="md-options-box"
      role="dialog"
      aria-label={title}
      tabIndex={-1}
      onFocus={() => (hadFocus.current = true)}
      onBlur={(event) => (hadFocus.current = box.current?.contains(event.relatedTarget as Node | null) ?? false)}
      hidden={hidden}
      style={place ? { left: place.left, top: place.top } : { visibility: "hidden", left: 0, top: 0 }}
      onKeyDown={(event) => {
        if (event.key === "Enter" && event.target === box.current) {
          const field = box.current?.querySelector<HTMLInputElement | HTMLTextAreaElement>(FIELD);
          if (field) {
            event.preventDefault();
            field.focus();
            field.select();
          }
        }
      }}
    >
      <div className="md-options-head">
        <h2>{title}</h2>
        <button type="button" className="md-options-close" aria-label="Close options" title="Close (Escape)" onClick={() => close.current()}>
          <X size={16} aria-hidden="true" />
        </button>
      </div>
      {children}
    </div>,
    document.body,
  );
}
