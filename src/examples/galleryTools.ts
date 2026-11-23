import type { ToolId } from "../site/routes";

/**
 * The tool each gallery opens in, so the Diagram builder search can show examples from every tool
 * and open the right one. A new gallery needs its tool here (a test checks every gallery has one).
 */
export const galleryTools = {
  graphGallery: "graph",
  ratioTeachingGallery: "ratio-table",
  ratioGallery: "ratio-table",
  quadraticGallery: "value-table-graph",
  cuboidGallery: "cuboids",
  numberLineGallery: "number-line",
  vennGallery: "venn",
  triangleGallery: "triangle",
  algebraGallery: "expanding-factorising",
  barLessonGallery: "bar-model",
  chartGallery: "charts",
  treeGallery: "probability-tree",
  constructionGallery: "construction",
  elevationsGallery: "elevations",
  frequencyTreeGallery: "frequency-tree",
  twoWayTableGallery: "two-way-table",
  anglesGallery: "angles",
  areaGallery: "area",
  figuresGallery: "figures",
  solidsGallery: "solids",
  sampleSpaceGallery: "sample-space",
  factorTreeGallery: "factor-tree",
  functionMachineGallery: "function-machine",
  netsGallery: "nets",
  writtenMethodGallery: "written-method",
  probabilityObjectsGallery: "probability-objects",
  bubbleMethodGallery: "bubble-method",
  algebraTilesGallery: "algebra-tiles",
} satisfies Record<string, ToolId>;

/** Galleries no tool page shows (the bar-model editor uses its lesson gallery instead). */
export const unshownGalleries = ["barGallery"];

/** One example in the Diagram builder search index (src/examples/exampleIndex.json). */
export interface ExampleIndexEntry {
  id: string;
  title: string;
  description: string;
  tool: ToolId;
  plain?: true;
}

/** The search index, built from the galleries in the order above; an example in two galleries appears once. */
export function exampleIndex(galleries: Record<string, unknown>): ExampleIndexEntry[] {
  const seen = new Set<string>();
  const entries: ExampleIndexEntry[] = [];
  for (const [name, tool] of Object.entries(galleryTools)) {
    for (const example of (galleries[name] ?? []) as { id: string; title: string; description: string; plain?: boolean }[]) {
      if (seen.has(example.id)) continue;
      seen.add(example.id);
      entries.push({ id: example.id, title: example.title, description: example.description, tool, ...(example.plain ? { plain: true as const } : {}) });
    }
  }
  return entries;
}

/**
 * Examples whose title or description holds every word searched. Plain shapes come first, then
 * examples whose title holds every word, then the rest in gallery order.
 */
export function searchExamples(index: ExampleIndexEntry[], query: string): ExampleIndexEntry[] {
  const words = query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const rank = (e: ExampleIndexEntry) => (e.plain ? 0 : words.every((w) => e.title.toLocaleLowerCase().includes(w)) ? 1 : 2);
  return index
    .filter((e) => words.every((w) => `${e.title} ${e.description}`.toLocaleLowerCase().includes(w)))
    .map((e, order) => ({ e, order, rank: rank(e) }))
    .sort((a, b) => a.rank - b.rank || a.order - b.order)
    .map((r) => r.e);
}
