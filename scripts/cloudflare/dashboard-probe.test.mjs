import { test } from 'node:test';
import assert from 'node:assert/strict';
import { probeDashboardReads } from './dashboard-probe.mjs';

test('dashboard probe names each refused read without printing the token', async () => {
  const seen = [];
  const fetcher = async (url, init) => {
    seen.push({ url, auth: init.headers.Authorization });
    if (url.endsWith('/workers/services/mathsdock')) return new Response(JSON.stringify({ result: { default_environment: { environment: 'production', script: { last_deployed_from: 'dash' } } } }));
    if (url.includes('/workers/domains/records')) return new Response(JSON.stringify({ errors: [{ code: 10000, message: 'Authentication error' }] }), { status: 403 });
    if (url.includes('/schedules')) throw new Error('network down');
    return new Response(JSON.stringify({ result: [] }));
  };
  const lines = [], log = console.log;
  console.log = line => lines.push(line);
  try {
    const report = await probeDashboardReads('mathsdock', { token: 'secret-token', account: 'acct', fetcher });
    assert.equal(report.length, 7);
    assert.equal(report[0].lastDeployedFrom, 'dash');
    assert.deepEqual(report.find(r => r.path.startsWith('/workers/domains')).errors, ['10000 Authentication error']);
    assert.equal(report.find(r => r.path.endsWith('/schedules')).status, 0);
    assert.ok(seen.every(s => s.auth === 'Bearer secret-token' && s.url.startsWith('https://api.cloudflare.com/client/v4/accounts/acct/')));
    assert.ok(seen.some(s => s.url.includes('/environments/production/bindings')));
  } finally { console.log = log; }
  assert.ok(!lines.join('\n').includes('secret-token'));
  assert.ok(lines.some(l => l.startsWith('Dashboard read 403 /workers/domains/records')));
});
test('dashboard probe does nothing without credentials', async () => {
  assert.deepEqual(await probeDashboardReads('mathsdock', { token: '', account: 'acct', fetcher: () => { throw new Error('must not fetch'); } }), []);
});
