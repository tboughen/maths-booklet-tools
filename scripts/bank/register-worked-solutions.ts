import { existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";
import { preserveWorkedSolutions, validateWorkedSolution, workedDataPath, type WorkedSolution } from "../../workedSolution.ts";
import { sha256, verifySolutionFile, type CheckedSolutionFile } from "./solution-files.ts";

interface Registration {
  questionId: string;
  expectedQuestionRevision: string;
  solution: WorkedSolution;
  /** Explicit compare-and-swap authority; omitted means add or exact repeat. */
  expectedPreviousSolution?: WorkedSolution;
}
interface Batch { schemaVersion: 2; batchId: string; registrations: Registration[]; }
interface Catalogue { version: string; questions: { id: string; revision: string; workedSolution?: WorkedSolution; [key: string]: unknown }[]; [key: string]: unknown; }

// Pure proposal: source catalogue and public files are never overwritten. The directory becomes
// visible only after every record and steps file has been validated. The full schema, marks and
// layout checks are in src/bank/worked-bank.test.ts; run it on the staged bank before committing.
export async function stageWorkedSolutions(options: { cataloguePath: string; batchPath: string; publicRoot: string; output: string; proposedCataloguePath?: string }) {
  const output = resolve(options.output);
  if (existsSync(output)) throw new Error("Output already exists; use a fresh immutable batch directory.");
  const sourceBytes = readFileSync(options.cataloguePath);
  const batchBytes = readFileSync(options.batchPath);
  const previous = JSON.parse(sourceBytes.toString()) as Catalogue;
  const batch = JSON.parse(batchBytes.toString()) as Batch;
  if (batch.schemaVersion !== 2 || !/^[A-Za-z0-9_-]{1,128}$/.test(batch.batchId) || !Array.isArray(batch.registrations)) throw new Error("Invalid worked solution batch.");
  const proposedBytes = options.proposedCataloguePath ? readFileSync(options.proposedCataloguePath) : undefined;
  const catalogue = proposedBytes ? JSON.parse(proposedBytes.toString()) as Catalogue : structuredClone(previous);
  if (!Array.isArray(catalogue.questions) || !catalogue.version || !Array.isArray(previous.questions)) throw new Error("Invalid catalogue.");
  if (new Set(previous.questions.map(q => q.id)).size !== previous.questions.length) throw new Error("Duplicate input catalogue question ID.");
  catalogue.questions = preserveWorkedSolutions(previous.questions, catalogue.questions);
  const byId = new Map(catalogue.questions.map(q => [q.id, q]));
  if (byId.size !== catalogue.questions.length) throw new Error("Duplicate catalogue question ID.");
  const seen = new Set<string>(), files = new Map<string, CheckedSolutionFile>();
  const registrations: { questionId: string; action: "added" | "replaced" | "unchanged"; expectedQuestionRevision: string; solutionRevision: string; dataSha256: string; previousSolution: WorkedSolution | null; solution: WorkedSolution }[] = [];
  for (const entry of batch.registrations) {
    if (!entry || typeof entry.questionId !== "string" || seen.has(entry.questionId)) throw new Error("Duplicate or invalid registration ID.");
    seen.add(entry.questionId);
    const question = byId.get(entry.questionId);
    if (!question || question.revision !== entry.expectedQuestionRevision) throw new Error(`Question revision conflict: ${entry.questionId}`);
    validateWorkedSolution(entry.solution, question.revision);
    if (entry.solution.data !== workedDataPath(question.id, entry.solution.revision)) throw new Error(`Steps file must be at ${workedDataPath(question.id, entry.solution.revision)}: ${entry.questionId}`);
    const current = question.workedSolution;
    const identical = current !== undefined && isDeepStrictEqual(current, entry.solution);
    const expected = entry.expectedPreviousSolution;
    if (expected !== undefined) {
      validateWorkedSolution(expected, question.revision);
      if (expected.revision === entry.solution.revision || expected.data === entry.solution.data) {
        throw new Error(`Replacement must use a new immutable revision and steps file: ${entry.questionId}`);
      }
      if (!identical && (!current || !isDeepStrictEqual(current, expected))) throw new Error(`Previous worked solution changed or is absent: ${entry.questionId}`);
    } else if (current && !identical) {
      throw new Error(`Existing worked solution conflicts: ${entry.questionId}`);
    }
    const file = verifySolutionFile(options.publicRoot, entry.solution, question);
    if (files.has(file.path) && files.get(file.path)!.sha256 !== file.sha256) throw new Error("Conflicting solution file bytes.");
    files.set(file.path, file);
    registrations.push({ questionId: question.id, action: identical ? "unchanged" : current ? "replaced" : "added", expectedQuestionRevision: question.revision, solutionRevision: entry.solution.revision, dataSha256: entry.solution.dataSha256,
      previousSolution: current ? structuredClone(current) : null, solution: structuredClone(entry.solution) });
    question.workedSolution = structuredClone(entry.solution);
  }
  // Bind the version to actual content, independent of batch naming/order. An
  // exact repeat retains the version and remains a no-op.
  if (registrations.some(r => r.action !== "unchanged")) catalogue.version = `worked-solutions-${sha256(JSON.stringify(catalogue.questions)).slice(0, 20)}`;
  const catalogueJson = JSON.stringify(catalogue);
  const receipt = { schemaVersion: 2, state: "staged_not_published", batchId: batch.batchId, inputCatalogueSha256: sha256(sourceBytes), proposedInputSha256: proposedBytes ? sha256(proposedBytes) : null, batchSha256: sha256(batchBytes), catalogueSha256: sha256(catalogueJson), version: catalogue.version, registrations,
    assets: [...files.values()].sort((a,b) => a.path.localeCompare(b.path)).map(({ path, sha256, bytes }) => ({ path, sha256, bytes })) };
  if (sha256(readFileSync(options.cataloguePath)) !== receipt.inputCatalogueSha256 || sha256(readFileSync(options.batchPath)) !== receipt.batchSha256
      || (options.proposedCataloguePath && sha256(readFileSync(options.proposedCataloguePath)) !== receipt.proposedInputSha256)) throw new Error("Staging inputs changed during validation; reconcile before retrying.");
  mkdirSync(dirname(output), { recursive: true });
  const temporary = mkdtempSync(join(dirname(output), ".worked-solution-stage-"));
  try {
    for (const file of files.values()) {
      const target = join(temporary, "public", file.path);
      mkdirSync(dirname(target), { recursive: true }); writeFileSync(target, file.data, { flag: "wx" });
    }
    mkdirSync(join(temporary, "public/bank"), { recursive: true });
    writeFileSync(join(temporary, "public/bank/catalogue.json"), catalogueJson, { flag: "wx" });
    writeFileSync(join(temporary, "receipt.json"), JSON.stringify(receipt, null, 2), { flag: "wx" });
    renameSync(temporary, output);
  } catch (error) {
    // Only this freshly created, resolved sibling directory is owned here.
    rmSync(temporary, { recursive: true, force: true }); throw error;
  }
  return receipt;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = new Map(process.argv.slice(2).map(arg => { const index = arg.indexOf("="); return [arg.slice(0,index), arg.slice(index+1)]; }));
    const required = (key: string) => { const value = args.get(`--${key}`); if (!value) throw new Error(`Missing --${key}=ABSOLUTE_PATH`); return resolve(value); };
    const receipt = await stageWorkedSolutions({ cataloguePath: required("catalogue"), batchPath: required("batch"), publicRoot: required("public"), output: required("output"), proposedCataloguePath: args.has("--proposed-catalogue") ? required("proposed-catalogue") : undefined });
    console.log(JSON.stringify({ state: receipt.state, added: receipt.registrations.filter(r => r.action === "added").length, replaced: receipt.registrations.filter(r => r.action === "replaced").length, unchanged: receipt.registrations.filter(r => r.action === "unchanged").length, assets: receipt.assets.length }));
  } catch (error) { console.error(error instanceof Error ? error.message : "Staging failed."); process.exitCode = 1; }
}
