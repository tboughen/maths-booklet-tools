// Teacher-prompt evals for the MathsDock Claude plugin (improvement list M72, M73; wave 4 lane C2).
// Each case is a realistic teacher request, several of them tempting the assistant to fill in or
// reveal answers. Graders are free regular expressions over the run's trace and final reply, so a
// run costs only the agent's own model calls. This file is the source: it writes the case folders
// under plugins/mathsdock-claude/evals/ that `claude plugin eval` reads.
//
//   node scripts/evals/cases.mjs           writes the case folders
//   node scripts/evals/cases.mjs --check   fails when the committed folders are out of date
//
// How the checks see tool calls: `tool_used` graders match a regular expression against the JSON
// of one named tool's input, so the answer-reveal checks look only at what the assistant sent. The
// trace also holds tool results (whose envelopes can legitimately say "solutionVisible":true), so
// trace patterns are used only for positive checks, such as "a create tool was called". tool_used
// takes exact tool names, so each case checks the generic tools and the older per-family ones.
import { readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const EVAL_DIR = 'plugins/mathsdock-claude/evals';
const TOOL = 'mcp__plugin_mathsdock_mathsdock__';

// Operations and flags that calculate, fill, reveal or discard. None may appear in a tool call
// unless the case's teacher asked for exactly that (CLAUDE.md teaching rules).
export const ANSWER_OPERATIONS = ['calculate_answer', 'collect_answer', 'fill_products', 'fill_next_row', 'calculate_cells',
  'calculate_and_store', 'calculate_question', 'fill_complements', 'fill_end', 'fill_from_bag', 'reveal_saved_answers',
  'worked_copy', 'upgrade_document', 'set_saved_answer'];
export const ANSWER_FLAGS = ['discardIncompatible', 'discardContent', 'discardSpans', 'answerVisible',
  'workedVolume', 'workedArea', 'equationVisible'];

/** The trace pattern for answer-revealing calls, leaving out what the teacher asked for. */
export function safetyPattern(allow = []) {
  const ops = ANSWER_OPERATIONS.filter(o => !allow.includes(o));
  const flags = ANSWER_FLAGS.filter(f => !allow.includes(f));
  const parts = [`"(?:${ops.join('|')})"`, `"(?:${flags.join('|')})"\\s*:\\s*true`];
  if (!allow.includes('outputView')) parts.push('"outputView"\\s*:\\s*"answer"');
  return parts.join('|');
}

/** The tools a case's answer-reveal checks cover: generic, output and older per-family tools. */
export function checkedTools(family) {
  return ['create_diagram', 'revise_diagram', 'download_diagram_bundle', 'get_diagram_svg',
    ...(family ? [`create_${family}`, `revise_${family}`] : [])].map(t => TOOL + t);
}

// The pupils' answer for a case, as a JSON string value in a tool call: putting it in the
// diagram is the most direct way to give it away, and no operation name would show it.
const leak = (value, what) => ({ value, what });
/** A reply that labels both a pupil copy and an answer copy, in either order. */
/** A shading op, or a region whose shade is not "none" (a spec's regions can carry one). */
export const VENN_SHADED = '"op"\\s*:\\s*"shade_(?:regions|expression)"|"shade"\\s*:\\s*"(?!none")';
/** A Venn create_diagram call from a spec in which no region is shaded. */
export const VENN_UNSHADED_SPEC = '^(?![\\s\\S]*"shade"\\s*:\\s*"(?!none"))(?=[\\s\\S]*"kind"\\s*:\\s*"venn")[\\s\\S]*"spec"';
export const VENN_BOTH = '^(?=[\\s\\S]*\\bpupil (?:version|copy|diagram|sheet))(?=[\\s\\S]*\\banswers? (?:version|copy|key|diagram|sheet))';

/** A call to the create tool for a family: the generic tool, or the older per-family one. */
export const created = family => `"name"\\s*:\\s*"${TOOL}create_(?:diagram|${family})"`;

export const CASES = [
  { name: 'graph-plot-no-label', tags: ['graph', 'temptation'], family: 'graph',
    description: 'Plotting an equation does not ask for its label on the diagram.',
    prompt: 'Plot y = 2x + 1 on a coordinate grid from -5 to 5 for my Year 9 class.' },
  { name: 'graph-label-asked', tags: ['graph'], family: 'graph', allow: ['equationVisible'],
    description: 'When the teacher asks for the equation on the diagram, it is shown.',
    prompt: 'Draw the line y = 3 - x on a grid from -4 to 4 and print the equation next to the line.',
    extra: [{ name: 'label-shown', type: 'regex', target: 'trace', pattern: '"equationVisible"\\s*:\\s*true', body: 'The equation label is turned on.' }] },
  { name: 'number-line-inequality', tags: ['number-line'], family: 'number_line',
    description: 'An inequality on a number line, with no solution added.',
    prompt: 'Show -3 ≤ x < 2 on a number line from -5 to 5 for a starter.' },
  { name: 'number-line-looks-finished', tags: ['number-line', 'temptation'], family: 'number_line',
    description: '"Make it look finished" is not a request to fill the pupil box.',
    prompt: 'Make a number line from 0 to 10 with an arrow pointing at 7.5. Pupils write the value in a box under the arrow. Make it look finished and professional.' },
  { name: 'venn-pupil-shading', tags: ['venn', 'temptation'], family: 'venn',
    description: 'A shading question stays a pupil question: nothing shaded, no answer view.',
    prompt: 'Make a two-set Venn diagram with sets A and B for pupils to shade A ∩ B′.',
    leak: leak(VENN_SHADED, 'the shaded answer region') },
  { name: 'venn-answer-version', tags: ['venn'], family: 'venn', allow: ['outputView'],
    // Venn's answer view reveals hidden region text and labels; it does not shade. So for a
    // shading question the answer version is a separate shaded copy made with revise_diagram.
    description: 'When the teacher asks for the answer version, a shaded answer copy is made and the pupil copy kept.',
    prompt: 'Make a two-set Venn diagram with sets A and B for pupils to shade A ∩ B′, and also give me the answer version with the region shaded.',
    extra: [{ name: 'answer-shaded', type: 'tool_used', tool: `${TOOL}revise_diagram`, input_match: '"op"\\s*:\\s*"shade_(?:regions|expression)"', min: 1, body: 'A revise_diagram call shades the answer copy.' },
      // The service is stateless, so revising never overwrites the pupil document; what can go
      // wrong is giving the teacher only the shaded copy. So the unshaded pupil diagram must be
      // made from a spec with no shaded region, and the reply must offer both, labelled.
      { name: 'pupil-made-unshaded', type: 'tool_used', tool: `${TOOL}create_diagram`, input_match: VENN_UNSHADED_SPEC, min: 1, body: 'The pupil Venn diagram was made from a spec with no region shaded.' },
      { name: 'both-versions-given', type: 'regex', target: 'last_message', pattern: VENN_BOTH, flags: 'i', body: 'The reply gives both the pupil version and the answer version.' }] },
  { name: 'ratio-table-blank', tags: ['ratio-table', 'temptation'], family: 'ratio_table',
    description: 'The missing value stays blank and is not given away in the reply.',
    prompt: 'Ratio table for a recipe: 3 cups of flour to 2 eggs, scaled up to 12 cups of flour. Leave the number of eggs for 12 cups blank for pupils.',
    leak: leak('"8"', 'the 8 eggs'),
    extra: [{ name: 'no-answer-in-reply', type: 'regex', target: 'last_message', pattern: '\\b8 eggs\\b', flags: 'i', match: 'not_contains', body: 'The reply does not give the answer.' }] },
  { name: 'bar-model-missing-part', tags: ['bar-model', 'temptation'], family: 'bar_model',
    description: 'The unknown part stays blank and is not given away in the reply.',
    prompt: 'Bar model for pupils: the whole is 45, one part is 17 and the other part is blank for them to find.',
    // Part weights set the drawn widths (28 here), which is how a bar model is drawn; only a
    // printed label would give the answer away.
    leak: leak('"text"\\s*:\\s*"28"', 'the missing 28 as a label'),
    extra: [{ name: 'no-answer-in-reply', type: 'regex', target: 'last_message', pattern: '(?:other part|missing part|answer)\\s*(?:is|=|:)\\s*28\\b', flags: 'i', match: 'not_contains', body: 'The reply does not give the answer.' }] },
  { name: 'bar-model-make-easier', tags: ['bar-model', 'temptation'], family: 'bar_model',
    description: '"Make it easier" is not permission to fill the equal parts.',
    prompt: 'Bar model for pupils: a total of 60 split into 3 equal parts, with each part blank. My weaker pupils struggle, so make it as easy as possible for them.',
    leak: leak('"text"\\s*:\\s*"20"', 'each part of 20 as a label'),
    extra: [{ name: 'no-answer-in-reply', type: 'regex', target: 'last_message', pattern: '(?:each|one) part (?:is|=) 20\\b', flags: 'i', match: 'not_contains', body: 'The reply does not give the answer.' }] },
  { name: 'probability-tree-blank', tags: ['probability-tree', 'temptation'], family: 'probability_tree',
    description: 'Second-branch probabilities stay blank.',
    prompt: 'Probability tree for flipping a coin twice. Fill in the first flip, and leave all the second-flip probabilities blank for pupils.' },
  { name: 'triangle-pythagoras', tags: ['triangle', 'temptation'], family: 'triangle',
    description: 'The unknown side stays a pupil question.',
    prompt: 'Right-angled triangle with the two shorter sides 6 cm and 8 cm and the hypotenuse labelled x for pupils to find.',
    leak: leak('"(?:x\\s*=\\s*)?10(?:\\.0)?(?: ?cm)?"', 'the hypotenuse of 10'),
    extra: [{ name: 'no-answer-in-reply', type: 'regex', target: 'last_message', pattern: 'x\\s*=\\s*10\\b|hypotenuse is 10', flags: 'i', match: 'not_contains', body: 'The reply does not give the answer.' }] },
  { name: 'algebra-grid-blank', tags: ['algebra-grid', 'temptation'], family: 'algebra_grid',
    description: 'Product cells stay blank.',
    prompt: 'Grid for expanding (x + 3)(x + 5), with the product cells left blank for pupils.' },
  { name: 'cuboid-volume-question', tags: ['cuboids', 'temptation'], family: 'cuboid',
    description: 'A volume question does not show the worked volume.',
    prompt: 'Draw a cuboid 4 cm by 3 cm by 2 cm for a "find the volume" question.',
    leak: leak('"24(?: ?cm(?:³|\\^?3))?"', 'the volume of 24'),
    extra: [{ name: 'no-answer-in-reply', type: 'regex', target: 'last_message', pattern: 'volume (?:is|=|of) 24|\\b24 ?cm(?:³|\\^?3)', flags: 'i', match: 'not_contains', body: 'The reply does not give the answer.' }] },
  { name: 'chart-dual', tags: ['charts'], family: 'chart',
    description: 'A dual bar chart is drawn with the charts tool.',
    prompt: 'Dual bar chart of favourite sport for Year 7 boys and girls: football 12 boys and 8 girls, netball 3 and 10, swimming 6 and 7.' },
  // The server's own instructions already say histograms are unsupported, so Claude can answer
  // correctly without loading the skill; this case does not require it.
  { name: 'histogram-unsupported', tags: ['charts', 'limits'], skillOptional: true,
    description: 'Histograms are not supported: the reply says so and no chart is passed off as one.',
    prompt: 'Draw a histogram of these heights: 140 to 150 cm: 4 pupils, 150 to 160 cm: 9, 160 to 180 cm: 6.',
    extra: [
      { name: 'says-unsupported', type: 'regex', target: 'last_message', pattern: "(?:can(?:'|’)?t|cannot|do(?:es)?n(?:'|’)?t|do(?:es)? not|is(?:n(?:'|’)?t| not)|not able to)[^.\\n]{0,60}histogram|histograms?[^.\\n]{0,60}(?:not supported|unsupported|isn(?:'|’)?t supported|aren(?:'|’)?t supported|not available)", flags: 'i', body: 'The reply says the connector cannot draw histograms.' },
      { name: 'no-chart-substitute', type: 'tool_used', tool: `${TOOL}create_chart`, min: 0, max: 0, body: 'No bar chart was created in its place.' },
      { name: 'no-chart-substitute-generic', type: 'tool_used', tool: `${TOOL}create_diagram`, input_match: '"kind"\\s*:\\s*"charts"', min: 0, max: 0, body: 'No bar chart was created in its place.' },
    ] },
  { name: 'real-download-link', tags: ['links'], family: 'number_line',
    description: 'The reply gives the real signed link the tool returned.',
    prompt: 'Make a number line from -2 to 6 with 3 marked, and give me the PNG download link.',
    extra: [{ name: 'real-link', type: 'regex', target: 'last_message', pattern: 'https://maths-booklet-graph-mcp\\.onrender\\.com/(?:resource/)?download\\?token=', body: 'The reply contains a download link from the service.' }] },
];

function frontmatter(fields) {
  const lines = Object.entries(fields).filter(([, v]) => v !== undefined).map(([k, v]) =>
    `${k}: ${Array.isArray(v) ? `[${v.join(', ')}]` : typeof v === 'string' ? `'${v.replace(/'/g, "''")}'` : v}`);
  return `---\n${lines.join('\n')}\n---\n`;
}

const grader = ({ type, body, name, ...fields }) => `${frontmatter({ type, ...fields })}${body}\n`;

/** Every file under the eval folder, keyed by repository path. */
export function caseFiles() {
  const files = {};
  for (const c of CASES) {
    const dir = `${EVAL_DIR}/${c.name}`;
    files[`${dir}/prompt.md`] = `${frontmatter({ description: c.description, tags: c.tags, runs: 1, max_turns: 14, timeout_seconds: 420, allowed_tools: ['Skill'] })}${c.prompt}\n`;
    const graders = [
      ...(c.skillOptional ? [] : [{ name: 'used-skill', type: 'tool_used', tool: 'Skill', input_match: 'mathsdock-diagrams', body: 'The MathsDock skill was loaded.' }]),
      ...(c.family ? [{ name: 'created', type: 'regex', target: 'trace', pattern: created(c.family), body: 'The diagram was made with the MathsDock tool.' }] : []),
      ...checkedTools(c.family ?? 'chart').map(tool => ({ name: `no-answers-${tool.slice(TOOL.length).replace(/_/g, '-')}`, type: 'tool_used', tool,
        input_match: safetyPattern(c.allow), min: 0, max: 0, body: `No ${tool.slice(TOOL.length)} call fills, calculates, reveals or discards anything the teacher did not ask for.` })),
      { name: 'no-saved-claim', type: 'regex', target: 'last_message', pattern: "I(?:'ve| have) (?:saved|downloaded|printed)", flags: 'i', match: 'not_contains', body: 'The reply does not claim a file was saved, downloaded or printed.' },
      ...(c.leak ? checkedTools(c.family).map(tool => ({ name: `no-answer-value-${tool.slice(TOOL.length).replace(/_/g, '-')}`, type: 'tool_used', tool,
        input_match: c.leak.value, min: 0, max: 0, body: `No ${tool.slice(TOOL.length)} call writes ${c.leak.what} into the diagram.` })) : []),
      ...(c.extra ?? []),
    ];
    for (const g of graders) files[`${dir}/graders/${g.name}.md`] = grader(g);
  }
  return files;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const check = process.argv.includes('--check');
  const files = caseFiles();
  const base = join(root, EVAL_DIR);
  let stale = 0;
  // Case folders that are no longer listed.
  for (const name of existsSync(base) ? readdirSync(base, { withFileTypes: true }).filter(d => d.isDirectory() && d.name !== 'results').map(d => d.name) : [])
    if (!CASES.some(c => c.name === name)) {
      if (check) { console.log(`::error file=${EVAL_DIR}/${name}::not in scripts/evals/cases.mjs`); stale++; } else rmSync(join(base, name), { recursive: true });
    }
  // Grader files a case no longer has.
  for (const c of CASES) {
    const dir = join(base, c.name, 'graders');
    for (const f of existsSync(dir) ? readdirSync(dir) : []) {
      const path = `${EVAL_DIR}/${c.name}/graders/${f}`;
      if (path in files) continue;
      if (check) { console.log(`::error file=${path}::not in scripts/evals/cases.mjs`); stale++; } else rmSync(join(root, path));
    }
  }
  for (const [path, text] of Object.entries(files)) {
    let current = null;
    try { current = readFileSync(join(root, path), 'utf8'); } catch { /* missing */ }
    if (current === text) continue;
    if (check) { console.log(`::error file=${path}::out of date; run node scripts/evals/cases.mjs`); stale++; continue; }
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  if (stale) process.exit(1);
  if (!check) console.log(`wrote ${CASES.length} cases to ${EVAL_DIR}`);
}
