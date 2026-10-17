import { defineConfig } from '@playwright/test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
export default defineConfig({
  testDir: './e2e', workers: 1, timeout: 30000, retries: 0,
  outputDir: process.env.MATHSDOCK_TEST_OUTPUT || 'test-results/refinement',
  use: { baseURL: 'http://127.0.0.1:5296', headless: true, channel: process.env.PLAYWRIGHT_CHANNEL === 'chromium' ? undefined : (process.env.PLAYWRIGHT_CHANNEL || 'chrome'), viewport: { width: 1440, height: 1000 }, launchOptions: { downloadsPath: join(tmpdir(), 'mathsdock-refinement-downloads') } },
});
