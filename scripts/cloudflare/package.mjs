import { cpSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { cleanSource, fileManifest, assertEqual, json, save, sha256, digestObject, repository } from './common.mjs';
import { classify } from './classify.mjs';
import { validateInventory } from './inventory.mjs';

export const policyFiles = ['scripts/cloudflare/release.ts', 'bankAssets.ts'];
export const transformationId = root => digestObject(policyFiles.map(path => [path, sha256(readFileSync(resolve(root, path)))]));
export const verifierId = root => digestObject(['network.mjs', 'inventory.mjs', 'upload-core.mjs', 'common.mjs'].map(name => [name, sha256(readFileSync(resolve(root, 'scripts/cloudflare', name)))]));
export function packageRelease(root, { base, directory = resolve(root, 'cloudflare-release/package') } = {}) {
  const source = cleanSource(root);
  if (existsSync(resolve(directory, 'release.json'))) throw new Error('Release package already exists; choose a fresh output directory');
  const inventory = validateInventory(json(resolve(root, 'cloudflare-release/manifest.json')));
  if (inventory.sourceCommit !== source.commit) throw new Error('Built inventory has a different source commit');
  if (sha256(readFileSync(resolve(root, 'dist-cloudflare/bank/catalogue.json'))) !== inventory.catalogueSha256) throw new Error('Built catalogue differs from its inventory');
  if (existsSync(resolve(root, 'dist-cloudflare/bank/assets'))) throw new Error('Question objects must remain outside the website package');
  mkdirSync(directory, { recursive: true });
  cpSync(resolve(root, 'dist-cloudflare'), resolve(directory, 'site'), { recursive: true, dereference: false });
  mkdirSync(resolve(directory, 'config'), { recursive: true });
  for (const name of ['wrangler.jsonc', 'wrangler.preview.jsonc']) cpSync(resolve(root, name), resolve(directory, 'config', name));
  save(resolve(directory, 'inventory.json'), inventory);
  const inputs = { repository, sourceTree: source.tree, bankTree: source.bankTree, transformationId: transformationId(root), verifierId: verifierId(root), lockfile: sha256(readFileSync(resolve(root, 'package-lock.json'))), node: process.versions.node, classification: classify(root, base) };
  const files = fileManifest(directory);
  const release = { schemaVersion: 1, releaseId: digestObject({ inputs, files }), sourceCommit: source.commit, createdAt: new Date().toISOString(), inputs, files };
  save(resolve(directory, 'release.json'), release);
  verifyPackage(directory);
  return release;
}
export function verifyPackage(directory, { allowExpiredForRecovery = false } = {}) {
  const release = json(resolve(directory, 'release.json'));
  if (release.schemaVersion !== 1 || release.inputs?.repository !== repository || !/^[a-f0-9]{64}$/.test(release.releaseId)) throw new Error('Unsupported release package or repository');
  const age = Date.now() - Date.parse(release.createdAt);
  if (!Number.isFinite(age) || age < -60000 || (!allowExpiredForRecovery && age > 90 * 86400000)) throw new Error('Release package has an invalid or expired creation time');
  const actual = fileManifest(directory);
  delete actual['release.json'];
  assertEqual(actual, release.files, 'Release package contains missing, extra or modified files');
  assertEqual(digestObject({ inputs: release.inputs, files: release.files }), release.releaseId, 'Release identity failed');
  const inventory = validateInventory(json(resolve(directory, 'inventory.json')));
  if (sha256(readFileSync(resolve(directory, 'site/bank/catalogue.json'))) !== inventory.catalogueSha256) throw new Error('Packaged catalogue does not match inventory');
  return release;
}
export function validateSource(root, release) {
  const source = cleanSource(root);
  assertEqual(source.tree, release.inputs.sourceTree, 'Source checkout differs from the qualified tree');
  assertEqual(source.bankTree, release.inputs.bankTree, 'Question data differs from the qualified tree');
  assertEqual(verifierId(root), release.inputs.verifierId, 'Inventory verifier differs from the qualified policy');
  return source;
}
export function verifyReusableCatalogue(root, cache) {
  const source = cleanSource(root), metadata = json(resolve(cache, 'release.json'));
  verifyPackage(cache);
  if (source.bankTree !== metadata.inputs.bankTree || transformationId(root) !== metadata.inputs.transformationId) throw new Error('Reusable bank inventory has changed inputs');
  const manifest = json(resolve(cache, 'inventory.json'));
  return { catalogueJson: readFileSync(resolve(cache, 'site/bank/catalogue.json'), 'utf8'), manifest: { ...manifest, sourceCommit: source.commit } };
}
