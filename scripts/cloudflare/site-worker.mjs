import { libraryFeedback } from './library-feedback.mjs';
// MathsDock website Worker.
//
// Static assets are served directly by Workers Static Assets. Only
// /bank/assets/*, /library-data/* and /api/report reach this script (see run_worker_first in wrangler.jsonc).
// Question-bank PDFs and PNGs, and schemes of work (JSON), are read from the private R2 bucket through the
// BANK binding, so they sit behind the same Cloudflare Access rule as the rest
// of /bank instead of on a public R2 custom domain.
//
// Cloudflare Access is the gate. This script checks the Access token again so a
// missing or mistyped Access path rule fails closed instead of exposing the bank.

export const bankKey = /^bank\/assets\/sha256\/[a-f0-9]{64}\.(pdf|png|json)$/;
export const gatedCache = 'private, max-age=31536000, immutable';
const contentTypes = { pdf: 'application/pdf', png: 'image/png', json: 'application/json' };
const certCacheMs = 10 * 60 * 1000;
let certCache = { url: '', expires: 0, keys: new Map() };

const text = (status, body, extra = {}) => new Response(body, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...extra } });
const base64url = value => Uint8Array.from(atob(value.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat((4 - value.length % 4) % 4)), c => c.charCodeAt(0));
const decodeJson = value => JSON.parse(new TextDecoder().decode(base64url(value)));

export function accessSettings(env) {
  const team = String(env.ACCESS_TEAM_DOMAIN || '').trim().replace(/\/$/, '');
  const aud = String(env.ACCESS_AUD || '').trim();
  if (!/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(team) || !/^[a-f0-9]{64}$/.test(aud)) return null;
  return { team, aud };
}

async function signingKeys(team, fetcher, now) {
  const url = `${team}/cdn-cgi/access/certs`;
  if (certCache.url === url && certCache.expires > now) return certCache.keys;
  const response = await fetcher(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error('Access signing keys unavailable');
  const { keys = [] } = await response.json();
  const imported = new Map();
  for (const jwk of keys) {
    if (jwk.kty !== 'RSA' || !jwk.kid) continue;
    imported.set(jwk.kid, await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']));
  }
  certCache = { url, expires: now + certCacheMs, keys: imported };
  return imported;
}

// Returns the token's claims only for a current Access token issued by this team for this application, otherwise null.
export async function verifyAccessToken(token, settings, { fetcher = fetch, now = Date.now() } = {}) {
  if (!token || !settings) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const header = decodeJson(parts[0]), claims = decodeJson(parts[1]);
    if (header.alg !== 'RS256' || !header.kid) return null;
    let key = (await signingKeys(settings.team, fetcher, now)).get(header.kid);
    if (!key) { certCache.expires = 0; key = (await signingKeys(settings.team, fetcher, now)).get(header.kid); }
    if (!key) return null;
    const signed = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
    if (!await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, base64url(parts[2]), signed)) return null;
    const seconds = now / 1000, audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    const valid = claims.iss === settings.team && audiences.includes(settings.aud)
      && typeof claims.exp === 'number' && claims.exp > seconds
      && (claims.nbf === undefined || claims.nbf <= seconds + 60);
    return valid ? claims : null;
  } catch { return null; }
}

function objectHeaders(object, extension) {
  const headers = new Headers();
  headers.set('Content-Type', contentTypes[extension]);
  headers.set('Cache-Control', gatedCache);
  headers.set('ETag', object.httpEtag);
  headers.set('Accept-Ranges', 'bytes');
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-Robots-Tag', 'noindex, nofollow');
  return headers;
}

export async function serveBankAsset(request, env, options = {}) {
  if (request.method !== 'GET' && request.method !== 'HEAD') return text(405, 'Method not allowed', { Allow: 'GET, HEAD' });
  const settings = accessSettings(env);
  if (!settings) return text(503, 'Staff sign-in is not configured for the question bank.');
  if (!await verifyAccessToken(request.headers.get('Cf-Access-Jwt-Assertion'), settings, options)) return text(403, 'Staff sign-in is required for the question bank.');
  const key = new URL(request.url).pathname.replace(/^\//, '');
  const match = bankKey.exec(key);
  if (!match || !env.BANK) return text(404, 'Not found');
  const extension = match[1];
  if (request.method === 'HEAD') {
    const object = await env.BANK.head(key);
    if (!object) return text(404, 'Not found');
    const headers = objectHeaders(object, extension);
    headers.set('Content-Length', String(object.size));
    return new Response(null, { status: 200, headers });
  }
  const object = await env.BANK.get(key, { range: request.headers, onlyIf: request.headers });
  if (!object) return text(404, 'Not found');
  const headers = objectHeaders(object, extension);
  // A failed precondition returns metadata without a body.
  if (!('body' in object) || object.body === undefined || object.body === null) return new Response(null, { status: 304, headers });
  const range = object.range;
  if (request.headers.has('range') && range) {
    const offset = range.offset ?? (range.suffix !== undefined ? object.size - range.suffix : 0);
    const length = range.length ?? (range.suffix !== undefined ? range.suffix : object.size - offset);
    headers.set('Content-Range', `bytes ${offset}-${offset + length - 1}/${object.size}`);
    headers.set('Content-Length', String(length));
    return new Response(object.body, { status: 206, headers });
  }
  headers.set('Content-Length', String(object.size));
  return new Response(object.body, { status: 200, headers });
}

// Resource library (docs/content/RESOURCE-LIBRARY.md): the list and its files sit in the same private
// R2 bucket under library/. The list changes with each publish, so it is checked every time; each file
// sits under its own SHA-256, so it never changes.
export const libraryListKey = 'library/library.json';
export const libraryFileKey = /^library\/files\/[a-f0-9]{64}\/([a-z0-9][a-z0-9._-]{0,150}\.(pdf|docx))$/;
const libraryTypes = { pdf: 'application/pdf', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', json: 'application/json; charset=utf-8' };

export async function serveLibrary(request, env, options = {}) {
  if (request.method !== 'GET' && request.method !== 'HEAD') return text(405, 'Method not allowed', { Allow: 'GET, HEAD' });
  const settings = accessSettings(env);
  if (!settings) return text(503, 'Staff sign-in is not configured for the resource library.');
  if (!await verifyAccessToken(request.headers.get('Cf-Access-Jwt-Assertion'), settings, options)) return text(403, 'Staff sign-in is required for the resource library.');
  const key = new URL(request.url).pathname.replace(/^\/library-data\//, 'library/');
  const file = libraryFileKey.exec(key);
  if ((key !== libraryListKey && !file) || !env.BANK) return text(404, 'Not found');
  const object = request.method === 'HEAD' ? await env.BANK.head(key) : await env.BANK.get(key);
  if (!object) return text(404, 'Not found');
  const headers = new Headers({ 'X-Content-Type-Options': 'nosniff', 'X-Robots-Tag': 'noindex, nofollow', ETag: object.httpEtag, 'Content-Length': String(object.size) });
  if (file) {
    headers.set('Content-Type', libraryTypes[file[2]]);
    headers.set('Cache-Control', gatedCache);
    // PDFs open in the browser; Word files download. Either way the file keeps its readable name.
    headers.set('Content-Disposition', `${file[2] === 'pdf' ? 'inline' : 'attachment'}; filename="${file[1]}"`);
  } else {
    headers.set('Content-Type', libraryTypes.json);
    headers.set('Cache-Control', 'private, no-cache');
  }
  return new Response(request.method === 'HEAD' ? null : object.body, { status: 200, headers });
}

// Problem reports from the Question bank become issues in the private bank repository.
export const reportRepo = 'tboughen/mathsdock-bank';
const reportLimits = { message: 2000, field: 200 };
const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
const field = value => typeof value === 'string' ? value.replace(/[\r\n`]+/g, ' ').trim().slice(0, reportLimits.field) : '';

export async function submitReport(request, env, { fetcher = fetch, ...options } = {}) {
  if (request.method !== 'POST') return json(405, { error: 'Method not allowed' });
  const settings = accessSettings(env);
  if (!settings) return json(503, { error: 'Staff sign-in is not configured.' });
  const claims = await verifyAccessToken(request.headers.get('Cf-Access-Jwt-Assertion'), settings, { fetcher, ...options });
  if (!claims) return json(403, { error: 'Sign in again to send a report.' });
  if (!env.REPORT_GITHUB_TOKEN) return json(503, { error: 'Problem reports are not set up yet.' });
  // JSON only, so a cross-site form post cannot send a report without a CORS preflight.
  if (!/^application\/json\b/i.test(request.headers.get('Content-Type') || '')) return json(415, { error: 'The report could not be read.' });
  let body;
  try { body = await request.json(); } catch { return json(400, { error: 'The report could not be read.' }); }
  const message = typeof body?.message === 'string' ? body.message.trim() : '';
  if (!message) return json(400, { error: 'Describe the problem before sending.' });
  if (message.length > reportLimits.message) return json(400, { error: `Keep the description under ${reportLimits.message} characters.` });
  const source = field(body.source), question = field(body.question);
  if (!source || !question) return json(400, { error: 'The report must name a question.' });
  const sender = field(claims.email) || 'unknown sender';
  const details = [['Question', `${source} (${question})`], ['Showing', field(body.showing)], ['Sparx code', field(body.code)], ['Catalogue', field(body.version)], ['Link', field(body.link)], ['From', sender]]
    .filter(([, value]) => value).map(([name, value]) => `- **${name}:** \`${value}\``).join('\n');
  const response = await fetcher(`https://api.github.com/repos/${reportRepo}/issues`, {
    method: 'POST',
    headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${env.REPORT_GITHUB_TOKEN}`, 'Content-Type': 'application/json', 'User-Agent': 'mathsdock-site', 'X-GitHub-Api-Version': '2022-11-28' },
    body: JSON.stringify({ title: `Question bank report: ${source}`, body: `${message}\n\n${details}` }),
  });
  if (!response.ok) return json(502, { error: 'The report could not be sent. Try again later.' });
  return json(201, { ok: true });
}

// Resource library feedback: staff comments and Tim's actions, kept as issues in the bank repository.
export async function serveLibraryFeedback(request, env, { fetcher = fetch, ...options } = {}) {
  const settings = accessSettings(env);
  if (!settings) return json(503, { error: 'Staff sign-in is not configured.' });
  const claims = await verifyAccessToken(request.headers.get('Cf-Access-Jwt-Assertion'), settings, { fetcher, ...options });
  if (!claims) return json(403, { error: 'Sign in again to see feedback.' });
  return libraryFeedback(request, env, claims, fetcher);
}

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (pathname.startsWith('/bank/assets/')) return serveBankAsset(request, env);
    if (pathname.startsWith('/library-data/')) return serveLibrary(request, env);
    if (pathname === '/api/report') return submitReport(request, env);
    if (pathname === '/api/library/feedback') return serveLibraryFeedback(request, env);
    // run_worker_first limits this script to these paths; anything else is static.
    return env.ASSETS ? env.ASSETS.fetch(request) : text(404, 'Not found');
  },
};
