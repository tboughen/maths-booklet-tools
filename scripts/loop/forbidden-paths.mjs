// The loop's hard path deny-list (improvement list L56), read from forbidden-paths.json. A loop
// session must never author these paths. Two independent checks enforce it: guard-edit.mjs stops
// the session writing them, and this script (in quick checks) plus the trusted merge decision stop a
// loop/ pull request that touches them from merging.
//
//   node scripts/loop/forbidden-paths.mjs --base=HEAD^1 --branch=<head branch>
//
// Fails only for loop/ branches; any other branch just reports.
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const list = JSON.parse(readFileSync(new URL('./forbidden-paths.json', import.meta.url), 'utf8'));
export const FORBIDDEN = list.paths.map(p => ({ re: new RegExp(p.pattern), why: p.why, pattern: p.pattern }));
/** One regular expression matching any forbidden path, for the risk classifier's T8 rule. */
export const FORBIDDEN_RE = new RegExp(list.paths.map(p => `(?:${p.pattern})`).join('|'));

/** Normalises a path to repository-relative form with forward slashes. */
export function relative(path, root = '') {
  let p = String(path).replaceAll('\\', '/');
  const r = String(root).replaceAll('\\', '/').replace(/\/+$/, '');
  if (r && (p === r || p.startsWith(r + '/'))) p = p.slice(r.length + 1);
  return p.replace(/^\.\//, '');
}

/** The deny-list entry a path matches, or null. */
export function forbidden(path) {
  const p = relative(path);
  return FORBIDDEN.find(f => f.re.test(p)) ?? null;
}

export const isLoopBranch = branch => typeof branch === 'string' && branch.startsWith('loop/');

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const arg = name => process.argv.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3) || '';
  const base = arg('base') || 'HEAD^1', branch = arg('branch');
  const paths = execFileSync('git', ['diff', '--no-renames', '--name-only', base, 'HEAD'], { encoding: 'utf8' }).split('\n').filter(Boolean);
  const hits = paths.map(p => [p, forbidden(p)]).filter(([, f]) => f);
  for (const [p, f] of hits) console.log(`${isLoopBranch(branch) ? '::error' : '::notice'} file=${p}::forbidden for loop sessions (${f.why})`);
  console.log(`forbidden paths: ${hits.length} of ${paths.length} changed file(s)${isLoopBranch(branch) ? ' on a loop branch' : ''}`);
  if (hits.length && isLoopBranch(branch)) process.exit(1);
}
