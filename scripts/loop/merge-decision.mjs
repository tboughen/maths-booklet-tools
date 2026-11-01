// Phase 2 auto-merge decision (docs/AUTONOMOUS-LOOP-POLICY.md, sections 2 to 4 and 7).
// A loop PR may be queued for auto-merge only when every condition below holds; otherwise it goes
// to Tim. The decision is pure: the loop-auto-merge workflow does the merge or the labelling.
//
//   node scripts/loop/merge-decision.mjs --pr-json=pr.json --checkout=pr --base=<sha> --review=review-shadow.json
//
// pr.json is the pull request from the REST API. The checkout is read with git only: pull-request
// code never runs. Writes `merge=true|false` to GITHUB_OUTPUT; if it throws, the workflow sends the PR
// to Tim.
import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { classifyGitDiff } from './classify-risk.mjs';
import { checkDiff, netFindings } from '../ci/test-integrity.mjs';

export const JUDGES = ['teacher', 'product', 'adversarial'];
export const LINE_CAP = 300;
const HOLD_LABELS = ['loop:hold', 'loop:needs-tim'];

/**
 * @param {object} input
 * @param {boolean} input.enabled   repository variable MATHSDOCK_LOOP_ENABLED is exactly "true"
 * @param {string[]} input.tiers     tiers enabled for the current phase (phase 2: T0, T1)
 * @param {object} input.pr          pull request (REST API shape)
 * @param {string} input.repository  owner/name of the base repository
 * @param {string} input.judgedSha   head commit the judges reviewed
 * @param {{tier: string, changedLines: number}} input.risk
 * @param {object[]} input.integrity test-integrity findings for the whole PR
 * @param {object | null} input.review contents of review-shadow.json, or null if the panel did not run
 */
export function decide({ enabled, tiers, pr, repository, judgedSha, risk, integrity, review }) {
  const reasons = [];
  if (!enabled) reasons.push('auto-merge is switched off (MATHSDOCK_LOOP_ENABLED is not "true")');
  if (!pr?.head?.ref?.startsWith('loop/')) reasons.push('not a loop PR (branch does not start with loop/)');
  if (pr?.head?.repo?.full_name !== repository) reasons.push('opened from a fork');
  if (pr?.state !== 'open') reasons.push('not open');
  if (pr?.draft) reasons.push('draft');
  if (!judgedSha || pr?.head?.sha !== judgedSha) reasons.push('the judges reviewed a different commit from the current head');
  const held = (pr?.labels ?? []).map(l => l.name).filter(n => HOLD_LABELS.includes(n));
  if (held.length) reasons.push(`labelled ${held.join(', ')}`);
  if (!tiers.includes(risk.tier)) reasons.push(`tier ${risk.tier} is not auto-merged in this phase (${tiers.join(', ') || 'none'})`);
  if (!(risk.changedLines <= LINE_CAP)) reasons.push(`${risk.changedLines} changed lines, over the ${LINE_CAP}-line cap`);
  // Policy T0: no assertion removed or weakened, no skip/only, no deleted test, no control hash changed.
  if (integrity.length) reasons.push(`test-integrity findings: ${integrity.map(f => `${f.kind} in ${f.file}`).slice(0, 3).join('; ')}`);
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
  const output = text => { if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, text); };
  const pr = JSON.parse(readFileSync(arg('pr-json'), 'utf8'));
  const cwd = arg('checkout') ?? '.';
  const base = arg('base');
  const reviewPath = arg('review') ?? 'review-shadow.json';
  const review = existsSync(reviewPath) ? JSON.parse(readFileSync(reviewPath, 'utf8')) : null;
  const risk = classifyGitDiff({ base, cwd });
  const diff = execFileSync('git', ['diff', '--no-renames', '-U0', base, 'HEAD'], { cwd, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
  const integrity = netFindings(checkDiff(diff), diff);
  const tiers = (process.env.LOOP_AUTO_TIERS ?? 'T0,T1').split(',').map(t => t.trim()).filter(Boolean);
  const result = decide({
    enabled: process.env.MATHSDOCK_LOOP_ENABLED === 'true', tiers, pr, repository: process.env.GITHUB_REPOSITORY,
    judgedSha: process.env.JUDGED_SHA, risk, integrity, review,
  });
  const lines = [`### Auto-merge for #${pr.number}: ${result.merge ? 'queued (waits for required checks)' : 'not merged, sent to Tim'}`, '',
    `Risk tier ${risk.tier}, ${risk.changedLines} changed lines.`, '', ...result.reasons.map(r => `- ${r}`), ''];
  console.log(lines.join('\n'));
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, lines.join('\n'));
  output(`merge=${result.merge}\n`);
}
