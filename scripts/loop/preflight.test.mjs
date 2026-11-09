import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CONFIG, globRe, itemOf, preflight, sections } from './preflight.mjs';
import { BACKLOG, LABELS, issueFor, problems, seed } from './seed-issues.mjs';

const config = { ...CONFIG, monthlySpendCapUSD: 20 };
const now = '2026-11-09T02:00:00Z';
const issue = (number, extra = {}) => ({ number, title: `item ${number}`, createdAt: `2026-11-0${number}T00:00:00Z`, labels: ['loop:candidate'], ...issueFor(BACKLOG.find(e => e.item === 'S91')), ...extra });
const state = (extra = {}) => ({ now, loopEnabled: true, monthSpendUSD: 3, issues: [issue(1), issue(2)], pullRequests: [], ...extra });

test('picks the oldest free candidate and names its branch', () => {
  const r = preflight(state(), config);
  assert.equal(r.go, true, r.reasons.join('; '));
  assert.equal(r.issue.number, 1);
  assert.equal(r.issue.tier, 'T3');
  assert.match(r.branch, /^loop\/1-s91$/);
});

test('stops when the loop is off, no cap is set, the cap is reached or the nightly or open-PR caps are hit', () => {
  assert.match(preflight(state({ loopEnabled: false }), config).reasons.join(), /switched off/);
  assert.match(preflight(state(), { ...config, monthlySpendCapUSD: null }).reasons.join(), /no monthly spend cap/);
  assert.match(preflight(state({ monthSpendUSD: 20 }), config).reasons.join(), /reached the cap/);
  const recent = [1, 2, 3].map(n => ({ number: 100 + n, headRefName: `loop/${n}-x`, state: 'closed', createdAt: '2026-11-08T23:00:00Z', files: [] }));
  assert.match(preflight(state({ pullRequests: recent }), config).reasons.join(), /3 loop PRs opened in the last 24 hours/);
  const open = [1, 2, 3, 4, 5].map(n => ({ number: 100 + n, headRefName: `loop/${n}-x`, state: 'open', createdAt: '2026-11-01T00:00:00Z', files: [] }));
  assert.match(preflight(state({ pullRequests: open }), config).reasons.join(), /5 loop PRs are open/);
  assert.deepEqual([CONFIG.monthlySpendCapUSD, CONFIG.maxSessionsPerNight], [20, 1], 'the caps Tim set on 8 November 2026');
});

test('skips issues that are held, already taken, too risky, undeclared, deny-listed or overlapping open work', () => {
  const body = paths => issueFor({ ...BACKLOG.find(e => e.item === 'S91'), paths }).body;
  const issues = [
    issue(1, { labels: ['loop:candidate', 'loop:needs-tim'] }),
    issue(2),
    issue(3, { body: issueFor({ ...BACKLOG.find(e => e.item === 'S91'), tier: 'T5' }).body }),
    issue(4, { body: body([]) }),
    issue(5, { body: body(['.github/workflows/x.yml']) }),
    issue(6, { body: body(['src/venn/**']) }),
    issue(7, { body: body(['src/charts/ChartsPage.tsx']) }),
  ];
  const pullRequests = [
    { number: 50, headRefName: 'loop/2-s91', state: 'open', createdAt: '2026-11-01T00:00:00Z', files: ['src/bank/model.ts'] },
    { number: 51, headRefName: 'claude/thread', state: 'open', createdAt: '2026-11-01T00:00:00Z', files: ['src/venn/VennPage.tsx'] },
  ];
  const r = preflight(state({ issues, pullRequests }), config);
  assert.equal(r.go, true);
  assert.equal(r.issue.number, 7);
  assert.deepEqual(r.skipped.map(s => [s.number, s.why.split(' ')[0]]), [[1, 'labelled'], [2, 'already'], [3, 'tier'], [4, 'no'], [5, 'declares'], [6, 'overlaps']]);
  assert.match(r.skipped.at(-1).why, /#51 \(src\/venn\/VennPage\.tsx\)/);
});

test('reads issue-form bodies and path globs', () => {
  assert.deepEqual(sections('### Item\n\nU4\n\n### Paths\n\n- `src/a/**`\nsrc/b.ts\n'), { item: 'U4', paths: '- `src/a/**`\nsrc/b.ts' });
  assert.deepEqual(itemOf({ number: 1, title: 't', body: '### Item\n\nU4\n\n### Tier\n\nT3\n\n### Paths\n\n- `src/a/**`\n_No response_' }).paths, ['src/a/**']);
  assert.ok(globRe('src/*/export.ts').test('src/venn/export.ts'));
  assert.ok(!globRe('src/*/export.ts').test('src/venn/sub/export.ts'));
  assert.ok(globRe('src/bank/**').test('src/bank/a/b.ts'));
  assert.ok(globRe('packages/*-core/src/**/*.property.test.ts').test('packages/venn-core/src/regions.property.test.ts'));
});

test('the backlog seeds valid issues the loop can read back, and never twice', () => {
  for (const e of BACKLOG) assert.deepEqual(problems(e), [], e.item);
  const issues = seed();
  assert.equal(issues.length, BACKLOG.length);
  for (const [i, e] of BACKLOG.entries()) {
    const back = itemOf({ number: i + 1, title: issues[i].title, body: issues[i].body });
    assert.deepEqual([back.item, back.tier, back.paths], [e.item, e.tier, e.paths], e.item);
    assert.ok(issues[i].labels.includes(e.needsTim ? 'loop:needs-tim' : 'loop:candidate'));
  }
  assert.equal(seed(issues.slice(0, 3)).length, BACKLOG.length - 3);
  assert.deepEqual(problems({ ...BACKLOG[0], paths: ['scripts/ci/x.mjs'] }), ['deny-listed path scripts/ci/x.mjs']);
  const used = new Set(issues.flatMap(i => i.labels));
  for (const name of used) assert.ok(LABELS.some(l => l.name === name), name);
});

test('the issue form produces the headings preflight reads', () => {
  const form = readFileSync('.github/ISSUE_TEMPLATE/loop-item.yml', 'utf8');
  for (const heading of ['Item', 'Tier', 'Area', 'Paths', 'Acceptance criteria']) assert.match(form, new RegExp(`label: ${heading}\\n`), heading);
  assert.match(form, /labels: \["loop:candidate"\]/);
});

test('the judges stay inside the token cap, and the loop never dispatches release workflows', () => {
  const judge = readFileSync('scripts/loop/judge.mjs', 'utf8');
  const caps = [...judge.matchAll(/max_tokens:\s*(\d+)/g)].map(m => Number(m[1]));
  assert.ok(caps.length && caps.every(c => c <= CONFIG.maxJudgeOutputTokensPerCall), String(caps));
  const prompt = readFileSync('.claude/loop/PROMPT.md', 'utf8');
  for (const f of CONFIG.neverDispatch) assert.doesNotMatch(prompt, new RegExp(`dispatch[^\\n]*${f.replace('.', '\\.')}`), f);
  assert.match(prompt, /MATHSDOCK_LOOP_SESSION=1/);
  assert.match(prompt, /preflight\.mjs/);
});
