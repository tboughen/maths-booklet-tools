import { git, digestObject } from './common.mjs';

export function classifyPaths(paths, conservative = false) {
  const categories = new Set(), reasons = [], inventoryReasons = [];
  if (conservative) {
    categories.add('infrastructure');
    reasons.push('Missing or unrelated comparison baseline');
    inventoryReasons.push('Missing or unrelated comparison baseline');
  }
  for (const path of paths) {
    let category;
    if (/^(docs\/|\.agents\/|AGENTS\.md$|README\.md$)/.test(path)) category = 'documentation';
    else if (/^(public\/bank\/(assets\/|catalogue\.json))/.test(path)) category = 'bank';
    else if (/^services\/graph-mcp\/(verify-consumption\.ts|consumption-pacing(?:\.test)?\.ts|smoke\.ts)$/.test(path)) category = 'qualification';
    else if (/^(services\/|Dockerfile|render\.yaml$|\.dockerignore$|tsconfig\.service\.json$)/.test(path)) category = 'service';
    else if (/^(packages\/|assets\/graph-fonts\/)/.test(path)) category = 'shared';
    else if (/^(src\/|e2e\/|public\/brand\/|public\/favicon\.svg$|index\.html$)/.test(path)) category = 'website';
    // These known qualification inputs still expand code checks, but do not
    // change the bank transform, transport, dependencies or deployment policy.
    else if (/^playwright(?:\.[a-z0-9-]+)*\.config\.[cm]?[jt]s$/.test(path) || [
      'scripts/algebra-grid-examples.mjs',
      'scripts/verify-diagram-consumption.py',
      'scripts/verify-direct-svg-consumption.py',
      'scripts/verify-example-controls.mjs',
    ].includes(path)) category = 'qualification';
    else if (/^(scripts\/|\.github\/|package(-lock)?\.json$|.*config\.|wrangler|\.nvmrc$|\.gitignore$|\.gitattributes$|bankAssets\.ts$|public\/bank\/pdfjs\/)/.test(path)) category = 'infrastructure';
    else category = 'unknown';
    categories.add(category); reasons.push(`${category}: ${path}`);
    if (category === 'infrastructure' || category === 'unknown') inventoryReasons.push(`${category}: ${path}`);
  }
  const broad = categories.has('infrastructure') || categories.has('unknown') || categories.has('qualification');
  const service = broad || categories.has('shared') || categories.has('service');
  const website = broad || ['website', 'bank', 'shared'].some(c => categories.has(c));
  const required = website ? ['units', 'catalogue', 'publisher', 'built', 'browser-1', 'browser-2'] : [];
  if (service) required.push('service');
  const impacts = {
    guidance: categories.has('documentation'), website,
    serviceRuntime: broad || categories.has('shared') || categories.has('service'),
    advertisedMetadata: broad || categories.has('shared') || categories.has('service'),
    sharedInterchange: categories.has('shared'), qualification: broad,
    infrastructure: categories.has('infrastructure') || categories.has('unknown'),
  };
  return { version: 4, categories: [...categories].sort(), reasons, required, website, service, impacts, fullInventory: inventoryReasons.length > 0, inventoryReasons, inputDigest: digestObject([...paths].sort()) };
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
