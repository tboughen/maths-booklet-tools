import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { planChecks, FULL } from './plan.mjs';

const pr = paths => planChecks({ event: 'pull_request', paths });

test('runs everything outside pull requests or without a baseline', () => {
  for (const event of ['push', 'schedule', 'workflow_dispatch', '']) assert.equal(planChecks({ event, paths: ['docs/README.md'] }).mode, 'full');
  assert.deepEqual({ ...pr(null), reason: '' }, FULL);
});

test('skips everything for documentation prose only', () => {
  for (const paths of [['docs/README.md'], ['AGENTS.md', 'CLAUDE.md', 'docs/tools/BAR-MODEL-V3.md']]) {
    const plan = pr(paths);
    assert.equal(plan.mode, 'skip'); assert.equal(plan.bank, 'none'); assert.equal(plan.lint, false); assert.equal(plan.build, false);
  }
});

test('example data under docs/ is test input, not prose', () => {
  const plan = pr(['docs/venn-examples/card.json']);
  assert.equal(plan.tests, 'all'); assert.equal(plan.bank, 'lite');
});

test('website code runs affected tests, the lite bank and a build without the solution-file check', () => {
  assert.deepEqual(pr(['src/site/registry.ts']), { mode: 'quick', bank: 'lite', lint: true, tests: 'affected', build: true, solutionFiles: false, reason: 'website' });
});

test('service-only changes skip the website build', () => {
  const plan = pr(['services/graph-mcp/server.ts']);
  assert.equal(plan.build, false); assert.equal(plan.tests, 'affected');
});

test('infrastructure, workflows and unknown paths run every test', () => {
  for (const path of ['.github/workflows/quick-checks.yml', 'scripts/ci/plan.mjs', 'eslint.config.js', 'surprise-file', 'playwright.config.ts', 'src/test/setup.ts', 'src/gates/print-baseline.json']) {
    const plan = pr([path]);
    assert.equal(plan.tests, 'all', path); assert.equal(plan.build, true, path);
  }
});

test('anything the worked-solution check reads uses the full bank and runs the check', () => {
  for (const path of ['public/bank/catalogue.json', 'public/bank/assets', 'scripts/bank/solution-files.ts', 'workedSolution.ts', 'bankAssets.ts', 'vite.config.ts', 'package-lock.json']) {
    const plan = pr([path]);
    assert.equal(plan.bank, 'full', path); assert.equal(plan.solutionFiles, true, path); assert.equal(plan.tests, 'all', path);
  }
});

test('the lite bank list is a sorted set of bank question folders', () => {
  const lines = readFileSync(new URL('./lite-bank.txt', import.meta.url), 'utf8').trim().split('\n');
  assert.ok(lines.length > 0);
  assert.deepEqual(lines, [...new Set(lines)].sort());
  for (const line of lines) assert.match(line, /^[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+$/);
});
