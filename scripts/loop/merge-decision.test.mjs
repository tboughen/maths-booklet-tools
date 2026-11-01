import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { decide } from './merge-decision.mjs';
import { classifyGitDiff } from './classify-risk.mjs';

const repository = 'tboughen/maths-booklet-tools';
const sha = 'a'.repeat(40);
const pass = { overall: 'pass', results: ['teacher', 'product', 'adversarial'].map(judge => ({ judge, verdict: { verdict: 'pass' } })) };
const base = () => ({
  enabled: true,
  tiers: ['T0', 'T1'],
  pr: { number: 7, state: 'open', draft: false, base: { ref: 'main' }, labels: [{ name: 'loop:shadow' }], head: { ref: 'loop/u1-test', sha, repo: { full_name: repository } } },
  repository,
  judgedSha: sha,
  risk: { tier: 'T0', changedLines: 40 },
  integrity: [],
  review: structuredClone(pass),
});

test('a small T0 or T1 loop PR with a unanimous pass is queued', () => {
  assert.deepEqual(decide(base()), { merge: true, reasons: [] });
  assert.equal(decide({ ...base(), risk: { tier: 'T1', changedLines: 10 } }).merge, true);
});

test('any judge concern, fail or missing judge sends the PR to Tim', () => {
  for (const verdict of ['concerns', 'fail']) {
    const input = base();
    input.review.results[2].verdict.verdict = verdict;
    input.review.overall = verdict;
    const result = decide(input);
    assert.equal(result.merge, false, verdict);
    assert.match(result.reasons.join(), new RegExp(`adversarial: ${verdict}`));
  }
  const missing = base();
  missing.review.results.pop();
  assert.equal(decide(missing).merge, false, 'a judge that did not run');
  const errored = base();
  delete errored.review.results[0].verdict;
  assert.equal(decide(errored).merge, false, 'a judge that returned no verdict');
  assert.equal(decide({ ...base(), review: null }).merge, false, 'the panel did not run');
  const inconsistent = base();
  inconsistent.review.overall = 'concerns';
  assert.equal(decide(inconsistent).merge, false, 'overall must also be pass');
});

test('tiers, line cap, integrity findings, stale verdicts, holds, drafts, forks, branches and the switch all block', () => {
  for (const tier of ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8'])
    assert.equal(decide({ ...base(), risk: { tier, changedLines: 5 } }).merge, false, tier);
  assert.equal(decide({ ...base(), risk: { tier: 'T0', changedLines: 301 } }).merge, false, 'line cap');
  assert.equal(decide({ ...base(), risk: { tier: 'T0', changedLines: 300 } }).merge, true, 'at the cap');
  assert.equal(decide({ ...base(), risk: { tier: 'T0', changedLines: Number.NaN } }).merge, false, 'unknown line count');
  assert.equal(decide({ ...base(), integrity: [{ level: 'warning', kind: 'removed assertion', file: 'src/a.test.ts' }] }).merge, false, 'integrity');
  assert.equal(decide({ ...base(), judgedSha: 'b'.repeat(40) }).merge, false, 'judges saw an older commit');
  assert.equal(decide({ ...base(), judgedSha: undefined }).merge, false, 'no judged commit');
  for (const name of ['loop:hold', 'loop:needs-tim']) {
    const input = base();
    input.pr.labels.push({ name });
    assert.equal(decide(input).merge, false, name);
  }
  const stacked = base(); stacked.pr.base.ref = 'loop/u0-other';
  assert.equal(decide(stacked).merge, false, 'targets another branch');
  const closed = base(); closed.pr.state = 'closed';
  assert.equal(decide(closed).merge, false, 'closed');
  const draft = base(); draft.pr.draft = true;
  assert.equal(decide(draft).merge, false, 'draft');
  const fork = base(); fork.pr.head.repo.full_name = 'someone/maths-booklet-tools';
  assert.equal(decide(fork).merge, false, 'fork');
  const thread = base(); thread.pr.head.ref = 'claude/project-thread';
  assert.equal(decide(thread).merge, false, 'thread PR');
  assert.equal(decide({ ...base(), enabled: false }).merge, false, 'switched off');
  assert.equal(decide({ ...base(), tiers: [] }).merge, false, 'no tiers enabled');
});

test('classifyGitDiff reads tier, deleted tests and line count from a real checkout', () => {
  const dir = mkdtempSync(join(tmpdir(), 'merge-decision-'));
  const git = (...args) => execFileSync('git', args, { cwd: dir, encoding: 'utf8' }).trim();
  const write = (path, text) => { mkdirSync(join(dir, path, '..'), { recursive: true }); writeFileSync(join(dir, path), text); };
  try {
    git('init', '-q', '-b', 'main');
    git('config', 'user.email', 'test@example.com');
    git('config', 'user.name', 'Test');
    write('src/a.test.ts', 'test("a", () => {});\n');
    write('docs/tools/VENN-TOOL.md', '# Venn\n');
    git('add', '.'); git('commit', '-q', '-m', 'base');
    const start = git('rev-parse', 'HEAD');

    write('src/b.test.ts', 'line\n'.repeat(12));
    write('src/gates/golden/outputs.json', 'x\n'.repeat(500));
    git('add', '.'); git('commit', '-q', '-m', 'add a test and a golden');
    const added = classifyGitDiff({ base: start, cwd: dir });
    assert.equal(added.tier, 'T4', 'a golden change raises the tier above T0');
    assert.equal(added.changedLines, 12, 'golden lines are not counted towards the cap');

    git('reset', '-q', '--hard', start);
    write('docs/tools/VENN-TOOL.md', '# Venn\n\nMore notes.\n');
    git('commit', '-qam', 'notes');
    assert.deepEqual([classifyGitDiff({ base: start, cwd: dir }).tier, classifyGitDiff({ base: start, cwd: dir }).changedLines], ['T1', 2]);

    git('reset', '-q', '--hard', start);
    git('rm', '-q', 'src/a.test.ts');
    write('src/c.test.ts', 'test("c", () => {});\n');
    git('add', '.'); git('commit', '-q', '-m', 'swap a test');
    assert.equal(classifyGitDiff({ base: start, cwd: dir }).tier, 'T3', 'deleting a test is not a test addition');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
