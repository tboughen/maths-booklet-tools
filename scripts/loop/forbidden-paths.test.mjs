import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { forbidden, FORBIDDEN, isLoopBranch } from './forbidden-paths.mjs';
import { check } from './guard-edit.mjs';
import { tierOf } from './classify-risk.mjs';

const root = '/repo';
const edit = file_path => ({ cwd: root, tool_name: 'Edit', tool_input: { file_path } });

test('the deny-list covers release, CI, loop, bank and hook paths, and nothing ordinary', () => {
  for (const p of ['.github/workflows/quick-checks.yml', 'scripts/loop/judge.mjs', 'scripts/ci/plan.mjs', '.claude/settings.json', 'package.json', 'package-lock.json', 'public/bank/catalogue.json', 'bankAssets.ts', 'vite.config.ts', 'playwright.config.ts', 'wrangler.jsonc', '.gitmodules', 'index.html'])
    assert.ok(forbidden(p), p);
  for (const p of ['src/venn/VennPage.tsx', 'src/gates/corpus.test.ts', 'docs/tools/VENN-TOOL.md', 'packages/venn-core/src/index.ts', 'e2e/venn.spec.ts', 'src/site/index.html'])
    assert.equal(forbidden(p), null, p);
});

test('every deny-listed path is tier T8, and every entry says why', () => {
  for (const f of FORBIDDEN) assert.ok(f.why, f.pattern);
  for (const p of ['.claude/settings.json', '.github/x.yml', 'scripts/bank/a.mjs', 'tsconfig.json', 'eslint.config.js']) assert.equal(tierOf(p).tier, 'T8', p);
});

test('the guard blocks deny-listed edits only in loop sessions', () => {
  const loop = { env: {}, branch: 'loop/12-venn-labels', root };
  assert.equal(check(edit('/repo/.github/workflows/quick-checks.yml'), loop).block, true);
  assert.match(check(edit('/repo/.claude/settings.json'), loop).message, /deny-list/);
  assert.equal(check({ ...edit('scripts/loop/judge.mjs') }, loop).block, true, 'relative paths resolve from cwd');
  assert.equal(check({ cwd: root, tool_name: 'NotebookEdit', tool_input: { notebook_path: '/repo/package.json' } }, loop).block, true);
  assert.equal(check(edit('/repo/src/venn/VennPage.tsx'), loop).block, false);
  assert.equal(check(edit('/repo/../etc/x'), loop).block, false, 'outside the repository is not the guard\'s business');
  assert.equal(check(edit('/repo/.github/workflows/quick-checks.yml'), { env: { MATHSDOCK_LOOP_SESSION: '1' }, branch: 'main', root }).block, true);
  assert.equal(check(edit('/repo/.github/workflows/quick-checks.yml'), { env: {}, branch: 'claude/project-thread', root }).block, false);
  assert.equal(isLoopBranch('loop/1-a'), true);
  assert.equal(isLoopBranch('claude/loop/1'), false);
});

test('the hook exits 2 with a message, and is registered for every editing tool', () => {
  const run = spawnSync('node', ['scripts/loop/guard-edit.mjs'], {
    input: JSON.stringify({ cwd: process.cwd(), tool_name: 'Write', tool_input: { file_path: 'package.json' } }),
    env: { ...process.env, MATHSDOCK_LOOP_SESSION: '1' }, encoding: 'utf8',
  });
  assert.equal(run.status, 2);
  assert.match(run.stderr, /package\.json/);
  const allowed = spawnSync('node', ['scripts/loop/guard-edit.mjs'], { input: 'not json', env: { ...process.env, MATHSDOCK_LOOP_SESSION: '1' }, encoding: 'utf8' });
  assert.equal(allowed.status, 0);
  const settings = JSON.parse(readFileSync('.claude/settings.json', 'utf8'));
  const hook = settings.hooks.PreToolUse.find(h => h.hooks.some(x => x.command.includes('scripts/loop/guard-edit.mjs')));
  for (const tool of ['Edit', 'MultiEdit', 'Write', 'NotebookEdit']) assert.ok(new RegExp(`^(?:${hook.matcher})$`).test(tool), tool);
});

test('quick checks refuse deny-listed paths on loop branches', () => {
  const yml = readFileSync('.github/workflows/quick-checks.yml', 'utf8');
  assert.match(yml, /node scripts\/loop\/forbidden-paths\.mjs --base=HEAD\^1 "--branch=\$BRANCH"/);
});
