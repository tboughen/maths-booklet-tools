/**
 * The graph editor keeps a document, not an envelope, so its title and note (U34) ride on the document as
 * `about` and move to the envelope's top level whenever the graph is saved, linked or stored. Every save in
 * the graph editor goes through `graphEnvelope`, so opening a file and saving it again keeps both. The
 * worked-solution notes (U116) ride with them the same way.
 */
import { aboutOf, type About } from "../../packages/envelope-core/src/about";
import { createEnvelope, documentFromEnvelope, type GraphEnvelope } from "../../packages/graph-core/src/interchange";
import type { GraphEditorDocument } from "../../packages/graph-core/src/types";
import type { WorkedNote } from "../../packages/envelope-core/src/worked";

/** The editor's document: the drawing, its selection (editor state, never saved: U35) and its title and note. */
export type GraphDocument = GraphEditorDocument & { about?: About };

/** A graph document as saved: everything but the editor's selection. */
export type SavedGraphDocument = Omit<GraphDocument, "selectedObjectId">;

export function graphEnvelope(document: SavedGraphDocument): GraphEnvelope {
  const { about, ...drawing } = document;
  return { ...createEnvelope(drawing), ...aboutOf(about) };
}

export function graphDocument(envelope: GraphEnvelope): GraphDocument {
  const document: GraphDocument = { ...documentFromEnvelope(envelope), selectedObjectId: null };
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
