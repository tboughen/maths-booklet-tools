// Decides how much of quick-checks.yml a change needs, so a pull request uses one short job
// and only the CI time its files can affect. Read docs/release/CI-THROUGHPUT.md before changing it.
//
//   node scripts/ci/plan.mjs --event=pull_request --base=<sha>   (writes to $GITHUB_OUTPUT when set)
//
// Anything it cannot place runs everything: unknown paths, workflow or config changes, a
// missing base, and every run that is not a pull request (main, nightly, manual).
import { appendFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { classifyPaths } from '../cloudflare/classify.mjs';

// Prose only. Example JSON, SVG and PNG under docs/ are read by tests, so they are not docs-only.
const proseOnly = /^(?:docs\/.*|[^/]+)\.md$/;
// The build checks every registered worked-solution file against the bank, so a change to any of
// these checks out the full bank and runs that check. Everything else uses the lite bank.
const solutionInputs = /^(?:public\/bank\/|scripts\/bank\/|workedSolution\.ts$|bankAssets\.ts$|vite\.config\.ts$|package(?:-lock)?\.json$|\.gitmodules$)/;
// Read from disk rather than imported, so vitest cannot trace them through the module graph.
const unimportedTestInputs = /^(?:docs\/|public\/|src\/test\/|vitest|tsconfig)/;

export const FULL = Object.freeze({ mode: 'full', bank: 'full', lint: true, tests: 'all', build: true, solutionFiles: true, reason: '' });

export function planChecks({ event, paths }) {
  if (event !== 'pull_request') return { ...FULL, reason: `${event || 'unknown'} runs check everything` };
  if (!paths) return { ...FULL, reason: 'No comparison baseline, so everything runs' };
  if (paths.length === 0) return { mode: 'skip', bank: 'none', lint: false, tests: 'none', build: false, solutionFiles: false, reason: 'No file changes' };
  if (paths.every(p => proseOnly.test(p))) return { mode: 'skip', bank: 'none', lint: false, tests: 'none', build: false, solutionFiles: false, reason: 'Documentation prose only' };
  const c = classifyPaths(paths);
  const broad = c.categories.some(x => ['infrastructure', 'unknown', 'qualification', 'bank'].includes(x));
  const allTests = broad || paths.some(p => unimportedTestInputs.test(p) && !proseOnly.test(p));
  const fullBank = paths.some(p => solutionInputs.test(p));
  const build = c.website || broad;
  return {
    mode: allTests ? 'full' : 'quick',
    bank: fullBank ? 'full' : 'lite',
    lint: true,
    tests: allTests ? 'all' : 'affected',
    build,
    solutionFiles: build && fullBank,
    reason: `${c.categories.join(', ')}${fullBank ? '; touches worked-solution inputs' : ''}`,
  };
}

export function changedPaths(base) {
  if (!base) return null;
  try { return execFileSync('git', ['diff', '--no-renames', '--name-only', base, 'HEAD'], { encoding: 'utf8' }).split('\n').filter(Boolean); }
  catch { return null; }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const arg = name => process.argv.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3) || '';
  const event = arg('event'), base = arg('base');
  const paths = event === 'pull_request' ? changedPaths(base) : null;
  const plan = planChecks({ event, paths });
  const lines = Object.entries(plan).map(([k, v]) => `${k.replace(/[A-Z]/g, m => '_' + m.toLowerCase())}=${v}`);
  console.log(lines.join('\n'));
  if (paths) console.log(`changed files: ${paths.length}`);
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, lines.join('\n') + '\n');
}
