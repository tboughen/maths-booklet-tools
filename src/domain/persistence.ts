import { cloneDefaultDocument, STORAGE_KEY } from "./diagram";
import type { DiagramDocumentV1 } from "./types";
import { isDiagramDocument } from "../../packages/graph-core/src/legacy-validation";
import {
  createEnvelope,
  documentFromEnvelope,
  validateEnvelope,
} from "../../packages/graph-core/src/interchange";
export { isDiagramDocument } from "../../packages/graph-core/src/legacy-validation";
export const ENVELOPE_STORAGE_KEY = "maths-booklet-tools:graph-envelope:v1";
export function loadDiagramRecovery(): {
  document: DiagramDocumentV1;
  conflict: boolean;
} {
  if (typeof localStorage === "undefined")
    return { document: cloneDefaultDocument(), conflict: false };
  let conflict = false;
  try {
    const envelope = localStorage.getItem(ENVELOPE_STORAGE_KEY);
    if (envelope !== null) {
      try {
        return {
          document: documentFromEnvelope(
            validateEnvelope(JSON.parse(envelope)),
          ),
          conflict: false,
        };
      } catch {
        conflict = true;
      }
    }
    const legacy = localStorage.getItem(STORAGE_KEY);
    if (legacy) {
      const parsed: unknown = JSON.parse(legacy);
      if (isDiagramDocument(parsed)) return { document: parsed, conflict };
    }
  } catch {
    /* Keep unreadable or inaccessible data untouched. */
  }
  return { document: cloneDefaultDocument(), conflict };
}
export function loadDiagram(): DiagramDocumentV1 {
  return loadDiagramRecovery().document;
}
export function saveDiagram(document: DiagramDocumentV1): void {
  if (typeof localStorage === "undefined") return;
  if (loadDiagramRecovery().conflict)
    throw Error("Review local graph recovery before saving.");
  localStorage.setItem(
    ENVELOPE_STORAGE_KEY,
    JSON.stringify(createEnvelope(document, false)),
  );
}
export function acknowledgeRecovery(document: DiagramDocumentV1): void {
  const raw = localStorage.getItem(ENVELOPE_STORAGE_KEY);
  if (raw !== null)
    localStorage.setItem(
      `${ENVELOPE_STORAGE_KEY}:recovery:${Date.now()}:${crypto.randomUUID()}`,
      raw,
    );
  localStorage.setItem(
    ENVELOPE_STORAGE_KEY,
    JSON.stringify(createEnvelope(document, false)),
  );
}
export function clearSavedDiagram(): void {
  if (typeof localStorage !== "undefined") {
    if (loadDiagramRecovery().conflict)
      throw Error("Review local graph recovery before resetting.");
    localStorage.removeItem(ENVELOPE_STORAGE_KEY);
  }
}
