import { test, expect } from './release-fixtures';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { hash } from '../packages/algebra-grid-core/src/interchange';
import type { Envelope } from '../packages/algebra-grid-core/src';
import { verifyPrintBytes } from '../packages/graph-core/src/png-bytes';

test('complete MCP to editor saved-file to MCP revision preserves pupil source', async ({ page }, info) => {
  const reserve = createServer(); await new Promise<void>(r => reserve.listen(0, '127.0.0.1', r));
  const port = (reserve.address() as { port: number }).port;
  await new Promise<void>(r => reserve.close(() => r()));
  const origin = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, ['service-dist/cli.js'], {
    windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, PORT: String(port), BIND_HOST: '127.0.0.1', GRAPH_PUBLIC_URL: origin,
      GRAPH_EDITOR_URL: 'https://mathsdock.co.uk/', DOWNLOAD_SIGNING_KEY: 'synthetic-roundtrip-only-not-a-production-key' },
  });
  const client = new Client({ name: 'qualified-editor-roundtrip', version: '1' });
  try {
    await expect.poll(async () => { try { return (await fetch(origin + '/healthz')).ok; } catch { return false; } }, { timeout: 10000 }).toBe(true);
    await client.connect(new StreamableHTTPClientTransport(new URL(origin + '/mcp')));
    const reply = await client.callTool({ name: 'create_algebra_grid', arguments: { spec: { example: 'factor', settings: { questionVisible: true } } } });
    expect(reply.isError).not.toBe(true);
    type Result = { envelope: Envelope; contentHash: string; editorUrl: string; downloads: Record<string, { url: string }>; printRaster: { width: number; height: number } };
    const made = reply.structuredContent as unknown as Result, link = new URL(made.editorUrl);
    expect(link.origin).toBe('https://mathsdock.co.uk'); expect(link.searchParams.get('tool')).toBe('expanding-factorising');
    const key = 'maths-booklet-tools:algebra-grid:v1';
    await page.goto('/?tool=expanding-factorising', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-testid="algebra-resource"]')).toBeVisible();
    const preceding = await page.evaluate(k => localStorage.getItem(k), key);
    await page.goto(`/?${link.searchParams}${link.hash}`);
    await page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click();
    expect(await page.evaluate(k => localStorage.getItem(k), key)).toBe(preceding);
    // A fresh document models reopening the cancelled link; mounted editors
    // deliberately suppress duplicate handling of an already-seen URL.
    await page.reload();
    await page.goto(`/?${link.searchParams}${link.hash}`);
    await page.getByRole('button', { name: 'Apply replacement', exact: true }).click();
    await expect.poll(async () => JSON.parse(await page.evaluate(k => localStorage.getItem(k)!, key))).toEqual(made.envelope);
    await page.locator('[data-ag-cell="0-2"]').click();
    await page.getByLabel('Cell entry', { exact: true }).fill('+3');
    await page.getByRole('button', { name: 'Apply cell', exact: true }).click();
    const edited = JSON.parse(await page.evaluate(k => localStorage.getItem(k)!, key)) as Envelope;
    expect(edited.document.rows[0].cells[2].value).toBe('+3');
    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    await expect.poll(async () => JSON.parse(await page.evaluate(k => localStorage.getItem(k)!, key))).toEqual(made.envelope);
    await page.getByRole('button', { name: 'Redo', exact: true }).click();
    await expect.poll(async () => JSON.parse(await page.evaluate(k => localStorage.getItem(k)!, key))).toEqual(edited);
    await page.getByRole('button', { name: 'File', exact: true }).click();
    const downloaded = page.waitForEvent('download');
    await page.getByRole('menuitem', { name: 'Save editable file', exact: true }).click();
    const download = await downloaded, savedPath = info.outputPath('edited-source.json'); await download.saveAs(savedPath);
    const saved = JSON.parse(await readFile(savedPath, 'utf8')) as Envelope; expect(saved).toEqual(edited);
    const baseHash = await hash(saved);
    const revised = await client.callTool({ name: 'revise_algebra_grid', arguments: { envelope: saved, baseHash, operations: [] } });
    expect(revised.isError).not.toBe(true);
    const refreshed = revised.structuredContent as unknown as Result;
    expect(refreshed.envelope).toEqual(saved); expect(refreshed.contentHash).toBe(baseHash);
    const failed = await client.callTool({ name: 'revise_algebra_grid', arguments: { envelope: saved, baseHash: '0'.repeat(64), operations: [] } });
    expect(failed.isError).toBe(true);
    const proofs = [];
    for (const format of ['svg', 'png', 'json']) {
      const response = await fetch(refreshed.downloads[format].url); expect(response.ok).toBe(true);
      const bytes = Buffer.from(await response.arrayBuffer()), path = info.outputPath(`roundtrip.${format}`);
      await writeFile(path, bytes); expect(await readFile(path)).toEqual(bytes);
      if (format === 'json') expect(JSON.parse(bytes.toString('utf8'))).toEqual(saved);
      if (format === 'png') verifyPrintBytes(bytes, refreshed.printRaster.width, refreshed.printRaster.height);
      if (format === 'svg') expect(bytes.toString('utf8')).not.toMatch(/<(?:text|image|script)\b/);
      proofs.push({ format, bytes: bytes.length, sha256: createHash('sha256').update(await readFile(path)).digest('hex') });
    }
    await page.screenshot({ path: info.outputPath('saved-roundtrip.png'), fullPage: true });
    await writeFile(info.outputPath('roundtrip-proof.json'), JSON.stringify({ sourceHash: baseHash, proofs,
      provenance: 'Actual local SDK/HTTP plus real browser/downloads; built-package rehearsal, not actual ChatGPT acceptance.' }, null, 2));
  } finally { await client.close(); child.kill(); }
});
