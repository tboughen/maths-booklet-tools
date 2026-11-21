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
 * (21 Nov 2026 usability review). Only a message that follows a press of Copy image, Copy for
 * Word, Download or File is repeated, so field errors typed elsewhere never pop up there. The
 * foot strip keeps the message and announces it; this copy is drawn from a data attribute (so the
 * text is in the page once), is for the eye only, follows the buttons on scroll, and lets clicks
 * through. Never part of an export.
 */
function StatusFlash({ status, foot }: { status: ReactNode; foot: RefObject<HTMLDivElement | null> }) {
  const [shown, setShown] = useState<{ text: string; top: number; right: number } | null>(null);
  const last = useRef<ReactNode>(status);
  const armedUntil = useRef(0);
  const actions = () => foot.current?.closest(".editor-card")?.querySelector<HTMLElement>(".editor-copy-actions") ?? null;
  // A press in the copy, Download or File buttons arms the flash for the message that follows.
  useEffect(() => {
    const card = foot.current?.closest(".editor-card");
    if (!card) return;
    const arm = (event: Event) => {
      if ((event.target as Element | null)?.closest?.(".editor-copy-actions")) armedUntil.current = Date.now() + 20000;
    };
    card.addEventListener("pointerdown", arm, true);
    card.addEventListener("keydown", arm, true);
    return () => {
      card.removeEventListener("pointerdown", arm, true);
      card.removeEventListener("keydown", arm, true);
    };
  }, [foot]);
  useEffect(() => {
    if (status === last.current) return;
    last.current = status;
    const text = foot.current?.querySelector(".resource-feedback")?.textContent?.trim() ?? "";
    const box = actions()?.getBoundingClientRect();
    if (!status || !text || Date.now() > armedUntil.current || !box?.width) {
      setShown(null);
      return;
    }
    armedUntil.current = 0;
    setShown({ text, top: box.bottom + 6, right: Math.max(8, window.innerWidth - box.right) });
    const timer = window.setTimeout(() => setShown(null), 2600);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, foot]);
  // Follow the buttons if the page scrolls or resizes while the message shows.
  useEffect(() => {
    if (!shown) return;
    const follow = () => {
      const box = actions()?.getBoundingClientRect();
      if (!box?.width) return setShown(null);
      setShown((now) => (now ? { ...now, top: box.bottom + 6, right: Math.max(8, window.innerWidth - box.right) } : now));
    };
    window.addEventListener("scroll", follow, true);
    window.addEventListener("resize", follow);
    return () => {
      window.removeEventListener("scroll", follow, true);
      window.removeEventListener("resize", follow);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown !== null]);
  if (!shown) return null;
  return <span className="editor-status-flash" aria-hidden="true" data-text={shown.text} style={{ top: shown.top, right: shown.right }} />;
}
