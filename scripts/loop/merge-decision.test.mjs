import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decide } from './merge-decision.mjs';

const repository = 'tboughen/maths-booklet-tools';
const pass = { overall: 'pass', results: ['teacher', 'product', 'adversarial'].map(judge => ({ judge, verdict: { verdict: 'pass' } })) };
const base = () => ({
  enabled: true,
  tiers: ['T0', 'T1'],
  pr: { head: { ref: 'loop/u1-test', repo: { full_name: repository } }, draft: false, labels: [{ name: 'loop:shadow' }] },
  repository,
  risk: { tier: 'T0', reasons: [], changedLines: 40 },
  review: structuredClone(pass),
});

test('a small T0 or T1 loop PR with a unanimous pass is queued', () => {
  assert.deepEqual(decide(base()), { merge: true, reasons: [] });
  assert.equal(decide({ ...base(), risk: { tier: 'T1', reasons: [], changedLines: 10 } }).merge, true);
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

test('tiers outside the phase, the line cap, holds, drafts, forks, non-loop branches and the switch all block', () => {
  for (const tier of ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8'])
    assert.equal(decide({ ...base(), risk: { tier, reasons: [], changedLines: 5 } }).merge, false, tier);
  assert.equal(decide({ ...base(), risk: { tier: 'T0', reasons: [], changedLines: 301 } }).merge, false, 'line cap');
  assert.equal(decide({ ...base(), risk: { tier: 'T0', reasons: [], changedLines: 300 } }).merge, true, 'at the cap');
  for (const name of ['loop:hold', 'loop:needs-tim']) {
    const input = base();
    input.pr.labels.push({ name });
    assert.equal(decide(input).merge, false, name);
  }
  const draft = base(); draft.pr.draft = true;
  assert.equal(decide(draft).merge, false, 'draft');
  const fork = base(); fork.pr.head.repo.full_name = 'someone/maths-booklet-tools';
  assert.equal(decide(fork).merge, false, 'fork');
  const thread = base(); thread.pr.head.ref = 'claude/project-thread';
  assert.equal(decide(thread).merge, false, 'thread PR');
  assert.equal(decide({ ...base(), enabled: false }).merge, false, 'switched off');
  assert.equal(decide({ ...base(), tiers: [] }).merge, false, 'no tiers enabled');
});
