// Keeps restricted material out of the public app repository (improvement list A6, A7, L58).
// Compares a pull request's merge commit with its first parent and fails when the change adds:
//
//   - a binary or office file (PDF, image, Word, Excel, PowerPoint, ZIP) outside the allowlist below.
//     Question-bank files belong in the private tboughen/mathsdock-bank submodule, never here;
//   - a file whose name looks like an original paper, mark scheme, worked master, class list or pupil data;
//   - a line holding a local machine path (C:\Users\..., /Users/<name>/, /home/<name>/), which leaks
//     usernames and tooling layout.
//
//   node scripts/ci/content-guard.mjs [--base=HEAD^1]
//
// Only additions are checked, so files already on main are not re-litigated. To allow a new kind of
// committed artwork (for example a new examples folder), add its folder to `allowedBinaryFolders` in
// the same pull request, where reviewers can see it. See CLAUDE.md, "Release and safety".
import { appendFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export const binaryFile = /\.(?:pdf|png|jpe?g|gif|webp|bmp|tiff?|heic|docx?|dotx|xlsx?|xlsm|pptx?|potx|odt|ods|odp|zip|7z|rar)$/i;

// Folders where committed binaries are expected: brand artwork, tool card previews, documentation
// example renders, the STIX font licence and synthetic test fixtures.
export const allowedBinaryFolders = [
  /^public\/brand\//,
  /^docs\/brand\//,
  /^src\/assets\//,
  /^assets\/graph-fonts\//,
  /^docs\/[^/]+-examples\//,
  /^docs\/content\/MATHS-RESOURCE-DESIGN-GUIDE\.docx$/,
  /^e2e\/fixtures\//,
];

// Names that suggest restricted originals. Word boundaries use [^a-z0-9] so that `pupil` versions of
// examples (R1-pupil.json) and scripts such as trace-master.py stay allowed.
export const restrictedName = [
  { kind: 'mark-scheme', pattern: /mark[-_ ]?schemes?/i },
  { kind: 'original-paper', pattern: /(?:^|[^a-z0-9])originals?(?:[^a-z0-9]|$)/i },
  { kind: 'worked-master', pattern: /worked[-_ ]?masters?/i },
  { kind: 'class-list', pattern: /class[-_ ]?lists?/i },
  { kind: 'pupil-data', pattern: /pupil[-_ ]?(?:data|names?|lists?|records?|results)/i },
];

// A local home folder with a real-looking user name. Generic CI and container homes are not leaks.
const genericHome = /^(?:runner|user|node|root|ubuntu|vscode|codespace|you|me|name|username|<[^>]+>|\$\w+|\.\.\.)$/i;
const windowsUser = /\b[A-Za-z]:(?:\\\\|\\|\/)Users(?:\\\\|\\|\/)([^\\/"'\s]+)/;
const unixUser = /(?:^|[\s"'`(=:])\/(?:Users|home)\/([^/"'\s`)]+)\//;

export function localPath(text) {
  for (const re of [windowsUser, unixUser]) {
    const m = text.match(re);
    if (m && !genericHome.test(m[1])) return m[0].trim();
  }
  return null;
}

// `added` is the list of added file paths; `diff` is `git diff -U0` output for the change.
export function checkContent(added, diff) {
  const findings = [];
  for (const file of added) {
    if (binaryFile.test(file) && !allowedBinaryFolders.some(re => re.test(file))) {
      findings.push({ file, kind: 'binary-outside-allowlist', text: 'bank files go in the mathsdock-bank submodule; other artwork needs an allowlisted folder' });
    }
    const name = restrictedName.find(r => r.pattern.test(file));
    if (name) findings.push({ file, kind: name.kind, text: 'originals, mark schemes, worked masters and pupil data never go in the repository' });
  }
  let file = null;
  for (const line of diff.split('\n')) {
    if (line.startsWith('diff --git ')) { file = line.split(' b/').pop(); continue; }
    if (!file || !line.startsWith('+') || line.startsWith('+++')) continue;
    // This guard and its tests have to spell out the patterns they reject.
    if (/^scripts\/ci\/content-guard(?:\.test)?\.mjs$/.test(file)) continue;
    const hit = localPath(line.slice(1));
    if (hit && !findings.some(f => f.file === file && f.kind === 'local-path')) findings.push({ file, kind: 'local-path', text: hit });
  }
  return findings;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const base = process.argv.find(a => a.startsWith('--base='))?.slice(7) || 'HEAD^1';
  const git = args => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
  const added = git(['diff', '--no-renames', '--diff-filter=A', '--name-only', base, 'HEAD']).split('\n').filter(Boolean);
  const diff = git(['diff', '--no-renames', '--no-ext-diff', '--text', '-U0', base, 'HEAD', '--', '.', ':(exclude)package-lock.json']);
  const findings = checkContent(added, diff);
  for (const f of findings) console.log(`::error file=${f.file}::${f.kind}: ${f.text.slice(0, 200)}`);
  if (process.env.GITHUB_STEP_SUMMARY && findings.length) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, ['### Restricted content', '', '| File | Finding |', '| --- | --- |',
      ...findings.map(f => `| \`${f.file}\` | ${f.kind}: ${f.text.slice(0, 120).replace(/[|`]/g, ' ')} |`), ''].join('\n'));
  }
  console.log(`content guard: ${findings.length} finding(s) in ${added.length} added file(s)`);
  if (findings.length) process.exit(1);
}
