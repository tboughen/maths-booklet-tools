import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

export function LocalEditor({
  anchor,
  title,
  children,
  onClose,
  blocked,
  active,
}: {
  anchor: HTMLElement | null;
  title: string;
  children: ReactNode;
  onClose: () => void;
  blocked: boolean;
  active: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ left: 8, top: 100 });
  useLayoutEffect(() => {
    if (!active) return;
    const place = () => {
      if (!ref.current) return;
      const width = ref.current.offsetWidth,
        height = ref.current.offsetHeight;
      const rect = anchor?.getBoundingClientRect();
      const left = Math.max(
        8,
        Math.min(rect?.left ?? 20, window.innerWidth - width - 8),
      );
      const below = (rect?.bottom ?? 90) + 8;
      const top = Math.max(8, Math.min(below, window.innerHeight - height - 8));
      setPosition({ left, top });
    };
    place();
    ref.current?.querySelector<HTMLElement>("input,select,button")?.focus();
    const observer = new ResizeObserver(place);
    observer.observe(ref.current!);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [anchor, title, active]);
  return (
    <div
      ref={ref}
      className="vg-local-editor"
      role="dialog"
      hidden={!active}
      aria-label={title}
      style={position}
      onKeyDown={(e) => {
        if (e.key === "Escape" && !blocked) {
          e.stopPropagation();
          onClose();
        }
      }}
    >
      <div className="vg-context-heading">
        <strong>{title}</strong>
        <button aria-label="Close editor" disabled={blocked} onClick={onClose}>
          ×
        </button>
      </div>
      {children}
    </div>
  );
}
