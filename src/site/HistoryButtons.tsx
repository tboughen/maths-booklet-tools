import { useId } from "react";
import { Redo2, Undo2 } from "lucide-react";
import { historyActionText } from "../editor-kit/labels";

/**
 * The Undo and Redo buttons every editor shows (U8). The accessible names stay "Undo" and "Redo"; the step
 * they would reverse or restore ("add row") is in the tooltip and the screen-reader description, and only
 * while the button can act.
 */
export function HistoryButtons(props: {
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  undoLabel?: string;
  redoLabel?: string;
}) {
  const ids = useId();
  const button = (action: "Undo" | "Redo") => {
    const undo = action === "Undo";
    const enabled = undo ? props.canUndo : props.canRedo;
    const text = historyActionText(action, enabled ? (undo ? props.undoLabel : props.redoLabel) : undefined);
    const id = `${ids}-${undo ? "undo" : "redo"}`;
    const Icon = undo ? Undo2 : Redo2;
    return (
      <button
        className="icon-button"
        disabled={!enabled}
        aria-label={action}
        aria-describedby={text !== action ? id : undefined}
        title={`${text} (${undo ? "Ctrl+Z" : "Ctrl+Y"})`}
        onClick={undo ? props.onUndo : props.onRedo}
      >
        <Icon size={18} aria-hidden="true" />
        {text !== action && (
          <span id={id} className="sr-only" data-history-step={undo ? "undo" : "redo"}>
            {text}
          </span>
        )}
      </button>
    );
  };
  return (
    <>
      {button("Undo")}
      {button("Redo")}
    </>
  );
}
