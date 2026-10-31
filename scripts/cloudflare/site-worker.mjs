// MathsDock website Worker.
//
// Static assets are served directly by Workers Static Assets. Only
// /bank/assets/* reaches this script (see run_worker_first in wrangler.jsonc).
// Question-bank PDFs and PNGs are read from the private R2 bucket through the
// BANK binding, so they sit behind the same Cloudflare Access rule as the rest
// of /bank instead of on a public R2 custom domain.
//
// Cloudflare Access is the gate. This script checks the Access token again so a
// missing or mistyped Access path rule fails closed instead of exposing the bank.

export const bankKey = /^bank\/assets\/sha256\/[a-f0-9]{64}\.(pdf|png)$/;
export const gatedCache = 'private, max-age=31536000, immutable';
const contentTypes = { pdf: 'application/pdf', png: 'image/png' };
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

// Returns true only for a current Access token issued by this team for this application.
export async function verifyAccessToken(token, settings, { fetcher = fetch, now = Date.now() } = {}) {
  if (!token || !settings) return false;
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  try {
    const header = decodeJson(parts[0]), claims = decodeJson(parts[1]);
    if (header.alg !== 'RS256' || !header.kid) return false;
    let key = (await signingKeys(settings.team, fetcher, now)).get(header.kid);
    if (!key) { certCache.expires = 0; key = (await signingKeys(settings.team, fetcher, now)).get(header.kid); }
    if (!key) return false;
    const signed = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
    if (!await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, base64url(parts[2]), signed)) return false;
    const seconds = now / 1000, audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    return claims.iss === settings.team && audiences.includes(settings.aud)
      && typeof claims.exp === 'number' && claims.exp > seconds
      && (claims.nbf === undefined || claims.nbf <= seconds + 60);
  } catch { return false; }
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

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (pathname.startsWith('/bank/assets/')) return serveBankAsset(request, env);
    // run_worker_first limits this script to the bank path; anything else is static.
    return env.ASSETS ? env.ASSETS.fetch(request) : text(404, 'Not found');
  },
};
