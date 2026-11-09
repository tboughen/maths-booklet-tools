import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { monthSpend } from './spend.mjs';

test('the month\'s judge spend is estimated from this month\'s judge runs only', () => {
  const runs = [
    { workflowName: 'Judge panel', createdAt: '2026-11-02T10:00:00Z', conclusion: 'success' },
    { workflowName: 'Judge panel', createdAt: '2026-11-03T10:00:00Z', conclusion: 'failure' },
    { workflowName: 'Judge panel', createdAt: '2026-11-03T11:00:00Z', conclusion: 'cancelled' },
    { workflowName: 'Judge panel', createdAt: '2026-10-31T10:00:00Z', conclusion: 'success' },
    { name: 'Judge calibration', created_at: '2026-11-09T06:00:00Z', conclusion: 'success' },
    { workflowName: 'Quick checks', createdAt: '2026-11-09T06:00:00Z', conclusion: 'success' },
  ];
  assert.equal(monthSpend(runs, '2026-11-20T00:00:00Z'), 1.8);
  assert.equal(monthSpend([], '2026-11-20T00:00:00Z'), 0);
});

test('nightly qualification only qualifies, only when main changed, and never cancels a running one', () => {
  const yml = readFileSync('.github/workflows/nightly-qualification.yml', 'utf8');
  assert.match(yml, /schedule:\n {4}- cron: '23 1 \* \* \*'/);
  assert.match(yml, /gh workflow run graph-checks\.yml/);
  assert.doesNotMatch(yml, /cloudflare\.yml|deploy-mcp\.yml|secrets\./);
  assert.match(yml, /if \[ "\$head" = "\$last" \]; then[^\n]*exit 0/);
  assert.match(yml, /if \[ "\$busy" != "0" \]; then[^\n]*exit 0/);
  assert.match(yml, /permissions:\n {2}contents: read\n {2}actions: write\n/);
});
