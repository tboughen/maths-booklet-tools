import { createHash } from "node:crypto";
import { readFileSync, realpathSync, statSync } from "node:fs";
import { resolve, sep } from "node:path";
import { validateWorkedSolution, type WorkedSolution } from "../../workedSolution.ts";

export const sha256 = (bytes: Uint8Array | string) => createHash("sha256").update(bytes).digest("hex");
export interface CheckedSolutionFile { path: string; sha256: string; bytes: number; data: Buffer; }

/**
 * Checks that a worked solution's steps file is in the bank, has the registered bytes and belongs to
 * this question revision. This runs under plain Node, so the full schema, marks and layout checks
 * (packages/worked-core) run in src/bank/worked-bank.test.ts instead.
 */
export function verifySolutionFile(publicRoot: string, solution: WorkedSolution, question: { id: string; revision: string }): CheckedSolutionFile {
  validateWorkedSolution(solution, question.revision);
  const root = realpathSync(publicRoot);
  const absolute = realpathSync(resolve(root, solution.data));
  if (!absolute.startsWith(root + sep) || !statSync(absolute).isFile()) throw new Error(`Worked solution file escapes the public directory: ${solution.data}`);
  const data = readFileSync(absolute);
  const file = { path: solution.data, sha256: sha256(data), bytes: data.length, data };
  if (file.sha256 !== solution.dataSha256) throw new Error(`Worked solution file hash differs from its registration: ${question.id}`);
  let steps: { schemaVersion?: unknown; questionId?: unknown; questionRevision?: unknown; parts?: unknown };
  try { steps = JSON.parse(data.toString("utf8")); } catch { throw new Error(`Worked solution file is not JSON: ${question.id}`); }
  if (steps?.schemaVersion !== 2 || !Array.isArray(steps.parts) || !steps.parts.length) throw new Error(`Worked solution file is not schema 2: ${question.id}`);
  if (steps.questionId !== question.id || steps.questionRevision !== question.revision) throw new Error(`Worked solution file is for a different question or revision: ${question.id}`);
  return file;
}

export async function verifyCatalogueSolutionFiles(publicRoot: string, catalogue: { questions: { id: string; revision?: string; workedSolution?: WorkedSolution }[] }): Promise<void> {
  for (const question of catalogue.questions) {
    if (question.workedSolution !== undefined) verifySolutionFile(publicRoot, question.workedSolution, { id: question.id, revision: question.revision || "" });
  }
}
