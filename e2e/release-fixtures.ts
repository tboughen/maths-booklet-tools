import { test as base, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { assetFile, type ReleaseManifest } from '../scripts/cloudflare/release';

// A worker consumes one immutable prepared package. The qualification runner
// verifies its entire package before and after this process. Reuse only this
// read-only inventory/index, never page contexts, source bodies or test results.
const inventories = new Map<string, Promise<{ manifest: ReleaseManifest; byKey: Map<string, ReleaseManifest['assets'][number]> }>>();
function preparedInventory() {
  const path = resolve(process.env.MATHSDOCK_RELEASE_PACKAGE || 'cloudflare-release/package', 'inventory.json');
  let pending = inventories.get(path);
  if (!pending) {
    pending = readFile(path, 'utf8').then(text => {
      const manifest = JSON.parse(text) as ReleaseManifest;
      return { manifest, byKey: new Map(manifest.assets.map(a => [a.key, a])) };
    });
    inventories.set(path, pending);
  }
  return pending;
}

// Built-package rehearsal only. Real HTTPS preview/production checks do not use
// this transport substitution and are recorded separately by the publisher.
export const test = base.extend({
  context: async ({ context }, provide) => {
    if (process.env.MATHSDOCK_BUILT_PACKAGE) {
      const { manifest, byKey } = await preparedInventory();
      await context.route(`${manifest.assetOrigin}/**`, async route => {
        const key = new URL(route.request().url()).pathname.slice(1), asset = byKey.get(key);
        if (!asset) return route.fulfill({ status: 404 });
        const body = await readFile(assetFile('public', asset.sources[0]));
        await route.fulfill({ status: 200, contentType: asset.contentType, headers: { 'Access-Control-Allow-Origin': '*', 'Accept-Ranges': 'bytes' }, body });
      });
    }
    await provide(context);
  },
});
export { expect };
export type { Page } from '@playwright/test';
export function editorBase() {
  const base = test.info().project.use.baseURL;
  if (!base) throw new Error('Editor-link tests require the configured test origin');
  return base.endsWith('/') ? base : base + '/';
}
export async function sourceAssetMatcher(suffix: string) {
  const keys = new Set<string>();
  if (process.env.MATHSDOCK_BUILT_PACKAGE) {
    const { manifest } = await preparedInventory();
    for (const asset of manifest.assets) if (asset.sources.some(path => path.endsWith(suffix))) keys.add('/' + asset.key);
  }
  return (url: URL) => url.pathname.endsWith(suffix) || keys.has(url.pathname);
}
