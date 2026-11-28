// Present a booklet (docs/tools/PRESENT-BOOKLETS.md): each teacher's ink and place for a class, saved on the site so
// it follows them between computers. One small JSON record per teacher, class and exact booklet build, kept in the
// private R2 bucket under present-ink/<hash of the signed-in email>/<class>/<build>.json. Only the signed-in teacher
// can read or write their own records; a class is a short label such as 9X, never pupil data.
export const inkPrefix = 'present-ink/';
export const inkLimits = { bytes: 1_500_000, builds: 200 };
const className = /^[A-Z0-9]{1,12}$/;
// A build key is "<resource id>@<updated>", as the library list names them.
const buildKey = /^[a-z0-9][a-z0-9-]{0,150}@[0-9A-Za-z:.+-]{1,40}$/;
const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });

/** The teacher's folder: a hash of their email, so addresses never appear in object names. */
export async function teacherFolder(email) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(email || '').trim().toLowerCase()));
  return [...new Uint8Array(digest)].slice(0, 16).map(b => b.toString(16).padStart(2, '0')).join('');
}
const objectKey = (folder, cls, build) => `${inkPrefix}${folder}/${cls}/${encodeURIComponent(build)}.json`;

/** A saved record is sound when it has the shape Present writes (presentStore.ts). */
export function soundRecord(record) {
  if (!record || record.schema !== 1 || typeof record.updated !== 'string' || !record.sides || typeof record.sides !== 'object' || Array.isArray(record.sides)) return false;
  for (const [side, strokes] of Object.entries(record.sides)) {
    if (!/^\d{1,3}$/.test(side) || !Array.isArray(strokes)) return false;
    for (const s of strokes) if (!s || typeof s.id !== 'string' || !Array.isArray(s.points) || (s.kind !== 'pen' && s.kind !== 'highlighter')) return false;
  }
  const st = record.stopped;
  return st === undefined || (Number.isInteger(st?.side) && st.side > 0 && typeof st.at === 'string' && typeof st.flag === 'boolean');
}

/**
 * GET ?class=9X&build=<key>: that record, or {record:null}.
 * GET ?class=9X: the builds this teacher has saved for the class, newest first.
 * PUT {class, build, record}: saves it (JSON only, so a cross-site form cannot write).
 */
export async function presentInk(request, env, claims) {
  if (!env.BANK) return json(503, { error: 'Saving on the site is not available.' });
  const email = claims?.email;
  if (!email) return json(403, { error: 'Sign in again to save your ink.' });
  const folder = await teacherFolder(email);
  const url = new URL(request.url);
  if (request.method === 'GET') {
    const cls = url.searchParams.get('class') || '', build = url.searchParams.get('build');
    if (!className.test(cls) || (build !== null && !buildKey.test(build))) return json(400, { error: 'That class or booklet is not one Present knows.' });
    if (build !== null) {
      const object = await env.BANK.get(objectKey(folder, cls, build));
      if (!object) return json(200, { record: null });
      const record = await object.json().catch(() => null);
      return json(200, { record: soundRecord(record) ? record : null });
    }
    const objects = [];
    let cursor;
    do {
      const page = await env.BANK.list({ prefix: `${inkPrefix}${folder}/${cls}/`, limit: 1000, cursor });
      objects.push(...page.objects);
      cursor = page.truncated ? page.cursor : undefined;
    } while (cursor && objects.length < 5000);
    const builds = objects.map(o => ({ build: decodeURIComponent(o.key.slice(`${inkPrefix}${folder}/${cls}/`.length).replace(/\.json$/, '')), updated: o.uploaded instanceof Date ? o.uploaded.toISOString() : String(o.uploaded) }))
      .filter(b => buildKey.test(b.build)).sort((a, b) => b.updated.localeCompare(a.updated)).slice(0, inkLimits.builds);
    return json(200, { builds });
  }
  if (request.method !== 'PUT') return json(405, { error: 'Method not allowed' });
  if (!/^application\/json\b/i.test(request.headers.get('Content-Type') || '')) return json(415, { error: 'The ink could not be read.' });
  const text = await request.text();
  if (text.length > inkLimits.bytes) return json(413, { error: 'There is too much ink on this booklet to save. Clear some sides.' });
  let body;
  try { body = JSON.parse(text); } catch { return json(400, { error: 'The ink could not be read.' }); }
  if (!className.test(body?.class ?? '') || !buildKey.test(body?.build ?? '') || !soundRecord(body?.record)) return json(400, { error: 'The ink could not be read.' });
  await env.BANK.put(objectKey(folder, body.class, body.build), JSON.stringify(body.record), { httpMetadata: { contentType: 'application/json' } });
  return json(200, { ok: true });
}
