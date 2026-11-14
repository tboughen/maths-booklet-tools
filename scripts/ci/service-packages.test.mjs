// A core package the MCP service imports must be in its Docker image, build ID and TypeScript
// project (improvement list R11). Fix a failure by adding the named line, not by editing this test.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { bareImports, dependencyGaps, packageGaps, relativeImports, servicePackages } from './service-packages.mjs';

test('the service image, build ID and TypeScript project name every core package it imports', () => {
  assert.deepEqual(packageGaps(), []);
  // The walk follows imports between packages, not only the service's direct imports.
  const reached = servicePackages();
  for (const pkg of ['packages/graph-core', 'packages/probability-tree-core', 'packages/ratio-table-core'])
    assert.ok(reached.includes(pkg), pkg);
});

test('relative imports resolve to repository paths; .js specifiers map to .ts sources', () => {
  assert.deepEqual(
    relativeImports('services/graph-mcp/a.ts', 'import { x } from "../../packages/new-core/src/index";\nexport * from "./b.js";\nconst c = await import("./c");'),
    ['packages/new-core/src/index', 'services/graph-mcp/b.ts', 'services/graph-mcp/c'],
  );
});

test('a new package that is imported but not wired in is reported in all three places', () => {
  const root = mkdtempSync(join(tmpdir(), 'service-packages-'));
  mkdirSync(join(root, 'services/graph-mcp'), { recursive: true });
  mkdirSync(join(root, 'packages/old-core/src'), { recursive: true });
  mkdirSync(join(root, 'packages/new-core/src'), { recursive: true });
  writeFileSync(join(root, 'services/graph-mcp/server.ts'), 'import { a } from "../../packages/old-core/src/index";');
  writeFileSync(join(root, 'services/graph-mcp/server.test.ts'), 'import { t } from "../../packages/test-only-core/src/index";');
  writeFileSync(join(root, 'packages/old-core/src/index.ts'), 'import { b } from "../../new-core/src/index";');
  writeFileSync(join(root, 'packages/new-core/src/index.ts'), 'export const b = 1;');
  writeFileSync(join(root, 'Dockerfile.graph-mcp'), 'COPY packages/old-core packages/old-core\n');
  writeFileSync(join(root, 'services/graph-mcp/build.mjs'), 'for (const d of ["packages/old-core"]) {}');
  writeFileSync(join(root, 'tsconfig.service.json'), JSON.stringify({ include: ['packages/old-core/src/**/*.ts'] }));
  assert.deepEqual(servicePackages(root), ['packages/new-core', 'packages/old-core']);
  const gaps = packageGaps(root);
  assert.equal(gaps.length, 3);
  assert.ok(gaps.every((g) => g.startsWith('packages/new-core ')));
});

test('every npm package the service loads at run time is a dependency of its image', () => {
  assert.deepEqual(dependencyGaps(), []);
  assert.deepEqual(
    bareImports('import { a } from "pdf-lib";\nimport type { B } from "zod";\nimport { c } from "node:fs";\nimport { d } from "./local";\nconst e = await import("@resvg/resvg-js/x");\nimport "fflate";'),
    ['pdf-lib', '@resvg/resvg-js', 'fflate'],
  );
});
