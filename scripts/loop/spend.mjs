// This month's loop API spend, estimated from the judge runs (improvement list L52). The judges are
// the loop's only API cost; loop sessions themselves use Tim's Claude plan. Each completed "Judge
// panel" run and each "Judge calibration" run is costed at the figures in config.json, measured on
// 1 November 2026 (about 15 cents per judged PR update).
//
//   node scripts/loop/spend.mjs --runs=runs.json [--now=ISO]
//
// runs.json is a list of workflow runs ([{ name or workflowName, createdAt or created_at, conclusion }]),
// from `gh run list --json workflowName,createdAt,conclusion` or the GitHub API. Prints the dollars.
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { CONFIG } from './preflight.mjs';

export function monthSpend(runs, now = new Date().toISOString(), rates = CONFIG.spendEstimateUSD) {
  const month = now.slice(0, 7);
  const cost = { 'Judge panel': rates.judgePanelRun, 'Judge calibration': rates.judgeCalibrationRun };
  let total = 0;
  for (const r of runs) {
    const name = r.workflowName ?? r.name, created = r.createdAt ?? r.created_at ?? '';
    if (!(name in cost) || !created.startsWith(month)) continue;
    if (r.conclusion === 'skipped' || r.conclusion === 'cancelled') continue;
    total += cost[name];
  }
  return Math.round(total * 100) / 100;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const arg = name => process.argv.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3);
  console.log(monthSpend(JSON.parse(readFileSync(arg('runs'), 'utf8')), arg('now') || new Date().toISOString()));
}
