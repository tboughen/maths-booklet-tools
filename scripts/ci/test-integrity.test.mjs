import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkDiff, netFindings } from './test-integrity.mjs';

const diff = (file, lines, extra = '') => `diff --git a/${file} b/${file}\n${extra}--- a/${file}\n+++ b/${file}\n@@ -1 +1 @@\n${lines.join('\n')}\n`;
const kinds = d => netFindings(checkDiff(d), d).map(f => `${f.level}:${f.kind}`);

test('.only is an error, skip and fixme are warnings', () => {
  assert.deepEqual(kinds(diff('src/a.test.ts', ['+it.only("x", () => {})'])), ['error:only']);
  assert.deepEqual(kinds(diff('e2e/a.spec.ts', ['+test.skip(true, "later")', '+test.fixme("y", async () => {})'])), ['warning:disabled-test', 'warning:disabled-test']);
});

test('mentions of .only or .skip inside strings are not findings', () => {
  assert.deepEqual(kinds(diff('src/a.test.ts', [`+  assert.deepEqual(kinds('+it.only("x")'), []);`, `+  const note = "test.skip(true)";`])), []);
  assert.deepEqual(kinds(diff('e2e/a.spec.ts', ['+test.describe.only("group", () => {})'])), ['error:only']);
});

test('removed and loosened assertions are reported; moved ones are not', () => {
  assert.deepEqual(kinds(diff('src/a.test.ts', ['-  expect(total).toBe(12);'])), ['warning:removed-assertion']);
  assert.deepEqual(kinds(diff('src/a.test.ts', ['-  expect(total).toBe(12);', '+  expect(total).toBeTruthy();'])), ['warning:removed-assertion', 'warning:loose-assertion']);
  assert.deepEqual(kinds(diff('src/a.test.ts', ['-  expect(total).toBe(12);', '+  expect(total).toBe(12);'])), []);
});

test('deleted test files and changed control hashes are reported', () => {
  assert.deepEqual(kinds(diff('src/a.test.ts', ['-it("x", () => {})'], 'deleted file mode 100644\n')), ['warning:deleted-test-file']);
  assert.deepEqual(kinds(diff('e2e/fixtures/usability-refinement/manifest.json', [`-  "svg": "${'a'.repeat(64)}",`, `+  "svg": "${'b'.repeat(64)}",`])), ['warning:changed-control-hash']);
});

test('changed print baselines are reported', () => {
  assert.deepEqual(kinds(diff('src/gates/print-baseline.json', ['-  "triangles": 8.5,', '+  "triangles": 8,'])), ['warning:changed-baseline']);
  assert.deepEqual(kinds(diff('e2e/a11y-baseline.json', ['+    "color-contrast"'])), ['warning:changed-baseline']);
});

test('contract snapshot changes are reported once per file', () => {
  assert.deepEqual(kinds(diff('src/gates/contracts/saved-files.json', ['-    "maxLength": 80', '+    "maxLength": 120'])), ['warning:changed-contract']);
  assert.deepEqual(kinds(diff('review/calibration/cases.json', ['-    "expect": "fail"', '+    "expect": "pass"'])), ['warning:changed-judge-oracle']);
  assert.deepEqual(kinds(diff('review/rubrics/teacher.md', ['-1. Reveal an answer', '+1. Usually avoid revealing'])), ['warning:changed-judge-oracle']);
});

test('ordinary source changes are not findings', () => {
  assert.deepEqual(kinds(diff('src/a.ts', ['-const a = expect(1);', '+const a = 2;'])), []);
  assert.deepEqual(kinds(diff('src/a.test.ts', ['+  expect(total).toBe(13);', '+  expect(list).toContain(3);', '+  expect(f).not.toThrow();'])), []);
});
