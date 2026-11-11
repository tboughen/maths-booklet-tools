// The teacher-prompt evals (wave 4 lane C2): committed case folders match scripts/evals/cases.mjs,
// the trace patterns catch what the assistant sends but not text it only reads, and the runner
// never spends without a ceiling.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CASES, caseFiles, safetyPattern, created, checkedTools, ANSWER_OPERATIONS, VENN_BOTH } from '../evals/cases.mjs';
import { options, evalArgs, summary, localPlugin, exitCode } from '../evals/run.mjs';
import { CONFIG } from '../loop/preflight.mjs';

test('the committed case folders are current; rerun node scripts/evals/cases.mjs if not', () => {
  for (const [path, text] of Object.entries(caseFiles())) assert.equal(readFileSync(path, 'utf8'), text, path);
  assert.equal(new Set(CASES.map(c => c.name)).size, CASES.length);
  assert.ok(CASES.filter(c => c.tags.includes('temptation')).length >= 8, 'keep plenty of answer-reveal temptations');
});

test('the safety pattern matches answer-revealing tool input and nothing safe', () => {
  const unsafe = new RegExp(safetyPattern());
  // A tool call's input is plain JSON in the trace.
  assert.match('{"type":"tool_use","input":{"objects":[{"equationVisible":true}]}}', unsafe);
  assert.match('{"input":{"operations":[{"op":"fill_next_row"}]}}', unsafe);
  assert.match('{"input":{"outputView": "answer"}}', unsafe);
  assert.match('{"input":{"discardIncompatible" : true}}', unsafe);
  // Text that only mentions these names inside a string value is not a call.
  assert.doesNotMatch(JSON.stringify({ content: '{"equationVisible":true,"op":"fill_next_row","outputView":"answer"}' }), unsafe);
  assert.doesNotMatch('{"input":{"equationVisible":false,"outputView":"pupil"}}', unsafe);
  for (const op of ANSWER_OPERATIONS) assert.match(`{"op":"${op}"}`, unsafe, op);
});

test('every case checks the generic tools and its family\'s older tools for answer reveals', () => {
  const files = caseFiles();
  for (const c of CASES) for (const tool of checkedTools(c.family ?? 'chart')) {
    const grader = Object.entries(files).find(([p, t]) => p.startsWith(`plugins/mathsdock-claude/evals/${c.name}/graders/no-answers-`) && t.includes(`tool: '${tool}'`));
    assert.ok(grader, `${c.name} checks ${tool}`);
    assert.match(grader[1], /\nmax: 0\n/);
  }
  assert.ok(checkedTools('venn').includes('mcp__plugin_mathsdock_mathsdock__create_diagram'));
});

test('a case allows only what its teacher asked for', () => {
  const label = new RegExp(safetyPattern(['equationVisible']));
  assert.doesNotMatch('{"equationVisible":true}', label);
  assert.match('{"outputView":"answer"}', label);
  assert.doesNotMatch('{"outputView":"answer"}', new RegExp(safetyPattern(['outputView'])));
  for (const c of CASES) for (const a of c.allow ?? []) assert.ok(new RegExp(a).test(c.prompt) || /answer version|print the equation/i.test(c.prompt), `${c.name} allows ${a} without asking`);
});

test('the created pattern accepts the generic tool or the older per-family tool, not the tool list', () => {
  const graph = new RegExp(created('graph'));
  assert.match('"name":"mcp__plugin_mathsdock_mathsdock__create_diagram"', graph);
  assert.match('"name": "mcp__plugin_mathsdock_mathsdock__create_graph"', graph);
  assert.doesNotMatch('"tools":["mcp__plugin_mathsdock_mathsdock__create_graph"]', graph);
  assert.doesNotMatch('"tool_name":"mcp__plugin_mathsdock_mathsdock__create_graph"', graph);
  assert.doesNotMatch('"name":"mcp__plugin_mathsdock_mathsdock__revise_graph"', graph);
});

test('the runner always sets a cost ceiling, one arm and the real connector', () => {
  const opts = options([]);
  assert.equal(opts.target, 'live');
  const args = evalArgs('/p', opts, '/out');
  for (const flag of ['--max-cost-usd', '--ablation', '--model', '--runs']) assert.ok(args.includes(flag), flag);
  assert.equal(args[args.indexOf('--ablation') + 1], 'none');
  assert.equal(args[args.indexOf('--mocks') + 1], 'off');
  assert.throws(() => options(['--max-cost-usd=50']), /at most 20/);
  assert.throws(() => options(['--target=file:///etc']), /target/);
  assert.throws(() => options(['--runs=9']), /runs/);
  assert.deepEqual(evalArgs('/p', options(['--case=venn-*']), '/o').slice(-2), ['--case', 'venn-*']);
});

test('the summary counts a case as passed only when every check passed', () => {
  const text = summary({ costUsd: 1.234, aggregates: { casesTotal: 2, casesPassed: 2 }, cases: [
    { name: 'a', aggregates: { score: 1 }, arms: { with: [{ graders: [{ name: 'x', passed: true }] }] } },
    { name: 'b', aggregates: { score: 0.5 }, arms: { with: [{ graders: [{ name: 'x', passed: true }, { name: 'y', passed: false }] }] } },
  ] }, options([]));
  assert.match(text, /1 of 2 cases passed/);
  assert.match(text, /\$1\.23/);
  assert.match(text, /\| b \| 0\.50 \| y \|/);
});

test('a local target evaluates a copy of the plugin pointed at that service, never the live one', () => {
  const dir = mkdtempSync(join(tmpdir(), 'evals-test-'));
  try {
    const plugin = localPlugin(dir, 'http://127.0.0.1:8787');
    assert.deepEqual(JSON.parse(readFileSync(join(plugin, '.mcp.json'), 'utf8')), { mcpServers: { mathsdock: { type: 'http', url: 'http://127.0.0.1:8787/mcp' } } });
    assert.ok(readFileSync(join(plugin, 'skills/mathsdock-diagrams/SKILL.md'), 'utf8').startsWith('---\nname: mathsdock-diagrams'));
    assert.ok(readFileSync('plugins/mathsdock-claude/.mcp.json', 'utf8').includes('onrender.com'), 'the committed plugin is unchanged');
  } finally { rmSync(dir, { recursive: true, force: true }); }
  const all = { partial: false, cases: [{ aggregates: { score: 1 } }, { aggregates: { score: 1 } }] };
  assert.equal(exitCode(0, all), 0);
  assert.equal(exitCode(0, { ...all, cases: [{ aggregates: { score: 1 } }, { aggregates: { score: 0.9 } }] }), 1, 'a failed check fails the run');
  assert.equal(exitCode(2, { ...all, partial: true }), 1, 'stopped at the ceiling: not every case ran');
  assert.equal(exitCode(1, all), 1);
  assert.equal(exitCode(null, all), 1, 'killed by a signal');
  assert.equal(exitCode(0, undefined), 1, 'no result');
});

test('the workflow runs only on main and never spends more per run than the loop cap counts', () => {
  const yml = readFileSync('.github/workflows/prompt-evals.yml', 'utf8');
  assert.match(yml, /test "\$REF" = refs\/heads\/main/);
  const choices = yml.match(/max_cost_usd:[\s\S]*?options: \[([^\]]*)\]/)[1].split(',').map(v => Number(v.replace(/'/g, '')));
  assert.ok(choices.length && choices.every(v => v > 0 && v <= CONFIG.spendEstimateUSD.promptEvalRun), String(choices));
});

test('cases with a pupil answer also check that no tool call writes it into the diagram', () => {
  const leakFiles = caseFiles();
  for (const c of CASES.filter(c => c.leak)) {
    const re = new RegExp(c.leak.value);
    assert.ok(Object.keys(leakFiles).some(p => p.includes(`/${c.name}/graders/no-answer-value-create-diagram.md`)), c.name);
    // The numbers the teacher gave go into the diagram as values; they must not trip the check.
    for (const n of c.prompt.match(/\d+/g) ?? []) assert.doesNotMatch(`{"value":"${n}","text":"${n}"}`, re, `${c.name}: ${n}`);
  }
  assert.match('{"cells":[{"value":"8"}]}', new RegExp(CASES.find(c => c.name === 'ratio-table-blank').leak.value));
  assert.doesNotMatch('{"cells":[{"value":"12"},{"value":"3"},{"value":"2"}],"barHeightMm":20}', new RegExp(CASES.find(c => c.name === 'ratio-table-blank').leak.value));
  const bar = new RegExp(CASES.find(c => c.name === 'bar-model-missing-part').leak.value);
  assert.doesNotMatch('{"id":"b","weight":"28","labels":{"inside":{"text":"","state":"blank"}}}', bar, 'a part width is not a label');
  assert.match('{"labels":{"inside":{"text": "28","state":"value"}}}', bar);
  const venn = new RegExp(CASES.find(c => c.name === 'venn-pupil-shading').leak.value);
  assert.match('{"operations":[{"op": "shade_regions","masks":[1]}]}', venn);
  assert.doesNotMatch('{"operations":[{"op":"rename_set","set":"A","text":"A"}]}', venn);
  // The answer-version case: Venn's answer view (forView in packages/venn-core/src/index.ts,
  // pinned by its layouts test "answer view only reveals entered content") never shades, so a
  // shaded copy counts, but only alongside an unshaded pupil diagram offered in the reply.
  const files = caseFiles(), dir = 'plugins/mathsdock-claude/evals/venn-answer-version/graders/';
  assert.match(files[dir + 'answer-shaded.md'], /type: 'tool_used'[\s\S]*revise_diagram[\s\S]*shade_\(\?:regions\|expression\)[\s\S]*min: 1/);
  assert.match(files[dir + 'pupil-made-unshaded.md'], /min: 1/);
  const both = new RegExp(VENN_BOTH, 'i');
  assert.match('**Pupil version (blank)**\n- SVG\n\n**Answer copy (A ∩ B′ shaded)**', both);
  assert.doesNotMatch('Here is the Venn diagram with A ∩ B′ shaded for your pupils to check their answer.', both);
  assert.doesNotMatch('**Answer version**: A ∩ B′ shaded.', both);
});

test('the histogram check needs the reply to say histograms are not supported', () => {
  const g = caseFiles()['plugins/mathsdock-claude/evals/histogram-unsupported/graders/says-unsupported.md'];
  const re = new RegExp(g.match(/^pattern: '(.*)'$/m)[1].replace(/''/g, "'"), 'i');
  assert.match("I didn't use the MathsDock tools because they don't support histograms.", re);
  assert.match('Histograms are not supported by the connector.', re);
  assert.doesNotMatch("Here is your histogram. Don't forget to label the axes.", re);
});
