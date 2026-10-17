import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
export function CellEditor({
  anchor,
  active,
  title = "Edit grid cell",
  children,
}: {
  anchor: string;
  active: boolean;
  title?: string;
  children: ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null),
    [position, setPosition] = useState({ left: 12, top: 180, maxHeight: 400 });
  useLayoutEffect(() => {
    if (!active) return;
    const place = () => {
      const box = panel.current,
        cell = document.querySelector(`[data-ag-cell="${anchor}"]`);
      if (!box || !cell) return;
      const v = window.visualViewport,
        left = v?.offsetLeft ?? 0,
        top = v?.offsetTop ?? 0,
        width = v?.width ?? innerWidth,
        height = v?.height ?? innerHeight;
      const safeTop = Math.max(
        top + 8,
        Math.min(
          document.querySelector(".site-navigation")?.getBoundingClientRect()
            .bottom ?? top + 8,
          top + height - 180,
        ),
      );
      const maxHeight = Math.max(100, top + height - safeTop - 12),
        r = cell.getBoundingClientRect(),
        b = box.getBoundingClientRect(),
        h = Math.min(b.height, maxHeight);
      setPosition({
        left: Math.max(left + 8, Math.min(r.left, left + width - b.width - 8)),
        top: Math.max(
          safeTop,
          Math.min(
            width < 620 ? top + height - h - 8 : r.bottom + 8,
            top + height - h - 8,
          ),
        ),
        maxHeight,
      });
    };
    place();
    const ro = new ResizeObserver(place);
    if (panel.current) ro.observe(panel.current);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    window.visualViewport?.addEventListener("resize", place);
    window.visualViewport?.addEventListener("scroll", place);
    const frame = requestAnimationFrame(() => {
      panel.current
        ?.querySelector<HTMLInputElement>("input")
        ?.focus({ preventScroll: true });
      panel.current?.querySelector<HTMLInputElement>("input")?.select();
    });
    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
      window.visualViewport?.removeEventListener("resize", place);
      window.visualViewport?.removeEventListener("scroll", place);
    };
  }, [anchor, active]);
  return createPortal(
    <div
      ref={panel}
      className="ag-floating"
      role="dialog"
      aria-label={title}
      inert={!active}
      style={{ ...position, display: active ? undefined : "none" }}
    >
      {children}
    </div>,
    document.body,
  );
}
