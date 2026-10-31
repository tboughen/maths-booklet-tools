// Flags the easiest way to "pass" a check: editing the oracle. Compares a pull request's merge
// commit with its first parent and reports removed or loosened assertions, new skip/only/fixme,
// deleted test files and changed control hashes. See docs/AUTONOMOUS-LOOP-POLICY.md (gate 10).
//
//   node scripts/ci/test-integrity.mjs [--base=HEAD^1]
//
// `.only` always fails (it silently drops every other test). Everything else is reported as a
// warning and in the job summary: in phase 0 a person reads it; loop PRs will escalate on it.
import { appendFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const testFile = /(?:\.(?:test|spec)\.[cm]?[jt]sx?$|^e2e\/|^integration\/)/;
const controlFile = /(?:^|\/)(?:fixtures|golden|__snapshots__)\/|controls?\.json$|manifest\.json$/;
const assertion = /\b(?:expect|assert)(?:\.\w+)*\s*\(/;
// Anchored to the start of a statement so that test names or strings mentioning `.only(` do not count.
const focusOnly = /^(?:test|it|describe)(?:\.describe)?\.only\s*\(/;
const disabled = /^(?:test|it|describe)(?:\.describe)?\.(?:skip|fixme|todo)\s*\(|^x(?:it|describe)\s*\(/;
const loose = /\.(?:toBeTruthy|toBeDefined|toBeFalsy|toBeCloseTo|toMatchObject|toContain|toBeGreaterThan(?:OrEqual)?|toBeLessThan(?:OrEqual)?)\s*\(/;
const hash = /\b[0-9a-f]{40,64}\b/;

export function checkDiff(diff) {
  const findings = [];
  let file = null, deleted = false;
  for (const line of diff.split('\n')) {
    if (line.startsWith('diff --git ')) { file = line.split(' b/').pop(); deleted = false; continue; }
    if (line.startsWith('deleted file mode')) { deleted = true; if (testFile.test(file)) findings.push({ level: 'warning', file, kind: 'deleted-test-file', text: '' }); continue; }
    if (!file || deleted || line.startsWith('+++') || line.startsWith('---')) continue;
    const added = line.startsWith('+'), removed = line.startsWith('-');
    if (!added && !removed) continue;
    const text = line.slice(1).trim();
    if (testFile.test(file)) {
      if (added && focusOnly.test(text)) findings.push({ level: 'error', file, kind: 'only', text });
      else if (added && disabled.test(text)) findings.push({ level: 'warning', file, kind: 'disabled-test', text });
      else if (added && assertion.test(text) && loose.test(text)) findings.push({ level: 'warning', file, kind: 'loose-assertion', text });
      else if (removed && assertion.test(text)) findings.push({ level: 'warning', file, kind: 'removed-assertion', text });
    }
    if (/^src\/gates\/contracts\//.test(file) && !findings.some(f => f.file === file && f.kind === 'changed-contract')) findings.push({ level: 'warning', file, kind: 'changed-contract', text: 'saved-file schema or MCP catalogue changed: needs Tim (tier T5/T6)' });
    if (/baseline\.json$/.test(file) && !findings.some(f => f.file === file && f.kind === 'changed-baseline')) findings.push({ level: 'warning', file, kind: 'changed-baseline', text });
    if (removed && controlFile.test(file) && hash.test(text)) findings.push({ level: 'warning', file, kind: 'changed-control-hash', text });
  }
  return findings;
}

// A moved assertion appears once as removed and once as added; only report removals that were not
// re-added somewhere in the same change.
export function netFindings(findings, diff) {
  const addedLines = new Set(diff.split('\n').filter(l => l.startsWith('+') && !l.startsWith('+++')).map(l => l.slice(1).trim()));
  const net = findings.filter(f => !(f.kind === 'removed-assertion' && addedLines.has(f.text)));
  // A loose matcher is only a loosening when it replaces an assertion removed from the same file.
  const replaced = new Set(net.filter(f => f.kind === 'removed-assertion').map(f => f.file));
  return net.filter(f => f.kind !== 'loose-assertion' || replaced.has(f.file));
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const base = process.argv.find(a => a.startsWith('--base='))?.slice(7) || 'HEAD^1';
  const diff = execFileSync('git', ['diff', '--no-renames', '-U0', base, 'HEAD'], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
  const findings = netFindings(checkDiff(diff), diff);
  for (const f of findings) console.log(`::${f.level} file=${f.file}::${f.kind}${f.text ? `: ${f.text.slice(0, 200)}` : ''}`);
  if (process.env.GITHUB_STEP_SUMMARY && findings.length) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, ['### Test integrity', '', '| Level | File | Finding |', '| --- | --- | --- |',
      ...findings.map(f => `| ${f.level} | \`${f.file}\` | ${f.kind}${f.text ? `: \`${f.text.slice(0, 120).replace(/[|`]/g, ' ')}\`` : ''} |`), ''].join('\n'));
  }
  console.log(`test integrity: ${findings.length} finding(s)`);
  if (findings.some(f => f.level === 'error')) process.exit(1);
}
