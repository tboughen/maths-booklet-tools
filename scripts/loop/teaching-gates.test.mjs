import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { GATES, changedGates, gateOf } from './teaching-gates.mjs';

test('every teaching gate names its rule and files that exist', () => {
  assert.ok(GATES.length >= 7);
  for (const g of GATES) {
    assert.ok(g.rule, JSON.stringify(g));
    for (const f of g.files) assert.ok(existsSync(f), `${f} (${g.rule})`);
  }
});

test('a loop change may add beside a gate but not edit or delete one', () => {
  assert.equal(gateOf('src/gates/corpus/2026-11-08/venn/001.json')?.rule, 'Saved files from earlier versions keep loading identically');
  assert.equal(gateOf('src/venn/VennPage.tsx'), null);
  assert.deepEqual(changedGates([
    ['M', 'src/gates/saved-states.test.ts'], ['D', 'src/gates/corpus/2026-11-08/venn/001.json'], ['M', 'src/gates/corpus/UPGRADES.json'],
    ['A', 'src/gates/corpus/2027-01-01/venn/001.json'], ['A', 'src/gates/new-gate.test.ts'], ['M', 'src/venn/VennPage.tsx'],
  ]), ['src/gates/saved-states.test.ts', 'src/gates/corpus/2026-11-08/venn/001.json', 'src/gates/corpus/UPGRADES.json']);
});
