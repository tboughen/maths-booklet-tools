import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tierOf, classifyRisk } from './classify-risk.mjs';

const tier = p => tierOf(p).tier;

test('paths map to the policy tiers', () => {
  const cases = {
    'src/venn/venn.test.ts': 'T0', 'e2e/venn.spec.ts': 'T0', 'packages/venn-core/fixtures/a.json': 'T0',
    'docs/tools/VENN-TOOL.md': 'T1',
    'src/site/Home.tsx': 'T2', 'src/venn/VennPage.css': 'T2',
    'src/venn/VennPage.tsx': 'T3',
    'packages/venn-core/src/index.ts': 'T4', 'src/gates/print-baseline.json': 'T4', 'e2e/a11y-baseline.json': 'T4', 'src/gates/golden/outputs.json': 'T4', 'src/gates/golden/ACCEPTED.md': 'T4', 'src/gates/goldens.test.ts': 'T0',
    'packages/venn-core/src/interchange.ts': 'T5', 'packages/value-graph-core/src/schema.ts': 'T5', 'src/gates/contracts/saved-files.json': 'T5',
    'services/graph-mcp/server.ts': 'T6', 'render.yaml': 'T6', 'src/gates/contracts/mcp-catalogue.json': 'T6',
    'AGENTS.md': 'T7', 'CLAUDE.md': 'T7', 'docs/AUTONOMOUS-LOOP-POLICY.md': 'T7', 'docs/tools/TOOL-CREATION-GUIDE.md': 'T7', 'docs/tools/BAR-MODEL-V3.md': 'T7', 'docs/release/RELEASE-PIPELINE.md': 'T7', 'docs/content/MATHS-RESOURCE-DESIGN-GUIDE.md': 'T7', 'review/rubrics/teacher.md': 'T7', 'review/calibration/cases.json': 'T7', 'scripts/loop/judge.mjs': 'T8', 'scripts/loop/judge.test.mjs': 'T0',
    '.github/workflows/quick-checks.yml': 'T8', 'package.json': 'T8', 'scripts/cloudflare/publish.mjs': 'T8', 'public/bank/catalogue.json': 'T8', 'vite.config.ts': 'T8', 'playwright.config.ts': 'T8', 'wrangler.jsonc': 'T8', 'surprise-file': 'T8',
  };
  for (const [path, expected] of Object.entries(cases)) assert.equal(tier(path), expected, path);
});

test('a PR takes the tier of its riskiest file', () => {
  assert.equal(classifyRisk(['src/venn/venn.test.ts', 'docs/tools/VENN-TOOL.md']).tier, 'T1');
  assert.equal(classifyRisk(['src/venn/VennPage.tsx', 'packages/venn-core/src/interchange.ts']).tier, 'T5');
  assert.equal(classifyRisk(['src/venn/venn.test.ts', 'surprise-file']).tier, 'T8');
  assert.equal(classifyRisk([]).tier, 'T0');
});

test('deleting a test is not a test addition, and large PRs are noted', () => {
  assert.equal(classifyRisk(['src/venn/venn.test.ts'], { deletedTests: true }).tier, 'T3');
  assert.match(classifyRisk(['src/venn/VennPage.tsx'], { changedLines: 450 }).reasons.join(' '), /300-line cap/);
});
