import { useEffect, useRef } from "react";
import type { ReactNode } from "react";

export function RatioDialog({
  title,
  children,
  onCancel,
  onConfirm,
  confirmLabel = "Open this table",
  disabled = false,
}: {
  title: string;
  children: ReactNode;
  onCancel: () => void;
  onConfirm: () => void;
  confirmLabel?: string;
  disabled?: boolean;
}) {
  const dialog = useRef<HTMLElement>(null);
  useEffect(() => {
    const previous = document.activeElement;
    dialog.current?.querySelector<HTMLButtonElement>("button")?.focus();
    function keys(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
      }
      if (e.key !== "Tab") return;
      const buttons = dialog.current?.querySelectorAll<HTMLButtonElement>(
        "button:not(:disabled)",
      );
      if (!buttons?.length) return;
      const first = buttons[0],
        last = buttons[buttons.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    window.addEventListener("keydown", keys);
    return () => {
      window.removeEventListener("keydown", keys);
      if (previous instanceof HTMLElement) previous.focus();
    };
  }, [onCancel]);
  return (
    <div className="word-help-backdrop">
      <section
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ratio-dialog-title"
        className="word-help-dialog ratio-dialog"
      >
        <h2 id="ratio-dialog-title">{title}</h2>
        {children}
        <div className="graph-import-actions">
          <button onClick={onCancel}>Cancel</button>
          <button
            disabled={disabled}
            className="word-help-done"
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}
