// Shared by the output gates: every gallery example, pupil and worked, rendered by the shared core
// renderers the exports use, and the physical size its SVG root declares.
import * as gallery from "../examples/galleryCatalogue";
import { svgPrintSize } from "../testing/print-size";

export type Entry = { id: string; make: (worked: boolean) => unknown; render: (r: never) => string; worked?: boolean };
export const galleries: Record<string, Entry[]> = {
  graph: gallery.graphGallery as Entry[],
  "ratio table": [...gallery.ratioGallery, ...gallery.ratioTeachingGallery] as Entry[],
  "plotting quadratics": gallery.quadraticGallery as Entry[],
  cuboids: gallery.cuboidGallery as Entry[],
  "number line": gallery.numberLineGallery as Entry[],
  venn: gallery.vennGallery as Entry[],
  triangles: gallery.triangleGallery as Entry[],
  "algebra grid": gallery.algebraGallery as Entry[],
  "bar model": gallery.barGallery as unknown as Entry[],
  charts: gallery.chartGallery as Entry[],
  "probability trees": gallery.treeGallery as Entry[],
};

export function renders(entries: Entry[]) {
  const out: { id: string; envelope: unknown; svg: string }[] = [];
  for (const e of entries) for (const worked of [false, true]) {
    const envelope = e.make(worked);
    out.push({ id: `${e.id}${worked ? " (worked)" : ""}`, envelope, svg: e.render(envelope as never) });
  }
  return out;
}

/** The physical size an SVG root declares (src/testing/print-size.ts). */
export const physical = svgPrintSize;
