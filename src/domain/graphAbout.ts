/**
 * The graph editor keeps a document, not an envelope, so its title and note (U34) ride on the document as
 * `about` and move to the envelope's top level whenever the graph is saved, linked or stored. Every save in
 * the graph editor goes through `graphEnvelope`, so opening a file and saving it again keeps both.
 */
import { aboutOf, type About } from "../../packages/envelope-core/src/about";
import { createEnvelope, documentFromEnvelope, type GraphEnvelope } from "../../packages/graph-core/src/interchange";
import type { DiagramDocumentV1 } from "../../packages/graph-core/src/types";

export type GraphDocument = DiagramDocumentV1 & { about?: About };

export function graphEnvelope(document: GraphDocument, clearSelection = true): GraphEnvelope {
  const { about, ...drawing } = document;
  return { ...createEnvelope(drawing, clearSelection), ...aboutOf(about) };
}

export function graphDocument(envelope: GraphEnvelope): GraphDocument {
  const document: GraphDocument = documentFromEnvelope(envelope);
  const about = aboutOf(envelope);
  if (about.title !== undefined || about.note !== undefined) document.about = about;
  return document;
}
