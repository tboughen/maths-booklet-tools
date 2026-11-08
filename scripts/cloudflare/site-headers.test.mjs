import { test } from 'node:test';
import assert from 'node:assert/strict';
import { siteHeaders, robotsTxt, parseHeaders, headersFor, contentSecurityPolicy } from './site-headers.mjs';

const rules = parseHeaders(siteHeaders);

test('every page gets the security headers and a noindex tag', () => {
  const page = headersFor(rules, '/tools/venn');
  assert.equal(page['X-Content-Type-Options'], 'nosniff');
  assert.equal(page['X-Frame-Options'], 'SAMEORIGIN');
  assert.equal(page['X-Robots-Tag'], 'noindex, nofollow');
  assert.match(page['Strict-Transport-Security'], /^max-age=\d{8}/);
  assert.equal(page['Content-Security-Policy'], contentSecurityPolicy);
  assert.equal(page['Cache-Control'], undefined);
});

test('cache rules still apply alongside the security headers', () => {
  assert.equal(headersFor(rules, '/bank/catalogue.json')['Cache-Control'], 'no-cache');
  const asset = headersFor(rules, '/assets/index-abc123.js');
  assert.equal(asset['Cache-Control'], 'public, max-age=31536000, immutable');
  assert.equal(asset['X-Content-Type-Options'], 'nosniff');
});

test('the policy keeps pdf.js and exports working without allowing eval or other origins', () => {
  assert.match(contentSecurityPolicy, /script-src 'self' 'wasm-unsafe-eval'(;|$)/);
  assert.match(contentSecurityPolicy, /worker-src 'self' blob:/);
  assert.match(contentSecurityPolicy, /img-src 'self' data: blob:/);
  assert.doesNotMatch(contentSecurityPolicy, /'unsafe-eval'|https?:|\*/);
  assert.match(contentSecurityPolicy, /frame-ancestors 'self'/);
});

test('robots.txt blocks every crawler', () => {
  assert.equal(robotsTxt, 'User-agent: *\nDisallow: /\n');
});
