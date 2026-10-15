import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, readFileSync, copyFileSync, mkdirSync } from 'node:fs';
import { run, json, save, timer, digestObject } from './common.mjs';
import { packageRelease, verifyPackage, validateSource } from './package.mjs';
import { browserCases, browserEvidence, vitestEvidence, sealQualification } from './evidence.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const options = process.argv.slice(3);
const option = name => options.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const directory = resolve(root, option('package') || 'cloudflare-release/package');
const evidence = resolve(root, option('evidence') || 'cloudflare-release/evidence');
const nodeTool = (name, args, extra) => run(root, `node_modules/${name}`, args, extra);
const metrics = timer(resolve(evidence, `${process.argv[2] || 'qualify'}-${process.pid}-timing.json`));
const playwright = 'node_modules/@playwright/test/cli.js';
async function availablePort() {
  const { createServer } = await import('node:net');
  const reservation = createServer();
  await new Promise(r => reservation.listen(0, '127.0.0.1', r));
  const port = reservation.address().port;
  await new Promise(r => reservation.close(r));
  return String(port);
}

async function prepare() {
  const started = performance.now();
  await metrics.stage('typecheck', () => nodeTool('typescript/bin/tsc', ['-b', '--pretty', 'false']));
  await metrics.stage('build-website', () => nodeTool('vite/bin/vite.js', ['build', '--mode', 'cloudflare']));
  const release = packageRelease(root, { base: option('base'), directory });
  const expected = await run(root, playwright, ['test', '--config', 'playwright.release.config.ts', '--list', '--reporter=json'], { capture: true, env: { MATHSDOCK_RELEASE_PACKAGE: directory } });
  const cases = browserCases(JSON.parse(expected.stdout)).map(c => c.id).sort();
  if (!cases.length || new Set(cases).size !== cases.length) throw new Error('Invalid browser test inventory');
  save(resolve(evidence, 'expected-browser.json'), { releaseId: release.releaseId, cases });
  save(resolve(evidence, 'prepare.json'), { releaseId: release.releaseId, elapsedMs: Math.round(performance.now() - started), sourceTree: release.inputs.sourceTree });
  if (process.env.GITHUB_OUTPUT) {
    const { appendFileSync } = await import('node:fs');
    appendFileSync(process.env.GITHUB_OUTPUT, `service=${release.inputs.classification.service}\nwebsite=${release.inputs.classification.website}\nrelease_id=${release.releaseId}\n`);
  }
  console.log(JSON.stringify({ releaseId: release.releaseId, classification: release.inputs.classification, browserCases: cases.length }));
  return release;
}
async function serviceBuild() {
  await nodeTool('typescript/bin/tsc', ['-p', 'tsconfig.service.json']);
  await run(root, 'services/graph-mcp/build.mjs');
}
async function check(name, { preparedService = false } = {}) {
  const release = verifyPackage(directory);
  validateSource(root, release);
  if (!release.inputs.classification.required.includes(name)) throw new Error(`Check is not applicable: ${name}`);
  const resultPath = resolve(evidence, `${name}.json`), startedAt = new Date().toISOString(), start = performance.now();
  save(resultPath, { schemaVersion: 1, name, releaseId: release.releaseId, status: 'running', startedAt });
  const vitest = async args => {
    const output = resolve(evidence, `${name}-vitest.json`);
    await nodeTool('vitest/vitest.mjs', ['run', ...args, '--reporter=json', `--outputFile=${output}`]);
    return vitestEvidence(json(output));
  };
  let result;
  try {
    if (name === 'units') {
      await nodeTool('eslint/bin/eslint.js', ['.']);
      await nodeTool('typescript/bin/tsc', ['-b', '--pretty', 'false']);
      result = await vitest(['--exclude', 'services/**', '--exclude', 'integration/**']);
    } else if (name === 'catalogue') result = await vitest(['integration/catalogue-export.test.ts']);
    else if (name === 'publisher') {
      const { readdirSync } = await import('node:fs');
      const files = readdirSync(resolve(root, 'scripts/cloudflare')).filter(f => f.endsWith('.test.mjs')).map(f => `scripts/cloudflare/${f}`);
      const report = await run(root, process.execPath, ['--test', '--test-reporter=tap', ...files], { capture: true });
      if (!/^# fail 0$/m.test(report.stdout) || !/^# skipped 0$/m.test(report.stdout) || !/^# cancelled 0$/m.test(report.stdout)) throw new Error('Publisher test report is incomplete');
      result = { passed: Number(report.stdout.match(/^# pass (\d+)$/m)?.[1]) };
      if (!result.passed) throw new Error('Publisher tests did not run');
      save(resolve(evidence, 'publisher-tap.json'), { stdout: report.stdout });
    } else if (name.startsWith('browser-')) {
      if (!preparedService) await serviceBuild();
      const fixtures = resolve(root, 'cloudflare-release/fixtures', name);
      await run(root, 'service-dist/verify-consumption.js', [fixtures]);
      const output = resolve(evidence, `${name}-playwright.json`), shard = name.slice(-1), port = await availablePort();
      await run(root, playwright, ['test', '--config', 'playwright.release.config.ts', `--shard=${shard}/2`, '--reporter=json'], { env: {
        MATHSDOCK_RELEASE_PACKAGE: directory, MATHSDOCK_BUILT_PACKAGE: '1', MATHSDOCK_TEST_PORT: port,
        MATHSDOCK_TEST_OUTPUT: resolve(root, 'test-results', name), MCP_CONSUMPTION_DIR: fixtures, PLAYWRIGHT_JSON_OUTPUT_FILE: output,
      } });
      result = { ...browserEvidence(json(output)), transport: 'built package; locally intercepted R2; real MCP fixture round trip' };
    } else if (name === 'built') {
      copyFileSync(resolve(directory, 'inventory.json'), resolve(root, 'cloudflare-release/manifest.json'));
      const output = resolve(evidence, 'built-playwright.json');
      await run(root, playwright, ['test', '--config', 'playwright.cloudflare.config.ts', '--reporter=json'], { env: { MATHSDOCK_RELEASE_PACKAGE: directory, MATHSDOCK_PACKAGE_REHEARSAL: '1', MATHSDOCK_TEST_PORT: await availablePort(), PLAYWRIGHT_JSON_OUTPUT_FILE: output } });
      result = { ...browserEvidence(json(output)), transport: 'built package; locally intercepted R2 rehearsal' };
    } else if (name === 'service') {
      if (!preparedService) await serviceBuild();
      result = await vitest(['services/graph-mcp']);
      const fixtures = resolve(root, 'cloudflare-release/fixtures/service');
      await run(root, 'service-dist/verify-consumption.js', [fixtures]);
      await run(root, process.env.MATHSDOCK_PYTHON || 'python', ['scripts/verify-diagram-consumption.py', fixtures]);
      const container = `mathsdock-qualification-${process.env.GITHUB_RUN_ID || process.pid}`;
      await run(root, 'docker', ['build', '-f', 'Dockerfile.graph-mcp', '-t', container, '.']);
      const { createServer } = await import('node:net');
      const reservation = createServer();
      await new Promise(r => reservation.listen(0, '127.0.0.1', r));
      const reservedPort = reservation.address().port;
      await new Promise(r => reservation.close(r));
      let created = false;
      try {
        await run(root, 'docker', ['run', '-d', '--name', container, '--memory', '512m', '--pids-limit', '64', '-p', `127.0.0.1:${reservedPort}:8787`, '-e', `RENDER_EXTERNAL_URL=http://127.0.0.1:${reservedPort}`, '-e', 'DOWNLOAD_SIGNING_KEY=qualification-synthetic-key-not-for-production', container]);
        created = true;
        const portResult = await run(root, 'docker', ['port', container, '8787/tcp'], { capture: true });
        const port = portResult.stdout.trim().match(/127\.0\.0\.1:(\d+)/)?.[1];
        if (!port) throw new Error('Could not identify the isolated service smoke port');
        await run(root, 'service-dist/smoke.js', [`http://127.0.0.1:${port}`]);
      } finally { if (created) await run(root, 'docker', ['rm', '-f', container]); }
      result = { ...result, vectorConsumer: 'passed', linuxImage: 'passed', memoryMiB: 512, pidLimit: 64 };
    } else throw new Error('Unknown qualification check');
    verifyPackage(directory); validateSource(root, release);
    const record = { schemaVersion: 1, name, releaseId: release.releaseId, status: 'passed', startedAt, completedAt: new Date().toISOString(), elapsedMs: Math.round(performance.now() - start), evidence: result };
    save(resultPath, record); return record;
  } catch (error) {
    save(resultPath, { schemaVersion: 1, name, releaseId: release.releaseId, status: 'failed', startedAt, completedAt: new Date().toISOString(), elapsedMs: Math.round(performance.now() - start), error: error.message });
    throw error;
  }
}
function seal() {
  const release = verifyPackage(directory), expected = json(resolve(evidence, 'expected-browser.json'));
  validateSource(root, release);
  if (expected.releaseId !== release.releaseId) throw new Error('Browser inventory is for another release');
  const receipt = sealQualification(directory, evidence, expected.cases);
  console.log(JSON.stringify({ status: receipt.status, releaseId: receipt.releaseId, checks: receipt.required, checksDigest: digestObject(receipt.checks) }));
  return receipt;
}
async function main() {
  mkdirSync(evidence, { recursive: true });
  const action = process.argv[2] || 'qualify';
  if (action === 'prepare') return prepare();
  if (action === 'check') return check(option('check'));
  if (action === 'seal') return seal();
  if (action === 'qualify') {
    const release = existsSync(resolve(directory, 'release.json')) ? verifyPackage(directory) : await prepare();
    if (release.inputs.classification.website || release.inputs.classification.service) await serviceBuild();
    const results = await Promise.allSettled(release.inputs.classification.required.map(name => metrics.stage(name, () => check(name, { preparedService: true }))));
    const failed = results.filter(r => r.status === 'rejected');
    if (failed.length) throw new AggregateError(failed.map(r => r.reason), failed.map(r => r.reason.message).join('\n'));
    return seal();
  }
  throw new Error('Use prepare, check, seal or qualify');
}
main().then(() => metrics.finish()).catch(error => { metrics.finish(); console.error(error.message); process.exitCode = 1; });
