import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import worker, { serveBankAsset, verifyAccessToken, accessSettings, gatedCache } from './site-worker.mjs';
import { gatedCache as verifierCache } from './upload-core.mjs';
import { assertGatedWorker } from './gated-config.mjs';

const team = 'https://mathsdock.cloudflareaccess.com';
const aud = 'a'.repeat(64);
const env0 = { ACCESS_TEAM_DOMAIN: team, ACCESS_AUD: aud };
const key = `bank/assets/sha256/${'b'.repeat(64)}.pdf`;
const bytes = new TextEncoder().encode('%PDF-1.7 example question bytes');

const pair = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
const jwk = { ...await crypto.subtle.exportKey('jwk', pair.publicKey), kid: 'k1' };
const certs = async url => { assert.equal(url, `${team}/cdn-cgi/access/certs`); return Response.json({ keys: [jwk] }); };
const b64 = data => Buffer.from(data).toString('base64url');
async function token(claims = {}, header = { alg: 'RS256', kid: 'k1' }) {
  const now = Math.floor(Date.now() / 1000);
  const body = `${b64(JSON.stringify(header))}.${b64(JSON.stringify({ iss: team, aud: [aud], exp: now + 600, iat: now, email: 'teacher@school.example', ...claims }))}`;
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', pair.privateKey, new TextEncoder().encode(body));
  return `${body}.${b64(signature)}`;
}

function bucket() {
  const object = { size: bytes.length, httpEtag: '"md5etag"' };
  return {
    async head(k) { return k === key ? object : null; },
    async get(k, { range } = {}) {
      if (k !== key) return null;
      const header = range?.get?.('range');
      const match = header && /^bytes=(\d+)-(\d+)$/.exec(header);
      if (match) {
        const offset = Number(match[1]), length = Number(match[2]) - offset + 1;
        return { ...object, range: { offset, length }, body: new Blob([bytes.slice(offset, offset + length)]).stream() };
      }
      return { ...object, range: { offset: 0, length: bytes.length }, body: new Blob([bytes]).stream() };
    },
  };
}
const request = (path, headers = {}, method = 'GET') => new Request(`https://mathsdock.co.uk/${path}`, { method, headers });

test('serves a bank file to a signed-in member with private caching', async () => {
  const response = await serveBankAsset(request(key, { 'Cf-Access-Jwt-Assertion': await token() }), { ...env0, BANK: bucket() }, { fetcher: certs });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'application/pdf');
  assert.equal(response.headers.get('cache-control'), gatedCache);
  assert.equal(response.headers.get('etag'), '"md5etag"');
  assert.equal(response.headers.get('content-length'), String(bytes.length));
  assert.deepEqual(new Uint8Array(await response.arrayBuffer()), bytes);
});

test('the release verifier and the Worker agree on the cache policy', () => {
  assert.equal(gatedCache, verifierCache);
});

test('answers PDF.js range requests with 206 and an exact Content-Range', async () => {
  const response = await serveBankAsset(request(key, { 'Cf-Access-Jwt-Assertion': await token(), Range: 'bytes=0-4' }), { ...env0, BANK: bucket() }, { fetcher: certs });
  assert.equal(response.status, 206);
  assert.equal(response.headers.get('content-range'), `bytes 0-4/${bytes.length}`);
  assert.equal(new TextDecoder().decode(await response.arrayBuffer()), '%PDF-');
});

test('HEAD returns metadata only', async () => {
  const response = await serveBankAsset(request(key, { 'Cf-Access-Jwt-Assertion': await token() }, 'HEAD'), { ...env0, BANK: bucket() }, { fetcher: certs });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-length'), String(bytes.length));
  assert.equal(response.body, null);
});

test('refuses requests without a valid Access token for this application', async () => {
  const env = { ...env0, BANK: bucket() };
  const cases = [
    {},
    { 'Cf-Access-Jwt-Assertion': 'not-a-token' },
    { 'Cf-Access-Jwt-Assertion': await token({ aud: ['c'.repeat(64)] }) },
    { 'Cf-Access-Jwt-Assertion': await token({ iss: 'https://other.cloudflareaccess.com' }) },
    { 'Cf-Access-Jwt-Assertion': await token({ exp: Math.floor(Date.now() / 1000) - 10 }) },
    { 'Cf-Access-Jwt-Assertion': await token({}, { alg: 'none', kid: 'k1' }) },
    { 'Cf-Access-Jwt-Assertion': (await token()).slice(0, -4) + 'AAAA' },
  ];
  for (const headers of cases) {
    const response = await serveBankAsset(request(key, headers), env, { fetcher: certs });
    assert.equal(response.status, 403, JSON.stringify(headers).slice(0, 80));
    assert.equal(response.headers.get('cache-control'), 'no-store');
  }
});

test('fails closed when the Access application is not configured', async () => {
  for (const env of [{}, { ACCESS_TEAM_DOMAIN: team }, { ACCESS_TEAM_DOMAIN: 'https://evil.example', ACCESS_AUD: aud }]) {
    const response = await serveBankAsset(request(key, { 'Cf-Access-Jwt-Assertion': await token() }), { ...env, BANK: bucket() }, { fetcher: certs });
    assert.equal(response.status, 503);
  }
  assert.equal(accessSettings({ ACCESS_TEAM_DOMAIN: `${team}/`, ACCESS_AUD: aud }).team, team);
});

test('only immutable bank keys are readable', async () => {
  const jwt = await token();
  for (const path of ['bank/assets/../catalogue.json', 'bank/assets/sha256/short.pdf', `bank/assets/sha256/${'b'.repeat(64)}.svg`, `bank/assets/legacy/${'b'.repeat(64)}.pdf`]) {
    const response = await serveBankAsset(request(path, { 'Cf-Access-Jwt-Assertion': jwt }), { ...env0, BANK: bucket() }, { fetcher: certs });
    assert.equal(response.status, 404, path);
  }
  const missing = await serveBankAsset(request(`bank/assets/sha256/${'c'.repeat(64)}.png`, { 'Cf-Access-Jwt-Assertion': jwt }), { ...env0, BANK: bucket() }, { fetcher: certs });
  assert.equal(missing.status, 404);
  const post = await serveBankAsset(request(key, { 'Cf-Access-Jwt-Assertion': jwt }, 'POST'), { ...env0, BANK: bucket() }, { fetcher: certs });
  assert.equal(post.status, 405);
});

test('non-bank paths fall through to static assets', async () => {
  const response = await worker.fetch(request('index.html'), { ASSETS: { fetch: async () => new Response('static') } });
  assert.equal(await response.text(), 'static');
});

test('verifyAccessToken rejects tokens when settings are absent', async () => {
  assert.equal(await verifyAccessToken(await token(), null, { fetcher: certs }), false);
});

test('deployment refuses a website Worker without the gated bank route or Access settings', () => {
  for (const name of ['wrangler.jsonc', 'wrangler.preview.jsonc']) {
    const config = JSON.parse(readFileSync(new URL(`../../${name}`, import.meta.url), 'utf8'));
    assert.equal(config.workers_dev, false, `${name} must not publish an ungated workers.dev copy`);
    assert.equal(config.preview_urls, false);
    const configured = { ...config, vars: env0 };
    assertGatedWorker(configured);
    assert.throws(() => assertGatedWorker({ ...configured, vars: { ACCESS_TEAM_DOMAIN: '', ACCESS_AUD: '' } }), /ACCESS_TEAM_DOMAIN/);
    assert.throws(() => assertGatedWorker({ ...configured, workers_dev: true }), /gated R2 route/);
    assert.throws(() => assertGatedWorker({ ...configured, r2_buckets: [] }), /gated R2 route/);
    assert.throws(() => assertGatedWorker({ ...configured, assets: { ...configured.assets, run_worker_first: true } }), /gated R2 route/);
  }
});

test('release smoke check fails if the bank answers without sign-in', async () => {
  const { verifyGate } = await import('./network.mjs');
  const manifest = { assets: [{ key }] }, metrics = { count() {} };
  const seen = [];
  await verifyGate(manifest, 'https://mathsdock.co.uk', metrics, async (url, init) => { seen.push([url, init.redirect]); return new Response(null, { status: 302, headers: { location: `${team}/cdn-cgi/access/login` } }); });
  assert.deepEqual(seen, [[`https://mathsdock.co.uk/${key}`, 'manual'], ['https://mathsdock.co.uk/bank/catalogue.json', 'manual']]);
  await assert.rejects(verifyGate(manifest, 'https://mathsdock.co.uk', metrics, async () => new Response('open', { status: 200 })), /not behind staff sign-in/);
});
