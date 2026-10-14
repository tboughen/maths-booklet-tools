import {
  ChevronDown,
  Copy,
  LoaderCircle,
  Redo2,
  RotateCcw,
  Undo2,
} from "lucide-react";

interface EditorToolbarProps {
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onReset: () => void;
  resetLabel?: string;
  resetDisabled?: boolean;
  exportDisabled?: boolean;
  busy?: boolean;
  onCopy: () => void;
  menuOpen: boolean;
  onToggleMenu: () => void;
}

/** Common document actions; specialist editing controls belong to the inspector. */
export function EditorToolbar(props: EditorToolbarProps) {
  return (
    <div
      className="editor-toolbar"
      role="group"
      aria-label="Resource utilities"
    >
      <div className="tool-group" role="group" aria-label="History and reset">
        <button
          className="icon-button"
          disabled={!props.canUndo}
          aria-label="Undo"
          title="Undo (Ctrl+Z)"
          onClick={props.onUndo}
        >
          <Undo2 size={18} aria-hidden="true" />
        </button>
        <button
          className="icon-button"
          disabled={!props.canRedo}
          aria-label="Redo"
          title="Redo (Ctrl+Y)"
          onClick={props.onRedo}
        >
          <Redo2 size={18} aria-hidden="true" />
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
      <div className="copy-split">
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
          className="copy-more"
          disabled={props.exportDisabled || props.busy}
          aria-label="Download options"
          aria-haspopup="menu"
          aria-expanded={props.menuOpen}
          onClick={props.onToggleMenu}
        >
          <ChevronDown size={16} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
