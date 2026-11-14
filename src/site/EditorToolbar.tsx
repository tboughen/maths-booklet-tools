import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { HistoryButtons } from "./HistoryButtons";
import { isResetStep } from "../editor-kit/labels";

/** Starts the print-font fetch once, on the first sign of an export (U57). */
let preloaded = false;
function preloadExportFonts() {
  if (preloaded) return;
  preloaded = true;
  void import("../export/portable").then((m) => m.preloadPortableFonts()).catch(() => (preloaded = false));
}
import {
  ChevronDown,
  Copy,
  LoaderCircle,
  RotateCcw,
  X,
} from "lucide-react";

interface EditorToolbarProps {
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  /** Name of the step Undo would reverse, such as "add row" (U8). */
  undoLabel?: string;
  /** Name of the step Redo would restore. */
  redoLabel?: string;
  onReset: () => void;
  resetLabel?: string;
  resetDisabled?: boolean;
  exportDisabled?: boolean;
  busy?: boolean;
  onCopy: () => void;
  onCopyClipboard: () => void;
  menuOpen: boolean;
  onToggleMenu: () => void;
  menuId?: string;
  menuDisabled?: boolean;
}

/** Common document actions; specialist editing controls belong to the inspector. */
export function EditorToolbar(props: EditorToolbarProps) {
  const bar = useRef<HTMLDivElement>(null);
  // Reset is confirmed first; once done, a visible notice offers Undo until the next change (U25).
  // The notice follows events, not names: it opens when a reset step is newly made (a new step clears Redo)
  // and closes on the next undo, redo or change, or when dismissed.
  // Redoing a reset is not a new reset: Redo offered that step a moment ago.
  const [tracked, setTracked] = useState({ undo: props.undoLabel, redo: props.redoLabel });
  const [noticeOpen, setNoticeOpen] = useState(false);
  if (tracked.undo !== props.undoLabel || tracked.redo !== props.redoLabel) {
    setTracked({ undo: props.undoLabel, redo: props.redoLabel });
    if (tracked.undo !== props.undoLabel)
      setNoticeOpen(isResetStep(props.undoLabel) && !props.canRedo && tracked.redo !== props.undoLabel);
  }
  const focusAfterNotice = useRef(false);
  useEffect(() => {
    if (noticeOpen || !focusAfterNotice.current) return;
    focusAfterNotice.current = false;
    // The notice's buttons are gone, so keep focus in the toolbar: Undo if it can still act, else Reset.
    const undo = bar.current?.querySelector<HTMLButtonElement>('button[aria-label="Undo"]:not(:disabled)');
    (undo ?? bar.current?.querySelector<HTMLButtonElement>(".reset-button"))?.focus();
  }, [noticeOpen]);
  const closeNotice = () => {
    focusAfterNotice.current = true;
    setNoticeOpen(false);
  };
  useLayoutEffect(() => {
    const element = bar.current;
    const parent = element?.parentElement;
    if (!element || !parent) return;
    const measure = () => {
      parent.style.setProperty(
        "--editor-toolbar-height",
        `${element.getBoundingClientRect().height}px`,
      );
      const stage = parent.querySelector<HTMLElement>(
        ".bm-scroll,.graph-stage,.ratio-stage,.tr-scroll,.ag-scroll,.vn-scroll,.nl-scroll,.cb-scroll,.vg-scroll",
      );
      if (!stage?.clientWidth) return;
      const top = stage.getBoundingClientRect().top + window.scrollY;
      parent.style.setProperty(
        "--resource-stage-height",
        `${Math.max(320, window.innerHeight - top - 20)}px`,
      );
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    observer.observe(parent);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);
  return (
    <div
      ref={bar}
      className="editor-toolbar"
      role="group"
      aria-label="Resource utilities"
    >
      <div className="tool-group" role="group" aria-label="History and reset">
        <HistoryButtons
          canUndo={props.canUndo}
          canRedo={props.canRedo}
          onUndo={props.onUndo}
          onRedo={props.onRedo}
          undoLabel={props.undoLabel}
          redoLabel={props.redoLabel}
        />
        <button
          className="tool-button reset-button"
          disabled={props.resetDisabled}
          aria-label={props.resetLabel ?? "Reset"}
          onClick={props.onReset}
        >
          <RotateCcw size={17} aria-hidden="true" />
          <span>Reset</span>
        </button>
      </div>
      <div
        className="editor-copy-actions"
        // Export intent: fetch the print fonts before the click (U57).
        onPointerEnter={preloadExportFonts}
        onFocus={preloadExportFonts}
      >
        <button
          className="copy-main clipboard-copy"
          disabled={props.exportDisabled || props.busy}
          title="Copy the resource as an image"
          onClick={props.onCopyClipboard}
        >
          <Copy size={17} aria-hidden="true" />
          Copy image
        </button>
        <div className="editor-file-actions">
          <button
            className="copy-main"
            disabled={props.exportDisabled || props.busy}
            title="Copy a print-quality image at its physical size for Word"
            onClick={props.onCopy}
          >
            {props.busy ? (
              <LoaderCircle className="spin" size={17} aria-hidden="true" />
            ) : (
              <Copy size={17} aria-hidden="true" />
            )}
            {props.busy ? "Preparing…" : "Copy for Word"}
          </button>
          <button
            className="file-menu-button"
            disabled={
              (props.menuDisabled ?? props.exportDisabled) || props.busy
            }
            aria-label="File"
            aria-haspopup="menu"
            aria-expanded={props.menuOpen}
            aria-controls={props.menuId}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                event.preventDefault();
                event.currentTarget.dataset.menuFocus =
                  event.key === "ArrowUp" ? "last" : "first";
                if (!props.menuOpen) props.onToggleMenu();
              }
              if (event.key === "Enter" || event.key === " ")
                event.currentTarget.dataset.menuFocus = "first";
            }}
            onClick={props.onToggleMenu}
          >
            File <ChevronDown size={16} aria-hidden="true" />
          </button>
        </div>
      </div>
      {/* Always mounted, so screen readers announce the text when it appears. */}
      <div className="editor-reset-status" role="status">
        {noticeOpen && (
          <div className="editor-reset-notice">
            <span>Resource reset.</span>
            <button
              type="button"
              className="editor-reset-undo"
              disabled={!props.canUndo}
              onClick={() => {
                closeNotice();
                props.onUndo();
              }}
            >
              Undo reset
            </button>
            <button
              type="button"
              className="editor-reset-close"
              aria-label="Dismiss reset notice"
              onClick={closeNotice}
            >
              <X size={15} aria-hidden="true" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
