import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdtempSync, mkdirSync, cpSync, existsSync, openSync, closeSync, unlinkSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { json, save, run, repository, timer } from './common.mjs';
import { verifyPackage, validateSource } from './package.mjs';
import { validateQualification } from './evidence.mjs';
import { storage, verifyInventory, verifyLiveFiles, verifyRange } from './network.mjs';
import { promoteRelease } from './deployment.mjs';
import { downloadTrustedArtifact, verifyWorkflowRun } from './github-trust.mjs';
import { parseWranglerCors } from './cors-policy.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const options = process.argv.slice(3), action = process.argv[2];
const option = name => options.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const preview = options.includes('--preview');
const origin = option('site') || 'https://mathsdock.co.uk';
const output = resolve(root, option('output') || 'cloudflare-release/publication');
mkdirSync(output, { recursive: true });
const metrics = timer(resolve(output, `timing-${randomUUID()}.json`));
const wrangler = 'node_modules/wrangler/bin/wrangler.js';
function target(directory) {
  const name = preview ? 'mathsdock-preview' : 'mathsdock';
  const config = resolve(directory, 'config', preview ? 'wrangler.preview.jsonc' : 'wrangler.jsonc');
  const value = json(config), site = new URL(origin);
  if (value.name !== name || site.protocol !== 'https:' || site.pathname !== '/' || site.search || site.hash || site.username || site.password) throw new Error('Invalid deployment target');
  if (!preview && (site.origin !== 'https://mathsdock.co.uk' || value.workers_dev !== false || value.routes?.length !== 1 || value.routes[0].pattern !== 'mathsdock.co.uk' || !value.routes[0].custom_domain)) throw new Error('Production route configuration differs from MathsDock');
  if (preview && (!/^mathsdock-preview\.[a-z0-9-]+\.workers\.dev$/.test(site.hostname) || !value.workers_dev || value.routes?.length)) throw new Error('Preview may only use the existing MathsDock preview Worker');
  return { name, config };
}
async function current(configuration) {
  const result = await run(root, wrangler, ['deployments', 'list', '--config', configuration.config, '--json'], { capture: true });
  const list = JSON.parse(result.stdout).sort((a, b) => a.created_on.localeCompare(b.created_on));
  const latest = list.at(-1);
  if (!latest || latest.versions?.length !== 1 || latest.versions[0].percentage !== 100) throw new Error('Expected a single current Worker version at 100%');
  return latest.versions[0].version_id;
}
async function incoming(runId, name, expectation) {
  const directory = mkdtempSync(resolve(root, 'cloudflare-release/incoming-'));
  const artifact = await downloadTrustedArtifact(root, runId, name, directory, expectation);
  return { directory, artifact };
}
async function main() {
  if (existsSync(resolve(output, 'deployment-attempt.json')) || existsSync(resolve(output, 'audit-receipt.json'))) throw new Error('This attempt output already contains evidence; choose a fresh --output directory instead of overwriting it');
  let directory = resolve(root, option('package') || 'cloudflare-release/package');
  let qualification, producer;
  if (action === 'promote' && !preview) {
    // Production is a manually dispatched job from the reviewed main workflow.
    // Normal local entry points dispatch that same workflow instead of racing it.
    if (process.env.GITHUB_ACTIONS !== 'true' || process.env.GITHUB_REPOSITORY !== repository || process.env.GITHUB_WORKFLOW_REF !== `${repository}/.github/workflows/cloudflare.yml@refs/heads/main`) throw new Error('Production promotion must run through the reviewed main Cloudflare workflow; use the credentials helper with the exact run/release/version.');
  }
  if (option('run')) {
    producer = await incoming(option('run'), 'qualified-release', { path: '.github/workflows/graph-checks.yml', requiredJob: 'release-qualification' });
    directory = resolve(producer.directory, 'package');
    qualification = json(resolve(producer.directory, 'evidence/qualification.json'));
  }
  const release = verifyPackage(directory);
  if (action === 'promote' && !release.inputs.classification.website) throw new Error('This qualification does not authorise a website promotion');
  validateSource(root, release);
  const configuration = target(directory);
  if (action === 'inspect') { console.log(JSON.stringify({ releaseId: release.releaseId, currentVersion: await current(configuration), origin })); return; }
  if (!['audit', 'promote'].includes(action)) throw new Error('Use inspect, audit or promote');
  let baseline, previousDirectory;
  if (option('baseline-run')) {
    const prior = await incoming(option('baseline-run'), 'published-release', { path: '.github/workflows/cloudflare.yml' });
    baseline = json(resolve(prior.directory, 'inventory-record.json'));
    if (existsSync(resolve(prior.directory, 'package/release.json'))) previousDirectory = resolve(prior.directory, 'package');
  } else if (option('baseline')) {
    if (action === 'promote' && !preview) throw new Error('Production requires a trusted baseline workflow run, not an arbitrary baseline file');
    baseline = json(resolve(root, option('baseline')));
  }
  if (option('previous-package')) {
    if (!preview) throw new Error('Production recovery package must come from the trusted previous publication artifact');
    previousDirectory = resolve(root, option('previous-package'));
  }
  const manifest = json(resolve(directory, 'inventory.json'));
  const store = await storage(manifest, metrics, { readCors: async () => {
    metrics.count('wranglerPolicy');
    const response = await run(root, wrangler, ['r2', 'bucket', 'cors', 'list', manifest.bucket], { capture: true, env: { CI: 'true' } });
    return parseWranglerCors(response.stdout, manifest.bucket);
  } });
  const inventory = async readOnly => {
    const result = await verifyInventory({ root, manifest, release, baseline, origin, metrics, full: options.includes('--full'), audit: options.includes('--audit-inventory'), readOnly, store,
      onPlan: plan => {
        save(resolve(output, 'inventory-preflight.json'), plan);
        console.log(JSON.stringify({ stage: 'inventory-preflight', ...plan }));
      },
    });
    save(resolve(output, 'inventory-record.json'), result.record);
    return result.summary;
  };
  try {
    if (action === 'audit') {
      const result = await inventory(true);
      save(resolve(output, 'audit-receipt.json'), { schemaVersion: 1, releaseId: release.releaseId, origin, status: 'audited', summary: result, completedAt: new Date().toISOString() });
      console.log(JSON.stringify(result)); return;
    }
    qualification ||= json(resolve(root, option('qualification') || 'cloudflare-release/evidence/qualification.json'));
    validateQualification(release, qualification);
    if (option('release-id') !== release.releaseId) throw new Error('Explicit requested release ID does not match the package');
    if (producer) {
      const run = await verifyWorkflowRun(root, producer.artifact.runId, { path: '.github/workflows/graph-checks.yml', commit: qualification.sourceCommit, requiredJob: 'release-qualification' });
      if (String(qualification.workflow.runId) !== String(run.id)) throw new Error('Qualification producer identity differs');
    }
    const rollback = options.includes('--rollback-on-failure');
    const previous = previousDirectory ? verifyPackage(previousDirectory, { allowExpiredForRecovery: true }) : null;
    if (rollback && !previous) throw new Error('Recovery needs a retained, verified previous release package');
    if (previous) await verifyLiveFiles(previousDirectory, previous, origin, metrics);
    // CI concurrency protects all normal production invocations. This local lock
    // additionally prevents two preview/recovery processes sharing a checkout.
    const lockPath = resolve(root, 'cloudflare-release/publication.lock');
    let lock;
    try { lock = openSync(lockPath, 'wx'); } catch { throw new Error('A publisher already owns this checkout; inspect its attempt before clearing a stale lock'); }
    try {
      const adapter = {
        current: () => current(configuration),
        ownsVersion: async (version, releaseId) => {
          const result = await run(root, wrangler, ['versions', 'view', version, '--config', configuration.config, '--json'], { capture: true });
          return JSON.parse(result.stdout).annotations?.['workers/message'] === `MathsDock ${releaseId}`;
        },
        validate: async () => { verifyPackage(directory); validateSource(root, release); },
        inventory: () => inventory(false),
        deploy: async () => {
          verifyPackage(directory); validateSource(root, release);
          await metrics.stage('worker-deployment', () => run(root, wrangler, ['deploy', '--config', configuration.config, '--assets', resolve(directory, 'site'), '--message', `MathsDock ${release.releaseId}`]));
          return current(configuration);
        },
        verifyBytes: () => verifyLiveFiles(directory, release, origin, metrics),
        smoke: async () => {
          await verifyRange(manifest, origin, metrics);
          cpSync(resolve(directory, 'inventory.json'), resolve(root, 'cloudflare-release/manifest.json'));
          await metrics.stage('live-browser', () => run(root, 'node_modules/@playwright/test/cli.js', ['test', '--config', 'playwright.cloudflare.config.ts'], { env: { CLOUDFLARE_SITE_URL: origin, MATHSDOCK_TEST_OUTPUT: resolve(output, 'browser') } }));
        },
        // Transport outages do not justify speculative rollback. Known-byte
        // mismatches must be diagnosed explicitly by the operator first.
        confirmedApplicationFailure: error => error.message.startsWith('Confirmed application failure:'),
        rollback: version => run(root, wrangler, ['rollback', version, '--config', configuration.config, '--message', `Restore ${version} after failed ${release.releaseId}`, '--yes']),
        verifyPrevious: () => verifyLiveFiles(previousDirectory, previous, origin, metrics),
      };
      const record = await promoteRelease({ release, qualification, adapter, expectedVersion: option('expected-version'), journalPath: resolve(output, 'deployment-attempt.json'), rollbackOnFailure: rollback });
      cpSync(directory, resolve(output, 'package'), { recursive: true, errorOnExist: true, force: false });
      save(resolve(output, 'deploy-receipt.json'), { ...record, repository, sourceCommit: release.sourceCommit, sourceTree: release.inputs.sourceTree, origin, producer: producer?.artifact || null });
      console.log(JSON.stringify({ status: record.status, releaseId: record.releaseId, deployedVersion: record.deployedVersion }));
    } finally { closeSync(lock); unlinkSync(lockPath); }
  } finally { store.close(); }
}
main().then(() => metrics.finish()).catch(error => {
  metrics.finish();
  // Avoid SDK objects and their potentially signed requests in output.
  console.error(error.$metadata ? `R2 request failed (${error.name}, HTTP ${error.$metadata.httpStatusCode || 'unknown'}).` : error.message);
  process.exitCode = 1;
});
