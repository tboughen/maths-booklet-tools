import { useRef, useState, type ReactNode } from "react";
import { Lightbulb, X } from "lucide-react";

export const HINT_STORAGE_PREFIX = "mathsdock:hint-dismissed:";

function readDismissed(tool: string) {
  try {
    return localStorage.getItem(HINT_STORAGE_PREFIX + tool) === "1";
  } catch {
    return false;
  }
}

function saveDismissed(tool: string) {
  try {
    localStorage.setItem(HINT_STORAGE_PREFIX + tool, "1");
  } catch {
    /* The tip stays hidden for this visit only. */
  }
}

/**
 * The one hint line every editor shows directly under its preview bar.
 *
 * `children` is the first-use tip: the teacher can hide it for good, and that
 * choice is remembered in this browser. `prompt` is an instruction for the
 * current drawing mode (for example "Choose the other endpoint"); it takes the
 * same place, always shows while that mode is active and cannot be hidden.
 * The line sits outside the resource, so it never appears in an export.
 */
export function EditorHint({
  tool,
  prompt,
  children,
}: {
  tool: string;
  prompt?: ReactNode;
  children?: ReactNode;
}) {
  const [dismissed, setDismissed] = useState(() => readDismissed(tool));
  const slot = useRef<HTMLDivElement>(null);
  const showTip = !prompt && !!children && !dismissed;
  return (
    <div
      ref={slot}
      className="editor-hint-slot"
      data-testid="editor-hint"
      tabIndex={-1}
    >
      {prompt ? (
        <p className="editor-hint editor-hint--prompt" role="status">
          {prompt}
        </p>
      ) : (
        showTip && (
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
                slot.current?.focus();
              }}
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>
        )
      )}
    </div>
  );
}
