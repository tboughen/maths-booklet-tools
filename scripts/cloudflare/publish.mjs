import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { run } from './common.mjs';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const [action = 'plan', ...options] = process.argv.slice(2);
const readOrAssetActions = ['plan', 'upload', 'verify-assets', 'verify-site'];
try {
  if (action === 'deploy') await run(root, 'scripts/cloudflare/promote.mjs', ['promote', ...options]);
  else if (readOrAssetActions.includes(action)) await run(root, 'scripts/cloudflare/legacy-publish.mjs', [action, ...options]);
  else if (action === 'legacy-deploy' && options.includes('--emergency-recovery')) await run(root, 'scripts/cloudflare/legacy-publish.mjs', ['deploy', ...options]);
  else throw new Error('Use release:qualify and exact-package promotion; legacy-deploy is reserved for explicitly coordinated emergency recovery.');
} catch (error) { console.error(error.message); process.exitCode = 1; }
