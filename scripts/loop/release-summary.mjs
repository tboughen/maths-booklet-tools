// "Changes since the last publication" for a release decision (improvement list L62). Lists every
// commit between the qualification base and HEAD with its pull request, its risk tier and whether
// the loop wrote it, so loop merges are visibly batched for Tim's release decision.
//
//   node scripts/loop/release-summary.mjs --base=<last released commit> [--prs=prs.json]
//
// prs.json (optional) is `gh pr list --state merged --json number,headRefName,labels`; without it
// the loop column says "unknown". Writes Markdown to stdout and to the job summary when set.
import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { classifyRisk } from './classify-risk.mjs';
import { isLoopBranch } from './forbidden-paths.mjs';

/**
 * @param {{ sha: string, subject: string, paths: string[] }[]} commits newest first
 * @param {{ number: number, headRefName: string, labels?: { name: string }[] }[] | null} prs
 */
export function summarise(commits, prs = null) {
  const byNumber = new Map((prs ?? []).map(p => [p.number, p]));
  const rows = commits.map(c => {
    const number = Number(c.subject.match(/\(#(\d+)\)\s*$/)?.[1]) || null;
    const pr = number && byNumber.get(number);
    const loop = !prs ? 'unknown' : pr && (isLoopBranch(pr.headRefName) || (pr.labels ?? []).some(l => l.name === 'loop:shadow')) ? 'loop' : 'thread';
    return { ...c, number, tier: classifyRisk(c.paths).tier, loop };
  });
  const count = t => rows.filter(r => r.tier === t).length;
  const tiers = [...new Set(rows.map(r => r.tier))].sort().map(t => `${t} ${count(t)}`).join(', ');
  const loopCount = rows.filter(r => r.loop === 'loop').length;
  const lines = [
    `### Changes since the last publication: ${rows.length} commit${rows.length === 1 ? '' : 's'}`, '',
    rows.length ? `By tier: ${tiers}. Written by the loop: ${prs ? loopCount : 'unknown'}.` : 'Nothing has changed.', '',
  ];
  if (rows.length) lines.push('| Commit | Pull request | Tier | By | Change |', '| --- | --- | --- | --- | --- |',
    ...rows.map(r => `| \`${r.sha.slice(0, 7)}\` | ${r.number ? `#${r.number}` : 'none'} | ${r.tier} | ${r.loop} | ${r.subject.replace(/\s*\(#\d+\)\s*$/, '').replace(/\|/g, '\\|')} |`), '');
  return { rows, markdown: lines.join('\n') };
}

/** Commits from base (exclusive) to HEAD, newest first, with the paths each changed. */
export function commitsSince(base, cwd) {
  const git = args => execFileSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  return git(['log', '--first-parent', '--format=%H%x09%s', `${base}..HEAD`]).split('\n').filter(Boolean).map(line => {
    const [sha, ...subject] = line.split('\t');
    const paths = git(['diff-tree', '--no-commit-id', '--name-only', '-r', '--no-renames', `${sha}^1`, sha]).split('\n').filter(Boolean);
    return { sha, subject: subject.join('\t'), paths };
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const arg = name => process.argv.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3);
  const base = arg('base');
  if (!base) throw Error('Usage: node scripts/loop/release-summary.mjs --base=<commit> [--prs=prs.json]');
  const prsFile = arg('prs');
  const prs = prsFile && existsSync(prsFile) ? JSON.parse(readFileSync(prsFile, 'utf8')) : null;
  const { markdown } = summarise(commitsSince(base), prs);
  console.log(markdown);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, markdown + '\n');
}
