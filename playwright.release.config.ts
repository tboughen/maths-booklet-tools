import { defineConfig } from '@playwright/test';
const port = Number(process.env.MATHSDOCK_TEST_PORT || 5230);
const directory = process.env.MATHSDOCK_RELEASE_PACKAGE || 'cloudflare-release/package';
export default defineConfig({
  testDir: './e2e', workers: 1, timeout: 30000, retries: 0,
  outputDir: process.env.MATHSDOCK_TEST_OUTPUT || 'test-results/release',
  use: { baseURL: `http://127.0.0.1:${port}`, headless: true, channel: process.env.PLAYWRIGHT_CHANNEL === 'chromium' ? undefined : (process.env.PLAYWRIGHT_CHANNEL || 'chrome'), viewport: { width: 1440, height: 1000 } },
  webServer: { command: `node scripts/cloudflare/serve-package.mjs --package=${directory} --port=${port}`, url: `http://127.0.0.1:${port}`, reuseExistingServer: false, timeout: 30000 },
});
