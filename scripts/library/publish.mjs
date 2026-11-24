#!/usr/bin/env node
// Publish the Resource library: node scripts/library/publish.mjs <bank>/library [--dry-run]
// Checks the list, uploads any new files to the private R2 bucket (each under its SHA-256, never
// replaced), then replaces the served list. Needs CLOUDFLARE_ACCOUNT_ID, R2_ACCESS_KEY_ID and
// R2_SECRET_ACCESS_KEY unless --dry-run. See docs/content/RESOURCE-LIBRARY.md.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { checkLibrary, servedLibrary } from './library.mjs';

const [root, ...flags] = process.argv.slice(2);
if (!root) { console.error('Usage: node scripts/library/publish.mjs <bank>/library [--dry-run]'); process.exit(2); }
const dry = flags.includes('--dry-run');
const bucket = JSON.parse(readFileSync('wrangler.jsonc', 'utf8').replace(/^\s*\/\/.*$/gm, '')).r2_buckets[0].bucket_name;
const source = JSON.parse(readFileSync(join(root, 'library.json'), 'utf8'));
const problems = checkLibrary(source, root);
if (problems.length) { console.error(`The library list has ${problems.length} problem(s):\n- ${problems.join('\n- ')}`); process.exit(1); }
const { list, uploads } = servedLibrary(source, root);
const megabytes = (uploads.reduce((n, u) => n + u.bytes, 0) / 1e6).toFixed(1);
console.log(`${list.resources.length} resources, ${uploads.length} files (${megabytes} MB).`);
if (dry) { console.log('Dry run: nothing uploaded.'); process.exit(0); }

const { storage } = await import('../cloudflare/network.mjs');
const { ensureAsset, concurrent } = await import('../cloudflare/upload-core.mjs');
const store = await storage({ bucket }, { count() {} });
try {
  const results = await concurrent(uploads, asset => ensureAsset(store, asset, () => readFileSync(asset.path)));
  console.log(`Files: ${results.filter(r => r === 'uploaded').length} uploaded, ${results.filter(r => r === 'reused').length} already there.`);
} finally { store.close(); }
const sdk = await import('@aws-sdk/client-s3');
const s3 = new sdk.S3Client({ region: 'auto', endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`, credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY }, requestChecksumCalculation: 'WHEN_REQUIRED', responseChecksumValidation: 'WHEN_REQUIRED' });
try {
  await s3.send(new sdk.PutObjectCommand({ Bucket: bucket, Key: 'library/library.json', Body: JSON.stringify(list), ContentType: 'application/json', CacheControl: 'private, no-cache' }));
} finally { s3.destroy(); }
console.log(`Published the library list (${list.published}).`);
