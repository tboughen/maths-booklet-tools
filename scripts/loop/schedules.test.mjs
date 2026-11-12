import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { monthSpend } from './spend.mjs';

test('the month\'s API spend is estimated from this month\'s judge and prompt-eval runs only', () => {
  const runs = [
    { workflowName: 'Judge panel', createdAt: '2026-11-02T10:00:00Z', conclusion: 'success' },
    { workflowName: 'Judge panel', createdAt: '2026-11-03T10:00:00Z', conclusion: 'failure' },
    { workflowName: 'Judge panel', createdAt: '2026-11-03T11:00:00Z', conclusion: 'cancelled' },
    { workflowName: 'Judge panel', createdAt: '2026-10-31T10:00:00Z', conclusion: 'success' },
    { name: 'Judge calibration', created_at: '2026-11-09T06:00:00Z', conclusion: 'success' },
    { workflowName: 'Quick checks', createdAt: '2026-11-09T06:00:00Z', conclusion: 'success' },
  ];
  const rates = { judgePanelRun: 0.15, judgeCalibrationRun: 1.5, promptEvalRun: 3 };
  assert.equal(monthSpend(runs, '2026-11-20T00:00:00Z', rates, [], null), 1.8);
  // A hand-started prompt-eval run counts against the same cap.
  assert.equal(monthSpend([...runs, { workflowName: 'Prompt evals', createdAt: '2026-11-11T09:00:00Z', conclusion: 'success' }], '2026-11-20T00:00:00Z', rates, [], null), 4.8);
  assert.equal(monthSpend([], '2026-11-20T00:00:00Z', rates, [], null), 0);
});

test('a judge run counts its recorded cost, and runs before cost records use the measured baseline', () => {
  const rates = { judgePanelRun: 0.5, judgeCalibrationRun: 1.5, promptEvalRun: 3 };
  const runs = [
    { databaseId: 1, workflowName: 'Judge panel', createdAt: '2026-11-05T10:00:00Z', conclusion: 'success' },
    { databaseId: 2, workflowName: 'Judge panel', createdAt: '2026-11-12T10:00:00Z', conclusion: 'success' },
    { databaseId: 3, workflowName: 'Judge panel', createdAt: '2026-11-12T11:00:00Z', conclusion: 'success' },
    { databaseId: 4, workflowName: 'Judge panel', createdAt: '2026-11-12T12:00:00Z', conclusion: 'success' },
    { databaseId: 5, workflowName: 'Judge calibration', createdAt: '2026-11-09T06:00:00Z', conclusion: 'success' },
  ];
  // Artifact listings from the API ({ workflow_run: { id } }) and from a simplified list ({ run }).
  const artifacts = [{ name: 'judge-cost-2.4113', workflow_run: { id: 2 } }, { name: 'judge-cost-0.0000', run: 3 }, { name: 'judge-panel', run: 4 }];
  // Run 2 and 3 cost what they recorded; run 4 has no record, so the rate; run 1 is estimated.
  assert.equal(monthSpend(runs, '2026-11-20T00:00:00Z', rates, artifacts, null), 4.91);
  // With the baseline, judge runs before its time are replaced by the measured figure.
  const baseline = { month: '2026-11', before: '2026-11-11T18:00:00Z', usd: 57.82 };
  assert.equal(monthSpend(runs, '2026-11-20T00:00:00Z', rates, artifacts, baseline), 62.23);
  // The baseline only applies in its month.
  assert.equal(monthSpend(runs.map(r => ({ ...r, createdAt: r.createdAt.replace('-11-', '-12-') })), '2026-12-20T00:00:00Z', rates, [], baseline), 0.5 * 4 + 1.5);
  // The real config's estimate is the November measurement, rounded up.
  assert.equal(monthSpend([runs[3]], '2026-11-20T00:00:00Z', undefined, [], null), 0.5);
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
