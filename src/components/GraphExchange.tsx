import { pathLink } from "../site/routes";
import {
  EditorDownloadMenu,
  LINK_DESCRIPTION,
  type DownloadAction,
} from "../site/EditorDownloadMenu";
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
  imageActions,
  active = true,
  onBusyChange,
}: {
  document: DiagramDocumentV1;
  onImport: (d: DiagramDocumentV1) => void;
  onClose: () => void;
  onMessage: (message: string, error?: boolean) => void;
  visible: boolean;
  enabled?: boolean;
  imageActions: DownloadAction[];
  active?: boolean;
  onBusyChange: (busy: boolean) => void;
}) {
  const file = useRef<HTMLInputElement>(null);
  const available = useRef(enabled);
  available.current = enabled;
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
    if (!selected || !available.current) return;
    try {
      if (selected.size > MAX_FILE_BYTES)
        throw Error("Choose a graph JSON smaller than 1 MiB.");
      const incoming = parseGraphFile(await selected.text());
      if (!available.current)
        throw Error(
          "Apply or cancel unfinished input before opening another graph.",
        );
      onClose();
      setPending(incoming);
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
        hidden
        type="file"
        accept=".json,application/json"
        aria-label="Open editable graph file"
        disabled={!enabled}
        onChange={(event) => void openFile(event.currentTarget.files?.[0])}
      />
      <EditorDownloadMenu
        id="graph-downloads"
        open={visible}
        active={active}
        onClose={onClose}
        onBusyChange={onBusyChange}
        onMessage={onMessage}
        actions={[
          ...imageActions.filter(
            (item) => item.label !== "First-time Word setup",
          ),
          {
            label: "Save editable file",
            disabled: !enabled,
            separator: true,
            action: () => {
              if (!available.current)
                throw Error("Apply or cancel unfinished input first.");
              downloadBlob(
                new Blob([JSON.stringify(createEnvelope(document), null, 2)], {
                  type: "application/json",
                }),
                "maths-graph.json",
              );
            },
            success: "Editable file download started.",
          },
          {
            label: "Open editable file",
            disabled: !enabled,
            picker: true,
            action: () => {
              if (available.current) file.current?.click();
            },
          },
          {
            label: "Copy editable link",
            disabled: !enabled,
            description: LINK_DESCRIPTION,
            action: () => {
              if (!available.current)
                throw Error("Apply or cancel unfinished input first.");
              return navigator.clipboard.writeText(
                pathLink(editorLink(createEnvelope(document), location.href)),
              );
            },
            success: "Editable link copied.",
          },
          ...imageActions
            .filter((item) => item.label === "First-time Word setup")
            .map((item) => ({ ...item, separator: true })),
        ].filter(
          (item, index, items) =>
            items.findIndex((other) => other.label === item.label) === index,
        )}
      />
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
                  if (!available.current) return;
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
