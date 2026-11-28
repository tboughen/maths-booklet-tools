import { FAMILIES, type DiagramKind } from "../../packages/diagram-core/src/registry";
import { diagramEnvelope } from "../../packages/resource-core/src/schema";
import { siteBase } from "../site/routes";

/**
 * Editing a booklet card's diagram in its own MathsDock tool (booklet editor stage 4, Tim 28 Nov 2026).
 * The tool opens in a dialog as a separate copy (?resourceCopy=<id>, the same copies worked documents use), so the
 * teacher's own work in that tool is never touched. The Booklet builder writes the diagram into the copy's storage,
 * the tool edits it there with its own autosave, and Done reads it back and checks it with the family's validator.
 *
 * Each key is the base the tool's page passes to copyStorageKey (diagramTools.test.ts checks every page still uses it).
 */
export const TOOL_STORAGE: Record<DiagramKind, string> = {
  graph: "maths-booklet-tools:graph-envelope:v1",
  "ratio-table": "maths-booklet-tools:ratio-table-envelope:v1",
  "value-graph": "mathsdock:value-table-graph:v1",
  cuboids: "maths-booklet-tools:cuboids:v1",
  "number-line": "maths-booklet-tools:number-line:v1",
  venn: "maths-booklet-tools:venn:v1",
  "algebra-grid": "maths-booklet-tools:algebra-grid:v1",
  "bar-model": "maths-booklet-tools:bar-model:v2",
  charts: "maths-booklet-tools:charts:v1",
  "probability-tree": "maths-booklet-tools:probability-tree:v1",
  "frequency-tree": "maths-booklet-tools:frequency-tree:v1",
  "two-way-table": "maths-booklet-tools:two-way-table:v1",
  "factor-tree": "maths-booklet-tools:factor-tree:v1",
  "function-machine": "maths-booklet-tools:function-machine:v1",
  "bubble-method": "maths-booklet-tools:bubble-method:v1",
  "probability-objects": "maths-booklet-tools:probability-objects:v1",
  nets: "maths-booklet-tools:nets:v1",
  "written-method": "maths-booklet-tools:written-method:v1",
  "algebra-tiles": "maths-booklet-tools:algebra-tiles:v1",
  "sample-space": "maths-booklet-tools:sample-space:v1",
  triangle: "maths-booklet-tools:triangle:v1",
  construction: "maths-booklet-tools:construction:v1",
  elevations: "maths-booklet-tools:elevations:v1",
  angles: "maths-booklet-tools:angles:v1",
  area: "maths-booklet-tools:area:v1",
  figures: "maths-booklet-tools:figures:v1",
  solids: "maths-booklet-tools:solids:v1",
};

/** A new diagram of the family, as its tool would start one: the graph needs its list of objects, every other family starts from an empty spec. */
export const freshDiagram = (kind: DiagramKind) => FAMILIES[kind].create({ spec: kind === "graph" ? { objects: [] } : {} });

/** The bar model page keeps its envelope in a versioned record; every other tool stores the envelope itself. */
const toStored = (kind: DiagramKind, envelope: unknown) => JSON.stringify(kind === "bar-model" ? { storageVersion: 1, envelope } : envelope);
function fromStored(kind: DiagramKind, raw: string): unknown {
  const parsed: unknown = JSON.parse(raw);
  if (kind !== "bar-model") return parsed;
  const record = parsed as { storageVersion?: unknown; envelope?: unknown } | null;
  if (record?.storageVersion !== 1) throw Error("The bar model was saved in a form this page cannot read.");
  return record.envelope;
}

/** Copies the Booklet builder has open, with when each opened, so a tab closed mid-edit leaves nothing for long. */
const OPEN_COPIES = "maths-booklet-tools:booklet:diagram-copies";
const DAY = 24 * 60 * 60 * 1000;
function openCopies(): Record<string, number> {
  try {
    const list: unknown = JSON.parse(localStorage.getItem(OPEN_COPIES) ?? "{}");
    return list && typeof list === "object" && !Array.isArray(list) ? (list as Record<string, number>) : {};
  } catch {
    return {};
  }
}
function noteCopy(key: string, open: boolean) {
  const list = openCopies();
  if (open) list[key] = Date.now();
  else delete list[key];
  if (Object.keys(list).length) localStorage.setItem(OPEN_COPIES, JSON.stringify(list));
  else localStorage.removeItem(OPEN_COPIES);
}
/** Remove copies left by a booklet tab that closed with the dialog open, once they are a day old (another tab may still be editing a newer one). */
export function sweepDiagramCopies(now = Date.now()) {
  try {
    for (const [key, at] of Object.entries(openCopies())) {
      if (!(now - at < DAY) && /:worked:[a-f0-9-]{36}$/.test(key)) {
        localStorage.removeItem(key);
        noteCopy(key, false);
      }
    }
  } catch {
    // No storage: nothing was left behind.
  }
}

export interface DiagramCopy {
  kind: DiagramKind;
  key: string;
  /** What was written, so Done can tell whether the tool changed anything. */
  seeded: string;
  /** The tool's page for this copy, shown without the site's header. */
  href: string;
}

/** Write the diagram into a fresh copy of its tool. Throws when the browser keeps no storage. */
export function openDiagramCopy(kind: DiagramKind, envelope: unknown): DiagramCopy {
  const id = crypto.randomUUID();
  const key = `${TOOL_STORAGE[kind]}:worked:${id}`;
  const seeded = toStored(kind, envelope);
  noteCopy(key, true);
  localStorage.setItem(key, seeded);
  const url = new URL(siteBase() + FAMILIES[kind].route.replace(/^\//, ""), location.origin);
  url.searchParams.set("resourceCopy", id);
  url.searchParams.set("embed", "booklet");
  return { kind, key, seeded, href: url.pathname + url.search };
}

/**
 * The diagram as the tool left it: null when nothing changed, the checked envelope otherwise. Throws with the
 * family's own message when the tool holds something a booklet cannot print (for example an unfinished draft).
 */
export function readDiagramCopy(copy: DiagramCopy): unknown | null {
  const raw = localStorage.getItem(copy.key);
  if (raw === null) throw Error("The diagram's copy was not found. Close this and open the diagram again.");
  if (raw === copy.seeded) return null;
  const envelope = fromStored(copy.kind, raw);
  // Both copies must print: the pupil copy and, for families with one, the answers copy.
  diagramEnvelope({ tool: copy.kind, envelope });
  return envelope;
}

/** Forget the copy once the dialog closes. */
export function closeDiagramCopy(copy: DiagramCopy) {
  try {
    localStorage.removeItem(copy.key);
    noteCopy(copy.key, false);
  } catch {
    // Storage went away: nothing is left to tidy.
  }
}
