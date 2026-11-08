import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { checkContent, localPath } from './content-guard.mjs';

const diff = (file, lines) => `diff --git a/${file} b/${file}\n--- a/${file}\n+++ b/${file}\n@@ -0,0 +1 @@\n${lines.join('\n')}\n`;
const kinds = (added, d = '') => checkContent(added, d).map(f => `${f.file}:${f.kind}`);

test('bank PDFs and images outside the allowlist are rejected', () => {
  assert.deepEqual(kinds(['public/bank/1MA1_JUN_2019_2H/Q1/question.pdf']), ['public/bank/1MA1_JUN_2019_2H/Q1/question.pdf:binary-outside-allowlist']);
  assert.deepEqual(kinds(['docs/notes/screenshot.png', 'reports/results.xlsx']), ['docs/notes/screenshot.png:binary-outside-allowlist', 'reports/results.xlsx:binary-outside-allowlist']);
});

test('brand artwork, previews, example renders, font licence and fixtures are allowed', () => {
  assert.deepEqual(kinds([
    'public/brand/icon-512.png', 'docs/brand/review-board.png', 'src/assets/tool-previews/charts.png',
    'docs/ratio-table-examples/simple.png', 'assets/graph-fonts/STIX_2.0.2_license.pdf',
    'e2e/fixtures/assessment-results.xlsx', 'docs/content/MATHS-RESOURCE-DESIGN-GUIDE.docx',
  ]), []);
});

test('names that look like originals, mark schemes, masters or pupil data are rejected', () => {
  assert.deepEqual(kinds(['docs/mark-scheme-june.md', 'notes/Originals/paper.txt', 'src/workedMasters.json', 'data/class_list.csv', 'data/pupil-names.json']), [
    'docs/mark-scheme-june.md:mark-scheme', 'notes/Originals/paper.txt:original-paper', 'src/workedMasters.json:worked-master',
    'data/class_list.csv:class-list', 'data/pupil-names.json:pupil-data',
  ]);
});

test('pupil versions of examples, question-ID previews and master scripts stay allowed', () => {
  assert.deepEqual(kinds(['docs/bar-model-examples/lesson-v3/R1-pupil.json', 'src/assets/example-previews/graph-1MA1_JUN_2019_2H_Q2.svg', 'scripts/brand/trace-master.py', 'src/originality.ts']), []);
});

test('local machine paths in added lines are rejected; generic homes are not', () => {
  assert.equal(localPath('"renderer": "C:\\\\Users\\\\tjbou\\\\.codex\\\\render.py"'), 'C:\\\\Users\\\\tjbou');
  assert.equal(localPath('see /Users/tim/Documents/maths/report.md'), '/Users/tim/');
  assert.equal(localPath('cache: /home/runner/.cache/ms-playwright'), null);
  assert.equal(localPath('cd /home/user/maths-booklet-tools'), null);
  assert.equal(localPath('path.join(os.homedir(), "x")'), null);
  assert.deepEqual(kinds([], diff('docs/lineage.json', ['+  "renderer": "C:\\\\Users\\\\tjbou\\\\x.py",', '+  "other": "C:\\\\Users\\\\tjbou\\\\y.py"'])), ['docs/lineage.json:local-path']);
  assert.deepEqual(kinds([], diff('docs/lineage.json', ['-  "renderer": "C:\\\\Users\\\\tjbou\\\\x.py"'])), []);
});

test('the guard does not flag its own patterns', () => {
  assert.deepEqual(kinds([], diff('scripts/ci/content-guard.test.mjs', ['+  "C:\\\\Users\\\\tjbou"'])), []);
});

test('nothing currently tracked would fail if it were added again', () => {
  const tracked = execFileSync('git', ['ls-files'], { encoding: 'utf8' }).split('\n').filter(Boolean)
    .filter(f => !f.startsWith('public/bank/assets'));
  assert.deepEqual(checkContent(tracked, '').map(f => f.file), []);
});
