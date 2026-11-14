// Every core package the MCP service imports must be copied into its Docker image, hashed into
// its build ID and compiled by its TypeScript project (improvement list R11). Charts and
// probability trees each needed a release fix for a missed line; this check finds it in the PR.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, normalize, relative } from 'node:path';

const importPattern = /\b(?:from|import)\s*\(?\s*["'](\.{1,2}\/[^"']+)["']/g;

/** Relative imports of one source file, resolved to repository paths. */
export function relativeImports(file, text) {
  const out = [];
  for (const m of text.matchAll(importPattern)) {
    let target = normalize(join(dirname(file), m[1])).replaceAll('\\', '/');
    if (target.endsWith('.js')) target = target.slice(0, -3) + '.ts';
    out.push(target);
  }
  return out;
}

function resolveSource(root, path) {
  for (const candidate of [path, `${path}.ts`, `${path}.tsx`, `${path}/index.ts`])
    if (existsSync(join(root, candidate)) && candidate.match(/\.tsx?$/)) return candidate;
  return null;
}

/** Every source file the service's own (non-test) sources reach. */
export function serviceFiles(root = '.') {
  const start = readdirSync(join(root, 'services/graph-mcp'))
    .filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'))
    .map((f) => `services/graph-mcp/${f}`);
  const seen = new Set(), queue = [...start];
  while (queue.length) {
    const file = queue.pop();
    if (seen.has(file)) continue;
    seen.add(file);
    for (const target of relativeImports(file, readFileSync(join(root, file), 'utf8'))) {
      const resolved = resolveSource(root, relative('.', target).replaceAll('\\', '/'));
      if (resolved && !seen.has(resolved)) queue.push(resolved);
    }
  }
  return [...seen].sort();
}

/** packages/<name> directories reached from the service's own (non-test) sources. */
export function servicePackages(root = '.') {
  const packages = new Set();
  for (const file of serviceFiles(root)) {
    const pkg = /^packages\/([^/]+)\//.exec(file);
    if (pkg) packages.add(`packages/${pkg[1]}`);
  }
  return [...packages].sort();
}

const barePattern = /^\s*(?:import|export)(?!\s+type\b)[^"'\n;]*?from\s*["']([^"'./][^"']*)["']|\bimport\s*\(\s*["']([^"'./][^"']*)["']\s*\)|^\s*import\s+["']([^"'./][^"']*)["']/gm;
/** npm packages one source file loads at run time (type-only imports are erased). */
export function bareImports(text) {
  const out = new Set();
  for (const m of text.matchAll(barePattern)) {
    const spec = m[1] ?? m[2] ?? m[3];
    if (spec.startsWith('node:')) continue;
    out.add(spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0]);
  }
  return [...out];
}

/**
 * The service bundle keeps npm packages external, and its image installs only
 * services/graph-mcp/package.json. A package the service reaches but does not list fails only
 * inside the container (pdf-lib, 14 Nov 2026), so it is reported here.
 */
export function dependencyGaps(root = '.') {
  const deps = JSON.parse(readFileSync(join(root, 'services/graph-mcp/package.json'), 'utf8')).dependencies ?? {};
  const gaps = new Set();
  for (const file of serviceFiles(root))
    for (const pkg of bareImports(readFileSync(join(root, file), 'utf8')))
      if (!(pkg in deps)) gaps.add(`${pkg} (imported by ${file}) is missing from services/graph-mcp/package.json dependencies`);
  return [...gaps];
}

/** Where each package must be named, and what is missing. */
export function packageGaps(root = '.') {
  const docker = readFileSync(join(root, 'Dockerfile.graph-mcp'), 'utf8');
  const build = readFileSync(join(root, 'services/graph-mcp/build.mjs'), 'utf8');
  const tsconfig = JSON.parse(readFileSync(join(root, 'tsconfig.service.json'), 'utf8'));
  const include = tsconfig.include ?? [];
  const gaps = [];
  for (const pkg of servicePackages(root)) {
    if (!docker.split('\n').some((line) => new RegExp(`^COPY ${pkg} ${pkg}\\s*$`).test(line.trim())))
      gaps.push(`${pkg} is not copied in Dockerfile.graph-mcp (add "COPY ${pkg} ${pkg}")`);
    if (!build.includes(`"${pkg}"`))
      gaps.push(`${pkg} is missing from the build ID directories in services/graph-mcp/build.mjs`);
    if (!include.some((p) => p.startsWith(`${pkg}/src/`)))
      gaps.push(`${pkg} is not compiled by tsconfig.service.json (add "${pkg}/src/**/*.ts" to include)`);
  }
  return gaps;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const gaps = [...packageGaps(), ...dependencyGaps()];
  for (const gap of gaps) console.error(gap);
  process.exit(gaps.length ? 1 : 0);
}
