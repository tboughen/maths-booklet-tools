// The draft Claude Code plugin's skill copy must match the canonical skill (improvement list M47, M48).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { absoluteLinks, pluginFiles, repositoryBlob } from '../plugins/claude-plugin.mjs';

test('relative documentation links point at the public repository', () => {
  assert.equal(absoluteLinks('[V3](../../../docs/tools/BAR-MODEL-V3.md#fractions) [web](https://mathsdock.co.uk/) [top](#top)', '.agents/skills/mathsdock-diagrams'),
    `[V3](${repositoryBlob}docs/tools/BAR-MODEL-V3.md#fractions) [web](https://mathsdock.co.uk/) [top](#top)`);
  assert.throws(() => absoluteLinks('[x](../../../../outside.md)', '.agents/skills/a'), /leaves the repository/);
});

test('the committed plugin skill is current; rerun node scripts/plugins/claude-plugin.mjs if not', () => {
  for (const [path, text] of Object.entries(pluginFiles())) {
    assert.equal(readFileSync(path, 'utf8'), text, path);
    assert.match(text, /^---\nname: [a-z-]+\ndescription: /);
    assert.doesNotMatch(text, /\]\(\.\.?\//, `${path} still has a relative link`);
  }
});

test('the plugin connects to the existing MCP service only', () => {
  const mcp = JSON.parse(readFileSync('plugins/mathsdock-claude/.mcp.json', 'utf8'));
  assert.deepEqual(mcp, { mcpServers: { mathsdock: { type: 'http', url: 'https://maths-booklet-graph-mcp.onrender.com/mcp' } } });
  const plugin = JSON.parse(readFileSync('plugins/mathsdock-claude/.claude-plugin/plugin.json', 'utf8'));
  assert.equal(plugin.name, 'mathsdock');
});
