// Cover lesson requests (docs/content/COVER-REQUESTS.md, Tim 26 Nov 2026). An absent teacher describes one
// cover lesson on the Resource library page and presses Build now. The Worker keeps each request as an issue
// in the private bank repository, labelled cover-request and assigned to Tim, so GitHub emails him about
// every one (the alert and the log in one). It then starts the saved cloud task that builds the lesson, if
// the task's address and key are set as Worker secrets; without them the request waits for Tim to start it.
// The build writes one 8-side lesson marked "Cover lesson" (never a number), PDF only, into the library as
// waiting, comments on the issue and closes it with the label cover-ready. Tim closing the issue stops it.
// Needs REPORT_GITHUB_TOKEN (issues read and write); COVER_TASK_URL and COVER_TASK_TOKEN start the build.
import { canAct } from './library-feedback.mjs';

export const coverRepo = { owner: 'tboughen', name: 'mathsdock-bank' };
export const coverLimits = { text: 2000, attachment: 20000, name: 120, list: 30 };
export const coverAlertTo = 'tboughen';
const label = 'cover-request';
const marker = /<!-- cover-request (\{[^\n]*?\}) -->/;
const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
// Hidden markers belong to the Worker alone: a request cannot forge one.
const clean = text => { let s = String(text ?? ''), before; do { before = s; s = s.replace(/<!--|-->/g, ''); } while (s !== before); return s.trim(); };
const oneLine = (text, max) => clean(text).replace(/[\r\n`]+/g, ' ').slice(0, max);
const nameOf = email => String(email || '').split('@')[0].split(/[._-]+/).filter(Boolean).map(w => w[0].toUpperCase() + w.slice(1).toLowerCase()).join(' ') || 'A colleague';

/** The request as the build reads it, or a message saying what to fix. */
export function coverRequest(body) {
  const year = Number(body?.year);
  if (![7, 8, 9, 10, 11].includes(year)) return { error: 'Choose a year group.' };
  const tier = year >= 9 ? body?.tier : null;
  if (year >= 9 && !['Foundation', 'Higher'].includes(tier)) return { error: 'Choose Foundation or Higher.' };
  if (body?.absent !== true) return { error: 'Tick the box to confirm you are absent.' };
  const text = clean(body?.text);
  if (!text) return { error: 'Describe what the cover lesson should revise.' };
  if (text.length > coverLimits.text) return { error: `Keep the description under ${coverLimits.text} characters.` };
  const plan = oneLine(body?.plan, 400);
  const attachment = body?.attachment && typeof body.attachment === 'object'
    ? { name: oneLine(body.attachment.name, coverLimits.name) || 'attached file', text: clean(body.attachment.text).slice(0, coverLimits.attachment) }
    : null;
  return { year, tier, text, plan, attachment };
}

function github(env, fetcher) {
  const headers = { Accept: 'application/vnd.github+json', Authorization: `Bearer ${env.REPORT_GITHUB_TOKEN}`, 'Content-Type': 'application/json', 'User-Agent': 'mathsdock-site', 'X-GitHub-Api-Version': '2022-11-28' };
  const repo = `https://api.github.com/repos/${coverRepo.owner}/${coverRepo.name}`;
  return async (method, path, body) => {
    const response = await fetcher(`${repo}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    if (!response.ok) throw new Error(`GitHub ${method} ${path} ${response.status}`);
    return response.status === 204 ? null : response.json().catch(() => null);
  };
}

/** The issue body: a hidden marker the build reads, then the request in words for Tim's email. */
export function issueBody(request, email, when) {
  const group = `Year ${request.year}${request.tier ? ` ${request.tier}` : ''}`;
  const meta = { year: request.year, tier: request.tier, from: encodeURIComponent(String(email).toLowerCase()), at: when };
  return [
    `<!-- cover-request ${JSON.stringify(meta)} -->`,
    `**${nameOf(email)}** (${oneLine(email, 200)}) is absent and asked for a cover lesson for **${group}**. They ticked "I'm absent".`,
    '', '> ' + request.text.split('\n').join('\n> '),
    request.plan ? `\n**The page's check, which they confirmed:** ${request.plan}` : '',
    request.attachment ? `\n<details><summary>Text of the attached file: ${request.attachment.name}</summary>\n\n\`\`\`text\n${request.attachment.text.replace(/```/g, "'''")}\n\`\`\`\n</details>` : '',
    '', 'One 8-side cover lesson, marked "Cover lesson", pupil and answers PDFs, into the Resource library as waiting. Close this issue to stop the build.',
  ].filter(s => s !== '').join('\n');
}

/** Recent requests, newest first: everyone sees the log; `mine` marks the signed-in teacher's own. */
export async function listRequests(env, fetcher, email) {
  const issues = await github(env, fetcher)('GET', `/issues?labels=${label}&state=all&sort=created&direction=desc&per_page=${coverLimits.list}`);
  const me = encodeURIComponent(String(email || '').toLowerCase());
  return (issues ?? []).flatMap(issue => {
    let meta;
    try { meta = JSON.parse(marker.exec(issue.body ?? '')?.[1] ?? 'null'); } catch { meta = null; }
    if (!meta) return [];
    const labels = new Set((issue.labels ?? []).map(l => l.name));
    const state = issue.state === 'open' ? (labels.has('cover-building') ? 'building' : 'waiting') : labels.has('cover-ready') ? 'ready' : 'stopped';
    const text = /\n> ([^\n]*)/.exec(issue.body ?? '')?.[1] ?? '';
    let who = 'A colleague';
    try { who = nameOf(decodeURIComponent(meta.from)); } catch { /* keep the default */ }
    return [{ number: issue.number, when: issue.created_at, year: meta.year, tier: meta.tier ?? null, who, mine: meta.from === me, text: text.slice(0, 200), state }];
  });
}

/** Starts the saved cloud task for one request. False when no task is set up or it would not start. */
export async function startBuild(env, fetcher, number) {
  if (!env.COVER_TASK_URL || !env.COVER_TASK_TOKEN || !/^https:\/\//.test(env.COVER_TASK_URL)) return false;
  try {
    const response = await fetcher(env.COVER_TASK_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.COVER_TASK_TOKEN}`, 'Content-Type': 'application/json', 'anthropic-version': '2023-06-01', 'anthropic-beta': env.COVER_TASK_BETA || 'experimental-cc-routine-2026-04-01' },
      body: JSON.stringify({ text: `Cover request #${number} in ${coverRepo.owner}/${coverRepo.name}.` }),
    });
    return response.ok;
  } catch { return false; }
}

// Cover lessons are short-lived (Tim, 26 Nov): a library editor can delete one from the library list. The
// files stay in the private store; library/cover-removed.json lists the deleted ids, and the page hides them.
export const coverRemovedKey = 'library/cover-removed.json';
export async function readRemoved(env) {
  const object = await env.BANK?.get(coverRemovedKey);
  if (!object) return { removed: {}, etag: null };
  let removed;
  try { removed = JSON.parse(await new Response(object.body).text()).removed; } catch { removed = null; }
  // A damaged file is never overwritten: every deletion would come back.
  if (!removed || typeof removed !== 'object' || Array.isArray(removed)) throw new Error(`${coverRemovedKey} cannot be read`);
  return { removed, etag: object.etag };
}
/** Only a lesson a cover request built (on a Review and cover shelf, note "Cover request #N") can be deleted. */
export async function isCoverLesson(env, id) {
  const object = await env.BANK?.get('library/library.json');
  if (!object) return false;
  try {
    const list = JSON.parse(await new Response(object.body).text());
    return (list.resources ?? []).some(r => r.id === id && r.unit === 'REVIEW' && /^Cover request #\d+/.test(r.note ?? ''));
  } catch { return false; }
}
async function removeLesson(env, email, id) {
  if (!canAct(env, email)) return json(403, { error: 'Only the library editors can delete a cover lesson.' });
  if (typeof id !== 'string' || !id || id.length > 200 || !(await isCoverLesson(env, id))) return json(400, { error: 'Only a cover lesson can be deleted.' });
  for (let attempt = 0; attempt < 2; attempt++) {
    let read;
    try { read = await readRemoved(env); } catch { return json(500, { error: 'The deleted list could not be read. Tell Tim.' }); }
    read.removed[id] = { by: nameOf(email), at: new Date().toISOString() };
    const body = JSON.stringify({ schema: 'mathsdock-cover-removed/1', removed: read.removed });
    const put = await env.BANK.put(coverRemovedKey, body, { httpMetadata: { contentType: 'application/json' }, onlyIf: read.etag ? { etagMatches: read.etag } : new Headers({ 'If-None-Match': '*' }) });
    if (put) return json(200, { ok: true, removed: Object.keys(read.removed) });
  }
  return json(409, { error: 'Someone else changed the library at the same moment. Try again.' });
}

export async function coverRequests(request, env, claims, fetcher = fetch) {
  if (!env.REPORT_GITHUB_TOKEN) return json(503, { error: 'Cover requests are not switched on yet.' });
  const call = github(env, fetcher);
  if (request.method === 'GET') {
    try {
      const [requests, { removed }] = await Promise.all([listRequests(env, fetcher, claims.email), readRemoved(env).catch(() => ({ removed: {} }))]);
      return json(200, { requests, building: !!(env.COVER_TASK_URL && env.COVER_TASK_TOKEN), removed: Object.keys(removed), canDelete: canAct(env, claims.email) });
    }
    catch { return json(502, { error: 'The requests could not be loaded. Try again in a minute.' }); }
  }
  if (request.method !== 'POST') return json(405, { error: 'Method not allowed' });
  // JSON only, so a cross-site form post cannot send a request without a CORS preflight.
  if (!/^application\/json\b/i.test(request.headers.get('Content-Type') || '')) return json(415, { error: 'The request could not be read.' });
  let body;
  try { body = await request.json(); } catch { return json(400, { error: 'The request could not be read.' }); }
  if (body?.action === 'remove') return removeLesson(env, String(claims.email || '').toLowerCase(), body.id);
  const parsed = coverRequest(body);
  if (parsed.error) return json(400, { error: parsed.error });
  const email = String(claims.email || '').toLowerCase();
  const when = new Date().toISOString();
  const group = `Year ${parsed.year}${parsed.tier ? ` ${parsed.tier}` : ''}`;
  let issue;
  try {
    issue = await call('POST', '/issues', { title: `Cover request: ${group}, from ${nameOf(email)}`, body: issueBody(parsed, email, when), labels: [label], assignees: [coverAlertTo] });
  } catch { return json(502, { error: 'The request could not be sent. Try again, or tell Tim.' }); }
  // GitHub made the issue (so Tim is already emailed) but gave no number back: say it was sent, not failed.
  if (!Number.isInteger(issue?.number)) return json(201, { number: null, started: false });
  const started = await startBuild(env, fetcher, issue.number);
  if (started) await call('POST', `/issues/${issue.number}/labels`, { labels: ['cover-building'] }).catch(() => null);
  return json(201, { number: issue.number, started });
}
