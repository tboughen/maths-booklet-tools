import { useEffect, useRef, useState, type ReactNode } from "react";
import { Lightbulb, X } from "lucide-react";
import type { ToolId } from "./routes";

export const HINT_STORAGE_PREFIX = "mathsdock:hint-dismissed:";

/** A tool's tip key: its route id, or a variant for a page with different controls (the classic bar model). */
export type HintKey = ToolId | "bar-model-classic";

function readDismissed(tool: HintKey) {
  try {
    return localStorage.getItem(HINT_STORAGE_PREFIX + tool) === "1";
  } catch {
    return false;
  }
}

function saveDismissed(tool: HintKey) {
  try {
    localStorage.setItem(HINT_STORAGE_PREFIX + tool, "1");
  } catch {
    /* The tip stays hidden for this visit only. */
  }
}

/**
 * The one hint every editor shows, at the end of its foot strip (`EditorFoot`).
 *
 * `children` is the first-use tip: the teacher can hide it for good, and that
 * choice is remembered in this browser. `prompt` is an instruction for the
 * current drawing mode (for example "Choose the other endpoint"); it takes the
 * same place, always shows while that mode is active and cannot be hidden.
 * The prompt's status region is always mounted, so screen readers announce
 * each new prompt. The hint sits outside the resource, so it never appears in an export.
 */
export function EditorHint({
  tool,
  prompt,
  children,
}: {
  tool: HintKey;
  prompt?: ReactNode;
  children?: ReactNode;
}) {
  const [dismissed, setDismissed] = useState(() => readDismissed(tool));
  const slot = useRef<HTMLDivElement>(null);
  // Follow a change of key, and the same tip being hidden in another tab.
  useEffect(() => {
    setDismissed(readDismissed(tool));
    const listener = (event: StorageEvent) => {
      if (event.key === null || event.key === HINT_STORAGE_PREFIX + tool) setDismissed(readDismissed(tool));
    };
    window.addEventListener("storage", listener);
    return () => window.removeEventListener("storage", listener);
  }, [tool]);
  const showTip = !prompt && !!children && !dismissed;
  return (
    <div ref={slot} className="editor-hint-slot" data-testid="editor-hint">
      <p className={`editor-hint-live${prompt ? " editor-hint editor-hint--prompt" : ""}`} aria-live="polite">
        {prompt}
      </p>
      {showTip && (
        <div className="editor-hint">
          <Lightbulb size={16} aria-hidden="true" />
          <p>{children}</p>
          <button
            type="button"
            className="editor-hint-dismiss"
            aria-label="Hide this tip"
            title="Hide this tip"
            onClick={() => {
              saveDismissed(tool);
              setDismissed(true);
              // Keep focus on a real control: the zoom at the start of the same strip.
              slot.current?.closest(".editor-foot")?.querySelector<HTMLElement>("select:not(:disabled)")?.focus();
            }}
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
}
