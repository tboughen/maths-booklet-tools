// Shared browser, registration and release contract. No Node/browser side effects.
//
// A worked solution is data: checked steps for each part, stored as one JSON file in the private
// bank and drawn by MathsDock over the question's own cuts (packages/worked-core). The catalogue
// holds only this attachment: where the file is, its hash and the question revision it was written
// for. See docs/content/WORKED-SOLUTIONS.md.

export interface WorkedSolution {
  schemaVersion: 2;
  /** Changes whenever the steps change; each revision has its own file. */
  revision: string;
  basedOnQuestionRevision: string;
  /** The steps file: bank/assets/worked/<question id>/<revision>.json */
  data: string;
  dataSha256: string;
}

export type BankAssetExtension = "pdf" | "png" | "json";

export function bankAssetPath(path: unknown, extension?: BankAssetExtension): path is string {
  return typeof path === "string" && /^bank\/assets\/[A-Za-z0-9_./-]+\.(pdf|png|json)$/.test(path)
    && !path.split("/").some(part => part === ".." || part === "." || part === "")
    && (!extension || path.endsWith(`.${extension}`));
}

const revision = (value: unknown): value is string => typeof value === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(value);
const KEYS = ["basedOnQuestionRevision", "data", "dataSha256", "revision", "schemaVersion"].join();

/** The steps file's path for a question and revision. */
export const workedDataPath = (questionId: string, solutionRevision: string) => `bank/assets/worked/${questionId}/${solutionRevision}.json`;

export function validateWorkedSolution(value: unknown, questionRevision: string): asserts value is WorkedSolution {
  const fail = () => { throw new Error("Worked solution is incomplete, invalid or based on a different question revision."); };
  if (!value || typeof value !== "object" || Array.isArray(value)) return fail();
  const s = value as WorkedSolution;
  if (Object.keys(s).sort().join() !== KEYS || s.schemaVersion !== 2 || !revision(s.revision) || !revision(s.basedOnQuestionRevision)
      || s.basedOnQuestionRevision !== questionRevision || !bankAssetPath(s.data, "json")
      || !s.data.startsWith("bank/assets/worked/") || !/^[a-f0-9]{64}$/.test(s.dataSha256)) return fail();
}

const canonical = (value: unknown): string | undefined => Array.isArray(value) ? `[${value.map(canonical).join(",")}]`
  : value && typeof value === "object" ? `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical((value as Record<string,unknown>)[key])}`).join(",")}}` : JSON.stringify(value);

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
