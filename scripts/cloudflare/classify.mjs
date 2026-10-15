import { git, digestObject } from './common.mjs';

export function classifyPaths(paths, conservative = false) {
  const categories = new Set(), reasons = [];
  if (conservative) { categories.add('infrastructure'); reasons.push('Missing or unrelated comparison baseline'); }
  for (const path of paths) {
    let category;
    if (/^(docs\/|\.agents\/|AGENTS\.md$|README\.md$)/.test(path)) category = 'documentation';
    else if (/^(public\/bank\/(assets\/|catalogue\.json))/.test(path)) category = 'bank';
    else if (/^(services\/|Dockerfile|render\.yaml)/.test(path)) category = 'service';
    else if (/^(packages\/|assets\/graph-fonts\/)/.test(path)) category = 'shared';
    else if (/^(src\/|e2e\/|public\/brand\/|public\/favicon\.svg$|index\.html$)/.test(path)) category = 'website';
    else if (/^(scripts\/|\.github\/|package(-lock)?\.json$|.*config\.|wrangler|\.nvmrc$|\.gitignore$|\.gitattributes$|bankAssets\.ts$|public\/bank\/pdfjs\/)/.test(path)) category = 'infrastructure';
    else category = 'unknown';
    categories.add(category); reasons.push(`${category}: ${path}`);
  }
  const broad = categories.has('infrastructure') || categories.has('unknown');
  const service = broad || categories.has('shared') || categories.has('service');
  const website = broad || ['website', 'bank', 'shared'].some(c => categories.has(c));
  const required = website ? ['units', 'catalogue', 'publisher', 'built', 'browser-1', 'browser-2'] : [];
  if (service) required.push('service');
  return { version: 1, categories: [...categories].sort(), reasons, required, website, service, fullInventory: broad, inputDigest: digestObject([...paths].sort()) };
}
export function classify(root, base) {
  let paths = [], conservative = !base;
  if (base) {
    try {
      git(root, ['merge-base', '--is-ancestor', base, 'HEAD']);
      paths = git(root, ['diff', '--no-renames', '--name-only', base, 'HEAD']).split('\n').filter(Boolean);
    } catch { conservative = true; }
  }
  return { base: base || null, ...classifyPaths(paths, conservative) };
}
