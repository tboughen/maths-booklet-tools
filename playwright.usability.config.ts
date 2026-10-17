import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  testMatch: "usability.spec.ts",
  workers: 1,
  retries: 0,
  timeout: 45000,
  outputDir: "test-results/usability",
  use: {
    baseURL: process.env.USABILITY_SITE ?? "http://127.0.0.1:5294",
    headless: true,
    channel: "chrome",
    viewport: { width: 1280, height: 900 },
    trace: "retain-on-failure",
  },
  reporter: [["list"], ["json", { outputFile: "test-results/usability.json" }]],
});
