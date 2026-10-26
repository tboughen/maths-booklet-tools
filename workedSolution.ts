// Shared browser, registration and release contract. No Node/browser side effects.
export interface SolutionView {
  id: string;
  label: string;
  page: number;
  width: number;
  height: number;
  preview: string;
  description: string;
  sourcePages: number[];
  repeatedContext?: string;
}

export interface WorkedSolution {
  schemaVersion: 1;
  revision: string;
  basedOnQuestionRevision: string;
  pdf: string;
  pdfSha256: string;
  views: SolutionView[];
}

export function bankAssetPath(path: unknown, extension?: "pdf" | "png"): path is string {
  return typeof path === "string" && /^bank\/assets\/[A-Za-z0-9_./-]+\.(pdf|png)$/.test(path)
    && !path.split("/").some(part => part === ".." || part === "." || part === "")
    && (!extension || path.endsWith(`.${extension}`));
}

const text = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;
const revision = (value: unknown): value is string => text(value) && /^[A-Za-z0-9_-]{1,128}$/.test(value);
const canonical = (value: unknown): string | undefined => Array.isArray(value) ? `[${value.map(canonical).join(",")}]`
  : value && typeof value === "object" ? `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical((value as Record<string,unknown>)[key])}`).join(",")}}` : JSON.stringify(value);

export function validateWorkedSolution(value: unknown, questionRevision: string): asserts value is WorkedSolution {
  const fail = () => { throw new Error("Worked solution is incomplete, invalid or based on a different question revision."); };
  if (!value || typeof value !== "object" || Array.isArray(value)) return fail();
  const s = value as WorkedSolution;
  if (s.schemaVersion !== 1 || !revision(s.revision) || !revision(s.basedOnQuestionRevision)
      || s.basedOnQuestionRevision !== questionRevision || !bankAssetPath(s.pdf, "pdf")
      || !/^[a-f0-9]{64}$/.test(s.pdfSha256) || !Array.isArray(s.views) || !s.views.length) return fail();
  const ids = new Set<string>();
  let previousSourcePage = 0;
  for (const [index, view] of s.views.entries()) {
    if (!view || !text(view.id) || ids.has(view.id) || !text(view.label) || !text(view.description)
        || view.page !== index + 1 || !Number.isFinite(view.width) || view.width <= 0
        || !Number.isFinite(view.height) || view.height <= 0 || !bankAssetPath(view.preview, "png")
        || !Array.isArray(view.sourcePages) || view.sourcePages.length !== 1
        || !Number.isSafeInteger(view.sourcePages[0]) || view.sourcePages[0] <= previousSourcePage
        || (view.repeatedContext !== undefined && !text(view.repeatedContext))) return fail();
    ids.add(view.id);
    previousSourcePage = view.sourcePages[0];
  }
}

// Catalogue rebuilders must preserve attachments or explicitly resolve a conflict.
// Never transfer one implicitly to changed question content or another ID.
export function preserveWorkedSolutions<T extends { id: string; revision: string; workedSolution?: WorkedSolution }>(previous: readonly T[], proposed: readonly T[]): T[] {
  const old = new Map(previous.map(q => [q.id, q]));
  const proposedIds = new Set(proposed.map(q => q.id));
  for (const q of previous) if (q.workedSolution && !proposedIds.has(q.id)) throw new Error(`Rebuild would remove worked solution for ${q.id}.`);
  return proposed.map(q => {
    const retained = old.get(q.id)?.workedSolution;
    if (!retained) {
      if (q.workedSolution !== undefined) validateWorkedSolution(q.workedSolution, q.revision);
      return q;
    }
    validateWorkedSolution(retained, q.revision);
    if (q.workedSolution && canonical(q.workedSolution) !== canonical(retained)) throw new Error(`Rebuild conflicts with worked solution for ${q.id}.`);
    return { ...q, workedSolution: retained };
  });
}
