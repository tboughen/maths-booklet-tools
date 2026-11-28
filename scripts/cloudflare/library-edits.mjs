// Booklets edited on the site (docs/content/RESOURCE-LIBRARY.md "Editing a booklet", Tim 28 Nov 2026). A colleague
// opens a library lesson in the Booklet builder, edits it and presses Save to library. The Worker keeps the edited
// lesson source in the private store under its own SHA-256 (never replaced), adds it to library/edits.json, and
// opens an issue in the bank repository labelled library-edit and assigned to Tim, so he is emailed. Nothing goes
// into the library list here: the edit is built with the booklet build and its checks, added as a new version
// marked waiting, and Tim checks it, as with every booklet. Without REPORT_GITHUB_TOKEN the edit is still kept.
export const editsKey = 'library/edits.json';
export const editRepo = { owner: 'tboughen', name: 'mathsdock-bank' };
export const editLimits = { bytes: 3_000_000, note: 500, list: 500, field: 120 };
export const editAlertTo = 'tboughen';
const label = 'library-edit';
const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
const clean = text => { let s = String(text ?? ''), before; do { before = s; s = s.replace(/<!--|-->/g, ''); } while (s !== before); return s.trim(); };
const oneLine = (text, max) => clean(text).replace(/[\r\n`]+/g, ' ').replace(/\s+/g, ' ').slice(0, max);
const nameOf = email => String(email || '').split('@')[0].split(/[._-]+/).filter(Boolean).map(w => w[0].toUpperCase() + w.slice(1).toLowerCase()).join(' ') || 'A colleague';
const resourceId = /^[a-z0-9][a-z0-9-]{0,119}$/;
const versionName = /^[A-Za-z0-9][A-Za-z0-9 ()+&,'-]{0,39}$/;

const hex = buffer => [...new Uint8Array(buffer)].map(b => b.toString(16).padStart(2, '0')).join('');

/** The saved edits, oldest first. A damaged file is never overwritten: every edit in it would be lost. */
export async function readEdits(env) {
  const object = await env.BANK?.get(editsKey);
  if (!object) return { edits: [], etag: null };
  let edits;
  try { edits = JSON.parse(await new Response(object.body).text()).edits; } catch { edits = null; }
  if (!Array.isArray(edits)) throw new Error(`${editsKey} cannot be read`);
  return { edits, etag: object.etag };
}

/** The edit as stored, or a message saying what to fix. `text` is the lesson source exactly as sent. */
export function checkEdit(body) {
  const resource = String(body?.resource ?? '');
  if (!resourceId.test(resource)) return { error: 'Open the booklet from the Resource library before saving it there.' };
  const version = String(body?.version ?? 'Main');
  if (!versionName.test(version)) return { error: 'The version name is not one the library uses.' };
  const note = oneLine(body?.note, editLimits.note);
  if (!note) return { error: 'Say in a few words what you changed.' };
  const text = typeof body?.source === 'string' ? body.source : '';
  if (!text) return { error: 'The booklet was not sent. Try again.' };
  if (new TextEncoder().encode(text).length > editLimits.bytes) return { error: 'This booklet is too large to save to the library.' };
  let source;
  try { source = JSON.parse(text); } catch { return { error: 'The booklet could not be read. Save the file and send it to Tim.' }; }
  const lessons = source?.booklet?.document?.lessons;
  if (!Array.isArray(lessons) || !lessons.length || source.booklet.document.kind !== 'booklet-a4') return { error: 'This is not a booklet lesson source.' };
  const title = oneLine(body?.title, editLimits.field) || oneLine(lessons[0]?.title, editLimits.field) || resource;
  const failing = Number.isInteger(body?.failing) && body.failing >= 0 ? body.failing : null;
  return { resource, version, note, text, title, failing };
}

function github(env, fetcher) {
  const headers = { Accept: 'application/vnd.github+json', Authorization: `Bearer ${env.REPORT_GITHUB_TOKEN}`, 'Content-Type': 'application/json', 'User-Agent': 'mathsdock-site', 'X-GitHub-Api-Version': '2022-11-28' };
  return async (method, path, body) => {
    const response = await fetcher(`https://api.github.com/repos/${editRepo.owner}/${editRepo.name}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    if (!response.ok) throw new Error(`GitHub ${method} ${path} ${response.status}`);
    return response.json().catch(() => null);
  };
}

/** The issue body: a hidden marker for the build, then the edit in words for Tim's email. */
export function editIssueBody(edit, email) {
  const meta = { resource: edit.resource, version: edit.version, key: edit.key, at: edit.at, from: encodeURIComponent(String(email).toLowerCase()) };
  return [
    `<!-- library-edit ${JSON.stringify(meta)} -->`,
    `**${nameOf(email)}** (${oneLine(email, 200)}) edited **${edit.title}** (${edit.version}) on the site and saved it to the library.`,
    '', `> ${edit.note}`, '',
    edit.failing ? `The page showed ${edit.failing} build check problem${edit.failing === 1 ? '' : 's'} when it was saved.` : 'The page showed no build check problems when it was saved.',
    '', `Saved lesson source: \`${edit.key}\` in the private store. Build it with the booklet build and its checks, add it to the library as a new version marked waiting, then close this issue. Close it without building to turn the edit down.`,
  ].join('\n');
}

async function saveEdit(env, claims, body, fetcher) {
  const parsed = checkEdit(body);
  if (parsed.error) return json(400, { error: parsed.error });
  const email = String(claims.email || '').toLowerCase();
  const sha = hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(parsed.text)));
  const key = `library/edits/${sha}/${parsed.resource}.json`;
  const at = new Date().toISOString();
  await env.BANK.put(key, parsed.text, { httpMetadata: { contentType: 'application/json' }, customMetadata: { by: nameOf(email), resource: parsed.resource, at } });
  const edit = { resource: parsed.resource, version: parsed.version, title: parsed.title, note: parsed.note, key, by: nameOf(email), at, failing: parsed.failing, issue: null };
  let issue = null;
  if (env.REPORT_GITHUB_TOKEN) {
    try {
      issue = await github(env, fetcher)('POST', '/issues', { title: `Edited booklet: ${parsed.title} (${parsed.version}), from ${nameOf(email)}`, body: editIssueBody(edit, email), labels: [label], assignees: [editAlertTo] });
    } catch { issue = null; }
  }
  edit.issue = Number.isInteger(issue?.number) ? issue.number : null;
  for (let attempt = 0; attempt < 3; attempt++) {
    let read;
    try { read = await readEdits(env); } catch { return json(500, { error: 'The list of saved edits could not be read. Tell Tim.' }); }
    const edits = [...read.edits.filter(e => e.key !== key), edit].slice(-editLimits.list);
    const put = await env.BANK.put(editsKey, JSON.stringify({ schema: 'mathsdock-library-edits/1', edits }), { httpMetadata: { contentType: 'application/json' }, onlyIf: read.etag ? { etagMatches: read.etag } : new Headers({ 'If-None-Match': '*' }) });
    if (put) return json(201, { edit, alerted: edit.issue !== null });
  }
  return json(409, { error: 'Someone else saved an edit at the same moment. Try again.' });
}

export async function libraryEdits(request, env, claims, fetcher = fetch) {
  if (!env.BANK) return json(503, { error: 'Saving to the library is not set up yet.' });
  if (request.method === 'GET') {
    try {
      const { edits } = await readEdits(env);
      const resource = new URL(request.url).searchParams.get('resource');
      return json(200, { edits: (resource ? edits.filter(e => e.resource === resource) : edits).map(({ resource, version, title, note, key, by, at, issue }) => ({ resource, version, title, note, href: key.replace(/^library\//, 'library-data/'), by, at, issue })) });
    } catch { return json(500, { error: 'The saved edits could not be read.' }); }
  }
  if (request.method !== 'POST') return json(405, { error: 'Method not allowed' });
  // JSON only, so a cross-site form post cannot save an edit without a CORS preflight.
  if (!/^application\/json\b/i.test(request.headers.get('Content-Type') || '')) return json(415, { error: 'The edit could not be read.' });
  const length = Number(request.headers.get('Content-Length') || 0);
  if (length > editLimits.bytes * 1.2) return json(413, { error: 'This booklet is too large to save to the library.' });
  let body;
  try { body = await request.json(); } catch { return json(400, { error: 'The edit could not be read.' }); }
  return saveEdit(env, claims, body, fetcher);
}
