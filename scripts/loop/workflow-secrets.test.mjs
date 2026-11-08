// No credentials in loop context (improvement list L57, docs/AUTONOMOUS-LOOP-POLICY.md section 6).
// Loop sessions and the workflows that run on pull requests never receive the Cloudflare, R2, Access
// or Render secrets: only the two manually dispatched deploy workflows may name them. The judges'
// API key is used only by the two judge workflows, and nothing triggered by pull_request_target
// checks out pull-request code or reads a secret. Read as text, so no YAML parser is needed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';

const dir = '.github/workflows';
const workflows = Object.fromEntries(readdirSync(dir).filter(f => /\.ya?ml$/.test(f)).map(f => [f, readFileSync(`${dir}/${f}`, 'utf8')]));
const DEPLOY_SECRET = /secrets\.(?:CLOUDFLARE_|R2_|CF_ACCESS_|RENDER_)\w*/g;
const DEPLOYERS = ['cloudflare.yml', 'deploy-mcp.yml'];
const JUDGES = ['judge-panel.yml', 'judge-calibration.yml'];

/** The event names under the top-level `on:` key. */
function triggers(text) {
  const lines = text.split('\n'), start = lines.findIndex(l => /^on:/.test(l));
  assert.ok(start >= 0, 'no on: key');
  const inline = lines[start].match(/^on:\s*\[?([^\]#]+)\]?/)?.[1]?.trim();
  if (inline) return inline.split(/[\s,]+/).filter(Boolean);
  const events = [];
  for (const line of lines.slice(start + 1)) {
    if (/^\S/.test(line)) break;
    const m = line.match(/^ {2}([a-z_]+):/);
    if (m) events.push(m[1]);
  }
  return events;
}

test('the workflows are all read, with their triggers', () => {
  assert.ok(Object.keys(workflows).length >= 7);
  for (const f of DEPLOYERS) assert.ok(workflows[f], f);
  assert.deepEqual(triggers(workflows['loop-auto-merge.yml']), ['workflow_run', 'pull_request_target', 'workflow_dispatch']);
});

test('only the deploy workflows name deploy secrets', () => {
  for (const [f, text] of Object.entries(workflows))
    if (!DEPLOYERS.includes(f)) assert.deepEqual(text.match(DEPLOY_SECRET) ?? [], [], f);
  assert.ok(workflows['cloudflare.yml'].match(DEPLOY_SECRET)?.length, 'the check would notice a deploy secret');
});

test('the deploy workflows run only when dispatched by hand, and publishing uses a protected environment', () => {
  for (const f of DEPLOYERS) assert.deepEqual(triggers(workflows[f]), ['workflow_dispatch'], f);
  assert.match(workflows['cloudflare.yml'], /environment: .*mathsdock-production.*mathsdock-preview/);
});

test('the judges\' API key is used only by the judge workflows', () => {
  for (const [f, text] of Object.entries(workflows))
    if (!JUDGES.includes(f)) assert.doesNotMatch(text, /ANTHROPIC_API_KEY/, f);
});

test('nothing triggered by pull_request_target checks out pull-request code or reads a secret', () => {
  for (const [f, text] of Object.entries(workflows)) {
    if (!triggers(text).includes('pull_request_target')) continue;
    assert.doesNotMatch(text, /ref:\s*\$\{\{\s*github\.event\.pull_request\.head/, f);
    assert.doesNotMatch(text, /secrets\./, f);
  }
});

test('workflows that run on pull requests reach the bank only through its read token', () => {
  for (const [f, text] of Object.entries(workflows)) {
    if (!triggers(text).some(t => t === 'pull_request' || t === 'pull_request_target' || t === 'workflow_run')) continue;
    const names = [...new Set([...text.matchAll(/secrets\.(\w+)/g)].map(m => m[1]))].sort();
    const allowed = JUDGES.includes(f) ? ['ANTHROPIC_API_KEY', 'BANK_READ_TOKEN'] : ['BANK_READ_TOKEN'];
    assert.deepEqual(names.filter(n => !allowed.includes(n)), [], f);
  }
});
