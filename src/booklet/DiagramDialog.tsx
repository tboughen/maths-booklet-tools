import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { FAMILIES, type DiagramKind } from "../../packages/diagram-core/src/registry";
import { closeDiagramCopy, openDiagramCopy, readDiagramCopy, type DiagramCopy } from "./diagramTools";

/**
 * A card's diagram in its own MathsDock tool, over the booklet (stage 4 of the booklet editor). The tool edits a
 * separate copy; Done checks it and hands it back, and the card redraws at its print size. Cancel, Escape or the
 * close button leave the card as it was. If the diagram cannot go back, the dialog stays open with the reason, so
 * the teacher's edit in the tool is never thrown away.
 */
export function DiagramDialog({ kind, envelope, onDone, onClose }: { kind: DiagramKind; envelope: unknown; onDone: (envelope: unknown) => string; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const [copy, setCopy] = useState<DiagramCopy | null>(null);
  const [error, setError] = useState("");
  const [finishing, setFinishing] = useState(false);
  const live = useRef(true);
  const label = FAMILIES[kind].label;
  useEffect(() => {
    live.current = true;
    let made: DiagramCopy | null = null;
    try {
      made = openDiagramCopy(kind, envelope);
      setCopy(made);
    } catch (err) {
      setError(`The tool cannot open here: ${err instanceof Error ? err.message : String(err)}. If this browser keeps no data for this site, allow site data and try again.`);
    }
    const box = dialog.current;
    if (box && !box.open) box.showModal();
    return () => {
      live.current = false;
      if (box?.open) box.close();
      if (made) closeDiagramCopy(made);
    };
  }, [kind, envelope]);
  const close = () => {
    if (!finishing) onClose();
  };
  /** Words still in a field, or a field the tool marks as wrong, that the tool has not saved into the diagram. */
  const unfinished = () => {
    try {
      const doc = frame.current?.contentDocument;
      if (!doc) return false;
      // Leaving a field is how the tools take what was typed; Done is outside the tool's page, so leave it here.
      const active = doc.activeElement;
      if (active && active !== doc.body && typeof (active as HTMLElement).blur === "function") (active as HTMLElement).blur();
      return doc.querySelector('[aria-invalid="true"]') !== null;
    } catch {
      return false;
    }
  };
  // The graph and ratio table tools save a quarter of a second after the last change: ask the tool to save now
  // (they save on pagehide), then wait out that delay before reading the copy back.
  const done = async () => {
    if (!copy || finishing) return;
    setError("");
    setFinishing(true);
    const wrong = unfinished();
    try {
      frame.current?.contentWindow?.dispatchEvent(new Event("pagehide"));
    } catch {
      // A tool that has not loaded has nothing unsaved.
    }
    await new Promise((resolve) => window.setTimeout(resolve, 400));
    if (!live.current) return;
    setFinishing(false);
    if (wrong || unfinished()) {
      setError(`Finish or undo the entry the ${label} tool marks as wrong, then press Done.`);
      return;
    }
    let next: unknown;
    try {
      next = readDiagramCopy(copy);
    } catch (err) {
      setError(`The ${label} cannot go back in the card yet: ${err instanceof Error ? err.message : String(err)}`);
      return;
    }
    const problem = next === null ? "" : onDone(next);
    if (problem) setError(`The ${label} cannot go back in the card: ${problem}`);
    else onClose();
  };
  return (
    <dialog
      ref={dialog}
      className="bk-diagram-dialog"
      aria-label={`Edit the ${label}`}
      onKeyDown={(e) => e.key === "Escape" && e.stopPropagation()}
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
    >
      <header className="bk-diagram-head">
        <h2>Edit the {label}</h2>
        <p>Changes stay in this card. Your own work in the tool is not touched.</p>
        <button className="icon-button" aria-label="Close without changing the card" disabled={finishing} onClick={close}>
          <X size={18} aria-hidden="true" />
        </button>
      </header>
      {copy && <iframe ref={frame} className="bk-diagram-frame" title={`${label} tool`} src={copy.href} />}
      <footer className="bk-diagram-foot">
        {error && (
          <p className="ws-message" role="alert">
            {error}
          </p>
        )}
        <button className="tool-button" disabled={finishing} onClick={close}>
          Cancel
        </button>
        <button className="tool-button bk-diagram-done" disabled={!copy || finishing} onClick={() => void done()}>
          {finishing ? "Saving…" : "Done"}
        </button>
      </footer>
    </dialog>
  );
}
