import { createHash } from "node:crypto";
export const sha256 = data => createHash("sha256").update(data).digest("hex");
export const md5 = data => createHash("md5").update(data).digest("hex");
export const immutableCache = "public, max-age=31536000, immutable";
// Keep in step with gatedCache in site-worker.mjs.
export const gatedCache = "private, max-age=31536000, immutable";

export async function ensureAsset(store, asset, readSource) {
  const data = await readSource();
  if (data.length !== asset.bytes || sha256(data) !== asset.sha256 || md5(data) !== asset.md5) {
    throw new Error(`Source changed after build: ${asset.key}`);
  }
  const existing = await store.head(asset.key);
  if (existing) {
    if (existing.bytes !== asset.bytes || existing.sha256 !== asset.sha256 || existing.md5 !== asset.md5
        || existing.contentType !== asset.contentType || existing.cacheControl !== immutableCache) {
      throw new Error(`Refusing to replace an existing immutable object: ${asset.key}`);
    }
    return "reused";
  }
  await store.put(asset, data);
  const uploaded = await store.get(asset.key);
  if (uploaded.length !== asset.bytes || sha256(uploaded) !== asset.sha256) throw new Error(`Uploaded bytes failed verification: ${asset.key}`);
  return "uploaded";
}

export async function concurrent(items, action, limit = 6) {
  let next = 0, failure;
  const results = new Array(items.length);
  await Promise.all(Array.from({length: Math.min(limit, items.length)}, async () => {
    while (next < items.length && !failure) {
      const index = next++;
      try { results[index] = await action(items[index], index); }
      catch (error) { failure ??= error; }
    }
  }));
  if (failure) throw failure;
  return results;
}

export async function retryVerification(check, {timeoutMs = 120000, intervalMs = 5000,
  now = Date.now, sleep = ms => new Promise(resolve => setTimeout(resolve, ms)), onRetry = () => {}} = {}) {
  const deadline = now() + timeoutMs;
  while (true) {
    try { return await check(() => Math.max(1, deadline - now())); }
    catch (error) {
      if (now() >= deadline) throw error;
      onRetry(error);
      await sleep(Math.min(intervalMs, deadline - now()));
      if (now() >= deadline) throw error;
    }
  }
}

// Served by the site Worker behind Cloudflare Access: same origin, private caching.
export function assertPublicHeaders(response, asset) {
  if (response.status !== 200 || Number(response.headers.get("content-length")) !== asset.bytes
      || response.headers.get("content-type")?.split(";")[0] !== asset.contentType
      || response.headers.get("etag")?.replaceAll('"', "") !== asset.md5
      || response.headers.get("cache-control") !== gatedCache) {
    throw new Error(`Gated asset headers failed: ${asset.key}`);
  }
}
