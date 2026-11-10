// The draft Claude Code plugin's skill copy must match the canonical skill (improvement list M47, M48).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { unzipSync, strFromU8 } from 'fflate';
import { absoluteLinks, pluginFiles, repositoryBlob, skillZip } from '../plugins/claude-plugin.mjs';

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

test('the repository marketplace lists the plugin at its own version', () => {
  const market = JSON.parse(readFileSync('.claude-plugin/marketplace.json', 'utf8'));
  const plugin = JSON.parse(readFileSync('plugins/mathsdock-claude/.claude-plugin/plugin.json', 'utf8'));
  const entry = market.plugins.find(p => p.name === plugin.name);
  assert.ok(entry, 'marketplace entry for the plugin');
  assert.equal(entry.source, './plugins/mathsdock-claude');
  assert.equal(entry.version, plugin.version, 'bump both versions together');
});

test('the claude.ai skill ZIP holds one folder with the generated SKILL.md, byte for byte', () => {
  const [path, text] = Object.entries(pluginFiles())[0];
  const files = unzipSync(skillZip('mathsdock-diagrams', text));
  assert.deepEqual(Object.keys(files).filter(f => !f.endsWith('/')), ['mathsdock-diagrams/SKILL.md']);
  assert.equal(strFromU8(files['mathsdock-diagrams/SKILL.md']), readFileSync(path, 'utf8'));
  assert.deepEqual(skillZip('mathsdock-diagrams', text), skillZip('mathsdock-diagrams', text));
  // claude.ai limits: name up to 64 characters, description up to 1024.
  const description = text.match(/^description: (.*)$/m)[1];
  assert.ok(description.length <= 1024, `description is ${description.length} characters`);
});
