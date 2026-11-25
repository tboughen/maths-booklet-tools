import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import worker, { serveBankAsset, serveLibrary, serveLibraryFeedback, submitReport, reportRepo, verifyAccessToken, accessSettings, gatedCache } from './site-worker.mjs';
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
async function feedback(method, body, { env = { ...env0, REPORT_GITHUB_TOKEN: 'secret', BANK: libraryBucket, LIBRARY_EDITORS: 'Sam.Jones@school.example' }, issues = [], signed = true } = {}) {
  const sent = [];
  const fetcher = async (url, init) => {
    if (url.startsWith(team)) return certs(url);
    sent.push([init.method, url, init.body && JSON.parse(init.body)]);
    if (url.endsWith('/graphql')) return Response.json({ data: { repository: { issues: { nodes: issues } } } });
    if (url.endsWith('/issues')) return Response.json({ number: 8 }, { status: 201 });
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
  assert.equal(comment[2].body, '<!-- library-from: sam.jones@school.example -->\nQ12  library-from: head@x  jumps <-!-.');
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
