// Runs the judge panel over the seeded calibration set (review/calibration/cases.json) and reports
// how many known-bad changes it fails and how many good ones it lets through. This spends API
// credit (about nine panel runs), so it only runs by hand: the "Judge calibration" workflow or
//   ANTHROPIC_API_KEY=... node scripts/loop/calibrate.mjs [--out=calibration.json]
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { classifyRisk } from './classify-risk.mjs';
import { EFFORT, MODEL, panel, pathsOf, runPanel } from './judge.mjs';

export function score(rows) {
  const bad = rows.filter(r => r.expect === 'fail'), good = rows.filter(r => r.expect === 'pass');
  return {
    caught: bad.filter(r => r.overall === 'fail').length,
    flagged: bad.filter(r => r.overall === 'concerns').length,
    missed: bad.filter(r => r.overall === 'pass').length,
    bad: bad.length,
    falseFails: good.filter(r => r.overall === 'fail').length,
    good: good.length,
    abstained: rows.filter(r => r.overall === 'abstain').length,
  };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const out = process.argv.find(a => a.startsWith('--out='))?.slice(6) || 'calibration.json';
  if (!process.env.ANTHROPIC_API_KEY) { console.error('ANTHROPIC_API_KEY is not set.'); process.exit(1); }
  const { cases } = JSON.parse(readFileSync('review/calibration/cases.json', 'utf8'));
  const rows = [];
  for (const c of cases) {
    const diff = readFileSync(`review/calibration/${c.diff}`, 'utf8');
    const tier = classifyRisk(pathsOf(diff)).tier;
    const results = await runPanel({ diff, tier, title: c.title, body: c.body });
    rows.push({ ...c, tier, overall: panel(results), results });
    console.log(`${c.diff}: expected ${c.expect}, panel ${rows.at(-1).overall} (${results.map(r => `${r.judge} ${r.verdict?.verdict ?? 'did not run'}`).join(', ')})`);
  }
  const s = score(rows);
  const text = [`### Judge calibration (${MODEL}, effort ${EFFORT})`, '',
    `Known-bad changes failed: ${s.caught} of ${s.bad} (${s.flagged} only flagged as concerns, ${s.missed} passed).`,
    `Good changes failed: ${s.falseFails} of ${s.good}. Abstained: ${s.abstained}.`, '',
    '| Case | Tier | Expected | Panel | Teacher | Product | Adversarial |', '| --- | --- | --- | --- | --- | --- | --- |',
    ...rows.map(r => `| ${r.diff} | ${r.tier} | ${r.expect} | ${r.overall} | ${r.results.map(x => (x.verdict?.verdict ?? 'did not run') + (x.model && x.model !== MODEL ? ` (${x.model})` : '')).join(' | ')} |`), ''].join('\n');
  console.log(text);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, text);
  writeFileSync(out, JSON.stringify({ model: MODEL, effort: EFFORT, score: s, rows }, null, 2) + '\n');
}
