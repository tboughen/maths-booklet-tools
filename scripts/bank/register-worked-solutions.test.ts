// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { stageWorkedSolutions } from "./register-worked-solutions";
import { sha256, verifyCatalogueSolutionFiles, verifySolutionFile } from "./solution-files";
import { prepareRelease } from "../cloudflare/release";
import type { WorkedSolution } from "../../workedSolution";

const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });

const steps = (questionId = "Q1", questionRevision = "qrev") => JSON.stringify({ schemaVersion: 2, questionId, questionRevision,
  parts: [{ on: "question-1", parts: ["1"], area: { x: 40, y: 40, width: 200, bottom: 120 }, notesX: 300, answers: [], steps: [{ kind: "text", text: "3 + 4 = 7" }] }] });

function fixture(revision = "sol-1", body = steps()) {
  const root = mkdtempSync(join(tmpdir(), "mathsdock-worked-test-")); roots.push(root);
  const publicRoot = join(root, "public"), data = `bank/assets/worked/Q1/${revision}.json`;
  mkdirSync(join(publicRoot, "bank/assets/worked/Q1"), { recursive: true });
  writeFileSync(join(publicRoot, data), body);
  writeFileSync(join(publicRoot, "bank/assets/q.pdf"), "%PDF-question");
  writeFileSync(join(publicRoot, "bank/assets/q.png"), "png");
  const solution: WorkedSolution = { schemaVersion: 2, revision, basedOnQuestionRevision: "qrev", data, dataSha256: sha256(body) };
  const question = { id: "Q1", revision: "qrev", questionPdf: "bank/assets/q.pdf", printPdf: "bank/assets/q.pdf", schemePdf: "bank/assets/q.pdf", questionViews: [{ preview: "bank/assets/q.png" }], schemeViews: [] };
  const catalogue = { version: "baseline", questions: [question, { ...question, id: "Q2" }] };
  const batch = { schemaVersion: 2, batchId: "batch-1", registrations: [{ questionId: "Q1", expectedQuestionRevision: "qrev", solution } as Record<string, unknown> & { solution: WorkedSolution }] };
  const cataloguePath = join(root, "catalogue.json"), batchPath = join(root, "batch.json");
  writeFileSync(cataloguePath, JSON.stringify(catalogue)); writeFileSync(batchPath, JSON.stringify(batch));
  return { root, publicRoot, cataloguePath, batchPath, output: join(root, "staged"), batch, catalogue, solution };
}

describe("worked solution registration and release closure", () => {
  it("runs the real Node CLI without writing to its input catalogue", () => {
    const f = fixture();
    const result = execFileSync(process.execPath, [resolve("scripts/bank/register-worked-solutions.ts"), `--catalogue=${f.cataloguePath}`, `--batch=${f.batchPath}`, `--public=${f.publicRoot}`, `--output=${f.output}`], { encoding: "utf8", windowsHide: true });
    expect(JSON.parse(result)).toEqual({ state: "staged_not_published", added: 1, replaced: 0, unchanged: 0, assets: 1 });
    expect(JSON.parse(readFileSync(f.cataloguePath, "utf8"))).toEqual(f.catalogue);
  });
  it("stages atomically, preserves unrelated records, repeats without overwriting and releases the steps file", async () => {
    const f = fixture(), before = readFileSync(f.cataloguePath);
    const receipt = await stageWorkedSolutions(f);
    expect(receipt.state).toBe("staged_not_published"); expect(receipt.registrations[0].action).toBe("added");
    const proposed = JSON.parse(readFileSync(join(f.output, "public/bank/catalogue.json"), "utf8"));
    expect(proposed.questions[0].workedSolution).toEqual(f.solution);
    expect(proposed.questions[1]).toEqual(f.catalogue.questions[1]);
    expect(readFileSync(f.cataloguePath)).toEqual(before);
    expect(readFileSync(join(f.output, "public", f.solution.data))).toEqual(readFileSync(join(f.publicRoot, f.solution.data)));
    const repeated = await stageWorkedSolutions({ ...f, cataloguePath: join(f.output, "public/bank/catalogue.json"), output: join(f.root, "repeat") });
    expect(repeated.registrations[0].action).toBe("unchanged"); expect(repeated.version).toBe(receipt.version);
    await expect(stageWorkedSolutions(f)).rejects.toThrow("already exists");
    await verifyCatalogueSolutionFiles(f.publicRoot, proposed);
    writeFileSync(join(f.publicRoot, "bank/catalogue.json"), JSON.stringify(proposed));
    const release = prepareRelease(f.publicRoot, "commit"), q = JSON.parse(release.catalogueJson).questions[0];
    expect(q.workedSolution.data).toBe(`bank/assets/sha256/${f.solution.dataSha256}.json`);
    expect(release.manifest.assets.find(a => a.key === q.workedSolution.data)?.contentType).toBe("application/json");
  });
  it.each(["revision", "hash", "missing-file", "not-json", "schema", "other-question", "other-revision", "wrong-path", "duplicate", "conflict"])("rejects %s before publishing any proposal", async kind => {
    const f = fixture();
    const entry = f.batch.registrations[0];
    const rewrite = (body: string) => { writeFileSync(join(f.publicRoot, f.solution.data), body); entry.solution.dataSha256 = sha256(body); };
    if (kind === "revision") entry.expectedQuestionRevision = "changed";
    if (kind === "hash") entry.solution.dataSha256 = "0".repeat(64);
    if (kind === "missing-file") entry.solution.data = "bank/assets/worked/Q1/missing.json";
    if (kind === "not-json") rewrite("{");
    if (kind === "schema") rewrite(JSON.stringify({ schemaVersion: 1, questionId: "Q1", questionRevision: "qrev", parts: [{}] }));
    if (kind === "other-question") rewrite(steps("Q2"));
    if (kind === "other-revision") rewrite(steps("Q1", "old"));
    if (kind === "wrong-path") { mkdirSync(join(f.publicRoot, "bank/assets/worked/Q2"), { recursive: true }); writeFileSync(join(f.publicRoot, "bank/assets/worked/Q2/sol-1.json"), steps()); entry.solution.data = "bank/assets/worked/Q2/sol-1.json"; }
    if (kind === "duplicate") f.batch.registrations.push(structuredClone(entry));
    if (kind === "conflict") writeFileSync(f.cataloguePath, JSON.stringify({ ...f.catalogue, questions: [{ ...f.catalogue.questions[0], workedSolution: { ...f.solution, revision: "other", data: "bank/assets/worked/Q1/other.json" } }] }));
    writeFileSync(f.batchPath, JSON.stringify(f.batch));
    await expect(stageWorkedSolutions(f)).rejects.toThrow(); expect(existsSync(f.output)).toBe(false);
  });
  it("checks a steps file belongs to the question it is attached to", () => {
    const f = fixture();
    expect(verifySolutionFile(f.publicRoot, f.solution, { id: "Q1", revision: "qrev" }).sha256).toBe(f.solution.dataSha256);
    expect(() => verifySolutionFile(f.publicRoot, f.solution, { id: "Q2", revision: "qrev" })).toThrow("different question");
    expect(() => verifySolutionFile(f.publicRoot, { ...f.solution, data: "bank/assets/../catalogue.json" }, { id: "Q1", revision: "qrev" })).toThrow();
  });
  it("guards a catalogue rebuild against silent attachment loss or a changed question", async () => {
    const f = fixture(); await stageWorkedSolutions(f);
    const proposed = join(f.root, "rebuilt.json"); writeFileSync(proposed, JSON.stringify(f.catalogue));
    const receipt = await stageWorkedSolutions({ ...f, cataloguePath: join(f.output, "public/bank/catalogue.json"), proposedCataloguePath: proposed, output: join(f.root, "rebuilt") });
    expect(receipt.registrations[0].action).toBe("unchanged");
    f.catalogue.questions[0].revision = "changed"; writeFileSync(proposed, JSON.stringify(f.catalogue));
    await expect(stageWorkedSolutions({ ...f, cataloguePath: join(f.output, "public/bank/catalogue.json"), proposedCataloguePath: proposed, output: join(f.root, "bad-rebuild") })).rejects.toThrow();
  });
  it("replaces exactly the expected attachment and repeats without changing its version", async () => {
    const f = fixture("sol-2");
    const old: WorkedSolution = { ...f.solution, revision: "sol-1", data: "bank/assets/worked/Q1/sol-1.json", dataSha256: "e".repeat(64) };
    const before = { ...f.catalogue, questions: [{ ...f.catalogue.questions[0], workedSolution: old }, f.catalogue.questions[1]] };
    writeFileSync(f.cataloguePath, JSON.stringify(before));
    writeFileSync(f.batchPath, JSON.stringify({ ...f.batch, registrations: [{ ...f.batch.registrations[0], expectedPreviousSolution: old }] }));
    const result = await stageWorkedSolutions(f), entry = result.registrations[0];
    expect(entry.action).toBe("replaced"); expect(entry.previousSolution).toEqual(old); expect(entry.solution).toEqual(f.solution);
    const proposal = join(f.output, "public/bank/catalogue.json");
    expect(JSON.parse(readFileSync(proposal, "utf8")).questions[1]).toEqual(before.questions[1]);
    const repeated = await stageWorkedSolutions({ ...f, cataloguePath: proposal, output: join(f.root, "repeat-replacement") });
    expect(repeated.registrations[0].action).toBe("unchanged"); expect(repeated.version).toBe(result.version);
  });
  it.each(["stale-revision", "stale-hash", "missing-current", "same-revision", "reused-path"])("refuses unsafe replacement %s without output", async kind => {
    const f = fixture("sol-2");
    const old: WorkedSolution = { ...f.solution, revision: "sol-1", data: "bank/assets/worked/Q1/sol-1.json", dataSha256: "e".repeat(64) };
    const expected = structuredClone(old);
    if (kind === "stale-revision") expected.revision = "different";
    if (kind === "stale-hash") expected.dataSha256 = "f".repeat(64);
    if (kind === "same-revision") expected.revision = old.revision = f.solution.revision;
    if (kind === "reused-path") expected.data = old.data = f.solution.data;
    if (kind !== "missing-current") writeFileSync(f.cataloguePath, JSON.stringify({ ...f.catalogue, questions: [{ ...f.catalogue.questions[0], workedSolution: old }, f.catalogue.questions[1]] }));
    writeFileSync(f.batchPath, JSON.stringify({ ...f.batch, registrations: [{ ...f.batch.registrations[0], expectedPreviousSolution: expected }] }));
    await expect(stageWorkedSolutions(f)).rejects.toThrow(); expect(existsSync(f.output)).toBe(false);
  });
});
