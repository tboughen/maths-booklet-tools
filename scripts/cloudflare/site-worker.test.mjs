import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ukToday } from './cover-requests.mjs';
import worker, { serveBankAsset, serveLibrary, serveLibraryFeedback, serveCoverRequests, serveLibraryEdits, serveAdaptRequests, servePresentInk, submitReport, reportRepo, verifyAccessToken, accessSettings, gatedCache } from './site-worker.mjs';
import { gatedCache as verifierCache } from './upload-core.mjs';
import { assertGatedWorker } from './gated-config.mjs';

const team = 'https://mathsdock.cloudflareaccess.com';
const aud = 'a'.repeat(64);
const env0 = { ACCESS_TEAM_DOMAIN: team, ACCESS_AUD: aud };
const key = `bank/assets/sha256/${'b'.repeat(64)}.pdf`;
const bytes = new TextEncoder().encode('%PDF-1.7 example question bytes');

const pair = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
const jwk = { ...await crypto.subtle.exportKey('jwk', pair.publicKey), kid: 'k1' };
const certs = async url => { assert.equal(url, `${team}/cdn-cgi/access/certs`); return Response.json({ keys: [jwk] }); };
const b64 = data => Buffer.from(data).toString('base64url');
async function token(claims = {}, header = { alg: 'RS256', kid: 'k1' }) {
  const now = Math.floor(Date.now() / 1000);
  const body = `${b64(JSON.stringify(header))}.${b64(JSON.stringify({ iss: team, aud: [aud], exp: now + 600, iat: now, email: 'teacher@school.example', ...claims }))}`;
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', pair.privateKey, new TextEncoder().encode(body));
  return `${body}.${b64(signature)}`;
}

function bucket() {
  const object = { size: bytes.length, httpEtag: '"md5etag"' };
  return {
    async head(k) { return k === key ? object : null; },
    async get(k, { range } = {}) {
      if (k !== key) return null;
      const header = range?.get?.('range');
      const match = header && /^bytes=(\d+)-(\d+)$/.exec(header);
      if (match) {
        const offset = Number(match[1]), length = Number(match[2]) - offset + 1;
        return { ...object, range: { offset, length }, body: new Blob([bytes.slice(offset, offset + length)]).stream() };
      }
      return { ...object, range: { offset: 0, length: bytes.length }, body: new Blob([bytes]).stream() };
    },
  };
}
const request = (path, headers = {}, method = 'GET') => new Request(`https://mathsdock.co.uk/${path}`, { method, headers });

test('serves a bank file to a signed-in member with private caching', async () => {
  const response = await serveBankAsset(request(key, { 'Cf-Access-Jwt-Assertion': await token() }), { ...env0, BANK: bucket() }, { fetcher: certs });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'application/pdf');
  assert.equal(response.headers.get('cache-control'), gatedCache);
  assert.equal(response.headers.get('etag'), '"md5etag"');
  assert.equal(response.headers.get('content-length'), String(bytes.length));
  assert.deepEqual(new Uint8Array(await response.arrayBuffer()), bytes);
});

test('the release verifier and the Worker agree on the cache policy', () => {
  assert.equal(gatedCache, verifierCache);
});

test('answers PDF.js range requests with 206 and an exact Content-Range', async () => {
  const response = await serveBankAsset(request(key, { 'Cf-Access-Jwt-Assertion': await token(), Range: 'bytes=0-4' }), { ...env0, BANK: bucket() }, { fetcher: certs });
  assert.equal(response.status, 206);
  assert.equal(response.headers.get('content-range'), `bytes 0-4/${bytes.length}`);
  assert.equal(new TextDecoder().decode(await response.arrayBuffer()), '%PDF-');
});

test('HEAD returns metadata only', async () => {
  const response = await serveBankAsset(request(key, { 'Cf-Access-Jwt-Assertion': await token() }, 'HEAD'), { ...env0, BANK: bucket() }, { fetcher: certs });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-length'), String(bytes.length));
  assert.equal(response.body, null);
});

test('refuses requests without a valid Access token for this application', async () => {
  const env = { ...env0, BANK: bucket() };
  const cases = [
    {},
    { 'Cf-Access-Jwt-Assertion': 'not-a-token' },
    { 'Cf-Access-Jwt-Assertion': await token({ aud: ['c'.repeat(64)] }) },
    { 'Cf-Access-Jwt-Assertion': await token({ iss: 'https://other.cloudflareaccess.com' }) },
    { 'Cf-Access-Jwt-Assertion': await token({ exp: Math.floor(Date.now() / 1000) - 10 }) },
    { 'Cf-Access-Jwt-Assertion': await token({}, { alg: 'none', kid: 'k1' }) },
    { 'Cf-Access-Jwt-Assertion': (await token()).slice(0, -4) + 'AAAA' },
  ];
  for (const headers of cases) {
    const response = await serveBankAsset(request(key, headers), env, { fetcher: certs });
    assert.equal(response.status, 403, JSON.stringify(headers).slice(0, 80));
    assert.equal(response.headers.get('cache-control'), 'no-store');
  }
});

test('fails closed when the Access application is not configured', async () => {
  for (const env of [{}, { ACCESS_TEAM_DOMAIN: team }, { ACCESS_TEAM_DOMAIN: 'https://evil.example', ACCESS_AUD: aud }]) {
    const response = await serveBankAsset(request(key, { 'Cf-Access-Jwt-Assertion': await token() }), { ...env, BANK: bucket() }, { fetcher: certs });
    assert.equal(response.status, 503);
  }
  assert.equal(accessSettings({ ACCESS_TEAM_DOMAIN: `${team}/`, ACCESS_AUD: aud }).team, team);
});

test('only immutable bank keys are readable', async () => {
  const jwt = await token();
  for (const path of ['bank/assets/../catalogue.json', 'bank/assets/sha256/short.pdf', `bank/assets/sha256/${'b'.repeat(64)}.svg`, `bank/assets/legacy/${'b'.repeat(64)}.pdf`]) {
    const response = await serveBankAsset(request(path, { 'Cf-Access-Jwt-Assertion': jwt }), { ...env0, BANK: bucket() }, { fetcher: certs });
    assert.equal(response.status, 404, path);
  }
  const missing = await serveBankAsset(request(`bank/assets/sha256/${'c'.repeat(64)}.png`, { 'Cf-Access-Jwt-Assertion': jwt }), { ...env0, BANK: bucket() }, { fetcher: certs });
  assert.equal(missing.status, 404);
  const post = await serveBankAsset(request(key, { 'Cf-Access-Jwt-Assertion': jwt }, 'POST'), { ...env0, BANK: bucket() }, { fetcher: certs });
  assert.equal(post.status, 405);
});

test('serves a scheme of work as JSON only to signed-in staff', async () => {
  const schemeKey = `bank/assets/sha256/${'d'.repeat(64)}.json`, body = '{"schemaVersion":1}';
  const BANK = { async get(k) { return k === schemeKey ? { size: body.length, httpEtag: '"e"', range: { offset: 0, length: body.length }, body: new Blob([body]).stream() } : null; } };
  const ok = await serveBankAsset(request(schemeKey, { 'Cf-Access-Jwt-Assertion': await token() }), { ...env0, BANK }, { fetcher: certs });
  assert.equal(ok.status, 200);
  assert.equal(ok.headers.get('content-type'), 'application/json');
  assert.equal(ok.headers.get('cache-control'), gatedCache);
  assert.equal(await ok.text(), body);
  const anonymous = await serveBankAsset(request(schemeKey), { ...env0, BANK }, { fetcher: certs });
  assert.equal(anonymous.status, 403);
  const named = await serveBankAsset(request('bank/assets/schemes/school.json', { 'Cf-Access-Jwt-Assertion': await token() }), { ...env0, BANK }, { fetcher: certs });
  assert.equal(named.status, 404);
});

test('serves the resource library list and files only to signed-in staff', async () => {
  const fileKey = `library/files/${'e'.repeat(64)}/y9-a7-03-lesson-booklet_pupil.pdf`, docKey = `library/files/${'f'.repeat(64)}/y9-a7-03-lesson-booklet_pupil.docx`;
  const stored = { 'library/library.json': '{"schema":"mathsdock-library-served/2"}', [fileKey]: '%PDF', [docKey]: 'PK' };
  const make = k => k in stored ? { size: stored[k].length, httpEtag: '"t"', body: new Blob([stored[k]]).stream() } : null;
  const BANK = { async get(k) { return make(k); }, async head(k) { return make(k); } };
  const signed = { 'Cf-Access-Jwt-Assertion': await token() };
  const list = await serveLibrary(request('library-data/library.json', signed), { ...env0, BANK }, { fetcher: certs });
  assert.equal(list.status, 200);
  assert.equal(list.headers.get('cache-control'), 'private, no-cache');
  assert.match(list.headers.get('content-type'), /^application\/json/);
  assert.equal(await list.text(), stored['library/library.json']);
  const pdf = await serveLibrary(request(fileKey.replace(/^library\//, 'library-data/'), signed), { ...env0, BANK }, { fetcher: certs });
  assert.equal(pdf.status, 200);
  assert.equal(pdf.headers.get('cache-control'), gatedCache);
  assert.equal(pdf.headers.get('content-disposition'), 'inline; filename="y9-a7-03-lesson-booklet_pupil.pdf"');
  const doc = await serveLibrary(request(docKey.replace(/^library\//, 'library-data/'), signed), { ...env0, BANK }, { fetcher: certs });
  assert.match(doc.headers.get('content-disposition'), /^attachment;/);
  assert.match(doc.headers.get('content-type'), /wordprocessingml/);
  const head = await serveLibrary(request('library-data/library.json', signed, 'HEAD'), { ...env0, BANK }, { fetcher: certs });
  assert.equal(head.status, 200);
  assert.equal(await head.text(), '');
  assert.equal((await serveLibrary(request('library-data/library.json'), { ...env0, BANK }, { fetcher: certs })).status, 403);
  assert.equal((await serveLibrary(request('library-data/library.json', signed), { BANK }, { fetcher: certs })).status, 503);
  for (const path of ['library-data/files/abc/x.pdf', `library-data/files/${'e'.repeat(64)}/X.PDF`, `library-data/files/${'e'.repeat(64)}/a.exe`, 'library-data/other.json', `library-data/files/${'e'.repeat(64)}/../library.json`])
    assert.equal((await serveLibrary(request(path, signed), { ...env0, BANK }, { fetcher: certs })).status, 404, path);
  assert.equal((await serveLibrary(request('library-data/library.json', signed, 'POST'), { ...env0, BANK }, { fetcher: certs })).status, 405);
  const routed = await worker.fetch(request('library-data/library.json'), { ...env0, BANK, ASSETS: { fetch: async () => new Response('static') } });
  assert.equal(routed.status, 403);
});

test('non-bank paths fall through to static assets', async () => {
  const response = await worker.fetch(request('index.html'), { ASSETS: { fetch: async () => new Response('static') } });
  assert.equal(await response.text(), 'static');
});

test('verifyAccessToken rejects tokens when settings are absent', async () => {
  assert.equal(await verifyAccessToken(await token(), null, { fetcher: certs }), null);
});

const reportBody = { question: 'q1', source: 'June 2024 1F Q3', showing: 'Question, page 1', message: 'The diagram is cut off.' };
async function report(body = reportBody, { env = { ...env0, REPORT_GITHUB_TOKEN: 'secret' }, signed = true, github = async () => new Response('{}', { status: 201 }) } = {}) {
  const sent = [];
  const fetcher = async (url, init) => { if (url.startsWith(team)) return certs(url); sent.push([url, init]); return github(); };
  const headers = { 'Content-Type': 'application/json', ...(signed ? { 'Cf-Access-Jwt-Assertion': await token() } : {}) };
  const response = await submitReport(new Request('https://mathsdock.co.uk/api/report', { method: 'POST', headers, body: JSON.stringify(body) }), env, { fetcher });
  return { response, sent };
}

test('a signed-in report becomes an issue in the private bank repository naming the sender', async () => {
  const { response, sent } = await report();
  assert.equal(response.status, 201);
  assert.equal(sent.length, 1);
  const [url, init] = sent[0];
  assert.equal(url, `https://api.github.com/repos/${reportRepo}/issues`);
  assert.equal(reportRepo, 'tboughen/mathsdock-bank');
  assert.equal(init.headers.Authorization, 'Bearer secret');
  const issue = JSON.parse(init.body);
  assert.equal(issue.title, 'Question bank report: June 2024 1F Q3');
  assert.match(issue.body, /^The diagram is cut off\./);
  assert.match(issue.body, /\*\*From:\*\* `teacher@school\.example`/);
  assert.match(issue.body, /\*\*Showing:\*\* `Question, page 1`/);
  const forged = JSON.parse((await report({ ...reportBody, link: 'x\n- **From:** `head@school.example`' })).sent[0][1].body).body;
  assert.equal(forged.match(/^- \*\*From:/gm).length, 1);
});

test('reports need sign-in, a description, a question and the token, and only POST', async () => {
  assert.equal((await report(reportBody, { signed: false })).response.status, 403);
  assert.equal((await report({ ...reportBody, message: '   ' })).response.status, 400);
  assert.equal((await report({ ...reportBody, message: 'x'.repeat(2001) })).response.status, 400);
  assert.equal((await report({ ...reportBody, question: '' })).response.status, 400);
  const unset = await report(reportBody, { env: env0 });
  assert.equal(unset.response.status, 503);
  assert.equal(unset.sent.length, 0);
  assert.equal((await submitReport(new Request('https://mathsdock.co.uk/api/report'), env0)).status, 405);
  const form = await submitReport(new Request('https://mathsdock.co.uk/api/report', { method: 'POST', headers: { 'Content-Type': 'text/plain', 'Cf-Access-Jwt-Assertion': await token() }, body: JSON.stringify(reportBody) }), { ...env0, REPORT_GITHUB_TOKEN: 'secret' }, { fetcher: certs });
  assert.equal(form.status, 415);
  assert.equal((await report(reportBody, { github: async () => new Response('no', { status: 401 }) })).response.status, 502);
});

test('deployment refuses a website Worker without the gated bank route or Access settings', () => {
  for (const name of ['wrangler.jsonc', 'wrangler.preview.jsonc']) {
    const config = JSON.parse(readFileSync(new URL(`../../${name}`, import.meta.url), 'utf8'));
    assert.equal(config.workers_dev, false, `${name} must not publish an ungated workers.dev copy`);
    assert.equal(config.preview_urls, false);
    const configured = { ...config, vars: env0 };
    assertGatedWorker(configured);
    // Every /api route the Worker answers must run before the static assets, or the page's fallback answers it.
    const routes = [...readFileSync(new URL('./site-worker.mjs', import.meta.url), 'utf8').matchAll(/pathname === '(\/api\/[^']+)'/g)].map(m => m[1]);
    assert.ok(routes.includes('/api/library/adapt'));
    for (const route of routes) assert.ok(config.assets.run_worker_first.includes(route), `${name} must run the Worker first for ${route}`);
    assert.throws(() => assertGatedWorker({ ...configured, vars: { ACCESS_TEAM_DOMAIN: '', ACCESS_AUD: '' } }), /ACCESS_TEAM_DOMAIN/);
    assert.throws(() => assertGatedWorker({ ...configured, workers_dev: true }), /gated R2 route/);
    assert.throws(() => assertGatedWorker({ ...configured, r2_buckets: [] }), /gated R2 route/);
    assert.throws(() => assertGatedWorker({ ...configured, assets: { ...configured.assets, run_worker_first: true } }), /gated R2 route/);
  }
});

test('release smoke check fails if the bank answers without sign-in', async () => {
  const { verifyGate } = await import('./network.mjs');
  const manifest = { assets: [{ key }] }, metrics = { count() {} };
  const seen = [];
  await verifyGate(manifest, 'https://mathsdock.co.uk', metrics, async (url, init) => { seen.push([url, init.redirect]); return new Response(null, { status: 302, headers: { location: `${team}/cdn-cgi/access/login` } }); });
  assert.deepEqual(seen, [[`https://mathsdock.co.uk/${key}`, 'manual'], ['https://mathsdock.co.uk/bank/catalogue.json', 'manual'], ['https://mathsdock.co.uk/bank/catalogue-index.json', 'manual']]);
  await assert.rejects(verifyGate(manifest, 'https://mathsdock.co.uk', metrics, async () => new Response('open', { status: 200 })), /not behind staff sign-in/);
});

// Resource library feedback.
const libraryList = { schema: 'mathsdock-library-served/2', years: [{ year: 9, sections: [{ name: 'Autumn term', units: [{ code: 'A7', title: 'Straight-line graphs' }] }] }], resources: [] };
const libraryBucket = { async get(k) { return k === 'library/library.json' ? { body: new Blob([JSON.stringify(libraryList)]).stream() } : null; } };
const openIssue = (key, labels = [], comments = []) => ({ number: 7, body: `About it.\n\n<!-- library-feedback ${JSON.stringify(key)} -->`, createdAt: '2026-11-25T09:00:00Z', labels: { nodes: labels.map(name => ({ name })) }, comments: { nodes: comments } });
const a704 = { year: 9, unit: 'A7', version: 'Main', lesson: 'A7.04' };
async function feedback(method, body, { env = { ...env0, REPORT_GITHUB_TOKEN: 'secret', BANK: libraryBucket, LIBRARY_EDITORS: 'Sam.Jones@school.example' }, issues = [], signed = true, remaining = [] } = {}) {
  const sent = [];
  const fetcher = async (url, init) => {
    if (url.startsWith(team)) return certs(url);
    sent.push([init.method, url, init.body && JSON.parse(init.body)]);
    if (url.endsWith('/graphql')) return Response.json({ data: { repository: { issues: { nodes: issues } } } });
    if (url.endsWith('/issues')) return Response.json({ number: 8 }, { status: 201 });
    if (init.method === 'GET' && url.includes('/comments?')) return Response.json(remaining);
    return Response.json({}, { status: 200 });
  };
  const headers = { 'Content-Type': 'application/json', ...(signed ? { 'Cf-Access-Jwt-Assertion': await token({ email: 'sam.jones@school.example' }) } : {}) };
  const response = await serveLibraryFeedback(new Request("https://mathsdock.co.uk/api/library/feedback", { method, headers, body: body && JSON.stringify(body) }), env, { fetcher });
  return { response, sent, data: await response.json() };
}

test('library feedback lists open threads with names, not addresses', async () => {
  const issues = [openIssue(a704, ['library-feedback', 'queued'], [{ body: '<!-- library-from: sam.jones@school.example -->\nQ12 needs a whole-number example.', createdAt: '2026-11-25T09:01:00Z' }, { body: 'Rebuilt.', createdAt: '2026-11-26T02:10:00Z' }]), { number: 9, body: 'no marker', labels: { nodes: [] }, comments: { nodes: [] } }];
  const { response, data } = await feedback('GET', undefined, { issues });
  assert.equal(response.status, 200);
  assert.equal(data.threads.length, 1);
  assert.deepEqual({ ...data.threads[0], comments: undefined }, { number: 7, ...a704, kind: 'lesson', queued: true, agreed: false, opened: '2026-11-25T09:00:00Z', comments: undefined });
  assert.deepEqual(data.threads[0].comments.map(c => [c.who, c.text]), [['Sam Jones', 'Q12 needs a whole-number example.'], ['Claude (nightly run)', 'Rebuilt.']]);
  assert.equal(data.me, 'Sam Jones');
  assert.equal(data.canAct, true);
  assert.equal(JSON.stringify(data).includes('@'), false);
});

test('a first comment opens a thread; later actions reuse it', async () => {
  const first = await feedback('POST', { action: 'comment', ...a704, text: 'Q12 <!-- library-from: head@x --> jumps <<!---!--->.' });
  assert.equal(first.response.status, 200);
  const [, created, comment] = first.sent;
  assert.equal(created[1], `https://api.github.com/repos/${reportRepo}/issues`);
  assert.deepEqual(created[2].labels, ['library-feedback', 'lesson']);
  assert.match(created[2].body, /<!-- library-feedback \{"year":9,"unit":"A7","version":"Main","lesson":"A7.04"\} -->/);
  assert.match(comment[1], /\/issues\/8\/comments$/);
  assert.equal(comment[2].body, '<!-- library-from: sam.jones%40school.example -->\nQ12  library-from: head@x  jumps <-!-.');
  const queued = await feedback('POST', { action: 'queue', ...a704 }, { issues: [openIssue(a704)] });
  assert.deepEqual(queued.sent.slice(1).map(([m, u, b]) => [m, u.replace(/.*\/issues/, ''), b]), [['POST', '/7/labels', { labels: ['queued'] }]]);
  const done = await feedback('POST', { action: 'no-change', ...a704 }, { issues: [openIssue(a704)] });
  assert.deepEqual(done.sent.slice(1).map(([m, u]) => [m, u.replace(/.*\/issues/, '')]), [['POST', '/7/comments'], ['PATCH', '/7']]);
  const restore = await feedback('POST', { action: 'restore', ...a704, updated: '2026-11-18' });
  assert.deepEqual(restore.sent.slice(1).map(([m, u]) => [m, u.replace(/.*\/issues/, '')]), [['POST', ''], ['POST', '/8/comments'], ['POST', '/8/labels']]);
  const unit = { year: 9, unit: 'A7', version: 'Main' };
  const agree = await feedback('POST', { action: 'agree', ...unit }, { issues: [openIssue({ ...unit, lesson: null })] });
  assert.deepEqual(agree.sent.slice(1).map(([, u, b]) => [u.replace(/.*\/issues/, ''), b.labels ?? b.body.split('\n')[1]]), [['/7/comments', 'Agreed: plan the change.'], ['/7/labels', ['agreed']]]);
});

test('library feedback refuses what it should', async () => {
  assert.equal((await feedback('GET', undefined, { signed: false })).response.status, 403);
  assert.equal((await feedback('GET', undefined, { env: { ...env0, BANK: libraryBucket } })).response.status, 503);
  assert.equal((await feedback('POST', { action: 'comment', ...a704, text: '  ' })).response.status, 400);
  assert.equal((await feedback('POST', { action: 'comment', ...a704, text: 'x'.repeat(2001) })).response.status, 400);
  assert.equal((await feedback('POST', { action: 'comment', ...a704, unit: 'A9', text: 'Hi' })).response.status, 400);
  assert.equal((await feedback('POST', { action: 'agree', ...a704 })).response.status, 400);
  assert.equal((await feedback('POST', { action: 'queue', ...a704 })).response.status, 404);
  const editorsOnly = await feedback('POST', { action: 'queue', ...a704 }, { env: { ...env0, REPORT_GITHUB_TOKEN: 'secret', BANK: libraryBucket, LIBRARY_EDITORS: 'tim@school.example' }, issues: [openIssue(a704)] });
  assert.equal(editorsOnly.response.status, 403);
  const nobody = await feedback('POST', { action: 'no-change', ...a704 }, { env: { ...env0, REPORT_GITHUB_TOKEN: 'secret', BANK: libraryBucket }, issues: [openIssue(a704)] });
  assert.equal(nobody.response.status, 403);
  assert.equal((await feedback('PUT', { action: 'comment', ...a704, text: 'Hi' })).response.status, 405);
});

test('library checks turn a lesson green for its version only, editors only, without GitHub', async () => {
  const booklet = { id: 'y9-a7-04-lesson-booklet', year: 9, unit: 'A7', lesson: 'A7.04', version: 'Main', updated: '2026-11-25' };
  const stored = { 'library/library.json': JSON.stringify({ ...libraryList, resources: [booklet] }) };
  const puts = [];
  const bucket = {
    async get(k) { return k in stored ? { body: new Blob([stored[k]]).stream(), etag: `e${puts.length}` } : null; },
    async put(k, v, o) { const exists = k in stored; if (o.onlyIf instanceof Headers ? exists : o.onlyIf.etagMatches !== `e${puts.length}`) return null; puts.push([k, o]); stored[k] = v; return {}; },
  };
  const env = { ...env0, REPORT_GITHUB_TOKEN: 'secret', BANK: bucket, LIBRARY_EDITORS: 'Sam.Jones@school.example' };
  const check = { action: 'check', ...a704, id: booklet.id, updated: '2026-11-25' };
  const done = await feedback('POST', check, { env });
  assert.equal(done.response.status, 200);
  assert.equal(done.sent.length, 0);
  assert.deepEqual(Object.keys(done.data.checks), [booklet.id]);
  assert.equal(JSON.parse(stored['library/checks.json']).checks[booklet.id].by, 'Sam Jones');
  const listed = await feedback('GET', undefined, { env });
  assert.equal(listed.data.checks[booklet.id].updated, '2026-11-25');
  const closing = await feedback('POST', { ...check, close: true }, { env, issues: [openIssue(a704)] });
  assert.ok(closing.sent.some(([m, u, b]) => m === 'PATCH' && u.endsWith('/issues/7') && b.state === 'closed'));
  assert.equal((await feedback('POST', { ...check, updated: '2026-11-18' }, { env })).response.status, 409);
  assert.equal((await feedback('POST', { ...check, id: 'y9-a7-03-lesson-booklet' }, { env })).response.status, 400);
  assert.equal((await feedback('POST', { ...check, lesson: 'A7.03' }, { env })).response.status, 400);
  assert.equal((await feedback('POST', check, { env: { ...env, LIBRARY_EDITORS: 'tim@school.example' } })).response.status, 403);
  const undone = await feedback('POST', { ...check, action: 'uncheck' }, { env });
  assert.deepEqual(undone.data.checks, {});
  const queuedStaysOpen = await feedback('POST', { ...check, close: true }, { env, issues: [openIssue(a704, ['library-feedback', 'queued'])] });
  assert.ok(!queuedStaysOpen.sent.some(([m]) => m === 'PATCH'));
  stored['library/checks.json'] = 'not json';
  assert.equal((await feedback('POST', check, { env })).response.status, 502);
  assert.equal(stored['library/checks.json'], 'not json');
});

test('anyone deletes only their own comment, and a thread left empty closes', async () => {
  const mine = { databaseId: 41, body: '<!-- library-from: sam.jones@school.example -->\nTypo on page 3.', createdAt: '2026-11-25T09:01:00Z' };
  const theirs = { databaseId: 42, body: '<!-- library-from: tim.boughen@school.example -->\nAgreed.', createdAt: '2026-11-25T09:02:00Z' };
  const env = { ...env0, REPORT_GITHUB_TOKEN: 'secret', BANK: libraryBucket };
  const listed = await feedback('GET', undefined, { env, issues: [openIssue(a704, ['library-feedback'], [mine, theirs])] });
  assert.deepEqual(listed.data.threads[0].comments.map(c => [c.id, c.mine]), [[41, true], [42, false]]);
  const refused = await feedback('POST', { action: 'delete', ...a704, comment: 42 }, { env, issues: [openIssue(a704, ['library-feedback'], [mine, theirs])] });
  assert.equal(refused.response.status, 403);
  assert.equal(refused.sent.some(([m]) => m === 'DELETE'), false);
  const kept = await feedback('POST', { action: 'delete', ...a704, comment: 41 }, { env, issues: [openIssue(a704, ['library-feedback'], [mine, theirs])], remaining: [theirs] });
  assert.equal(kept.response.status, 200);
  assert.deepEqual(kept.sent.slice(1).map(([m, u]) => [m, u.replace(/.*\/repos\/[^/]+\/[^/]+/, '')]), [['DELETE', '/issues/comments/41'], ['GET', '/issues/7/comments?per_page=1']]);
  // Tim's queue stays even when the only comment goes.
  const queued = await feedback('POST', { action: 'delete', ...a704, comment: 41 }, { env, issues: [openIssue(a704, ['library-feedback', 'queued'], [mine])] });
  assert.deepEqual(queued.sent.slice(1).map(([m]) => m), ['DELETE']);
  assert.equal(queued.data.closed, false);
  // Markers hold the encoded email, so o'brien is not obrien.
  const quoted = { databaseId: 43, body: "<!-- library-from: o'brien@school.example -->\nHi.", createdAt: '2026-11-25T09:03:00Z' };
  const other = await feedback('GET', undefined, { env, issues: [openIssue(a704, ['library-feedback'], [quoted])] });
  assert.equal(other.data.threads[0].comments[0].mine, false);
  const said = await feedback('POST', { action: 'comment', ...a704, text: 'x' }, { env, issues: [openIssue(a704, ['library-feedback'], [])] });
  assert.match(said.sent.find(([, u]) => u.endsWith('/comments'))[2].body, /^<!-- library-from: sam\.jones%40school\.example -->/);
  const last = await feedback('POST', { action: 'delete', ...a704, comment: 41 }, { env, issues: [openIssue(a704, ['library-feedback'], [mine])] });
  assert.deepEqual(last.sent.slice(1).map(([m, u, b]) => [m, u.replace(/.*\/repos\/[^/]+\/[^/]+/, ''), b?.state]), [['DELETE', '/issues/comments/41', undefined], ['GET', '/issues/7/comments?per_page=1', undefined], ['PATCH', '/issues/7', 'closed']]);
  assert.equal(last.data.closed, true);
  const gone = await feedback('POST', { action: 'delete', ...a704, comment: 99 }, { env, issues: [openIssue(a704, ['library-feedback'], [mine])] });
  assert.equal(gone.response.status, 404);
});

test('a unit booklet is checked and commented on apart from its unit and lessons', async () => {
  const booklet = { id: 'y9-a7-unit-booklet-part-1', year: 9, unit: 'A7', type: 'unit-booklet', part: 'Part 1', version: 'Main', updated: '2026-11-25' };
  const stored = { 'library/library.json': JSON.stringify({ ...libraryList, resources: [booklet] }) };
  const bucket = { async get(k) { return k in stored ? { body: new Blob([stored[k]]).stream(), etag: 'e' } : null; }, async put(k, v) { stored[k] = v; return {}; } };
  const env = { ...env0, REPORT_GITHUB_TOKEN: 'secret', BANK: bucket, LIBRARY_EDITORS: 'Sam.Jones@school.example' };
  const key = { year: 9, unit: 'A7', version: 'Main', lesson: null, booklet: 'Part 1' };
  const checked = await feedback('POST', { action: 'check', ...key, id: booklet.id, updated: '2026-11-25' }, { env });
  assert.equal(checked.response.status, 200);
  assert.equal(JSON.parse(stored['library/checks.json']).checks[booklet.id].by, 'Sam Jones');
  assert.equal((await feedback('POST', { action: 'check', ...key, booklet: 'Part 2', id: booklet.id, updated: '2026-11-25' }, { env })).response.status, 400);
  assert.equal((await feedback('POST', { action: 'restore', ...key, updated: '2026-11-20' }, { env })).response.status, 400);
  assert.equal((await feedback('POST', { action: 'comment', ...key, lesson: 'A7.01', text: 'x' }, { env })).response.status, 400);
  const commented = await feedback('POST', { action: 'comment', ...key, text: 'Contents lists A7.06 twice.' }, { env });
  // A comment takes the check off: the booklet needs changes now.
  assert.deepEqual(JSON.parse(stored['library/checks.json']).checks, {});
  assert.equal((await feedback('POST', { action: 'comment', ...key, booklet: 'Part 1: Linear graphs – A', text: 'x' }, { env })).response.status, 200);
  const issue = commented.sent.find(([, u]) => u.endsWith('/issues'))[2];
  assert.match(issue.title, /A7 unit booklet, Part 1/);
  assert.deepEqual(issue.labels, ['library-feedback', 'booklet']);
  const unitThread = openIssue({ year: 9, unit: 'A7', version: 'Main', lesson: null }, ['library-feedback'], []);
  const listed = await feedback('GET', undefined, { env, issues: [openIssue(key, ['library-feedback'], []), { ...unitThread, number: 9 }] });
  assert.deepEqual(listed.data.threads.map(t => [t.number, t.kind, t.booklet ?? null]), [[7, 'booklet', 'Part 1'], [9, 'unit', null]]);
});

// Cover lesson requests.
async function cover(method, body, { env = { ...env0, REPORT_GITHUB_TOKEN: 'secret' }, issues = [], signed = true, taskOk = true, query = '' } = {}) {
  const sent = [];
  const fetcher = async (url, init) => {
    if (url.startsWith(team)) return certs(url);
    sent.push([init.method, url, init.body && JSON.parse(init.body), init.headers]);
    if (url === 'https://api.anthropic.com/task/fire') return new Response('{}', { status: taskOk ? 200 : 500 });
    if (init.method === 'GET') return Response.json(issues);
    if (url.endsWith('/issues')) return Response.json({ number: 41 }, { status: 201 });
    return Response.json({}, { status: 200 });
  };
  const headers = { 'Content-Type': 'application/json', ...(signed ? { 'Cf-Access-Jwt-Assertion': await token({ email: 'Sam.Jones@school.example' }) } : {}) };
  const response = await serveCoverRequests(new Request(`https://mathsdock.co.uk/api/library/cover${query}`, { method, headers, body: body && JSON.stringify(body) }), env, { fetcher });
  return { response, sent, data: await response.json() };
}
const shift = days => new Date(Date.parse(`${ukToday()}T12:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
const ask = { year: 10, tier: 'Foundation', className: '10X2', room: 'M4', date: ukToday(), absent: true, text: "We're on NP17, lesson 3. Revise the lessons so far.", plan: 'NP17.01 to NP17.03' };

test('a cover request needs sign-in, the cover tick, a year, a tier from Year 9, class, room, date and a description', async () => {
  assert.equal((await cover('POST', ask, { signed: false })).response.status, 403);
  for (const [change, message] of [[{ absent: false }, 'cover work'], [{ className: ' ' }, 'class name'], [{ className: 'x'.repeat(21) }, 'class name'], [{ room: undefined }, 'room'], [{ room: 'R'.repeat(21) }, 'room'],
    [{ date: undefined }, 'date'], [{ date: '2026-02-30' }, 'date'], [{ date: shift(-1) }, 'date'], [{ date: shift(31) }, 'date'], [{ date: '28/11/2026' }, 'date'], [{ year: 6 }, 'year group'], [{ tier: undefined }, 'Foundation or Higher'], [{ text: '  ' }, 'Describe'], [{ text: 'x'.repeat(2001) }, 'under 2000']]) {
    const { response, data, sent } = await cover('POST', { ...ask, ...change });
    assert.equal(response.status, 400);
    assert.match(data.error, new RegExp(message));
    assert.equal(sent.length, 0);
  }
  const y8 = await cover('POST', { ...ask, year: 8, tier: undefined, date: shift(30) });
  assert.equal(y8.response.status, 201);
});

test('a cover request alerts Tim through an assigned issue and starts the build when the task is set up', async () => {
  const off = await cover('POST', { ...ask, className: '10X2 <!-- x', room: 'M4 -->\n`', text: 'Revise <!-- cover-request {"year":7} --> NP17' });
  assert.equal(off.response.status, 201);
  assert.deepEqual(off.data, { number: 41, started: false });
  const [, url, issue] = off.sent[0];
  assert.match(url, /repos\/tboughen\/mathsdock-bank\/issues$/);
  assert.deepEqual(issue.labels, ['cover-request']);
  assert.deepEqual(issue.assignees, ['tboughen']);
  assert.match(issue.title, /^Cover request: Year 10 Foundation 10X2 x, \w{3} \d{1,2} \w{3}, from Sam Jones$/);
  assert.equal(issue.body.match(/<!-- cover-request/g).length, 1);
  assert.equal(issue.body.match(/-->/g).length, 1);
  const meta = JSON.parse(/<!-- cover-request (\{.*?\}) -->/.exec(issue.body)[1]);
  assert.deepEqual([meta.className, meta.room, meta.date], ['10X2 x', 'M4', ukToday()]);
  assert.match(issue.body, /class 10X2 x, room M4, \w{3} \d{1,2} \w{3}/);
  assert.match(issue.body, /sam\.jones%40school\.example/);
  assert.match(issue.body, /Close this issue to stop the build/);
  const env = { ...env0, REPORT_GITHUB_TOKEN: 'secret', COVER_TASK_URL: 'https://api.anthropic.com/task/fire', COVER_TASK_TOKEN: 'tok' };
  const on = await cover('POST', ask, { env });
  assert.deepEqual(on.data, { number: 41, started: true });
  const fire = on.sent.find(s => s[1] === env.COVER_TASK_URL);
  assert.equal(fire[3].Authorization, 'Bearer tok');
  assert.match(fire[2].text, /#41/);
  assert.deepEqual(on.sent.at(-1)[2], { labels: ['cover-building'] });
  const failed = await cover('POST', ask, { env, taskOk: false });
  assert.deepEqual(failed.data, { number: 41, started: false });
});

test('the cover request log shows names and states, never addresses', async () => {
  const body = (from) => `<!-- cover-request {"year":9,"tier":"Higher","className":"9H1","room":"M4","date":"2026-11-27","from":"${from}","at":"x"} -->\nintro\n\n> Mock revision for Paper 3.`;
  const issues = [
    { number: 3, state: 'open', labels: [{ name: 'cover-request' }, { name: 'cover-building' }], created_at: '2026-11-26T07:44:00Z', body: body('sam.jones%40school.example') },
    { number: 2, state: 'closed', labels: [{ name: 'cover-request' }, { name: 'cover-ready' }], created_at: '2026-11-25T07:44:00Z', body: body('ann.lee%40school.example') },
    { number: 1, state: 'closed', labels: [], created_at: '2026-11-24T07:44:00Z', body: 'no marker' },
  ];
  const { data } = await cover('GET', undefined, { issues });
  assert.deepEqual(data.requests.map(r => [r.number, r.who, r.state, r.mine, r.text]), [[3, 'Sam Jones', 'building', true, 'Mock revision for Paper 3.'], [2, 'Ann Lee', 'ready', false, 'Mock revision for Paper 3.']]);
  assert.deepEqual([data.requests[0].className, data.requests[0].room, data.requests[0].date], ['9H1', 'M4', '2026-11-27']);
  assert.equal(JSON.stringify(data).includes('@'), false);
  assert.equal(JSON.stringify(data).includes('%40'), false);
  assert.equal(data.building, false);
});

test('a library editor can delete a cover lesson from the list, and nothing else', async () => {
  const stored = { 'library/library.json': JSON.stringify({ resources: [
    { id: 'y11-cover-2026-11-26-41', unit: 'REVIEW', note: 'Cover request #41' },
    { id: 'y11-mock-revision', unit: 'REVIEW', note: 'Mock revision' },
    { id: 'y9-a7-03', unit: 'A7', note: 'Cover request #9' },
    { id: 'y9-a7-cover-lesson-2', unit: 'REVIEW', note: 'Cover lesson, 2026-11-27' },
  ] }) };
  const BANK = {
    async get(k) { return k in stored ? { body: new Blob([stored[k]]).stream(), etag: 'e' } : null; },
    async put(k, v) { stored[k] = v; return {}; },
  };
  const base = { ...env0, REPORT_GITHUB_TOKEN: 'secret', BANK };
  const colleague = await cover('POST', { action: 'remove', id: 'y11-cover-2026-11-26-41' }, { env: base });
  assert.equal(colleague.response.status, 403);
  const editor = { ...base, LIBRARY_EDITORS: 'sam.jones@school.example' };
  for (const id of ['y11-mock-revision', 'y9-a7-03', 'missing', 42])
    assert.equal((await cover('POST', { action: 'remove', id }, { env: editor })).response.status, 400, String(id));
  assert.ok(!('library/cover-removed.json' in stored));
  const done = await cover('POST', { action: 'remove', id: 'y11-cover-2026-11-26-41' }, { env: editor });
  assert.equal(done.response.status, 200);
  assert.deepEqual(done.data.removed, ['y11-cover-2026-11-26-41']);
  assert.equal(done.sent.length, 0, 'deleting makes no GitHub call');
  // The deleted list needs no GitHub at all, so it survives GitHub being down or switched off.
  const listed = await cover('GET', undefined, { env: { ...editor, REPORT_GITHUB_TOKEN: undefined }, query: '?only=removed' });
  assert.equal(listed.response.status, 200);
  assert.deepEqual(listed.data.removed, ['y11-cover-2026-11-26-41']);
  assert.equal(listed.data.canDelete, true);
  assert.equal(listed.sent.length, 0);
  assert.equal((await cover('GET', undefined, { env: base, query: '?only=removed' })).data.canDelete, false);
  // A hand-made cover lesson moved to the Cover library ("Cover lesson" note) can be deleted too.
  assert.equal((await cover('POST', { action: 'remove', id: 'y9-a7-cover-lesson-2' }, { env: editor })).response.status, 200);
});

// Booklets edited on the site and saved to the library (library-edits.mjs).
function memoryBank(start = {}) {
  const stored = new Map(Object.entries(start).map(([k, v]) => [k, { text: v, etag: 'e0' }]));
  let n = 0;
  return {
    stored,
    async get(k) { const o = stored.get(k); return o ? { etag: o.etag, httpEtag: `"${o.etag}"`, size: o.text.length, body: new Blob([o.text]).stream() } : null; },
    async head(k) { const o = stored.get(k); return o ? { etag: o.etag, httpEtag: `"${o.etag}"`, size: o.text.length } : null; },
    async put(k, text, options = {}) {
      const only = options.onlyIf;
      if (only?.etagMatches && stored.get(k)?.etag !== only.etagMatches) return null;
      if (only instanceof Headers && only.get('If-None-Match') === '*' && stored.has(k)) return null;
      stored.set(k, { text, etag: `e${++n}`, meta: options.customMetadata });
      return { etag: `e${n}` };
    },
  };
}
const lessonSource = JSON.stringify({ code: 'A7.03', working: [], sides: 6, booklet: { tool: 'resource', schemaVersion: 1, document: { kind: 'booklet-a4', title: 'A7', lessons: [{ title: 'Find the gradient' }] } } });
async function edit(method, body, { env = { ...env0, REPORT_GITHUB_TOKEN: 'secret' }, signed = true, query = '', BANK = memoryBank() } = {}) {
  const sent = [];
  const fetcher = async (url, init) => {
    if (url.startsWith(team)) return certs(url);
    sent.push([init.method, url, init.body && JSON.parse(init.body)]);
    return Response.json({ number: 52 }, { status: 201 });
  };
  const headers = { 'Content-Type': 'application/json', ...(signed ? { 'Cf-Access-Jwt-Assertion': await token({ email: 'Sam.Jones@school.example' }) } : {}) };
  const response = await serveLibraryEdits(new Request(`https://mathsdock.co.uk/api/library/edit${query}`, { method, headers, body: body && JSON.stringify(body) }), { ...env, BANK }, { fetcher });
  return { response, sent, BANK, data: await response.json() };
}
const save = { resource: 'y9-a7-03-lesson-booklet', version: 'Main', title: 'A7.03 Find the gradient', note: 'Clearer wording on question 5', failing: 0, source: lessonSource };

test('saving an edited booklet needs sign-in, a library booklet, a note and a lesson source', async () => {
  assert.equal((await edit('POST', save, { signed: false })).response.status, 403);
  for (const [change, message] of [[{ resource: '../x' }, 'Resource library'], [{ note: '  ' }, 'what you changed'], [{ source: '' }, 'not sent'], [{ source: '{' }, 'could not be read'], [{ source: '{"booklet":{"document":{"kind":"worksheet-a3","lessons":[{}]}}}' }, 'not a booklet'], [{ version: '<b>' }, 'version']]) {
    const { response, data, sent, BANK } = await edit('POST', { ...save, ...change });
    assert.equal(response.status, 400, message);
    assert.match(data.error, new RegExp(message));
    assert.equal(sent.length, 0);
    assert.equal(BANK.stored.size, 0);
  }
});

test('an edited booklet is kept under its own SHA-256, listed, and Tim is alerted through an assigned issue', async () => {
  const { response, data, sent, BANK } = await edit('POST', { ...save, note: 'Fixed <!-- library-edit {"x":1} --> Q5' });
  assert.equal(response.status, 201);
  assert.equal(data.alerted, true);
  const key = data.edit.key;
  assert.match(key, /^library\/edits\/[a-f0-9]{64}\/y9-a7-03-lesson-booklet\.json$/);
  assert.equal(BANK.stored.get(key).text, lessonSource);
  assert.equal(BANK.stored.get(key).meta.by, 'Sam Jones');
  const list = JSON.parse(BANK.stored.get('library/edits.json').text);
  assert.equal(list.edits.length, 1);
  assert.equal(list.edits[0].issue, 52);
  const [, url, issue] = sent[0];
  assert.match(url, /repos\/tboughen\/mathsdock-bank\/issues$/);
  assert.deepEqual(issue.labels, ['library-edit']);
  assert.deepEqual(issue.assignees, ['tboughen']);
  assert.equal(issue.body.match(/<!--/g).length, 1);
  assert.match(issue.body, /no build check problems/);
  const unchecked = await edit('POST', { ...save, failing: null, note: 'Thanks @someone' });
  assert.match(unchecked.sent[0][2].body, /build checks did not run/);
  assert.doesNotMatch(unchecked.sent[0][2].body, /@someone/);
  // The same file again (a retry) is one edit with one issue; the served list names it by its library-data address.
  const again = await edit('POST', save, { BANK });
  assert.equal(again.sent.length, 0);
  assert.equal(again.data.edit.issue, 52);
  const listed = await edit('GET', undefined, { BANK, query: '?resource=y9-a7-03-lesson-booklet' });
  assert.equal(listed.data.edits.length, 1);
  assert.match(listed.data.edits[0].href, /^library-data\/edits\//);
  // The saved source is served to signed-in staff like the library's files.
  const served = await serveLibrary(request(listed.data.edits[0].href, { 'Cf-Access-Jwt-Assertion': await token() }), { ...env0, BANK }, { fetcher: certs });
  assert.equal(served.status, 200);
  assert.equal(await served.text(), lessonSource);
});

test('an edit is still kept when issues are not switched on, and a damaged list is never overwritten', async () => {
  const quiet = await edit('POST', save, { env: env0 });
  assert.equal(quiet.response.status, 201);
  assert.equal(quiet.data.alerted, false);
  assert.equal(quiet.sent.length, 0);
  const damaged = await edit('POST', save, { BANK: memoryBank({ 'library/edits.json': 'not json' }) });
  assert.equal(damaged.response.status, 500);
  assert.equal(damaged.BANK.stored.get('library/edits.json').text, 'not json');
});

// Adaptation requests.
async function adapt(method, body, { env = { ...env0, REPORT_GITHUB_TOKEN: 'secret' }, issues = [], signed = true, query = '' } = {}) {
  const sent = [];
  const fetcher = async (url, init) => {
    if (url.startsWith(team)) return certs(url);
    sent.push([init.method, url, init.body && JSON.parse(init.body)]);
    if (init.method === 'GET') return Response.json(issues);
    return Response.json({ number: 52 }, { status: 201 });
  };
  const headers = { 'Content-Type': 'application/json', ...(signed ? { 'Cf-Access-Jwt-Assertion': await token({ email: 'Sam.Jones@school.example' }) } : {}) };
  const response = await serveAdaptRequests(new Request(`https://mathsdock.co.uk/api/library/adapt${query}`, { method, headers, body: body && JSON.stringify(body) }), env, { fetcher });
  return { response, sent, data: await response.json() };
}
const adaptAsk = { year: 9, unit: 'A7', lesson: 'A7.03', kind: 'easier', name: 'Easier (9X)', text: 'Whole-number gradients first.' };

test('an adaptation request needs sign-in, a scheme unit, a lesson of it, a kind, a short name and what should change', async () => {
  assert.equal((await adapt('POST', adaptAsk, { signed: false })).response.status, 403);
  assert.equal((await adapt('POST', adaptAsk, { env: env0 })).response.status, 503);
  for (const [change, message] of [[{ year: 6 }, 'year'], [{ unit: 'STARTERS' }, 'scheme unit'], [{ lesson: 'A4.03' }, 'lesson'], [{ kind: 'bespoke' }, 'easier'], [{ kind: 'constructor' }, 'easier'],
    [{ name: 'Main' }, 'short name'], [{ name: 'Easier · 9X' }, 'short name'], [{ name: 'x'.repeat(41) }, 'short name'], [{ text: ' ' }, 'change'], [{ text: 'x'.repeat(2001) }, '2000']]) {
    const { response, data, sent } = await adapt('POST', { ...adaptAsk, ...change });
    assert.equal(response.status, 400, JSON.stringify(change));
    assert.match(data.error, new RegExp(message), JSON.stringify(change));
    assert.equal(sent.length, 0);
  }
  assert.equal((await adapt('POST', { ...adaptAsk, lesson: null })).response.status, 201);
});

test('an adaptation request alerts Tim through an assigned issue and lists only its own unit', async () => {
  const { response, data, sent } = await adapt('POST', { ...adaptAsk, text: 'Easier <!-- adapt-request {"year":7} --> please' });
  assert.equal(response.status, 201);
  assert.deepEqual(data, { number: 52 });
  const [, url, issue] = sent[0];
  assert.match(url, /repos\/tboughen\/mathsdock-bank\/issues$/);
  assert.deepEqual(issue.labels, ['adapt-request']);
  assert.deepEqual(issue.assignees, ['tboughen']);
  assert.equal(issue.title, 'Adapt A7.03 (Year 9): Easier (9X), from Sam Jones');
  assert.equal(issue.body.match(/<!-- adapt-request/g).length, 1);
  assert.equal(issue.body.match(/-->/g).length, 1);
  assert.match(issue.body, /version "Easier \(9X\)", waiting for a check/);
  const meta = JSON.parse(/<!-- adapt-request (\{.*?\}) -->/.exec(issue.body)[1]);
  const mine = { number: 52, created_at: '2026-11-28T09:00:00Z', body: issue.body };
  const other = { number: 53, created_at: '2026-11-28T10:00:00Z', body: issue.body.replace('"unit":"A7"', '"unit":"A4"') };
  const listed = await adapt('GET', undefined, { issues: [mine, other], query: '?year=9&unit=A7' });
  assert.deepEqual(listed.data.requests, [{ number: 52, when: mine.created_at, lesson: 'A7.03', kind: 'easier', name: 'Easier (9X)', who: 'Sam Jones', mine: true }]);
  assert.equal(meta.from, 'sam.jones%40school.example');
  assert.equal((await adapt('GET', undefined, { query: '?year=9&unit=../x' })).response.status, 400);
});

// Present's saved ink (present-ink.mjs).
function inkBucket() {
  const store = new Map();
  return {
    store,
    async get(k) { const v = store.get(k); return v ? { json: async () => JSON.parse(v.body) } : null; },
    async put(k, body) { store.set(k, { body, uploaded: new Date(Date.UTC(2026, 10, 28, 9, store.size)) }); },
    async list({ prefix, limit }) { return { objects: [...store].filter(([k]) => k.startsWith(prefix)).slice(0, limit).map(([k, v]) => ({ key: k, uploaded: v.uploaded })) }; },
  };
}
const inkRecord = { schema: 1, sides: { 3: [{ id: 's1', kind: 'pen', colour: '#111', size: 3.5, scale: 1, points: [[1, 2], [3, 4]] }] }, stopped: { side: 3, at: '2026-11-28T09:00:00Z', flag: true }, updated: '2026-11-28T09:00:00Z' };
async function ink(method, { query = '', body, email = 'Teacher@School.example', signed = true, env, type = 'application/json' } = {}) {
  const headers = { 'Content-Type': type, ...(signed ? { 'Cf-Access-Jwt-Assertion': await token({ email }) } : {}) };
  const response = await servePresentInk(new Request(`https://mathsdock.co.uk/api/present/ink${query}`, { method, headers, body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body) }), env, { fetcher: certs });
  return { response, data: await response.json() };
}

test('Present ink is saved per teacher, class and build, under a hashed folder', async () => {
  const BANK = inkBucket(), env = { ...env0, BANK };
  const build = 'y9-a7-04-lesson-booklet@2026-11-25';
  assert.deepEqual((await ink('GET', { query: `?class=9X&build=${encodeURIComponent(build)}`, env })).data, { record: null });
  const saved = await ink('PUT', { body: { class: '9X', build, record: inkRecord }, env });
  assert.equal(saved.response.status, 200);
  const [objectKey] = BANK.store.keys();
  assert.match(objectKey, /^present-ink\/[0-9a-f]{32}\/9X\/y9-a7-04-lesson-booklet%402026-11-25\.json$/);
  assert.doesNotMatch(objectKey, /teacher|school/i);
  assert.deepEqual((await ink('GET', { query: `?class=9X&build=${encodeURIComponent(build)}`, env, email: ' teacher@school.example ' })).data, { record: inkRecord });
  assert.deepEqual((await ink('GET', { query: `?class=9X&build=${encodeURIComponent(build)}`, env, email: 'colleague@school.example' })).data, { record: null });
  assert.deepEqual((await ink('GET', { query: `?class=9Y&build=${encodeURIComponent(build)}`, env })).data, { record: null });
  await ink('PUT', { body: { class: '9X', build: 'y9-a7-04-lesson-booklet@2026-11-27', record: inkRecord }, env });
  assert.deepEqual((await ink('GET', { query: '?class=9X', env })).data.builds.map(b => b.build), ['y9-a7-04-lesson-booklet@2026-11-27', build]);
});

test('Present ink refuses what it should', async () => {
  const env = { ...env0, BANK: inkBucket() };
  const build = 'y9-a7-04-lesson-booklet@2026-11-25';
  assert.equal((await ink('GET', { query: '?class=9X', env, signed: false })).response.status, 403);
  assert.equal((await ink('GET', { query: '?class=9X', env: env0 })).response.status, 503);
  assert.equal((await servePresentInk(new Request('https://mathsdock.co.uk/api/present/ink?class=9X'), { BANK: env.BANK })).status, 503);
  assert.equal((await ink('GET', { query: '?class=9x%2F..', env })).response.status, 400);
  assert.equal((await ink('GET', { query: '?class=9X&build=..%2Fx', env })).response.status, 400);
  assert.equal((await ink('PUT', { body: { class: '9X', build, record: inkRecord }, env, type: 'text/plain' })).response.status, 415);
  assert.equal((await ink('PUT', { body: '{', env })).response.status, 400);
  assert.equal((await ink('PUT', { body: { class: '9X', build, record: { ...inkRecord, schema: 2 } }, env })).response.status, 400);
  assert.equal((await ink('PUT', { body: { class: '9X', build, record: { ...inkRecord, sides: { x: [] } } }, env })).response.status, 400);
  assert.equal((await ink('PUT', { body: { class: '9X', build, record: { ...inkRecord, sides: { 1: [{ id: 'a', kind: 'eraser', points: [] }] } } }, env })).response.status, 400);
  assert.equal((await ink('PUT', { body: { class: '9X', build, record: { ...inkRecord, pad: 'x'.repeat(1_500_001) } }, env })).response.status, 413);
  assert.equal((await ink('DELETE', { env })).response.status, 405);
  assert.equal(env.BANK.store.size, 0);
});
