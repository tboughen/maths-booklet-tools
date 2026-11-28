// Adaptation requests (docs/content/RESOURCE-LIBRARY.md, Tim 28 Nov 2026). A teacher asks, from a lesson row or a
// whole unit in the Resource library, for an easier, harder or differently taught version for their class. The
// Worker keeps each request as an issue in the private bank repository, labelled adapt-request and assigned to Tim,
// so GitHub emails him about every one. Nothing builds by itself: Tim starts the build. The built booklet joins the
// library as the named adaptation (a version beside Main), waiting for a check, and the build closes the issue.
// Needs REPORT_GITHUB_TOKEN (issues read and write).
export const adaptRepo = { owner: 'tboughen', name: 'mathsdock-bank' };
export const adaptLimits = { text: 2000, list: 50 };
export const adaptAlertTo = 'tboughen';
export const adaptKinds = { easier: 'Easier', harder: 'Harder', different: 'Different approach' };
const label = 'adapt-request';
const marker = /<!-- adapt-request (\{[^\n]*?\}) -->/;
// The same rules as library versions (scripts/library/library.mjs) and feedback keys (library-feedback.mjs).
const versionName = /^[A-Za-z0-9][A-Za-z0-9 ()+&,'-]{0,39}$/;
const unitCode = /^[A-Z]{1,3}\d+$/;
const lessonCode = /^[A-Z]{1,3}\d+\.\d+[a-z]?$/;
const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
// Hidden markers belong to the Worker alone: a request cannot forge one.
const clean = text => { let s = String(text ?? ''), before; do { before = s; s = s.replace(/<!--|-->/g, ''); } while (s !== before); return s.trim(); };
const nameOf = email => String(email || '').split('@')[0].split(/[._-]+/).filter(Boolean).map(w => w[0].toUpperCase() + w.slice(1).toLowerCase()).join(' ') || 'A colleague';

/** The request as the build reads it, or a message saying what to fix. */
export function adaptRequest(body) {
  const year = Number(body?.year);
  if (![7, 8, 9, 10, 11].includes(year)) return { error: 'Choose a year group.' };
  const unit = String(body?.unit ?? '');
  if (!unitCode.test(unit)) return { error: 'Only a scheme unit can be adapted.' };
  const lesson = body?.lesson ?? null;
  if (lesson !== null && (!lessonCode.test(String(lesson)) || !String(lesson).startsWith(`${unit}.`))) return { error: 'Choose a lesson of this unit.' };
  if (!Object.hasOwn(adaptKinds, String(body?.kind))) return { error: 'Choose easier, harder or a different approach.' };
  const name = String(body?.name ?? '').replace(/\s+/g, ' ').trim();
  if (name === 'Main' || !versionName.test(name)) return { error: 'Give the adaptation a short name, up to 40 letters, digits and spaces.' };
  const text = clean(body?.text);
  if (!text) return { error: 'Say what should change.' };
  if (text.length > adaptLimits.text) return { error: `Keep it under ${adaptLimits.text} characters.` };
  return { year, unit, lesson, kind: body.kind, name, text };
}

function github(env, fetcher) {
  const headers = { Accept: 'application/vnd.github+json', Authorization: `Bearer ${env.REPORT_GITHUB_TOKEN}`, 'Content-Type': 'application/json', 'User-Agent': 'mathsdock-site', 'X-GitHub-Api-Version': '2022-11-28' };
  const repo = `https://api.github.com/repos/${adaptRepo.owner}/${adaptRepo.name}`;
  return async (method, path, body) => {
    const response = await fetcher(`${repo}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    if (!response.ok) throw new Error(`GitHub ${method} ${path} ${response.status}`);
    return response.status === 204 ? null : response.json().catch(() => null);
  };
}

/** The issue body: a hidden marker the build reads, then the request in words for Tim's email. */
export function issueBody(request, email, when) {
  const meta = { year: request.year, unit: request.unit, lesson: request.lesson, kind: request.kind, name: request.name, from: encodeURIComponent(String(email).toLowerCase()), at: when };
  const what = request.lesson ? `lesson ${request.lesson}` : `the whole of unit ${request.unit}`;
  return [
    `<!-- adapt-request ${JSON.stringify(meta)} -->`,
    `**${nameOf(email)}** (${String(email).replace(/[\r\n`]+/g, ' ').slice(0, 200)}) asked for an adaptation of ${what}, Year ${request.year}: **${adaptKinds[request.kind]}**, to sit beside Main as "${request.name}".`,
    '', '> ' + request.text.split('\n').join('\n> '),
    '', `Build it from Main, keep the lesson structure, and add it to the Resource library as version "${request.name}", waiting for a check. Close this issue to say no.`,
  ].join('\n');
}

/** Open requests for one unit, oldest first, so the page can show what is being asked for. */
export async function listRequests(env, fetcher, email, year, unit) {
  const issues = await github(env, fetcher)('GET', `/issues?labels=${label}&state=open&sort=created&direction=asc&per_page=${adaptLimits.list}`);
  const me = encodeURIComponent(String(email || '').toLowerCase());
  return (issues ?? []).flatMap(issue => {
    let meta;
    try { meta = JSON.parse(marker.exec(issue.body ?? '')?.[1] ?? 'null'); } catch { meta = null; }
    if (!meta || meta.year !== year || meta.unit !== unit) return [];
    let who = 'A colleague';
    try { who = nameOf(decodeURIComponent(meta.from)); } catch { /* keep the default */ }
    const lesson = typeof meta.lesson === 'string' && lessonCode.test(meta.lesson) ? meta.lesson : null;
    if (!Object.hasOwn(adaptKinds, String(meta.kind)) || !versionName.test(meta.name ?? '')) return [];
    return [{ number: issue.number, when: issue.created_at, lesson, kind: meta.kind, name: meta.name, who, mine: meta.from === me }];
  });
}

export async function adaptRequests(request, env, claims, fetcher = fetch) {
  if (!env.REPORT_GITHUB_TOKEN) return json(503, { error: 'Adaptation requests are not switched on yet.' });
  const email = String(claims.email || '').toLowerCase();
  if (request.method === 'GET') {
    const params = new URL(request.url).searchParams;
    const year = Number(params.get('year')), unit = params.get('unit') ?? '';
    if (![7, 8, 9, 10, 11].includes(year) || !unitCode.test(unit)) return json(400, { error: 'Choose a unit.' });
    try { return json(200, { requests: await listRequests(env, fetcher, email, year, unit) }); }
    catch { return json(502, { error: 'The requests could not be loaded. Try again in a minute.' }); }
  }
  if (request.method !== 'POST') return json(405, { error: 'Method not allowed' });
  // JSON only, so a cross-site form post cannot send a request without a CORS preflight.
  if (!/^application\/json\b/i.test(request.headers.get('Content-Type') || '')) return json(415, { error: 'The request could not be read.' });
  let body;
  try { body = await request.json(); } catch { return json(400, { error: 'The request could not be read.' }); }
  const parsed = adaptRequest(body);
  if (parsed.error) return json(400, { error: parsed.error });
  const when = new Date().toISOString();
  let issue;
  try {
    issue = await github(env, fetcher)('POST', '/issues', { title: `Adapt ${parsed.lesson ?? `unit ${parsed.unit}`} (Year ${parsed.year}): ${parsed.name}, from ${nameOf(email)}`, body: issueBody(parsed, email, when), labels: [label], assignees: [adaptAlertTo] });
  } catch { return json(502, { error: 'The request could not be sent. Try again, or tell Tim.' }); }
  return json(201, { number: Number.isInteger(issue?.number) ? issue.number : null });
}
