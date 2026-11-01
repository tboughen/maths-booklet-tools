// Phase 2 auto-merge decision (docs/AUTONOMOUS-LOOP-POLICY.md, sections 2 to 4 and 7).
// A loop PR may be queued for auto-merge only when every condition below holds; otherwise it goes
// to Tim. The decision is pure: the workflow does the merge or the labelling.
//
//   node scripts/loop/merge-decision.mjs --pr=<checkout> --review=review-shadow.json
//
// It reads the pull request from GITHUB_EVENT_PATH and writes `merge=true|false` to GITHUB_OUTPUT.
// It never runs pull-request code: the PR checkout is read with git only.
import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { classifyGitDiff } from './classify-risk.mjs';

export const JUDGES = ['teacher', 'product', 'adversarial'];
export const LINE_CAP = 300;
const HOLD_LABELS = ['loop:hold', 'loop:needs-tim'];

/**
 * @param {object} input
 * @param {boolean} input.enabled  repository variable MATHSDOCK_LOOP_ENABLED is exactly "true"
 * @param {string[]} input.tiers    tiers enabled for the current phase (phase 2: T0, T1)
 * @param {object} input.pr         pull_request from the event payload
 * @param {string} input.repository owner/name of the base repository
 * @param {{tier: string, reasons: string[], changedLines: number}} input.risk
 * @param {object | null} input.review contents of review-shadow.json, or null if the panel did not run
 */
export function decide({ enabled, tiers, pr, repository, risk, review }) {
  const reasons = [];
  if (!enabled) reasons.push('auto-merge is switched off (MATHSDOCK_LOOP_ENABLED is not "true")');
  if (!pr?.head?.ref?.startsWith('loop/')) reasons.push('not a loop PR (branch does not start with loop/)');
  if (pr?.head?.repo?.full_name !== repository) reasons.push('opened from a fork');
  if (pr?.draft) reasons.push('draft');
  const held = (pr?.labels ?? []).map(l => l.name).filter(n => HOLD_LABELS.includes(n));
  if (held.length) reasons.push(`labelled ${held.join(', ')}`);
  if (!tiers.includes(risk.tier)) reasons.push(`tier ${risk.tier} is not auto-merged in this phase (${tiers.join(', ') || 'none'})`);
  if (risk.changedLines > LINE_CAP) reasons.push(`${risk.changedLines} changed lines, over the ${LINE_CAP}-line cap`);
  if (!review) reasons.push('the judge panel did not run');
  else {
    // The unanimous-pass rule: all three judges ran and each returned pass.
    const verdicts = Object.fromEntries((review.results ?? []).map(r => [r.judge, r.verdict?.verdict ?? 'did not run']));
    const notPass = JUDGES.filter(j => verdicts[j] !== 'pass');
    if (review.overall !== 'pass' || notPass.length)
      reasons.push(`not a unanimous pass (${JUDGES.map(j => `${j}: ${verdicts[j] ?? 'did not run'}`).join(', ')})`);
  }
  return { merge: reasons.length === 0, reasons };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const arg = name => process.argv.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3);
  const pr = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8')).pull_request;
  const reviewPath = arg('review') ?? 'review-shadow.json';
  const review = existsSync(reviewPath) ? JSON.parse(readFileSync(reviewPath, 'utf8')) : null;
  const risk = classifyGitDiff({ cwd: arg('pr') ?? '.' });
  const tiers = (process.env.LOOP_AUTO_TIERS ?? 'T0,T1').split(',').map(t => t.trim()).filter(Boolean);
  const result = decide({ enabled: process.env.MATHSDOCK_LOOP_ENABLED === 'true', tiers, pr, repository: process.env.GITHUB_REPOSITORY, risk, review });
  const lines = [`### Auto-merge: ${result.merge ? 'queued (waits for required checks)' : 'not merged, sent to Tim'}`, '',
    `Risk tier ${risk.tier}, ${risk.changedLines} changed lines.`, '', ...result.reasons.map(r => `- ${r}`), ''];
  console.log(lines.join('\n'));
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, lines.join('\n'));
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `merge=${result.merge}\n`);
}
