import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, sep } from 'node:path';
import { save, json, sha256, digestObject, fileManifest, inside, repository } from './common.mjs';
import { classifyPaths } from './classify.mjs';
import { verifyPackage } from './package.mjs';
import { inventoryPlan, inventoryDigest, verificationRecord, sampleAssets, validateInventory, maxAuditAgeMs } from './inventory.mjs';
import { browserEvidence, vitestEvidence, sealQualification, validateQualification } from './evidence.mjs';
import { promoteRelease } from './deployment.mjs';
import { verifyInventory, verifyRange } from './network.mjs';

const roots = [];
function temporary() { const path = mkdtempSync(resolve(tmpdir(), 'mathsdock-publisher-test-')); roots.push(path); return path; }
afterEach(() => { for (const path of roots.splice(0)) { if (!path.startsWith(resolve(tmpdir()) + sep + 'mathsdock-publisher-test-')) throw new Error('Unsafe test cleanup'); rmSync(path, { recursive: true, force: true }); } });
const asset = (n, type = 'pdf') => ({ key: `bank/assets/sha256/${sha256(String(n))}.${type}`, sha256: sha256(String(n)), md5: 'a'.repeat(32), bytes: n + 100, contentType: type === 'pdf' ? 'application/pdf' : 'image/png', sources: [`bank/assets/example-${n}/${type === 'pdf' ? 'print.pdf' : 'question.png'}`] });
const manifest = { schemaVersion: 1, bucket: 'maths-booklet-assets', assetOrigin: 'https://assets.mathsdock.co.uk', assets: Array.from({ length: 60 }, (_, n) => asset(n, n % 3 ? 'pdf' : 'png')) };
const scope = { bucket: manifest.bucket, origin: 'https://mathsdock.co.uk', policyVerified: true, corsDigest: 'policy', verifier: 'v1' };
const now = Date.parse('2026-10-15T12:00:00Z');
const baseline = () => verificationRecord(manifest, scope, { mode: 'complete', nextCursor: 0 }, null, new Date(now).toISOString());
function qualification(release) {
  const checks = release.inputs.classification.required.map(name => ({ name, status: 'passed', releaseId: release.releaseId }));
  return { schemaVersion: 1, repository, status: 'qualified', releaseId: release.releaseId, sourceTree: release.inputs.sourceTree, required: release.inputs.classification.required, checks, checksDigest: digestObject(checks) };
}
function packageFixture() {
  const directory = temporary(); mkdirSync(resolve(directory, 'site/bank'), { recursive: true });
  const catalogue = '{"questions":[]}';
  writeFileSync(resolve(directory, 'site/index.html'), '<html>qualified</html>');
  writeFileSync(resolve(directory, 'site/bank/catalogue.json'), catalogue);
  save(resolve(directory, 'inventory.json'), { ...manifest, catalogueSha256: sha256(catalogue) });
  const inputs = { repository, sourceTree: 'tree', classification: { required: ['units'], website: true } }, files = fileManifest(directory);
  const release = { schemaVersion: 1, releaseId: digestObject({ inputs, files }), sourceCommit: 'commit', inputs, files, createdAt: new Date().toISOString() };
  save(resolve(directory, 'release.json'), release);
  return { directory, release };
}

test('website changes retain complete website obligations without service image work', () => {
  const result = classifyPaths(['src/site/site.css', 'public/brand/logo.svg']);
  assert.equal(result.website, true); assert.equal(result.service, false);
  assert.deepEqual(result.required, ['units', 'catalogue', 'publisher', 'built', 'browser-1', 'browser-2']);
});
test('mixed changes union obligations; unknown paths and absent ancestry select full checks', () => {
  for (const paths of [['src/App.tsx', 'services/graph-mcp/server.ts'], ['surprise-file'], ['package-lock.json'], ['packages/graph-core/src/svg.ts']]) assert.equal(classifyPaths(paths).service, true);
  assert.equal(classifyPaths([], true).fullInventory, true);
  assert.deepEqual(classifyPaths(['docs/README.md']).required, []);
});
test('package verification rejects modified, extra and missing website files', () => {
  for (const mutation of ['modified', 'extra', 'missing']) {
    const { directory } = packageFixture(); verifyPackage(directory);
    const path = resolve(directory, 'site/index.html');
    if (mutation === 'modified') writeFileSync(path, 'wrong');
    if (mutation === 'extra') writeFileSync(resolve(directory, 'site/unqualified.js'), 'wrong');
    if (mutation === 'missing') rmSync(path);
    assert.throws(() => verifyPackage(directory), /missing, extra or modified/);
  }
});
test('wrong repository, expired package and changed release identity are refused', () => {
  for (const mutate of [r => { r.inputs.repository = 'someone/else'; }, r => { r.createdAt = '2000-01-01'; }, r => { r.releaseId = '0'.repeat(64); }]) {
    const { directory, release } = packageFixture(); mutate(release); save(resolve(directory, 'release.json'), release); assert.throws(() => verifyPackage(directory));
  }
});
test('path traversal cannot read a file outside the release directory', () => {
  const root = temporary(), child = resolve(root, 'site'); mkdirSync(child); writeFileSync(resolve(root, 'secret'), 'private');
  assert.throws(() => inside(child, '../secret'), /Unsafe/);
});
test('inventory rejects foreign buckets, overwritten keys and duplicate entries', () => {
  for (const m of [{ ...manifest, bucket: 'other-project' }, { ...manifest, assets: [{ ...asset(1), key: 'brand/logo.svg' }] }, { ...manifest, assets: [asset(1), asset(1)] }]) assert.throws(() => validateInventory(m));
  assert.equal(validateInventory(manifest), manifest);
});
test('fresh unchanged inventory requests a bounded sample and zero stored objects', () => {
  const plan = inventoryPlan(manifest, baseline(), scope, { now });
  assert.equal(plan.mode, 'sampled'); assert.equal(plan.added.length, 0); assert.equal(plan.sample.length, 32);
  assert.equal(new Set(plan.sample.map(a => a.key)).size, 32);
});
test('old, future, missing, corrupt, invalidated or differently scoped evidence selects a complete audit', () => {
  const variants = [null, { ...baseline(), fullAuditAt: new Date(now - maxAuditAgeMs - 1).toISOString() }, { ...baseline(), fullAuditAt: new Date(now + 1).toISOString() }, { ...baseline(), coverageDigest: 'wrong' }, { ...baseline(), invalidated: true }, { ...baseline(), scope: { ...scope, origin: 'https://other.example' } }];
  for (const previous of variants) assert.equal(inventoryPlan(manifest, previous, scope, { now }).mode, 'complete');
  assert.equal(inventoryPlan(manifest, baseline(), { ...scope, policyVerified: false }, { now }).mode, 'complete');
});
test('delta checks retain the last full audit time; removal never requests deletion', () => {
  const changed = { ...manifest, assets: [...manifest.assets.slice(1), asset(100)] };
  const plan = inventoryPlan(changed, baseline(), scope, { now });
  assert.equal(plan.mode, 'delta'); assert.deepEqual(plan.added, [asset(100)]);
  const record = verificationRecord(changed, scope, plan, baseline(), new Date(now + 1000).toISOString());
  assert.equal(record.fullAuditAt, baseline().fullAuditAt); assert.equal(record.verifiedAssets.length, 61);
  assert.equal(record.coverageDigest, inventoryDigest(record.verifiedAssets));
});
test('sampling rotates while preserving required PDF and PNG representatives', () => {
  const first = sampleAssets(manifest.assets), second = sampleAssets(manifest.assets, first.nextCursor);
  assert.notDeepEqual(first.assets.map(a => a.key), second.assets.map(a => a.key));
  assert(first.assets.some(a => a.contentType === 'image/png')); assert(first.assets.some(a => a.contentType === 'application/pdf'));
});
test('explicit full mode checks every public byte rather than sampling', () => {
  const plan = inventoryPlan(manifest, baseline(), scope, { now, full: true });
  assert.equal(plan.mode, 'complete'); assert.equal(plan.added.length, manifest.assets.length);
});
test('unit and browser qualification reject skipped, flaky and empty reports', () => {
  for (const r of [{ success: true, numPassedTests: 0 }, { success: true, numPassedTests: 1, numPendingTests: 1 }, { success: false, numPassedTests: 1 }]) assert.throws(() => vitestEvidence(r));
  assert.throws(() => browserEvidence({ suites: [] }));
  for (const status of ['skipped', 'flaky', 'unexpected']) assert.throws(() => browserEvidence({ suites: [{ specs: [{ id: 'one', tests: [{ expectedStatus: 'passed', status, results: [{ status: 'passed' }] }] }] }] }));
});
test('qualification cannot seal without both non-overlapping complete browser shards', () => {
  const { directory, release } = packageFixture(), checks = temporary();
  release.inputs.classification.required = ['browser-1', 'browser-2']; save(resolve(directory, 'release.json'), release);
  const put = (name, cases) => save(resolve(checks, `${name}.json`), { schemaVersion: 1, name, releaseId: release.releaseId, status: 'passed', evidence: { cases } });
  put('browser-1', ['one']); assert.throws(() => sealQualification(directory, checks, ['one', 'two']));
  put('browser-2', ['one']); assert.throws(() => sealQualification(directory, checks, ['one', 'two']), /overlapped/);
  put('browser-2', ['two']); assert.throws(() => sealQualification(directory, checks, ['one', 'two', 'three']), /omitted/);
  assert.equal(sealQualification(directory, checks, ['one', 'two']).status, 'qualified');
});
test('wrong-release or incomplete qualification cannot authorise publication', () => {
  const { release } = packageFixture(), receipt = qualification(release);
  validateQualification(release, receipt);
  assert.throws(() => validateQualification(release, { ...receipt, releaseId: 'wrong' }));
  const broken = { ...receipt, checks: [] }; broken.checksDigest = digestObject(broken.checks);
  assert.throws(() => validateQualification(release, broken), /Required check/);
});
function deploymentFixture(overrides = {}) {
  const { release } = packageFixture(), journalPath = resolve(temporary(), 'attempt.json');
  let version = 'old', deploys = 0;
  const adapter = { current: async () => version, validate: async () => {}, inventory: async () => ({ mode: 'sampled' }), deploy: async () => { deploys++; version = 'new'; return version; }, verifyBytes: async () => {}, smoke: async () => {}, rollback: async v => { version = v; }, verifyPrevious: async () => {}, confirmedApplicationFailure: () => true, ...overrides };
  return { release, qualification: qualification(release), adapter, expectedVersion: 'old', journalPath, getDeploys: () => deploys, setVersion: v => { version = v; } };
}
test('a successful release records accepted deployment before verified live closure', async () => {
  const f = deploymentFixture(); const result = await promoteRelease(f);
  assert.equal(result.status, 'live-verified');
  assert.deepEqual(result.events.map(e => e.status), ['preflight', 'assets-verified', 'deploying', 'deployed', 'live-verified']);
});
test('superseding release and partial asset failures stop before Worker deployment', async () => {
  const advanced = deploymentFixture({ current: async () => 'someone-elses-release' });
  await assert.rejects(promoteRelease(advanced), /advanced/); assert.equal(advanced.getDeploys(), 0);
  const partial = deploymentFixture({ inventory: async () => { throw new Error('Upload failed partway'); } });
  await assert.rejects(promoteRelease(partial), /Upload failed/); assert.equal(partial.getDeploys(), 0); assert.equal(json(partial.journalPath).status, 'failed');
});
test('post-deployment failure retains an unverified attempt and never writes success', async () => {
  const f = deploymentFixture({ smoke: async () => { throw new Error('Browser failure'); } });
  await assert.rejects(promoteRelease(f), /deployed-unverified/);
  assert.equal(json(f.journalPath).deployedVersion, 'new'); assert.equal(json(f.journalPath).status, 'deployed-unverified');
});
test('confirmed failures restore the captured version, while network outages do not speculate', async () => {
  const f = deploymentFixture({ smoke: async () => { throw new Error('Confirmed application failure'); } });
  await assert.rejects(promoteRelease({ ...f, rollbackOnFailure: true }), /rolled-back/); assert.equal(json(f.journalPath).restoredVersion, 'old');
  const network = deploymentFixture({ smoke: async () => { throw new Error('Network unavailable'); }, confirmedApplicationFailure: () => false });
  await assert.rejects(promoteRelease({ ...network, rollbackOnFailure: true }), /deployed-unverified/);
});
test('a newer independent version is never rolled back after failed verification', async () => {
  let f; f = deploymentFixture({ smoke: async () => { f.setVersion('newer-release'); throw new Error('Failure'); } });
  await assert.rejects(promoteRelease({ ...f, rollbackOnFailure: true }), /deployed-unverified/);
  assert.equal(await f.adapter.current(), 'newer-release');
});
test('sampled inventory performs zero stored HEAD/PUT operations', async () => {
  let stored = 0, puts = 0, publicHeads = 0;
  const release = { inputs: { verifierId: 'v1' } }, fullScope = { bucket: manifest.bucket, assetOrigin: manifest.assetOrigin, origin: scope.origin, policyVerified: true, corsDigest: 'policy', cachePolicy: 'public, max-age=31536000, immutable', verifier: 'v1' };
  const prior = verificationRecord(manifest, fullScope, { mode: 'complete', nextCursor: 0 }, null);
  const store = { policy: async () => ({ verified: true, digest: 'policy' }), head: async () => { stored++; }, put: async () => { puts++; } };
  const fetcher = async url => { publicHeads++; const a = manifest.assets.find(a => url.endsWith(a.key)); return new Response(null, { headers: { 'content-length': String(a.bytes), 'content-type': a.contentType, etag: a.md5, 'cache-control': fullScope.cachePolicy, 'access-control-allow-origin': scope.origin } }); };
  const metrics = { count() {}, stage: async (_name, action) => action() };
  const result = await verifyInventory({ root: '', manifest, release, baseline: prior, origin: scope.origin, metrics, store, fetcher });
  assert.equal(result.summary.mode, 'sampled'); assert.equal(stored, 0); assert.equal(puts, 0); assert.equal(publicHeads, 32);
});
test('range qualification checks status, exact content range and real PDF body', async () => {
  const pdf = manifest.assets.find(a => a.contentType === 'application/pdf'), metrics = { count() {} };
  await verifyRange(manifest, scope.origin, metrics, async () => new Response('%PDF-12345678901', { status: 206, headers: { 'content-range': `bytes 0-15/${pdf.bytes}` } }));
  await assert.rejects(verifyRange(manifest, scope.origin, metrics, async () => new Response('not a PDF', { status: 200 })), /range response/);
});
