import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { HistoryButtons } from "./HistoryButtons";

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
  /** `history.resetStep`: set while the latest event is a newly made Reset step (U25). */
  resetStep?: number;
  /** False while the page is switched away from; the reset notice closes then. */
  active?: boolean;
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
  return (
    <>
      <Toolbar {...props} />
      {/* Out of sight beside the settings until a keyboard reaches it: one press skips the diagram's many targets. */}
      <button
        type="button"
        className="editor-inspector-link"
        onClick={(event) => {
          const inspector = event.currentTarget.closest(".workspace")?.querySelector<HTMLElement>(".inspector-stack");
          if (inspector) {
            inspector.tabIndex = -1;
            inspector.focus();
            inspector.scrollIntoView({ block: "start", behavior: "auto" });
          }
        }}
      >
        Edit settings ↓
      </button>
    </>
  );
}

function Toolbar(props: EditorToolbarProps) {
  const bar = useRef<HTMLDivElement>(null);
  // Reset is confirmed first; once done, a visible notice offers Undo until the next change (U25).
  // The history marks a newly recorded reset step with its own number and clears it on the next undo, redo or
  // change, so the notice opens for each new reset and never for an undo or redo that lands on one.
  // Seeded with no reset, so a toolbar that mounts just after one (a page swapping its editor) still shows it.
  const [trackedReset, setTrackedReset] = useState<number | undefined>();
  const [noticeOpen, setNoticeOpen] = useState(false);
  if (trackedReset !== props.resetStep) {
    setTrackedReset(props.resetStep);
    setNoticeOpen(props.resetStep !== undefined);
  }
  // A page that is switched away from closes its notice, so it is not waiting there on return.
  if (noticeOpen && props.active === false) setNoticeOpen(false);
  // Set when the notice closes with focus inside it (by its buttons, a key, a later step or a page switch).
  const focusAfterNotice = useRef(false);
  useEffect(() => {
    if (noticeOpen || !focusAfterNotice.current) return;
    focusAfterNotice.current = false;
    // The notice's buttons are gone, so keep focus in the toolbar: Undo if it can still act, else Reset.
    const undo = bar.current?.querySelector<HTMLButtonElement>('button[aria-label="Undo"]:not(:disabled)');
    (undo ?? bar.current?.querySelector<HTMLButtonElement>(".reset-button"))?.focus();
  }, [noticeOpen]);
  const closeNotice = () => setNoticeOpen(false);
  useLayoutEffect(() => {
    const element = bar.current;
    const parent = element?.parentElement;
    if (!element || !parent) return;
    const measure = () => {
      parent.style.setProperty(
        "--editor-toolbar-height",
        `${element.getBoundingClientRect().height}px`,
      );
      const stage = parent.querySelector<HTMLElement>(":scope > .editor-stage");
      if (!stage?.clientWidth) return;
      const top = stage.getBoundingClientRect().top + window.scrollY;
      // On a window too short for the editor frame, the stage and the foot strip under it end
      // together just above the foot of the window. Rows a tool keeps under the strip follow on,
      // as they always have: counting them here would squeeze the diagram on a laptop.
      const foot = parent.querySelector<HTMLElement>(":scope > .editor-foot");
      parent.style.setProperty(
        "--resource-stage-height",
        `${Math.max(320, window.innerHeight - top - (foot?.offsetHeight ?? 0) - 20)}px`,
      );
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    observer.observe(parent);
    const foot = parent.querySelector(":scope > .editor-foot");
    if (foot) observer.observe(foot);
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
      {/* The live region is always mounted, so screen readers announce the notice when it appears. */}
      <div className="editor-reset-status" aria-live="polite">
        {noticeOpen && (
          <ResetNotice
            canUndo={props.canUndo}
            onUndo={() => {
              closeNotice();
              props.onUndo();
            }}
            onDismiss={closeNotice}
            onCloseWithFocus={() => (focusAfterNotice.current = true)}
          />
        )}
      </div>
    </div>
  );
}

/** "Resource reset. Undo reset" (U25). Says, as it closes, whether focus was inside it. */
function ResetNotice(props: { canUndo: boolean; onUndo: () => void; onDismiss: () => void; onCloseWithFocus: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  const latest = useRef(props.onCloseWithFocus);
  latest.current = props.onCloseWithFocus;
  // Runs before React removes the buttons, while the focused one is still in the document.
  useLayoutEffect(() => {
    const element = box.current;
    return () => {
      if (element?.contains(document.activeElement)) latest.current();
    };
  }, []);
  return (
    <div ref={box} className="editor-reset-notice">
      <span>Resource reset.</span>
      <button type="button" className="editor-reset-undo" disabled={!props.canUndo} onClick={props.onUndo}>
        Undo reset
      </button>
      <button type="button" className="editor-reset-close" aria-label="Dismiss reset notice" onClick={props.onDismiss}>
        <X size={15} aria-hidden="true" />
      </button>
    </div>
  );
}
