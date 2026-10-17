import { defineConfig } from "@playwright/test";
import { join } from "node:path";
import { tmpdir } from "node:os";
export default defineConfig({
  testDir: "./e2e",
  testMatch: /algebra-grid\.spec\.ts|site-navigation\.spec\.ts/,
  outputDir:
    process.env.MATHSDOCK_ALGEBRA_TEST_OUTPUT || "test-results/algebra-grid",
  workers: 1,
  retries: 0,
  timeout: 30000,
  use: {
    baseURL: process.env.MATHSDOCK_ALGEBRA_URL || "http://127.0.0.1:5283",
    headless: true,
    channel: "chrome",
    viewport: { width: 1440, height: 1000 },
    // Chrome's native download staging must stay outside long OneDrive reports.
    launchOptions: { downloadsPath: join(tmpdir(), "mathsdock-algebra-downloads") },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
});
