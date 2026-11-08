import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { compare, firstLoad, measure } from './bundle-budget.mjs';

test('first load follows the entry script, its stylesheet and static imports only', () => {
  const html = '<script type="module" crossorigin src="/assets/index-a.js"></script><link rel="modulepreload" crossorigin href="/assets/vendor-b.js"><link rel="stylesheet" crossorigin href="/assets/index-c.css">';
  const code = {
    'index-a.js': 'import{a}from"./vendor-b.js";import"./shared-d.js";const p=()=>import("./Page-e.js");',
    'vendor-b.js': 'export const a=1;',
    'shared-d.js': 'import{a}from"./vendor-b.js";',
  };
  assert.deepEqual(firstLoad(html, f => code[f]).sort(), ['index-a.js', 'index-c.css', 'shared-d.js', 'vendor-b.js']);
});

test('measure counts lazy chunks in the total and largest chunk, not in first load', () => {
  const dist = mkdtempSync(join(tmpdir(), 'bundle-budget-'));
  mkdirSync(join(dist, 'assets'));
  writeFileSync(join(dist, 'index.html'), '<script type="module" src="/assets/index.js"></script><link rel="stylesheet" href="/assets/index.css">');
  writeFileSync(join(dist, 'assets', 'index.js'), 'const p=()=>import("./Lazy.js");');
  writeFileSync(join(dist, 'assets', 'index.css'), 'body{margin:0}');
  writeFileSync(join(dist, 'assets', 'Lazy.js'), Array.from({ length: 2000 }, (_, i) => `export const v${i}=${i * 7919};`).join(''));
  writeFileSync(join(dist, 'assets', 'subset.wasm'), Buffer.alloc(5000, 1));
  const m = measure(dist);
  assert.equal(m.largestName, 'Lazy.js');
  assert.ok(m.largestChunk > m.firstLoadJs);
  assert.equal(m.totalJs, m.firstLoadJs + m.largestChunk);
  assert.ok(m.firstLoadCss > 0);
  assert.deepEqual(m.initial.sort(), ['index.css', 'index.js']);
});

test('compare flags each measure over its budget', () => {
  const rows = compare({ firstLoadJs: 10, firstLoadCss: 5, largestChunk: 30, totalJs: 40 }, { firstLoadJs: 10, firstLoadCss: 4, largestChunk: 31, totalJs: 39 });
  assert.deepEqual(rows.map(r => [r.key, r.over]), [['firstLoadJs', false], ['firstLoadCss', true], ['largestChunk', false], ['totalJs', true]]);
});
