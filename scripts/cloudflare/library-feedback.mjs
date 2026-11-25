// Resource library feedback (docs/content/RESOURCE-LIBRARY.md). Each lesson of each version, and each
// unit as a whole, has at most one open feedback thread: an issue in the private bank repository with
// the label library-feedback and a hidden marker naming what it is about. Staff comments are issue
// comments that start with a hidden marker naming the signed-in sender. Tim's actions are labels:
// "queued" puts a lesson in the nightly run (which rebuilds it, publishes the new version waiting for
// his check and closes the issue); "agreed" marks a unit comment to plan. "No change needed" and
// "Keep as it is" close the thread. The Worker needs REPORT_GITHUB_TOKEN (issues read and write)
// and LIBRARY_EDITORS (comma-separated emails, a secret) for anyone to act; comments need neither.
export const feedbackRepo = { owner: 'tboughen', name: 'mathsdock-bank' };
export const feedbackLimits = { text: 2000, threads: 100, comments: 100 };
const label = 'library-feedback';
const marker = /<!-- library-feedback (\{[^\n]*?\}) -->/;
const fromMarker = /^<!-- library-from: ([^\n]*?) -->\n?/;
const lessonCode = /^[A-Z]{1,3}\d+(\.\d+[a-z]?)?$/;
const versionName = /^[A-Za-z0-9][A-Za-z0-9 ()+&,'-]{0,39}$/;
const unitCode = /^[A-Z0-9]{1,12}$/;
const lessonActions = new Set(['queue', 'unqueue', 'no-change', 'restore']);
const unitActions = new Set(['agree', 'keep']);
const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });

/** "sam.jones@school" -> "Sam Jones". Staff see names, never addresses. */
export function displayName(email) {
  const local = String(email || '').split('@')[0];
  const words = local.split(/[._-]+/).filter(Boolean).map(w => w[0].toUpperCase() + w.slice(1).toLowerCase());
  return words.join(' ') || 'A colleague';
}
/** The thread a request is about, or null when it is not sound. */
export function feedbackKey(body) {
  const year = Number(body?.year), unit = body?.unit, version = body?.version ?? 'Main', lesson = body?.lesson ?? null;
  if (![7, 8, 9, 10, 11].includes(year) || !unitCode.test(unit ?? '') || !versionName.test(version) || (lesson !== null && !lessonCode.test(lesson))) return null;
  return { year, unit, version, lesson };
}
const sameKey = (a, b) => a.year === b.year && a.unit === b.unit && a.version === b.version && a.lesson === b.lesson;
// Hidden markers belong to the Worker alone: a comment cannot forge one.
const clean = text => { let s = String(text), before; do { before = s; s = s.replace(/<!--|-->/g, ''); } while (s !== before); return s.trim(); };
const editors = env => String(env.LIBRARY_EDITORS || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
/** Anyone signed in may comment; queueing, restoring and closing are for the named editors only. */
export const canAct = (env, email) => editors(env).includes(String(email || '').toLowerCase());

function github(env, fetcher) {
  const headers = { Accept: 'application/vnd.github+json', Authorization: `Bearer ${env.REPORT_GITHUB_TOKEN}`, 'Content-Type': 'application/json', 'User-Agent': 'mathsdock-site', 'X-GitHub-Api-Version': '2022-11-28' };
  const repo = `https://api.github.com/repos/${feedbackRepo.owner}/${feedbackRepo.name}`;
  async function call(method, path, body) {
    const response = await fetcher(path.startsWith('https:') ? path : `${repo}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    if (!response.ok && !(method === 'DELETE' && response.status === 404)) throw new Error(`GitHub ${method} ${path} ${response.status}`);
    return response.status === 204 ? null : response.json().catch(() => null);
  }
  return { call };
}

/** Every open thread, newest first, with its comments in order. One GraphQL call. */
export async function listThreads(env, fetcher) {
  const query = `query($owner:String!,$name:String!){repository(owner:$owner,name:$name){issues(first:${feedbackLimits.threads},states:OPEN,labels:["${label}"],orderBy:{field:CREATED_AT,direction:DESC}){nodes{number body createdAt labels(first:10){nodes{name}} comments(first:${feedbackLimits.comments}){nodes{body createdAt}}}}}}`;
  const data = await github(env, fetcher).call('POST', 'https://api.github.com/graphql', { query, variables: feedbackRepo });
  const nodes = data?.data?.repository?.issues?.nodes;
  if (!Array.isArray(nodes)) throw new Error('GitHub gave no issues');
  const threads = [];
  for (const issue of nodes) {
    let key;
    try { key = feedbackKey(JSON.parse(marker.exec(issue.body ?? '')?.[1] ?? 'null')); } catch { key = null; }
    if (!key) continue;
    const labels = new Set((issue.labels?.nodes ?? []).map(l => l.name));
    const comments = (issue.comments?.nodes ?? []).map(c => {
      const from = fromMarker.exec(c.body ?? '');
      return { who: from ? displayName(from[1]) : 'Claude (nightly run)', when: c.createdAt, text: (c.body ?? '').replace(fromMarker, '').trim() };
    });
    threads.push({ number: issue.number, ...key, kind: key.lesson ? 'lesson' : 'unit', queued: labels.has('queued'), agreed: labels.has('agreed'), opened: issue.createdAt, comments });
  }
  return threads;
}

async function knownUnit(env, key) {
  const object = await env.BANK?.get('library/library.json');
  if (!object) return false;
  const list = JSON.parse(await new Response(object.body).text());
  return list.years?.some(y => y.year === key.year && y.sections?.some(s => s.units?.some(u => u.code === key.unit)));
}

/**
 * GET lists the open threads and whether this person may act on them. POST takes one action:
 * comment {text}, queue, unqueue, no-change, restore {updated} for a lesson; agree, keep for a unit.
 */
export async function libraryFeedback(request, env, claims, fetcher = fetch) {
  if (!env.REPORT_GITHUB_TOKEN) return json(503, { error: "Feedback isn't switched on yet." });
  const email = claims.email;
  if (request.method === 'GET') {
    try { return json(200, { threads: await listThreads(env, fetcher), canAct: canAct(env, email), me: displayName(email) }); }
    catch { return json(502, { error: 'Feedback could not be loaded. Try again in a minute.' }); }
  }
  if (request.method !== 'POST') return json(405, { error: 'Method not allowed' });
  // JSON only, so a cross-site form post cannot act without a CORS preflight.
  if (!/^application\/json\b/i.test(request.headers.get('Content-Type') || '')) return json(415, { error: 'The request could not be read.' });
  let body;
  try { body = await request.json(); } catch { return json(400, { error: 'The request could not be read.' }); }
  const key = feedbackKey(body), action = body?.action;
  if (!key) return json(400, { error: 'The request must name a year, unit and version.' });
  if (action !== 'comment' && !(key.lesson ? lessonActions : unitActions).has(action)) return json(400, { error: 'That action is not known.' });
  if (action !== 'comment' && !canAct(env, email)) return json(403, { error: 'Only the library editors can do that.' });
  const text = action === 'comment' ? clean(body.text ?? '') : '';
  if (action === 'comment' && !text) return json(400, { error: 'Write a comment before sending.' });
  if (text.length > feedbackLimits.text) return json(400, { error: `Keep the comment under ${feedbackLimits.text} characters.` });
  if (action === 'restore' && !/^\d{4}-\d{2}-\d{2}$/.test(body.updated ?? '')) return json(400, { error: 'Name the version to bring back by its date.' });
  const gh = github(env, fetcher);
  const from = `<!-- library-from: ${String(email || '').replace(/[^\w.@+-]/g, '')} -->\n`;
  try {
    if (!await knownUnit(env, key)) return json(400, { error: `${key.unit} is not in the library.` });
    // Oldest first if two were ever opened at once, as the page shows.
    let thread = (await listThreads(env, fetcher)).findLast(t => sameKey(t, key));
    if (!thread && action !== 'comment' && action !== 'restore') return json(404, { error: 'That thread is closed or gone. Reload the page.' });
    if (!thread) {
      const where = key.lesson ? `${key.lesson}${key.version === 'Main' ? '' : ` (${key.version})`}` : `${key.unit}${key.version === 'Main' ? '' : ` (${key.version})`} unit structure`;
      const issue = await gh.call('POST', '/issues', {
        title: `Library feedback: Year ${key.year} ${where}`,
        body: `Resource library feedback on Year ${key.year} ${key.unit}, ${key.version} version, ${key.lesson ?? 'the whole unit'}.\n\n<!-- library-feedback ${JSON.stringify(key)} -->`,
        labels: [label, key.lesson ? 'lesson' : 'unit'],
      });
      thread = { number: issue.number };
    }
    const n = thread.number;
    const note = {
      comment: text,
      'no-change': 'No change needed.',
      keep: 'Keep the unit as it is.',
      agree: 'Agreed: plan the change.',
      restore: `Make the version of ${body.updated} current again (it comes back as the newest version, waiting for a check).`,
    }[action];
    if (note) await gh.call('POST', `/issues/${n}/comments`, { body: `${from}${note}` });
    if (action === 'queue' || action === 'restore') await gh.call('POST', `/issues/${n}/labels`, { labels: ['queued'] });
    if (action === 'unqueue') await gh.call('DELETE', `/issues/${n}/labels/queued`);
    if (action === 'agree') await gh.call('POST', `/issues/${n}/labels`, { labels: ['agreed'] });
    if (action === 'no-change' || action === 'keep') await gh.call('PATCH', `/issues/${n}`, { state: 'closed', state_reason: 'not_planned' });
    return json(200, { ok: true, number: n });
  } catch { return json(502, { error: 'That could not be saved. Try again in a minute.' }); }
}
