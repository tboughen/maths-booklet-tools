import { resolve, dirname } from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { githubJson } from './github-trust.mjs';
import { repository, canonical, save } from './common.mjs';

const supported = ['.github/workflows/graph-checks.yml', '.github/workflows/cloudflare.yml'];
export function watchSnapshot(run, jobs, expectedCommit) {
  if (run.repository?.full_name !== repository || run.head_repository?.full_name !== repository || !supported.includes(run.path)) throw new Error('Unexpected repository or workflow');
  if (expectedCommit && run.head_sha !== expectedCommit) throw new Error('Watcher observed a different source commit');
  return {
    runId: String(run.id), workflow: run.path, sourceCommit: run.head_sha,
    status: run.status, conclusion: run.conclusion ?? null,
    jobs: jobs.map(j => ({ id: j.id, name: j.name, status: j.status, conclusion: j.conclusion ?? null })).sort((a, b) => a.id - b.id),
  };
}

// Read-only and bounded. Staying in this process avoids a model turn per query.
// Success here means workflow success; the operator still inspects its receipts.
export async function watchRun(root, {
  runId, expectedCommit, timeoutMs = 45 * 60000, intervalMs = 30000, maxIntervalMs = 60000,
  api = githubJson, now = Date.now, wait = ms => new Promise(r => setTimeout(r, ms)), report = () => {},
} = {}) {
  if (!/^\d+$/.test(String(runId || ''))) throw new Error('An exact workflow run ID is required');
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0 || timeoutMs > 60 * 60000 || !Number.isFinite(intervalMs) || intervalMs < 1000 || !Number.isFinite(maxIntervalMs) || maxIntervalMs < intervalMs || maxIntervalMs > 60000) throw new Error('Invalid bounded watcher timing');
  const deadline = now() + timeoutMs;
  let previous, delay = intervalMs, snapshot;
  while (now() < deadline) {
    const run = await api(root, `actions/runs/${runId}`, { timeoutMs: Math.max(1, Math.min(30000, deadline - now())) });
    if (now() >= deadline) break;
    if (String(run.id) !== String(runId)) throw new Error('Watcher received a different run');
    const jobs = [];
    for (let page = 1; ; page++) {
      if (now() >= deadline) break;
      const result = await api(root, `actions/runs/${runId}/jobs?per_page=100&page=${page}`, { timeoutMs: Math.max(1, Math.min(30000, deadline - now())) });
      if (!Array.isArray(result.jobs) || !Number.isSafeInteger(result.total_count) || result.total_count < 0 || (!result.jobs.length && jobs.length < result.total_count)) throw new Error('Incomplete workflow jobs');
      jobs.push(...result.jobs);
      if (jobs.length >= result.total_count) break;
      if (page >= 10) throw new Error('Workflow jobs exceeded the bounded page limit');
    }
    if (now() >= deadline) break;
    snapshot = watchSnapshot(run, jobs, expectedCommit);
    const key = canonical(snapshot);
    if (key !== previous) { await report({ ...snapshot, observedAt: new Date(now()).toISOString() }); delay = intervalMs; }
    else delay = Math.min(maxIntervalMs, delay * 2);
    previous = key;
    if (snapshot.status === 'completed') return { state: snapshot.conclusion === 'success' ? 'workflow-success' : 'workflow-failed', snapshot };
    await wait(Math.min(delay, Math.max(0, deadline - now())));
  }
  const result = { state: 'timed-out', snapshot: snapshot ?? null };
  await report(result);
  return result;
}

async function main() {
  const args = process.argv.slice(2), option = name => args.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3);
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
  const output = option('output');
  if (!output) throw new Error('Supply a fresh --output=PATH for the compact watcher record');
  if (existsSync(resolve(root, output))) throw new Error('Watcher output already exists; choose a fresh path');
  const result = await watchRun(root, {
    runId: option('run'), expectedCommit: option('commit'), timeoutMs: Number(option('timeout-seconds') || 2700) * 1000,
    report: record => { save(resolve(root, output), record); console.log(JSON.stringify(record)); },
  });
  save(resolve(root, output), result);
  console.log(JSON.stringify({ state: result.state, runId: option('run') }));
  process.exitCode = result.state === 'workflow-success' ? 0 : result.state === 'timed-out' ? 2 : 1;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(() => { console.error('Workflow watch failed; inspect the run directly. No publication success is claimed.'); process.exitCode = 1; });
}
