// Shared by the output gates: every gallery example, pupil and worked, rendered by the shared core
// renderers the exports use, and the physical size its SVG root declares.
import * as gallery from "../examples/galleryCatalogue";

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
};

export function renders(entries: Entry[]) {
  const out: { id: string; envelope: unknown; svg: string }[] = [];
  for (const e of entries) for (const worked of [false, true]) {
    const envelope = e.make(worked);
    out.push({ id: `${e.id}${worked ? " (worked)" : ""}`, envelope, svg: e.render(envelope as never) });
  }
  return out;
}

const MM: Record<string, number> = { mm: 1, cm: 10, in: 25.4, pt: 25.4 / 72 };
export function physical(svg: string) {
  const root = svg.match(/<svg\b[^>]*>/)?.[0] ?? "";
  const attr = (n: string) => root.match(new RegExp(`\\s${n}="([^"]+)"`))?.[1];
  const size = (v?: string) => { const m = v?.match(/^([\d.]+)(mm|cm|in|pt)$/); return m ? Number(m[1]) * MM[m[2]] : NaN; };
  const [, , vw, vh] = (attr("viewBox") ?? "").trim().split(/[\s,]+/).map(Number);
  return { widthMm: size(attr("width")), heightMm: size(attr("height")), vw, vh };
}
