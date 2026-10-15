import { repository, run, assertEqual } from './common.mjs';

export async function githubJson(root, path) {
  const response = await run(root, 'gh', ['api', `repos/${repository}/${path}`], { capture: true });
  return JSON.parse(response.stdout);
}
export async function verifyWorkflowRun(root, runId, { path, commit, requiredJob } = {}) {
  if (!/^\d+$/.test(String(runId || ''))) throw new Error('An exact trusted workflow run ID is required');
  const run = await githubJson(root, `actions/runs/${runId}`);
  if (run.repository?.full_name !== repository || run.head_repository?.full_name !== repository || run.status !== 'completed' || run.conclusion !== 'success' || run.path !== path) throw new Error('Qualification/baseline run is not a successful trusted repository workflow');
  if (commit) assertEqual(run.head_sha, commit, 'Workflow qualified a different commit');
  const jobs = [];
  for (let page = 1; ; page++) {
    const result = await githubJson(root, `actions/runs/${runId}/jobs?per_page=100&page=${page}`);
    jobs.push(...result.jobs);
    if (jobs.length >= result.total_count) break;
  }
  if (requiredJob && !jobs.some(j => j.name === requiredJob && j.conclusion === 'success')) throw new Error('Required qualification aggregate did not pass');
  return run;
}
export async function downloadTrustedArtifact(root, runId, name, directory, expectation) {
  await verifyWorkflowRun(root, runId, expectation);
  const result = await githubJson(root, `actions/runs/${runId}/artifacts?per_page=100`);
  const matches = result.artifacts.filter(a => a.name === name && !a.expired);
  if (matches.length !== 1) throw new Error('Required immutable workflow artifact is missing, expired or ambiguous');
  await run(root, 'gh', ['run', 'download', String(runId), '--repo', repository, '--name', name, '--dir', directory], { capture: true });
  return { id: matches[0].id, digest: matches[0].digest, runId: String(runId), name };
}
