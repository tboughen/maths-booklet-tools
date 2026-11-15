import { copyStorageKey } from "../site/copyDocument";
import { cloneDefaultDocument, STORAGE_KEY } from "./diagram";
import { isDiagramDocument } from "../../packages/graph-core/src/legacy-validation";
import { validateEnvelope } from "../../packages/graph-core/src/interchange";
import { graphDocument, graphEnvelope, type GraphDocument, type SavedGraphDocument } from "./graphAbout";
export { isDiagramDocument } from "../../packages/graph-core/src/legacy-validation";
export const ENVELOPE_STORAGE_KEY = copyStorageKey(
  "maths-booklet-tools:graph-envelope:v1",
);
export function loadDiagramRecovery(newDocument: () => GraphDocument = () => ({ ...cloneDefaultDocument(), selectedObjectId: null })): {
  document: GraphDocument;
  conflict: boolean;
} {
  if (typeof localStorage === "undefined")
    return { document: newDocument(), conflict: false };
  let conflict = false;
  try {
    const envelope = localStorage.getItem(ENVELOPE_STORAGE_KEY);
    if (envelope !== null) {
      try {
        return {
          document: graphDocument(validateEnvelope(JSON.parse(envelope))),
          conflict: false,
        };
      } catch {
        conflict = true;
      }
    }
    const legacy = localStorage.getItem(STORAGE_KEY);
    if (legacy) {
      const parsed: unknown = JSON.parse(legacy);
      if (isDiagramDocument(parsed)) return { document: { ...parsed, selectedObjectId: null }, conflict };
    }
  } catch {
    /* Keep unreadable or inaccessible data untouched. */
  }
  return { document: newDocument(), conflict };
}
export function loadDiagram(): GraphDocument {
  return loadDiagramRecovery().document;
}
export function saveDiagram(document: SavedGraphDocument): void {
  if (typeof localStorage === "undefined") return;
  if (loadDiagramRecovery().conflict)
    throw Error("Review local graph recovery before saving.");
  localStorage.setItem(
    ENVELOPE_STORAGE_KEY,
    JSON.stringify(graphEnvelope(document)),
  );
}
export function acknowledgeRecovery(document: SavedGraphDocument): void {
  const raw = localStorage.getItem(ENVELOPE_STORAGE_KEY);
  if (raw !== null)
    localStorage.setItem(
      `${ENVELOPE_STORAGE_KEY}:recovery:${Date.now()}:${crypto.randomUUID()}`,
      raw,
    );
  localStorage.setItem(
    ENVELOPE_STORAGE_KEY,
    JSON.stringify(graphEnvelope(document)),
  );
}
export function clearSavedDiagram(): void {
  if (typeof localStorage !== "undefined") {
    if (loadDiagramRecovery().conflict)
      throw Error("Review local graph recovery before resetting.");
    localStorage.removeItem(ENVELOPE_STORAGE_KEY);
  }
}
