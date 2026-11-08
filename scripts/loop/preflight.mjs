// Loop session preflight (improvement list L52 budget caps, L54 concurrency). A loop session runs
// this before doing any work and stops if it says no. It decides from facts the session gathers
// with its GitHub tools and writes to a state file, so it needs no token of its own:
//
//   node scripts/loop/preflight.mjs --state=loop-state.json
//
// loop-state.json: {
//   "now": ISO time, "loopEnabled": bool (repository variable MATHSDOCK_LOOP_ENABLED is "true"),
//   "monthSpendUSD": number, "issues": [{ number, title, body, labels: [name], createdAt }],
//   "pullRequests": [{ number, headRefName, state: "open"|"closed"|"merged", createdAt, files: [path] }]
// }
// Prints the chosen issue and its branch name, or why the session must stop. Exit 1 means stop.
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { forbidden, isLoopBranch } from './forbidden-paths.mjs';

export const CONFIG = JSON.parse(readFileSync(new URL('./config.json', import.meta.url), 'utf8'));
const BLOCKING_LABELS = ['loop:in-progress', 'loop:blocked', 'loop:needs-tim', 'loop:hold', 'loop:reverted'];
const DAY = 24 * 60 * 60 * 1000;

/** The `### Heading` sections of an issue-form body, keyed by lower-case heading. */
export function sections(body = '') {
  const out = {};
  for (const part of String(body).split(/^### /m).slice(1)) {
    const [head, ...rest] = part.split('\n');
    out[head.trim().toLowerCase()] = rest.join('\n').trim();
  }
  return out;
}

/** A path glob (`*` within a folder, `**` across folders) as a regular expression. */
export function globRe(glob) {
  let re = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*' && glob[i + 1] === '*') { re += '.*'; i++; if (glob[i + 1] === '/') i++; }
    else if (c === '*') re += '[^/]*';
    else re += c.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${re}$`);
}

/** The issue's declared paths, tier and item code. */
export function itemOf(issue) {
  const s = sections(issue.body);
  const paths = (s.paths ?? '').split('\n').map(l => l.replace(/^[-*]\s*/, '').replace(/`/g, '').trim()).filter(l => l && l !== '_No response_');
  const tier = (s.tier ?? '').match(/\bT[0-8]\b/)?.[0] ?? null;
  return { number: issue.number, title: issue.title, item: (s.item ?? '').trim(), tier, paths };
}

const slug = text => String(text).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40).replace(/-$/, '');

/**
 * @returns {{ go: boolean, reasons: string[], issue?: object, branch?: string, skipped: {number: number, why: string}[] }}
 */
export function preflight(state, config = CONFIG) {
  const reasons = [], skipped = [];
  const now = Date.parse(state.now ?? new Date().toISOString());
  if (state.loopEnabled !== true) reasons.push('the loop is switched off (MATHSDOCK_LOOP_ENABLED is not "true")');
  if (typeof config.monthlySpendCapUSD !== 'number') reasons.push('no monthly spend cap is set in scripts/loop/config.json (Tim sets monthlySpendCapUSD)');
  else if (!(Number(state.monthSpendUSD) < config.monthlySpendCapUSD)) reasons.push(`this month's spend (${state.monthSpendUSD} USD) has reached the cap of ${config.monthlySpendCapUSD} USD`);
  const prs = state.pullRequests ?? [];
  const loopPRs = prs.filter(p => isLoopBranch(p.headRefName));
  const tonight = loopPRs.filter(p => now - Date.parse(p.createdAt) < DAY).length;
  if (tonight >= config.maxSessionsPerNight) reasons.push(`${tonight} loop PRs opened in the last 24 hours (cap ${config.maxSessionsPerNight})`);
  const open = loopPRs.filter(p => p.state === 'open');
  if (open.length >= config.maxOpenLoopPRs) reasons.push(`${open.length} loop PRs are open (cap ${config.maxOpenLoopPRs})`);
  if (reasons.length) return { go: false, reasons, skipped };

  const busy = prs.filter(p => p.state === 'open').flatMap(p => (p.files ?? []).map(f => ({ file: f, pr: p.number })));
  const taken = new Set(open.map(p => Number(p.headRefName.match(/^loop\/(\d+)-/)?.[1])));
  const candidates = (state.issues ?? [])
    .filter(i => (i.labels ?? []).includes('loop:candidate'))
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt) || a.number - b.number);
  for (const issue of candidates) {
    const item = itemOf(issue);
    const skip = why => skipped.push({ number: issue.number, why });
    const blocked = (issue.labels ?? []).filter(l => BLOCKING_LABELS.includes(l));
    if (blocked.length) { skip(`labelled ${blocked.join(', ')}`); continue; }
    if (taken.has(issue.number)) { skip('already has an open loop PR'); continue; }
    if (!item.tier) { skip('no tier'); continue; }
    if (!config.authorTiers.includes(item.tier)) { skip(`tier ${item.tier} is not one the loop authors (${config.authorTiers.join(', ')})`); continue; }
    if (!item.paths.length) { skip('no declared paths, so overlap cannot be checked'); continue; }
    const denied = item.paths.filter(p => forbidden(p.replace(/\*.*$/, '')) || forbidden(p));
    if (denied.length) { skip(`declares deny-listed paths (${denied.join(', ')})`); continue; }
    const res = item.paths.map(globRe);
    const overlap = busy.filter(b => res.some(re => re.test(b.file)));
    if (overlap.length) { skip(`overlaps open PR #${overlap[0].pr} (${overlap[0].file})`); continue; }
    return { go: true, reasons: [], issue: item, branch: `loop/${issue.number}-${slug(item.item || item.title) || 'item'}`, skipped };
  }
  return { go: false, reasons: ['no loop:candidate issue is free to work on'], skipped };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const file = process.argv.find(a => a.startsWith('--state='))?.slice(8);
  if (!file) throw Error('Usage: node scripts/loop/preflight.mjs --state=loop-state.json');
  const result = preflight(JSON.parse(readFileSync(file, 'utf8')));
  for (const s of result.skipped) console.log(`skip #${s.number}: ${s.why}`);
  if (result.go) console.log(`go: #${result.issue.number} ${result.issue.title} (${result.issue.tier}) on ${result.branch}`);
  else for (const r of result.reasons) console.log(`stop: ${r}`);
  process.exit(result.go ? 0 : 1);
}
