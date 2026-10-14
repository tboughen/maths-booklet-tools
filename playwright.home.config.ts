import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

export default defineConfig({
  ...base,
  outputDir: "../reports/homepage-consistency-2026-10-14/browser-results",
  use: { ...base.use, baseURL: "http://127.0.0.1:5212" },
  webServer: {
    command: "node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5212 --strictPort",
    url: "http://127.0.0.1:5212",
    reuseExistingServer: true,
    timeout: 30000,
  },
});
