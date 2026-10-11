import { defineConfig } from "@playwright/test";
const site = process.env.CLOUDFLARE_SITE_URL || "http://127.0.0.1:5186";
export default defineConfig({
  testDir: "./scripts/cloudflare", testMatch: "browser.spec.ts", workers: 1,
  timeout: 120000, outputDir: "cloudflare-release/browser",
  use: {baseURL: site, headless: true, channel: process.env.PLAYWRIGHT_CHANNEL && process.env.PLAYWRIGHT_CHANNEL !== "chromium" ? process.env.PLAYWRIGHT_CHANNEL : undefined, viewport: {width: 1440, height: 1000}},
  webServer: process.env.CLOUDFLARE_SITE_URL ? undefined : {
    command: "node node_modules/vite/bin/vite.js preview --mode cloudflare --outDir dist-cloudflare --host 127.0.0.1 --port 5186 --strictPort",
    url: site, reuseExistingServer: false,
  },
});
