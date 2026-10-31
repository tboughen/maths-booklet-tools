// Risk tier for a pull request (docs/AUTONOMOUS-LOOP-POLICY.md, section 3), in shadow mode: it is
// reported on every PR and decides nothing yet. A PR takes the tier of its riskiest file; unknown
// paths are T8. Changes to recorded contracts or baselines raise the tier (behavioural escalation).
//
//   node scripts/loop/classify-risk.mjs [--base=HEAD^1]
import { appendFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export const TIERS = {
  T0: 'Test additions', T1: 'Non-guidance docs', T2: 'Screen-only UI polish', T3: 'One tool\'s editor behaviour',
  T4: 'Core maths and renderers', T5: 'Saved schema, interchange, storage', T6: 'MCP service and advertised metadata',
  T7: 'Guidance and teaching rules', T8: 'Release, infrastructure, bank, credentials',
};

const canonicalGuidance = /^(?:AGENTS\.md|CLAUDE\.md|README\.md|docs\/README\.md|docs\/AUTONOMOUS-LOOP-POLICY\.md|docs\/release\/.*|docs\/content\/.*|docs\/tools\/(?:TOOL-CREATION-GUIDE|TOOL-EVOLUTION|TOOL-BRIEF-TEMPLATE|ADDING-BOOKLET-TOOLS|BOOKLET-CONSISTENCY|USING-TOOL-GUIDANCE|TOOL-CARD-PREVIEWS|BAR-MODEL-[^/]*|[^/]*MCP[^/]*)\.(?:md|json)|docs\/tools\/skills\/.*|\.agents\/.*|\.claude\/.*|review\/(?:rubrics|calibration)\/.*)$/;
const test = /(?:\.(?:test|spec)\.[cm]?[jt]sx?$|^e2e\/(?!fixtures\/)[^/]+\.ts$|\/fixtures\/|^e2e\/fixtures\/)/;

// Ordered from highest to lowest: the first matching rule wins for a path.
const rules = [
  ['T8', /^(?:scripts\/(?:cloudflare|ci|loop|bank)\/|\.github\/|package(?:-lock)?\.json$|wrangler[^/]*$|vite\.config\.ts$|playwright[^/]*\.config\.[cm]?[jt]s$|public\/bank\/|bankAssets\.ts$|workedSolution\.ts$|\.gitmodules$|\.nvmrc$|tsconfig[^/]*\.json$|eslint\.config\.js$|index\.html$)/],
  ['T7', canonicalGuidance],
  ['T6', /^(?:services\/|Dockerfile|render\.yaml$|\.dockerignore$|src\/gates\/contracts\/mcp-catalogue\.json$)/],
  ['T5', /(?:^|\/)(?:[^/]*interchange[^/]*|schema[^/]*|storage[^/]*|versioned[^/]*)\.[cm]?[jt]sx?$|EMITTED-SCHEMAS\.json$|^src\/gates\/contracts\//],
  ['T4', /^(?:packages\/[^/]+\/src\/|assets\/graph-fonts\/|src\/gates\/print-baseline\.json$|src\/gates\/golden\/|e2e\/a11y-baseline\.json$)/],
  ['T2', /^(?:src\/.*\.css$|src\/site\/|src\/assets\/)/],
  ['T3', /^src\//],
  ['T1', /^docs\/.*\.md$/],
];

export function tierOf(path) {
  if (test.test(path) && !/(?:^|\/)(?:print-|a11y-)?baseline\.json$/.test(path) && !/^src\/gates\/(?:contracts|golden)\//.test(path)) return { tier: 'T0', reason: 'test or fixture' };
  for (const [tier, re] of rules) if (re.test(path)) return { tier, reason: TIERS[tier] };
  return { tier: 'T8', reason: 'unknown path (fails conservative)' };
}

export function classifyRisk(paths, { changedLines = 0, deletedTests = false } = {}) {
  if (!paths.length) return { tier: 'T0', reasons: ['no file changes'], paths: [] };
  const per = paths.map(p => ({ path: p, ...tierOf(p) }));
  let tier = per.reduce((max, p) => (p.tier > max ? p.tier : max), 'T0');
  const reasons = [];
  // A test-only PR that deletes a test is no longer a pure test addition.
  if (tier === 'T0' && deletedTests) { tier = 'T3'; reasons.push('deletes a test, so it is not a test addition'); }
  const top = per.filter(p => p.tier === tier);
  reasons.push(`${tier} ${TIERS[tier]}: ${top.slice(0, 5).map(p => p.path).join(', ')}${top.length > 5 ? ` and ${top.length - 5} more` : ''}`);
  if (changedLines > 300) reasons.push(`${changedLines} changed lines: over the 300-line cap for loop PRs`);
  return { tier, reasons, paths: per };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const base = process.argv.find(a => a.startsWith('--base='))?.slice(7) || 'HEAD^1';
  const git = args => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const status = git(['diff', '--no-renames', '--name-status', base, 'HEAD']).split('\n').filter(Boolean).map(l => l.split('\t'));
  const paths = status.map(s => s[1]);
  const deletedTests = status.some(([s, p]) => s === 'D' && test.test(p));
  const changedLines = git(['diff', '--no-renames', '--numstat', base, 'HEAD']).split('\n').filter(Boolean)
    .map(l => l.split('\t')).filter(([, , p]) => !/(?:fixtures|contracts|golden)\/|baseline\.json$|package-lock\.json$/.test(p))
    .reduce((n, [a, d]) => n + (Number(a) || 0) + (Number(d) || 0), 0);
  const result = classifyRisk(paths, { changedLines, deletedTests });
  console.log(`risk tier (shadow): ${result.tier} ${TIERS[result.tier]}`);
  for (const r of result.reasons) console.log(`  ${r}`);
  console.log(`::notice title=Risk tier ${result.tier} (shadow mode)::${result.reasons.join(' | ')}`);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, [
    `### Risk tier: ${result.tier} (${TIERS[result.tier]}), shadow mode`, '',
    ...result.reasons.map(r => `- ${r}`), '', '<details><summary>Per file</summary>', '',
    '| Tier | File |', '| --- | --- |', ...result.paths.map(p => `| ${p.tier} | \`${p.path}\` |`), '', '</details>', ''].join('\n'));
}
