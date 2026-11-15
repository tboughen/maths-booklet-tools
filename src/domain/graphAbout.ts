/**
 * The graph editor keeps a document, not an envelope, so its title and note (U34) ride on the document as
 * `about` and move to the envelope's top level whenever the graph is saved, linked or stored. Every save in
 * the graph editor goes through `graphEnvelope`, so opening a file and saving it again keeps both. The
 * worked-solution notes (U116) ride with them the same way.
 */
import { aboutOf, type About } from "../../packages/envelope-core/src/about";
import { createEnvelope, documentFromEnvelope, type GraphEnvelope } from "../../packages/graph-core/src/interchange";
import type { DiagramDocumentV1 } from "../../packages/graph-core/src/types";
import type { WorkedNote } from "../../packages/envelope-core/src/worked";

export type GraphDocument = DiagramDocumentV1 & { about?: About };

export function graphEnvelope(document: GraphDocument, clearSelection = true): GraphEnvelope {
  const { about, ...drawing } = document;
  return { ...createEnvelope(drawing, clearSelection), ...aboutOf(about) };
}

export function graphDocument(envelope: GraphEnvelope): GraphDocument {
  const document: GraphDocument = documentFromEnvelope(envelope);
  const about = aboutOf(envelope);
  if (Object.keys(about).length) document.about = about;
  return document;
}

/** `document` with its title and note replaced (blank means none); its worked notes (U116) stay. */
export function withGraphAbout(document: GraphDocument, about: About): GraphDocument {
  const { about: old, ...drawing } = document;
  const next = aboutOf({ title: about.title, note: about.note, worked: old?.worked });
  return Object.keys(next).length ? { ...drawing, about: next } : drawing;
}

/** `document` with its worked notes (U116) replaced; an empty list removes them. */
export function withGraphWorked(document: GraphDocument, notes: readonly WorkedNote[]): GraphDocument {
  const { about: old, ...drawing } = document;
  const next = aboutOf({ title: old?.title, note: old?.note, worked: notes.length ? notes.map((n) => ({ ...n })) : undefined });
  return Object.keys(next).length ? { ...drawing, about: next } : drawing;
}
