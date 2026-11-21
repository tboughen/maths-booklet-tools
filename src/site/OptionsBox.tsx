import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { modalOpen } from "../editor-kit/shortcuts";
import "./options-box.css";

/**
 * The small options box beside a clicked label (the 21 Nov 2026 usability plan): one open at a time, never over the
 * label it belongs to, kept inside the window, and live (no Apply or Cancel: each change is one undo step).
 * Escape or a press elsewhere closes it; keyboard focus moves in when it opens and back to the label when it closes.
 * Enter, with the box itself focused, moves to its text field. It is a screen control, never part of an export.
 *
 * Click targets that open it carry `data-options-anchor`, so pressing another one moves the box rather than closing it.
 */
export function OptionsBox({
  anchor,
  anchorKey,
  title,
  onClose,
  children,
}: {
  /** The click target the box belongs to. */
  anchor: HTMLElement | null;
  /** Changes when the box moves to another label, so focus moves in again. */
  anchorKey: string;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [place, setPlace] = useState<{ left: number; top: number } | null>(null);
  const close = useRef(onClose);
  close.current = onClose;

  // Beside the label: to its right, else its left, else below it, and always inside the window.
  const measure = () => {
    const el = box.current;
    if (!el || !anchor || !anchor.isConnected) return;
    const a = anchor.getBoundingClientRect(),
      w = el.offsetWidth,
      h = el.offsetHeight,
      gap = 8,
      edge = 8;
    if (!a.width && !a.height) return;
    let left: number, top: number;
    if (a.right + gap + w <= innerWidth - edge) left = a.right + gap;
    else if (a.left - gap - w >= edge) left = a.left - gap - w;
    else left = -1;
    if (left >= 0) top = Math.min(Math.max(edge, a.top - 4), innerHeight - edge - h);
    else {
      left = Math.min(Math.max(edge, a.left), innerWidth - edge - w);
      top = a.bottom + gap + h <= innerHeight - edge ? a.bottom + gap : Math.max(edge, a.top - gap - h);
    }
    setPlace((p) => (p && Math.abs(p.left - left) < 0.5 && Math.abs(p.top - top) < 0.5 ? p : { left, top }));
  };
  useLayoutEffect(measure);
  useEffect(() => {
    const again = () => measure();
    addEventListener("scroll", again, true);
    addEventListener("resize", again);
    return () => {
      removeEventListener("scroll", again, true);
      removeEventListener("resize", again);
    };
  });

  // Focus moves in on opening, and back to the label on closing.
  // (Once placed: a box still hidden for measuring cannot take focus.)
  const placed = place !== null;
  useEffect(() => {
    if (placed) box.current?.focus({ preventScroll: true });
  }, [anchorKey, placed]);
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
      if (box.current?.contains(document.activeElement) && anchor?.isConnected) anchor.focus({ preventScroll: true });
      close.current();
    };
    document.addEventListener("pointerdown", away, true);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", away, true);
      document.removeEventListener("keydown", escape);
    };
  }, [anchor]);

  return createPortal(
    <div
      ref={box}
      className="md-options-box"
      role="dialog"
      aria-label={title}
      tabIndex={-1}
      onFocus={() => (hadFocus.current = true)}
      onBlur={(event) => (hadFocus.current = box.current?.contains(event.relatedTarget as Node | null) ?? false)}
      style={place ? { left: place.left, top: place.top } : { visibility: "hidden", left: 0, top: 0 }}
      onKeyDown={(event) => {
        if (event.key === "Enter" && event.target === box.current) {
          const field = box.current?.querySelector<HTMLInputElement>("input:not([type=checkbox]):not([disabled])");
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
