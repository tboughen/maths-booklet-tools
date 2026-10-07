import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  workers: 1,
  timeout: 30000,
  use: {
    baseURL: "http://127.0.0.1:5179",
    headless: true,
    channel:
      process.env.PLAYWRIGHT_CHANNEL === "chromium"
        ? undefined
        : (process.env.PLAYWRIGHT_CHANNEL ?? "chrome"),
    viewport: { width: 1440, height: 1000 },
  },
  webServer: {
    command:
      "node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5179 --strictPort",
    url: "http://127.0.0.1:5179",
    reuseExistingServer: false,
    timeout: 30000,
  },
});
