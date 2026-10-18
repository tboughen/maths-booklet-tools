import { mkdtempSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { git, json, repository, assertEqual } from './common.mjs';
import { githubJson, verifyWorkflowRun, downloadTrustedArtifact } from './github-trust.mjs';
import { verifyReusableCatalogue } from './package.mjs';

export const publicationOrigin = { path: '.github/workflows/cloudflare.yml', branch: 'main', event: 'workflow_dispatch' };

export function validateCatalogueReceipt(receipt, release, sourceTree) {
  if (receipt.repository !== repository || receipt.status !== 'live-verified') throw new Error('Prior package has no verified publication receipt');
  assertEqual(receipt.releaseId, release.releaseId, 'Publication receipt names another package');
  assertEqual(receipt.sourceTree, release.inputs.sourceTree, 'Publication receipt names another source tree');
  assertEqual(sourceTree, release.inputs.sourceTree, 'Publication workflow used another source tree');
  assertEqual(receipt.sourceCommit, release.sourceCommit, 'Publication receipt names another source commit');
}

// This is a read-only build optimisation, never a cached qualification result.
// A cold build remains available if GitHub, provenance or identities cannot match.
export async function prepareCatalogueCache(root, {
  output, runId, api = githubJson, verifyRun = verifyWorkflowRun,
  download = downloadTrustedArtifact, verify = verifyReusableCatalogue,
  tree = commit => git(root, ['rev-parse', `${commit}^{tree}`]),
} = {}) {
  const attempts = [];
  let ids;
  try {
    if (runId) {
      if (!/^\d+$/.test(String(runId))) throw new Error('Invalid prior publication run ID');
      ids = [String(runId)];
    } else {
      const result = await api(root, 'actions/workflows/cloudflare.yml/runs?branch=main&event=workflow_dispatch&status=success&per_page=3');
      ids = result.workflow_runs.map(r => String(r.id)).filter(id => /^\d+$/.test(id)).slice(0, 3);
    }
  } catch {
    return { status: 'cold', reason: 'Could not discover a trusted prior publication', attempts };
  }
  for (const id of ids) {
    let phase = 'workflow provenance';
    try {
      const producer = await verifyRun(root, id, publicationOrigin);
      // Never interpolate unvalidated API data as a Git revision.
      if (!/^[a-f0-9]{40}$/.test(producer.head_sha)) throw new Error('Invalid producer commit');
      mkdirSync(output, { recursive: true });
      const directory = mkdtempSync(resolve(output, 'catalogue-cache-'));
      phase = 'artifact retrieval';
      const artifact = await download(root, id, 'published-release', directory, publicationOrigin, { timeoutMs: 30000 });
      const packagePath = resolve(directory, 'package');
      phase = 'publication receipt';
      validateCatalogueReceipt(json(resolve(directory, 'deploy-receipt.json')), json(resolve(packagePath, 'release.json')), tree(producer.head_sha));
      phase = 'package, bank tree and transformation identity';
      verify(root, packagePath);
      return { status: 'reused', reason: 'Trusted publication with matching bank and transformation identities', runId: id, artifact, packagePath, attempts };
    } catch {
      // Avoid emitting signed SDK/CLI errors or large repeated diagnostics.
      attempts.push({ runId: id, reason: `Unavailable or inapplicable ${phase}` });
    }
  }
  return { status: 'cold', reason: ids.length ? 'No compatible verified prior package' : 'No prior successful publication', attempts };
}
