import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { verifySplitCatalogue } from './package.mjs';

function site({ index, papers }) {
  const root = mkdtempSync(resolve(tmpdir(), 'mathsdock-split-test-'));
  mkdirSync(resolve(root, 'bank/catalogue-papers'), { recursive: true });
  const catalogue = { version: 'v1', questions: [{ id: 'P1_Q1', paperId: 'P1' }, { id: 'P1_Q2', paperId: 'P1' }, { id: 'P2_Q1', paperId: 'P2' }] };
  writeFileSync(resolve(root, 'bank/catalogue.json'), JSON.stringify(catalogue));
  writeFileSync(resolve(root, 'bank/catalogue-index.json'), JSON.stringify(index(catalogue)));
  for (const [path, body] of Object.entries(papers)) writeFileSync(resolve(root, path), JSON.stringify(body));
  return root;
}
const p1 = 'bank/catalogue-papers/P1.0123456789abcdef.json', p2 = 'bank/catalogue-papers/P2.fedcba9876543210.json';
const goodIndex = c => ({ version: c.version, questions: c.questions.map(({ id, paperId }) => ({ id, paperId })), papers: { P1: p1, P2: p2 } });
const goodPapers = {
  [p1]: { version: 'v1', paperId: 'P1', questions: { P1_Q1: {}, P1_Q2: {} } },
  [p2]: { version: 'v1', paperId: 'P2', questions: { P2_Q1: {} } },
};

test('a packaged split catalogue must match the packaged catalogue', () => {
  verifySplitCatalogue(site({ index: goodIndex, papers: goodPapers }));
  assert.throws(() => verifySplitCatalogue(site({ index: c => ({ ...goodIndex(c), version: 'old' }), papers: goodPapers })), /index does not match/);
  assert.throws(() => verifySplitCatalogue(site({ index: c => ({ ...goodIndex(c), questions: goodIndex(c).questions.slice(1) }), papers: goodPapers })), /index does not match/);
  assert.throws(() => verifySplitCatalogue(site({ index: c => ({ ...goodIndex(c), papers: { P1: p1 } }), papers: goodPapers })), /missing a paper/);
  assert.throws(() => verifySplitCatalogue(site({ index: goodIndex, papers: { [p1]: goodPapers[p1] } })), /P2 is missing/);
  assert.throws(() => verifySplitCatalogue(site({ index: goodIndex, papers: { ...goodPapers, [p1]: { ...goodPapers[p1], questions: { P1_Q1: {} } } } })), /P1 does not match/);
  assert.throws(() => verifySplitCatalogue(site({ index: c => ({ ...goodIndex(c), papers: { P1: '../secret.json', P2: p2 } }), papers: goodPapers })), /P1 is missing/);
});

test('only a recovery package from before the split may lack the index', () => {
  const unsplit = site({ index: goodIndex, papers: goodPapers });
  rmSync(resolve(unsplit, 'bank/catalogue-index.json'));
  assert.throws(() => verifySplitCatalogue(unsplit), /ENOENT/);
  verifySplitCatalogue(unsplit, { allowUnsplit: true });
  assert.throws(() => verifySplitCatalogue(site({ index: c => ({ ...goodIndex(c), version: 'old' }), papers: goodPapers }), { allowUnsplit: true }), /index does not match/);
});
