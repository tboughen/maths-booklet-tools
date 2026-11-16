import type { ReactNode } from "react";
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
  return (
    <div className="editor-foot" role="group" aria-label="View">
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
