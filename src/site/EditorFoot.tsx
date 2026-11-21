import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { PreviewControls } from "./PreviewControls";
import "./editor-foot.css";

/**
 * The foot strip of every editor card: zoom, the true print size, any view-only switches, and at
 * the end the tool's hint or drawing prompt, with the latest message ("Image copied") beside it.
 * Nothing here is part of the resource.
 */
export function EditorFoot({
  zoom,
  onZoom,
  scale,
  size,
  status,
  hint,
  children,
}: {
  /** 0 fits the diagram to its space. */
  zoom: number;
  onZoom: (value: number) => void;
  /** The size the diagram is drawn at now (1 is print size). */
  scale: number;
  /** A `ResourceSize`. */
  size: ReactNode;
  /** The latest message about a copy, download or file. Leave it out only in a tool that shows its messages elsewhere. */
  status?: ReactNode;
  /** An `EditorHint`. */
  hint: ReactNode;
  /** Switches that change only what the screen shows. */
  children?: ReactNode;
}) {
  const foot = useRef<HTMLDivElement>(null);
  return (
    <div ref={foot} className="editor-foot" role="group" aria-label="Zoom and print size">
      <StatusFlash status={status} foot={foot} />
      <PreviewControls zoom={zoom} onZoom={onZoom} scale={scale} />
      {size}
      {children}
      <div className="editor-foot-note">
        {/* Mounted before any message, so screen readers announce one when it arrives. */}
        {status !== undefined && (
          <p className="resource-feedback" role="status">
            {status || null}
          </p>
        )}
        {hint}
      </div>
    </div>
  );
}

/**
 * Repeats a new message for a moment beside the copy buttons, where the teacher is looking
 * (21 Nov 2026 usability review). The foot strip keeps the message and announces it; this copy
 * is for the eye only, never part of an export, and lets clicks through.
 */
function StatusFlash({ status, foot }: { status: ReactNode; foot: RefObject<HTMLDivElement | null> }) {
  const [shown, setShown] = useState<{ text: ReactNode; top: number; right: number } | null>(null);
  const last = useRef<ReactNode>(status);
  useEffect(() => {
    if (status === last.current) return;
    last.current = status;
    if (!status) {
      setShown(null);
      return;
    }
    const actions = foot.current?.closest(".editor-card")?.querySelector(".editor-copy-actions");
    const box = actions?.getBoundingClientRect();
    if (!box || !box.width) return;
    setShown({ text: status, top: box.bottom + 6, right: Math.max(8, window.innerWidth - box.right) });
    const timer = window.setTimeout(() => setShown(null), 2600);
    return () => window.clearTimeout(timer);
  }, [status, foot]);
  if (!shown) return null;
  return (
    <span className="editor-status-flash" aria-hidden="true" style={{ top: shown.top, right: shown.right }}>
      {shown.text}
    </span>
  );
}
