import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { plan } from './post-merge.mjs';
import { CONFIG, preflight } from './preflight.mjs';

const sha = 'a'.repeat(40), runUrl = 'https://example.test/run/1';
const pull = (ref, number = 9) => ({ number, title: 'Add a Venn test', head: { ref }, merged_at: '2026-11-10T00:00:00Z' });

test('a loop merge that breaks main pauses the loop and prepares a revert for a person', () => {
  const p = plan({ sha, runUrl, pulls: [pull('loop/12-venn')], openIssues: [] });
  assert.equal(p.action, 'pause-and-revert');
  assert.deepEqual(p.labels, ['loop:paused', 'loop:reverted']);
  assert.equal(p.revertBranch, 'loop-revert/aaaaaaa');
  assert.match(p.title, /^Loop paused: #9 broke main \(aaaaaaa\)$/);
  assert.match(p.body, /draft pull request[\s\S]*flaky[\s\S]*Close this issue/);
});

test('anyone else\'s commit is never reverted, only reported, and nothing is opened twice', () => {
  for (const pulls of [[pull('claude/thread')], []]) {
    const p = plan({ sha, runUrl, pulls, openIssues: [] });
    assert.equal(p.action, 'report');
    assert.equal(p.revertBranch, null);
    assert.deepEqual(p.labels, ['main:failing']);
    assert.match(p.body, /nothing was reverted/);
  }
  assert.equal(plan({ sha, runUrl, pulls: [pull('loop/1-x')], openIssues: [{ title: 'Loop paused: #9 broke main (aaaaaaa)' }] }).action, 'none');
});

test('an open loop:paused issue stops every loop session', () => {
  const r = preflight({ now: '2026-11-10T02:00:00Z', loopEnabled: true, monthSpendUSD: 0, pullRequests: [],
    issues: [{ number: 40, title: 'Loop paused: #9 broke main', labels: ['loop:paused'], body: '', createdAt: '2026-11-10T00:00:00Z' }] }, { ...CONFIG, monthlySpendCapUSD: 20 });
  assert.equal(r.go, false);
  assert.match(r.reasons.join(), /paused until issue #40 is closed/);
});

test('the post-merge workflow runs only after quick checks fail on a push to main, from trusted code', () => {
  const yml = readFileSync('.github/workflows/loop-post-merge.yml', 'utf8');
  assert.match(yml, /workflow_run:\n {4}workflows: \[Quick checks\]\n {4}types: \[completed\]/);
  assert.match(yml, /conclusion == 'failure' && github\.event\.workflow_run\.event == 'push' && github\.event\.workflow_run\.head_branch == github\.event\.repository\.default_branch/);
  assert.match(yml, /ref: \$\{\{ github\.event\.repository\.default_branch \}\}/);
  assert.match(yml, /gh pr create [^\n]*--draft/);
  assert.doesNotMatch(yml, /gh pr merge "\$pr" --repo "\$GITHUB_REPOSITORY" --auto|--admin|git push --force|secrets\./);
  const quick = readFileSync('.github/workflows/quick-checks.yml', 'utf8');
  assert.match(quick, /^name: Quick checks$/m, 'the workflow_run name must match');
});
