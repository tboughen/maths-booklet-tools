// Weekly loop digest for Tim (improvement list L50): what the loop merged, what waits for him, what
// was rejected or reverted, the judges' calibration and the spend against the cap, with a sample of
// verdicts to agree or disagree with (L42). The goal is under 15 minutes of Tim's time.
//
//   node scripts/loop/digest.mjs --prs=prs.json [--calibration=calibration.json] [--spend=12.5] [--enabled=true] [--now=ISO]
//
// prs.json is `gh pr list --state all --limit 200 --json number,title,headRefName,state,createdAt,mergedAt,closedAt,labels,files,url`.
// Writes Markdown to stdout and to the job summary when set. It posts nothing.
import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { classifyRisk } from './classify-risk.mjs';
import { isLoopBranch } from './forbidden-paths.mjs';
import { CONFIG } from './preflight.mjs';

const WEEK = 7 * 24 * 60 * 60 * 1000;
const labelled = (pr, name) => (pr.labels ?? []).some(l => (l.name ?? l) === name);
const pathsOf = pr => (pr.files ?? []).map(f => f.path ?? f);

/** The tool or area a pull request mostly touches, for grouping. */
export function areaOf(paths) {
  const areas = paths.map(p => p.match(/^src\/([^/]+)\//)?.[1] ?? p.match(/^packages\/([^/]+)-core\//)?.[1] ?? p.match(/^e2e\/([a-z-]+?)(?:-[a-z0-9]+)*\.spec\.ts$/)?.[1] ?? (p.startsWith('docs/') ? 'docs' : 'other'));
  const counts = new Map();
  for (const a of areas) counts.set(a, (counts.get(a) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'other';
}

export function digest({ prs, calibration = null, spendUSD = null, enabled = null, now = new Date().toISOString(), config = CONFIG }) {
  const t = Date.parse(now), recent = d => d && t - Date.parse(d) < WEEK;
  const loop = prs.filter(p => isLoopBranch(p.headRefName));
  const merged = loop.filter(p => recent(p.mergedAt));
  const rejected = loop.filter(p => p.state === 'CLOSED' && !p.mergedAt && recent(p.closedAt));
  const reverted = prs.filter(p => labelled(p, 'loop:reverted') && (recent(p.mergedAt) || recent(p.closedAt) || recent(p.createdAt)));
  const waiting = prs.filter(p => p.state === 'OPEN' && labelled(p, 'loop:needs-tim'));
  const row = p => `| [#${p.number}](${p.url}) | ${classifyRisk(pathsOf(p)).tier} | ${p.title.replace(/\|/g, '\\|')} |`;
  const table = (list, empty) => list.length ? ['| PR | Tier | Title |', '| --- | --- | --- |', ...list.map(row)] : [empty];
  const groups = new Map();
  for (const p of merged) { const a = areaOf(pathsOf(p)); groups.set(a, [...(groups.get(a) ?? []), p]); }
  const cap = config.monthlySpendCapUSD;
  const lines = [
    `## Loop digest, week to ${now.slice(0, 10)}`, '',
    `- Loop: ${enabled === null ? 'state unknown' : enabled ? 'switched on' : 'switched off'}; auto-merges ${config.autoMergeTiers.join(', ')}; authors up to ${config.authorTiers.at(-1)}.`,
    `- Spend this month: ${spendUSD === null ? 'not reported' : `${spendUSD} USD`} of ${typeof cap === 'number' ? `${cap} USD` : 'no cap set (the loop will not start)'}.`,
    `- This week: ${merged.length} merged, ${waiting.length} waiting for you, ${rejected.length} closed without merging, ${reverted.length} reverted.`, '',
    '### Waiting for you', '', ...table(waiting, 'Nothing.'), '',
    '### Merged this week', '',
    ...(merged.length ? [...groups].flatMap(([area, list]) => [`**${area}**`, '', ...table(list, ''), '']) : ['Nothing.', '']),
    '### Closed without merging, or reverted', '', ...table([...rejected, ...reverted], 'Nothing.'), '',
    '### Judge calibration', '',
    calibration ? `Known-bad changes failed: ${calibration.score.caught} of ${calibration.score.bad}; good changes failed: ${calibration.score.falseFails} of ${calibration.score.good}${calibration.targets ? `; targets ${calibration.targets.met ? 'met' : `not met (${calibration.targets.misses.join('; ')})`}` : ''}.` : 'No calibration run this week.', '',
  ];
  // L42: up to five merged and five sent-to-Tim loop PRs for Tim's agree or disagree.
  const sample = [...merged.slice(0, 5), ...loop.filter(p => labelled(p, 'loop:needs-tim') && recent(p.createdAt)).slice(0, 5)];
  if (sample.length) lines.push('### Do you agree?', '', 'For each, reply "agree" or "disagree" and why. This tracks how often the judges match your verdict.', '',
    ...sample.map(p => `- [ ] [#${p.number}](${p.url}) ${p.title}: ${p.mergedAt ? 'auto-merged' : 'sent to you'}`), '');
  return lines.join('\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const arg = name => process.argv.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3);
  const read = f => (f && existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : null);
  const text = digest({
    prs: read(arg('prs')) ?? [], calibration: read(arg('calibration')),
    spendUSD: arg('spend') ? Number(arg('spend')) : null,
    enabled: arg('enabled') === undefined || arg('enabled') === '' ? null : arg('enabled') === 'true',
    now: arg('now') || new Date().toISOString(),
  });
  console.log(text);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, text + '\n');
}
