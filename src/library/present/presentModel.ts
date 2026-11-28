/**
 * Present a booklet (docs/tools/PRESENT-BOOKLETS.md): which files a library booklet is shown from, and the other
 * builds of the same booklet a teacher can switch to. The pages are always the delivered PDFs, never re-laid-out.
 */
import { fileHref, type Library, type LibraryFile, type Resource } from "../model";

/** One build of a booklet that can be presented: a version's current files, or an earlier build from its history. */
export type PresentBuild = { key: string; resource: Resource; version: string; updated: string; current: boolean; pupil: LibraryFile; answers?: LibraryFile };

const pdf = (files: LibraryFile[], role: LibraryFile["role"]) => files.find((f) => f.role === role && f.format === "pdf");
export const canPresent = (files: LibraryFile[]) => !!pdf(files, "pupil");

/** The same booklet in every version: the same lesson, or the same unit booklet part. */
function sameBooklet(a: Resource, b: Resource) {
  if (a.year !== b.year || a.unit !== b.unit || a.type !== b.type) return false;
  if (a.type === "unit-booklet") return (a.part ?? "") === (b.part ?? "");
  return a.lesson ? a.lesson === b.lesson : a.id === b.id;
}

/** Every build of this booklet: Main first, then the other versions, each newest first. */
export function presentBuilds(list: Library, resource: Resource): PresentBuild[] {
  const family = list.resources.filter((r) => sameBooklet(r, resource));
  const order = (r: Resource) => (r.version === "Main" ? 0 : 1);
  family.sort((a, b) => order(a) - order(b) || a.version.localeCompare(b.version));
  const builds: PresentBuild[] = [];
  for (const r of family) {
    const pupil = pdf(r.files, "pupil");
    if (pupil) builds.push({ key: `${r.id}@${r.updated}`, resource: r, version: r.version, updated: r.updated, current: true, pupil, answers: pdf(r.files, "answers") });
    for (const old of r.history) {
      const oldPupil = pdf(old.files, "pupil");
      if (oldPupil) builds.push({ key: `${r.id}@${old.updated}`, resource: r, version: r.version, updated: old.updated, current: false, pupil: oldPupil, answers: pdf(old.files, "answers") });
    }
  }
  return builds;
}

/** The build an address names (`?present=<id>&at=<updated>`), or that resource's current build. */
export function findBuild(list: Library, id: string, at?: string): { builds: PresentBuild[]; build?: PresentBuild } {
  const resource = list.resources.find((r) => r.id === id);
  if (!resource) return { builds: [] };
  const builds = presentBuilds(list, resource);
  const mine = builds.filter((b) => b.resource.id === id);
  return { builds, build: (at && mine.find((b) => b.updated === at)) || mine.find((b) => b.current) || mine[0] };
}

export const buildUrl = (file: LibraryFile) => fileHref(file);
export const dayName = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
/** "Main · 25 Nov 2026", with "(earlier)" for a replaced build. */
export const buildLabel = (b: PresentBuild) => `${b.version} · ${dayName(b.updated)}${b.current ? "" : " (earlier)"}`;

export type ZoomFit = "width" | "side";
/** The scale that shows a side at the chosen fit inside the stage, before any zoom. */
export function fitScale(fit: ZoomFit, page: { width: number; height: number }, stage: { width: number; height: number }, gutter = 48) {
  const across = Math.max(stage.width - gutter * 2, 120) / page.width;
  if (fit === "width") return Math.min(across, 3);
  return Math.min(across, Math.max(stage.height - gutter, 120) / page.height);
}

export const ZOOM_STEPS = [0.5, 0.67, 0.8, 1, 1.25, 1.5, 2, 2.5, 3, 4];
export function stepZoom(zoom: number, direction: 1 | -1) {
  if (direction > 0) return ZOOM_STEPS.find((z) => z > zoom + 0.001) ?? ZOOM_STEPS[ZOOM_STEPS.length - 1];
  return [...ZOOM_STEPS].reverse().find((z) => z < zoom - 0.001) ?? ZOOM_STEPS[0];
}
