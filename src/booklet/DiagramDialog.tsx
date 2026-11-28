import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { FAMILIES, type DiagramKind } from "../../packages/diagram-core/src/registry";
import { closeDiagramCopy, openDiagramCopy, readDiagramCopy, type DiagramCopy } from "./diagramTools";

/**
 * A card's diagram in its own MathsDock tool, over the booklet (stage 4 of the booklet editor). The tool edits a
 * separate copy; Done checks it and hands it back, and the card redraws at its print size. Cancel, Escape or the
 * close button leave the card as it was.
 */
export function DiagramDialog({ kind, envelope, onDone, onClose }: { kind: DiagramKind; envelope: unknown; onDone: (envelope: unknown) => void; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [copy, setCopy] = useState<DiagramCopy | null>(null);
  const [error, setError] = useState("");
  const [finishing, setFinishing] = useState(false);
  const frame = useRef<HTMLIFrameElement>(null);
  const label = FAMILIES[kind].label;
  useEffect(() => {
    let made: DiagramCopy | null = null;
    try {
      made = openDiagramCopy(kind, envelope);
      setCopy(made);
    } catch {
      setError("This browser is not keeping data for this site, so the tool cannot open here. Allow site data and try again.");
    }
    const box = dialog.current;
    if (box && !box.open) box.showModal();
    return () => {
      if (made) closeDiagramCopy(made);
    };
  }, [kind, envelope]);
  // The graph and ratio table tools save a quarter of a second after the last change: ask the tool to save now
  // (they save on pagehide), then wait out that delay before reading the copy back.
  const done = async () => {
    if (!copy) return onClose();
    setFinishing(true);
    try {
      frame.current?.contentWindow?.dispatchEvent(new Event("pagehide"));
    } catch {
      // A tool that has not loaded has nothing unsaved.
    }
    await new Promise((resolve) => window.setTimeout(resolve, 400));
    setFinishing(false);
    try {
      const next = readDiagramCopy(copy);
      if (next !== null) onDone(next);
      onClose();
    } catch (err) {
      setError(`The ${label} cannot go back in the card yet: ${err instanceof Error ? err.message : String(err)}`);
    }
  };
  return (
    <dialog
      ref={dialog}
      className="bk-diagram-dialog"
      aria-label={`Edit the ${label}`}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <header className="bk-diagram-head">
        <h2>Edit the {label}</h2>
        <p>Changes stay in this card. Your own work in the tool is not touched.</p>
        <button className="icon-button" aria-label="Close without changing the card" onClick={onClose}>
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
        <button className="tool-button" onClick={onClose}>
          Cancel
        </button>
        <button className="tool-button bk-diagram-done" disabled={!copy || finishing} onClick={() => void done()}>
          {finishing ? "Saving…" : "Done"}
        </button>
      </footer>
    </dialog>
  );
}
