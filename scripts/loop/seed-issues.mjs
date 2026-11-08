// Turns the loop backlog (backlog.json) into loop-item issues (improvement list L44). Dry run only:
// it writes the issues it would create, as JSON, and creates nothing. Creating them is a separate
// step that needs Tim's go-ahead; whoever does it posts each entry with its title, body and labels.
//
//   node scripts/loop/seed-issues.mjs [--existing=issues.json] [--out=seed.json]
//
// --existing is a list of current issues ([{ title, body }]); an item whose code already has an
// issue is skipped, so seeding twice creates nothing new.
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { forbidden } from './forbidden-paths.mjs';
import { itemOf } from './preflight.mjs';

export const BACKLOG = JSON.parse(readFileSync(new URL('./backlog.json', import.meta.url), 'utf8')).items;
export const LABELS = JSON.parse(readFileSync(new URL('./labels.json', import.meta.url), 'utf8')).labels;

/** The issue for one backlog item, in the same shape the loop-item form produces. */
export function issueFor(entry) {
  const body = [
    '### Item', '', entry.item, '',
    '### Tier', '', entry.tier, '',
    '### Area', '', entry.area, '',
    '### Paths', '', ...entry.paths.map(p => `- \`${p}\``), '',
    '### Acceptance criteria', '', ...entry.acceptance.map(a => `- ${a}`), '',
    '### Notes', '', `Seeded from the improvement list (item ${entry.item}). The research and evidence are under that code.${entry.needsTim ? ' Waiting for Tim before the loop may start it.' : ''}`,
  ].join('\n');
  return { title: `[loop] ${entry.item}: ${entry.title}`, body, labels: [entry.needsTim ? 'loop:needs-tim' : 'loop:candidate', `tier:${entry.tier}`] };
}

/** Problems with a backlog entry: anything that would stop the loop picking it up safely. */
export function problems(entry) {
  const out = [];
  for (const key of ['item', 'title', 'tier', 'area']) if (!entry[key]) out.push(`missing ${key}`);
  if (!/^T[0-7]$/.test(entry.tier ?? '')) out.push(`tier ${entry.tier} is not T0 to T7`);
  if (!entry.paths?.length) out.push('no paths');
  if (!entry.acceptance?.length) out.push('no acceptance criteria');
  for (const p of entry.paths ?? []) if (forbidden(p.replace(/\*.*$/, '')) || forbidden(p)) out.push(`deny-listed path ${p}`);
  return out;
}

export function seed(existing = []) {
  const have = new Set(existing.map(i => itemOf(i).item || i.title?.match(/^\[loop\] (\S+):/)?.[1]).filter(Boolean));
  return BACKLOG.filter(e => !have.has(e.item)).map(issueFor);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const arg = name => process.argv.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3);
  const bad = BACKLOG.flatMap(e => problems(e).map(p => `${e.item}: ${p}`));
  if (bad.length) throw Error(`backlog.json has problems:\n${bad.join('\n')}`);
  const issues = seed(arg('existing') ? JSON.parse(readFileSync(arg('existing'), 'utf8')) : []);
  const text = JSON.stringify({ labels: LABELS, issues }, null, 2) + '\n';
  if (arg('out')) writeFileSync(arg('out'), text);
  else process.stdout.write(text);
  console.error(`dry run: ${issues.length} issue(s) would be created; nothing was created.`);
}
