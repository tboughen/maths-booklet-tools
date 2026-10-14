import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e", testMatch: "assessment.spec.ts", workers: 1, timeout: 90000,
  outputDir: "test-results/assessment",
  use: { baseURL: "http://127.0.0.1:5199", channel: "chrome", headless: true, viewport: { width: 1440, height: 1000 } },
  webServer: { command: "node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5199 --strictPort", url: "http://127.0.0.1:5199", reuseExistingServer: false, timeout: 30000 },
});
