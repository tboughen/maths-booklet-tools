import { defineConfig } from "@playwright/test";
const site = process.env.ASSESSMENT_SITE_URL || "http://127.0.0.1:5199";
export default defineConfig({
  testDir: "./e2e", testMatch: "assessment.spec.ts", workers: 1, timeout: 90000,
  outputDir: "test-results/assessment",
  use: { baseURL: site, channel: process.env.PLAYWRIGHT_CHANNEL === "chromium" ? undefined : (process.env.PLAYWRIGHT_CHANNEL || "chrome"), headless: true, viewport: { width: 1440, height: 1000 } },
  webServer: process.env.ASSESSMENT_SITE_URL ? undefined : { command: "node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5199 --strictPort", url: site, reuseExistingServer: false, timeout: 30000 },
});
