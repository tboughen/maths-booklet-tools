import { defineConfig } from "@playwright/test";
const port = Number(process.env.MATHSDOCK_TEST_PORT || 5186);
const site = process.env.CLOUDFLARE_SITE_URL || `http://127.0.0.1:${port}`;
export default defineConfig({
  testDir: "./scripts/cloudflare", testMatch: "browser.spec.ts", workers: 1,
  timeout: 120000, retries: 0, outputDir: process.env.MATHSDOCK_TEST_OUTPUT || "cloudflare-release/browser",
  use: {baseURL: site, headless: true, channel: process.env.PLAYWRIGHT_CHANNEL && process.env.PLAYWRIGHT_CHANNEL !== "chromium" ? process.env.PLAYWRIGHT_CHANNEL : undefined, viewport: {width: 1440, height: 1000}},
  webServer: process.env.CLOUDFLARE_SITE_URL ? undefined : {
    command: process.env.MATHSDOCK_PACKAGE_REHEARSAL ? `node scripts/cloudflare/serve-package.mjs --port=${port}` : `node node_modules/vite/bin/vite.js preview --mode cloudflare --outDir dist-cloudflare --host 127.0.0.1 --port ${port} --strictPort`,
    url: site, reuseExistingServer: false,
  },
});
