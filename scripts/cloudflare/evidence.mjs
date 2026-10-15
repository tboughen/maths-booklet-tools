import { assertEqual, digestObject, repository, json, save } from './common.mjs';
import { resolve } from 'node:path';

export function vitestEvidence(report) {
  if (!report.success || report.numFailedTests || report.numPendingTests || !report.numPassedTests || report.numTodoTests) throw new Error('Unit/integration report is incomplete, failed or skipped');
  return { passed: report.numPassedTests };
}
export function browserCases(report) {
  const cases = [];
  function walk(suites) {
    for (const suite of suites || []) {
      for (const spec of suite.specs || []) for (const test of spec.tests || []) cases.push({ id: `${spec.id}:${test.projectName || ''}`, expectedStatus: test.expectedStatus, status: test.status, results: test.results || [] });
      walk(suite.suites);
    }
  }
  walk(report.suites);
  return cases;
}
export function browserEvidence(report) {
  const cases = browserCases(report);
  if (report.errors?.length || !cases.length || cases.some(c => c.expectedStatus !== 'passed' || c.status !== 'expected' || c.results.length !== 1 || c.results[0].status !== 'passed')) throw new Error('Browser report contains failed, flaky, skipped or absent tests');
  return { passed: cases.length, cases: cases.map(c => c.id).sort() };
}
export function sealQualification(directory, checkDirectory, expectedBrowserCases) {
  const release = json(resolve(directory, 'release.json'));
  const required = release.inputs.classification.required;
  if (!required.length) throw new Error('This change has no promotable website qualification');
  const checks = required.map(name => {
    const check = json(resolve(checkDirectory, `${name}.json`));
    if (check.schemaVersion !== 1 || check.name !== name || check.releaseId !== release.releaseId || check.status !== 'passed') throw new Error(`Missing or inapplicable required result: ${name}`);
    return check;
  });
  if (release.inputs.classification.website) {
    const seen = checks.filter(c => /^browser-[12]$/.test(c.name)).flatMap(c => c.evidence.cases);
    if (new Set(seen).size !== seen.length) throw new Error('Browser shards overlapped');
    assertEqual([...seen].sort(), [...expectedBrowserCases].sort(), 'Browser shards omitted or added test cases');
  }
  const receipt = { schemaVersion: 1, repository, releaseId: release.releaseId, sourceTree: release.inputs.sourceTree, sourceCommit: release.sourceCommit, required, checks, completedAt: new Date().toISOString(), workflow: { runId: process.env.GITHUB_RUN_ID || null, attempt: process.env.GITHUB_RUN_ATTEMPT || null, workflowRef: process.env.GITHUB_WORKFLOW_REF || null }, checksDigest: digestObject(checks), status: 'qualified' };
  save(resolve(checkDirectory, 'qualification.json'), receipt);
  return receipt;
}
export function validateQualification(release, receipt) {
  if (receipt.schemaVersion !== 1 || receipt.repository !== repository || receipt.status !== 'qualified' || receipt.releaseId !== release.releaseId || receipt.sourceTree !== release.inputs.sourceTree || receipt.checksDigest !== digestObject(receipt.checks)) throw new Error('Qualification evidence does not match the release');
  assertEqual(receipt.required, release.inputs.classification.required, 'Required qualification changed');
  for (const name of receipt.required) if (!receipt.checks.some(c => c.name === name && c.releaseId === release.releaseId && c.status === 'passed')) throw new Error(`Required check did not pass: ${name}`);
  return receipt;
}
