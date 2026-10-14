import { useLayoutEffect, useRef, type ReactNode } from "react";

export function InspectorEditor({
  title,
  children,
  active,
  blocked,
  onClose,
}: {
  title: string;
  children: ReactNode;
  active: boolean;
  blocked: boolean;
  onClose: () => void;
}) {
  const ref = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    if (!active) return;
    const control = ref.current?.querySelector<HTMLElement>(
      ".vg-context-content input, .vg-context-content select, .vg-context-content button",
    );
    control?.focus({ preventScroll: true });
    ref.current?.scrollIntoView({ block: "nearest" });
  }, [title, active]);
  return (
    <section
      ref={ref}
      className="panel-card vg-inspector-editor"
      aria-label={title}
      hidden={!active}
      onKeyDown={(e) => {
        if (e.key === "Escape" && !blocked) {
          e.stopPropagation();
          onClose();
        }
      }}
    >
      <div className="vg-context-heading">
        <h2>{title}</h2>
        <button aria-label="Close editor" disabled={blocked} onClick={onClose}>
          ×
        </button>
      </div>
      <div className="vg-context-content">{children}</div>
    </section>
  );
}
