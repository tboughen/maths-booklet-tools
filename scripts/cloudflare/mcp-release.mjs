import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { resolve, dirname, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { classify } from './classify.mjs';
import { assertEqual, cleanSource, digestObject, inside, json, sha256 } from './common.mjs';
import { compareCatalogues } from './mcp-evidence.mjs';

const stages = ['qualification', 'website', 'service', 'package', 'client', 'savedOutput'];
export function verifyGuidance(root, classification) {
  const files = classification.reasons.filter(r => r.startsWith('documentation: ')).map(r => r.slice(15)).filter(p => /\.(md|txt)$/.test(p) && existsSync(resolve(root, p)));
  let links = 0;
  for (const path of files) {
    const text = readFileSync(inside(root, path), 'utf8');
    const frontmatter = text.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1];
    if (path.endsWith('SKILL.md') && (!frontmatter || !/^name: .+/m.test(frontmatter) || !/^description: .+/m.test(frontmatter))) throw Error(`Invalid skill frontmatter: ${path}`);
    for (const match of text.matchAll(/\]\(([^\s)]+)(?:\s+"[^"]*")?\)/g)) {
      const link = match[1].replace(/^<|>$/g, '').split('#')[0];
      if (!link || /^(https?:|mailto:|plugin:|app:|codex:)/.test(link)) continue;
      const target = resolve(root, dirname(path), decodeURIComponent(link));
      if (!existsSync(target)) throw Error(`Missing guidance reference: ${path} -> ${link}`);
      links++;
    }
  }
  return { passed: true, files, links, runtimeQualification: false };
}
export function createReleaseRecord(root, { base, purpose, scope = 'implementation', declaredImpacts }) {
  if (!purpose || !['implementation', 'qualification', 'publication'].includes(scope)) throw Error('Explicit purpose and scope required');
  const candidate = cleanSource(root), classification = classify(root, base);
  if (declaredImpacts) for (const [key, needed] of Object.entries(classification.impacts)) if (needed && declaredImpacts[key] !== true) throw Error(`Declared scope omits actual impact: ${key}`);
  const record = { schemaVersion: 1, purpose, scope, candidate, comparison: base || null,
    classification, policy: sha256(readFileSync(resolve(root, 'scripts/cloudflare/mcp-release.mjs'))),
    stages: Object.fromEntries(stages.map(s => [s, { status: 'planned', observations: [] }])),
    evidence: [], createdAt: new Date().toISOString(), nextAction: 'Run applicable readiness and qualification; publication requires its authorised scope.' };
  assertEqual(cleanSource(root), candidate, 'Candidate moved during preflight');
  return record;
}
export function freezeRecord(root, record, paths, { read = readFileSync } = {}) {
  assertEqual(cleanSource(root), record.candidate, 'Stale or different candidate');
  if (sha256(readFileSync(resolve(root, 'scripts/cloudflare/mcp-release.mjs'))) !== record.policy) throw Error('Release checker changed');
  if (!Array.isArray(paths) || !paths.length || new Set(paths).size !== paths.length) throw Error('Evidence paths must be explicit, nonempty and unique');
  const evidence = paths.map(path => {
    const bytes = read(inside(root, path));
    return { path, bytes: bytes.length, sha256: sha256(bytes) };
  });
  assertEqual(cleanSource(root), record.candidate, 'Candidate moved during freeze');
  return { ...record, evidence, evidenceDigest: digestObject(evidence), frozenAt: new Date().toISOString() };
}
export function stageDecision(record, stage, { before, target, observed }) {
  if (!stages.includes(stage) || !before || !target || !observed) throw Error('Explicit stage identities required');
  if (before === target) { if (observed !== target) throw Error('Unexpected or newer live identity; stop'); return 'no-change-observed'; }
  const state = record.stages[stage];
  if (state.status === 'verified') {
    if (state.target !== target || observed !== target) throw Error('Verified receipt is stale or a newer release intervened');
    return 'reuse-verified';
  }
  if (observed === target) return 'verify-existing';
  if (observed !== before) throw Error('Unexpected or newer live identity; stop');
  if (['running', 'unknown'].includes(state.status)) return 'reconcile-before-retry';
  if (['website', 'service', 'package'].includes(stage) && record.scope !== 'publication') throw Error('Publication is outside the recorded authorisation');
  return 'run-authorised-stage';
}
export function recordStage(record, stage, { status, target, observed, evidence, provenance }) {
  if (!stages.includes(stage) || !['running', 'verified', 'failed', 'unknown', 'pending'].includes(status)) throw Error('Invalid stage or state');
  if (['running', 'verified'].includes(status) && ['website', 'service', 'package'].includes(stage) && record.scope !== 'publication') throw Error('Publication is outside the recorded authorisation');
  if (status === 'verified') {
    if (!target || observed !== target || !evidence?.length) throw Error('Verification needs matching observed identity and saved evidence');
    if (stage === 'client' && !['actual-codex', 'actual-chatgpt'].includes(provenance)) throw Error('SDK or simulation cannot establish client acceptance');
    for (const item of evidence) {
      const bytes = readFileSync(item.path);
      if (sha256(bytes) !== item.sha256 || bytes.length !== item.bytes) throw Error('Saved stage evidence differs');
    }
  }
  return { ...record, stages: { ...record.stages, [stage]: { status, target, provenance,
    observations: [...record.stages[stage].observations, { at: new Date().toISOString(), observed, evidence }] } } };
}
const safePackagePath = path => {
  if (!path || isAbsolute(path) || /[:\0]/.test(path) || path.split(/[\\/]/).includes('..') || path.includes('\\')) throw Error('Unsafe package path');
};
export function guardedOverlay(base, current, patch) {
  const merged = { ...current }, changes = [];
  for (const [path, value] of Object.entries(patch)) {
    safePackagePath(path);
    if (typeof value !== 'string') throw Error('Text overlay values must be explicit strings; deletions are not supported');
    if (current[path] !== base[path] && current[path] !== value) throw Error(`Concurrent package edit: ${path}`);
    if (current[path] !== value) { merged[path] = value; changes.push(path); }
  }
  for (const path of ['plugin.json', '.codex-plugin/plugin.json']) {
    if (!current[path] || !merged[path]) throw Error(`Missing package manifest: ${path}`);
    const a = JSON.parse(current[path]), b = JSON.parse(merged[path]); delete a.version; delete b.version;
    assertEqual(a, b, 'App binding, presentation, audience or manifest semantics changed');
  }
  const versions = ['plugin.json', '.codex-plugin/plugin.json'].map(p => JSON.parse(merged[p]).version);
  if (!versions[0] || versions[0] !== versions[1]) throw Error('Package manifest versions disagree');
  for (const [path, content] of Object.entries(merged)) {
    safePackagePath(path);
    if (!path.endsWith('.md') || typeof content !== 'string') continue;
    for (const match of content.matchAll(/\]\(([^\s)#]+)(?:#[^\s)]+)?\)/g)) {
      if (/^[a-z]+:/i.test(match[1])) continue;
      const target = relative('/package', resolve('/package', dirname(path), match[1])).replaceAll('\\', '/');
      if (!(target in merged)) throw Error(`Broken merged package link: ${path} -> ${match[1]}`);
    }
  }
  return { merged, changes: changes.sort(), beforeDigest: digestObject(current), afterDigest: digestObject(merged), appBindingPreserved: true, conditionalWrite: 'Re-read current release immediately before upload; provider CAS is not assumed.' };
}
export function verifyCompatibility(matrix) {
  const required = ['current-current', 'current-new', 'new-current', 'new-new', 'saved-legacy'];
  if (!Array.isArray(matrix) || new Set(matrix.map(r => r.pair)).size !== matrix.length) throw Error('Compatibility pairs must be unique');
  for (const pair of required) {
    const row = matrix.find(r => r.pair === pair);
    if (!row || !['verified', 'pending', 'incompatible'].includes(row.status) || !row.evidence?.length) throw Error(`Missing explicit compatibility evidence: ${pair}`);
    if (!row.websiteIdentity || !row.serviceIdentity) throw Error('Compatibility identities must be explicit');
    if (row.status === 'verified') for (const item of row.evidence) {
      if (typeof item !== 'object' || !item.path || !item.sha256 || !Number.isSafeInteger(item.bytes)) throw Error('Verified compatibility needs actual hashed receipts');
      const bytes = readFileSync(item.path);
      if (bytes.length !== item.bytes || sha256(bytes) !== item.sha256) throw Error('Compatibility evidence bytes differ');
      const proof = JSON.parse(bytes.toString('utf8'));
      if (proof.status !== 'passed' || proof.websiteIdentity !== row.websiteIdentity || proof.serviceIdentity !== row.serviceIdentity || !proof.provenance) throw Error('Compatibility receipt is for another pair');
    }
  }
  const pair = name => matrix.find(r => r.pair === name);
  if (pair('current-new').websiteIdentity !== pair('current-current').websiteIdentity || pair('new-current').serviceIdentity !== pair('current-current').serviceIdentity || pair('current-new').serviceIdentity !== pair('new-new').serviceIdentity || pair('new-current').websiteIdentity !== pair('new-new').websiteIdentity) throw Error('Compatibility pairs have inconsistent identities');
  return { readyForReview: true, compatibleForPublication: required.every(p => matrix.find(r => r.pair === p).status === 'verified') };
}
function writeNew(path, value) { mkdirSync(dirname(resolve(path)), { recursive: true }); writeFileSync(path, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' }); }
async function main() {
  const action = process.argv[2], args = process.argv.slice(3), option = name => args.find(s => s.startsWith(`--${name}=`))?.slice(name.length + 3);
  const root = resolve(option('root') || '.'), output = option('output');
  const moduleRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
  if (realpathSync(root) !== realpathSync(moduleRoot)) throw Error('Run the release helper from its own checkout; root differs');
  if (!output) throw Error('A fresh --output is required');
  if (action === 'plan') return writeNew(output, createReleaseRecord(root, { base: option('base'), purpose: option('purpose'), scope: option('scope') || 'implementation', declaredImpacts: option('declared') ? json(option('declared')) : undefined }));
  if (action === 'freeze') return writeNew(output, freezeRecord(root, json(option('record')), json(option('paths'))));
  if (action === 'overlay') return writeNew(output, guardedOverlay(json(option('base')), json(option('current')), json(option('patch'))));
  if (action === 'compatibility') return writeNew(output, verifyCompatibility(json(option('matrix'))));
  if (action === 'catalogue') return writeNew(output, compareCatalogues(json(option('before')), json(option('after')), json(option('delta'))));
  if (action === 'decision' || action === 'stage') {
    const record = json(option('record')), observation = json(option('observation'));
    assertEqual(cleanSource(root), record.candidate, 'Stale or different candidate');
    if (sha256(readFileSync(resolve(root, 'scripts/cloudflare/mcp-release.mjs'))) !== record.policy) throw Error('Release checker changed');
    if (action === 'decision') return writeNew(output, { candidate: record.candidate, stage: observation.stage, decision: stageDecision(record, observation.stage, observation), observedAt: new Date().toISOString() });
    return writeNew(output, recordStage(record, observation.stage, observation));
  }
  throw Error('Use plan, freeze, overlay, compatibility, catalogue, decision or stage; these commands do not deploy');
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(e => { console.error(e.message); process.exitCode = 1; });
