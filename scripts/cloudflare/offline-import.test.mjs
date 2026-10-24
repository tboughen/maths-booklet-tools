import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyPaths, offlineImportInputs } from './classify.mjs';

test('reviewed offline inputs retain all broad code checks without forcing a bank sweep', () => {
  for (const path of offlineImportInputs) {
    const result = classifyPaths([path]);
    assert.deepEqual(result.required, ['units', 'catalogue', 'publisher', 'built', 'browser-1', 'browser-2', 'service']);
    assert.deepEqual(result.categories, ['offline-import']);
    assert.equal(result.fullInventory, false);
    assert.deepEqual(result.inventoryReasons, []);
  }
});

test('unknown helpers and unreviewed new supplements remain conservative', () => {
  for (const path of ['scripts/unreviewed.py', 'scripts/performance-supplements/mock-set-02.json',
    'scripts/performance_supplements.py/extra', 'scripts/performance_supplements.py.bak', 'other/import-performance.py']) {
    const result = classifyPaths([path]);
    assert.equal(result.fullInventory, true, path);
    assert.equal(result.service, true, path);
  }
});

test('publisher, dependency, workflow, policy and missing baseline override admission', () => {
  for (const path of ['scripts/cloudflare/network.mjs', 'scripts/cloudflare/classify.mjs',
    'scripts/cloudflare/cors.json', 'package-lock.json', '.github/workflows/graph-checks.yml', 'bankAssets.ts', 'wrangler.jsonc']) {
    assert.equal(classifyPaths(['scripts/import-performance.py', path]).fullInventory, true, path);
  }
  assert.equal(classifyPaths([...offlineImportInputs], true).fullInventory, true);
});
