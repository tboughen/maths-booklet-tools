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

/** packages/<name> directories reached from the service's own (non-test) sources. */
export function servicePackages(root = '.') {
  const start = readdirSync(join(root, 'services/graph-mcp'))
    .filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'))
    .map((f) => `services/graph-mcp/${f}`);
  const seen = new Set(), packages = new Set(), queue = [...start];
  while (queue.length) {
    const file = queue.pop();
    if (seen.has(file)) continue;
    seen.add(file);
    const pkg = /^packages\/([^/]+)\//.exec(file);
    if (pkg) packages.add(`packages/${pkg[1]}`);
    for (const target of relativeImports(file, readFileSync(join(root, file), 'utf8'))) {
      const resolved = resolveSource(root, relative('.', target).replaceAll('\\', '/'));
      if (resolved && !seen.has(resolved)) queue.push(resolved);
    }
  }
  return [...packages].sort();
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
  const gaps = packageGaps();
  for (const gap of gaps) console.error(gap);
  process.exit(gaps.length ? 1 : 0);
}
