import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkLibrary, servedLibrary, sourceSchema, servedSchema } from './library.mjs';
import { libraryFileKey } from '../cloudflare/site-worker.mjs';

function sample() {
  const root = mkdtempSync(join(tmpdir(), 'library-'));
  mkdirSync(join(root, 'files', 'y9', 'A7'), { recursive: true });
  writeFileSync(join(root, 'files', 'y9', 'A7', 'y9-a7-03-lesson-booklet_pupil.pdf'), '%PDF pupil');
  writeFileSync(join(root, 'files', 'y9', 'A7', 'y9-a7-03-lesson-booklet_answers.pdf'), '%PDF answers');
  const list = {
    schema: sourceSchema,
    years: [{ year: 9, sections: [{ name: 'Spring term', units: [{ code: 'A7', title: 'Straight-line graphs' }] }] }],
    resources: [{ id: 'y9-a7-03-lesson-booklet', year: 9, unit: 'A7', lesson: 'A7.03', title: 'Gradient', type: 'lesson-booklet', status: 'waiting', updated: '2026-11-22',
      files: [{ role: 'pupil', format: 'pdf', path: 'y9/A7/y9-a7-03-lesson-booklet_pupil.pdf' }, { role: 'answers', format: 'pdf', path: 'y9/A7/y9-a7-03-lesson-booklet_answers.pdf' }] }],
  };
  return { root, list };
}

test('a sound list has no problems and is served by SHA-256', () => {
  const { root, list } = sample();
  assert.deepEqual(checkLibrary(list, root), []);
  const { list: served, uploads } = servedLibrary(list, root, '2026-11-24T12:00:00Z');
  assert.equal(served.schema, servedSchema);
  assert.equal(uploads.length, 2);
  const file = served.resources[0].files[0];
  assert.equal(file.name, 'y9-a7-03-lesson-booklet_pupil.pdf');
  assert.match(file.href, /^library-data\/files\/[a-f0-9]{64}\/y9-a7-03-lesson-booklet_pupil\.pdf$/);
  // The Worker serves exactly the keys publishing writes.
  for (const u of uploads) assert.ok(libraryFileKey.test(u.key), u.key);
});

test('problems are named in sentences', () => {
  const { root, list } = sample();
  const r = list.resources[0];
  list.resources.push({ ...r, unit: 'A99', type: 'poster', status: 'done', updated: '24 Nov', files: [{ role: 'pupil', format: 'pdf', path: '../secret.pdf' }, { role: 'pupil', format: 'pdf', path: 'y9/A7/missing.pdf' }] });
  const problems = checkLibrary(list, root).join('\n');
  for (const words of ['used twice', 'unit A99 is not listed', 'type must be', 'status must be', 'updated must be a date', '../secret.pdf must look like', 'two pupil pdf files'])
    assert.match(problems, new RegExp(words.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')), words);
  assert.match(checkLibrary({ schema: 'other' }).join(), /must start with/);
  assert.match(checkLibrary({ schema: sourceSchema, resources: [] }).join(), /needs a "years" list/);
});

test('a file must sit in its own year and unit folder and be a plain file, not a link', () => {
  const { root, list } = sample();
  symlinkSync('/etc/hostname', join(root, 'files', 'y9', 'A7', 'link.pdf'));
  list.resources[0].files[0].path = 'y9/A7/link.pdf';
  list.resources[0].files[1].path = 'y8/A7/y9-a7-03-lesson-booklet_answers.pdf';
  const problems = checkLibrary(list, root).join('\n');
  assert.match(problems, /link\.pdf is missing or is not a plain file/);
  assert.match(problems, /must sit in y9\/A7\//);
  list.resources[0].files[1].path = 'y9/A7/missing.pdf';
  assert.match(checkLibrary(list, root).join(), /missing\.pdf is missing/);
});
