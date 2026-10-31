import { readFileSync, writeFileSync, existsSync, readdirSync, statSync, rmSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync, spawnSync } from "node:child_process";
import { S3Client, HeadObjectCommand, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { assetFile, prepareRelease, digest, sourceFingerprint } from "./release.ts";
import { ensureAsset, concurrent, assertPublicHeaders, sha256, immutableCache, retryVerification } from "./upload-core.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
process.chdir(root);
const [action = "plan", ...options] = process.argv.slice(2);
if (action === 'deploy' && (!options.includes('--emergency-recovery') || !process.env.MATHSDOCK_COORDINATED_RECOVERY)) {
  throw new Error('Legacy deployment is a coordinated emergency route only. Normal publication uses a qualified artifact through the main workflow.');
}
const full = options.includes("--full");
const preview = options.includes("--preview");
const siteOption = options.find(value => value.startsWith("--site="));
const origin = siteOption?.slice(7) || "https://mathsdock.co.uk";
const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
const wrangler = resolve(root, "node_modules/wrangler/bin/wrangler.js");
const run = (file, args) => {
  const child = spawnSync(process.execPath, [file, ...args], {stdio: "inherit", env: process.env});
  if (child.status !== 0) throw new Error("A publishing check failed; deployment stopped");
};
function client() {
  if (!/^[a-f0-9]{32}$/.test(accountId || "") || !process.env.R2_ACCESS_KEY_ID || !process.env.R2_SECRET_ACCESS_KEY) {
    throw new Error("Set CLOUDFLARE_ACCOUNT_ID, R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY securely first");
  }
  return new S3Client({region: "auto", endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {accessKeyId: process.env.R2_ACCESS_KEY_ID, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY},
    requestChecksumCalculation: "WHEN_REQUIRED", responseChecksumValidation: "WHEN_REQUIRED", maxAttempts: 4});
}
function release() {
  const path = "cloudflare-release/manifest.json";
  if (!existsSync(path)) throw new Error("Run npm run build:cloudflare first");
  const manifest = JSON.parse(readFileSync(path, "utf8"));
  const currentCommit = execFileSync("git", ["rev-parse", "HEAD"], {encoding: "utf8"}).trim();
  const expected = prepareRelease("public", currentCommit, sourceFingerprint(root));
  if (JSON.stringify(expected.manifest) !== JSON.stringify(manifest)
      || digest(readFileSync("dist-cloudflare/bank/catalogue.json")) !== manifest.catalogueSha256) {
    throw new Error("Release does not match the current sources; rebuild before publishing");
  }
  if (existsSync("dist-cloudflare/bank/assets")) throw new Error("R2 assets must not be included in the Worker build");
  return manifest;
}
async function upload(manifest) {
  const s3 = client();
  const store = {
    async head(Key) {
      try {
        const value = await s3.send(new HeadObjectCommand({Bucket: manifest.bucket, Key}));
        return {bytes: value.ContentLength, md5: value.ETag?.replaceAll('"', ""), sha256: value.Metadata?.sha256,
          contentType: value.ContentType, cacheControl: value.CacheControl};
      } catch (error) { if (error.$metadata?.httpStatusCode === 404) return null; throw error; }
    },
    async put(asset, Body) {
      await s3.send(new PutObjectCommand({Bucket: manifest.bucket, Key: asset.key, Body,
        ContentType: asset.contentType, CacheControl: immutableCache, Metadata: {sha256: asset.sha256}}));
    },
    async get(Key) {
      const value = await s3.send(new GetObjectCommand({Bucket: manifest.bucket, Key}));
      return Buffer.from(await value.Body.transformToByteArray());
    },
  };
  let uploaded = 0, reused = 0, complete = 0;
  try {
    await concurrent(manifest.assets, async asset => {
      const result = await ensureAsset(store, asset, () => readFileSync(assetFile("public", asset.sources[0])));
      if (result === "uploaded") uploaded++; else reused++;
      if (++complete % 250 === 0) console.log(`R2 ${complete}/${manifest.assets.length}: ${uploaded} uploaded, ${reused} reused`);
    });
  } finally { s3.destroy(); }
  console.log(`R2 complete: ${uploaded} uploaded and byte-verified; ${reused} matched existing objects.`);
}
async function verifyAssets(manifest) {
  // Always send Origin: otherwise R2 intentionally omits the CORS headers.
  let complete = 0;
  await concurrent(manifest.assets, async asset => {
    // Retry isolated connection resets in a large inventory. Header/content
    // mismatches remain outside the retry and still stop publication.
    const response = await retryVerification(remaining => fetch(`${manifest.assetOrigin}/${asset.key}`, {
      method: full ? "GET" : "HEAD", headers: {Origin: origin},
      signal: AbortSignal.timeout(Math.min(full ? 60000 : 15000, remaining())),
    }), {timeoutMs: 60000, intervalMs: 1000,
      onRetry: () => console.log("Retrying an interrupted public asset request...")});
    assertPublicHeaders(response, asset, origin);
    if (full && sha256(Buffer.from(await response.arrayBuffer())) !== asset.sha256) throw new Error(`Public bytes differ: ${asset.key}`);
    if (++complete % 500 === 0) console.log(`Public ${complete}/${manifest.assets.length}`);
  });
  console.log(`All ${complete} public assets verified${full ? " byte-for-byte" : " by size, ETag, MIME type, caching and CORS"}.`);
}
async function verifySite(manifest) {
  const base = new URL(origin);
  if (base.protocol !== "https:" && base.hostname !== "127.0.0.1") throw new Error("Site must use HTTPS");
  await retryVerification(async remaining => {
    for (const path of ["/", "/question-bank?bankView=topics", "/tools/graph", "/tools/ratio-table"]) {
      const response = await fetch(new URL(path, base), {signal: AbortSignal.timeout(Math.min(15000, remaining()))});
      if (!response.ok || !response.headers.get("content-type")?.includes("text/html")) throw new Error(`Site route failed: ${path}`);
    }
    const response = await fetch(new URL("/bank/catalogue.json", base), {cache: "no-cache", signal: AbortSignal.timeout(Math.min(15000, remaining()))});
    if (!response.ok || digest(Buffer.from(await response.arrayBuffer())) !== manifest.catalogueSha256) throw new Error("Live catalogue differs from release");
  }, {onRetry: error => console.log(`Waiting for the deployed site to become available: ${error.message}`)});
  console.log("Live website routes and catalogue verified. Browser export checks are a separate required release check.");
}

try {
  if (!["plan", "deploy", "upload", "verify-assets", "verify-site"].includes(action)) throw new Error("Unknown publishing action");
  rmSync(`cloudflare-release/${action}-receipt.json`, {force: true});
  if (action === "deploy") {
    run("node_modules/typescript/bin/tsc", ["-p", "tsconfig.service.json"]);
    run("services/graph-mcp/build.mjs", []);
    run("node_modules/eslint/bin/eslint.js", ["."]);
    run("scripts/cloudflare/upload-core.test.mjs", []);
    run("node_modules/vitest/vitest.mjs", ["run"]);
    run("node_modules/typescript/bin/tsc", ["-b", "--pretty", "false"]);
    run("node_modules/vite/bin/vite.js", ["build", "--mode", "cloudflare"]);
  }
  const manifest = release();
  if (action === "plan") {
    const files = [];
    const walk = directory => {for (const entry of readdirSync(directory, {withFileTypes: true})) {
      const path = resolve(directory, entry.name); if (entry.isDirectory()) walk(path); else files.push(statSync(path).size);
    }};
    walk("dist-cloudflare");
    console.log(JSON.stringify({commit: manifest.sourceCommit, objects: manifest.assets.length,
      r2Bytes: manifest.assets.reduce((sum, asset) => sum + asset.bytes, 0), workerFiles: files.length,
      workerBytes: files.reduce((sum, size) => sum + size, 0), largestWorkerFile: Math.max(...files)}, null, 2));
  } else if (action === "upload") await upload(manifest);
  else if (action === "verify-assets") await verifyAssets(manifest);
  else if (action === "verify-site") await verifySite(manifest);
  else if (action === "deploy") {
    if (preview && !siteOption) throw new Error("Preview deployment requires --site=https://mathsdock-preview.YOUR-SUBDOMAIN.workers.dev for CORS verification");
    await upload(manifest);
    await verifyAssets(manifest);
    run(wrangler, ["deploy", "--config", preview ? "wrangler.preview.jsonc" : "wrangler.jsonc"]);
    await verifySite(manifest);
    process.env.CLOUDFLARE_SITE_URL = origin;
    run("node_modules/@playwright/test/cli.js", ["test", "--project", "cloudflare"]);
  } else throw new Error("Unknown publishing action");
  writeFileSync(`cloudflare-release/${action}-receipt.json`, JSON.stringify({success: true, action, sourceCommit: manifest.sourceCommit, sourceFingerprint: manifest.sourceFingerprint,
    catalogueSha256: manifest.catalogueSha256, objects: manifest.assets.length, full, preview, site: origin,
    completedAt: new Date().toISOString()}, null, 2));
} catch (error) {
  // SDK diagnostic objects can contain signed requests; never print them.
  console.error(error.$metadata ? `R2 request failed (${error.name}, HTTP ${error.$metadata.httpStatusCode || "unknown"}); check permissions and retry.` : error.message);
  process.exitCode = 1;
}
