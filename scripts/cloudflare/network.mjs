import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { sha256 } from './common.mjs';
import { concurrent, ensureAsset, assertPublicHeaders, retryVerification, immutableCache } from './upload-core.mjs';
import { inventoryPlan, verificationRecord } from './inventory.mjs';
import { assetFile } from './release.ts';
import { corsIdentity } from './cors-policy.mjs';

export async function storage(manifest, metrics, { readCors } = {}) {
  const sdk = await import('@aws-sdk/client-s3');
  const account = process.env.CLOUDFLARE_ACCOUNT_ID;
  if (!/^[a-f0-9]{32}$/.test(account || '') || !process.env.R2_ACCESS_KEY_ID || !process.env.R2_SECRET_ACCESS_KEY) throw new Error('Configure the existing encrypted R2 credentials before auditing or publishing.');
  const s3 = new sdk.S3Client({ region: 'auto', endpoint: `https://${account}.r2.cloudflarestorage.com`, credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY }, requestChecksumCalculation: 'WHEN_REQUIRED', responseChecksumValidation: 'WHEN_REQUIRED', maxAttempts: 4 });
  return {
    async policy() {
      metrics.count('r2Policy');
      try {
        const result = await s3.send(new sdk.GetBucketCorsCommand({ Bucket: manifest.bucket }));
        return { verified: true, digest: corsIdentity(result.CORSRules || []) };
      } catch (error) {
        if ([401, 403, 501].includes(error.$metadata?.httpStatusCode)) {
          if (readCors) { try { return await readCors(); } catch { /* Fail closed to complete checking. */ } }
          return { verified: false, digest: null };
        }
        throw new Error('Could not establish the live R2 CORS policy; no cached inventory will be trusted.');
      }
    },
    async head(Key) {
      metrics.count('r2Head');
      try {
        const a = await s3.send(new sdk.HeadObjectCommand({ Bucket: manifest.bucket, Key }));
        return { bytes: a.ContentLength, md5: a.ETag?.replaceAll('"', ''), sha256: a.Metadata?.sha256, contentType: a.ContentType, cacheControl: a.CacheControl };
      } catch (error) { if (error.$metadata?.httpStatusCode === 404) return null; throw error; }
    },
    async put(asset, Body) {
      metrics.count('r2Put');
      await s3.send(new sdk.PutObjectCommand({ Bucket: manifest.bucket, Key: asset.key, Body, ContentType: asset.contentType, CacheControl: immutableCache, Metadata: { sha256: asset.sha256 } }));
    },
    async get(Key) {
      metrics.count('r2Get');
      const value = await s3.send(new sdk.GetObjectCommand({ Bucket: manifest.bucket, Key }));
      return Buffer.from(await value.Body.transformToByteArray());
    },
    close() { s3.destroy(); },
  };
}
export async function publicAsset(manifest, asset, origin, { full = false, metrics, fetcher = fetch } = {}) {
  const response = await retryVerification(remaining => {
    metrics?.count(full ? 'publicGet' : 'publicHead');
    return fetcher(`${manifest.assetOrigin}/${asset.key}`, { method: full ? 'GET' : 'HEAD', headers: { Origin: origin }, signal: AbortSignal.timeout(Math.min(full ? 60000 : 15000, remaining())) });
  }, { timeoutMs: 60000, intervalMs: 1000 });
  // A content/header mismatch is deliberately outside transport retries.
  assertPublicHeaders(response, asset, origin);
  if (full && sha256(Buffer.from(await response.arrayBuffer())) !== asset.sha256) throw new Error(`Public bytes differ: ${asset.key}`);
}
export async function verifyInventory({ root, manifest, release, baseline, origin, metrics, full = false, audit = false, readOnly = false, store, fetcher = fetch }) {
  const policy = await store.policy();
  const scope = { bucket: manifest.bucket, assetOrigin: manifest.assetOrigin, origin, policyVerified: policy.verified, corsDigest: policy.digest, cachePolicy: immutableCache, verifier: release.inputs.verifierId };
  const plan = inventoryPlan(manifest, baseline, scope, { full, audit });
  let uploaded = 0, reused = 0;
  await metrics.stage('stored-assets', async () => concurrent(plan.added, async asset => {
    if (readOnly) {
      const head = await store.head(asset.key);
      if (!head || head.sha256 !== asset.sha256 || head.md5 !== asset.md5 || head.bytes !== asset.bytes || head.contentType !== asset.contentType || head.cacheControl !== immutableCache) throw new Error(`Stored immutable object failed: ${asset.key}`);
      reused++;
    } else {
      const result = await ensureAsset(store, asset, () => readFileSync(assetFile(resolve(root, 'public'), asset.sources[0])));
      if (result === 'uploaded') uploaded++; else {
        reused++;
        // Newly referenced existing keys need real bytes, not only metadata.
        if (plan.mode === 'delta' && sha256(await store.get(asset.key)) !== asset.sha256) throw new Error(`Existing immutable bytes failed: ${asset.key}`);
      }
    }
  }));
  const objects = plan.mode === 'complete' ? manifest.assets : [...plan.added, ...plan.sample];
  await metrics.stage('public-assets', () => concurrent(objects, asset => publicAsset(manifest, asset, origin, { full, metrics, fetcher })));
  const record = verificationRecord(manifest, scope, plan, baseline);
  return { record, summary: { mode: plan.mode, reason: plan.reason, objects: manifest.assets.length, storedChecked: plan.added.length, publicChecked: objects.length, uploaded, reused, fullBytes: full, fullAuditAt: record.fullAuditAt } };
}
export async function verifyLiveFiles(directory, release, origin, metrics, fetcher = fetch) {
  await metrics.stage('live-files', () => retryVerification(async remaining => {
    await concurrent(Object.entries(release.files).filter(([path]) => path.startsWith('site/') && !path.endsWith('/_headers')), async ([path, expected]) => {
      metrics.count('liveFileGet');
      const response = await fetcher(new URL(path.slice(5), origin.endsWith('/') ? origin : origin + '/'), { cache: 'no-cache', signal: AbortSignal.timeout(Math.min(15000, remaining())) });
      if (!response.ok) throw new Error(`Live website response unavailable: ${path} (${response.status})`);
      if (sha256(Buffer.from(await response.arrayBuffer())) !== expected.sha256) throw new Error(`Confirmed application failure: live bytes differ for ${path}`);
    });
  }, { timeoutMs: 120000, intervalMs: 5000 }));
}
export async function verifyRange(manifest, origin, metrics, fetcher = fetch) {
  const asset = manifest.assets.find(a => a.contentType === 'application/pdf' && a.bytes > 32);
  if (!asset) throw new Error('No PDF available for range qualification');
  metrics.count('publicRange');
  const response = await fetcher(`${manifest.assetOrigin}/${asset.key}`, { headers: { Origin: origin, Range: 'bytes=0-15' }, signal: AbortSignal.timeout(15000) });
  if (response.status !== 206 || response.headers.get('content-range') !== `bytes 0-15/${asset.bytes}`) throw new Error('Public PDF range response failed');
  const body = Buffer.from(await response.arrayBuffer());
  if (body.length !== 16 || !body.subarray(0, 5).equals(Buffer.from('%PDF-'))) throw new Error('Public PDF range bytes failed');
}
