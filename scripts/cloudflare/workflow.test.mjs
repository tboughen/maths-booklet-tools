import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { resolve, sep } from 'node:path';
import { classifyPaths } from './classify.mjs';
import { inventoryPlan, verificationRecord } from './inventory.mjs';
import { verifyInventory } from './network.mjs';
import { sha256, save, repository, run } from './common.mjs';
import { validateWorkflowOrigin } from './github-trust.mjs';
import { prepareCatalogueCache, publicationOrigin, validateCatalogueReceipt } from './catalogue-cache.mjs';
import { watchRun } from './watch-run.mjs';
import { validateReusableInputs, packageRelease, verifyReusableCatalogue, policyFiles } from './package.mjs';
import { git } from './common.mjs';

const roots = [];
function temporary() { const p = mkdtempSync(resolve(tmpdir(), 'mathsdock-workflow-test-')); roots.push(p); return p; }
afterEach(() => { for (const p of roots.splice(0)) { if (!p.startsWith(resolve(tmpdir()) + sep + 'mathsdock-workflow-test-')) throw new Error('Unsafe test cleanup'); rmSync(p, { recursive: true, force: true }); } });

test('known tool qualification inputs keep broad checks without forcing bank checks', () => {
  const paths = ['playwright.algebra.config.ts', 'scripts/algebra-grid-examples.mjs', 'scripts/verify-diagram-consumption.py', 'tsconfig.service.json', '.dockerignore', 'src/algebra-grid/AlgebraGridPage.tsx', 'packages/algebra-grid-core/src/interchange.ts'];
  const actual = classifyPaths(paths);
  assert.equal(actual.fullInventory, false);
  assert.equal(actual.service, true); assert.equal(actual.website, true);
  assert.deepEqual(actual.required, ['units', 'catalogue', 'publisher', 'built', 'browser-1', 'browser-2', 'service']);
  assert.deepEqual(actual.inventoryReasons, []);
});
test('website and service boundaries keep their required checks', () => {
  const website = classifyPaths(['src/ratio-table/RatioTablePage.tsx']);
  assert.equal(website.fullInventory, false); assert.equal(website.service, false); assert.equal(website.required.length, 6);
  for (const path of ['.dockerignore', 'tsconfig.service.json', 'services/graph-mcp/server.ts']) {
    const service = classifyPaths([path]);
    assert.equal(service.fullInventory, false); assert.equal(service.website, false); assert.deepEqual(service.required, ['service']);
  }
  assert.deepEqual(classifyPaths(['docs/RELEASE-PIPELINE.md']).required, []);
});
test('policy, dependencies, unrecognised helpers and absent comparison fail conservatively', () => {
  for (const path of ['scripts/cloudflare/network.mjs', 'scripts/cloudflare/inventory.mjs', 'scripts/cloudflare/package.mjs', 'scripts/cloudflare/release.ts', 'scripts/cloudflare/classify.mjs', 'bankAssets.ts', 'vite.config.ts', 'wrangler.jsonc', 'package-lock.json', 'package.json', '.nvmrc', '.github/workflows/cloudflare.yml', 'scripts/unknown-helper.mjs', 'surprise-file', 'playwright.config.secret']) {
    const result = classifyPaths([path]); assert.equal(result.fullInventory, true, path); assert.equal(result.service, true, path); assert.equal(result.website, true, path); assert(result.inventoryReasons.some(r => r.includes(path)), path);
  }
  assert.equal(classifyPaths([], true).fullInventory, true);
  assert.equal(classifyPaths(['playwright.algebra.config.ts', 'package-lock.json']).fullInventory, true);
});

const bytes = Buffer.from('asset-data');
const asset = { key: `bank/assets/sha256/${sha256(bytes)}.pdf`, sha256: sha256(bytes), md5: createHash('md5').update(bytes).digest('hex'), bytes: bytes.length, contentType: 'application/pdf', sources: ['bank/assets/example/print.pdf'] };
const manifest = { schemaVersion: 1, bucket: 'maths-booklet-assets', assetOrigin: 'same-origin', assets: Array.from({ length: 40 }, (_, i) => ({ ...asset, key: `bank/assets/sha256/${sha256(String(i))}.pdf`, sha256: sha256(String(i)) })) };
const storedCache = 'public, max-age=31536000, immutable';
const scope = { bucket: manifest.bucket, assetOrigin: manifest.assetOrigin, origin: 'https://mathsdock.co.uk', policyVerified: true, corsDigest: 'policy', cachePolicy: 'private, max-age=31536000, immutable', verifier: 'v2' };
const prior = () => verificationRecord(manifest, scope, { mode: 'complete', nextCursor: 0 }, null);
const metrics = { count() {}, stage: async (_n, fn) => fn() };
function networkOptions(extra = {}) {
  const counts = { head: 0, put: 0, get: 0, public: 0 }, baseline = prior();
  const options = {
    root: '', readOnly: true, manifest, release: { inputs: { verifierId: 'v2', classification: classifyPaths(['src/example.ts']) } }, baseline, origin: scope.origin, metrics,
    store: { policy: async () => ({ verified: true, digest: 'policy' }), head: async key => { counts.head++; const a = manifest.assets.find(a => a.key === key); return { ...a, cacheControl: storedCache }; }, put: async () => { counts.put++; }, get: async () => { counts.get++; return bytes; } },
    fetcher: async (url, init) => { counts.public++; const a = manifest.assets.find(a => url.endsWith(a.key)); return new Response(init.method === 'GET' ? bytes : null, { headers: { 'content-length': String(a.bytes), 'content-type': a.contentType, etag: a.md5, 'cache-control': scope.cachePolicy } }); },
    ...extra,
  };
  return { options, counts, baseline };
}
test('preflight runs before object requests; fresh audit keeps zero stored operations and 32 samples', async () => {
  const f = networkOptions(); let observed;
  f.options.onPlan = p => { observed = p; assert.deepEqual(f.counts, { head: 0, put: 0, get: 0, public: 0 }); };
  const result = await verifyInventory(f.options);
  assert.equal(observed.mode, 'sampled'); assert.equal(observed.publicPlanned, 32); assert.equal(observed.storedPlanned, 0);
  assert.equal(result.record.fullAuditAt, f.baseline.fullAuditAt);
  assert.deepEqual(f.counts, { head: 0, put: 0, get: 0, public: 32 });
});
test('classifier-forced and explicitly requested audit reasons remain distinct', async () => {
  const f = networkOptions();
  f.options.release.inputs.classification = classifyPaths(['scripts/cloudflare/network.mjs']);
  const result = await verifyInventory(f.options);
  assert.match(result.summary.reason, /Release classification.*scripts\/cloudflare\/network.mjs/);
  assert.equal(result.summary.storedChecked, 40);
  const explicit = await verifyInventory({ ...f.options, audit: true });
  assert.equal(explicit.summary.reason, 'Explicit inventory audit');
  const legacy = networkOptions(); legacy.options.release.inputs.classification = { fullInventory: true };
  assert.match((await verifyInventory(legacy.options)).summary.reason, /legacy broad classification/);
});
test('preflight reporting failure and failed public sample both stop without a success record', async () => {
  const f = networkOptions({ onPlan: () => { throw new Error('Cannot save preflight'); } });
  await assert.rejects(verifyInventory(f.options), /Cannot save preflight/); assert.equal(f.counts.public, 0);
  const failed = networkOptions({ fetcher: async () => new Response(null, { status: 404 }) });
  await assert.rejects(verifyInventory(failed.options));
  assert.equal(failed.baseline.mode, 'complete'); assert.equal(failed.counts.put, 0);
});
test('expired and verifier-changed evidence cannot be sampled', async () => {
  for (const change of [b => { b.fullAuditAt = '2000-01-01'; }, b => { b.scope = { ...b.scope, verifier: 'old' }; }, b => { b.coverageDigest = 'bad'; }]) {
    const f = networkOptions(); change(f.options.baseline);
    const result = await verifyInventory(f.options); assert.equal(result.summary.mode, 'complete'); assert.equal(f.counts.head, 40);
  }
});
test('new existing keys are read and hashed in delta mode; wrong bytes block acceptance', async () => {
  for (const wrong of [false, true]) {
    const f = networkOptions(), next = { ...manifest, assets: [...manifest.assets, asset] };
    f.options.root = temporary(); f.options.readOnly = false;
    mkdirSync(resolve(f.options.root, 'public/bank/assets/example'), { recursive: true });
    writeFileSync(resolve(f.options.root, 'public', asset.sources[0]), bytes);
    const oldHead = f.options.store.head;
    f.options.manifest = next;
    f.options.store.head = async key => key === asset.key ? { ...asset, cacheControl: storedCache } : oldHead(key);
    f.options.store.get = async () => wrong ? Buffer.from('wrong') : bytes;
    f.options.fetcher = async url => { const a = next.assets.find(a => url.endsWith(a.key)); return new Response(null, { headers: { 'content-length': String(a.bytes), 'content-type': a.contentType, etag: a.md5, 'cache-control': scope.cachePolicy } }); };
    if (wrong) await assert.rejects(verifyInventory(f.options), /Existing immutable bytes failed/);
    else { const result = await verifyInventory(f.options); assert.equal(result.summary.mode, 'delta'); assert.equal(result.summary.storedChecked, 1); assert.equal(result.record.fullAuditAt, f.baseline.fullAuditAt); }
  }
});
test('full still means public GET and hashing every body', async () => {
  const f = networkOptions();
  await assert.rejects(verifyInventory({ ...f.options, full: true }), /Public bytes differ/);
  assert.equal(inventoryPlan(manifest, prior(), scope, { full: true }).reason, 'Explicit full public byte verification');
});

function catalogueFixture() {
  const root = temporary(), output = resolve(root, 'cache');
  const release = { releaseId: 'release', sourceCommit: 'qualified', inputs: { sourceTree: 'tree' } };
  const receipt = { repository, status: 'live-verified', releaseId: 'release', sourceTree: 'tree', sourceCommit: 'qualified' };
  let verified = 0;
  const options = {
    output, api: async () => ({ workflow_runs: [{ id: 12 }] }), verifyRun: async (_root, _id, expectation) => { assert.deepEqual(expectation, publicationOrigin); return { head_sha: 'a'.repeat(40) }; },
    download: async (_root, id, name, dir, expectation) => { assert.equal(name, 'published-release'); assert.deepEqual(expectation, publicationOrigin); mkdirSync(resolve(dir, 'package')); save(resolve(dir, 'package/release.json'), release); save(resolve(dir, 'deploy-receipt.json'), receipt); return { runId: id, id: 99 }; },
    verify: () => { verified++; }, tree: () => 'tree',
  };
  return { root, options, release, receipt, verified: () => verified };
}
test('hosted cache discovers trusted main publication and requires all identity gates', async () => {
  const f = catalogueFixture(); const result = await prepareCatalogueCache(f.root, f.options);
  assert.equal(result.status, 'reused'); assert.equal(result.runId, '12'); assert.equal(f.verified(), 1); assert(result.packagePath.startsWith(f.options.output));
});
test('cache misses, expired artifacts, incompatible identities and unavailable GitHub fall back cold', async () => {
  for (const phase of ['api', 'verifyRun', 'download', 'verify', 'tree']) {
    const f = catalogueFixture(); f.options[phase] = () => { throw new Error('Unavailable'); };
    const result = await prepareCatalogueCache(f.root, f.options); assert.equal(result.status, 'cold', phase); assert.equal(result.packagePath, undefined);
  }
  const empty = catalogueFixture(); empty.options.api = async () => ({ workflow_runs: [] });
  assert.equal((await prepareCatalogueCache(empty.root, empty.options)).status, 'cold');
});
test('cache provenance rejects non-main, fork, wrong event and unverified or mismatched receipt', () => {
  const f = catalogueFixture();
  const producer = { repository: { full_name: repository }, head_repository: { full_name: repository }, status: 'completed', conclusion: 'success', path: publicationOrigin.path, head_branch: 'main', event: 'workflow_dispatch' };
  validateWorkflowOrigin(producer, publicationOrigin);
  for (const change of [{ head_branch: 'feature' }, { event: 'pull_request' }, { head_repository: { full_name: 'fork/repo' } }, { conclusion: 'failure' }]) assert.throws(() => validateWorkflowOrigin({ ...producer, ...change }, publicationOrigin));
  for (const change of [{ status: 'deployed-unverified' }, { releaseId: 'other' }, { sourceTree: 'other' }, { sourceCommit: 'other' }, { repository: 'fork/repo' }]) assert.throws(() => validateCatalogueReceipt({ ...f.receipt, ...change }, f.release, 'tree'));
  assert.throws(() => validateCatalogueReceipt(f.receipt, f.release, 'wrong'));
});
test('reusable catalogue rejects changed bank, transformer, dependencies and runtime', () => {
  const expected = { bankTree: 'bank', transformationId: 'transform', lockfile: 'lock', node: '24.14.1' };
  validateReusableInputs({ ...expected, node: '24.15.0' }, expected);
  for (const field of ['bankTree', 'transformationId', 'lockfile', 'node']) {
    assert.throws(() => validateReusableInputs({ ...expected, [field]: field === 'node' ? '25.0.0' : 'different' }, expected), /Reusable bank inventory/);
    const missing = { ...expected }; delete missing[field];
    assert.throws(() => validateReusableInputs(missing, expected), /Reusable bank inventory/);
  }
});
test('real clean Git/package fixture reuses exact catalogue and rejects altered inputs or bytes', () => {
  const root = temporary(), cache = resolve(root, 'cloudflare-release/package');
  for (const [p, text] of [
    ['.gitignore', 'cloudflare-release\ndist-cloudflare\n'],
    ['public/bank/catalogue.json', '{"questions":[]}'], ['public/bank/assets/example/print.pdf', 'asset-data'],
    ['package-lock.json', '{"version":1}'], ['wrangler.jsonc', '{}'], ['wrangler.preview.jsonc', '{}'], ['scripts/cloudflare/site-worker.mjs', '// fixture worker'],
    ...policyFiles.map(p => [p, `// fixture ${p}`]),
    ...['network.mjs', 'inventory.mjs', 'upload-core.mjs', 'common.mjs', 'cors-policy.mjs'].map(p => [`scripts/cloudflare/${p}`, '// fixture verifier']),
  ]) { mkdirSync(resolve(root, p, '..'), { recursive: true }); writeFileSync(resolve(root, p), text); }
  git(root, ['init', '--initial-branch=main']);
  const commit = () => { git(root, ['add', '.']); git(root, ['-c', 'user.name=Workflow test', '-c', 'user.email=workflow@example.invalid', 'commit', '-m', 'Synthetic fixture']); return git(root, ['rev-parse', 'HEAD']); };
  const first = commit();
  mkdirSync(resolve(root, 'cloudflare-release'), { recursive: true });
  mkdirSync(resolve(root, 'dist-cloudflare/bank'), { recursive: true });
  const catalogue = '{"questions":[]}';
  writeFileSync(resolve(root, 'dist-cloudflare/bank/catalogue.json'), catalogue);
  save(resolve(root, 'cloudflare-release/manifest.json'), { ...manifest, assets: [asset], sourceCommit: first, catalogueSha256: sha256(catalogue) });
  packageRelease(root, { base: first, directory: cache });
  const reused = verifyReusableCatalogue(root, cache);
  assert.equal(reused.catalogueJson, catalogue); assert.equal(reused.manifest.sourceCommit, first);
  for (const p of ['public/bank/catalogue.json', 'vite.config.ts', 'package-lock.json']) {
    const original = p === 'public/bank/catalogue.json' ? catalogue : p === 'package-lock.json' ? '{"version":1}' : '// fixture vite.config.ts';
    writeFileSync(resolve(root, p), original + ' ');
    assert.throws(() => verifyReusableCatalogue(root, cache), /clean, committed/);
    commit(); assert.throws(() => verifyReusableCatalogue(root, cache), /changed/);
    writeFileSync(resolve(root, p), original); commit();
    assert.equal(verifyReusableCatalogue(root, cache).catalogueJson, catalogue);
  }
  writeFileSync(resolve(cache, 'site/bank/catalogue.json'), 'corrupt');
  assert.throws(() => verifyReusableCatalogue(root, cache), /modified/);
});
test('explicit cache run is validated and no unsafe revision reaches Git', async () => {
  const f = catalogueFixture(); f.options.api = () => { throw new Error('Must not discover'); };
  assert.equal((await prepareCatalogueCache(f.root, { ...f.options, runId: '12' })).status, 'reused');
  assert.equal((await prepareCatalogueCache(f.root, { ...f.options, runId: '12;bad' })).status, 'cold');
  f.options.verifyRun = async () => ({ head_sha: '--malicious' });
  let called = false; f.options.tree = () => { called = true; };
  assert.equal((await prepareCatalogueCache(f.root, { ...f.options, runId: '12' })).status, 'cold'); assert.equal(called, false);
});

function watcherFixture(states) {
  let time = 0, index = 0; const reports = [], waits = [], calls = [];
  const options = {
    runId: '12', timeoutMs: 300000, intervalMs: 30000, now: () => time,
    wait: async ms => { time += ms; waits.push(ms); }, report: r => reports.push(r),
    api: async (_root, path, opts) => {
      assert(opts.timeoutMs > 0 && opts.timeoutMs <= 30000); calls.push(path);
      if (path.includes('/jobs?')) return { jobs: [{ id: 1, name: 'units', status: states[Math.min(index - 1, states.length - 1)] === 'completed' ? 'completed' : 'in_progress' }], total_count: 1 };
      const status = states[Math.min(index++, states.length - 1)];
      return { id: 12, repository: { full_name: repository }, head_repository: { full_name: repository }, path: '.github/workflows/graph-checks.yml', head_sha: 'a'.repeat(40), status, conclusion: status === 'completed' ? 'success' : null };
    },
  };
  return { options, reports, waits, calls };
}
test('one watcher backs off unchanged status, emits only changes and ends on success', async () => {
  const f = watcherFixture(['in_progress', 'in_progress', 'in_progress', 'completed']);
  const result = await watchRun('', f.options);
  assert.equal(result.state, 'workflow-success'); assert.equal(f.reports.length, 2); assert.deepEqual(f.waits, [30000, 60000, 60000]);
});
test('watcher timeout and failed run cannot report workflow success', async () => {
  const f = watcherFixture(['in_progress']);
  const result = await watchRun('', { ...f.options, timeoutMs: 55000 });
  assert.equal(result.state, 'timed-out'); assert.equal(f.reports.at(-1).state, 'timed-out'); assert.deepEqual(f.waits, [30000, 25000]);
  const failed = watcherFixture(['completed']), api = failed.options.api;
  failed.options.api = async (...args) => { const r = await api(...args); return args[1].includes('/jobs?') ? r : { ...r, conclusion: 'failure' }; };
  assert.equal((await watchRun('', failed.options)).state, 'workflow-failed');
});
test('watcher rejects wrong identity, invalid timing and unavailable queries', async () => {
  const f = watcherFixture(['completed']);
  await assert.rejects(watchRun('', { ...f.options, expectedCommit: 'other' }), /different source/);
  await assert.rejects(watchRun('', { ...f.options, timeoutMs: Infinity }), /timing/);
  await assert.rejects(watchRun('', { ...f.options, runId: '--wrong' }), /exact workflow/);
  await assert.rejects(watchRun('', { ...f.options, api: async () => { throw new Error('Unavailable'); } }), /Unavailable/);
});
test('GitHub subprocess timeouts terminate a stalled query', async () => {
  const started = Date.now();
  await assert.rejects(run(process.cwd(), process.execPath, ['-e', 'setTimeout(() => {}, 20000)'], { capture: true, timeoutMs: 100 }));
  assert(Date.now() - started < 10000);
});
