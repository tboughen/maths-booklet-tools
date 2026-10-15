import { digestObject, assertEqual } from './common.mjs';

export const auditVersion = 1;
export const maxAuditAgeMs = 7 * 24 * 60 * 60 * 1000;
const identity = asset => ({ key: asset.key, sha256: asset.sha256, md5: asset.md5, bytes: asset.bytes, contentType: asset.contentType });
export const inventoryDigest = assets => digestObject(assets.map(identity).sort((a, b) => a.key.localeCompare(b.key)));
export function validateInventory(manifest) {
  if (manifest.schemaVersion !== 1 || manifest.bucket !== 'maths-booklet-assets' || manifest.assetOrigin !== 'https://assets.mathsdock.co.uk' || !Array.isArray(manifest.assets) || !manifest.assets.length) throw new Error('Invalid MathsDock asset inventory');
  const seen = new Set();
  for (const asset of manifest.assets) {
    const extension = asset.contentType === 'application/pdf' ? 'pdf' : asset.contentType === 'image/png' ? 'png' : null;
    if (!extension || !/^[a-f0-9]{64}$/.test(asset.sha256) || !/^[a-f0-9]{32}$/.test(asset.md5) || asset.key !== `bank/assets/sha256/${asset.sha256}.${extension}` || !Number.isSafeInteger(asset.bytes) || asset.bytes <= 0 || seen.has(asset.key) || !Array.isArray(asset.sources) || !asset.sources.length) throw new Error('Malformed, duplicated or non-immutable asset inventory entry');
    seen.add(asset.key);
  }
  return manifest;
}
export function sampleAssets(assets, cursor = 0, count = 32) {
  const sorted = [...assets].sort((a, b) => a.key.localeCompare(b.key));
  if (!sorted.length) return { assets: [], nextCursor: 0 };
  const chosen = new Map();
  const add = asset => { if (asset && chosen.size < count) chosen.set(asset.key, asset); };
  for (const type of ['application/pdf', 'image/png']) {
    const group = sorted.filter(a => a.contentType === type);
    add(group[0]); add(group.reduce((best, a) => !best || a.bytes > best.bytes ? a : best, undefined));
  }
  for (const role of ['print.pdf', 'scheme.pdf', '1MA1_NOV_2019_1H_Q8']) add(sorted.find(a => a.sources?.some(s => s.includes(role))));
  let offset = ((cursor % sorted.length) + sorted.length) % sorted.length, visited = 0;
  while (chosen.size < Math.min(count, sorted.length) && visited++ < sorted.length) { add(sorted[offset]); offset = (offset + 1) % sorted.length; }
  return { assets: [...chosen.values()], nextCursor: offset };
}
export function inventoryPlan(manifest, baseline, scope, { now = Date.now(), full = false, audit = false } = {}) {
  const all = reason => ({ mode: 'complete', reason, added: manifest.assets, sample: [], nextCursor: 0 });
  if (full || audit) return all(full ? 'Explicit full public byte verification' : 'Explicit inventory audit');
  if (!scope.policyVerified || !baseline || baseline.schemaVersion !== auditVersion) return all('Missing trusted inventory evidence or observed live policy');
  try {
    assertEqual(baseline.scope, scope, 'Inventory policy/origin/bucket changed');
    if (baseline.invalidated || !Number.isSafeInteger(baseline.cursor) || baseline.cursor < 0) return all('Inventory evidence was invalidated or malformed');
    if (baseline.coverageDigest !== inventoryDigest(baseline.verifiedAssets)) return all('Inventory coverage record failed integrity');
    const completed = Date.parse(baseline.fullAuditAt), age = now - completed;
    if (!Number.isFinite(completed) || age < 0 || age > maxAuditAgeMs) return all('Full inventory audit expired');
    const old = new Map(baseline.verifiedAssets.map(a => [a.key, a]));
    const added = manifest.assets.filter(a => !old.has(a.key));
    for (const asset of manifest.assets.filter(a => old.has(a.key))) assertEqual(identity(asset), identity(old.get(asset.key)), 'Immutable inventory identity changed');
    const sample = sampleAssets(manifest.assets.filter(a => old.has(a.key)), baseline.cursor);
    return { mode: added.length ? 'delta' : 'sampled', reason: 'Fresh full baseline and matching observed policy', added, sample: sample.assets, nextCursor: sample.nextCursor };
  } catch { return all('Inapplicable or malformed inventory baseline'); }
}
export function verificationRecord(manifest, scope, plan, previous, now = new Date().toISOString()) {
  const verifiedAssets = plan.mode === 'complete' ? manifest.assets : [...new Map([...previous.verifiedAssets, ...plan.added].map(a => [a.key, a])).values()];
  return { schemaVersion: auditVersion, scope, fullAuditAt: plan.mode === 'complete' ? now : previous.fullAuditAt, checkedAt: now, mode: plan.mode, currentInventoryDigest: inventoryDigest(manifest.assets), coverageDigest: inventoryDigest(verifiedAssets), verifiedAssets, cursor: plan.nextCursor };
}
