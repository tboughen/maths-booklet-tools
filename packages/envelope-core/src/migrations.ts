/**
 * Explicit schema migrations (improvement list A11). A migration turns a saved envelope of one
 * schema version into the next. Rules every migration keeps:
 *
 *   - Pure: it never mutates its input and gives the same output for the same input.
 *   - Never automatic: reading a saved file never migrates it. A migration runs only when a teacher
 *     (or the AI, at a teacher's request) asks for the newer version, and the editor records it as
 *     one undoable edit.
 *   - Faithful: blanks, hidden answers, answer lines and exact values keep their meaning.
 *
 * The registry of which family has which versions and migrations is packages/diagram-core/src/migrations.ts.
 */

export interface Migration<From = unknown, To = unknown> {
  kind: string;
  from: number;
  to: number;
  /** What changes for the teacher, in one plain sentence. */
  summary: string;
  migrate(envelope: From): To;
}

/** The chain of migrations taking `kind` from version `from` to `to`, or an error if there is none. */
export function migrationPath(migrations: readonly Migration[], kind: string, from: number, to: number): Migration[] {
  if (from === to) return [];
  if (to < from) throw Error(`A ${kind} file cannot be moved back from schema ${from} to ${to}.`);
  const path: Migration[] = [];
  let at = from;
  while (at < to) {
    const step = migrations.find((m) => m.kind === kind && m.from === at);
    if (!step) throw Error(`There is no ${kind} upgrade from schema ${at}.`);
    path.push(step);
    at = step.to;
  }
  if (at !== to) throw Error(`There is no ${kind} upgrade path from schema ${from} to ${to}.`);
  return path;
}

/** Runs a migration chain on a copy of the envelope. */
export function runMigrations(path: readonly Migration[], envelope: unknown): unknown {
  return path.reduce((e, step) => step.migrate(e), structuredClone(envelope));
}
