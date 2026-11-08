// Fails the build check when the website's JavaScript or CSS grows past scripts/ci/bundle-budget.json
// (improvement list S47, L27, A93). Run after a build:
//
//   node scripts/ci/bundle-budget.mjs [--dist=dist]
//
// First load is what index.html loads before any page code: its entry script and stylesheet plus
// every chunk they import statically. Pages, pdf.js, pdf-lib and the export tools are lazy chunks
// and count towards the largest-chunk and total budgets only. Sizes are gzip bytes, which is close
// to what Cloudflare sends. WebAssembly and fonts are not JavaScript and are not counted.
import { appendFileSync, readFileSync, readdirSync } from 'node:fs';
import { join, basename } from 'node:path';
import { gzipSync } from 'node:zlib';
import { pathToFileURL } from 'node:url';

export const gzipSize = bytes => gzipSync(bytes, { level: 9 }).length;

// Entry files named in index.html, then every chunk reachable through static `import ... from "./x.js"`.
export function firstLoad(html, read) {
  const named = [...html.matchAll(/<(?:script[^>]+src|link[^>]+rel="(?:stylesheet|modulepreload)"[^>]+href)="[^"]*\/assets\/([^"/]+)"/g)].map(m => m[1]);
  const seen = new Set(), queue = [...named];
  while (queue.length) {
    const file = queue.shift();
    if (seen.has(file)) continue;
    seen.add(file);
    if (!file.endsWith('.js')) continue;
    const code = read(file);
    for (const m of code.matchAll(/(?:\bfrom\s*|\bimport\s*)["']\.\/([^"']+\.js)["']/g)) queue.push(m[1]);
  }
  return [...seen];
}

export function measure(dist) {
  const assets = join(dist, 'assets');
  const read = file => readFileSync(join(assets, file), 'utf8');
  const sizes = Object.fromEntries(readdirSync(assets).filter(f => /\.(js|css)$/.test(f)).map(f => [f, gzipSize(readFileSync(join(assets, f)))]));
  const initial = firstLoad(readFileSync(join(dist, 'index.html'), 'utf8'), read);
  const sum = files => files.reduce((n, f) => n + (sizes[f] ?? 0), 0);
  const js = Object.keys(sizes).filter(f => f.endsWith('.js'));
  const largest = js.reduce((a, b) => (sizes[b] > (sizes[a] ?? -1) ? b : a), js[0]);
  return {
    firstLoadJs: sum(initial.filter(f => f.endsWith('.js'))),
    firstLoadCss: sum(initial.filter(f => f.endsWith('.css'))),
    largestChunk: sizes[largest] ?? 0,
    totalJs: sum(js),
    largestName: largest,
    initial,
  };
}

export function compare(measured, budget) {
  return ['firstLoadJs', 'firstLoadCss', 'largestChunk', 'totalJs'].map(key => ({ key, bytes: measured[key], budget: budget[key], over: measured[key] > budget[key] }));
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const dist = process.argv.find(a => a.startsWith('--dist='))?.slice(7) || 'dist';
  const budget = JSON.parse(readFileSync(new URL('./bundle-budget.json', import.meta.url), 'utf8'));
  const measured = measure(dist);
  const rows = compare(measured, budget);
  const kb = n => `${(n / 1000).toFixed(1)} kB`;
  const labels = { firstLoadJs: 'First-load JavaScript', firstLoadCss: 'First-load CSS', largestChunk: `Largest chunk (${basename(measured.largestName || '')})`, totalJs: 'All JavaScript' };
  for (const r of rows) console.log(`${r.over ? '::error::' : ''}${labels[r.key]}: ${kb(r.bytes)} gzip of ${kb(r.budget)} budget`);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, ['### Bundle budget', '', '| Measure | Gzip | Budget |', '| --- | --- | --- |', ...rows.map(r => `| ${labels[r.key]} | ${kb(r.bytes)}${r.over ? ' (over)' : ''} | ${kb(r.budget)} |`), ''].join('\n'));
  if (rows.some(r => r.over)) {
    console.log('Over budget. Lazy-load the new code, or raise the budget in scripts/ci/bundle-budget.json in the same pull request with the reason.');
    process.exit(1);
  }
}
