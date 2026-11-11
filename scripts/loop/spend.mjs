// This month's API spend on the judges' key (improvement list L52). The judges and the on-demand
// prompt evals are the only API costs; loop sessions themselves use Tim's Claude plan.
//
// Since 11 November 2026 every "Judge panel" run records its real cost, priced from the token
// usage the API returned (scripts/loop/judge.mjs), as a small artifact named judge-cost-<dollars>.
// A judge run with that artifact counts its real cost. Older judge runs, and "Judge calibration"
// and "Prompt evals" runs, are costed at the figures in config.json: the judge figure is the
// November 2026 average measured from the recorded usage of 124 judged runs ($57.82, so about
// 47 cents a run, rounded up to 50; feature pull requests cost up to $2.50 a run, small loop
// pull requests about 20 cents), and prompt evals the $2.64 measured on 10 November 2026, rounded
// up to $3. config.json's judgeSpendBaseline holds that measured November figure for the judge
// runs before cost artifacts existed.
//
//   node scripts/loop/spend.mjs --runs=runs.json [--costs=costs.json] [--now=ISO]
//
// runs.json is a list of workflow runs ([{ databaseId or id, name or workflowName, createdAt or
// created_at, conclusion }]) from `gh run list --json databaseId,workflowName,createdAt,conclusion`
// or the GitHub API. costs.json is a list of artifacts ([{ name, workflow_run: { id } }] or
// [{ name, run }]) from GET /repos/{owner}/{repo}/actions/artifacts. Prints the dollars.
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { CONFIG } from './preflight.mjs';

export const COST_ARTIFACT = /^judge-cost-(\d+(?:\.\d+)?)$/;

/** Real judge-run costs by workflow run id, from the cost artifacts. */
export function measuredCosts(artifacts = []) {
  const costs = new Map();
  for (const a of artifacts) {
    const m = String(a?.name ?? '').match(COST_ARTIFACT), run = a?.workflow_run?.id ?? a?.run;
    // A re-run attempt records its own cost under the same run id, so the attempts add up.
    if (m && run != null) costs.set(String(run), (costs.get(String(run)) ?? 0) + Number(m[1]));
  }
  return costs;
}

/**
 * baseline ({ month, before, usd }) replaces the judge runs of that month created before `before`
 * with a figure measured from their recorded usage (the runs before cost artifacts existed).
 */
export function monthSpend(runs, now = new Date().toISOString(), rates = CONFIG.spendEstimateUSD, artifacts = [], baseline = CONFIG.judgeSpendBaseline) {
  const month = now.slice(0, 7);
  const cost = { 'Judge panel': rates.judgePanelRun, 'Judge calibration': rates.judgeCalibrationRun, 'Prompt evals': rates.promptEvalRun };
  const measured = measuredCosts(artifacts);
  const base = baseline?.month === month ? baseline : null;
  let total = base ? base.usd : 0;
  for (const r of runs) {
    const name = r.workflowName ?? r.name, created = r.createdAt ?? r.created_at ?? '';
    if (!(name in cost) || !created.startsWith(month)) continue;
    if (r.conclusion === 'skipped' || r.conclusion === 'cancelled') continue;
    const id = String(r.databaseId ?? r.id ?? '');
    if (name === 'Judge panel' && measured.has(id)) total += measured.get(id);
    else if (name === 'Judge panel' && base && created < base.before) continue;
    else total += cost[name];
  }
  return Math.round(total * 100) / 100;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const arg = name => process.argv.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3);
  const costs = arg('costs') ? JSON.parse(readFileSync(arg('costs'), 'utf8')) : [];
  console.log(monthSpend(JSON.parse(readFileSync(arg('runs'), 'utf8')), arg('now') || new Date().toISOString(), undefined, costs));
}
