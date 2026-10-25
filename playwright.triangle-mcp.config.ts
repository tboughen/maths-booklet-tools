import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir:"./e2e", testMatch:["triangle.spec.ts","triangle-mcp.spec.ts"],
  workers:1,retries:0,timeout:30000,
  outputDir:process.env.TRIANGLE_MCP_BROWSER_OUTPUT || "test-results/triangle-mcp-browser",
  use:{baseURL:"http://127.0.0.1:5298",headless:true,channel:process.env.PLAYWRIGHT_CHANNEL==="chromium" ? undefined : process.env.PLAYWRIGHT_CHANNEL || "chrome",viewport:{width:1440,height:1000},screenshot:"only-on-failure",trace:"retain-on-failure"},
  webServer:{command:"node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 5298 --strictPort",url:"http://127.0.0.1:5298",reuseExistingServer:false,timeout:30000},
});
