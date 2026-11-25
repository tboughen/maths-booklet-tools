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
    years: [{ year: 9, sections: [{ name: 'Spring term', units: [{ code: 'A7', title: 'Straight-line graphs', lessons: [{ code: 'A7.01', title: 'Plot' }, { code: 'A7.02', title: 'Read' }, { code: 'A7.03', title: 'Gradient' }], parts: [{ name: 'Part 1', from: 'A7.01', to: 'A7.02' }, { name: 'Part 2', from: 'A7.03', to: 'A7.03' }] }] }], now: 'A7' }],
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
  assert.equal(served.resources[0].version, 'Main');
  assert.deepEqual(served.resources[0].history, []);
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

test('versions, parts and history are checked, and earlier versions are served too', () => {
  const { root, list } = sample();
  const r = list.resources[0];
  writeFileSync(join(root, 'files', 'y9', 'A7', 'y9-a7-03-v1_pupil.pdf'), '%PDF old');
  r.history = [{ updated: '2026-11-18', note: 'First booklet version', files: [{ role: 'pupil', format: 'pdf', path: 'y9/A7/y9-a7-03-v1_pupil.pdf' }] }];
  list.resources.push({ ...r, id: 'y9-a7-03-foundation', version: 'Foundation', history: undefined });
  assert.deepEqual(checkLibrary(list, root), []);
  const { list: served, uploads } = servedLibrary(list, root, '2026-11-24T12:00:00Z');
  assert.equal(uploads.length, 3);
  assert.match(served.resources[0].history[0].files[0].href, /y9-a7-03-v1_pupil\.pdf$/);
  list.resources.push({ ...r, id: 'y9-a7-03-again' });
  list.resources[1].version = 'Far too long a version name for a little tab';
  list.resources[0].part = 'Part 9';
  r.history[0].updated = 'yesterday';
  list.years[0].now = 'A9';
  list.years[0].sections[0].units[0].parts.push({ name: 'Part 3', from: 'A7.03', to: 'A7.01' });
  const problems = checkLibrary(list, root).join('\n');
  for (const words of ['same booklet of the same unit', 'must be a short name', 'part Part 9 is not a part', 'needs an updated date', 'A9, is not listed', 'part Part 3 must run'])
    assert.match(problems, new RegExp(words.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')), words);
});
