import { cpSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { assertEqual, digestObject, fileManifest, json, save, sha256 } from './common.mjs';

// This is the reviewed consumer inventory, independent of collector output.
export const browserFixtureFiles = [
  ...['graph', 'ratio', 'quadratic-combined', 'cuboids-revised', 'number-line-revised',
    'venn-revised', 'algebra-grid', 'algebra-factor', 'algebra-answer', 'bar-model', 'bar-model-revised'].map(n => `${n}.json`),
  ...['ratio', 'cuboids', 'number-line', 'venn', 'algebra-grid', 'bar-model'].map(n => `${n}-bundle.zip`),
  'retrieval.json', 'tool-catalogue.json',
].sort();
const fixtureFiles = directory => {
  const files = fileManifest(directory);
  delete files['fixture-manifest.json'];
  return files;
};
const validateFixtureIdentity = identity => {
  if (!identity || ['sourceTree', 'buildId', 'producer', 'run', 'attempt'].some(k => typeof identity[k] !== 'string' || !identity[k].trim())) throw Error('Incomplete fixture identity');
};
export function sealFixtures(directory, identity, profile) {
  validateFixtureIdentity(identity);
  if (!['browser', 'full'].includes(profile)) throw Error('Wrong fixture profile');
  const files = fixtureFiles(directory);
  for (const name of browserFixtureFiles) if (!files[name]) throw Error(`Missing browser fixture: ${name}`);
  if (profile === 'full') for (const name of ['shading.json', 'svg-delivery-proof.json']) if (!files[name]) throw Error(`Missing full-suite proof: ${name}`);
  const manifest = { schemaVersion: 1, profile, identity, files, filesDigest: digestObject(files) };
  save(resolve(directory, 'fixture-manifest.json'), manifest);
  return verifyFixtures(directory, identity, profile);
}
export function verifyFixtures(directory, identity, profile) {
  validateFixtureIdentity(identity);
  const manifest = json(resolve(directory, 'fixture-manifest.json'));
  if (manifest.schemaVersion !== 1 || manifest.profile !== profile) throw Error('Wrong fixture profile');
  assertEqual(manifest.identity, identity, 'Wrong fixture source, producer, run or attempt');
  assertEqual(fixtureFiles(directory), manifest.files, 'Fixture files missing, extra or corrupt');
  if (digestObject(manifest.files) !== manifest.filesDigest) throw Error('Fixture manifest digest differs');
  for (const name of browserFixtureFiles) if (!manifest.files[name]) throw Error(`Missing browser fixture: ${name}`);
  if (profile === 'full') for (const name of ['shading.json', 'svg-delivery-proof.json']) if (!manifest.files[name]) throw Error(`Missing full-suite proof: ${name}`);
  return manifest;
}
export function compareCatalogues(before, after, expected) {
  const index = catalogue => {
    if (!Array.isArray(catalogue.tools) || !catalogue.tools.length) throw Error('Empty tool catalogue');
    const result = new Map();
    for (const tool of catalogue.tools) {
      if (!tool.name || result.has(tool.name) || !tool.inputSchema) throw Error('Incomplete or duplicate tool definition');
      result.set(tool.name, digestObject(tool));
    }
    return result;
  };
  const old = index(before), current = index(after);
  const actual = {
    added: [...current.keys()].filter(n => !old.has(n)).sort(),
    removed: [...old.keys()].filter(n => !current.has(n)).sort(),
    changed: [...old.keys()].filter(n => current.has(n) && old.get(n) !== current.get(n)).sort(),
  };
  const declared = Object.fromEntries(['added', 'removed', 'changed'].map(k => {
    if (!Array.isArray(expected[k]) || new Set(expected[k]).size !== expected[k].length) throw Error('Expected catalogue delta must be explicit and unique');
    return [k, [...expected[k]].sort()];
  }));
  assertEqual(actual, declared, 'Unexpected named or schema/metadata delta');
  return { ...actual, beforeDigest: digestObject(before.tools.slice().sort((a, b) => a.name.localeCompare(b.name))), afterDigest: digestObject(after.tools.slice().sort((a, b) => a.name.localeCompare(b.name))) };
}
export function writeServiceArtifact(root, release, fixtures, identity, vectorDirectory, collectedManifest) {
  const directory = resolve(root, 'cloudflare-release/service-package');
  if (existsSync(directory)) throw Error('Service artifact already exists; choose a fresh attempt');
  verifyFixtures(fixtures, identity, 'full');
  mkdirSync(directory, { recursive: true });
  for (const [from, to] of [['service-dist', 'service-dist'], ['assets/graph-fonts', 'fonts']]) cpSync(resolve(root, from), resolve(directory, to), { recursive: true });
  cpSync(fixtures, resolve(directory, 'controls'), { recursive: true });
  const derived = fileManifest(vectorDirectory);
  for (const [path, expected] of Object.entries(collectedManifest.files)) assertEqual(derived[path], expected, `Vector consumer changed collected source: ${path}`);
  for (const path of Object.keys(derived)) if (!(path in collectedManifest.files) && path !== 'fixture-manifest.json') {
    const target = resolve(directory, 'vector', path); mkdirSync(resolve(target, '..'), { recursive: true });
    cpSync(resolve(vectorDirectory, path), target);
  }
  const inputPaths = ['package.json', 'package-lock.json', 'services/graph-mcp/package.json', 'services/graph-mcp/package-lock.json', 'tsconfig.service.json', 'Dockerfile.graph-mcp', '.dockerignore'];
  const buildInputs = Object.fromEntries(inputPaths.map(p => [p, sha256(readFileSync(resolve(root, p)))]));
  save(resolve(directory, 'source.json'), { sourceCommit: release.sourceCommit, sourceTree: release.inputs.sourceTree, buildInputs, qualificationInputs: release.inputs });
  const files = fileManifest(directory);
  const record = { schemaVersion: 1, kind: 'checked-service-artifact', releaseId: release.releaseId, sourceTree: release.inputs.sourceTree, buildId: identity.buildId, identity, files, filesDigest: digestObject(files), qualification: 'The matching sealed aggregate is required; this record alone is not qualification or deployment.' };
  save(resolve(directory, 'service-artifact.json'), record);
  verifyServiceArtifact(directory, release);
  return record;
}
export function verifyServiceArtifact(directory, release) {
  const record = json(resolve(directory, 'service-artifact.json'));
  if (record.schemaVersion !== 1 || record.kind !== 'checked-service-artifact' || record.releaseId !== release.releaseId || record.sourceTree !== release.inputs.sourceTree) throw Error('Service artifact belongs to another release');
  const files = fileManifest(directory); delete files['service-artifact.json'];
  assertEqual(files, record.files, 'Service artifact bytes differ');
  if (digestObject(files) !== record.filesDigest) throw Error('Service artifact digest differs');
  for (const path of ['source.json', 'service-dist/cli.js', 'service-dist/raster-worker.js', 'service-dist/healthcheck.js', 'service-dist/manifest.json', 'fonts/STIXTwoText-Regular.otf', 'fonts/STIXTwoText-Italic.otf', 'fonts/STIXTwoMath-Regular.otf']) if (!files[path]) throw Error(`Incomplete service artifact: ${path}`);
  for (const path of ['vector/vector-proof.json', 'vector/direct-svg-vector-proof.json', 'vector/a3-diagram-consumption.pdf', 'vector/direct-svg-vector-proof.pdf']) if (!files[path]) throw Error(`Missing independent vector proof: ${path}`);
  for (const path of ['vector/vector-proof.json', 'vector/direct-svg-vector-proof.json']) if (json(resolve(directory, path)).passed !== true) throw Error('Independent vector proof did not pass');
  const source = json(resolve(directory, 'source.json'));
  assertEqual(source.qualificationInputs, release.inputs, 'Service artifact qualification inputs differ');
  if (source.sourceCommit !== release.sourceCommit || source.sourceTree !== release.inputs.sourceTree || record.buildId !== json(resolve(directory, 'service-dist/manifest.json')).buildId) throw Error('Service build/source identity differs');
  if (record.identity?.sourceTree !== release.inputs.sourceTree || record.identity?.buildId !== record.buildId) throw Error('Service fixture identity differs');
  if (process.env.GITHUB_RUN_ID && (record.identity.run !== process.env.GITHUB_RUN_ID || record.identity.attempt !== process.env.GITHUB_RUN_ATTEMPT)) throw Error('Service artifact run/attempt differs');
  verifyFixtures(resolve(directory, 'controls'), record.identity, 'full');
  return record;
}
