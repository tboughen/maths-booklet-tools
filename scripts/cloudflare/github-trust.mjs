import { repository, run, assertEqual } from './common.mjs';

export async function githubJson(root, path, { timeoutMs = 30000 } = {}) {
  const response = await run(root, 'gh', ['api', `repos/${repository}/${path}`], { capture: true, timeoutMs });
  return JSON.parse(response.stdout);
}
export async function verifyWorkflowRun(root, runId, { path, commit, requiredJob, branch, event } = {}) {
  if (!/^\d+$/.test(String(runId || ''))) throw new Error('An exact trusted workflow run ID is required');
  const run = await githubJson(root, `actions/runs/${runId}`);
  validateWorkflowOrigin(run, { path, commit, branch, event });
  const jobs = [];
  for (let page = 1; ; page++) {
    const result = await githubJson(root, `actions/runs/${runId}/jobs?per_page=100&page=${page}`);
    jobs.push(...result.jobs);
    if (jobs.length >= result.total_count) break;
  }
  if (requiredJob && !jobs.some(j => j.name === requiredJob && j.conclusion === 'success')) throw new Error('Required qualification aggregate did not pass');
  return run;
}
export function validateWorkflowOrigin(run, { path, commit, branch, event }) {
  if (run.repository?.full_name !== repository || run.head_repository?.full_name !== repository || run.status !== 'completed' || run.conclusion !== 'success' || run.path !== path) throw new Error('Qualification/baseline run is not a successful trusted repository workflow');
  if (commit) assertEqual(run.head_sha, commit, 'Workflow qualified a different commit');
  if (branch) assertEqual(run.head_branch, branch, 'Workflow ran on a different branch');
  if (event) assertEqual(run.event, event, 'Workflow ran for a different event');
  return run;
}
export async function downloadTrustedArtifact(root, runId, name, directory, expectation, { timeoutMs = 120000 } = {}) {
  await verifyWorkflowRun(root, runId, expectation);
  const result = await githubJson(root, `actions/runs/${runId}/artifacts?per_page=100`);
  const matches = result.artifacts.filter(a => a.name === name && !a.expired);
  if (matches.length !== 1) throw new Error('Required immutable workflow artifact is missing, expired or ambiguous');
  await run(root, 'gh', ['run', 'download', String(runId), '--repo', repository, '--name', name, '--dir', directory], { capture: true, timeoutMs });
  return { id: matches[0].id, digest: matches[0].digest, runId: String(runId), name };
}
