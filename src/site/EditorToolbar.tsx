import { useId, useLayoutEffect, useRef, useState } from "react";
import { historyActionText, isResetStep } from "../editor-kit/labels";

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
  Redo2,
  RotateCcw,
  Undo2,
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
  const ids = useId();
  const undoText = historyActionText("Undo", props.canUndo ? props.undoLabel : undefined),
    redoText = historyActionText("Redo", props.canRedo ? props.redoLabel : undefined);
  // Reset is confirmed first; once done, a visible notice offers Undo until the next change (U25).
  const resetStep = props.canUndo && isResetStep(props.undoLabel);
  const [dismissedStep, setDismissedStep] = useState<string | undefined>();
  const noticeDismissed = dismissedStep === props.undoLabel;
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
        <button
          className="icon-button"
          disabled={!props.canUndo}
          aria-label="Undo"
          aria-describedby={undoText !== "Undo" ? `${ids}-undo` : undefined}
          title={`${undoText} (Ctrl+Z)`}
          onClick={props.onUndo}
        >
          <Undo2 size={18} aria-hidden="true" />
          {undoText !== "Undo" && (
            <span id={`${ids}-undo`} className="sr-only" data-history-step="undo">
              {undoText}
            </span>
          )}
        </button>
        <button
          className="icon-button"
          disabled={!props.canRedo}
          aria-label="Redo"
          aria-describedby={redoText !== "Redo" ? `${ids}-redo` : undefined}
          title={`${redoText} (Ctrl+Y)`}
          onClick={props.onRedo}
        >
          <Redo2 size={18} aria-hidden="true" />
          {redoText !== "Redo" && (
            <span id={`${ids}-redo`} className="sr-only" data-history-step="redo">
              {redoText}
            </span>
          )}
        </button>
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
      {resetStep && !noticeDismissed && (
        <div className="editor-reset-notice" role="status">
          <span>Resource reset.</span>
          <button type="button" className="editor-reset-undo" onClick={props.onUndo}>
            Undo reset
          </button>
          <button
            type="button"
            className="editor-reset-close"
            aria-label="Dismiss reset notice"
            onClick={() => setDismissedStep(props.undoLabel)}
          >
            <X size={15} aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
}
