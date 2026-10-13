import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir:"./e2e",testMatch:"accessibility-live.spec.ts",workers:1,timeout:60000,
  outputDir:"accessibility-live-results",
  use:{baseURL:"https://mathsdock.co.uk",channel:"chrome",headless:true,viewport:{width:1440,height:1000}},
});
