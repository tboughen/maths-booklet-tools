import { useEffect, useRef, useState } from "react";
import {
  createEnvelope,
  decodeEnvelope,
  documentFromEnvelope,
  editorLink,
  MAX_FILE_BYTES,
  MAX_LINK_LENGTH,
  GraphError,
  parseGraphFile,
} from "../../packages/graph-core/src/interchange";
import type { GraphEnvelope } from "../../packages/graph-core/src/interchange";
import { renderDiagramSvg } from "../export/svg";
import type { DiagramDocumentV1 } from "../domain/types";
import { downloadBlob } from "../export/clipboard";

export function GraphExchange({
  document,
  onImport,
  onClose,
  onMessage,
  visible,
  enabled = true,
}: {
  document: DiagramDocumentV1;
  onImport: (d: DiagramDocumentV1) => void;
  onClose: () => void;
  onMessage: (message: string, error?: boolean) => void;
  visible: boolean;
  enabled?: boolean;
}) {
  const file = useRef<HTMLInputElement>(null);
  const dialog = useRef<HTMLElement>(null);
  const [pending, setPending] = useState<GraphEnvelope | null>(null);
  const [fromLink, setFromLink] = useState(false);
  useEffect(() => {
    function inspectLink() {
      if (!enabled) return;
      if (!location.hash.startsWith("#graph=")) return;
      try {
        if (location.href.length > MAX_LINK_LENGTH)
          throw Error(
            "This graph link is too large. Open the editable JSON file instead.",
          );
        setPending(decodeEnvelope(location.hash.slice(7)));
        setFromLink(true);
      } catch (error) {
        onMessage(
          error instanceof GraphError && error.code === "invalid_graph"
            ? "This link is not a supported editable graph."
            : error instanceof Error
              ? error.message
              : "The graph link cannot be read.",
          true,
        );
      }
    }
    inspectLink();
    window.addEventListener("hashchange", inspectLink);
    return () => window.removeEventListener("hashchange", inspectLink);
  }, [onMessage, enabled]);
  useEffect(() => {
    if (!pending || !enabled) return;
    const previous = documentActiveElement();
    const buttons =
      dialog.current?.querySelectorAll<HTMLButtonElement>("button");
    buttons?.[0]?.focus();
    function keys(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setPending(null);
        if (fromLink)
          window.history.replaceState(
            null,
            "",
            location.pathname + location.search,
          );
        setFromLink(false);
      }
      if (event.key === "Tab" && buttons?.length) {
        const first = buttons[0],
          last = buttons[buttons.length - 1];
        if (event.shiftKey && documentActiveElement() === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && documentActiveElement() === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }
    window.addEventListener("keydown", keys);
    return () => {
      window.removeEventListener("keydown", keys);
      if (previous instanceof HTMLElement) previous.focus();
    };
  }, [pending, fromLink, enabled]);
  function removeFragment() {
    if (fromLink)
      window.history.replaceState(
        null,
        "",
        location.pathname + location.search,
      );
    setFromLink(false);
  }
  async function openFile(selected: File | undefined) {
    if (!selected) return;
    try {
      if (selected.size > MAX_FILE_BYTES)
        throw Error("Choose a graph JSON smaller than 1 MiB.");
      setPending(parseGraphFile(await selected.text()));
      setFromLink(false);
    } catch (error) {
      onMessage(
        error instanceof GraphError && error.code === "invalid_graph"
          ? "Choose a supported editable graph JSON file."
          : error instanceof Error
            ? error.message
            : "The graph file cannot be read.",
        true,
      );
    }
    if (file.current) file.current.value = "";
  }
  return (
    <>
      <input
        ref={file}
        className="sr-only"
        type="file"
        accept=".json,application/json"
        aria-label="Open editable graph file"
        onChange={(event) => void openFile(event.currentTarget.files?.[0])}
      />
      {visible && (
        <div
          className="graph-exchange-menu"
          role="menu"
          aria-label="Editable graph actions"
        >
          <button
            role="menuitem"
            onClick={() => {
              downloadBlob(
                new Blob([JSON.stringify(createEnvelope(document), null, 2)], {
                  type: "application/json",
                }),
                "maths-graph.json",
              );
              onClose();
            }}
          >
            Save editable graph
          </button>
          <button role="menuitem" onClick={() => file.current?.click()}>
            Open saved graph
          </button>
          <button
            role="menuitem"
            onClick={() =>
              void (async () => {
                try {
                  await navigator.clipboard.writeText(
                    editorLink(createEnvelope(document), location.href),
                  );
                  onMessage(
                    "Editable link copied. Anyone with the link can open this graph.",
                  );
                  onClose();
                } catch (error) {
                  onMessage(
                    error instanceof Error
                      ? error.message
                      : "Copying links is unavailable. Save editable graph instead.",
                    true,
                  );
                }
              })()
            }
          >
            Copy editable link
          </button>
          <button
            role="menuitem"
            onClick={() => {
              onImport({
                ...document,
                styleProfile:
                  document.styleProfile === "portable-v1"
                    ? "legacy"
                    : "portable-v1",
              });
              onClose();
            }}
          >
            {document.styleProfile === "portable-v1"
              ? "Use original graph font"
              : "Use portable graph font"}
          </button>
        </div>
      )}
      {pending && enabled && (
        <div className="word-help-backdrop">
          <section
            ref={dialog}
            className="word-help-dialog graph-import-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="graph-import-title"
          >
            <h2 id="graph-import-title">Open this graph?</h2>
            <p>
              Your current graph stays unchanged until you open this one. You
              can undo the import.
            </p>
            <div
              className="graph-import-preview"
              dangerouslySetInnerHTML={{
                __html: renderDiagramSvg(documentFromEnvelope(pending)),
              }}
            />
            <div className="graph-import-actions">
              <button
                autoFocus
                onClick={() => {
                  setPending(null);
                  removeFragment();
                }}
              >
                Cancel
              </button>
              <button
                className="word-help-done"
                onClick={() => {
                  onImport(documentFromEnvelope(pending));
                  setPending(null);
                  removeFragment();
                  onClose();
                }}
              >
                Open this graph
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
function documentActiveElement() {
  return globalThis.document.activeElement;
}
