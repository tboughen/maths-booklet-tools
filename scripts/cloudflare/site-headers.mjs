// Response headers and robots.txt for the website (improvement list S50, S85).
//
// `siteHeaders` is written to dist-cloudflare/_headers, which Workers Static Assets applies to every
// static file. The bank Worker (/bank/assets/*) sets its own headers in site-worker.mjs.
// serve-package.mjs applies the same file, so release browser tests run under the real policy.
//
// MathsDock is a staff-only site behind Cloudflare Access, so robots.txt and X-Robots-Tag ask every
// crawler to stay out. Nothing embeds the site in a frame (the MCP service returns links, not
// frames), so framing is limited to the site itself.

export const contentSecurityPolicy = [
  "default-src 'self'",
  // pdf.js decodes some images with WebAssembly; isEvalSupported is false, so no 'unsafe-eval'.
  "script-src 'self' 'wasm-unsafe-eval'",
  "worker-src 'self' blob:",
  // React style props and the editors' measured layouts use inline styles.
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self' data: blob:",
  "frame-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
].join('; ');

export const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Content-Security-Policy': contentSecurityPolicy,
  'X-Frame-Options': 'SAMEORIGIN',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()',
  'Strict-Transport-Security': 'max-age=31536000',
  'X-Robots-Tag': 'noindex, nofollow',
};

export const siteHeaders = [
  '/bank/catalogue.json', '  Cache-Control: no-cache',
  '/bank/catalogue-index.json', '  Cache-Control: no-cache',
  // Paper detail files are named by their content hash (bankCatalogueSplit.ts), so they never change.
  '/bank/catalogue-papers/*', '  Cache-Control: public, max-age=31536000, immutable',
  '/assets/*', '  Cache-Control: public, max-age=31536000, immutable',
  '/*', ...Object.entries(securityHeaders).map(([name, value]) => `  ${name}: ${value}`),
  '',
].join('\n');

export const robotsTxt = 'User-agent: *\nDisallow: /\n';

// The subset of the Cloudflare _headers format that siteHeaders uses: a path pattern on its own line
// (`*` matches anything), then indented `Name: value` lines. Every matching rule applies, in order.
export function parseHeaders(text) {
  const rules = [];
  for (const line of text.split('\n')) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    if (!/^\s/.test(line)) { rules.push({ pattern: line.trim(), headers: {} }); continue; }
    const at = line.indexOf(':');
    if (rules.length && at > 0) rules.at(-1).headers[line.slice(0, at).trim()] = line.slice(at + 1).trim();
  }
  return rules;
}

export function headersFor(rules, pathname) {
  const headers = {};
  for (const { pattern, headers: add } of rules) {
    const re = new RegExp(`^${pattern.split('*').map(part => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*')}$`);
    if (re.test(pathname)) Object.assign(headers, add);
  }
  return headers;
}
