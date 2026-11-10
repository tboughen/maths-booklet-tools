// Runs the teacher-prompt evals (scripts/evals/cases.mjs) with `claude plugin eval`, against the
// live MathsDock connector or a local build of the service, and writes a Markdown summary.
// It spends model credit, so it only ever runs when someone starts it: from a Claude Code session
// (uses that session's Claude plan) or the "Prompt evals" workflow (uses the judges' API key and
// counts against the loop's monthly cap, scripts/loop/config.json).
//
//   node scripts/evals/run.mjs [--target=live|http://127.0.0.1:8787] [--model=claude-sonnet-5-5]
//     [--runs=1] [--max-cost-usd=3] [--case=<glob>] [--tag=<tag>] [--out=eval-results]
//
// For a local target, the plugin is copied to a temporary folder with .mcp.json pointing at
// <target>/mcp, so the evals exercise the branch's service before it is deployed.
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync, appendFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const PLUGIN_DIR = 'plugins/mathsdock-claude';
export const LIVE = 'https://maths-booklet-graph-mcp.onrender.com';
export const DEFAULTS = { target: 'live', model: 'claude-sonnet-5-5', runs: '1', 'max-cost-usd': '3', out: 'eval-results' };

export function options(argv) {
  const opts = { ...DEFAULTS };
  for (const a of argv) {
    const m = a.match(/^--([a-z-]+)=(.*)$/);
    if (m) opts[m[1]] = m[2];
  }
  if (!(opts.target === 'live' || /^https?:\/\/[^/\s]+$/.test(opts.target))) throw Error('--target is live or an origin such as http://127.0.0.1:8787');
  if (!(Number(opts['max-cost-usd']) > 0 && Number(opts['max-cost-usd']) <= 20)) throw Error('--max-cost-usd must be above 0 and at most 20');
  if (!(Number.isInteger(Number(opts.runs)) && Number(opts.runs) >= 1 && Number(opts.runs) <= 5)) throw Error('--runs is 1 to 5');
  return opts;
}

/** The `claude plugin eval` arguments for a plugin folder. */
export function evalArgs(pluginDir, opts, outDir) {
  const args = ['plugin', 'eval', pluginDir,
    '--ablation', 'none', // a no-plugin arm has no MathsDock tools, so it would only cost money
    '--mocks', 'off', '--allow-tools', 'mcp__plugin_mathsdock_mathsdock__*',
    '--trust-plugin', '--no-publish',
    '--model', opts.model, '--runs', String(opts.runs), '--max-cost-usd', String(opts['max-cost-usd']),
    '--threshold', '0', // the summary reports failures; the run itself succeeds unless it breaks
    '--concurrency', '4',
    '--json', join(outDir, 'result.json'), '--output-dir', outDir, '--report', join(outDir, 'report.html')];
  if (opts.case) args.push('--case', opts.case);
  if (opts.tag) args.push('--tag', opts.tag);
  return args;
}

/** A Markdown summary of a `claude plugin eval --json` result. */
export function summary(result, opts) {
  // A case passes only when every check in every run passed (the CLI's own count uses --threshold).
  const passed = result.cases.filter(c => Number(c.aggregates?.score) === 1).length;
  const lines = [`### Prompt evals: ${passed} of ${result.cases.length} cases passed`, '',
    `Target ${opts.target === 'live' ? LIVE : opts.target}, model \`${opts.model}\`, ${opts.runs} run(s) per case, cost $${Number(result.costUsd ?? 0).toFixed(2)}${result.partial ? ` (stopped early: ${result.partialReason ?? 'partial'})` : ''}.`, '',
    '| Case | Score | Failed checks |', '| --- | --- | --- |'];
  for (const c of result.cases) {
    const runs = c.arms?.with ?? [];
    const failed = [...new Set(runs.flatMap(r => [...(r.graders ?? []).filter(g => g.scored !== false && !g.passed).map(g => g.name), ...(r.error ? [`error: ${String(r.error).slice(0, 80)}`] : [])]))];
    lines.push(`| ${c.name} | ${Number(c.aggregates?.score ?? 0).toFixed(2)} | ${failed.join(', ').replace(/\|/g, '\\|') || ''} |`);
  }
  return lines.join('\n') + '\n';
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const opts = options(process.argv.slice(2));
  const outDir = resolve(opts.out);
  mkdirSync(outDir, { recursive: true });
  let pluginDir = join(root, PLUGIN_DIR), temp = null;
  if (opts.target !== 'live') {
    temp = mkdtempSync(join(tmpdir(), 'mathsdock-evals-'));
    pluginDir = join(temp, 'mathsdock-claude');
    cpSync(join(root, PLUGIN_DIR), pluginDir, { recursive: true, filter: p => !p.includes('/evals/results') });
    writeFileSync(join(pluginDir, '.mcp.json'), JSON.stringify({ mcpServers: { mathsdock: { type: 'http', url: `${opts.target}/mcp` } } }, null, 2) + '\n');
  }
  const run = spawnSync(process.env.CLAUDE_BIN || 'claude', evalArgs(pluginDir, opts, outDir), { stdio: 'inherit' });
  if (temp) rmSync(temp, { recursive: true, force: true });
  let result;
  try { result = JSON.parse(readFileSync(join(outDir, 'result.json'), 'utf8')); } catch {
    console.error(`claude plugin eval wrote no result (exit ${run.status}).`);
    process.exit(run.status || 1);
  }
  const text = summary(result, opts);
  writeFileSync(join(outDir, 'summary.md'), text);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, text);
  console.log(text);
  // Exit 2 from the CLI means the cost ceiling stopped the run; the summary already says so.
  process.exit(run.status === 2 ? 0 : run.status ?? 1);
}
