import { useLayoutEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

/** Grouped label editing is docked beside the artwork, never over it. */
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
  const host = document.querySelector(".tr-label-editor-slot");
  useLayoutEffect(() => {
    if (!active) return;
    const frame = requestAnimationFrame(() => {
      const panel = box.current;
      if (!panel) return;
      if (matchMedia("(max-width: 900px)").matches)
        panel.scrollIntoView({ block: "start" });
      else {
        const inspector = panel.closest(".inspector-stack");
        if (inspector) inspector.scrollTop = 0;
      }
      if (matchMedia("(pointer: coarse)").matches) panel.focus();
      else {
        const input = panel.querySelector<HTMLInputElement>(
          "[data-tr-label-text]",
        );
        input?.focus({ preventScroll: true });
        input?.select();
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [anchor, active]);
  if (!host) return null;
  return createPortal(
    <div
      ref={box}
      className="tr-floating tr-docked panel-card"
      role="dialog"
      aria-label={title}
      aria-hidden={!active}
      inert={!active}
      tabIndex={-1}
      hidden={!active}
    >
      <h2 className="tr-floating-title">{title}</h2>
      {children}
    </div>,
    host,
  );
}
