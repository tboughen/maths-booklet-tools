/**
 * The one table of every diagram family's schema versions and explicit upgrades (improvement list
 * A11 and W98). Saved-file compatibility is a test, not a review rule: migrations.test.ts checks
 * every readable version against the golden corpus in packages/envelope-core/fixtures/corpus,
 * and every upgrade against every corpus file of its starting version.
 *
 * "readable" lists every schemaVersion the family's validate() accepts; a version in it stays
 * readable and printable, unchanged, for as long as it is listed. "issued" lists the versions new
 * diagrams can still be created in. Some families choose the version from the content (a ratio
 * table with two columns is schema 1, with one or three it is schema 2; a triangle with area labels
 * is schema 2), so both versions are current and there is no upgrade between them.
 *
 * Adding a schema version: add it to readable (and issued), add the migration from the previous
 * version here, and add at least one saved file of the new version to the corpus.
 */
import { migrationPath, runMigrations, type Migration } from "../../envelope-core/src/migrations";
import { DIAGRAM_KINDS, FAMILIES, type DiagramKind } from "./registry";
import * as barV2 from "../../bar-model-core/src/v2";
import * as barV3 from "../../bar-model-core/src/v3";
import type * as barV1 from "../../bar-model-core/src/index";
import * as cuboid from "../../cuboid-core/src/index";
import * as venn from "../../venn-core/src/index";

export interface SchemaVersions {
  readable: readonly number[];
  issued: readonly number[];
  /** Why more than one version is issued, when it is. */
  note?: string;
}

export const SCHEMA_VERSIONS: Record<DiagramKind, SchemaVersions> = {
  graph: { readable: [1], issued: [1] },
  "ratio-table": { readable: [1, 2], issued: [1, 2], note: "Two columns save as schema 1; one or three columns save as schema 2. Adding or removing a column moves between them." },
  "value-graph": { readable: [1], issued: [1] },
  cuboids: { readable: [1, 2], issued: [2], note: "New diagrams are schema 2. A schema 1 file stays schema 1 when revised until upgrade_document is asked for." },
  "number-line": { readable: [1], issued: [1] },
  venn: { readable: [1, 2], issued: [2], note: "New diagrams are schema 2. A schema 1 file stays schema 1 when revised until upgrade_document is asked for." },
  "algebra-grid": { readable: [1], issued: [1] },
  "bar-model": { readable: [1, 2, 3], issued: [1, 2, 3], note: "A request without schemaVersion stays schema 1; schema 3 is recommended for new resources." },
  charts: { readable: [1], issued: [1] },
  "probability-tree": { readable: [1], issued: [1] },
  "frequency-tree": { readable: [1], issued: [1] },
  triangle: { readable: [1, 2], issued: [1, 2], note: "Area labels need schema 2; other triangles save as schema 1." },
};

export const MIGRATIONS: readonly Migration[] = [
  {
    kind: "bar-model",
    from: 1,
    to: 2,
    summary: "Moves a bar model to the lesson layout (schema 2): same bars, parts, labels and hidden answers, drawn with the lesson style.",
    migrate: (e) => barV2.upgrade(e as barV1.Envelope),
  },
  {
    kind: "bar-model",
    from: 2,
    to: 3,
    summary: "Moves a lesson bar model to schema 3: horizontal fractions in maths captions and 12 mm above, 3 mm below answer lines.",
    migrate: (e) => barV3.upgrade(e as barV2.Envelope),
  },
  {
    kind: "cuboids",
    from: 1,
    to: 2,
    summary: "Gives each shape its own face appearance (schema 2), keeping dimensions, labels and layout.",
    migrate: (e) => cuboid.upgrade(e as cuboid.Envelope),
  },
  {
    kind: "venn",
    from: 1,
    to: 2,
    summary: "Moves a Venn diagram to schema 2, which adds arrangements and captions; sets, labels, members and hidden answers are kept.",
    migrate: (e) => venn.upgrade(e as venn.Envelope),
  },
];

/** The schemaVersion of a saved envelope, or NaN when it has none. */
export const schemaVersionOf = (envelope: unknown) => Number((envelope as { schemaVersion?: unknown } | null)?.schemaVersion);

/**
 * Upgrades a saved envelope to a newer schema version on a teacher's explicit request. Returns the
 * new envelope, validated, and the steps taken so the editor can describe one undoable edit.
 */
export function upgradeEnvelope(kind: DiagramKind, envelope: unknown, to: number) {
  const from = schemaVersionOf(envelope);
  if (!SCHEMA_VERSIONS[kind].readable.includes(from)) throw Error(`This ${FAMILIES[kind].label} file has an unknown schema version.`);
  if (!SCHEMA_VERSIONS[kind].readable.includes(to)) throw Error(`A ${FAMILIES[kind].label} has no schema ${to}.`);
  const steps = migrationPath(MIGRATIONS, kind, from, to);
  const upgraded = FAMILIES[kind].validate(runMigrations(steps, FAMILIES[kind].validate(envelope, "pupil")), "pupil");
  return { envelope: upgraded, steps: steps.map((s) => ({ from: s.from, to: s.to, summary: s.summary })) };
}

/** Every family's versions and upgrades, for capabilities and documentation. */
export function versionTable() {
  return DIAGRAM_KINDS.map((kind) => ({
    kind,
    ...SCHEMA_VERSIONS[kind],
    upgrades: MIGRATIONS.filter((m) => m.kind === kind).map((m) => ({ from: m.from, to: m.to, summary: m.summary })),
  }));
}
