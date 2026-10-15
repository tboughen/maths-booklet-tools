import { defineConfig } from "@playwright/test";
import { tmpdir } from "node:os";
import { join } from "node:path";
export default defineConfig({
  testDir: "./e2e",
  workers: 1,
  timeout: 30000,
  retries: 0,
  outputDir: process.env.MATHSDOCK_TEST_OUTPUT || "test-results/consistency",
  // Keep native download staging away from long OneDrive workspace/report paths.
  use: {
    baseURL: process.env.MATHSDOCK_CONSISTENCY_URL || "http://127.0.0.1:5264",
    channel:
      process.env.PLAYWRIGHT_CHANNEL === "chromium"
        ? undefined
        : process.env.PLAYWRIGHT_CHANNEL || "chrome",
    headless: true,
    viewport: { width: 1440, height: 1000 },
    launchOptions: {
      downloadsPath:
        process.env.MATHSDOCK_DOWNLOAD_PATH ||
        join(tmpdir(), "mathsdock-consistency-downloads"),
    },
  },
});
