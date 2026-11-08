// Claude Code PreToolUse hook (registered in .claude/settings.json): in a loop session, refuse any
// Edit, Write or NotebookEdit of a path on the loop's deny-list (forbidden-paths.json, L56).
//
// A session counts as a loop session when MATHSDOCK_LOOP_SESSION=1 or its checkout is on a loop/
// branch. Every other session (Tim's, a project thread's) is unaffected. Changes made another way,
// such as through a shell, are still caught by the forbidden-paths step in quick checks and by the
// trusted merge decision, which refuse a loop/ pull request that touches these paths.
//
// Exit code 2 blocks the tool call and shows the message to the session.
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { isAbsolute, relative as relativePath, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { forbidden, isLoopBranch } from './forbidden-paths.mjs';

const git = (cwd, args) => {
  try { return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); }
  catch { return ''; }
};

/**
 * @returns {{ block: boolean, message?: string }}
 */
export function check(input, { env = process.env, branch, root } = {}) {
  const cwd = input?.cwd || process.cwd();
  const loop = env.MATHSDOCK_LOOP_SESSION === '1' || isLoopBranch(branch ?? git(cwd, ['rev-parse', '--abbrev-ref', 'HEAD']));
  if (!loop) return { block: false };
  const target = input?.tool_input?.file_path ?? input?.tool_input?.notebook_path;
  if (typeof target !== 'string' || !target) return { block: false };
  const top = root ?? (git(cwd, ['rev-parse', '--show-toplevel']) || env.CLAUDE_PROJECT_DIR || cwd);
  const rel = relativePath(top, isAbsolute(target) ? target : resolve(cwd, target)).replaceAll('\\', '/');
  if (!rel || rel.startsWith('../') || rel === '..' || isAbsolute(rel)) return { block: false }; // outside the repository
  const hit = forbidden(rel);
  if (!hit) return { block: false };
  return {
    block: true,
    message: `Loop sessions must not change ${rel} (${hit.why}). It is on the loop's deny-list (scripts/loop/forbidden-paths.json, tier T8). Leave this change for Tim: label the issue loop:needs-tim and explain what is needed.`,
  };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  let input;
  try { input = JSON.parse(readFileSync(0, 'utf8') || '{}'); } catch { process.exit(0); }
  const result = check(input);
  if (result.block) {
    process.stderr.write(result.message + '\n');
    process.exit(2);
  }
}
