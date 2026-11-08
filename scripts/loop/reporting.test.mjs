import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BLOCKING, meetsTargets } from './calibrate.mjs';
import { areaOf, digest } from './digest.mjs';
import { commitsSince, summarise } from './release-summary.mjs';

const cases = JSON.parse(readFileSync('review/calibration/cases.json', 'utf8')).cases;
const run = (overall) => cases.map(c => ({ ...c, overall: overall(c) }));

test('calibration meets its targets only when every blocking case is caught and few good changes fail', () => {
  for (const b of BLOCKING) assert.ok(cases.some(c => c.diff === b && c.expect === 'fail'), b);
  const perfect = meetsTargets(run(c => c.expect));
  assert.equal(perfect.met, true, perfect.misses.join());
  const flaggedOnly = meetsTargets(run(c => (c.diff === 'answer-leak.diff' ? 'concerns' : c.expect)));
  assert.equal(flaggedOnly.met, false, 'a blocking case only flagged as concerns is a miss');
  assert.match(flaggedOnly.misses.join(), /answer-leak\.diff/);
  const strict = meetsTargets(run(() => 'fail'));
  assert.equal(strict.met, false, 'failing every good change is not calibrated either');
  assert.match(strict.misses.join(), /good changes/);
});

const pr = (number, extra) => ({ number, title: `PR ${number}`, url: `https://example.test/${number}`, headRefName: `loop/${number}-x`, state: 'MERGED', createdAt: '2026-11-10T00:00:00Z', mergedAt: '2026-11-11T00:00:00Z', closedAt: '2026-11-11T00:00:00Z', labels: [], files: [{ path: 'src/venn/venn.test.ts' }], ...extra });

test('the digest groups merged loop work and shows what waits for Tim', () => {
  const prs = [
    pr(1),
    pr(2, { files: [{ path: 'e2e/charts.spec.ts' }] }),
    pr(3, { state: 'OPEN', mergedAt: null, closedAt: null, labels: [{ name: 'loop:needs-tim' }], files: [{ path: 'src/venn/VennPage.tsx' }] }),
    pr(4, { state: 'CLOSED', mergedAt: null }),
    pr(5, { headRefName: 'claude/thread' }),
    pr(6, { mergedAt: '2026-10-01T00:00:00Z' }),
  ];
  const text = digest({ prs, calibration: { score: { caught: 7, bad: 7, falseFails: 0, good: 2 }, targets: { met: true, misses: [] } }, spendUSD: 4.2, enabled: false, now: '2026-11-14T00:00:00Z' });
  assert.match(text, /switched off/);
  assert.match(text, /4\.2 USD of no cap set/);
  assert.match(text, /2 merged, 1 waiting for you, 1 closed without merging, 0 reverted/);
  assert.match(text, /\*\*venn\*\*[\s\S]*#1[\s\S]*\*\*charts\*\*[\s\S]*#2/);
  assert.match(text, /### Waiting for you\n\n\| PR[\s\S]*\[#3\][^\n]*\| T3 \|/);
  assert.doesNotMatch(text, /#5\]|#6\]/, 'thread PRs and older merges are left out');
  assert.match(text, /7 of 7; good changes failed: 0 of 2; targets met/);
  assert.match(text, /- \[ \] \[#1\][^\n]*auto-merged/);
  assert.match(text, /- \[ \] \[#3\][^\n]*sent to you/);
  assert.equal(areaOf(['packages/venn-core/src/a.ts', 'src/venn/b.ts', 'docs/x.md']), 'venn');
});

test('the release summary lists every commit since the base with its tier and author', () => {
  const dir = mkdtempSync(join(tmpdir(), 'release-summary-'));
  const git = (...args) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.test', ...args], { cwd: dir, encoding: 'utf8' });
  git('init', '-q');
  writeFileSync(join(dir, 'a.txt'), '1'); git('add', '.'); git('commit', '-qm', 'base');
  const base = git('rev-parse', 'HEAD').trim();
  git('checkout', '-qb', 'work');
  execFileSync('mkdir', ['-p', join(dir, 'src/venn')]);
  writeFileSync(join(dir, 'src/venn/venn.test.ts'), 'x'); git('add', '.'); git('commit', '-qm', 'Add a Venn test (#7)');
  writeFileSync(join(dir, 'src/venn/VennPage.tsx'), 'x'); git('add', '.'); git('commit', '-qm', 'Tidy the Venn page (#8)');
  const commits = commitsSince(base, dir);
  assert.deepEqual(commits.map(c => c.paths), [['src/venn/VennPage.tsx'], ['src/venn/venn.test.ts']]);
  const { rows, markdown } = summarise(commits, [{ number: 7, headRefName: 'loop/7-x' }, { number: 8, headRefName: 'claude/thread' }]);
  assert.deepEqual(rows.map(r => [r.number, r.tier, r.loop]), [[8, 'T3', 'thread'], [7, 'T0', 'loop']]);
  assert.match(markdown, /2 commits[\s\S]*By tier: T0 1, T3 1\. Written by the loop: 1\./);
  assert.match(summarise(commits).markdown, /Written by the loop: unknown/);
  assert.match(summarise([]).markdown, /Nothing has changed/);
});

test('the digest and summary only read and report', () => {
  const digestYml = readFileSync('.github/workflows/loop-digest.yml', 'utf8');
  assert.match(digestYml, /^on:\n {2}workflow_dispatch:/m);
  assert.doesNotMatch(digestYml, /schedule:|gh issue|gh pr (?:comment|edit|merge|create)|: write\b/);
  const qualification = readFileSync('.github/workflows/graph-checks.yml', 'utf8');
  assert.match(qualification, /Summarise the changes since the last publication\n {8}if: inputs\.base != ''\n {8}continue-on-error: true/);
});
