import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  testMatch: ["venn.spec.ts", "venn-layouts.spec.ts"],
  workers: 1,
  timeout: 30000,
  expect: { timeout: 5000 },
  use: {
    baseURL: process.env.MATHSDOCK_VENN_URL ?? "http://127.0.0.1:5252",
    headless: true,
    channel: "chrome",
    viewport: { width: 1440, height: 1000 },
  },
  reporter: [["list"]],
});
