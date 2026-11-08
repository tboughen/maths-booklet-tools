// What to do when quick checks fail on main (improvement list L51). The "Loop post-merge" workflow
// runs this from the default branch after a failed quick-checks run on a push to main, and does the
// GitHub calls it decides on.
//
// If the failing commit is a loop merge: pause the loop (an open loop:paused issue stops every
// preflight), cancel queued loop merges, and prepare a revert as a draft pull request for a person
// to check and merge. If it is anyone else's commit: never revert it; open an issue instead.
//
//   node scripts/loop/post-merge.mjs --sha=<commit> --run-url=<url> --pulls=pulls.json --open-issues=issues.json
//
// pulls.json is `gh api repos/{repo}/commits/{sha}/pulls`; issues.json is the open issues labelled
// loop:paused or main:failing. Writes the plan as JSON to stdout and to GITHUB_OUTPUT when set.
import { appendFileSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { isLoopBranch } from './forbidden-paths.mjs';

/**
 * @param {{ sha: string, runUrl: string, pulls: { number: number, title?: string, head?: { ref?: string } }[], openIssues: { title: string }[] }} input
 */
export function plan({ sha, runUrl, pulls, openIssues }) {
  const short = sha.slice(0, 7);
  const pr = pulls.find(p => p.merged_at !== null) ?? pulls[0];
  const loop = Boolean(pr && isLoopBranch(pr.head?.ref));
  const title = loop ? `Loop paused: #${pr.number} broke main (${short})` : `main is failing after ${short}${pr ? ` (#${pr.number})` : ''}`;
  if (openIssues.some(i => i.title.includes(short))) return { action: 'none', reason: `an open issue already covers ${short}` };
  const body = loop
    ? [`Quick checks failed on \`main\` after the loop merge #${pr.number} (${pr.title ?? 'untitled'}), commit \`${sha}\`.`, '', `Failing run: ${runUrl}`, '',
      'The loop is paused while this issue is open: every loop session\'s preflight stops, and queued loop merges were cancelled.',
      `A revert is ready as a draft pull request from \`loop-revert/${short}\`. Check that the failure is real (not a flaky test), then mark the revert ready and merge it, or close it and fix forward.`,
      '', 'Close this issue to let the loop resume once `main` is green again.'].join('\n')
    : [`Quick checks failed on \`main\` after commit \`${sha}\`${pr ? ` from #${pr.number} (${pr.title ?? 'untitled'})` : ''}.`, '', `Failing run: ${runUrl}`, '',
      'This was not a loop merge, so nothing was reverted automatically. The loop is not paused by this issue, but it will not merge anything while `main` is red because every PR needs the quick checks to pass.'].join('\n');
  return {
    action: loop ? 'pause-and-revert' : 'report', loop, pr: pr?.number ?? null, title, body,
    labels: loop ? ['loop:paused', 'loop:reverted'] : ['main:failing'],
    revertBranch: loop ? `loop-revert/${short}` : null,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const arg = name => process.argv.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3);
  const read = f => JSON.parse(readFileSync(f, 'utf8'));
  const sha = arg('sha');
  if (!/^[0-9a-f]{40}$/.test(sha ?? '')) throw Error(`no commit (got ${JSON.stringify(sha)})`);
  const result = plan({ sha, runUrl: arg('run-url') ?? '', pulls: read(arg('pulls')), openIssues: read(arg('open-issues')) });
  console.log(JSON.stringify(result, null, 2));
  if (process.env.GITHUB_OUTPUT) {
    const delimiter = `EOF_${Math.random().toString(36).slice(2)}`;
    appendFileSync(process.env.GITHUB_OUTPUT, [`action=${result.action}`, `pr=${result.pr ?? ''}`, `revert_branch=${result.revertBranch ?? ''}`,
      `title=${result.title ?? ''}`, `labels=${(result.labels ?? []).join(',')}`, `body<<${delimiter}`, result.body ?? '', delimiter, ''].join('\n'));
  }
}
