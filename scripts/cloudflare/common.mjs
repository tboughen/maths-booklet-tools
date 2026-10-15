import { createHash, randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync, renameSync, mkdirSync, readdirSync, lstatSync, realpathSync } from 'node:fs';
import { resolve, dirname, relative, sep } from 'node:path';
import { execFileSync, spawn } from 'node:child_process';

export const schemaVersion = 1;
export const repository = 'tboughen/maths-booklet-tools';
export const sha256 = value => createHash('sha256').update(value).digest('hex');
export function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
  return JSON.stringify(value);
}
export const digestObject = value => sha256(canonical(value));
export const json = path => JSON.parse(readFileSync(path, 'utf8'));
export function save(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  const temporary = `${path}.${randomUUID()}.tmp`;
  writeFileSync(temporary, JSON.stringify(value, null, 2) + '\n');
  renameSync(temporary, path);
}
export const git = (root, args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 }).trim();
export function cleanSource(root) {
  if (git(root, ['status', '--porcelain=v1', '--untracked-files=all'])) throw new Error('Promotable releases require a clean, committed source checkout; use draft previews for working edits.');
  return { commit: git(root, ['rev-parse', 'HEAD']), tree: git(root, ['rev-parse', 'HEAD^{tree}']), bankTree: git(root, ['rev-parse', 'HEAD:public/bank']) };
}
export function inside(root, path) {
  const base = realpathSync(root), target = realpathSync(resolve(root, path));
  if (!target.startsWith(base + sep) || !lstatSync(target).isFile() || lstatSync(resolve(root, path)).isSymbolicLink()) throw new Error(`Unsafe release file: ${path}`);
  return target;
}
export function fileManifest(root) {
  const files = {};
  function walk(directory) {
    for (const item of readdirSync(directory, { withFileTypes: true })) {
      const path = resolve(directory, item.name);
      if (item.isSymbolicLink()) throw new Error('Release packages cannot contain symbolic links');
      if (item.isDirectory()) walk(path);
      else if (item.isFile()) {
        const name = relative(root, path).split(sep).join('/');
        const bytes = readFileSync(inside(root, name));
        files[name] = { bytes: bytes.length, sha256: sha256(bytes) };
      } else throw new Error('Unsupported release file');
    }
  }
  walk(root);
  return Object.fromEntries(Object.entries(files).sort(([a], [b]) => a.localeCompare(b)));
}
export function assertEqual(actual, expected, message) {
  if (canonical(actual) !== canonical(expected)) throw new Error(message);
}
export function run(root, file, args = [], { env = {}, capture = false } = {}) {
  return new Promise((resolveRun, reject) => {
    const node = file.endsWith('.js') || file.endsWith('.mjs') || file.endsWith('.ts');
    const child = spawn(node ? process.execPath : file, node ? [resolve(root, file), ...args] : args, {
      cwd: root, env: { ...process.env, ...env }, stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit', windowsHide: true,
    });
    let stdout = '', stderr = '';
    if (capture) {
      child.stdout.on('data', b => { stdout += b; });
      child.stderr.on('data', b => { stderr += b; });
    }
    child.on('error', reject);
    child.on('exit', code => code === 0 ? resolveRun({ stdout, stderr }) : reject(new Error(`${file} failed (exit ${code})${capture ? ': ' + stderr.slice(-2000) : ''}`)));
  });
}
export function timer(output) {
  const record = { schemaVersion, startedAt: new Date().toISOString(), stages: [], requests: {} };
  return {
    record,
    count(kind) { record.requests[kind] = (record.requests[kind] || 0) + 1; },
    async stage(name, action) {
      const start = performance.now(), stage = { name, startedAt: new Date().toISOString() };
      record.stages.push(stage);
      try { const value = await action(); stage.status = 'passed'; return value; }
      catch (error) { stage.status = 'failed'; throw error; }
      finally { stage.elapsedMs = Math.round(performance.now() - start); save(output, record); }
    },
    finish() { record.completedAt = new Date().toISOString(); save(output, record); },
  };
}
