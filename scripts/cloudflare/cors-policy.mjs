import { digestObject } from './common.mjs';

// Compare effective CORS semantics independent of API field/rule ordering.
export function corsIdentity(rules) {
  if (!Array.isArray(rules) || !rules.length) throw new Error('No observed live CORS rules');
  const normalized = rules.map(rule => {
    if (Object.keys(rule).some(k => !['ID', 'AllowedOrigins', 'AllowedMethods', 'AllowedHeaders', 'ExposeHeaders', 'MaxAgeSeconds'].includes(k))) throw new Error('Unknown CORS policy fields');
    const result = {};
    for (const name of ['AllowedOrigins', 'AllowedMethods', 'AllowedHeaders', 'ExposeHeaders']) {
      const values = rule[name] || [];
      if (!Array.isArray(values) || values.some(v => typeof v !== 'string')) throw new Error('Malformed CORS array');
      result[name] = [...new Set(values)].sort();
    }
    if (!result.AllowedOrigins.length || !result.AllowedMethods.length) throw new Error('Incomplete CORS rule');
    result.MaxAgeSeconds = rule.MaxAgeSeconds ?? null;
    return result;
  }).sort((a, b) => digestObject(a).localeCompare(digestObject(b)));
  return digestObject(normalized);
}
export function parseWranglerCors(stdout, bucket) {
  const fields = { allowed_origins: 'AllowedOrigins', allowed_methods: 'AllowedMethods', allowed_headers: 'AllowedHeaders', exposed_headers: 'ExposeHeaders', max_age_seconds: 'MaxAgeSeconds' };
  const rules = []; let current, listing = false;
  // Strip terminal SGR formatting only; unexpected policy text still fails closed.
  // eslint-disable-next-line no-control-regex
  const lines = stdout.replace(/\x1b\[[0-9;]*m/g, '').split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || /^[─]+$/.test(line) || /^⛅.*wrangler 4\.149\.0(?: \(update available [0-9.]+\))?$/.test(line)) continue;
    if (line === `Listing CORS rules for bucket '${bucket}'...`) { listing = true; continue; }
    const match = line.match(/^(allowed_origins|allowed_methods|allowed_headers|exposed_headers|max_age_seconds):\s*(.*)$/);
    if (!listing || !match) throw new Error('Wrangler CORS output has an unknown format; use a complete audit');
    if (match[1] === 'allowed_origins') { current = {}; rules.push(current); }
    if (!current || Object.hasOwn(current, fields[match[1]])) throw new Error('Incomplete or duplicate Wrangler CORS fields');
    if (match[1] === 'max_age_seconds') {
      if (!/^\d+$/.test(match[2])) throw new Error('Unknown CORS cache duration');
      current.MaxAgeSeconds = Number(match[2]);
    } else current[fields[match[1]]] = match[2] ? match[2].split(',').map(v => v.trim()) : [];
  }
  if (!listing || rules.some(r => Object.keys(r).length !== 5)) throw new Error('Incomplete Wrangler CORS policy');
  return { verified: true, digest: corsIdentity(rules), reader: 'wrangler-4.149.0' };
}
