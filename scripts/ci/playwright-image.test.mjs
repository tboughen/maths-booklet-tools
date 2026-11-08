import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// The release qualification's browser checks run in a pinned Playwright image (improvement list L3).
// A Playwright upgrade must move the image with it, or the tests would drive a browser the library
// was not built for; an unpinned tag would let the image, and its fonts, change under the goldens.
const read = path => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

test('the pinned Playwright image matches @playwright/test and is pinned by digest', () => {
  const version = JSON.parse(read('package.json')).devDependencies['@playwright/test'];
  assert.match(version, /^\d+\.\d+\.\d+$/, '@playwright/test must be an exact version');
  const images = [...read('.github/workflows/graph-checks.yml').matchAll(/image:\s*(\S+)/g)].map(m => m[1]);
  assert.ok(images.length > 0, 'graph-checks.yml should run its browser checks in a container');
  for (const image of images) {
    assert.match(image, /^mcr\.microsoft\.com\/playwright:v[\d.]+-[a-z]+@sha256:[a-f0-9]{64}$/, `${image} must be an official Playwright image pinned by digest`);
    assert.equal(image.match(/:v([\d.]+)-/)[1], version, `${image} must match @playwright/test ${version}`);
  }
});
