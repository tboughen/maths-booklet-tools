import { defineConfig } from "@playwright/test";
import { join } from "node:path";
import { tmpdir } from "node:os";
export default defineConfig({
  testDir: "./e2e",
  testMatch: "triangle.spec.ts",
  workers: 1,
  retries: 0,
  timeout: 30000,
  outputDir:
    process.env.MATHSDOCK_TRIANGLE_TEST_OUTPUT || "test-results/triangle",
  use: {
    baseURL: process.env.MATHSDOCK_TRIANGLE_URL || "http://127.0.0.1:5275",
    headless: true,
    channel:
      process.env.PLAYWRIGHT_CHANNEL === "chromium"
        ? undefined
        : process.env.PLAYWRIGHT_CHANNEL || "chrome",
    viewport: { width: 1440, height: 1000 },
    launchOptions: {
      downloadsPath: join(tmpdir(), "mathsdock-triangle-downloads"),
    },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
});
