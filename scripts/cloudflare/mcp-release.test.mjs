import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, cpSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { browserFixtureFiles, sealFixtures, verifyFixtures, compareCatalogues, verifyServiceArtifact } from './mcp-evidence.mjs';
import { guardedOverlay, stageDecision, recordStage, verifyCompatibility, verifyGuidance, createReleaseRecord, freezeRecord } from './mcp-release.mjs';
import { classifyPaths } from './classify.mjs';
import { digestObject, fileManifest, run, save, sha256, repository } from './common.mjs';
import { verifyQualificationPackage, verifyPackage, packageSourceQualification } from './package.mjs';
const temporary = [];
const temp = () => { const d = mkdtempSync(resolve(tmpdir(), 'md-mcp-')); temporary.push(d); return d; };
afterEach(() => { for (const path of temporary.splice(0)) rmSync(path, { recursive: true, force: true }); });
const identity = { sourceTree: 'tree', buildId: 'build', producer: 'producer', run: process.env.GITHUB_RUN_ID || 'local', attempt: process.env.GITHUB_RUN_ATTEMPT || '1' };
function fixtures() { const d = temp(); for (const p of browserFixtureFiles) writeFileSync(resolve(d, p), p); return d; }
test('fixture manifest binds complete consumer inventory and source/run/attempt', () => {
  const d = fixtures(); sealFixtures(d, identity, 'browser'); verifyFixtures(d, identity, 'browser');
  for (const key of ['sourceTree', 'buildId', 'producer', 'run', 'attempt']) assert.throws(() => verifyFixtures(d, { ...identity, [key]: 'wrong' }, 'browser'), /identity|source|producer/);
  assert.throws(() => verifyFixtures(d, identity, 'full'), /profile/);
});
for (const mutation of ['missing', 'extra', 'corrupt']) test(`fixture ${mutation} fails without regeneration`, () => {
  const d = fixtures(); sealFixtures(d, identity, 'browser');
  if (mutation === 'missing') rmSync(resolve(d, browserFixtureFiles[0]));
  if (mutation === 'extra') writeFileSync(resolve(d, 'unexpected.json'), '{}');
  if (mutation === 'corrupt') writeFileSync(resolve(d, browserFixtureFiles[0]), 'changed');
  assert.throws(() => verifyFixtures(d, identity, 'browser'), /missing, extra or corrupt/);
});
test('an omitted consumer file or full-suite proof cannot be sealed', () => {
  const d = fixtures(); rmSync(resolve(d, 'venn-bundle.zip'));
  assert.throws(() => sealFixtures(d, identity, 'browser'), /Missing browser/);
  writeFileSync(resolve(d, 'venn-bundle.zip'), 'restored');
  assert.throws(() => sealFixtures(d, identity, 'full'), /Missing full/);
});
const tool = (name, extra = {}) => ({ name, inputSchema: { type: 'object', properties: {} }, ...extra });
test('catalogue comparison ignores name ordering, preserves all advertised metadata', () => {
  const a = { tools: [tool('a'), tool('b')] }, b = { tools: [tool('b'), tool('a')] };
  assert.deepEqual(compareCatalogues(a, b, { added: [], removed: [], changed: [] }).changed, []);
  for (const delta of [{ description: 'different' }, { outputSchema: { type: 'string' } }, { annotations: { readOnlyHint: false } }]) {
    assert.throws(() => compareCatalogues(a, { tools: [tool('a', delta), tool('b')] }, { added: [], removed: [], changed: [] }), /Unexpected/);
  }
  assert.throws(() => compareCatalogues(a, { tools: [tool('a'), tool('a')] }, { added: [], removed: [], changed: [] }), /duplicate/);
  assert.throws(() => compareCatalogues(a, { tools: [tool('a')] }, { added: [], removed: [], changed: [] }), /Unexpected/);
});
test('mixed impacts union all obligations and collector-only changes retain broad checks', () => {
  const mixed = classifyPaths(['docs/MCP.md', 'src/App.tsx', 'services/graph-mcp/server.ts']);
  assert(mixed.impacts.guidance && mixed.impacts.website && mixed.impacts.serviceRuntime && mixed.impacts.advertisedMetadata);
  assert.equal(mixed.required.length, 7);
  assert.equal(classifyPaths(['services/graph-mcp/verify-consumption.ts']).required.length, 7);
  assert.equal(classifyPaths(['unknown-helper']).required.length, 7);
  assert.equal(classifyPaths([], true).fullInventory, true);
});
function record(scope = 'publication') { return { scope, stages: Object.fromEntries(['service', 'website', 'package', 'client'].map(s => [s, { status: 'planned', observations: [] }])) }; }
test('resume reconciles lost responses and refuses a newer independent build', () => {
  let r = record(); const args = { before: 'old', target: 'new', observed: 'old' };
  assert.equal(stageDecision(r, 'service', args), 'run-authorised-stage');
  r = recordStage(r, 'service', { status: 'unknown', target: 'new' });
  assert.equal(stageDecision(r, 'service', args), 'reconcile-before-retry');
  assert.equal(stageDecision(r, 'service', { ...args, observed: 'new' }), 'verify-existing');
  assert.throws(() => stageDecision(r, 'service', { ...args, observed: 'someone-newer' }), /newer/);
  assert.throws(() => stageDecision(record('implementation'), 'service', args), /authorisation/);
});
test('verified resume needs current identity and independent saved bytes; SDK is not client acceptance', () => {
  const path = resolve(temp(), 'proof.txt'); writeFileSync(path, 'proof');
  const evidence = [{ path, bytes: 5, sha256: sha256('proof') }];
  const r = recordStage(record(), 'service', { status: 'verified', target: 'new', observed: 'new', evidence, provenance: 'live-https' });
  assert.equal(stageDecision(r, 'service', { before: 'old', target: 'new', observed: 'new' }), 'reuse-verified');
  assert.throws(() => stageDecision(r, 'service', { before: 'old', target: 'new', observed: 'other' }));
  assert.throws(() => recordStage(record(), 'client', { status: 'verified', target: 'new', observed: 'new', evidence, provenance: 'sdk' }), /SDK/);
  writeFileSync(path, 'wrong');
  assert.throws(() => recordStage(record(), 'service', { status: 'verified', target: 'new', observed: 'new', evidence }), /differs/);
});
const manifests = version => ({ 'plugin.json': JSON.stringify({ version, app: 'same', audience: 'private' }), '.codex-plugin/plugin.json': JSON.stringify({ version, app: 'same', audience: 'private' }) });
test('three-way overlay preserves unrelated current changes and detects conflicting edits', () => {
  const base = { ...manifests('1'), 'skills/a/SKILL.md': 'old', 'other.md': 'before' };
  const current = { ...base, 'other.md': 'concurrent' };
  const result = guardedOverlay(base, current, { ...manifests('2'), 'skills/a/SKILL.md': 'new' });
  assert.equal(result.merged['other.md'], 'concurrent'); assert(result.appBindingPreserved);
  assert.throws(() => guardedOverlay(base, { ...current, 'skills/a/SKILL.md': 'someone-else' }, { 'skills/a/SKILL.md': 'new' }), /Concurrent/);
  assert.equal(guardedOverlay(current, current, current).changes.length, 0);
});
test('overlay rejects manifest binding changes, traversal, deletion and broken links', () => {
  const base = { ...manifests('1'), 'skills/a/SKILL.md': 'preserve me' };
  assert.throws(() => guardedOverlay(base, base, { 'plugin.json': JSON.stringify({ version: '1', app: 'wrong', audience: 'private' }) }), /binding/);
  for (const path of ['../outside', 'C:outside', 'dir\\outside']) assert.throws(() => guardedOverlay(base, base, { [path]: 'bad' }), /Unsafe/);
  assert.throws(() => guardedOverlay(base, base, { 'skills/a/SKILL.md': null }), /deletions/);
  assert.throws(() => guardedOverlay(base, base, { 'skills/a/SKILL.md': '[missing](no.md)' }), /Broken/);
});
test('compatibility cannot be inferred from missing or pending pairs', () => {
  const d = temp();
  const rows = ['current-current', 'current-new', 'new-current', 'new-new', 'saved-legacy'].map(pair => {
    const websiteIdentity = pair.startsWith('new-') ? 'new-website' : 'old-website', serviceIdentity = pair.endsWith('-new') ? 'new-service' : 'old-service';
    const path = resolve(d, pair + '.json'), text = JSON.stringify({ status: 'passed', websiteIdentity, serviceIdentity, provenance: 'synthetic unit receipt' });
    writeFileSync(path, text); return { pair, status: 'verified', websiteIdentity, serviceIdentity, evidence: [{ path, bytes: Buffer.byteLength(text), sha256: sha256(text) }] };
  });
  assert(verifyCompatibility(rows).compatibleForPublication);
  assert.throws(() => verifyCompatibility(rows.slice(1)), /Missing/);
  rows[1].status = 'pending'; assert.equal(verifyCompatibility(rows).compatibleForPublication, false);
  assert.throws(() => verifyCompatibility([...rows, rows[0]]), /unique/);
  const wrong = structuredClone(rows); wrong[2].evidence = ['invented-proof.json']; assert.throws(() => verifyCompatibility(wrong), /hashed receipts/);
  writeFileSync(rows[2].evidence[0].path, '{}'); assert.throws(() => verifyCompatibility(rows), /bytes differ/);
});
test('documentation preflight checks actual changed references', () => {
  const root = temp(); mkdirSync(resolve(root, 'docs')); writeFileSync(resolve(root, 'docs/a.md'), '[b](b.md)');
  const scope = { reasons: ['documentation: docs/a.md'] };
  assert.throws(() => verifyGuidance(root, scope), /Missing guidance/);
  writeFileSync(resolve(root, 'docs/b.md'), 'target'); assert.equal(verifyGuidance(root, scope).links, 1);
});
test('service-only source qualification verifies but cannot become a website promotion', () => {
  const d = temp(), inputs = { repository, classification: { website: false, service: true }, sourceTree: 'tree' };
  save(resolve(d, 'source.json'), { sourceCommit: 'commit', inputs });
  const files = fileManifest(d), release = { schemaVersion: 1, kind: 'source-qualification', inputs, files, sourceCommit: 'commit', releaseId: digestObject({ inputs, files }), createdAt: new Date().toISOString() };
  save(resolve(d, 'release.json'), release); verifyQualificationPackage(d);
  assert.throws(() => verifyPackage(d), /cannot be promoted/);
});
test('retained service artifacts reject another source and altered bytes', () => {
  const d = temp(), release = { releaseId: 'id', sourceCommit: 'commit', inputs: { sourceTree: 'tree' } };
  for (const p of ['service-dist/cli.js', 'service-dist/raster-worker.js', 'service-dist/healthcheck.js', 'fonts/STIXTwoText-Regular.otf', 'fonts/STIXTwoText-Italic.otf', 'fonts/STIXTwoMath-Regular.otf']) { mkdirSync(resolve(d, p, '..'), { recursive: true }); writeFileSync(resolve(d, p), 'fixture'); }
  save(resolve(d, 'service-dist/manifest.json'), { buildId: 'build' });
  save(resolve(d, 'source.json'), { sourceCommit: 'commit', sourceTree: 'tree', qualificationInputs: release.inputs });
  mkdirSync(resolve(d, 'vector'));
  for (const path of ['vector-proof.json', 'direct-svg-vector-proof.json', 'a3-diagram-consumption.pdf', 'direct-svg-vector-proof.pdf']) writeFileSync(resolve(d, 'vector', path), path.endsWith('.json') ? '{"passed":true}' : 'unit-vector-proof');
  const controls = resolve(d, 'controls'); mkdirSync(controls);
  for (const p of [...browserFixtureFiles, 'shading.json', 'svg-delivery-proof.json']) writeFileSync(resolve(controls, p), 'fixture');
  sealFixtures(controls, identity, 'full');
  writeFileSync(resolve(d, 'control.svg'), '<svg/>'); const files = fileManifest(d);
  save(resolve(d, 'service-artifact.json'), { schemaVersion: 1, kind: 'checked-service-artifact', releaseId: 'id', sourceTree: 'tree', buildId: 'build', identity, files, filesDigest: digestObject(files) });
  verifyServiceArtifact(d, release);
  assert.throws(() => verifyServiceArtifact(d, { ...release, inputs: { sourceTree: 'wrong' } }), /another/);
  writeFileSync(resolve(d, 'control.svg'), 'changed'); assert.throws(() => verifyServiceArtifact(d, release), /bytes differ/);
  assert.equal(readFileSync(resolve(d, 'control.svg'), 'utf8'), 'changed');
});
function gitFixture() {
  const root = temp();
  const put = (path, content) => { mkdirSync(resolve(root, path, '..'), { recursive: true }); writeFileSync(resolve(root, path), content); };
  for (const path of ['public/bank/catalogue.json', 'package-lock.json', 'scripts/cloudflare/mcp-release.mjs', 'scripts/cloudflare/release.ts', 'bankAssets.ts', 'workedSolution.ts', 'scripts/bank/solution-files.ts', 'vite.config.ts', ...['network.mjs','inventory.mjs','upload-core.mjs','common.mjs','cors-policy.mjs'].map(n => `scripts/cloudflare/${n}`)]) put(path, '{}');
  const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8', windowsHide: true });
  git(['init', '-q']); git(['add', '.']);
  const commit = () => { git(['add', '.']); git(['-c', 'user.name=Local fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-qm', 'Synthetic local fixture']); };
  commit(); return { root, put, commit, head: () => git(['rev-parse', 'HEAD']).trim() };
}
test('actual Git source-only preparation does not build a website and binds its committed source', () => {
  const f = gitFixture(), base = f.head(); f.put('services/graph-mcp/runtime.ts', 'runtime'); f.commit();
  const directory = resolve(temp(), 'pack');
  const release = packageSourceQualification(f.root, { base, directory });
  assert.equal(release.kind, 'source-qualification'); assert.equal(release.inputs.classification.website, false);
  assert.deepEqual(Object.keys(release.files), ['source.json']);
  assert.throws(() => verifyPackage(directory), /cannot be promoted/);
  assert.throws(() => packageSourceQualification(f.root, { base, directory }), /already exists/);
});
test('actual Git readiness rejects wrong checkout, omitted impacts and source movement during freeze', () => {
  const f = gitFixture(), base = f.head(); f.put('services/graph-mcp/runtime.ts', 'runtime'); f.commit();
  assert.throws(() => createReleaseRecord(f.root, { base, purpose: 'test', declaredImpacts: {} }), /omits actual/);
  const r = createReleaseRecord(f.root, { base, purpose: 'test' });
  const frozen = freezeRecord(f.root, r, ['services/graph-mcp/runtime.ts']); assert(frozen.evidenceDigest);
  assert.throws(() => freezeRecord(gitFixture().root, r, ['package-lock.json']), /candidate/);
  let moved = false;
  assert.throws(() => freezeRecord(f.root, r, ['services/graph-mcp/runtime.ts'], { read: path => {
    if (!moved) { moved = true; f.put('services/graph-mcp/runtime.ts', 'concurrent commit'); f.commit(); }
    return readFileSync(path);
  } }), /Candidate moved/);
  assert.throws(() => freezeRecord(f.root, r, ['services/graph-mcp/runtime.ts']), /candidate/);
});
for (const mode of ['service', 'documentation']) test(`actual pipeline prepares ${mode}-only source without a website build or dependencies`, () => {
  const f = gitFixture();
  cpSync(import.meta.dirname, resolve(f.root, 'scripts/cloudflare'), { recursive: true });
  f.put('.gitignore', 'cloudflare-release/\n'); f.commit(); const base = f.head();
  if (mode === 'service') f.put('services/graph-mcp/runtime.ts', 'runtime');
  else f.put('docs/brief.md', 'Documentation without runtime changes.');
  f.commit();
  execFileSync(process.execPath, [resolve(f.root, 'scripts/cloudflare/pipeline.mjs'), 'prepare', `--base=${base}`], { cwd: f.root, encoding: 'utf8', windowsHide: true });
  const directory = resolve(f.root, 'cloudflare-release/package'), r = verifyQualificationPackage(directory);
  assert.equal(r.kind, 'source-qualification'); assert.equal(r.inputs.classification.website, false);
  assert.equal(r.inputs.classification.service, mode === 'service');
  assert.equal(existsSync(resolve(f.root, 'dist-cloudflare')), false);
  assert.equal(existsSync(resolve(f.root, 'node_modules')), false);
  assert.throws(() => verifyPackage(directory), /cannot be promoted/);
});
test('CLI refuses a record bound to a different checkout root', () => {
  const f = gitFixture();
  assert.throws(() => execFileSync(process.execPath, [resolve(import.meta.dirname, 'mcp-release.mjs'), 'plan', `--root=${f.root}`, '--purpose=test', `--output=${resolve(temp(), 'record.json')}`], { encoding: 'utf8', windowsHide: true, stdio: 'pipe' }), /own checkout/);
});
test('failed captured subprocess retains diagnostics without printing stdout in the error', async () => {
  await assert.rejects(run(temp(), process.execPath, ['-e', "process.stdout.write('synthetic failing assertion'); process.stderr.write('synthetic stderr'); process.exit(2)"], { capture: true }), error => {
    assert.equal(error.exitCode, 2); assert.equal(error.stdout, 'synthetic failing assertion'); assert.equal(error.stderr, 'synthetic stderr');
    assert(!error.message.includes('synthetic failing assertion')); return true;
  });
});
