import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

/** UI-only layer: never a child of the clipped pupil resource. */
export function TriangleFloatingEditor({
  anchor,
  title,
  children,
  active = true,
}: {
  anchor: string;
  title: string;
  children: ReactNode;
  active?: boolean;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{
    left: number;
    top: number;
    docked: boolean;
    maxHeight: number;
  } | null>(null);
  useLayoutEffect(() => {
    if (!active) return;
    const update = () => {
      const panel = box.current,
        target = document.querySelector<HTMLElement>(
          `[data-tr-anchor="${anchor}"]`,
        );
      if (!panel || !target) return;
      const viewport = window.visualViewport,
        left = viewport?.offsetLeft ?? 0,
        top = viewport?.offsetTop ?? 0;
      const width = viewport?.width ?? innerWidth,
        height = viewport?.height ?? innerHeight;
      // Keep the shared navigation reachable while an invalid draft is retained.
      // Tall editors scroll below the header instead of covering its tool links.
      const navigationBottom =
        document.querySelector(".site-navigation")?.getBoundingClientRect()
          .bottom ?? top;
      const safeTop = Math.max(
        top + 12,
        Math.min(navigationBottom + 8, top + height - 180),
      );
      const maxHeight = Math.max(120, top + height - safeTop - 12);
      const r = target.getBoundingClientRect(),
        b = panel.getBoundingClientRect();
      const panelHeight = Math.min(b.height, maxHeight);
      const scroll = target.closest(".tr-scroll")?.getBoundingClientRect();
      const docked =
        !!scroll &&
        (r.bottom < scroll.top ||
          r.top > scroll.bottom ||
          r.right < scroll.left ||
          r.left > scroll.right);
      let x = r.left + r.width / 2 - b.width / 2,
        y = r.bottom + 8;
      if (docked) {
        x = scroll!.left + 12;
        y = scroll!.top + 12;
      }
      if (width <= 600) {
        x = left + (width - b.width) / 2;
        y = top + height - panelHeight - 12;
      } else if (y + panelHeight > top + height - 12)
        y = r.top - panelHeight - 8;
      x = Math.max(left + 12, Math.min(left + width - b.width - 12, x));
      y = Math.max(safeTop, Math.min(top + height - panelHeight - 12, y));
      setPosition((previous) =>
        previous?.left === x &&
        previous.top === y &&
        previous.docked === docked &&
        previous.maxHeight === maxHeight
          ? previous
          : { left: x, top: y, docked, maxHeight },
      );
    };
    update();
    const observer = new ResizeObserver(update);
    if (box.current) observer.observe(box.current);
    const resource = document
      .querySelector(`[data-tr-anchor="${anchor}"]`)
      ?.closest(".tr-resource");
    if (resource) observer.observe(resource);
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    window.visualViewport?.addEventListener("resize", update);
    window.visualViewport?.addEventListener("scroll", update);
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("scroll", update);
    };
  }, [anchor, active]);
  useEffect(() => {
    if (!active || matchMedia("(pointer: coarse)").matches) return;
    const frame = requestAnimationFrame(() => {
      const input = box.current?.querySelector<HTMLInputElement>(
        "[data-tr-label-text]",
      );
      input?.focus({ preventScroll: true });
      input?.select();
    });
    return () => cancelAnimationFrame(frame);
  }, [anchor, active]);
  return createPortal(
    <div
      ref={box}
      className="tr-floating"
      role="dialog"
      aria-label={title}
      aria-hidden={!active}
      inert={!active}
      style={{
        left: position?.left ?? 12,
        top: position?.top ?? 12,
        visibility: position ? "visible" : "hidden",
        maxHeight: position?.maxHeight,
        display: active ? undefined : "none",
      }}
    >
      <div className="tr-floating-title">{title}</div>
      {position?.docked && (
        <p className="tr-note">
          Editing the selected label; scroll back to see it.
        </p>
      )}
      {children}
    </div>,
    document.body,
  );
}
