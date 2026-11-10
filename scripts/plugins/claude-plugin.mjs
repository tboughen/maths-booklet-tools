// Builds the draft Claude Code plugin in plugins/mathsdock-claude/ (improvement list M47, M48).
// The plugin connects Claude Code to the existing MathsDock MCP service and carries a copy of the
// canonical `.agents/skills/mathsdock-diagrams` skill. Installed plugins are copied away from this
// repository, so the copy's relative documentation links point at the public repository instead.
//
//   node scripts/plugins/claude-plugin.mjs              writes the copy
//   node scripts/plugins/claude-plugin.mjs --check      fails when the committed copy is out of date
//   node scripts/plugins/claude-plugin.mjs --zip=DIR    also writes DIR/<skill>.zip for upload in
//                                                       claude.ai (Settings > Capabilities > Skills)
//
// The repository's .claude-plugin/marketplace.json lists the plugin, so Claude Code can install it
// from GitHub (docs/release/CLAUDE-CONNECTION.md). Listing it anywhere else needs Tim's go-ahead.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { zipSync, strToU8 } from 'fflate';
import { dirname, join, posix } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const repositoryBlob = 'https://github.com/tboughen/maths-booklet-tools/blob/main/';
export const skills = ['mathsdock-diagrams'];

// Rewrites Markdown links relative to `fromDir` (a repository path) as links to the public repository.
export function absoluteLinks(markdown, fromDir) {
  return markdown.replace(/\]\((?!https?:|#|mailto:)([^)\s]+)\)/g, (_, target) => {
    const [path, hash = ''] = target.split(/(?=#)/);
    const resolved = posix.normalize(posix.join(fromDir, path));
    if (resolved.startsWith('..')) throw Error(`Link ${target} leaves the repository.`);
    return `](${repositoryBlob}${resolved}${hash})`;
  });
}

export function pluginFiles(read = path => readFileSync(join(root, path), 'utf8')) {
  const files = {};
  for (const name of skills) {
    const source = `.agents/skills/${name}/SKILL.md`;
    const text = absoluteLinks(read(source), posix.dirname(source));
    const end = text.indexOf('\n---\n', 4);
    if (!text.startsWith('---\n') || end < 0) throw Error(`${source} needs YAML frontmatter.`);
    // The notice goes after the frontmatter, which must stay at the top of the file.
    files[`plugins/mathsdock-claude/skills/${name}/SKILL.md`] = text.slice(0, end + 5) +
      `\n<!-- Generated from ${source} by scripts/plugins/claude-plugin.mjs. Edit the source, then rerun it. -->\n` + text.slice(end + 5);
  }
  return files;
}

// claude.ai takes a ZIP holding one folder named after the skill, with SKILL.md inside. The fixed
// date keeps the archive identical for identical text.
export function skillZip(name, text) {
  const mtime = new Date('2026-01-01T00:00:00Z');
  return zipSync({ [name]: [{ 'SKILL.md': [strToU8(text), { mtime }] }, { mtime }] }, { level: 9 });
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const check = process.argv.includes('--check');
  let stale = 0;
  for (const [path, text] of Object.entries(pluginFiles())) {
    const target = join(root, path);
    let current = null;
    try { current = readFileSync(target, 'utf8'); } catch { /* missing */ }
    if (current === text) continue;
    if (check) { console.log(`::error file=${path}::out of date; run node scripts/plugins/claude-plugin.mjs`); stale++; continue; }
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, text);
    console.log(`wrote ${path}`);
  }
  if (stale) process.exit(1);
  const zipDir = process.argv.find(a => a.startsWith('--zip='))?.slice(6);
  if (zipDir) {
    mkdirSync(zipDir, { recursive: true });
    for (const [path, text] of Object.entries(pluginFiles())) {
      const name = posix.basename(posix.dirname(path));
      writeFileSync(join(zipDir, `${name}.zip`), skillZip(name, text));
      console.log(`wrote ${join(zipDir, `${name}.zip`)}`);
    }
  }
}
