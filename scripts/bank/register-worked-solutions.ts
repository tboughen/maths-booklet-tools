import { existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";
import { preserveWorkedSolutions, validateWorkedSolution, type WorkedSolution } from "../../workedSolution.ts";
import { sha256, verifySolutionFiles, type CheckedSolutionFile } from "./solution-files.ts";

interface Registration {
  questionId: string;
  expectedQuestionRevision: string;
  solution: WorkedSolution;
  /** Explicit compare-and-swap authority; omitted means add or exact repeat. */
  expectedPreviousSolution?: WorkedSolution;
  files: { path: string; sha256: string }[];
  evidence: {
    sourcePdfSha256: string; checkedPaperPdfSha256: string; reviewRecordSha256: string; targetOnly: true;
    fullOriginalPages?: boolean; resourceScope?: "individual-whole-question";
    recipeSha256?: string; allPartsChecked?: true; neighbourQuestionsExcluded?: true;
  };
}
interface Batch { schemaVersion: 1; batchId: string; registrations: Registration[]; }
interface Catalogue { version: string; questions: { id: string; revision: string; workedSolution?: WorkedSolution; [key: string]: unknown }[]; [key: string]: unknown; }

// Pure proposal: source catalogue and public files are never overwritten. The
// directory becomes visible only after every record and body has been validated.
export async function stageWorkedSolutions(options: { cataloguePath: string; batchPath: string; publicRoot: string; output: string; proposedCataloguePath?: string }) {
  const output = resolve(options.output);
  if (existsSync(output)) throw new Error("Output already exists; use a fresh immutable batch directory.");
  const sourceBytes = readFileSync(options.cataloguePath);
  const batchBytes = readFileSync(options.batchPath);
  const previous = JSON.parse(sourceBytes.toString()) as Catalogue;
  const batch = JSON.parse(batchBytes.toString()) as Batch;
  if (batch.schemaVersion !== 1 || !/^[A-Za-z0-9_-]{1,128}$/.test(batch.batchId) || !Array.isArray(batch.registrations)) throw new Error("Invalid worked solution batch.");
  const proposedBytes = options.proposedCataloguePath ? readFileSync(options.proposedCataloguePath) : undefined;
  const catalogue = proposedBytes ? JSON.parse(proposedBytes.toString()) as Catalogue : structuredClone(previous);
  if (!Array.isArray(catalogue.questions) || !catalogue.version || !Array.isArray(previous.questions)) throw new Error("Invalid catalogue.");
  if (new Set(previous.questions.map(q => q.id)).size !== previous.questions.length) throw new Error("Duplicate input catalogue question ID.");
  catalogue.questions = preserveWorkedSolutions(previous.questions, catalogue.questions);
  const byId = new Map(catalogue.questions.map(q => [q.id, q]));
  if (byId.size !== catalogue.questions.length) throw new Error("Duplicate catalogue question ID.");
  const seen = new Set<string>(), files = new Map<string, CheckedSolutionFile>();
  const registrations: { questionId: string; action: "added" | "replaced" | "unchanged"; expectedQuestionRevision: string; solutionRevision: string; pdfSha256: string; evidence: Registration["evidence"]; previousSolution: WorkedSolution | null; solution: WorkedSolution }[] = [];
  for (const entry of batch.registrations) {
    if (!entry || typeof entry.questionId !== "string" || seen.has(entry.questionId)) throw new Error("Duplicate or invalid registration ID.");
    seen.add(entry.questionId);
    const question = byId.get(entry.questionId);
    if (!question || question.revision !== entry.expectedQuestionRevision) throw new Error(`Question revision conflict: ${entry.questionId}`);
    validateWorkedSolution(entry.solution, question.revision);
    const current = question.workedSolution;
    const identical = current !== undefined && isDeepStrictEqual(current, entry.solution);
    const expected = entry.expectedPreviousSolution;
    if (expected !== undefined) {
      validateWorkedSolution(expected, question.revision);
      const oldPaths = new Set([expected.pdf, ...expected.views.map(view => view.preview)]);
      if (expected.revision === entry.solution.revision || [entry.solution.pdf,...entry.solution.views.map(view=>view.preview)].some(path=>oldPaths.has(path))) {
        throw new Error(`Replacement must use a new immutable revision and asset paths: ${entry.questionId}`);
      }
      if (!identical && (!current || !isDeepStrictEqual(current, expected))) throw new Error(`Previous worked solution changed or is absent: ${entry.questionId}`);
    } else if (current && !identical) {
      throw new Error(`Existing worked solution conflicts: ${entry.questionId}`);
    }
    const evidence = entry.evidence;
    const hash = (value: unknown) => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
    if (!evidence || evidence.targetOnly !== true || ![evidence.sourcePdfSha256,evidence.checkedPaperPdfSha256,evidence.reviewRecordSha256].every(hash)) {
      throw new Error(`Missing source-bound target-only review evidence: ${entry.questionId}`);
    }
    if (entry.solution.layout === "individual-question") {
      if (evidence.fullOriginalPages !== false || evidence.resourceScope !== "individual-whole-question" || !hash(evidence.recipeSha256)
          || evidence.allPartsChecked !== true || evidence.neighbourQuestionsExcluded !== true) {
        throw new Error(`Missing individual whole-question review evidence: ${entry.questionId}`);
      }
    } else if (!identical || expected !== undefined || evidence.fullOriginalPages !== true || evidence.resourceScope !== undefined) {
      throw new Error(`New or replacement worked solutions must be individual whole-question resources: ${entry.questionId}`);
    }
    const checked = await verifySolutionFiles(options.publicRoot, entry.solution, question.revision);
    if (!Array.isArray(entry.files) || new Set(entry.files.map(f => f.path)).size !== entry.files.length || entry.files.length !== checked.length
        || checked.some(file => !entry.files.some(f => f.path === file.path && f.sha256 === file.sha256))) throw new Error(`Solution asset manifest differs: ${entry.questionId}`);
    for (const file of checked) {
      if (files.has(file.path) && files.get(file.path)!.sha256 !== file.sha256) throw new Error("Conflicting solution file bytes.");
      files.set(file.path, file);
    }
    registrations.push({ questionId: question.id, action: identical ? "unchanged" : current ? "replaced" : "added", expectedQuestionRevision: question.revision, solutionRevision: entry.solution.revision, pdfSha256: entry.solution.pdfSha256, evidence,
      previousSolution: current ? structuredClone(current) : null, solution: structuredClone(entry.solution) });
    question.workedSolution = structuredClone(entry.solution);
  }
  // Bind the version to actual content, independent of batch naming/order. An
  // exact repeat retains the version and remains a no-op.
  if (registrations.some(r => r.action !== "unchanged")) catalogue.version = `worked-solutions-${sha256(JSON.stringify(catalogue.questions)).slice(0, 20)}`;
  const catalogueJson = JSON.stringify(catalogue);
  const receipt = { schemaVersion: 1, state: "staged_not_published", batchId: batch.batchId, inputCatalogueSha256: sha256(sourceBytes), proposedInputSha256: proposedBytes ? sha256(proposedBytes) : null, batchSha256: sha256(batchBytes), catalogueSha256: sha256(catalogueJson), version: catalogue.version, registrations,
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
